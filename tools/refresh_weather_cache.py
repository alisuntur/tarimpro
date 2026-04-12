import argparse
import csv
import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

from psycopg.rows import dict_row


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from db import bootstrap_database  # noqa: E402
from db.connection import get_connection  # noqa: E402
from db.repositories import upsert_geo_location  # noqa: E402
from weather_service import (  # noqa: E402
    TURKEY_TIMEZONE,
    refresh_known_weather_cache,
    resolve_geo_location,
)


TR_LOWER_MAP = {
    "I": "ı",
    "İ": "i",
    "Ş": "ş",
    "Ğ": "ğ",
    "Ü": "ü",
    "Ö": "ö",
    "Ç": "ç",
}

TR_UPPER_MAP = {
    "ı": "I",
    "i": "İ",
    "ş": "Ş",
    "ğ": "Ğ",
    "ü": "Ü",
    "ö": "Ö",
    "ç": "Ç",
}


def _clean(value):
    if value is None:
        return None
    cleaned = " ".join(str(value).strip().split())
    return cleaned or None


def _first(row, *names):
    for name in names:
        if name in row and _clean(row[name]):
            return _clean(row[name])
    return None


def _as_float(value):
    if value in (None, ""):
        return None
    return float(str(value).replace(",", "."))


def _lower_tr(value: str) -> str:
    return "".join(TR_LOWER_MAP.get(char, char.lower()) for char in value)


def _upper_first_tr(value: str) -> str:
    if not value:
        return value
    return TR_UPPER_MAP.get(value[0], value[0].upper()) + value[1:]


def _title_tr(value):
    cleaned = _clean(value)
    if not cleaned:
        return None
    lowered = _lower_tr(cleaned)
    titled = []
    capitalize_next = True
    for char in lowered:
        if char.isalpha() and capitalize_next:
            titled.append(_upper_first_tr(char))
            capitalize_next = False
        else:
            titled.append(char)
            capitalize_next = not char.isalpha()
    return "".join(titled)


def _load_plate_city_map() -> dict[int, str]:
    with get_connection(row_factory=dict_row) as connection:
        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT plate_code, city_name
                FROM analytics.cities
                WHERE plate_code IS NOT NULL
                """
            )
            return {int(row["plate_code"]): row["city_name"] for row in cursor.fetchall()}


def seed_locations_from_csv(csv_path: Path) -> dict[str, int]:
    plate_city_map = _load_plate_city_map()
    seeded = 0
    resolved = 0
    skipped = 0
    with csv_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        for row in reader:
            city_name = _first(row, "city_name", "city", "il", "sehir", "province")
            if not city_name:
                plate_code = _first(row, "plate_code", "plate", "il_kod", "il_kodu", "plaka", "plaka_kodu")
                city_name = plate_city_map.get(int(plate_code)) if plate_code else None
            district_name = _title_tr(_first(row, "district_name", "district", "ilce", "county"))
            latitude = _as_float(_first(row, "latitude", "lat", "enlem"))
            longitude = _as_float(_first(row, "longitude", "lon", "lng", "boylam"))

            if not city_name:
                skipped += 1
                continue

            if latitude is not None and longitude is not None:
                upsert_geo_location(
                    {
                        "city_name": city_name,
                        "district_name": district_name,
                        "latitude": latitude,
                        "longitude": longitude,
                        "timezone": TURKEY_TIMEZONE,
                        "country_code": "TR",
                        "provider": "csv",
                        "source_name": csv_path.name,
                        "fetched_at": datetime.now(ZoneInfo(TURKEY_TIMEZONE)),
                    }
                )
                seeded += 1
                continue

            if resolve_geo_location(city_name, district_name):
                resolved += 1
            else:
                skipped += 1

    return {"seeded": seeded, "resolved": resolved, "skipped": skipped}


def main() -> None:
    parser = argparse.ArgumentParser(description="Open-Meteo gunluk hava cache tablosunu yeniler.")
    parser.add_argument("--batch-size", type=int, default=50, help="Open-Meteo forecast batch boyutu.")
    parser.add_argument("--force", action="store_true", help="Bugunun cache kaydi olsa bile yeniden cek.")
    parser.add_argument("--limit", type=int, default=None, help="Test icin aday lokasyon sayisini sinirla.")
    parser.add_argument(
        "--locations-csv",
        type=Path,
        help="Opsiyonel il/ilce koordinat CSV'si. Kolonlar: city_name,district_name,latitude,longitude.",
    )
    parser.add_argument("--skip-weather-refresh", action="store_true", help="Sadece koordinatlari seed et, hava cache'i cekme.")
    args = parser.parse_args()

    bootstrap_database()

    if args.locations_csv:
        seed_result = seed_locations_from_csv(args.locations_csv)
        print(f"location_seed: {seed_result}")

    if args.skip_weather_refresh:
        return

    result = refresh_known_weather_cache(batch_size=args.batch_size, force=args.force, limit=args.limit)
    print(f"weather_refresh: {result}")


if __name__ == "__main__":
    main()
