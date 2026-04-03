from pathlib import Path

from psycopg.rows import dict_row

from security import hash_password

from .config import SCHEMA_FILE
from .connection import get_connection


DEMO_USER = {
    "id": "11111111-1111-1111-1111-111111111111",
    "tc_identity_no": "12345678901",
    "phone": "05551234567",
    "email": "ahmet.yilmaz@tarim.test",
    "password_hash": hash_password("demo123"),
    "full_name": "Ahmet Yilmaz",
    "city": "Manisa",
    "district": "Akhisar",
}

DEMO_FIELDS = [
    {
        "id": "22222222-2222-2222-2222-222222222221",
        "name": "Kuzey Parseli",
        "city": "Manisa",
        "district": "Akhisar",
        "region_code": "ege",
        "area_decare": 150,
        "soil_type": "Tinli",
        "notes": "Hububat ekimi icin kullanilan ana parsel.",
    },
    {
        "id": "22222222-2222-2222-2222-222222222222",
        "name": "Guney Mevkii",
        "city": "Manisa",
        "district": "Akhisar",
        "region_code": "ege",
        "area_decare": 85,
        "soil_type": "Killi-Tinli",
        "notes": "Rotasyon icin ayrilan yardimci tarla.",
    },
]

DEMO_PLANS = [
    {
        "id": "33333333-3333-3333-3333-333333333331",
        "field_id": DEMO_FIELDS[0]["id"],
        "selected_crop_name": "Bugday",
        "region_code": "ege",
        "season_year": 2024,
        "status": "Hasat Bekliyor",
        "target_yield_percent": 95,
        "planned_area_decare": 150,
    },
    {
        "id": "33333333-3333-3333-3333-333333333332",
        "field_id": DEMO_FIELDS[1]["id"],
        "selected_crop_name": "Aycicegi",
        "region_code": "ege",
        "season_year": 2023,
        "status": "Tamamlandi",
        "target_yield_percent": 88,
        "planned_area_decare": 85,
    },
]

DEMO_ALERTS = [
    {
        "id": "44444444-4444-4444-4444-444444444441",
        "field_id": DEMO_FIELDS[0]["id"],
        "plan_id": DEMO_PLANS[0]["id"],
        "alert_type": "warning",
        "title": "Kuraklik Riski",
        "message": "Bolgenizde onumuzdeki hafta %20 kuraklik riski bekleniyor.",
    },
    {
        "id": "44444444-4444-4444-4444-444444444442",
        "field_id": DEMO_FIELDS[0]["id"],
        "plan_id": DEMO_PLANS[0]["id"],
        "alert_type": "danger",
        "title": "Arz Uyarisi",
        "message": "Bugday ekiminde bolgesel doygunluga ulasildi.",
    },
]


def _run_schema(schema_file: Path) -> None:
    schema_sql = schema_file.read_text(encoding="utf-8")
    with get_connection(autocommit=True) as connection:
        with connection.cursor() as cursor:
            cursor.execute(schema_sql)


def _seed_user_data() -> None:
    with get_connection() as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                INSERT INTO app.users (
                    id, tc_identity_no, phone, email, password_hash, full_name,
                    city, district, member_since, role, active_badge
                )
                VALUES (
                    %(id)s, %(tc_identity_no)s, %(phone)s, %(email)s, %(password_hash)s,
                    %(full_name)s, %(city)s, %(district)s, DATE '2021-01-01', 'farmer', true
                )
                ON CONFLICT (id) DO UPDATE SET
                    tc_identity_no = EXCLUDED.tc_identity_no,
                    phone = EXCLUDED.phone,
                    email = EXCLUDED.email,
                    password_hash = EXCLUDED.password_hash,
                    full_name = EXCLUDED.full_name,
                    city = EXCLUDED.city,
                    district = EXCLUDED.district,
                    updated_at = now();
                """,
                DEMO_USER,
            )

            for field in DEMO_FIELDS:
                cursor.execute(
                    """
                    INSERT INTO app.fields (
                        id, user_id, name, city, district, region_code, area_decare, soil_type, notes
                    )
                    VALUES (
                        %(id)s, %(user_id)s, %(name)s, %(city)s, %(district)s, %(region_code)s,
                        %(area_decare)s, %(soil_type)s, %(notes)s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        city = EXCLUDED.city,
                        district = EXCLUDED.district,
                        region_code = EXCLUDED.region_code,
                        area_decare = EXCLUDED.area_decare,
                        soil_type = EXCLUDED.soil_type,
                        notes = EXCLUDED.notes,
                        updated_at = now();
                    """,
                    {**field, "user_id": DEMO_USER["id"]},
                )

            for plan in DEMO_PLANS:
                cursor.execute(
                    """
                    INSERT INTO app.production_plans (
                        id, user_id, field_id, selected_crop_name, region_code,
                        season_year, status, target_yield_percent, planned_area_decare
                    )
                    VALUES (
                        %(id)s, %(user_id)s, %(field_id)s, %(selected_crop_name)s,
                        %(region_code)s, %(season_year)s, %(status)s,
                        %(target_yield_percent)s, %(planned_area_decare)s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        selected_crop_name = EXCLUDED.selected_crop_name,
                        region_code = EXCLUDED.region_code,
                        season_year = EXCLUDED.season_year,
                        status = EXCLUDED.status,
                        target_yield_percent = EXCLUDED.target_yield_percent,
                        planned_area_decare = EXCLUDED.planned_area_decare,
                        updated_at = now();
                    """,
                    {**plan, "user_id": DEMO_USER["id"]},
                )

            for alert in DEMO_ALERTS:
                cursor.execute(
                    """
                    INSERT INTO app.alerts (
                        id, user_id, field_id, plan_id, alert_type, title, message
                    )
                    VALUES (
                        %(id)s, %(user_id)s, %(field_id)s, %(plan_id)s,
                        %(alert_type)s, %(title)s, %(message)s
                    )
                    ON CONFLICT (id) DO UPDATE SET
                        alert_type = EXCLUDED.alert_type,
                        title = EXCLUDED.title,
                        message = EXCLUDED.message;
                    """,
                    {**alert, "user_id": DEMO_USER["id"]},
                )
        connection.commit()


def _analytics_loaded() -> bool:
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute("SELECT COUNT(*) AS count FROM analytics.production_history")
            return cursor.fetchone()["count"] > 0


def bootstrap_database() -> None:
    _run_schema(SCHEMA_FILE)
    _seed_user_data()
    if not _analytics_loaded():
        print("Uyari: analytics tablolari bos. Gerekirse tools/import_veri.py calistirin.")
