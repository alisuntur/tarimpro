import json
from datetime import date

from psycopg.rows import dict_row

from .connection import get_connection

SESSION_DURATION_SQL = {
    False: "now() + interval '1 day'",
    True: "now() + interval '30 days'",
}

TURKISH_ASCII_TRANSLATION = str.maketrans(
    {
        'ç': 'c',
        'Ç': 'C',
        'ğ': 'g',
        'Ğ': 'G',
        'ı': 'i',
        'İ': 'I',
        'ö': 'o',
        'Ö': 'O',
        'ş': 's',
        'Ş': 'S',
        'ü': 'u',
        'Ü': 'U',
    }
)


def _user_select_sql() -> str:
    return """
        SELECT id, tc_identity_no, phone, email, password_hash, full_name,
               city, district, member_since, role, active_badge, is_active,
               created_at, updated_at
        FROM app.users
    """


def _plan_select_sql() -> str:
    return """
        SELECT p.id,
               p.user_id,
               p.field_id,
               p.selected_crop_name,
               p.region_code,
               p.season_year,
               p.status,
               p.target_yield_percent,
               p.planned_area_decare,
               p.planned_sowing_date,
               p.planned_harvest_date,
               p.city,
               p.district,
               p.created_at,
               p.updated_at,
               f.name AS field_name,
               f.city AS field_city,
               f.district AS field_district,
               f.area_decare AS field_area_decare
        FROM app.production_plans AS p
        LEFT JOIN app.fields AS f ON f.id = p.field_id
    """


def _ascii_lookup(value: str) -> str:
    return " ".join(value.strip().translate(TURKISH_ASCII_TRANSLATION).split())


def _lookup_candidates(value: str | None) -> list[str]:
    if not value:
        return []

    raw = " ".join(str(value).strip().split())
    candidates: list[str] = []
    for item in (raw, _ascii_lookup(raw)):
        if item and item not in candidates:
            candidates.append(item)
    return candidates


def _forecast_years(limit: int = 3, reference_year: int | None = None) -> list[int]:
    effective_year = reference_year or date.today().year
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT DISTINCT year
                FROM analytics.model_predictions
                WHERE year >= %(effective_year)s
                ORDER BY year ASC
                LIMIT %(limit)s
                """,
                {"effective_year": effective_year, "limit": limit},
            )
            years = [row["year"] for row in cursor.fetchall()]
            if years:
                return years

            cursor.execute(
                """
                SELECT DISTINCT year
                FROM analytics.model_predictions
                ORDER BY year ASC
                LIMIT %(limit)s
                """,
                {"limit": limit},
            )
            return [row["year"] for row in cursor.fetchall()]


def get_user_by_id(user_id: str):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                {_user_select_sql()}
                WHERE id = %(user_id)s
                LIMIT 1
                """,
                {"user_id": user_id},
            )
            return cursor.fetchone()


def get_user_by_identifier(identifier: str):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                {_user_select_sql()}
                WHERE phone = %(identifier)s
                   OR email = %(identifier)s
                   OR tc_identity_no = %(identifier)s
                LIMIT 1
                """,
                {"identifier": identifier},
            )
            return cursor.fetchone()


def update_user_profile(user_id: str, payload: dict[str, object]):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE app.users
                SET full_name = %(full_name)s,
                    phone = %(phone)s,
                    email = %(email)s,
                    city = %(city)s,
                    district = %(district)s,
                    updated_at = now()
                WHERE id = %(user_id)s
                RETURNING id, tc_identity_no, phone, email, password_hash, full_name,
                          city, district, member_since, role, active_badge, is_active,
                          created_at, updated_at
                """,
                {"user_id": user_id, **payload},
            )
            updated = cursor.fetchone()
        connection.commit()
    return updated


def create_user_session(user_id: str, token_hash: str, remember_me: bool = False):
    expires_at_sql = SESSION_DURATION_SQL[bool(remember_me)]
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                INSERT INTO app.user_sessions (user_id, token_hash, remember_me, expires_at)
                VALUES (%(user_id)s, %(token_hash)s, %(remember_me)s, {expires_at_sql})
                RETURNING id, user_id, remember_me, expires_at, created_at
                """,
                {
                    "user_id": user_id,
                    "token_hash": token_hash,
                    "remember_me": remember_me,
                },
            )
            session = cursor.fetchone()
        connection.commit()
    return session


def get_user_by_session_token_hash(token_hash: str):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT u.id, u.tc_identity_no, u.phone, u.email, u.password_hash,
                       u.full_name, u.city, u.district, u.member_since, u.role,
                       u.active_badge, u.is_active, s.expires_at
                FROM app.user_sessions AS s
                INNER JOIN app.users AS u ON u.id = s.user_id
                WHERE s.token_hash = %(token_hash)s
                  AND s.revoked_at IS NULL
                  AND s.expires_at > now()
                  AND u.is_active = true
                LIMIT 1
                """,
                {"token_hash": token_hash},
            )
            return cursor.fetchone()


def touch_user_session(token_hash: str):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE app.user_sessions
                SET last_seen_at = now()
                WHERE token_hash = %(token_hash)s
                  AND revoked_at IS NULL
                """,
                {"token_hash": token_hash},
            )
        connection.commit()


def revoke_user_session(token_hash: str):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE app.user_sessions
                SET revoked_at = now()
                WHERE token_hash = %(token_hash)s
                  AND revoked_at IS NULL
                """,
                {"token_hash": token_hash},
            )
            changed = cursor.rowcount
        connection.commit()
    return changed > 0


def get_fields_for_user(user_id: str):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, name, city, district, region_code, area_decare,
                       soil_type, latitude, longitude, notes, created_at, updated_at
                FROM app.fields
                WHERE user_id = %(user_id)s
                ORDER BY created_at ASC, name ASC
                """,
                {"user_id": user_id},
            )
            return cursor.fetchall()


def get_field_for_user(user_id: str, field_id: str):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, name, city, district, region_code, area_decare,
                       soil_type, latitude, longitude, notes, created_at, updated_at
                FROM app.fields
                WHERE user_id = %(user_id)s
                  AND id = %(field_id)s
                LIMIT 1
                """,
                {"user_id": user_id, "field_id": field_id},
            )
            return cursor.fetchone()


def create_field(user_id: str, payload: dict[str, object]):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO app.fields (
                    user_id, name, city, district, region_code, area_decare,
                    soil_type, latitude, longitude, notes
                )
                VALUES (
                    %(user_id)s, %(name)s, %(city)s, %(district)s, %(region_code)s,
                    %(area_decare)s, %(soil_type)s, %(latitude)s, %(longitude)s, %(notes)s
                )
                RETURNING id, name, city, district, region_code, area_decare,
                          soil_type, latitude, longitude, notes, created_at, updated_at
                """,
                {"user_id": user_id, **payload},
            )
            field = cursor.fetchone()
        connection.commit()
    return field


def update_field(user_id: str, field_id: str, payload: dict[str, object]):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE app.fields
                SET name = %(name)s,
                    city = %(city)s,
                    district = %(district)s,
                    region_code = %(region_code)s,
                    area_decare = %(area_decare)s,
                    soil_type = %(soil_type)s,
                    latitude = %(latitude)s,
                    longitude = %(longitude)s,
                    notes = %(notes)s,
                    updated_at = now()
                WHERE id = %(field_id)s
                  AND user_id = %(user_id)s
                RETURNING id, name, city, district, region_code, area_decare,
                          soil_type, latitude, longitude, notes, created_at, updated_at
                """,
                {"user_id": user_id, "field_id": field_id, **payload},
            )
            field = cursor.fetchone()
        connection.commit()
    return field


def delete_field(user_id: str, field_id: str):
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM app.fields
                WHERE id = %(field_id)s
                  AND user_id = %(user_id)s
                """,
                {"user_id": user_id, "field_id": field_id},
            )
            deleted = cursor.rowcount
        connection.commit()
    return deleted > 0


def create_production_plan(user_id: str, payload: dict[str, object]):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO app.production_plans (
                    user_id, field_id, selected_crop_name, region_code, season_year,
                    status, target_yield_percent, planned_area_decare,
                    planned_sowing_date, planned_harvest_date, city, district
                )
                VALUES (
                    %(user_id)s, %(field_id)s, %(selected_crop_name)s, %(region_code)s,
                    %(season_year)s, %(status)s, %(target_yield_percent)s,
                    %(planned_area_decare)s, %(planned_sowing_date)s,
                    %(planned_harvest_date)s, %(city)s, %(district)s
                )
                RETURNING id
                """,
                {"user_id": user_id, **payload},
            )
            created = cursor.fetchone()
        connection.commit()
    return get_production_plan_for_user(user_id, created["id"])


def update_production_plan(user_id: str, plan_id: str, payload: dict[str, object]):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE app.production_plans
                SET field_id = %(field_id)s,
                    selected_crop_name = %(selected_crop_name)s,
                    region_code = %(region_code)s,
                    season_year = %(season_year)s,
                    status = %(status)s,
                    target_yield_percent = %(target_yield_percent)s,
                    planned_area_decare = %(planned_area_decare)s,
                    planned_sowing_date = %(planned_sowing_date)s,
                    planned_harvest_date = %(planned_harvest_date)s,
                    city = %(city)s,
                    district = %(district)s,
                    updated_at = now()
                WHERE id = %(plan_id)s
                  AND user_id = %(user_id)s
                RETURNING id
                """,
                {"user_id": user_id, "plan_id": plan_id, **payload},
            )
            updated = cursor.fetchone()
        connection.commit()
    return get_production_plan_for_user(user_id, updated["id"]) if updated else None


def get_production_plan_for_user(user_id: str, plan_id: str):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                {_plan_select_sql()}
                WHERE p.user_id = %(user_id)s
                  AND p.id = %(plan_id)s
                LIMIT 1
                """,
                {"user_id": user_id, "plan_id": plan_id},
            )
            return cursor.fetchone()


def get_production_plans_for_user(user_id: str, limit: int | None = None):
    sql = f"""
        {_plan_select_sql()}
        WHERE p.user_id = %(user_id)s
        ORDER BY p.season_year DESC NULLS LAST, p.created_at DESC
    """
    params: dict[str, object] = {"user_id": user_id}
    if limit is not None:
        sql += " LIMIT %(limit)s"
        params["limit"] = limit

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()


def get_plan_history(user_id: str, limit: int | None = None):
    return get_production_plans_for_user(user_id, limit=limit)


def get_dashboard_alerts(user_id: str):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id, alert_type, title, message, created_at
                FROM app.alerts
                WHERE user_id = %(user_id)s
                ORDER BY created_at DESC
                """,
                {"user_id": user_id},
            )
            return cursor.fetchall()


def get_latest_climate(city_name: str):
    city_candidates = _lookup_candidates(city_name)
    if not city_candidates:
        return None

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT observation_date, city_name, temperature_avg_c, rainfall_mm, soil_moisture_pct, wind_speed
                FROM analytics.climate_history
                WHERE city_name = ANY(%(city_candidates)s)
                ORDER BY observation_date DESC
                LIMIT 1
                """,
                {"city_candidates": city_candidates},
            )
            return cursor.fetchone()


def get_climate_series(city_name: str, limit: int = 12):
    city_candidates = _lookup_candidates(city_name)
    if not city_candidates:
        return []

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT observation_date, city_name, temperature_avg_c, rainfall_mm, soil_moisture_pct, wind_speed
                FROM analytics.climate_history
                WHERE city_name = ANY(%(city_candidates)s)
                ORDER BY observation_date DESC
                LIMIT %(limit)s
                """,
                {"city_candidates": city_candidates, "limit": limit},
            )
            return cursor.fetchall()


def get_market_projection(city_name: str | None = None):
    years = _forecast_years(limit=2)
    if not years:
        return []

    where_clauses = ["year = ANY(%(years)s)"]
    params: dict[str, object] = {"years": years}
    city_candidates = _lookup_candidates(city_name) if city_name else []
    if city_candidates:
        where_clauses.append("city_name = ANY(%(city_candidates)s)")
        params["city_candidates"] = city_candidates

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT year, SUM(predicted_production_ton) AS total_production
                FROM analytics.model_predictions
                WHERE {' AND '.join(where_clauses)}
                GROUP BY year
                ORDER BY year ASC
                """,
                params,
            )
            return cursor.fetchall()


def get_city_crop_options(city_name: str, limit: int = 8):
    city_candidates = _lookup_candidates(city_name)
    if not city_candidates:
        return []

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                WITH latest_year AS (
                    SELECT MAX(year) AS year
                    FROM analytics.production_history
                    WHERE city_name = ANY(%(city_candidates)s)
                )
                SELECT p.product_name,
                       latest_year.year AS latest_year,
                       SUM(p.production_ton) AS production_ton,
                       AVG(NULLIF(p.yield_kg_decare, 0)) AS yield_kg_decare
                FROM analytics.production_history AS p
                CROSS JOIN latest_year
                WHERE p.city_name = ANY(%(city_candidates)s)
                  AND p.year = latest_year.year
                GROUP BY p.product_name, latest_year.year
                ORDER BY production_ton DESC NULLS LAST, yield_kg_decare DESC NULLS LAST, p.product_name ASC
                LIMIT %(limit)s
                """,
                {"city_candidates": city_candidates, "limit": limit},
            )
            return cursor.fetchall()


def get_city_production_overview(city_name: str):
    city_candidates = _lookup_candidates(city_name)
    if not city_candidates:
        return None

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                WITH latest_year AS (
                    SELECT MAX(year) AS year
                    FROM analytics.production_history
                    WHERE city_name = ANY(%(city_candidates)s)
                )
                SELECT latest_year.year AS latest_year,
                       SUM(p.production_ton) AS total_production_ton,
                       AVG(NULLIF(p.yield_kg_decare, 0)) AS average_yield_kg_decare,
                       SUM(p.area_decare) AS total_area_decare
                FROM analytics.production_history AS p
                CROSS JOIN latest_year
                WHERE p.city_name = ANY(%(city_candidates)s)
                  AND p.year = latest_year.year
                GROUP BY latest_year.year
                """,
                {"city_candidates": city_candidates},
            )
            return cursor.fetchone()


def get_city_production_trend(city_name: str, limit: int = 6):
    city_candidates = _lookup_candidates(city_name)
    if not city_candidates:
        return []

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT year,
                       SUM(production_ton) AS total_production_ton,
                       AVG(NULLIF(yield_kg_decare, 0)) AS average_yield_kg_decare
                FROM analytics.production_history
                WHERE city_name = ANY(%(city_candidates)s)
                GROUP BY year
                ORDER BY year DESC
                LIMIT %(limit)s
                """,
                {"city_candidates": city_candidates, "limit": limit},
            )
            rows = cursor.fetchall()
    return list(reversed(rows))


def get_ai_recommendations(city_name: str | None = None, forecast_year: int | None = None, limit: int = 3):
    years = [forecast_year] if forecast_year is not None else _forecast_years(limit=1)
    if not years:
        return []

    where_clauses = ["year = %(forecast_year)s"]
    params: dict[str, object] = {"forecast_year": years[0], "limit": limit}
    city_candidates = _lookup_candidates(city_name) if city_name else []
    if city_candidates:
        where_clauses.append("city_name = ANY(%(city_candidates)s)")
        params["city_candidates"] = city_candidates

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT product_name,
                       %(forecast_year)s AS forecast_year,
                       SUM(predicted_production_ton) AS predicted_production_ton
                FROM analytics.model_predictions
                WHERE {' AND '.join(where_clauses)}
                GROUP BY product_name
                ORDER BY predicted_production_ton DESC NULLS LAST, product_name ASC
                LIMIT %(limit)s
                """,
                params,
            )
            return cursor.fetchall()


def get_crop_projection_series(
    city_name: str | None,
    product_name: str,
    history_limit: int = 5,
    forecast_limit: int = 3,
):
    if not product_name:
        return []

    history_where = ["product_name = %(product_name)s"]
    history_params: dict[str, object] = {"product_name": product_name, "history_limit": history_limit}
    city_candidates = _lookup_candidates(city_name) if city_name else []
    if city_candidates:
        history_where.append("city_name = ANY(%(city_candidates)s)")
        history_params["city_candidates"] = city_candidates

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT year, SUM(production_ton) AS historical_production_ton
                FROM analytics.production_history
                WHERE {' AND '.join(history_where)}
                GROUP BY year
                ORDER BY year DESC
                LIMIT %(history_limit)s
                """,
                history_params,
            )
            history_rows = list(reversed(cursor.fetchall()))

            forecast_years = _forecast_years(limit=forecast_limit)
            if not forecast_years:
                forecast_rows = []
            else:
                forecast_where = [
                    "product_name = %(product_name)s",
                    "year = ANY(%(forecast_years)s)",
                ]
                forecast_params: dict[str, object] = {
                    "product_name": product_name,
                    "forecast_years": forecast_years,
                }
                if city_candidates:
                    forecast_where.append("city_name = ANY(%(city_candidates)s)")
                    forecast_params["city_candidates"] = city_candidates

                cursor.execute(
                    f"""
                    SELECT year, SUM(predicted_production_ton) AS predicted_production_ton
                    FROM analytics.model_predictions
                    WHERE {' AND '.join(forecast_where)}
                    GROUP BY year
                    ORDER BY year ASC
                    """,
                    forecast_params,
                )
                forecast_rows = cursor.fetchall()

    combined: dict[int, dict[str, object]] = {}
    for row in history_rows:
        combined[row["year"]] = {
            "year": row["year"],
            "historical_production_ton": row["historical_production_ton"],
            "predicted_production_ton": None,
        }
    for row in forecast_rows:
        entry = combined.setdefault(
            row["year"],
            {
                "year": row["year"],
                "historical_production_ton": None,
                "predicted_production_ton": None,
            },
        )
        entry["predicted_production_ton"] = row["predicted_production_ton"]

    return [combined[year] for year in sorted(combined)]



def get_latest_forecast_year(reference_year: int | None = None):
    years = _forecast_years(limit=1, reference_year=reference_year)
    return years[0] if years else None



def get_candidate_forecasts(city_name: str | None, forecast_year: int | None = None, limit: int = 12):
    effective_year = forecast_year or get_latest_forecast_year()
    if effective_year is None:
        return []

    forecast_where = ["mp.year = %(forecast_year)s"]
    history_where = ["p.product_name = forecast.product_name"]
    params: dict[str, object] = {"forecast_year": effective_year, "limit": limit}
    city_candidates = _lookup_candidates(city_name) if city_name else []
    if city_candidates:
        forecast_where.append("mp.city_name = ANY(%(city_candidates)s)")
        history_where.append("p.city_name = ANY(%(city_candidates)s)")
        params["city_candidates"] = city_candidates

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                WITH forecast AS (
                    SELECT mp.product_name,
                           %(forecast_year)s AS forecast_year,
                           SUM(mp.predicted_production_ton) AS predicted_production_ton
                    FROM analytics.model_predictions AS mp
                    WHERE {' AND '.join(forecast_where)}
                    GROUP BY mp.product_name
                )
                SELECT forecast.product_name,
                       forecast.forecast_year,
                       forecast.predicted_production_ton,
                       latest.latest_year,
                       latest.latest_production_ton,
                       latest.latest_yield_kg_decare
                FROM forecast
                LEFT JOIN LATERAL (
                    SELECT p.year AS latest_year,
                           SUM(p.production_ton) AS latest_production_ton,
                           AVG(NULLIF(p.yield_kg_decare, 0)) AS latest_yield_kg_decare
                    FROM analytics.production_history AS p
                    WHERE {' AND '.join(history_where)}
                    GROUP BY p.year
                    ORDER BY p.year DESC
                    LIMIT 1
                ) AS latest ON TRUE
                ORDER BY forecast.predicted_production_ton DESC NULLS LAST, forecast.product_name ASC
                LIMIT %(limit)s
                """,
                params,
            )
            return cursor.fetchall()



def get_crop_history_rows(city_name: str | None, product_name: str, years: int = 5):
    if not product_name:
        return []

    where_clauses = ["product_name = %(product_name)s"]
    params: dict[str, object] = {"product_name": product_name, "years": years}
    city_candidates = _lookup_candidates(city_name) if city_name else []
    if city_candidates:
        where_clauses.append("city_name = ANY(%(city_candidates)s)")
        params["city_candidates"] = city_candidates

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT year,
                       SUM(production_ton) AS production_ton,
                       AVG(NULLIF(yield_kg_decare, 0)) AS yield_kg_decare
                FROM analytics.production_history
                WHERE {' AND '.join(where_clauses)}
                GROUP BY year
                ORDER BY year DESC
                LIMIT %(years)s
                """,
                params,
            )
            rows = cursor.fetchall()
    return list(reversed(rows))



def get_consumption_projection_map(product_names: list[str], forecast_year: int | None = None):
    cleaned = [item for item in dict.fromkeys(product_names) if item]
    if not cleaned:
        return {}

    target_year = forecast_year or get_latest_forecast_year()
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                WITH aggregated AS (
                    SELECT product_name,
                           year,
                           AVG(value) AS consumption_value
                    FROM analytics.consumption_history
                    WHERE product_name = ANY(%(product_names)s)
                      AND metric_name ILIKE 'T%%ketim%%'
                    GROUP BY product_name, year
                )
                SELECT DISTINCT ON (product_name)
                       product_name,
                       year,
                       consumption_value
                FROM aggregated
                ORDER BY product_name,
                         CASE WHEN year = %(target_year)s THEN 0 ELSE 1 END,
                         year DESC
                """,
                {"product_names": cleaned, "target_year": target_year},
            )
            return {row["product_name"]: row for row in cursor.fetchall()}



def get_walk_forward_summary(horizon: int | None = None):
    base_sql = """
        SELECT model_name,
               COALESCE(model_version, 'v1') AS model_version,
               horizon,
               MAX(forecast_year) AS latest_forecast_year,
               AVG(smape_pct) AS avg_smape_pct,
               AVG(wape_pct) AS avg_wape_pct,
               AVG(rmse) AS avg_rmse
        FROM analytics.walk_forward_metrics
        {where_clause}
        GROUP BY model_name, COALESCE(model_version, 'v1'), horizon
        ORDER BY latest_forecast_year DESC, avg_smape_pct ASC NULLS LAST
        LIMIT 1
    """

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            if horizon is not None:
                cursor.execute(
                    base_sql.format(where_clause='WHERE horizon = %(horizon)s'),
                    {"horizon": horizon},
                )
                row = cursor.fetchone()
                if row:
                    return row

            cursor.execute(base_sql.format(where_clause=''))
            return cursor.fetchone()



def update_plan_analysis_result(user_id: str, plan_id: str, score: float, status: str = 'Analiz Hazır'):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                UPDATE app.production_plans
                SET target_yield_percent = %(score)s,
                    status = %(status)s
                WHERE id = %(plan_id)s
                  AND user_id = %(user_id)s
                RETURNING id
                """,
                {"user_id": user_id, "plan_id": plan_id, "score": score, "status": status},
            )
            updated = cursor.fetchone()
        connection.commit()
    return bool(updated)



def _analysis_select_sql() -> str:
    return """
        SELECT a.id,
               a.plan_id,
               a.score,
               a.confidence_score,
               a.summary,
               a.climate_comment,
               a.market_comment,
               a.model_name,
               a.selected_crop_name,
               a.focus_crop_name,
               a.city,
               a.district,
               a.forecast_year,
               a.planned_area_decare,
               a.expected_yield_kg_decare,
               a.expected_production_ton,
               a.score_breakdown,
               a.analyzed_at,
               p.field_id,
               p.status AS plan_status,
               p.season_year,
               p.updated_at AS plan_updated_at,
               f.name AS field_name,
               f.city AS field_city,
               f.district AS field_district
        FROM app.ai_analyses AS a
        INNER JOIN app.production_plans AS p ON p.id = a.plan_id
        LEFT JOIN app.fields AS f ON f.id = p.field_id
    """



def get_latest_ai_analysis_for_plan(user_id: str, plan_id: str):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                {_analysis_select_sql()}
                WHERE p.user_id = %(user_id)s
                  AND a.plan_id = %(plan_id)s
                ORDER BY a.analyzed_at DESC
                LIMIT 1
                """,
                {"user_id": user_id, "plan_id": plan_id},
            )
            return cursor.fetchone()



def get_ai_analysis_for_user(user_id: str, analysis_id: str):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                {_analysis_select_sql()}
                WHERE p.user_id = %(user_id)s
                  AND a.id = %(analysis_id)s
                LIMIT 1
                """,
                {"user_id": user_id, "analysis_id": analysis_id},
            )
            return cursor.fetchone()



def get_ai_recommendations_for_analysis(analysis_id: str):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT id,
                       analysis_id,
                       rank_order,
                       crop_name,
                       expected_return_percent,
                       recommendation_score,
                       forecast_year,
                       predicted_production_ton,
                       expected_yield_kg_decare,
                       expected_production_ton,
                       reason
                FROM app.ai_recommendations
                WHERE analysis_id = %(analysis_id)s
                ORDER BY rank_order ASC, crop_name ASC
                """,
                {"analysis_id": analysis_id},
            )
            return cursor.fetchall()



def list_ai_analyses_for_user(user_id: str, limit: int = 20):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                {_analysis_select_sql()}
                WHERE p.user_id = %(user_id)s
                ORDER BY a.analyzed_at DESC
                LIMIT %(limit)s
                """,
                {"user_id": user_id, "limit": limit},
            )
            return cursor.fetchall()



def create_ai_analysis(plan_id: str, payload: dict[str, object], recommendations: list[dict[str, object]]):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO app.ai_analyses (
                    plan_id,
                    score,
                    confidence_score,
                    summary,
                    climate_comment,
                    market_comment,
                    model_name,
                    selected_crop_name,
                    focus_crop_name,
                    city,
                    district,
                    forecast_year,
                    planned_area_decare,
                    expected_yield_kg_decare,
                    expected_production_ton,
                    score_breakdown
                )
                VALUES (
                    %(plan_id)s,
                    %(score)s,
                    %(confidence_score)s,
                    %(summary)s,
                    %(climate_comment)s,
                    %(market_comment)s,
                    %(model_name)s,
                    %(selected_crop_name)s,
                    %(focus_crop_name)s,
                    %(city)s,
                    %(district)s,
                    %(forecast_year)s,
                    %(planned_area_decare)s,
                    %(expected_yield_kg_decare)s,
                    %(expected_production_ton)s,
                    %(score_breakdown)s::jsonb
                )
                RETURNING id
                """,
                {
                    **payload,
                    "plan_id": plan_id,
                    "score_breakdown": json.dumps(payload.get("score_breakdown") or []),
                },
            )
            analysis = cursor.fetchone()
            analysis_id = analysis["id"]

            for recommendation in recommendations:
                cursor.execute(
                    """
                    INSERT INTO app.ai_recommendations (
                        analysis_id,
                        rank_order,
                        crop_name,
                        expected_return_percent,
                        recommendation_score,
                        forecast_year,
                        predicted_production_ton,
                        expected_yield_kg_decare,
                        expected_production_ton,
                        reason
                    )
                    VALUES (
                        %(analysis_id)s,
                        %(rank_order)s,
                        %(crop_name)s,
                        %(expected_return_percent)s,
                        %(recommendation_score)s,
                        %(forecast_year)s,
                        %(predicted_production_ton)s,
                        %(expected_yield_kg_decare)s,
                        %(expected_production_ton)s,
                        %(reason)s
                    )
                    """,
                    {"analysis_id": analysis_id, **recommendation},
                )
        connection.commit()
    return analysis_id
