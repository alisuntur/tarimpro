from __future__ import annotations

import json
import math
import re
import unicodedata
from collections import Counter
from datetime import date, datetime, timedelta
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from db.repositories import (
    get_climate_series,
    get_geo_location,
    get_latest_climate,
    get_weather_daily_cache,
    list_weather_location_candidates,
    replace_climate_history,
    upsert_geo_location,
    upsert_weather_daily_cache,
)


OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"
OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
OPEN_METEO_PROVIDER = "open-meteo"
OPEN_METEO_ARCHIVE_PROVIDER = "open-meteo-archive"
TURKEY_TIMEZONE = "Europe/Istanbul"
REQUEST_TIMEOUT_SECONDS = 15
BATCH_SIZE = 50

WEATHER_CODE_LABELS = {
    0: "Açık",
    1: "Az Bulutlu",
    2: "Parçalı Bulutlu",
    3: "Bulutlu",
    45: "Sisli",
    48: "Kırağılı Sis",
    51: "Hafif Çisenti",
    53: "Çisenti",
    55: "Yoğun Çisenti",
    56: "Dondurucu Çisenti",
    57: "Yoğun Dondurucu Çisenti",
    61: "Hafif Yağmurlu",
    63: "Yağmurlu",
    65: "Kuvvetli Yağmurlu",
    66: "Dondurucu Yağmur",
    67: "Kuvvetli Dondurucu Yağmur",
    71: "Hafif Karlı",
    73: "Karlı",
    75: "Yoğun Karlı",
    77: "Kar Taneli",
    80: "Hafif Sağanak",
    81: "Sağanak",
    82: "Kuvvetli Sağanak",
    85: "Hafif Kar Sağanağı",
    86: "Kuvvetli Kar Sağanağı",
    95: "Gök Gürültülü",
    96: "Dolu Riski",
    99: "Kuvvetli Dolu Riski",
}

TURKISH_ASCII_TRANSLATION = str.maketrans(
    {
        "ç": "c",
        "Ç": "C",
        "ğ": "g",
        "Ğ": "G",
        "ı": "i",
        "İ": "I",
        "ö": "o",
        "Ö": "O",
        "ş": "s",
        "Ş": "S",
        "ü": "u",
        "Ü": "U",
    }
)

TURKEY_CITY_NAMES = (
    "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya", "Artvin",
    "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu", "Burdur", "Bursa", "Çanakkale",
    "Çankırı", "Çorum", "Denizli", "Diyarbakır", "Edirne", "Elazığ", "Erzincan", "Erzurum",
    "Eskişehir", "Gaziantep", "Giresun", "Gümüşhane", "Hakkari", "Hatay", "Isparta", "Mersin",
    "İstanbul", "İzmir", "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir",
    "Kocaeli", "Konya", "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla",
    "Muş", "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop",
    "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak", "Van", "Yozgat",
    "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale", "Batman", "Şırnak", "Bartın",
    "Ardahan", "Iğdır", "Yalova", "Karabük", "Kilis", "Osmaniye", "Düzce",
)


def _clean_text(value: Any) -> str | None:
    if value is None:
        return None
    cleaned = " ".join(str(value).strip().split())
    return cleaned or None


def _normalize_lookup(value: Any) -> str:
    cleaned = _clean_text(value) or ""
    cleaned = cleaned.translate(TURKISH_ASCII_TRANSLATION).casefold()
    cleaned = unicodedata.normalize("NFKD", cleaned)
    cleaned = "".join(char for char in cleaned if not unicodedata.combining(char))
    return " ".join(cleaned.replace("-", " ").split())


TURKEY_CITY_LOOKUP = {_normalize_lookup(name): name for name in TURKEY_CITY_NAMES}


def _canonical_city_name(city_name: str | None) -> str | None:
    city = _clean_text(city_name)
    if not city:
        return None
    return TURKEY_CITY_LOOKUP.get(_normalize_lookup(city), city)


def _location_variants(value: str | None) -> list[str]:
    cleaned = _clean_text(value)
    if not cleaned:
        return []

    variants: list[str] = []

    def add(candidate: str | None) -> None:
        item = _clean_text(candidate)
        if item and item not in variants:
            variants.append(item)

    add(cleaned)

    for inner in re.findall(r"\((.*?)\)", cleaned):
        add(inner)

    stripped = re.sub(r"\s*\([^)]*\)", "", cleaned).strip()
    add(stripped)

    for separator in (",", "/", "-"):
        if separator in stripped:
            add(stripped.split(separator, 1)[0].strip())

    return variants


def _same_location_name(left: str | None, right: str | None) -> bool:
    return _normalize_lookup(left) == _normalize_lookup(right)


def _shift_month_start(month_start: date, months: int) -> date:
    year = month_start.year + ((month_start.month - 1 + months) // 12)
    month = ((month_start.month - 1 + months) % 12) + 1
    return date(year, month, 1)


def _estimate_soil_moisture_pct(temperature_c: float | None, rainfall_mm: float | None) -> float | None:
    if temperature_c is None and rainfall_mm is None:
        return None

    temp = float(temperature_c or 0)
    rainfall = float(rainfall_mm or 0)
    estimate = 45 + min(rainfall, 140) * 0.45 - max(temp - 18, 0) * 1.6
    return round(max(5.0, min(95.0, estimate)), 1)


def _aggregate_monthly_climate(daily_payload: dict[str, Any], city_name: str) -> list[dict[str, Any]]:
    daily = daily_payload.get("daily") or {}
    dates = daily.get("time") or []
    temperatures = daily.get("temperature_2m_mean") or []
    rainfall = daily.get("precipitation_sum") or []
    wind_speed = daily.get("wind_speed_10m_max") or []
    weather_codes = daily.get("weather_code") or []

    buckets: dict[date, dict[str, list[float] | list[int]]] = {}
    for index, date_text in enumerate(dates):
        try:
            observation_date = datetime.fromisoformat(date_text).date()
        except (TypeError, ValueError):
            continue

        month_start = observation_date.replace(day=1)
        bucket = buckets.setdefault(month_start, {"temperature": [], "rainfall": [], "wind": [], "codes": []})

        temperature = temperatures[index] if index < len(temperatures) else None
        precipitation = rainfall[index] if index < len(rainfall) else None
        wind = wind_speed[index] if index < len(wind_speed) else None
        weather_code = weather_codes[index] if index < len(weather_codes) else None

        if temperature is not None:
            bucket["temperature"].append(float(temperature))
        if precipitation is not None:
            bucket["rainfall"].append(float(precipitation))
        if wind is not None:
            bucket["wind"].append(float(wind))
        if weather_code is not None:
            bucket["codes"].append(int(weather_code))

    monthly_rows: list[dict[str, Any]] = []
    for month_start in sorted(buckets):
        bucket = buckets[month_start]
        temperatures_list = bucket["temperature"]
        rainfall_list = bucket["rainfall"]
        wind_list = bucket["wind"]
        codes_list = bucket["codes"]

        avg_temp = round(sum(temperatures_list) / len(temperatures_list), 1) if temperatures_list else None
        total_rainfall = round(sum(rainfall_list), 1) if rainfall_list else None
        avg_wind = round(sum(wind_list) / len(wind_list), 1) if wind_list else None
        soil_moisture = _estimate_soil_moisture_pct(avg_temp, total_rainfall)
        code = Counter(codes_list).most_common(1)[0][0] if codes_list else None

        monthly_rows.append(
            {
                "observation_date": month_start,
                "city_name": city_name,
                "temperature_avg_c": avg_temp,
                "rainfall_mm": total_rainfall,
                "wind_speed": avg_wind,
                "soil_moisture_pct": soil_moisture,
                "source_file": "Open-Meteo Archive API",
                "weather_code": code,
            }
        )

    return monthly_rows


def _fetch_climate_archive(latitude: float, longitude: float, start_date: date, end_date: date) -> dict[str, Any]:
    payload = _fetch_json(
        OPEN_METEO_ARCHIVE_URL,
        {
            "latitude": latitude,
            "longitude": longitude,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "daily": "temperature_2m_mean,precipitation_sum,wind_speed_10m_max,weather_code",
            "timezone": TURKEY_TIMEZONE,
            "temperature_unit": "celsius",
            "wind_speed_unit": "kmh",
            "precipitation_unit": "mm",
        },
    )
    if not isinstance(payload, dict):
        raise ValueError("Open-Meteo archive response was not an object.")
    return payload


def _today() -> date:
    return datetime.now(ZoneInfo(TURKEY_TIMEZONE)).date()


def _safe_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        numeric = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(numeric) or math.isinf(numeric):
        return None
    return numeric


def _safe_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _fetch_json(url: str, params: dict[str, Any]) -> dict[str, Any] | list[dict[str, Any]]:
    full_url = f"{url}?{urlencode(params)}"
    request = Request(
        full_url,
        headers={
            "Accept": "application/json",
            "User-Agent": "TarimPro/1.0 weather-cache",
        },
    )
    with urlopen(request, timeout=REQUEST_TIMEOUT_SECONDS) as response:
        return json.loads(response.read().decode("utf-8"))


def _score_geocode_result(result: dict[str, Any], city_name: str, district_name: str | None) -> int:
    expected_city = _normalize_lookup(city_name)
    expected_district = _normalize_lookup(district_name)
    result_name = _normalize_lookup(result.get("name"))
    admin1 = _normalize_lookup(result.get("admin1"))
    admin2 = _normalize_lookup(result.get("admin2"))
    score = 0

    if result.get("country_code") == "TR":
        score += 20
    if admin1 == expected_city:
        score += 45
    if result_name == expected_city:
        score += 25
    if expected_district:
        if result_name == expected_district:
            score += 50
        if admin2 == expected_district:
            score += 20
    elif not admin2:
        score += 10

    return score


def _pick_geocode_result(results: list[dict[str, Any]], city_name: str, district_name: str | None):
    turkey_results = [item for item in results if item.get("country_code") == "TR"]
    candidates = turkey_results or results
    if not candidates:
        return None
    return max(candidates, key=lambda item: _score_geocode_result(item, city_name, district_name))


def geocode_location(city_name: str, district_name: str | None = None):
    city = _canonical_city_name(city_name)
    if not city:
        return None

    district_variants = _location_variants(district_name)
    query_names = district_variants or [None]

    for query_name in query_names:
        payload = _fetch_json(
            OPEN_METEO_GEOCODING_URL,
            {
                "name": query_name or city,
                "count": 10,
                "language": "tr",
                "format": "json",
                "countryCode": "TR",
            },
        )
        results = payload.get("results", []) if isinstance(payload, dict) else []
        result = _pick_geocode_result(results, city, query_name)
        if not result:
            continue

        result_admin1 = _normalize_lookup(result.get("admin1"))
        if query_name and result_admin1 and result_admin1 != _normalize_lookup(city):
            continue

        return upsert_geo_location(
            {
                "city_name": city,
                "district_name": query_name,
                "latitude": result.get("latitude"),
                "longitude": result.get("longitude"),
                "elevation_m": result.get("elevation"),
                "timezone": result.get("timezone") or TURKEY_TIMEZONE,
                "country_code": result.get("country_code") or "TR",
                "provider": OPEN_METEO_PROVIDER,
                "provider_location_id": result.get("id"),
                "feature_code": result.get("feature_code"),
                "admin1": result.get("admin1"),
                "admin2": result.get("admin2"),
                "source_name": "Open-Meteo Geocoding API",
                "fetched_at": datetime.now(ZoneInfo(TURKEY_TIMEZONE)),
            }
        )

    return None


def resolve_geo_location(city_name: str, district_name: str | None = None):
    city = _canonical_city_name(city_name)
    if not city:
        return None

    district_variants = _location_variants(district_name)
    for district_variant in district_variants:
        cached = get_geo_location(city, district_variant)
        if cached:
            return cached

    try:
        for district_variant in district_variants:
            resolved = geocode_location(city, district_variant)
            if resolved:
                return resolved
    except Exception:
        pass

    cached_city = get_geo_location(city, None)
    if cached_city:
        return cached_city
    try:
        return geocode_location(city, None)
    except Exception:
        return None

    return None


def refresh_climate_history_for_city(city_name: str, *, months: int = 12, force: bool = False):
    city = _canonical_city_name(city_name)
    if not city:
        return None

    location = resolve_geo_location(city, None)
    if not location:
        return None

    current_month_start = _today().replace(day=1)
    latest = get_latest_climate(city)
    existing_rows = get_climate_series(city, limit=months)
    if not force and latest and latest.get("observation_date") and len(existing_rows) >= months:
        latest_month = latest["observation_date"].replace(day=1)
        if latest_month >= current_month_start:
            return existing_rows

    start_date = _shift_month_start(current_month_start, -(months - 1))
    archive_payload = _fetch_climate_archive(float(location["latitude"]), float(location["longitude"]), start_date, _today())
    monthly_rows = _aggregate_monthly_climate(archive_payload, city)
    if not monthly_rows:
        return existing_rows

    replace_climate_history(monthly_rows)
    return monthly_rows


def _nearest_hourly_value(hourly: dict[str, Any], key: str, current_time: str | None):
    values = hourly.get(key) or []
    times = hourly.get("time") or []
    if not values:
        return None
    if current_time and current_time in times:
        index = times.index(current_time)
        if index < len(values):
            return values[index]
    return values[0]


def _extract_weather_values(payload: dict[str, Any]) -> dict[str, Any]:
    current = payload.get("current") or {}
    hourly = payload.get("hourly") or {}
    daily = payload.get("daily") or {}
    daily_precipitation = (daily.get("precipitation_sum") or [None])[0]
    daily_weather_code = (daily.get("weather_code") or [None])[0]
    current_time = current.get("time")

    return {
        "forecast_date": _today(),
        "temperature_c": _safe_float(current.get("temperature_2m")),
        "relative_humidity_pct": _safe_float(current.get("relative_humidity_2m")),
        "precipitation_mm": _safe_float(daily_precipitation if daily_precipitation is not None else current.get("precipitation")),
        "wind_speed_kmh": _safe_float(current.get("wind_speed_10m")),
        "soil_moisture_0_to_1cm": _safe_float(_nearest_hourly_value(hourly, "soil_moisture_0_to_1cm", current_time)),
        "weather_code": _safe_int(daily_weather_code if daily_weather_code is not None else current.get("weather_code")),
    }


def fetch_open_meteo_weather(latitude: float, longitude: float) -> dict[str, Any]:
    payload = _fetch_json(
        OPEN_METEO_FORECAST_URL,
        {
            "latitude": latitude,
            "longitude": longitude,
            "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
            "hourly": "soil_moisture_0_to_1cm",
            "daily": "precipitation_sum,weather_code",
            "timezone": TURKEY_TIMEZONE,
            "forecast_days": 1,
        },
    )
    if not isinstance(payload, dict):
        raise ValueError("Open-Meteo forecast response was not an object.")
    return payload


def fetch_open_meteo_weather_batch(locations: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not locations:
        return []

    payload = _fetch_json(
        OPEN_METEO_FORECAST_URL,
        {
            "latitude": ",".join(str(float(location["latitude"])) for location in locations),
            "longitude": ",".join(str(float(location["longitude"])) for location in locations),
            "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
            "hourly": "soil_moisture_0_to_1cm",
            "daily": "precipitation_sum,weather_code",
            "timezone": TURKEY_TIMEZONE,
            "forecast_days": 1,
        },
    )
    if isinstance(payload, list):
        return payload
    if isinstance(payload, dict):
        return [payload]
    return []


def refresh_weather_for_location(location: dict[str, Any], *, force: bool = False):
    forecast_date = _today()
    if not force:
        cached = get_weather_daily_cache(location["id"], forecast_date)
        if cached:
            return cached

    raw_payload = fetch_open_meteo_weather(float(location["latitude"]), float(location["longitude"]))
    values = _extract_weather_values(raw_payload)
    return upsert_weather_daily_cache(
        {
            "location_id": location["id"],
            **values,
            "provider": OPEN_METEO_PROVIDER,
            "raw_payload": raw_payload,
        }
    )


def get_daily_weather(city_name: str, district_name: str | None = None, *, force: bool = False):
    location = resolve_geo_location(city_name, district_name)
    if not location:
        return None

    try:
        return refresh_weather_for_location(location, force=force)
    except Exception:
        return get_weather_daily_cache(location["id"], _today())


def _chunks(items: list[dict[str, Any]], size: int):
    for index in range(0, len(items), size):
        yield items[index : index + size]


def _location_failure_payload(location: dict[str, Any]) -> dict[str, Any]:
    return {
        "city_name": location.get("city_name"),
        "district_name": location.get("district_name"),
    }


def _refresh_weather_locations(locations: list[dict[str, Any]], *, force: bool = False) -> tuple[int, list[dict[str, Any]]]:
    if not locations:
        return 0, []

    if len(locations) == 1:
        location = locations[0]
        try:
            if refresh_weather_for_location(location, force=force):
                return 1, []
        except Exception:
            pass
        return 0, [_location_failure_payload(location)]

    try:
        responses = fetch_open_meteo_weather_batch(locations)
    except Exception:
        mid = max(1, len(locations) // 2)
        left_updated, left_failures = _refresh_weather_locations(locations[:mid], force=force)
        right_updated, right_failures = _refresh_weather_locations(locations[mid:], force=force)
        return left_updated + right_updated, left_failures + right_failures

    if len(responses) != len(locations):
        mid = max(1, len(locations) // 2)
        left_updated, left_failures = _refresh_weather_locations(locations[:mid], force=force)
        right_updated, right_failures = _refresh_weather_locations(locations[mid:], force=force)
        return left_updated + right_updated, left_failures + right_failures

    updated = 0
    failures: list[dict[str, Any]] = []
    for location, raw_payload in zip(locations, responses):
        try:
            values = _extract_weather_values(raw_payload)
            cache = upsert_weather_daily_cache(
                {
                    "location_id": location["id"],
                    **values,
                    "provider": OPEN_METEO_PROVIDER,
                    "raw_payload": raw_payload,
                }
            )
            if cache:
                updated += 1
                continue
            raise ValueError("Weather cache upsert returned no row.")
        except Exception:
            try:
                if refresh_weather_for_location(location, force=True):
                    updated += 1
                else:
                    failures.append(_location_failure_payload(location))
            except Exception:
                failures.append(_location_failure_payload(location))

    return updated, failures


def refresh_known_weather_cache(*, batch_size: int = BATCH_SIZE, force: bool = False, limit: int | None = None):
    candidates = list_weather_location_candidates(limit=limit)
    deduped_candidates: list[dict[str, Any]] = []
    seen_candidates: set[tuple[str, str]] = set()
    for candidate in candidates:
        key = (_normalize_lookup(candidate.get("city_name")), _normalize_lookup(candidate.get("district_name")))
        if key in seen_candidates:
            continue
        seen_candidates.add(key)
        deduped_candidates.append(candidate)

    resolved_locations: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []

    for candidate in deduped_candidates:
        location = resolve_geo_location(candidate.get("city_name"), candidate.get("district_name"))
        if location:
            resolved_locations.append(dict(location))
        else:
            failures.append(dict(candidate))

    forecast_date = _today()
    locations_to_refresh = []
    skipped = 0
    for location in resolved_locations:
        if not force and get_weather_daily_cache(location["id"], forecast_date):
            skipped += 1
            continue
        locations_to_refresh.append(location)

    updated = 0
    for chunk in _chunks(locations_to_refresh, max(1, batch_size)):
        chunk_updated, chunk_failures = _refresh_weather_locations(chunk, force=force)
        updated += chunk_updated
        failures.extend(chunk_failures)

    return {
        "candidate_count": len(deduped_candidates),
        "resolved_count": len(resolved_locations),
        "updated_count": updated,
        "skipped_count": skipped,
        "failed_count": len(failures),
        "failures": failures[:20],
        "forecast_date": forecast_date.isoformat(),
    }


def weather_code_label(weather_code: int | None, fallback_temp: float | None = None, fallback_rainfall: float | None = None) -> str:
    if weather_code is not None and weather_code in WEATHER_CODE_LABELS:
        return WEATHER_CODE_LABELS[weather_code]
    if fallback_rainfall is not None and fallback_rainfall >= 5:
        return "Yağmurlu"
    if fallback_temp is not None and fallback_temp >= 24:
        return "Güneşli"
    return "Açık"
