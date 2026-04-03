from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parents[2]
BACKEND_DIR = ROOT / "backend"
sys.path.append(str(BACKEND_DIR))

from db.connection import get_connection
from psycopg.rows import dict_row
from scoring import (  # noqa: E402
    ahp_weights_from_matrix,
    clamp,
    compute_weighted_score,
    dcg_at_k,
    history_summary,
    normalize_range,
    normalize_weights,
    read_pairwise_matrix_csv,
    risk_payload,
    safe_float,
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AHP agirliklari ve sehir-yil backtest raporu uretir.")
    parser.add_argument("--matrix", default=str(ROOT / "docs" / "ahp_pairwise_matrix.csv"))
    parser.add_argument("--profile", default=str(ROOT / "backend" / "scoring_profile.json"))
    parser.add_argument("--report", default=str(ROOT / "docs" / "ahp_backtest_report.json"))
    parser.add_argument("--start-year", type=int, default=2020)
    parser.add_argument("--end-year", type=int, default=2024)
    parser.add_argument("--min-products", type=int, default=4)
    parser.add_argument("--write-profile", action="store_true")
    return parser.parse_args()


def fetch_walk_forward_predictions(start_year: int, end_year: int) -> list[dict]:
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT city_name,
                       product_name,
                       forecast_year,
                       predicted_production,
                       actual_production,
                       horizon
                FROM analytics.walk_forward_predictions
                WHERE forecast_year BETWEEN %(start_year)s AND %(end_year)s
                ORDER BY city_name ASC, forecast_year ASC, product_name ASC
                """,
                {"start_year": start_year, "end_year": end_year},
            )
            return cursor.fetchall()


def fetch_production_rows(start_year: int, end_year: int) -> list[dict]:
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT city_name,
                       product_name,
                       year,
                       yield_kg_decare,
                       production_ton
                FROM analytics.production_history
                WHERE year BETWEEN %(start_year)s AND %(end_year)s
                ORDER BY city_name ASC, product_name ASC, year ASC
                """,
                {"start_year": start_year - 5, "end_year": end_year - 1},
            )
            return cursor.fetchall()


def fetch_consumption_rows(start_year: int, end_year: int) -> list[dict]:
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT product_name,
                       year,
                       AVG(value) AS consumption_value
                FROM analytics.consumption_history
                WHERE year BETWEEN %(start_year)s AND %(end_year)s
                  AND metric_name ILIKE 'T%%ketim%%'
                GROUP BY product_name, year
                ORDER BY product_name ASC, year ASC
                """,
                {"start_year": start_year - 2, "end_year": end_year},
            )
            return cursor.fetchall()


def fetch_climate_rows(start_year: int, end_year: int) -> list[dict]:
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT city_name,
                       EXTRACT(YEAR FROM observation_date)::int AS climate_year,
                       AVG(temperature_avg_c) AS avg_temp,
                       AVG(rainfall_mm) AS avg_rainfall,
                       AVG(soil_moisture_pct) AS avg_soil
                FROM analytics.climate_history
                WHERE EXTRACT(YEAR FROM observation_date)::int BETWEEN %(start_year)s AND %(end_year)s
                GROUP BY city_name, EXTRACT(YEAR FROM observation_date)::int
                ORDER BY city_name ASC, climate_year ASC
                """,
                {"start_year": start_year - 1, "end_year": end_year - 1},
            )
            return cursor.fetchall()


def build_indexes(
    production_rows: list[dict],
    consumption_rows: list[dict],
    climate_rows: list[dict],
) -> tuple[dict, dict, dict]:
    production_index: dict[tuple[str, str], list[dict]] = defaultdict(list)
    for row in production_rows:
        production_index[(row["city_name"], row["product_name"])].append(row)

    consumption_index: dict[str, list[dict]] = defaultdict(list)
    for row in consumption_rows:
        consumption_index[row["product_name"]].append(row)

    climate_index: dict[tuple[str, int], dict] = {}
    for row in climate_rows:
        climate_index[(row["city_name"], row["climate_year"])] = row

    return production_index, consumption_index, climate_index


def nearest_consumption_value(rows: list[dict], target_year: int) -> float | None:
    if not rows:
        return None
    prioritized = sorted(
        rows,
        key=lambda item: (0 if item["year"] == target_year else 1, abs(item["year"] - target_year), -item["year"]),
    )
    return safe_float(prioritized[0].get("consumption_value"), None)


def candidate_history_rows(production_index: dict, city_name: str, product_name: str, forecast_year: int) -> list[dict]:
    rows = production_index.get((city_name, product_name), [])
    return [row for row in rows if forecast_year - 5 <= row["year"] < forecast_year]


def scenario_component_rows(
    scenario_rows: list[dict],
    production_index: dict,
    consumption_index: dict,
    climate_index: dict,
    weights: dict[str, float],
) -> list[dict]:
    forecast_values = [safe_float(row.get("predicted_production"), 0.0) or 0.0 for row in scenario_rows]
    forecast_min, forecast_max = min(forecast_values), max(forecast_values)
    climate_row = climate_index.get((scenario_rows[0]["city_name"], scenario_rows[0]["forecast_year"] - 1))
    avg_temp = safe_float((climate_row or {}).get("avg_temp"), 15.0) or 15.0
    avg_rainfall = safe_float((climate_row or {}).get("avg_rainfall"), 45.0) or 45.0
    avg_soil = safe_float((climate_row or {}).get("avg_soil"), 30.0) or 30.0
    climate = risk_payload(avg_temp, avg_rainfall, avg_soil)
    climate_base = 100 - climate["score"]

    prepared = []
    for row in scenario_rows:
        history_rows = candidate_history_rows(production_index, row["city_name"], row["product_name"], row["forecast_year"])
        history = history_summary(history_rows)
        expected_yield = history.get("avg_yield") or history.get("latest_yield")
        demand_value = nearest_consumption_value(consumption_index.get(row["product_name"], []), row["forecast_year"])
        prepared.append(
            {
                "city_name": row["city_name"],
                "product_name": row["product_name"],
                "forecast_year": row["forecast_year"],
                "predicted_production": safe_float(row.get("predicted_production"), 0.0) or 0.0,
                "actual_production": safe_float(row.get("actual_production"), 0.0) or 0.0,
                "expected_yield": expected_yield,
                "demand_value": demand_value,
                "stability_score": history.get("stability_score") or 55.0,
                "history_years": history.get("history_years") or 0,
                "climate_score": round(clamp((climate_base * 0.6) + (((history.get("stability_score") or 55.0) * 0.4)), 20, 95), 1),
            }
        )

    yield_values = [item["expected_yield"] for item in prepared if item["expected_yield"] is not None]
    demand_values = [item["demand_value"] for item in prepared if item["demand_value"] is not None]
    yield_min, yield_max = (min(yield_values), max(yield_values)) if yield_values else (None, None)
    demand_min, demand_max = (min(demand_values), max(demand_values)) if demand_values else (None, None)

    for item in prepared:
        item["yield_score"] = round(normalize_range(item["expected_yield"], yield_min, yield_max, default=55), 1)
        item["forecast_score"] = round(normalize_range(item["predicted_production"], forecast_min, forecast_max, default=55), 1)
        item["demand_score"] = round(normalize_range(item["demand_value"], demand_min, demand_max, default=50), 1)
        item["total_score"] = compute_weighted_score(
            {
                "yield": item["yield_score"],
                "forecast": item["forecast_score"],
                "demand": item["demand_score"],
                "climate": item["climate_score"],
            },
            weights,
        )
    return prepared


def ranking_map(rows: list[dict], key: str) -> dict[str, int]:
    ordered = sorted(rows, key=lambda item: (item[key], item.get("actual_production", 0.0)), reverse=True)
    return {row["product_name"]: index for index, row in enumerate(ordered, start=1)}


def spearman_rank(rows: list[dict]) -> float | None:
    n = len(rows)
    if n < 2:
        return None
    score_ranks = ranking_map(rows, "total_score")
    actual_ranks = ranking_map(rows, "actual_production")
    diff_sum = sum((score_ranks[row["product_name"]] - actual_ranks[row["product_name"]]) ** 2 for row in rows)
    return 1 - ((6 * diff_sum) / (n * (n * n - 1)))


def ndcg_at_3(rows: list[dict]) -> float | None:
    if len(rows) < 3:
        return None
    scored = sorted(rows, key=lambda item: item["total_score"], reverse=True)
    ideal = sorted(rows, key=lambda item: item["actual_production"], reverse=True)
    ideal_dcg = dcg_at_k([item["actual_production"] for item in ideal], k=3)
    if ideal_dcg <= 0:
        return None
    scored_dcg = dcg_at_k([item["actual_production"] for item in scored], k=3)
    return scored_dcg / ideal_dcg


def run_backtest(start_year: int, end_year: int, min_products: int, weights: dict[str, float]) -> dict[str, object]:
    predictions = fetch_walk_forward_predictions(start_year, end_year)
    production_rows = fetch_production_rows(start_year, end_year)
    consumption_rows = fetch_consumption_rows(start_year, end_year)
    climate_rows = fetch_climate_rows(start_year, end_year)
    production_index, consumption_index, climate_index = build_indexes(production_rows, consumption_rows, climate_rows)

    grouped: dict[tuple[str, int], list[dict]] = defaultdict(list)
    for row in predictions:
        grouped[(row["city_name"], row["forecast_year"])] .append(row)

    scenario_reports = []
    top1_hits = 0
    top3_hits = 0
    spearman_values = []
    ndcg_values = []
    candidate_count = 0

    for (city_name, forecast_year), scenario_rows in sorted(grouped.items()):
        if len(scenario_rows) < min_products:
            continue
        prepared = scenario_component_rows(scenario_rows, production_index, consumption_index, climate_index, weights)
        if len(prepared) < min_products:
            continue

        candidate_count += len(prepared)
        scored = sorted(prepared, key=lambda item: (item["total_score"], item["predicted_production"]), reverse=True)
        actual_rank = ranking_map(prepared, "actual_production")
        top_pick = scored[0]
        top_pick_rank = actual_rank[top_pick["product_name"]]
        top1_hits += int(top_pick_rank == 1)
        top3_hits += int(top_pick_rank <= 3)

        rho = spearman_rank(prepared)
        if rho is not None:
            spearman_values.append(rho)

        ndcg_value = ndcg_at_3(prepared)
        if ndcg_value is not None:
            ndcg_values.append(ndcg_value)

        scenario_reports.append(
            {
                "city": city_name,
                "forecastYear": forecast_year,
                "candidateCount": len(prepared),
                "topPick": top_pick["product_name"],
                "topPickScore": round(top_pick["total_score"], 1),
                "topPickActualRank": top_pick_rank,
                "topPickActualProduction": round(top_pick["actual_production"], 2),
                "bestActualProduct": max(prepared, key=lambda item: item["actual_production"])["product_name"],
                "spearman": round(rho, 4) if rho is not None else None,
                "ndcgAt3": round(ndcg_value, 4) if ndcg_value is not None else None,
            }
        )

    scenario_count = len(scenario_reports)
    return {
        "scenarioCount": scenario_count,
        "candidateCount": candidate_count,
        "top1ExactRate": round((top1_hits / scenario_count) * 100, 2) if scenario_count else 0.0,
        "top3HitRate": round((top3_hits / scenario_count) * 100, 2) if scenario_count else 0.0,
        "meanSpearman": round(mean(spearman_values), 4) if spearman_values else None,
        "meanNdcgAt3": round(mean(ndcg_values), 4) if ndcg_values else None,
        "sampleScenarios": scenario_reports[:20],
    }


def build_profile(result: dict[str, object], matrix_path: str) -> dict[str, object]:
    return {
        "profileName": "ahp_v1_expert_seed",
        "updatedAt": "2026-04-03",
        "source": "AHP pairwise comparison matrix with agricultural domain judgment",
        "criteriaOrder": result["criteria"],
        "weights": normalize_weights(result["weights"]),
        "pairwiseMatrixPath": matrix_path,
        "pairwiseMatrix": result["matrix"],
        "consistency": {
            "lambdaMax": round(result["lambdaMax"], 10),
            "consistencyIndex": round(result["consistencyIndex"], 10),
            "consistencyRatio": round(result["consistencyRatio"], 10),
            "threshold": 0.1,
            "isAcceptable": bool(result["isConsistent"]),
        },
    }


def main() -> None:
    args = parse_args()
    matrix_payload = read_pairwise_matrix_csv(args.matrix)
    ahp_result = ahp_weights_from_matrix(matrix_payload["criteria"], matrix_payload["matrix"])
    ahp_result["matrix"] = matrix_payload["matrix"]
    weights = normalize_weights(ahp_result["weights"])
    backtest = run_backtest(args.start_year, args.end_year, args.min_products, weights)

    payload = {
        "matrixPath": str(Path(args.matrix).resolve()),
        "profilePath": str(Path(args.profile).resolve()),
        "criteria": matrix_payload["criteria"],
        "weights": weights,
        "consistency": {
            "lambdaMax": round(ahp_result["lambdaMax"], 10),
            "consistencyIndex": round(ahp_result["consistencyIndex"], 10),
            "consistencyRatio": round(ahp_result["consistencyRatio"], 10),
            "isAcceptable": bool(ahp_result["isConsistent"]),
        },
        "backtest": backtest,
    }

    report_path = Path(args.report)
    report_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    if args.write_profile:
        profile = build_profile(ahp_result, str(Path(args.matrix).resolve()))
        Path(args.profile).write_text(json.dumps(profile, ensure_ascii=False, indent=2), encoding="utf-8")

    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
