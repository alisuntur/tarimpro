import json
import re
from contextlib import asynccontextmanager
from datetime import date, datetime
from math import sqrt
from statistics import mean, pstdev

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict

from db import bootstrap_database
from db.repositories import (
    create_ai_analysis,
    create_field,
    create_production_plan,
    create_user,
    create_user_session,
    delete_field,
    get_ai_analysis_for_user,
    get_ai_recommendations,
    get_ai_recommendations_for_analysis,
    get_candidate_forecasts,
    get_city_crop_options,
    get_city_production_overview,
    get_city_production_trend,
    get_climate_series,
    get_consumption_projection_map,
    get_crop_history_rows,
    get_crop_projection_series,
    get_dashboard_alerts,
    get_product_supply_demand_projection,
    get_product_supply_demand_series,
    get_product_yield_context,
    get_field_for_user,
    get_fields_for_user,
    get_latest_ai_analysis_for_plan,
    get_latest_climate,
    get_latest_forecast_year,
    get_market_projection,
    get_plan_history,
    get_production_plan_for_user,
    get_production_plans_for_user,
    get_user_by_identifier,
    get_walk_forward_calibration,
    get_walk_forward_summary,
    list_ai_analyses_for_user,
    revoke_user_session,
    update_field,
    update_plan_analysis_result,
    update_production_plan,
    update_user_profile,
)
from dependencies import require_current_user, security
from scoring import compute_weighted_score, get_scoring_profile
from security import generate_session_token, hash_password, hash_session_token, verify_password


TURKISH_ASCII_TRANSLATION = str.maketrans({"\u00e7": "c", "\u00c7": "C", "\u011f": "g", "\u011e": "G", "\u0131": "i", "\u0130": "I", "\u00f6": "o", "\u00d6": "O", "\u015f": "s", "\u015e": "S", "\u00fc": "u", "\u00dc": "U"})

STATUS_LABELS = {
    "Taslak": "Taslak",
    "draft": "Taslak",
    "Analiz Haz\u0131r": "Analiz Haz\u0131r",
    "Analiz Hazir": "Analiz Haz\u0131r",
    "Hasat Bekliyor": "Hasat Bekliyor",
    "Tamamland\u0131": "Tamamland\u0131",
    "Tamamlandi": "Tamamland\u0131",
}

CROP_LABELS = {
    "wheat": "Bu\u011fday",
    "Bugday": "Bu\u011fday",
    "sunflower": "Ay\u00e7i\u00e7e\u011fi",
    "Aycicegi": "Ay\u00e7i\u00e7e\u011fi",
    "cotton": "Pamuk",
    "corn": "M\u0131s\u0131r",
    "Misir": "M\u0131s\u0131r",
    "sugar_beet": "\u015eeker Pancar\u0131",
    "olive": "Zeytin",
    "hazelnut": "F\u0131nd\u0131k",
    "grape": "\u00dcz\u00fcm",
    "apple": "Elma",
}
MONTH_LABELS = ["Oca", "\u015eub", "Mar", "Nis", "May", "Haz", "Tem", "A\u011fu", "Eyl", "Eki", "Kas", "Ara"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    bootstrap_database()
    yield


app = FastAPI(title="Tarım Yapay Zeka API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class LoginRequest(BaseModel):
    identifier: str
    password: str
    rememberMe: bool = False


class RegisterRequest(BaseModel):
    fullName: str
    phone: str
    password: str
    email: str | None = None
    city: str | None = None
    district: str | None = None
    tcIdentityNo: str | None = None
    rememberMe: bool = False


class AIAnalysisRequest(BaseModel):
    region: str = ""
    size: float = 0
    crop: str = ""
    planId: str | None = None


class ProfileUpdateRequest(BaseModel):
    fullName: str
    phone: str
    email: str | None = None
    city: str | None = None
    district: str | None = None


class FieldUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str
    city: str | None = None
    district: str | None = None
    regionCode: str | None = None
    areaDecare: float
    soilType: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    notes: str | None = None


class PlanUpsertRequest(BaseModel):
    model_config = ConfigDict(extra="ignore")

    fieldId: str | None = None
    city: str | None = None
    district: str | None = None
    regionCode: str | None = None
    plannedAreaDecare: float | None = None
    selectedCropName: str | None = None
    seasonYear: int | None = None


def _comparison_key(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(str(value).strip().translate(TURKISH_ASCII_TRANSLATION).lower().split())


def _display_crop_name(value: str | None) -> str:
    if not value:
        return "Ürün"
    return CROP_LABELS.get(value, value)



def _display_status(value: str | None) -> str:
    if not value:
        return "Taslak"
    return STATUS_LABELS.get(value, value)


def _condition_from_climate(temp: float, rainfall: float) -> str:
    if rainfall >= 80:
        return "Yağmurlu"
    if rainfall >= 40:
        return "Parçalı Bulutlu"
    if temp >= 24:
        return "Güneşli"
    if temp <= 8:
        return "Serin"
    return "Açık"



def _soil_status(soil_moisture: float) -> str:
    if soil_moisture < 20:
        return "Kuru"
    if soil_moisture > 55:
        return "Islak"
    return "Optimum"


def _risk_payload(avg_temp: float, avg_rainfall: float, avg_soil: float) -> dict[str, object]:
    score = max(5, min(95, round((avg_temp * 3.1) - (avg_rainfall * 0.28) - (avg_soil * 0.12) + 28)))
    if score >= 68:
        level = "Yüksek"
    elif score >= 42:
        level = "Orta"
    else:
        level = "Düşük"
    return {
        "score": score,
        "level": level,
    }



def _format_relative_time(value) -> str:
    if not value:
        return "Az önce"
    now = datetime.now(value.tzinfo) if getattr(value, "tzinfo", None) else datetime.now()
    delta = now - value.replace(tzinfo=now.tzinfo) if getattr(value, "tzinfo", None) and now.tzinfo else now - value.replace(tzinfo=None)
    hours = max(1, int(delta.total_seconds() // 3600))
    if hours < 24:
        return f"{hours} saat önce"
    days = max(1, hours // 24)
    return f"{days} gün önce"



def _format_date(value) -> str:
    if not value:
        return "Bilinmiyor"
    return f"{value.day:02d} {MONTH_LABELS[value.month - 1]} {value.year}"



def _dashboard_city(user: dict, city: str | None) -> str:
    return city or user.get("city") or "Manisa"



def _serialize_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["full_name"],
        "role": user["role"],
        "activeBadge": bool(user["active_badge"]),
        "city": user.get("city"),
        "district": user.get("district"),
    }



def _serialize_profile_user(user: dict) -> dict:
    return {
        "id": user["id"],
        "name": user["full_name"],
        "tc": user.get("tc_identity_no"),
        "phone": user.get("phone"),
        "email": user.get("email"),
        "city": user.get("city"),
        "district": user.get("district"),
        "memberSince": user["member_since"].year if user.get("member_since") else None,
        "role": user["role"],
        "activeBadge": bool(user["active_badge"]),
    }



def _serialize_field(field: dict) -> dict:
    return {
        "id": str(field["id"]),
        "name": field["name"],
        "size": float(field.get("area_decare") or 0),
        "soilType": field.get("soil_type"),
        "city": field.get("city"),
        "district": field.get("district"),
        "regionCode": field.get("region_code"),
        "latitude": float(field["latitude"]) if field.get("latitude") is not None else None,
        "longitude": float(field["longitude"]) if field.get("longitude") is not None else None,
        "notes": field.get("notes"),
    }


def _serialize_crop_option(option: dict) -> dict:
    return {
        "name": option["product_name"],
        "latestYear": option.get("latest_year"),
        "latestProductionTon": round(float(option["production_ton"])) if option.get("production_ton") is not None else None,
        "latestYieldKgDecare": round(float(option["yield_kg_decare"]), 1) if option.get("yield_kg_decare") is not None else None,
    }


def _serialize_plan(plan: dict | None) -> dict | None:
    if not plan:
        return None

    return {
        "id": str(plan["id"]),
        "fieldId": str(plan["field_id"]) if plan.get("field_id") else None,
        "fieldName": plan.get("field_name"),
        "city": plan.get("city") or plan.get("field_city"),
        "district": plan.get("district") or plan.get("field_district"),
        "selectedCropName": plan.get("selected_crop_name"),
        "plannedAreaDecare": float(plan.get("planned_area_decare") or 0),
        "seasonYear": plan.get("season_year"),
        "status": _display_status(plan.get("status")),
        "targetYieldPercent": float(plan["target_yield_percent"]) if plan.get("target_yield_percent") is not None else None,
        "createdAt": plan["created_at"].isoformat() if plan.get("created_at") else None,
        "updatedAt": plan["updated_at"].isoformat() if plan.get("updated_at") else None,
    }



def _clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))



def _safe_float(value, default: float | None = 0.0) -> float | None:
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default



def _safe_int(value, default: int | None = None) -> int | None:
    try:
        if value is None:
            return default
        return int(value)
    except (TypeError, ValueError):
        return default



def _normalize_range(value: float | None, minimum: float | None, maximum: float | None, default: float = 50.0) -> float:
    if value is None or minimum is None or maximum is None:
        return default
    if maximum <= minimum:
        return default
    return _clamp(((value - minimum) / (maximum - minimum)) * 100, 0, 100)



def _score_breakdown_label(key: str | None) -> str:
    labels = {
        "yield": "Geçmiş verim",
        "forecast": "Model projeksiyonu",
        "demand": "Arz-talep dengesi",
        "climate": "İklim dayanıklılığı",
    }
    return labels.get(key or "", key or "Skor")



def _parse_score_breakdown(value) -> list[dict[str, object]]:
    if not value:
        return []

    if isinstance(value, list):
        parsed = value
    elif isinstance(value, str):
        try:
            loaded = json.loads(value)
        except json.JSONDecodeError:
            return []
        parsed = loaded if isinstance(loaded, list) else []
    else:
        return []

    normalized: list[dict[str, object]] = []
    for item in parsed:
        if not isinstance(item, dict):
            continue
        key = item.get("key")
        normalized.append({**item, "label": _score_breakdown_label(key)})
    return normalized



def _confidence_label(score: float) -> str:
    if score >= 60:
        return "Güçlü"
    if score >= 45:
        return "Dengeli"
    return "Temkinli"



def _format_horizon_label(horizon: int | None) -> str:
    effective_horizon = max(1, int(horizon or 1))
    return f"{effective_horizon} yıllık tahmin ufku"



def _blend_metric(local_value: float | None, prior_value: float | None, local_weight: float, prior_weight: float) -> float | None:
    if local_value is None and prior_value is None:
        return None
    if local_value is None:
        return prior_value
    if prior_value is None:
        return local_value
    total_weight = max(local_weight, 0) + max(prior_weight, 0)
    if total_weight <= 0:
        return prior_value
    return ((local_value * max(local_weight, 0)) + (prior_value * max(prior_weight, 0))) / total_weight



def _history_summary(rows: list[dict]) -> dict[str, float | int | None]:
    yield_values = [_safe_float(row.get("yield_kg_decare"), None) for row in rows]
    yield_values = [value for value in yield_values if value is not None and value > 0]
    production_values = [_safe_float(row.get("production_ton"), None) for row in rows]
    production_values = [value for value in production_values if value is not None and value > 0]
    latest_row = rows[-1] if rows else None
    avg_yield = mean(yield_values) if yield_values else None
    latest_yield = _safe_float(latest_row.get("yield_kg_decare"), None) if latest_row else None
    latest_production = _safe_float(latest_row.get("production_ton"), None) if latest_row else None

    if len(yield_values) >= 2 and avg_yield and avg_yield > 0:
        variation = pstdev(yield_values) / avg_yield
        stability_score = round(_clamp(100 - (variation * 120), 30, 95), 1)
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



def _latest_history_year(city_name: str | None, product_name: str | None) -> int | None:
    if not product_name:
        return None

    history_rows = get_crop_history_rows(city_name, product_name, years=1)
    if not history_rows and city_name:
        history_rows = get_crop_history_rows(None, product_name, years=1)
    if not history_rows:
        return None
    return _safe_int(history_rows[-1].get("year"), None)



def _yield_score_from_context(yield_context: dict | None, fallback_available: bool = False) -> float:
    if not yield_context:
        return 55.0 if fallback_available else 45.0

    city_avg_yield = _safe_float(yield_context.get("city_avg_yield"), None)
    national_avg_yield = _safe_float(yield_context.get("national_avg_yield"), None)
    percentile_score = _safe_float(yield_context.get("percentile_score"), None)
    relative_index_pct = _safe_float(yield_context.get("relative_index_pct"), None)

    if city_avg_yield is None or national_avg_yield in (None, 0):
        return 55.0 if fallback_available else 45.0

    parity_score = _clamp(50 + (((relative_index_pct or 100) - 100) * 0.7), 15, 95)
    percentile_component = percentile_score if percentile_score is not None else 50
    return round(_clamp((percentile_component * 0.7) + (parity_score * 0.3), 15, 95), 1)



def _build_supply_demand_payload(balance_row: dict | None) -> dict[str, object]:
    if not balance_row:
        return {
            "score": 50.0,
            "status": "Veri sınırlı",
            "summary": "Arz-talep dengesi için yeterli üretim ve tüketim verisi bulunamadı.",
            "note": "Tüketim veya üretim tahmini eksik olduğu için denge yorumu oluşturulamadı.",
            "coverageRatioPct": None,
            "balanceTon": None,
            "balancePct": None,
            "predictedSupplyTon": None,
            "predictedDemandTon": None,
            "demandGrowthPct": None,
            "scope": "Türkiye ürün dengesi",
            "scopeTitle": "Türkiye geneli piyasa dengesi",
            "supplyScope": "Türkiye geneli model üretim tahmini",
            "demandScope": "Türkiye geneli tüketim tahmini",
            "planScope": "Seçilen il ve dönüm hesabından ayrıdır.",
        }

    supply = _safe_float(balance_row.get("predicted_supply_ton"), None)
    demand = _safe_float(balance_row.get("predicted_demand_ton"), None)
    demand_growth_pct = _safe_float(balance_row.get("demand_growth_pct"), None)
    forecast_year = _safe_int(balance_row.get("forecast_year"), None)

    if supply is None or demand in (None, 0):
        return {
            "score": 50.0,
            "status": "Veri sınırlı",
            "summary": "Arz-talep dengesi için yeterli üretim ve tüketim verisi bulunamadı.",
            "note": "Tüketim veya üretim tahmini eksik olduğu için denge yorumu oluşturulamadı.",
            "coverageRatioPct": None,
            "balanceTon": None,
            "balancePct": None,
            "predictedSupplyTon": supply,
            "predictedDemandTon": demand,
            "demandGrowthPct": demand_growth_pct,
            "scope": "Türkiye ürün dengesi",
            "scopeTitle": "Türkiye geneli piyasa dengesi",
            "supplyScope": "Türkiye geneli model üretim tahmini",
            "demandScope": "Türkiye geneli tüketim tahmini",
            "planScope": "Seçilen il ve dönüm hesabından ayrıdır.",
        }

    coverage_ratio = supply / demand
    coverage_ratio_pct = coverage_ratio * 100
    balance_ton = supply - demand
    balance_pct = (balance_ton / demand) * 100 if demand else None

    if coverage_ratio < 0.95:
        status = "Arz açığı"
        note = "Talep üretimi aşıyor; iç piyasada açık ve ithalat baskısı görülebilir."
        tone = "warning"
        base_score = 100 - ((1 - coverage_ratio) * 95)
    elif coverage_ratio <= 1.05:
        status = "Dengeli"
        note = "Üretim ve tüketim birbirine yakın; aşırı arz kaynaklı fiyat baskısı daha sınırlı olabilir."
        tone = "balanced"
        base_score = 96 - (abs(coverage_ratio - 1) * 40)
    else:
        status = "Üretim fazlası"
        note = "Üretim talebi aşıyor; fiyat baskısı, stok yükü ve fazla arz riski oluşabilir."
        tone = "risk"
        base_score = 100 - ((coverage_ratio - 1) * 150)

    growth_bonus = _clamp((demand_growth_pct or 0) * 0.18, -6, 6) if demand_growth_pct is not None else 0
    score = round(_clamp(base_score + growth_bonus, 5, 100), 1)

    year_prefix = f"{forecast_year} Türkiye görünümünde" if forecast_year else "Türkiye görünümünde"
    summary = (
        f"{year_prefix} tahmini üretim {supply:,.0f} ton, tahmini tüketim {demand:,.0f} ton. "
        f"Karşılama oranı %{coverage_ratio_pct:.1f}; ürün {status.lower()} görünümünde."
    )

    return {
        "score": score,
        "status": status,
        "summary": summary,
        "note": note,
        "coverageRatioPct": round(coverage_ratio_pct, 1),
        "balanceTon": round(balance_ton, 1),
        "balancePct": round(balance_pct, 1) if balance_pct is not None else None,
        "predictedSupplyTon": round(supply, 1),
        "predictedDemandTon": round(demand, 1),
        "demandGrowthPct": round(demand_growth_pct, 1) if demand_growth_pct is not None else None,
        "scope": "Türkiye ürün dengesi",
        "scopeTitle": "Türkiye geneli piyasa dengesi",
        "supplyScope": "Türkiye geneli model üretim tahmini",
        "demandScope": "Türkiye geneli tüketim tahmini",
        "planScope": "Seçilen il ve dönüm hesabından ayrıdır.",
        "tone": tone,
        "consumptionProductName": balance_row.get("consumption_product_name"),
    }



def _build_confidence_payload(city_name: str | None, product_name: str | None, horizon: int | None) -> dict[str, object]:
    effective_horizon = int(_clamp(float(horizon or 1), 1, 3))
    global_stats = get_walk_forward_calibration(horizon=effective_horizon) or {}
    product_stats = get_walk_forward_calibration(product_name=product_name, horizon=effective_horizon) if product_name else {}
    local_stats = get_walk_forward_calibration(city_name=city_name, product_name=product_name, horizon=effective_horizon) if city_name and product_name else {}
    metric_row = get_walk_forward_summary(horizon=effective_horizon)

    global_sample = _safe_int(global_stats.get("sample_size"), 0) or 0
    global_rate = _safe_float(global_stats.get("success_rate"), None)
    product_sample = _safe_int(product_stats.get("sample_size"), 0) or 0
    product_rate = _safe_float(product_stats.get("success_rate"), None)
    local_sample = _safe_int(local_stats.get("sample_size"), 0) or 0
    local_success = _safe_int(local_stats.get("success_count"), 0) or 0

    prior_stats = global_stats
    prior_level = "Ürün + tahmin ufku"
    prior_sample = global_sample
    prior_rate = global_rate if global_rate is not None else 0.45

    if product_sample >= 20 and product_rate is not None:
        prior_stats = product_stats
        prior_level = "Ürün + tahmin ufku"
        prior_sample = product_sample
        prior_rate = product_rate

    prior_strength = _clamp(sqrt(prior_sample or 1), 8, 24) if prior_sample else 10.0
    alpha_prior = max(prior_rate * prior_strength, 0.5)
    beta_prior = max((1 - prior_rate) * prior_strength, 0.5)
    posterior_rate = (local_success + alpha_prior) / (local_sample + alpha_prior + beta_prior)
    score = round(_clamp(posterior_rate * 100, 5, 95), 1)
    label = _confidence_label(score)

    if local_sample >= 3:
        calibration_level = "Şehir + ürün + tahmin ufku"
    elif local_sample > 0 and prior_sample:
        calibration_level = "Şehir örneklemi sınırlı, üst düzey seri ile kalibre edildi"
    elif product_sample >= 20:
        calibration_level = "Ürün + tahmin ufku"
    else:
        calibration_level = "Tahmin ufku geneli"

    observed_source = local_stats if local_sample > 0 else (product_stats if product_sample > 0 else global_stats)
    observed_coverage_pct = _safe_float(observed_source.get("success_rate"), posterior_rate)
    observed_coverage_pct = round((observed_coverage_pct or 0) * 100, 1)

    avg_abs_error_pct = _blend_metric(
        _safe_float(local_stats.get("avg_abs_error_pct"), None) if local_sample > 0 else None,
        _safe_float(prior_stats.get("avg_abs_error_pct"), None),
        local_sample,
        prior_strength,
    )
    avg_interval_width_pct = _blend_metric(
        _safe_float(local_stats.get("avg_interval_width_pct"), None) if local_sample > 0 else None,
        _safe_float(prior_stats.get("avg_interval_width_pct"), None),
        local_sample,
        prior_strength,
    )

    effective_sample = local_sample + alpha_prior + beta_prior
    variance = (posterior_rate * (1 - posterior_rate)) / max(effective_sample + 1, 1)
    error_margin = 1.28155 * sqrt(max(variance, 0)) * 100
    probability_range = {
        "lower": round(_clamp(score - error_margin, 0, 100), 1),
        "upper": round(_clamp(score + error_margin, 0, 100), 1),
    }

    if local_sample > 0:
        if local_sample < 6 and prior_sample:
            summary = (
                f"{_format_horizon_label(effective_horizon)} için şehir ve ürün kırılımında {local_sample} benzer senaryo bulundu. "
                f"Örneklem sınırlı olduğu için sonuç, {prior_level.lower()} düzeyindeki {prior_sample} senaryonun walk-forward başarı oranı ile dengelenerek %{score:.1f} olarak kalibre edildi."
            )
        else:
            summary = (
                f"{_format_horizon_label(effective_horizon)} için şehir ve ürün kırılımındaki {local_sample} benzer walk-forward senaryosuna göre "
                f"önerinin başarı olasılığı %{score:.1f} hesaplandı."
            )
    elif product_sample >= 20:
        summary = (
            f"Şehir kırılımında yeterli örnek bulunmadığı için {prior_level.lower()} düzeyindeki {product_sample} walk-forward senaryosu kullanılarak "
            f"başarı olasılığı %{score:.1f} hesaplandı."
        )
    elif global_sample:
        summary = (
            f"Seçilen ürün için ayrıntılı kalibrasyon verisi sınırlı olduğu için {_format_horizon_label(effective_horizon)} genelindeki {global_sample} walk-forward senaryosu referans alındı. "
            f"Öneri başarı olasılığı %{score:.1f} hesaplandı."
        )
    else:
        summary = "Walk-forward kalibrasyon verisi bulunamadığı için genel model görünümü kullanıldı."

    smape = _safe_float((metric_row or {}).get("avg_smape_pct"), None)
    wape = _safe_float((metric_row or {}).get("avg_wape_pct"), None)

    return {
        "score": score,
        "label": label,
        "summary": summary,
        "method": "Walk-forward doğrulama sonuçlarının ampirik Bayes kalibrasyonu",
        "successDefinition": "Başarılı senaryo, gerçek üretimin modelin walk-forward kalibrasyon bandı içinde kalması olarak tanımlanır.",
        "calibrationLevel": calibration_level,
        "horizon": effective_horizon,
        "horizonLabel": _format_horizon_label(effective_horizon),
        "localSampleSize": local_sample or None,
        "referenceSampleSize": prior_sample or None,
        "referenceLevel": prior_level if prior_sample else None,
        "observedCoveragePct": observed_coverage_pct,
        "avgAbsErrorPct": round(avg_abs_error_pct, 1) if avg_abs_error_pct is not None else None,
        "avgIntervalWidthPct": round(avg_interval_width_pct, 1) if avg_interval_width_pct is not None else None,
        "probabilityRange": probability_range,
        "modelName": (metric_row or {}).get("model_name"),
        "modelVersion": (metric_row or {}).get("model_version"),
        "avgSmapePct": round(smape, 1) if smape is not None else None,
        "avgWapePct": round(wape, 1) if wape is not None else None,
    }



def _decorate_analysis_with_confidence(analysis: dict | None) -> dict | None:
    if not analysis:
        return analysis

    decorated = dict(analysis)
    focus_crop = decorated.get("focus_crop_name") or decorated.get("selected_crop_name")
    forecast_year = _safe_int(decorated.get("forecast_year"), None)
    city_name = decorated.get("city") or decorated.get("field_city")

    if focus_crop and forecast_year:
        latest_year = _latest_history_year(city_name, focus_crop)
        horizon = int(_clamp(float((forecast_year - latest_year) if latest_year else 1), 1, 3))
        confidence_payload = _build_confidence_payload(city_name, focus_crop, horizon)
    else:
        stored_score = round(_safe_float(decorated.get("confidence_score"), 0) or 0, 1)
        confidence_payload = {
            "score": stored_score,
            "label": _confidence_label(stored_score),
            "summary": None,
        }

    decorated["confidence_payload"] = confidence_payload
    decorated["confidence_score"] = confidence_payload.get("score", decorated.get("confidence_score"))
    return decorated



def _decorate_analysis_with_market_context(analysis: dict | None) -> dict | None:
    if not analysis:
        return analysis

    decorated = dict(analysis)
    focus_crop = decorated.get("focus_crop_name") or decorated.get("selected_crop_name")
    forecast_year = _safe_int(decorated.get("forecast_year"), None)
    city_name = decorated.get("city") or decorated.get("field_city")

    yield_context = get_product_yield_context(city_name, focus_crop, years=5) if focus_crop else {}
    supply_demand = _build_supply_demand_payload(
        get_product_supply_demand_projection(focus_crop, forecast_year)
    ) if focus_crop and forecast_year else _build_supply_demand_payload(None)

    decorated["yield_context"] = yield_context
    decorated["supply_demand"] = supply_demand
    if supply_demand.get("summary"):
        decorated["market_comment"] = f"{supply_demand['summary']} {supply_demand.get('note', '')}".strip()
    return decorated



def _serialize_analysis_report(analysis: dict) -> dict[str, object]:
    analysis = _decorate_analysis_with_confidence(analysis) or {}
    score = _safe_float(analysis.get("score"), 0) or 0
    confidence_payload = analysis.get("confidence_payload") or {}
    confidence_score = _safe_float(confidence_payload.get("score"), _safe_float(analysis.get("confidence_score"), 0)) or 0
    selected_crop = analysis.get("selected_crop_name") or analysis.get("focus_crop_name")
    return {
        "id": str(analysis["id"]),
        "analysisId": str(analysis["id"]),
        "planId": str(analysis["plan_id"]),
        "date": _format_date(analysis.get("analyzed_at")),
        "field": analysis.get("field_name") or analysis.get("city") or "Kayıtlı Plan",
        "type": f"{_display_crop_name(selected_crop)} AI Analizi" if selected_crop else "AI Analizi",
        "status": f"Skor %{int(round(score))}",
        "score": round(score, 1),
        "confidenceScore": round(confidence_score, 1),
        "confidenceLabel": confidence_payload.get("label") or _confidence_label(confidence_score),
        "city": analysis.get("city") or analysis.get("field_city"),
        "selectedCropName": selected_crop,
        "analyzedAt": analysis.get("analyzed_at").isoformat() if analysis.get("analyzed_at") else None,
    }



def _serialize_saved_recommendation(item: dict) -> dict[str, object]:
    expected_return = _safe_float(item.get("expected_return_percent"), None)
    recommendation_score = _safe_float(item.get("recommendation_score"), 0) or 0
    return {
        "id": str(item["id"]),
        "rank": item.get("rank_order"),
        "crop": item.get("crop_name"),
        "score": round(recommendation_score, 1),
        "forecastYear": item.get("forecast_year"),
        "expectedReturn": f"{expected_return:+.1f}%" if expected_return is not None else "-",
        "expectedYieldKgDecare": round(_safe_float(item.get("expected_yield_kg_decare"), 0) or 0, 1) if item.get("expected_yield_kg_decare") is not None else None,
        "estimatedProductionTon": round(_safe_float(item.get("expected_production_ton"), 0) or 0, 1) if item.get("expected_production_ton") is not None else None,
        "predictedProductionTon": round(_safe_float(item.get("predicted_production_ton"), 0) or 0, 1) if item.get("predicted_production_ton") is not None else None,
        "reason": item.get("reason"),
    }



def _serialize_analysis_response(analysis: dict, recommendations: list[dict], trend_rows: list[dict] | None = None) -> dict[str, object]:
    analysis = _decorate_analysis_with_market_context(_decorate_analysis_with_confidence(analysis)) or {}
    selected_crop_name = analysis.get("selected_crop_name") or analysis.get("focus_crop_name")
    confidence_payload = analysis.get("confidence_payload") or {}
    supply_demand = analysis.get("supply_demand") or {}
    yield_context = analysis.get("yield_context") or {}
    score = _safe_float(analysis.get("score"), 0) or 0

    default_confidence = {
        "score": round(_safe_float(analysis.get("confidence_score"), 0) or 0, 1),
        "label": _confidence_label(_safe_float(analysis.get("confidence_score"), 0) or 0),
    }
    response_confidence = {**default_confidence, **confidence_payload}

    return {
        "success": True,
        "analysisId": str(analysis["id"]),
        "analyzedAt": analysis.get("analyzed_at").isoformat() if analysis.get("analyzed_at") else None,
        "score": round(score, 1),
        "confidence": response_confidence,
        "summary": analysis.get("summary"),
        "climateComment": analysis.get("climate_comment"),
        "marketComment": analysis.get("market_comment"),
        "scoreBreakdown": _parse_score_breakdown(analysis.get("score_breakdown")),
        "selectedCrop": {
            "name": selected_crop_name,
            "score": round(score, 1),
            "forecastYear": analysis.get("forecast_year"),
            "expectedYieldKgDecare": round(_safe_float(analysis.get("expected_yield_kg_decare"), 0) or 0, 1) if analysis.get("expected_yield_kg_decare") is not None else None,
            "expectedProductionTon": round(_safe_float(analysis.get("expected_production_ton"), 0) or 0, 1) if analysis.get("expected_production_ton") is not None else None,
            "yieldScore": _yield_score_from_context(yield_context, analysis.get("expected_yield_kg_decare") is not None),
            "yieldIndexPct": round(_safe_float(yield_context.get("relative_index_pct"), 0) or 0, 1) if yield_context.get("relative_index_pct") is not None else None,
            "yieldPercentile": round(_safe_float(yield_context.get("percentile_score"), 0) or 0, 1) if yield_context.get("percentile_score") is not None else None,
        },
        "supplyDemand": supply_demand,
        "focusCrop": analysis.get("focus_crop_name") or selected_crop_name,
        "plan": {
            "id": str(analysis.get("plan_id")) if analysis.get("plan_id") else None,
            "fieldId": str(analysis.get("field_id")) if analysis.get("field_id") else None,
            "fieldName": analysis.get("field_name"),
            "city": analysis.get("city") or analysis.get("field_city"),
            "district": analysis.get("district") or analysis.get("field_district"),
            "selectedCropName": selected_crop_name,
            "plannedAreaDecare": round(_safe_float(analysis.get("planned_area_decare"), 0) or 0, 1),
            "seasonYear": analysis.get("season_year"),
            "status": _display_status(analysis.get("plan_status")),
            "targetYieldPercent": round(score, 1),
            "createdAt": None,
            "updatedAt": analysis.get("analyzed_at").isoformat() if analysis.get("analyzed_at") else None,
        },
        "recommendations": [_serialize_saved_recommendation(item) for item in recommendations],
        "trendSeries": [
            {
                "year": str(row["year"]),
                "historicalProduction": round(_safe_float(row.get("historical_production_ton"), 0) or 0, 1) if row.get("historical_production_ton") is not None else None,
                "predictedSupply": round(_safe_float(row.get("predicted_supply_ton"), 0) or 0, 1) if row.get("predicted_supply_ton") is not None else None,
                "predictedProduction": round(_safe_float(row.get("predicted_supply_ton"), 0) or 0, 1) if row.get("predicted_supply_ton") is not None else None,
                "predictedDemand": round(_safe_float(row.get("predicted_demand_ton"), 0) or 0, 1) if row.get("predicted_demand_ton") is not None else None,
            }
            for row in (trend_rows or [])
        ],
    }



def _analysis_is_current(plan: dict, analysis: dict | None) -> bool:
    if not plan or not analysis:
        return False
    analyzed_at = analysis.get("analyzed_at")
    updated_at = plan.get("updated_at")
    if not analyzed_at or not updated_at:
        return False

    breakdown = _parse_score_breakdown(analysis.get("score_breakdown"))
    demand_item = next((item for item in breakdown if item.get("key") == "demand"), None)
    if demand_item and demand_item.get("label") != _score_breakdown_label("demand"):
        return False

    planned_area = _safe_float(plan.get("planned_area_decare"), 0) or 0
    if planned_area > 0 and analysis.get("expected_production_ton") is None:
        return False

    return analyzed_at >= updated_at



def _normalize_phone(value: str) -> str:
    digits = re.sub(r"\D", "", value or "")
    if len(digits) == 10:
        phone = f"0{digits}"
    elif len(digits) == 11 and digits.startswith("0"):
        phone = digits
    elif len(digits) == 12 and digits.startswith("90"):
        phone = f"0{digits[-10:]}"
    else:
        phone = digits

    if not re.fullmatch(r"0\d{10}", phone):
        raise HTTPException(status_code=400, detail="Telefon numarası 05XXXXXXXXX formatında olmalıdır.")
    return phone


def _normalize_register_payload(payload: RegisterRequest) -> dict[str, object]:
    full_name = payload.fullName.strip()
    if len(full_name) < 3:
        raise HTTPException(status_code=400, detail="Ad soyad en az 3 karakter olmalıdır.")
    if len(payload.password or "") < 6:
        raise HTTPException(status_code=400, detail="Şifre en az 6 karakter olmalıdır.")

    phone = _normalize_phone(payload.phone)
    email = (payload.email or "").strip().lower() or None
    if email and not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(status_code=400, detail="Geçerli bir e-posta adresi giriniz.")

    tc_identity_no = (payload.tcIdentityNo or "").strip() or None
    if tc_identity_no and not re.fullmatch(r"\d{11}", tc_identity_no):
        raise HTTPException(status_code=400, detail="T.C. kimlik numarası 11 haneli olmalıdır.")

    return {
        "tc_identity_no": tc_identity_no,
        "phone": phone,
        "email": email,
        "password_hash": hash_password(payload.password),
        "full_name": full_name,
        "city": (payload.city or "").strip() or None,
        "district": (payload.district or "").strip() or None,
    }

def _normalize_profile_payload(payload: ProfileUpdateRequest) -> dict[str, object]:
    if not payload.fullName.strip():
        raise HTTPException(status_code=400, detail="Ad soyad boş bırakılamaz.")
    if not payload.phone.strip():
        raise HTTPException(status_code=400, detail="Telefon numarası boş bırakılamaz.")
    return {
        "full_name": payload.fullName.strip(),
        "phone": payload.phone.strip(),
        "email": (payload.email or "").strip() or None,
        "city": (payload.city or "").strip() or None,
        "district": (payload.district or "").strip() or None,
    }



def _normalize_field_payload(payload: FieldUpsertRequest, user: dict) -> dict[str, object]:
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tarla adı boş bırakılamaz.")
    if payload.areaDecare <= 0:
        raise HTTPException(status_code=400, detail="Tarla büyüklüğü sıfırdan büyük olmalıdır.")
    return {
        "name": payload.name.strip(),
        "city": (payload.city or user.get("city") or "").strip() or None,
        "district": (payload.district or user.get("district") or "").strip() or None,
        "region_code": (payload.regionCode or "").strip() or None,
        "area_decare": payload.areaDecare,
        "soil_type": (payload.soilType or "").strip() or None,
        "latitude": payload.latitude,
        "longitude": payload.longitude,
        "notes": (payload.notes or "").strip() or None,
    }



def _normalize_plan_payload(payload: PlanUpsertRequest, user: dict, *, existing_plan: dict | None = None) -> dict[str, object]:
    field = None
    if payload.fieldId:
        field = get_field_for_user(user["id"], payload.fieldId)
        if not field:
            raise HTTPException(status_code=404, detail="Seçilen tarla bulunamadı.")
    elif existing_plan and existing_plan.get("field_id"):
        field = get_field_for_user(user["id"], str(existing_plan["field_id"]))

    city = (payload.city or (field or {}).get("city") or user.get("city") or "").strip()
    if not city:
        raise HTTPException(status_code=400, detail="Plan için şehir bilgisi gereklidir.")

    planned_area = payload.plannedAreaDecare
    if planned_area is None and field and field.get("area_decare") is not None:
        planned_area = float(field["area_decare"])
    if planned_area is None or planned_area <= 0:
        raise HTTPException(status_code=400, detail="Planlanan alan sıfırdan büyük olmalıdır.")

    season_year = payload.seasonYear or date.today().year
    if season_year < 2000 or season_year > date.today().year + 10:
        raise HTTPException(status_code=400, detail="Sezon yılı geçerli bir aralıkta olmalıdır.")

    return {
        "field_id": str(field["id"]) if field else None,
        "selected_crop_name": (payload.selectedCropName or "").strip() or None,
        "region_code": (payload.regionCode or (field or {}).get("region_code") or "").strip() or None,
        "season_year": season_year,
        "status": "Taslak",
        "target_yield_percent": None,
        "planned_area_decare": planned_area,
        "planned_sowing_date": None,
        "planned_harvest_date": None,
        "city": city,
        "district": (payload.district or (field or {}).get("district") or user.get("district") or "").strip() or None,
    }


def _build_profile_response(user: dict) -> dict:
    fields = get_fields_for_user(user["id"])
    analyses = list_ai_analyses_for_user(user["id"], limit=20)
    return {
        "user": _serialize_profile_user(user),
        "fields": [_serialize_field(field) for field in fields],
        "reports": [_serialize_analysis_report(analysis) for analysis in analyses],
    }

@app.get("/")
def read_root():
    return {"message": "Welcome to Tarım Yapay Zeka API"}


@app.post("/api/auth/register", status_code=status.HTTP_201_CREATED)
def register(request: RegisterRequest):
    payload = _normalize_register_payload(request)

    if get_user_by_identifier(payload["phone"]):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu telefon numarasıyla kayıtlı bir hesap var.")
    if payload.get("email") and get_user_by_identifier(payload["email"]):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu e-posta adresi zaten kullanılıyor.")
    if payload.get("tc_identity_no") and get_user_by_identifier(payload["tc_identity_no"]):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu T.C. kimlik numarasıyla kayıtlı bir hesap var.")

    user = create_user(payload)
    if not user:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Bu bilgilerle kayıtlı bir hesap var.")

    raw_token = generate_session_token()
    create_user_session(user["id"], hash_session_token(raw_token), remember_me=request.rememberMe)
    return {
        "success": True,
        "token": raw_token,
        "user": _serialize_user(user),
    }

@app.post("/api/auth/login")
def login(request: LoginRequest):
    if not request.identifier.strip() or not request.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kimlik bilgileri eksik.")

    user = get_user_by_identifier(request.identifier.strip())
    if not user or not user.get("is_active") or not verify_password(request.password, user.get("password_hash")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Geçersiz kimlik bilgileri.")

    raw_token = generate_session_token()
    create_user_session(user["id"], hash_session_token(raw_token), remember_me=request.rememberMe)
    return {
        "success": True,
        "token": raw_token,
        "user": _serialize_user(user),
    }


@app.post("/api/auth/logout")
def logout(
    user=Depends(require_current_user),
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    if credentials and credentials.credentials:
        revoke_user_session(hash_session_token(credentials.credentials))
    return {"success": True}


@app.get("/api/auth/me")
def auth_me(user=Depends(require_current_user)):
    return {
        "authenticated": True,
        "user": _serialize_user(user),
    }


@app.get("/api/dashboard/summary")
def get_dashboard_summary(city: str | None = None, user=Depends(require_current_user)):
    city_name = _dashboard_city(user, city)
    climate = get_latest_climate(city_name) or get_latest_climate(user.get("city") or "Manisa")
    market_rows = get_market_projection(city_name) or get_market_projection(None)

    temp = round(float(climate["temperature_avg_c"])) if climate and climate["temperature_avg_c"] is not None else 24
    rainfall = float(climate["rainfall_mm"]) if climate and climate["rainfall_mm"] is not None else 35
    soil_moisture = round(float(climate["soil_moisture_pct"])) if climate and climate["soil_moisture_pct"] is not None else 42
    humidity = max(35, min(95, round(soil_moisture + min(rainfall, 50) * 0.35)))

    market_delta = 0.0
    if len(market_rows) >= 2 and market_rows[0]["total_production"]:
        base = float(market_rows[0]["total_production"])
        current = float(market_rows[-1]["total_production"])
        market_delta = ((current - base) / base) * 100 if base else 0.0

    if market_delta > 1:
        market_status = "Yükseliş"
    elif market_delta < -1:
        market_status = "Düşüş"
    else:
        market_status = "Durağan"

    return {
        "weather": {
            "temp": f"{temp}°C",
            "condition": _condition_from_climate(temp, rainfall),
            "humidity": f"%{humidity}",
            "city": city_name,
        },
        "soilMoisture": {
            "level": f"%{soil_moisture}",
            "status": _soil_status(soil_moisture),
        },
        "marketTrend": {
            "status": market_status,
            "indicator": f"{market_delta:+.1f}%",
        },
    }


@app.get("/api/dashboard/alerts")
def get_alerts(user=Depends(require_current_user)):
    alerts = get_dashboard_alerts(user["id"])
    return [
        {
            "id": str(alert["id"]),
            "type": alert["alert_type"],
            "message": alert["message"],
            "color": "red" if alert["alert_type"] == "danger" else "yellow",
            "time": _format_relative_time(alert["created_at"]),
        }
        for alert in alerts
    ]


@app.get("/api/dashboard/history")
def get_dashboard_history(user=Depends(require_current_user)):
    plans = get_plan_history(user["id"], limit=20)
    return [
        {
            "id": str(plan["id"]),
            "name": f"{plan['season_year']} {_display_crop_name(plan['selected_crop_name'])} Ekimi" if plan.get("selected_crop_name") else f"{plan['season_year']} Üretim Planı",
            "targetYield": f"%{int(round(float(plan['target_yield_percent'] or 0)))}" if plan.get("target_yield_percent") is not None else "—",
            "status": _display_status(plan["status"]),
            "date": _format_date(plan["created_at"]),
            "field": plan.get("field_name") or plan.get("city"),
        }
        for plan in plans
    ]


@app.get("/api/plans/options")
def get_plan_options(city: str | None = None, user=Depends(require_current_user)):
    city_name = city or user.get("city") or "Manisa"
    fields = get_fields_for_user(user["id"])
    crop_options = get_city_crop_options(city_name, limit=None)
    return {
        "seasonYear": date.today().year,
        "defaultCity": city_name,
        "fields": [_serialize_field(field) for field in fields],
        "cropOptions": [_serialize_crop_option(option) for option in crop_options],
    }


@app.get("/api/plans")
def list_plans(user=Depends(require_current_user)):
    plans = get_production_plans_for_user(user["id"])
    return [_serialize_plan(plan) for plan in plans]


@app.get("/api/plans/{plan_id}")
def get_plan(plan_id: str, user=Depends(require_current_user)):
    plan = get_production_plan_for_user(user["id"], plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan bulunamadı.")
    return {"plan": _serialize_plan(plan)}


@app.post("/api/plans")
def create_plan(request: PlanUpsertRequest, user=Depends(require_current_user)):
    plan = create_production_plan(user["id"], _normalize_plan_payload(request, user))
    return {
        "success": True,
        "plan": _serialize_plan(plan),
    }


@app.put("/api/plans/{plan_id}")
def update_plan(plan_id: str, request: PlanUpsertRequest, user=Depends(require_current_user)):
    existing_plan = get_production_plan_for_user(user["id"], plan_id)
    if not existing_plan:
        raise HTTPException(status_code=404, detail="Plan bulunamadı.")

    updated_plan = update_production_plan(user["id"], plan_id, _normalize_plan_payload(request, user, existing_plan=existing_plan))
    return {
        "success": True,
        "plan": _serialize_plan(updated_plan),
    }


@app.post("/api/ai/analyze-plan")
def analyze_plan(request: AIAnalysisRequest, user=Depends(require_current_user)):
    plan = None
    city_name = (request.region or user.get("city") or "Manisa").strip()
    selected_crop = (request.crop or "").strip()
    planned_area = float(request.size or 0)

    if request.planId:
        plan = get_production_plan_for_user(user["id"], request.planId)
        if not plan:
            raise HTTPException(status_code=404, detail="Analiz için plan bulunamadı.")

        cached_analysis = get_latest_ai_analysis_for_plan(user["id"], request.planId)
        if _analysis_is_current(plan, cached_analysis):
            cached_recommendations = get_ai_recommendations_for_analysis(cached_analysis["id"])
            focus_crop = cached_analysis.get("focus_crop_name") or cached_analysis.get("selected_crop_name")
            trend_rows = get_product_supply_demand_series(focus_crop, history_limit=5, forecast_limit=3)
            return _serialize_analysis_response(cached_analysis, cached_recommendations, trend_rows)

        city_name = (plan.get("city") or plan.get("field_city") or user.get("city") or "Manisa").strip()
        selected_crop = (plan.get("selected_crop_name") or "").strip()
        planned_area = float(plan.get("planned_area_decare") or 0)

    forecast_year = get_latest_forecast_year(reference_year=plan.get("season_year") if plan else date.today().year)
    if forecast_year is None:
        raise HTTPException(status_code=404, detail="Analiz için model tahmini bulunamadı.")

    all_candidates = get_candidate_forecasts(city_name, forecast_year, limit=100)
    if not all_candidates:
        all_candidates = get_candidate_forecasts(None, forecast_year, limit=100)
    if not all_candidates:
        raise HTTPException(status_code=404, detail="Analiz için yeterli model tahmini bulunamadı.")

    selected_key = _comparison_key(selected_crop)
    candidate_pool = list(all_candidates[:12])
    if selected_key and not any(_comparison_key(item["product_name"]) == selected_key for item in candidate_pool):
        selected_row = next((item for item in all_candidates if _comparison_key(item["product_name"]) == selected_key), None)
        if selected_row:
            candidate_pool.append(selected_row)

    if not selected_crop:
        selected_crop = candidate_pool[0]["product_name"]
        selected_key = _comparison_key(selected_crop)

    climate_rows = list(reversed(get_climate_series(city_name, limit=12)))
    latest_temp = mean([_safe_float(row.get("temperature_avg_c"), 0) or 0 for row in climate_rows]) if climate_rows else 0
    latest_rainfall = mean([_safe_float(row.get("rainfall_mm"), 0) or 0 for row in climate_rows]) if climate_rows else 0
    latest_soil = mean([_safe_float(row.get("soil_moisture_pct"), 0) or 0 for row in climate_rows]) if climate_rows else 0
    risk = _risk_payload(latest_temp, latest_rainfall, latest_soil)

    raw_items = []
    for item in candidate_pool:
        history_rows = get_crop_history_rows(city_name, item["product_name"], years=5)
        if not history_rows:
            history_rows = get_crop_history_rows(None, item["product_name"], years=5)

        history = _history_summary(history_rows)
        expected_yield = history.get("avg_yield") or _safe_float(item.get("latest_yield_kg_decare"), None)
        latest_production = history.get("latest_production") or _safe_float(item.get("latest_production_ton"), None)
        predicted_production = _safe_float(item.get("predicted_production_ton"), 0) or 0
        estimated_production = ((expected_yield or 0) * planned_area / 1000) if planned_area and expected_yield else None
        projected_growth = ((predicted_production - latest_production) / latest_production) * 100 if latest_production else None
        yield_context = get_product_yield_context(city_name, item["product_name"], years=5)
        supply_demand = _build_supply_demand_payload(get_product_supply_demand_projection(item["product_name"], forecast_year))

        raw_items.append(
            {
                "product_name": item["product_name"],
                "forecast_year": item.get("forecast_year") or forecast_year,
                "predicted_production_ton": predicted_production,
                "expected_yield_kg_decare": expected_yield,
                "estimated_production_ton": estimated_production,
                "latest_production_ton": latest_production,
                "history_years": history.get("history_years"),
                "stability_score": history.get("stability_score") or 55,
                "projected_growth_percent": projected_growth,
                "latest_year": item.get("latest_year"),
                "yield_context": yield_context,
                "supply_demand": supply_demand,
            }
        )

    forecast_values = [item["predicted_production_ton"] for item in raw_items if item["predicted_production_ton"] is not None]
    forecast_min, forecast_max = (min(forecast_values), max(forecast_values)) if forecast_values else (None, None)
    climate_base = 100 - risk["score"]
    score_profile = get_scoring_profile()
    score_weights = score_profile["weights"]
    score_weight_percents = score_profile["weightPercents"]

    scored_items = []
    for item in raw_items:
        yield_score = _yield_score_from_context(item.get("yield_context"), item.get("expected_yield_kg_decare") is not None)
        forecast_score = round(_normalize_range(item["predicted_production_ton"], forecast_min, forecast_max, default=55), 1)
        demand_score = round(_safe_float((item.get("supply_demand") or {}).get("score"), 50) or 50, 1)
        climate_score = round(_clamp((climate_base * 0.6) + ((item["stability_score"] or 55) * 0.4), 20, 95), 1)
        total_score = compute_weighted_score({"yield": yield_score, "forecast": forecast_score, "demand": demand_score, "climate": climate_score}, score_weights)

        yield_context = item.get("yield_context") or {}
        supply_demand = item.get("supply_demand") or {}
        reason_parts = []
        if item.get("expected_yield_kg_decare") is not None:
            if yield_context.get("relative_index_pct") is not None:
                reason_parts.append(
                    f"{city_name} verimi Türkiye ortalamasının %{yield_context['relative_index_pct']:.1f} seviyesinde"
                )
            else:
                reason_parts.append(
                    f"{city_name} için geçmiş ortalama verim {item['expected_yield_kg_decare']:.1f} kg/dekar"
                )
        reason_parts.append(f"{forecast_year} model projeksiyonu {item['predicted_production_ton']:,.0f} ton seviyesinde")
        if supply_demand.get("status") and supply_demand.get("status") != "Veri sınırlı":
            reason_parts.append(f"Türkiye arz-talep görünümü {supply_demand['status'].lower()} seviyesinde")

        item.update(
            {
                "yield_score": round(yield_score, 1),
                "forecast_score": forecast_score,
                "demand_score": demand_score,
                "climate_score": climate_score,
                "total_score": total_score,
                "reason": ". ".join(reason_parts) + ".",
            }
        )
        scored_items.append(item)

    scored_items.sort(key=lambda row: (row["total_score"], row["predicted_production_ton"], row["expected_yield_kg_decare"] or 0), reverse=True)
    selected_item = next((item for item in scored_items if _comparison_key(item["product_name"]) == selected_key), None) or scored_items[0]
    focus_crop = selected_item["product_name"]
    selected_key = _comparison_key(focus_crop)

    latest_actual_year = _safe_int(selected_item.get("latest_year"), None) or _latest_history_year(city_name, focus_crop) or _latest_history_year(None, focus_crop)
    horizon = int(_clamp(float((forecast_year - latest_actual_year) if latest_actual_year else 1), 1, 3))
    confidence = _build_confidence_payload(city_name, focus_crop, horizon)
    selected_supply_demand = selected_item.get("supply_demand") or _build_supply_demand_payload(None)

    alternatives = [item for item in scored_items if _comparison_key(item["product_name"]) != selected_key][:3]
    score_breakdown = [
        {"key": "yield", "label": _score_breakdown_label("yield"), "value": selected_item["yield_score"], "weight": score_weight_percents["yield"]},
        {"key": "forecast", "label": _score_breakdown_label("forecast"), "value": selected_item["forecast_score"], "weight": score_weight_percents["forecast"]},
        {"key": "demand", "label": _score_breakdown_label("demand"), "value": selected_item["demand_score"], "weight": score_weight_percents["demand"]},
        {"key": "climate", "label": _score_breakdown_label("climate"), "value": selected_item["climate_score"], "weight": score_weight_percents["climate"]},
    ]

    summary = (
        f"{focus_crop}, {city_name} için {forecast_year} projeksiyonunda %{int(round(selected_item['total_score']))} plan uygunluk skoru aldı. "
        f"Seçilen {planned_area:.0f} dönüm alanda yaklaşık {selected_item['estimated_production_ton']:.1f} ton üretim potansiyeli öngörülüyor."
        if selected_item.get("estimated_production_ton") is not None
        else f"{focus_crop}, {city_name} için {forecast_year} projeksiyonunda %{int(round(selected_item['total_score']))} plan uygunluk skoru aldı."
    )
    climate_comment = (
        f"Son 12 aylık iklim görünümünde ortalama sıcaklık {latest_temp:.1f}°C, yağış {latest_rainfall:.1f} mm ve toprak nemi %{latest_soil:.1f}. "
        f"Bu desen şehir için {risk['level'].lower()} risk profiline işaret ediyor."
    )
    market_comment = f"{selected_supply_demand.get('summary', '')} {selected_supply_demand.get('note', '')}".strip()

    trend_rows = get_product_supply_demand_series(focus_crop, history_limit=5, forecast_limit=3)

    analysis_payload = {
        "id": "preview",
        "plan_id": plan["id"] if plan else None,
        "field_id": plan.get("field_id") if plan else None,
        "field_name": plan.get("field_name") if plan else None,
        "field_city": plan.get("field_city") if plan else None,
        "field_district": plan.get("field_district") if plan else None,
        "plan_status": "Analiz Hazır",
        "season_year": plan.get("season_year") if plan else date.today().year,
        "score": selected_item["total_score"],
        "confidence_score": confidence["score"],
        "summary": summary,
        "climate_comment": climate_comment,
        "market_comment": market_comment,
        "model_name": confidence.get("modelName") or "Dengeli_XGBoost_DirectHorizon",
        "selected_crop_name": focus_crop,
        "focus_crop_name": focus_crop,
        "city": city_name,
        "district": plan.get("district") if plan else user.get("district"),
        "forecast_year": forecast_year,
        "planned_area_decare": planned_area,
        "expected_yield_kg_decare": selected_item.get("expected_yield_kg_decare"),
        "expected_production_ton": selected_item.get("estimated_production_ton"),
        "score_breakdown": score_breakdown,
        "analyzed_at": datetime.now(),
    }

    recommendation_payload = []
    for index, item in enumerate(alternatives, start=1):
        recommendation_payload.append(
            {
                "rank_order": index,
                "crop_name": item["product_name"],
                "expected_return_percent": round(item["projected_growth_percent"], 2) if item.get("projected_growth_percent") is not None else None,
                "recommendation_score": item["total_score"],
                "forecast_year": item["forecast_year"],
                "predicted_production_ton": item["predicted_production_ton"],
                "expected_yield_kg_decare": item.get("expected_yield_kg_decare"),
                "expected_production_ton": item.get("estimated_production_ton"),
                "reason": (
                    f"{city_name} için geçmiş verim, iklim dayanıklılığı ve {forecast_year} model projeksiyonu birlikte değerlendirildiğinde güçlü bir alternatif görünüyor."
                ),
            }
        )

    if plan:
        analysis_id = create_ai_analysis(str(plan["id"]), {
            "score": selected_item["total_score"],
            "confidence_score": confidence["score"],
            "summary": summary,
            "climate_comment": climate_comment,
            "market_comment": market_comment,
            "model_name": confidence.get("modelName") or "Dengeli_XGBoost_DirectHorizon",
            "selected_crop_name": focus_crop,
            "focus_crop_name": focus_crop,
            "city": city_name,
            "district": plan.get("district") or user.get("district"),
            "forecast_year": forecast_year,
            "planned_area_decare": planned_area,
            "expected_yield_kg_decare": selected_item.get("expected_yield_kg_decare"),
            "expected_production_ton": selected_item.get("estimated_production_ton"),
            "score_breakdown": score_breakdown,
        }, recommendation_payload)
        update_plan_analysis_result(user["id"], str(plan["id"]), selected_item["total_score"], status="Analiz Hazır")
        saved_analysis = get_ai_analysis_for_user(user["id"], analysis_id)
        saved_recommendations = get_ai_recommendations_for_analysis(analysis_id)
        return _serialize_analysis_response(saved_analysis, saved_recommendations, trend_rows)

    analysis_payload["id"] = "preview"
    return _serialize_analysis_response(analysis_payload, [
        {
            "id": f"preview-{index}",
            "rank_order": item["rank_order"],
            "crop_name": item["crop_name"],
            "expected_return_percent": item["expected_return_percent"],
            "recommendation_score": item["recommendation_score"],
            "forecast_year": item["forecast_year"],
            "predicted_production_ton": item["predicted_production_ton"],
            "expected_yield_kg_decare": item["expected_yield_kg_decare"],
            "expected_production_ton": item["expected_production_ton"],
            "reason": item["reason"],
        }
        for index, item in enumerate(recommendation_payload, start=1)
    ], trend_rows)

@app.get("/api/analyses")
def list_saved_analyses(user=Depends(require_current_user)):
    analyses = list_ai_analyses_for_user(user["id"], limit=50)
    return {
        "reports": [_serialize_analysis_report(analysis) for analysis in analyses],
        "count": len(analyses),
    }


@app.get("/api/analyses/{analysis_id}")
def get_saved_analysis(analysis_id: str, user=Depends(require_current_user)):
    analysis = get_ai_analysis_for_user(user["id"], analysis_id)
    if not analysis:
        raise HTTPException(status_code=404, detail="Analiz raporu bulunamadı.")

    recommendations = get_ai_recommendations_for_analysis(analysis_id)
    focus_crop = analysis.get("focus_crop_name") or analysis.get("selected_crop_name")
    trend_rows = get_product_supply_demand_series(focus_crop, history_limit=5, forecast_limit=3)
    return _serialize_analysis_response(analysis, recommendations, trend_rows)


@app.get("/api/regional-analysis")
def get_regional_analysis(city: str | None = None, historyRange: str = "5Y", user=Depends(require_current_user)):
    city_name = _dashboard_city(user, city)
    climate = get_latest_climate(city_name)
    climate_rows = list(reversed(get_climate_series(city_name, limit=12)))
    production_overview = get_city_production_overview(city_name)
    history_range = (historyRange or "5Y").upper()
    trend_limit = {"5Y": 5, "10Y": 10, "ALL": None}.get(history_range, 5)
    production_trend = get_city_production_trend(city_name, limit=trend_limit)
    top_crops = get_city_crop_options(city_name, limit=4)
    recommended_crops = get_ai_recommendations(city_name, limit=3) or get_ai_recommendations(None, limit=3)

    if not climate and not production_overview:
        raise HTTPException(status_code=404, detail="Şehir için analiz verisi bulunamadı.")

    latest_temp = float(climate["temperature_avg_c"]) if climate and climate.get("temperature_avg_c") is not None else 0.0
    latest_rainfall = float(climate["rainfall_mm"]) if climate and climate.get("rainfall_mm") is not None else 0.0
    latest_soil = float(climate["soil_moisture_pct"]) if climate and climate.get("soil_moisture_pct") is not None else 0.0
    humidity = max(35, min(95, round(latest_soil + min(latest_rainfall, 60) * 0.35)))

    avg_temp = sum(float(row["temperature_avg_c"] or 0) for row in climate_rows) / len(climate_rows) if climate_rows else latest_temp
    avg_rainfall = sum(float(row["rainfall_mm"] or 0) for row in climate_rows) / len(climate_rows) if climate_rows else latest_rainfall
    avg_soil = sum(float(row["soil_moisture_pct"] or 0) for row in climate_rows) / len(climate_rows) if climate_rows else latest_soil
    risk = _risk_payload(avg_temp, avg_rainfall, avg_soil)

    return {
        "city": city_name,
        "latestObservationDate": climate["observation_date"].isoformat() if climate else None,
        "climate": {
            "temperature": round(latest_temp, 1),
            "rainfall": round(latest_rainfall, 1),
            "soilMoisture": round(latest_soil, 1),
            "humidity": humidity,
            "condition": _condition_from_climate(latest_temp, latest_rainfall),
        },
        "risk": {
            "score": risk["score"],
            "level": risk["level"],
            "summary": (
                f"Son 12 aylık iklim görünümünde ortalama sıcaklık {avg_temp:.1f}°C ve yağış {avg_rainfall:.1f} mm seviyesinde. "
                f"Bu desen şehir için {risk['level'].lower()} risk profiline işaret ediyor."
            ),
        },
        "production": {
            "latestYear": production_overview.get("latest_year") if production_overview else None,
            "totalProductionTon": round(float(production_overview["total_production_ton"])) if production_overview and production_overview.get("total_production_ton") is not None else None,
            "averageYieldKgDecare": round(float(production_overview["average_yield_kg_decare"]), 1) if production_overview and production_overview.get("average_yield_kg_decare") is not None else None,
            "totalAreaDecare": round(float(production_overview["total_area_decare"])) if production_overview and production_overview.get("total_area_decare") is not None else None,
        },
        "topCrops": [
            {
                "name": item["product_name"],
                "latestProductionTon": round(float(item["production_ton"])) if item.get("production_ton") is not None else None,
                "latestYieldKgDecare": round(float(item["yield_kg_decare"]), 1) if item.get("yield_kg_decare") is not None else None,
                "latestYear": item.get("latest_year"),
            }
            for item in top_crops
        ],
        "recommendedCrops": [
            {
                "name": item["product_name"],
                "forecastYear": item.get("forecast_year"),
                "predictedProductionTon": round(float(item["predicted_production_ton"])) if item.get("predicted_production_ton") is not None else None,
                "reason": f"{city_name} için {item.get('forecast_year')} projeksiyonunda yüksek üretim potansiyeli gösteriyor.",
            }
            for item in recommended_crops
        ],
        "climateSeries": [
            {
                "label": f"{MONTH_LABELS[row['observation_date'].month - 1]} {row['observation_date'].year}",
                "temperature": round(float(row["temperature_avg_c"] or 0), 1),
                "rainfall": round(float(row["rainfall_mm"] or 0), 1),
                "soilMoisture": round(float(row["soil_moisture_pct"] or 0), 1),
            }
            for row in climate_rows
        ],
        "productionSeries": [
            {
                "year": str(row["year"]),
                "totalProductionTon": round(float(row["total_production_ton"])) if row.get("total_production_ton") is not None else None,
                "averageYieldKgDecare": round(float(row["average_yield_kg_decare"]), 1) if row.get("average_yield_kg_decare") is not None else None,
            }
            for row in production_trend
        ],
    }


@app.get("/api/climate/data")
def get_climate_data(period: str = "1Y", city: str | None = None, user=Depends(require_current_user)):
    city_name = _dashboard_city(user, city)
    limit_map = {"6M": 6, "1Y": 12, "5Y": 60}
    rows = list(reversed(get_climate_series(city_name, limit=limit_map.get(period, 12))))

    series = []
    for row in rows:
        temperature = float(row["temperature_avg_c"] or 0)
        rainfall = float(row["rainfall_mm"] or 0)
        soil = float(row["soil_moisture_pct"] or 0)
        drought_risk = max(5, min(95, round((temperature * 3) - (rainfall * 0.25) - (soil * 0.1) + 20)))
        observation_date = row["observation_date"]
        series.append(
            {
                "label": f"{MONTH_LABELS[observation_date.month - 1]} {observation_date.year}",
                "month": MONTH_LABELS[observation_date.month - 1],
                "rainfall": round(rainfall),
                "temperature": round(temperature),
                "soilMoisture": round(soil),
                "droughtRisk": drought_risk,
            }
        )

    rainfall_values = [item["rainfall"] for item in series]
    temperature_values = [item["temperature"] for item in series]
    avg_temp = sum(temperature_values) / len(temperature_values) if temperature_values else 0
    avg_rainfall = sum(rainfall_values) / len(rainfall_values) if rainfall_values else 0
    risk_comment = "yüksek" if avg_temp > 22 and avg_rainfall < 45 else "orta"

    return {
        "period": period,
        "city": city_name,
        "rainfall": rainfall_values,
        "temperature": temperature_values,
        "ai_comment": f"{city_name} için son {period} dönemi verilerine göre sıcaklık ortalaması {avg_temp:.1f}°C, yağış ortalaması {avg_rainfall:.1f} mm seviyesinde. Bu desen {risk_comment} kuraklık riski işaret ediyor.",
        "series": series,
    }


@app.get("/api/profile/me")
def get_profile_me(user=Depends(require_current_user)):
    return _build_profile_response(user)


@app.put("/api/profile/me")
def update_profile(request: ProfileUpdateRequest, user=Depends(require_current_user)):
    updated_user = update_user_profile(user["id"], _normalize_profile_payload(request))
    return {
        "success": True,
        "user": _serialize_profile_user(updated_user),
    }


@app.get("/api/fields")
def list_fields(user=Depends(require_current_user)):
    fields = get_fields_for_user(user["id"])
    return [_serialize_field(field) for field in fields]


@app.post("/api/fields")
def create_user_field(request: FieldUpsertRequest, user=Depends(require_current_user)):
    field = create_field(user["id"], _normalize_field_payload(request, user))
    return {
        "success": True,
        "field": _serialize_field(field),
    }


@app.put("/api/fields/{field_id}")
def update_user_field(field_id: str, request: FieldUpsertRequest, user=Depends(require_current_user)):
    existing = get_field_for_user(user["id"], field_id)
    if not existing:
        raise HTTPException(status_code=404, detail="Tarla bulunamadı.")

    field = update_field(user["id"], field_id, _normalize_field_payload(request, user))
    return {
        "success": True,
        "field": _serialize_field(field),
    }


@app.delete("/api/fields/{field_id}")
def delete_user_field(field_id: str, user=Depends(require_current_user)):
    deleted = delete_field(user["id"], field_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Tarla bulunamadı.")
    return {"success": True}
