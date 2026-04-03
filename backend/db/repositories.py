from psycopg.rows import dict_row

from .connection import get_connection

SESSION_DURATION_SQL = {
    False: "now() + interval '1 day'",
    True: "now() + interval '30 days'",
}


def _user_select_sql() -> str:
    return """
        SELECT id, tc_identity_no, phone, email, password_hash, full_name,
               city, district, member_since, role, active_badge, is_active,
               created_at, updated_at
        FROM app.users
    """


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


def get_plan_history(user_id: str, limit: int | None = None):
    sql = """
        SELECT p.id, p.selected_crop_name, p.season_year, p.status,
               p.target_yield_percent, p.planned_area_decare,
               p.created_at, f.name AS field_name
        FROM app.production_plans AS p
        LEFT JOIN app.fields AS f ON f.id = p.field_id
        WHERE p.user_id = %(user_id)s
        ORDER BY p.season_year DESC, p.created_at DESC
    """
    params = {"user_id": user_id}
    if limit is not None:
        sql += " LIMIT %(limit)s"
        params["limit"] = limit

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(sql, params)
            return cursor.fetchall()


def get_latest_climate(city_name: str):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT observation_date, city_name, temperature_avg_c, rainfall_mm, soil_moisture_pct
                FROM analytics.climate_history
                WHERE city_name = %(city_name)s
                ORDER BY observation_date DESC
                LIMIT 1
                """,
                {"city_name": city_name},
            )
            return cursor.fetchone()


def get_market_projection(city_name: str | None = None):
    city_filter = "WHERE year IN (2025, 2026)"
    params: dict[str, object] = {}
    if city_name:
        city_filter += " AND city_name = %(city_name)s"
        params["city_name"] = city_name

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT year, SUM(predicted_production_ton) AS total_production
                FROM analytics.model_predictions
                {city_filter}
                GROUP BY year
                ORDER BY year ASC
                """,
                params,
            )
            return cursor.fetchall()


def get_climate_series(city_name: str, limit: int = 12):
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT observation_date, temperature_avg_c, rainfall_mm, soil_moisture_pct
                FROM analytics.climate_history
                WHERE city_name = %(city_name)s
                ORDER BY observation_date DESC
                LIMIT %(limit)s
                """,
                {"city_name": city_name, "limit": limit},
            )
            return cursor.fetchall()


def get_ai_recommendations(city_name: str | None = None, forecast_year: int = 2025, limit: int = 3):
    params: dict[str, object] = {"forecast_year": forecast_year, "limit": limit}
    where_clause = "WHERE year = %(forecast_year)s"
    if city_name:
        where_clause += " AND city_name = %(city_name)s"
        params["city_name"] = city_name

    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT product_name,
                       SUM(predicted_production_ton) AS predicted_production_ton
                FROM analytics.model_predictions
                {where_clause}
                GROUP BY product_name
                ORDER BY predicted_production_ton DESC
                LIMIT %(limit)s
                """,
                params,
            )
            return cursor.fetchall()
