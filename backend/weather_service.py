from __future__ import annotations

import json
import math
import unicodedata
from datetime import date, datetime
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

from db.repositories import (
    get_geo_location,
    get_weather_daily_cache,
    list_weather_location_candidates,
    upsert_geo_location,
    upsert_weather_daily_cache,
)


OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
OPEN_METEO_PROVIDER = "open-meteo"
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
    district = _clean_text(district_name)
    if not city:
        return None

    query_name = district or city
    payload = _fetch_json(
        OPEN_METEO_GEOCODING_URL,
        {
            "name": query_name,
            "count": 10,
            "language": "tr",
            "format": "json",
            "countryCode": "TR",
        },
    )
    results = payload.get("results", []) if isinstance(payload, dict) else []
    result = _pick_geocode_result(results, city, district)
    if not result:
        return None

    return upsert_geo_location(
        {
            "city_name": city,
            "district_name": district,
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


def resolve_geo_location(city_name: str, district_name: str | None = None):
    city = _canonical_city_name(city_name)
    district = _clean_text(district_name)
    if not city:
        return None

    cached = get_geo_location(city, district)
    if cached:
        return cached

    try:
        resolved = geocode_location(city, district)
        if resolved:
            return resolved
    except Exception:
        pass

    if district:
        cached_city = get_geo_location(city, None)
        if cached_city:
            return cached_city
        try:
            return geocode_location(city, None)
        except Exception:
            return None

    return None


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
        try:
            responses = fetch_open_meteo_weather_batch(chunk)
        except Exception:
            failures.extend({"city_name": item["city_name"], "district_name": item.get("district_name")} for item in chunk)
            continue

        for location, raw_payload in zip(chunk, responses):
            values = _extract_weather_values(raw_payload)
            if upsert_weather_daily_cache(
                {
                    "location_id": location["id"],
                    **values,
                    "provider": OPEN_METEO_PROVIDER,
                    "raw_payload": raw_payload,
                }
            ):
                updated += 1

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
