from __future__ import annotations

import csv
import json
from functools import lru_cache
from math import log2
from pathlib import Path
from statistics import mean, pstdev

CRITERIA = ("yield", "forecast", "demand", "climate")
DEFAULT_WEIGHTS = {
    "yield": 0.32,
    "forecast": 0.33,
    "demand": 0.17,
    "climate": 0.18,
}
RANDOM_INDEX = {
    1: 0.0,
    2: 0.0,
    3: 0.58,
    4: 0.90,
    5: 1.12,
    6: 1.24,
    7: 1.32,
    8: 1.41,
    9: 1.45,
    10: 1.49,
}
BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_PROFILE_PATH = BASE_DIR / "backend" / "scoring_profile.json"


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def safe_float(value, default: float | None = 0.0) -> float | None:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def normalize_range(
    value: float | None,
    minimum: float | None,
    maximum: float | None,
    default: float = 50.0,
) -> float:
    if value is None or minimum is None or maximum is None:
        return default
    if maximum <= minimum:
        return default
    return clamp(((value - minimum) / (maximum - minimum)) * 100, 0, 100)


def history_summary(rows: list[dict]) -> dict[str, float | int | None]:
    yield_values = [safe_float(row.get("yield_kg_decare"), None) for row in rows]
    yield_values = [value for value in yield_values if value is not None and value > 0]
    production_values = [safe_float(row.get("production_ton"), None) for row in rows]
    production_values = [value for value in production_values if value is not None and value > 0]
    latest_row = rows[-1] if rows else None
    avg_yield = mean(yield_values) if yield_values else None
    latest_yield = safe_float(latest_row.get("yield_kg_decare"), None) if latest_row else None
    latest_production = safe_float(latest_row.get("production_ton"), None) if latest_row else None

    if len(yield_values) >= 2 and avg_yield and avg_yield > 0:
        variation = pstdev(yield_values) / avg_yield
        stability_score = round(clamp(100 - (variation * 120), 30, 95), 1)
    elif yield_values:
        stability_score = 72.0
    else:
        stability_score = 55.0

    return {
        "history_years": len(rows),
        "avg_yield": avg_yield,
        "latest_yield": latest_yield,
        "latest_production": latest_production,
        "stability_score": stability_score,
        "avg_production": mean(production_values) if production_values else None,
    }


def risk_payload(avg_temp: float, avg_rainfall: float, avg_soil: float) -> dict[str, object]:
    score = max(5, min(95, round((avg_temp * 3.1) - (avg_rainfall * 0.28) - (avg_soil * 0.12) + 28)))
    if score >= 68:
        level = "Y\u00fcksek"
    elif score >= 42:
        level = "Orta"
    else:
        level = "D\u00fc\u015f\u00fck"
    return {
        "score": score,
        "level": level,
    }


def normalize_weights(weights: dict[str, float | int]) -> dict[str, float]:
    normalized = {criterion: float(weights.get(criterion, 0.0) or 0.0) for criterion in CRITERIA}
    total = sum(normalized.values())
    if total <= 0:
        return DEFAULT_WEIGHTS.copy()
    return {criterion: normalized[criterion] / total for criterion in CRITERIA}


def compute_weighted_score(component_scores: dict[str, float], weights: dict[str, float] | None = None) -> float:
    effective_weights = normalize_weights(weights or get_score_weights())
    return round(sum((component_scores.get(key, 0.0) or 0.0) * effective_weights[key] for key in CRITERIA), 1)


def _parse_ratio(value: str) -> float:
    raw = str(value).strip()
    if "/" in raw:
        left, right = raw.split("/", 1)
        return float(left) / float(right)
    return float(raw)


def read_pairwise_matrix_csv(path: str | Path) -> dict[str, object]:
    matrix_path = Path(path)
    with matrix_path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.reader(handle))

    header = [item.strip() for item in rows[0][1:]]
    matrix_rows = []
    labels = []
    for row in rows[1:]:
        if not row:
            continue
        labels.append(row[0].strip())
        matrix_rows.append([_parse_ratio(cell) for cell in row[1:]])

    return {
        "criteria": header,
        "labels": labels,
        "matrix": matrix_rows,
    }


def _matrix_vector_product(matrix: list[list[float]], vector: list[float]) -> list[float]:
    return [sum(row[i] * vector[i] for i in range(len(vector))) for row in matrix]


def ahp_weights_from_matrix(
    criteria: list[str],
    matrix: list[list[float]],
    *,
    max_iter: int = 1000,
    tolerance: float = 1e-11,
) -> dict[str, object]:
    size = len(criteria)
    if size == 0:
        raise ValueError("AHP matrisi bo\u015f olamaz.")
    if any(len(row) != size for row in matrix):
        raise ValueError("AHP matrisi kare olmal\u0131d\u0131r.")

    vector = [1.0 / size] * size
    for _ in range(max_iter):
        next_vector = _matrix_vector_product(matrix, vector)
        total = sum(next_vector)
        if total <= 0:
            raise ValueError("AHP matrisi pozitif olmal\u0131d\u0131r.")
        next_vector = [value / total for value in next_vector]
        if max(abs(next_vector[i] - vector[i]) for i in range(size)) < tolerance:
            vector = next_vector
            break
        vector = next_vector

    weighted = _matrix_vector_product(matrix, vector)
    lambda_max = sum(weighted[i] / vector[i] for i in range(size)) / size
    consistency_index = (lambda_max - size) / (size - 1) if size > 2 else 0.0
    random_index = RANDOM_INDEX.get(size, 1.49)
    consistency_ratio = consistency_index / random_index if random_index else 0.0

    return {
        "criteria": criteria,
        "weights": {criteria[i]: vector[i] for i in range(size)},
        "lambdaMax": lambda_max,
        "consistencyIndex": consistency_index,
        "consistencyRatio": consistency_ratio,
        "isConsistent": consistency_ratio < 0.10,
    }


def weight_percentages(weights: dict[str, float] | None = None) -> dict[str, int]:
    effective = normalize_weights(weights or get_score_weights())
    return {criterion: int(round(effective[criterion] * 100)) for criterion in CRITERIA}


@lru_cache(maxsize=1)
def get_scoring_profile(profile_path: str | None = None) -> dict[str, object]:
    path = Path(profile_path) if profile_path else DEFAULT_PROFILE_PATH
    if not path.exists():
        return {
            "profileName": "default_mvp_weights",
            "weights": DEFAULT_WEIGHTS.copy(),
            "weightPercents": weight_percentages(DEFAULT_WEIGHTS),
        }

    data = json.loads(path.read_text(encoding="utf-8"))
    weights = normalize_weights(data.get("weights", DEFAULT_WEIGHTS))
    data["weights"] = weights
    data["weightPercents"] = {criterion: int(round(weights[criterion] * 100)) for criterion in CRITERIA}
    return data


def get_score_weights() -> dict[str, float]:
    return dict(get_scoring_profile().get("weights", DEFAULT_WEIGHTS))


def dcg_at_k(values: list[float], k: int = 3) -> float:
    score = 0.0
    for index, value in enumerate(values[:k], start=1):
        score += value / log2(index + 1)
    return score
