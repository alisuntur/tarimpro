import json
import re
from datetime import date

from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from .connection import get_connection
from .product_mapping import get_consumption_mapping_candidates

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


def _clean_text(value: object | None) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(str(value).strip().split())
    return cleaned or None


def _product_lookup_candidates(value: str | None) -> list[str]:
    if not value:
        return []

    raw = " ".join(str(value).strip().split())
    candidates: list[str] = []

    def add(item: str | None):
        normalized = " ".join(str(item or '').strip().split())
        if normalized and normalized not in candidates:
            candidates.append(normalized)

    def expand(seed: str | None):
        if not seed:
            return

        for mapped_candidate in get_consumption_mapping_candidates(seed):
            add(mapped_candidate)

        variants = [seed]
        stripped_parentheses = re.sub(r"\s*\(.*?\)", "", seed).strip()
        if stripped_parentheses:
            variants.append(stripped_parentheses)
        comma_base = stripped_parentheses.split(',', 1)[0].strip() if stripped_parentheses else ''
        if comma_base:
            variants.append(comma_base)

        for variant in variants:
            add(variant)
            no_seed_words = re.sub(r"\bTohumu\b", "", variant, flags=re.IGNORECASE).strip()
            add(no_seed_words)
            if no_seed_words.startswith("Di\u011fer "):
                add(no_seed_words[len("Di\u011fer "):])
            if no_seed_words.startswith("Diger "):
                add(no_seed_words[len("Diger "):])

    expand(raw)
    return candidates


def _production_area_sql(alias: str) -> str:
    return f"COALESCE({alias}.area_decare, {alias}.orchard_area_decare)"


def _production_yield_basis_sql(alias: str) -> str:
    tree_basis_sql = f"COALESCE(NULLIF({alias}.yield_kg_per_tree, 0), NULLIF({alias}.fruit_bearing_tree_count, 0)) IS NOT NULL"
    area_basis_sql = f"COALESCE(NULLIF({alias}.yield_kg_decare, 0), NULLIF({alias}.area_decare, 0), NULLIF({alias}.orchard_area_decare, 0)) IS NOT NULL"
    return (
        f"CASE "
        f"WHEN {tree_basis_sql} THEN 'tree' "
        f"WHEN {area_basis_sql} THEN 'decare' "
        f"ELSE NULL "
        f"END"
    )


def _production_output_sql(alias: str) -> str:
    return (
        f"COALESCE("
        f"{alias}.production_ton, "
        f"({alias}.yield_kg_per_tree * {alias}.fruit_bearing_tree_count / 1000.0)"
        f")"
    )


def _production_yield_sql(alias: str) -> str:
    output_sql = _production_output_sql(alias)
    area_sql = _production_area_sql(alias)
    tree_count_sql = f"NULLIF({alias}.fruit_bearing_tree_count, 0)"
    return (
        f"COALESCE("
        f"NULLIF({alias}.yield_kg_per_tree, 0), "
        f"NULLIF({alias}.yield_kg_decare, 0), "
        f"CASE "
        f"WHEN COALESCE(NULLIF({alias}.yield_kg_per_tree, 0), NULLIF({alias}.fruit_bearing_tree_count, 0)) IS NOT NULL "
        f"THEN ({output_sql} * 1000 / {tree_count_sql}) "
        f"ELSE ({output_sql} * 1000 / NULLIF({area_sql}, 0)) "
        f"END"
        f")"
    )


def _aggregate_production_yield_sql(alias: str) -> str:
    row_yield_sql = _production_yield_sql(alias)
    return f"AVG({row_yield_sql})"


def _resolve_consumption_product_name(product_name: str | None) -> str | None:
    candidates = _product_lookup_candidates(product_name)
    if not candidates:
        return None

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT DISTINCT product_name,
                       btrim(product_name) AS trimmed_product_name
                FROM analytics.consumption_history
                WHERE product_name = ANY(%(candidates)s)
                   OR btrim(product_name) = ANY(%(candidates)s)
                """,
                {"candidates": candidates},
            )
            rows = cursor.fetchall()
            available = {row["product_name"] for row in rows}
            available_by_trim = {row["trimmed_product_name"]: row["product_name"] for row in rows}

    for candidate in candidates:
        if candidate in available:
            return candidate
        trimmed_candidate = candidate.strip()
        if trimmed_candidate in available_by_trim:
            return available_by_trim[trimmed_candidate]
    return None


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


def create_user(payload: dict[str, object]):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO app.users (
                    tc_identity_no, phone, email, password_hash, full_name,
                    city, district, member_since, role, active_badge, is_active
                )
                VALUES (
                    %(tc_identity_no)s, %(phone)s, %(email)s, %(password_hash)s,
                    %(full_name)s, %(city)s, %(district)s, CURRENT_DATE,
                    'farmer', false, true
                )
                ON CONFLICT DO NOTHING
                RETURNING id, tc_identity_no, phone, email, password_hash, full_name,
                          city, district, member_since, role, active_badge, is_active,
                          created_at, updated_at
                """,
                payload,
            )
            user = cursor.fetchone()
        connection.commit()
    return user


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


def list_plan_analysis_overview(user_id: str, limit: int = 50):
    sql = """
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
               f.area_decare AS field_area_decare,
               latest.id AS analysis_id,
               latest.score AS analysis_score,
               latest.confidence_score AS analysis_confidence_score,
               latest.selected_crop_name AS analysis_selected_crop_name,
               latest.focus_crop_name AS analysis_focus_crop_name,
               latest.analyzed_at AS analyzed_at
        FROM app.production_plans AS p
        LEFT JOIN app.fields AS f ON f.id = p.field_id
        LEFT JOIN LATERAL (
            SELECT a.id,
                   a.score,
                   a.confidence_score,
                   a.selected_crop_name,
                   a.focus_crop_name,
                   a.analyzed_at
            FROM app.ai_analyses AS a
            WHERE a.plan_id = p.id
            ORDER BY a.analyzed_at DESC
            LIMIT 1
        ) AS latest ON true
        WHERE p.user_id = %(user_id)s
        ORDER BY p.created_at DESC
        LIMIT %(limit)s
    """
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, {"user_id": user_id, "limit": limit})
            return cursor.fetchall()


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
                WITH monthly_climate AS (
                    SELECT date_trunc('month', observation_date)::date AS observation_date,
                           city_name,
                           AVG(temperature_avg_c) AS temperature_avg_c,
                           SUM(rainfall_mm) AS rainfall_mm,
                           AVG(soil_moisture_pct) AS soil_moisture_pct,
                           AVG(wind_speed) AS wind_speed
                    FROM analytics.climate_history
                    WHERE city_name = ANY(%(city_candidates)s)
                    GROUP BY 1, 2
                )
                SELECT observation_date, city_name, temperature_avg_c, rainfall_mm, soil_moisture_pct, wind_speed
                FROM monthly_climate
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
                WITH monthly_climate AS (
                    SELECT date_trunc('month', observation_date)::date AS observation_date,
                           city_name,
                           AVG(temperature_avg_c) AS temperature_avg_c,
                           SUM(rainfall_mm) AS rainfall_mm,
                           AVG(soil_moisture_pct) AS soil_moisture_pct,
                           AVG(wind_speed) AS wind_speed
                    FROM analytics.climate_history
                    WHERE city_name = ANY(%(city_candidates)s)
                    GROUP BY 1, 2
                )
                SELECT observation_date, city_name, temperature_avg_c, rainfall_mm, soil_moisture_pct, wind_speed
                FROM monthly_climate
                ORDER BY observation_date DESC
                LIMIT %(limit)s
                """,
                {"city_candidates": city_candidates, "limit": limit},
            )
            return cursor.fetchall()


def replace_climate_history(rows: list[dict[str, object]]):
    if not rows:
        return 0

    city_name = _clean_text(rows[0].get("city_name"))
    if not city_name:
        return 0

    observation_dates = [row.get("observation_date") for row in rows if row.get("observation_date")]
    if not observation_dates:
        return 0

    start_date = min(observation_dates)
    end_date = max(observation_dates)

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                DELETE FROM analytics.climate_history
                WHERE city_name = %(city_name)s
                  AND observation_date BETWEEN %(start_date)s AND %(end_date)s
                """,
                {
                    "city_name": city_name,
                    "start_date": start_date,
                    "end_date": end_date,
                },
            )

            for row in rows:
                cursor.execute(
                    """
                    INSERT INTO analytics.climate_history (
                        observation_date,
                        city_name,
                        temperature_avg_c,
                        rainfall_mm,
                        wind_speed,
                        soil_moisture_pct,
                        source_file
                    )
                    VALUES (
                        %(observation_date)s,
                        %(city_name)s,
                        %(temperature_avg_c)s,
                        %(rainfall_mm)s,
                        %(wind_speed)s,
                        %(soil_moisture_pct)s,
                        %(source_file)s
                    )
                    """,
                    row,
                )
        connection.commit()

    return len(rows)


def get_geo_location(city_name: str | None, district_name: str | None = None):
    city_candidates = _lookup_candidates(city_name)
    if not city_candidates:
        return None

    district_candidates = _lookup_candidates(district_name)
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            if district_candidates:
                cursor.execute(
                    """
                    SELECT id, city_name, district_name, latitude, longitude, elevation_m,
                           timezone, country_code, provider, provider_location_id,
                           feature_code, admin1, admin2, source_name, fetched_at, updated_at
                    FROM analytics.geo_locations
                    WHERE city_name = ANY(%(city_candidates)s)
                      AND district_name = ANY(%(district_candidates)s)
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    {"city_candidates": city_candidates, "district_candidates": district_candidates},
                )
            else:
                cursor.execute(
                    """
                    SELECT id, city_name, district_name, latitude, longitude, elevation_m,
                           timezone, country_code, provider, provider_location_id,
                           feature_code, admin1, admin2, source_name, fetched_at, updated_at
                    FROM analytics.geo_locations
                    WHERE city_name = ANY(%(city_candidates)s)
                      AND district_name IS NULL
                    ORDER BY updated_at DESC
                    LIMIT 1
                    """,
                    {"city_candidates": city_candidates},
                )
            return cursor.fetchone()


def upsert_geo_location(payload: dict[str, object]):
    row = {
        "city_name": _clean_text(payload.get("city_name")),
        "district_name": _clean_text(payload.get("district_name")),
        "latitude": payload.get("latitude"),
        "longitude": payload.get("longitude"),
        "elevation_m": payload.get("elevation_m"),
        "timezone": _clean_text(payload.get("timezone")) or "Europe/Istanbul",
        "country_code": (_clean_text(payload.get("country_code")) or "TR")[:2],
        "provider": _clean_text(payload.get("provider")) or "open-meteo",
        "provider_location_id": payload.get("provider_location_id"),
        "feature_code": _clean_text(payload.get("feature_code")),
        "admin1": _clean_text(payload.get("admin1")),
        "admin2": _clean_text(payload.get("admin2")),
        "source_name": _clean_text(payload.get("source_name")) or "Open-Meteo Geocoding API",
        "fetched_at": payload.get("fetched_at"),
    }
    if not row["city_name"] or row["latitude"] is None or row["longitude"] is None:
        return None

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO analytics.geo_locations (
                    city_name, district_name, latitude, longitude, elevation_m,
                    timezone, country_code, provider, provider_location_id,
                    feature_code, admin1, admin2, source_name, fetched_at
                )
                VALUES (
                    %(city_name)s, %(district_name)s, %(latitude)s, %(longitude)s, %(elevation_m)s,
                    %(timezone)s, %(country_code)s, %(provider)s, %(provider_location_id)s,
                    %(feature_code)s, %(admin1)s, %(admin2)s, %(source_name)s, %(fetched_at)s
                )
                ON CONFLICT (city_name, district_name) DO UPDATE SET
                    latitude = EXCLUDED.latitude,
                    longitude = EXCLUDED.longitude,
                    elevation_m = EXCLUDED.elevation_m,
                    timezone = EXCLUDED.timezone,
                    country_code = EXCLUDED.country_code,
                    provider = EXCLUDED.provider,
                    provider_location_id = EXCLUDED.provider_location_id,
                    feature_code = EXCLUDED.feature_code,
                    admin1 = EXCLUDED.admin1,
                    admin2 = EXCLUDED.admin2,
                    source_name = EXCLUDED.source_name,
                    fetched_at = EXCLUDED.fetched_at,
                    updated_at = now()
                RETURNING id, city_name, district_name, latitude, longitude, elevation_m,
                          timezone, country_code, provider, provider_location_id,
                          feature_code, admin1, admin2, source_name, fetched_at, updated_at
                """,
                row,
            )
            location = cursor.fetchone()
        connection.commit()
    return location


def list_geo_locations(limit: int | None = None):
    sql = """
        SELECT id, city_name, district_name, latitude, longitude, elevation_m,
               timezone, country_code, provider, provider_location_id,
               feature_code, admin1, admin2, source_name, fetched_at, updated_at
        FROM analytics.geo_locations
        ORDER BY city_name ASC, district_name ASC NULLS FIRST
    """
    params: dict[str, object] = {}
    if limit:
        sql += " LIMIT %(limit)s"
        params["limit"] = limit

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()


def list_location_options():
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                WITH candidates AS (
                    SELECT city_name::varchar(100) AS city_name,
                           NULL::varchar(100) AS district_name,
                           NULL::numeric(9, 6) AS latitude,
                           NULL::numeric(9, 6) AS longitude
                    FROM analytics.cities
                    UNION ALL
                    SELECT city_name::varchar(100) AS city_name,
                           district_name::varchar(100) AS district_name,
                           latitude,
                           longitude
                    FROM analytics.geo_locations
                    UNION ALL
                    SELECT city::varchar(100) AS city_name,
                           district::varchar(100) AS district_name,
                           NULL::numeric(9, 6) AS latitude,
                           NULL::numeric(9, 6) AS longitude
                    FROM app.users
                    WHERE city IS NOT NULL
                    UNION ALL
                    SELECT city::varchar(100) AS city_name,
                           district::varchar(100) AS district_name,
                           latitude,
                           longitude
                    FROM app.fields
                    WHERE city IS NOT NULL
                )
                SELECT DISTINCT btrim(city_name) AS city_name,
                       NULLIF(btrim(district_name), '') AS district_name,
                       MAX(latitude) FILTER (WHERE latitude IS NOT NULL) AS latitude,
                       MAX(longitude) FILTER (WHERE longitude IS NOT NULL) AS longitude
                FROM candidates
                WHERE city_name IS NOT NULL
                  AND btrim(city_name) <> ''
                GROUP BY btrim(city_name), NULLIF(btrim(district_name), '')
                ORDER BY city_name ASC, district_name ASC NULLS FIRST
                """
            )
            return cursor.fetchall()


def list_weather_location_candidates(limit: int | None = None):
    sql = """
        WITH candidates AS (
            SELECT city_name::varchar(100) AS city_name,
                   NULL::varchar(100) AS district_name
            FROM analytics.cities
            UNION
            SELECT city::varchar(100) AS city_name,
                   district::varchar(100) AS district_name
            FROM app.users
            WHERE city IS NOT NULL
            UNION
            SELECT city::varchar(100) AS city_name,
                   district::varchar(100) AS district_name
            FROM app.fields
            WHERE city IS NOT NULL
            UNION
            SELECT city_name, district_name
            FROM analytics.geo_locations
        )
        SELECT DISTINCT btrim(city_name) AS city_name,
               NULLIF(btrim(district_name), '') AS district_name
        FROM candidates
        WHERE city_name IS NOT NULL
          AND btrim(city_name) <> ''
        ORDER BY city_name ASC, district_name ASC NULLS FIRST
    """
    params: dict[str, object] = {}
    if limit:
        sql += " LIMIT %(limit)s"
        params["limit"] = limit

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()


def get_weather_daily_cache(location_id: int, forecast_date: date):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT cache.id, cache.location_id, cache.forecast_date,
                       cache.temperature_c, cache.relative_humidity_pct,
                       cache.precipitation_mm, cache.wind_speed_kmh,
                       cache.soil_moisture_0_to_1cm, cache.weather_code,
                       cache.provider, cache.fetched_at, cache.raw_payload,
                       geo.city_name, geo.district_name, geo.latitude, geo.longitude
                FROM analytics.weather_daily_cache AS cache
                JOIN analytics.geo_locations AS geo ON geo.id = cache.location_id
                WHERE cache.location_id = %(location_id)s
                  AND cache.forecast_date = %(forecast_date)s
                LIMIT 1
                """,
                {"location_id": location_id, "forecast_date": forecast_date},
            )
            return cursor.fetchone()


def upsert_weather_daily_cache(payload: dict[str, object]):
    row = {
        "location_id": payload.get("location_id"),
        "forecast_date": payload.get("forecast_date"),
        "temperature_c": payload.get("temperature_c"),
        "relative_humidity_pct": payload.get("relative_humidity_pct"),
        "precipitation_mm": payload.get("precipitation_mm"),
        "wind_speed_kmh": payload.get("wind_speed_kmh"),
        "soil_moisture_0_to_1cm": payload.get("soil_moisture_0_to_1cm"),
        "weather_code": payload.get("weather_code"),
        "provider": _clean_text(payload.get("provider")) or "open-meteo",
        "raw_payload": Jsonb(payload.get("raw_payload")) if payload.get("raw_payload") is not None else None,
    }
    if not row["location_id"] or not row["forecast_date"]:
        return None

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO analytics.weather_daily_cache (
                    location_id, forecast_date, temperature_c, relative_humidity_pct,
                    precipitation_mm, wind_speed_kmh, soil_moisture_0_to_1cm,
                    weather_code, provider, raw_payload
                )
                VALUES (
                    %(location_id)s, %(forecast_date)s, %(temperature_c)s, %(relative_humidity_pct)s,
                    %(precipitation_mm)s, %(wind_speed_kmh)s, %(soil_moisture_0_to_1cm)s,
                    %(weather_code)s, %(provider)s, %(raw_payload)s
                )
                ON CONFLICT (location_id, forecast_date) DO UPDATE SET
                    temperature_c = EXCLUDED.temperature_c,
                    relative_humidity_pct = EXCLUDED.relative_humidity_pct,
                    precipitation_mm = EXCLUDED.precipitation_mm,
                    wind_speed_kmh = EXCLUDED.wind_speed_kmh,
                    soil_moisture_0_to_1cm = EXCLUDED.soil_moisture_0_to_1cm,
                    weather_code = EXCLUDED.weather_code,
                    provider = EXCLUDED.provider,
                    fetched_at = now(),
                    raw_payload = EXCLUDED.raw_payload
                RETURNING id, location_id, forecast_date, temperature_c, relative_humidity_pct,
                          precipitation_mm, wind_speed_kmh, soil_moisture_0_to_1cm,
                          weather_code, provider, fetched_at, raw_payload
                """,
                row,
            )
            cache = cursor.fetchone()
        connection.commit()
    return cache


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


def get_city_crop_options(city_name: str, limit: int | None = None):
    city_candidates = _lookup_candidates(city_name)
    if not city_candidates:
        return []

    production_output_sql = _production_output_sql('p')
    aggregate_yield_sql = _aggregate_production_yield_sql('p')
    yield_basis_sql = _production_yield_basis_sql('p')
    area_sql = _production_area_sql('p')
    sql = """
        WITH crop_latest_year AS (
            SELECT product_name,
                   MAX(year) AS latest_year
            FROM analytics.production_history
            WHERE city_name = ANY(%(city_candidates)s)
            GROUP BY product_name
        )
        SELECT latest.product_name,
               latest.latest_year,
               MIN(p.category_name) AS category_name,
               SUM({production_output_sql}) AS production_ton,
               {aggregate_yield_sql} AS yield_kg_decare,
               CASE
                   WHEN COUNT(*) FILTER (WHERE {yield_basis_sql} = 'tree') > 0 THEN 'tree'
                   WHEN COUNT(*) FILTER (WHERE {yield_basis_sql} = 'decare') > 0 THEN 'decare'
                   ELSE NULL
               END AS yield_basis
        FROM crop_latest_year AS latest
        JOIN analytics.production_history AS p
          ON p.product_name = latest.product_name
         AND p.year = latest.latest_year
         AND p.city_name = ANY(%(city_candidates)s)
        GROUP BY latest.product_name, latest.latest_year
        ORDER BY latest.latest_year DESC,
                 production_ton DESC NULLS LAST,
                 yield_kg_decare DESC NULLS LAST,
                 latest.product_name ASC
    """.format(
        production_output_sql=production_output_sql,
        aggregate_yield_sql=aggregate_yield_sql,
        yield_basis_sql=yield_basis_sql,
        area_sql=area_sql,
    )
    params: dict[str, object] = {"city_candidates": city_candidates}
    if limit is not None:
        sql += " LIMIT %(limit)s"
        params["limit"] = limit

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()


def get_city_production_overview(city_name: str):
    city_candidates = _lookup_candidates(city_name)
    if not city_candidates:
        return None

    production_output_sql = _production_output_sql('p')
    aggregate_yield_sql = _aggregate_production_yield_sql('p')
    area_sql = _production_area_sql('p')
    yield_basis_sql = _production_yield_basis_sql('p')
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                WITH latest_year AS (
                    SELECT MAX(year) AS year
                    FROM analytics.production_history
                    WHERE city_name = ANY(%(city_candidates)s)
                ), basis_counts AS (
                    SELECT
                        COUNT(*) FILTER (WHERE {yield_basis_sql} = 'tree') AS tree_rows,
                        COUNT(*) FILTER (WHERE {yield_basis_sql} = 'decare') AS area_rows
                    FROM analytics.production_history AS p
                    CROSS JOIN latest_year
                    WHERE p.city_name = ANY(%(city_candidates)s)
                      AND p.year = latest_year.year
                )
                SELECT latest_year.year AS latest_year,
                       SUM({production_output_sql}) AS total_production_ton,
                       {aggregate_yield_sql} AS average_yield_kg_decare,
                       SUM({area_sql}) AS total_area_decare,
                       CASE
                           WHEN basis_counts.tree_rows = 0 AND basis_counts.area_rows = 0 THEN NULL
                           WHEN basis_counts.tree_rows >= basis_counts.area_rows THEN 'tree'
                           ELSE 'decare'
                       END AS average_yield_basis
                FROM analytics.production_history AS p
                CROSS JOIN latest_year
                CROSS JOIN basis_counts
                WHERE p.city_name = ANY(%(city_candidates)s)
                  AND p.year = latest_year.year
                GROUP BY latest_year.year, basis_counts.tree_rows, basis_counts.area_rows
                """,
                {"city_candidates": city_candidates},
            )
            return cursor.fetchone()


def get_city_production_trend(city_name: str, limit: int | None = 6):
    city_candidates = _lookup_candidates(city_name)
    if not city_candidates:
        return []

    production_output_sql = _production_output_sql('p')
    aggregate_yield_sql = _aggregate_production_yield_sql('p')
    sql = f"""
        SELECT year,
               SUM({production_output_sql}) AS total_production_ton,
               {aggregate_yield_sql} AS average_yield_kg_decare
        FROM analytics.production_history AS p
        WHERE city_name = ANY(%(city_candidates)s)
        GROUP BY year
        ORDER BY year DESC
    """
    params: dict[str, object] = {"city_candidates": city_candidates}
    if limit is not None:
        sql += " LIMIT %(limit)s"
        params["limit"] = limit

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
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

    product_candidates = _product_lookup_candidates(product_name)
    if not product_candidates:
        return []

    production_output_sql = _production_output_sql('p')
    history_where = ["product_name = ANY(%(product_candidates)s)"]
    history_params: dict[str, object] = {"product_candidates": product_candidates, "history_limit": history_limit}
    city_candidates = _lookup_candidates(city_name) if city_name else []
    if city_candidates:
        history_where.append("city_name = ANY(%(city_candidates)s)")
        history_params["city_candidates"] = city_candidates

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT year, SUM({production_output_sql}) AS historical_production_ton
                FROM analytics.production_history AS p
                WHERE {' AND '.join(history_where)}
                GROUP BY year
                ORDER BY year DESC
                LIMIT %(history_limit)s
                """,
                history_params,
            )
            history_rows = list(reversed(cursor.fetchall()))

            reference_year = (history_rows[-1]["year"] + 1) if history_rows else date.today().year
            forecast_years = _forecast_years(limit=forecast_limit, reference_year=reference_year)
            if not forecast_years:
                forecast_rows = []
            else:
                forecast_where = [
                    "product_name = ANY(%(product_candidates)s)",
                    "year = ANY(%(forecast_years)s)",
                ]
                forecast_params: dict[str, object] = {
                    "product_candidates": product_candidates,
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
            production_output_sql = _production_output_sql('p')
            aggregate_yield_sql = _aggregate_production_yield_sql('p')
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
                           SUM({production_output_sql}) AS latest_production_ton,
                           {aggregate_yield_sql} AS latest_yield_kg_decare
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

    product_candidates = _product_lookup_candidates(product_name)
    if not product_candidates:
        return []

    production_output_sql = _production_output_sql('p')
    aggregate_yield_sql = _aggregate_production_yield_sql('p')
    yield_basis_sql = _production_yield_basis_sql('p')
    where_clauses = ["product_name = ANY(%(product_candidates)s)"]
    params: dict[str, object] = {"product_candidates": product_candidates, "years": years}
    city_candidates = _lookup_candidates(city_name) if city_name else []
    if city_candidates:
        where_clauses.append("city_name = ANY(%(city_candidates)s)")
        params["city_candidates"] = city_candidates

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT year,
                       SUM({production_output_sql}) AS production_ton,
                       {aggregate_yield_sql} AS yield_kg_decare,
                       CASE
                           WHEN COUNT(*) FILTER (WHERE {yield_basis_sql} = 'tree') > 0 THEN 'tree'
                           WHEN COUNT(*) FILTER (WHERE {yield_basis_sql} = 'decare') > 0 THEN 'decare'
                           ELSE NULL
                       END AS yield_basis
                FROM analytics.production_history AS p
                WHERE {' AND '.join(where_clauses)}
                GROUP BY year
                ORDER BY year DESC
                LIMIT %(years)s
                """,
                params,
            )
            rows = cursor.fetchall()
    return list(reversed(rows))



def get_product_yield_context(city_name: str | None, product_name: str, years: int = 5):
    if not product_name:
        return {}

    product_candidates = _product_lookup_candidates(product_name)
    if not product_candidates:
        return {}

    row_yield_sql = _production_yield_sql('p')
    yield_basis_sql = _production_yield_basis_sql('p')
    city_candidates = _lookup_candidates(city_name) if city_name else []
    params: dict[str, object] = {
        "product_candidates": product_candidates,
        "years": years,
        "city_candidates": city_candidates or [city_name or ''],
    }

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                WITH recent_years AS (
                    SELECT DISTINCT year
                    FROM analytics.production_history
                    WHERE product_name = ANY(%(product_candidates)s)
                    ORDER BY year DESC
                    LIMIT %(years)s
                ), city_year_yields AS (
                    SELECT city_name,
                           year,
                           AVG({row_yield_sql}) AS year_yield
                    FROM analytics.production_history AS p
                    WHERE product_name = ANY(%(product_candidates)s)
                      AND year IN (SELECT year FROM recent_years)
                    GROUP BY city_name, year
                    HAVING AVG({row_yield_sql}) IS NOT NULL
                ), city_yields AS (
                    SELECT city_name,
                           AVG(year_yield) AS avg_yield
                    FROM city_year_yields
                    GROUP BY city_name
                ), basis_summary AS (
                    SELECT CASE
                               WHEN COUNT(*) FILTER (WHERE {yield_basis_sql} = 'tree') > 0 THEN 'tree'
                               WHEN COUNT(*) FILTER (WHERE {yield_basis_sql} = 'decare') > 0 THEN 'decare'
                               ELSE NULL
                           END AS yield_basis
                    FROM analytics.production_history AS p
                    WHERE product_name = ANY(%(product_candidates)s)
                      AND year IN (SELECT year FROM recent_years)
                ), target AS (
                    SELECT AVG(avg_yield) AS city_avg_yield
                    FROM city_yields
                    WHERE city_name = ANY(%(city_candidates)s)
                )
                SELECT (SELECT COUNT(*) FROM recent_years) AS years_considered,
                       (SELECT city_avg_yield FROM target) AS city_avg_yield,
                       AVG(avg_yield) AS national_avg_yield,
                       MIN(avg_yield) AS min_yield,
                       MAX(avg_yield) AS max_yield,
                       COUNT(*) AS city_count,
                       SUM(CASE WHEN avg_yield <= (SELECT city_avg_yield FROM target) THEN 1 ELSE 0 END) AS cities_at_or_below,
                       (SELECT yield_basis FROM basis_summary) AS yield_basis
                FROM city_yields
                """,
                params,
            )
            row = cursor.fetchone() or {}

    city_avg = row.get("city_avg_yield")
    national_avg = row.get("national_avg_yield")
    city_count = int(row.get("city_count") or 0)
    cities_at_or_below = int(row.get("cities_at_or_below") or 0)

    relative_index_pct = None
    if city_avg is not None and national_avg not in (None, 0):
        relative_index_pct = float(city_avg) / float(national_avg) * 100

    percentile_score = None
    if city_avg is not None and city_count > 0:
        percentile_score = (cities_at_or_below / city_count) * 100

    return {
        "product_name": product_name,
        "years_considered": int(row.get("years_considered") or 0),
        "city_avg_yield": float(city_avg) if city_avg is not None else None,
        "national_avg_yield": float(national_avg) if national_avg is not None else None,
        "min_yield": float(row["min_yield"]) if row.get("min_yield") is not None else None,
        "max_yield": float(row["max_yield"]) if row.get("max_yield") is not None else None,
        "city_count": city_count,
        "percentile_score": percentile_score,
        "relative_index_pct": relative_index_pct,
        "yield_basis": row.get("yield_basis"),
        "yield_unit_label": "kg/meyve veren ağaç" if row.get("yield_basis") == "tree" else "kg/dönüm" if row.get("yield_basis") == "decare" else None,
    }



def get_product_supply_demand_projection(product_name: str, forecast_year: int | None = None):
    effective_year = forecast_year or get_latest_forecast_year()
    if not product_name or effective_year is None:
        return {}

    product_candidates = _product_lookup_candidates(product_name)
    if not product_candidates:
        return {}

    consumption_product_name = _resolve_consumption_product_name(product_name)

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT SUM(predicted_production_ton) AS predicted_supply_ton
                FROM analytics.model_predictions
                WHERE product_name = ANY(%(product_candidates)s)
                  AND year = %(forecast_year)s
                """,
                {"product_candidates": product_candidates, "forecast_year": effective_year},
            )
            supply_row = cursor.fetchone() or {}

            demand_row = {}
            if consumption_product_name:
                cursor.execute(
                    """
                    SELECT AVG(CASE WHEN year = %(forecast_year)s AND metric_name ILIKE 'T%%ketim%%' THEN value END) AS predicted_demand_ton,
                           AVG(CASE WHEN year BETWEEN %(trend_start_year)s AND %(trend_end_year)s AND metric_name ILIKE 'T%%ketim%%' THEN value END) AS recent_avg_demand_ton
                    FROM analytics.consumption_history
                    WHERE product_name = %(consumption_product_name)s
                    """,
                    {
                        "forecast_year": effective_year,
                        "trend_start_year": effective_year - 3,
                        "trend_end_year": effective_year - 1,
                        "consumption_product_name": consumption_product_name,
                    },
                )
                demand_row = cursor.fetchone() or {}

    predicted_supply_ton = supply_row.get("predicted_supply_ton")
    predicted_demand_ton = demand_row.get("predicted_demand_ton")
    recent_avg_demand_ton = demand_row.get("recent_avg_demand_ton")
    demand_growth_pct = None
    if predicted_demand_ton not in (None, 0) and recent_avg_demand_ton not in (None, 0):
        demand_growth_pct = ((float(predicted_demand_ton) - float(recent_avg_demand_ton)) / float(recent_avg_demand_ton)) * 100

    return {
        "product_name": product_name,
        "consumption_product_name": consumption_product_name,
        "forecast_year": effective_year,
        "predicted_supply_ton": float(predicted_supply_ton) if predicted_supply_ton is not None else None,
        "predicted_demand_ton": float(predicted_demand_ton) if predicted_demand_ton is not None else None,
        "recent_avg_demand_ton": float(recent_avg_demand_ton) if recent_avg_demand_ton is not None else None,
        "demand_growth_pct": demand_growth_pct,
    }



def get_product_supply_demand_series(product_name: str, history_limit: int = 5, forecast_limit: int = 3):
    if not product_name:
        return []

    product_candidates = _product_lookup_candidates(product_name)
    if not product_candidates:
        return []

    consumption_product_name = _resolve_consumption_product_name(product_name)
    production_output_sql = _production_output_sql('p')

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT year,
                       SUM({production_output_sql}) AS historical_production_ton
                FROM analytics.production_history AS p
                WHERE product_name = ANY(%(product_candidates)s)
                GROUP BY year
                ORDER BY year DESC
                LIMIT %(history_limit)s
                """,
                {"product_candidates": product_candidates, "history_limit": history_limit},
            )
            history_rows = list(reversed(cursor.fetchall()))

            reference_year = (history_rows[-1]["year"] + 1) if history_rows else date.today().year
            forecast_years = _forecast_years(limit=forecast_limit, reference_year=reference_year)
            forecast_rows = []
            if forecast_years:
                cursor.execute(
                    f"""
                    SELECT year,
                           SUM(predicted_production_ton) AS predicted_supply_ton
                    FROM analytics.model_predictions
                    WHERE product_name = ANY(%(product_candidates)s)
                      AND year = ANY(%(forecast_years)s)
                    GROUP BY year
                    ORDER BY year ASC
                    """,
                    {"product_candidates": product_candidates, "forecast_years": forecast_years},
                )
                forecast_rows = cursor.fetchall()

            all_years = sorted({row["year"] for row in history_rows} | {row["year"] for row in forecast_rows})
            demand_rows = []
            if consumption_product_name and all_years:
                cursor.execute(
                    """
                    SELECT year,
                           AVG(value) AS demand_ton
                    FROM analytics.consumption_history
                    WHERE product_name = %(consumption_product_name)s
                      AND year = ANY(%(years)s)
                      AND metric_name ILIKE 'T%%ketim%%'
                    GROUP BY year
                    ORDER BY year ASC
                    """,
                    {"consumption_product_name": consumption_product_name, "years": all_years},
                )
                demand_rows = cursor.fetchall()

    combined: dict[int, dict[str, object]] = {}
    for row in history_rows:
        combined[row["year"]] = {
            "year": row["year"],
            "historical_production_ton": row.get("historical_production_ton"),
            "predicted_supply_ton": None,
            "predicted_demand_ton": None,
        }
    for row in forecast_rows:
        entry = combined.setdefault(
            row["year"],
            {
                "year": row["year"],
                "historical_production_ton": None,
                "predicted_supply_ton": None,
                "predicted_demand_ton": None,
            },
        )
        entry["predicted_supply_ton"] = row.get("predicted_supply_ton")
    for row in demand_rows:
        entry = combined.setdefault(
            row["year"],
            {
                "year": row["year"],
                "historical_production_ton": None,
                "predicted_supply_ton": None,
                "predicted_demand_ton": None,
            },
        )
        entry["predicted_demand_ton"] = row.get("demand_ton")

    return [combined[year] for year in sorted(combined)]



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



def get_walk_forward_calibration(city_name: str | None = None, product_name: str | None = None, horizon: int | None = None):
    where_clauses = [
        "predicted_production IS NOT NULL",
        "actual_production IS NOT NULL",
        "predicted_production > 0",
        "actual_production > 0",
    ]
    params: dict[str, object] = {}

    city_candidates = _lookup_candidates(city_name) if city_name else []
    if city_candidates:
        where_clauses.append("city_name = ANY(%(city_candidates)s)")
        params["city_candidates"] = city_candidates

    product_candidates = _lookup_candidates(product_name) if product_name else []
    if product_candidates:
        where_clauses.append("product_name = ANY(%(product_candidates)s)")
        params["product_candidates"] = product_candidates

    if horizon is not None:
        where_clauses.append("horizon = %(horizon)s")
        params["horizon"] = horizon

    success_case = """
        CASE
            WHEN actual_production BETWEEN predicted_production * EXP(COALESCE(delta_log_guard_lo, 0)::float8)
                                     AND predicted_production * EXP(COALESCE(delta_log_guard_hi, 0)::float8)
            THEN 1 ELSE 0
        END
    """

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT COUNT(*) AS sample_size,
                       COALESCE(SUM({success_case}), 0) AS success_count,
                       AVG(({success_case})::float8) AS success_rate,
                       AVG(ABS(actual_production - predicted_production) / NULLIF(actual_production, 0) * 100) AS avg_abs_error_pct,
                       AVG((EXP(COALESCE(delta_log_guard_hi, 0)::float8) - EXP(COALESCE(delta_log_guard_lo, 0)::float8)) * 100) AS avg_interval_width_pct
                FROM analytics.walk_forward_predictions
                WHERE {' AND '.join(where_clauses)}
                """,
                params,
            )
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
