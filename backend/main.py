import json
from contextlib import asynccontextmanager
from datetime import date, datetime
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
    get_walk_forward_summary,
    list_ai_analyses_for_user,
    revoke_user_session,
    update_field,
    update_plan_analysis_result,
    update_production_plan,
    update_user_profile,
)
from dependencies import require_current_user, security
from security import generate_session_token, hash_session_token, verify_password


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



def _normalize_range(value: float | None, minimum: float | None, maximum: float | None, default: float = 50.0) -> float:
    if value is None or minimum is None or maximum is None:
        return default
    if maximum <= minimum:
        return default
    return _clamp(((value - minimum) / (maximum - minimum)) * 100, 0, 100)



def _parse_score_breakdown(value) -> list[dict[str, object]]:
    if not value:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
        except json.JSONDecodeError:
            return []
        return parsed if isinstance(parsed, list) else []
    return []



def _confidence_label(score: float) -> str:
    if score >= 82:
        return "Yüksek"
    if score >= 65:
        return "Dengeli"
    return "Temkinli"



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


def _build_confidence_payload(metric_row: dict | None) -> dict[str, object]:
    if not metric_row:
        score = 64.0
        return {
            "score": score,
            "label": _confidence_label(score),
            "summary": "Model güven skoru genel varsayım ile oluşturuldu; alan bazlı ek metrik bulunmadı.",
            "modelName": None,
            "modelVersion": None,
        }

    smape = _safe_float(metric_row.get("avg_smape_pct"), 30.0) or 30.0
    wape = _safe_float(metric_row.get("avg_wape_pct"), 25.0) or 25.0
    confidence_score = round(_clamp(100 - (smape * 1.1) - (wape * 0.35), 38, 95), 1)
    label = _confidence_label(confidence_score)
    return {
        "score": confidence_score,
        "label": label,
        "summary": (
            f"Walk-forward doğrulamasında ortalama SMAPE %{smape:.1f} ve WAPE %{wape:.1f} seviyesinde. "
            f"Bu nedenle model güven seviyesi {label.lower()} olarak değerlendirildi."
        ),
        "modelName": metric_row.get("model_name"),
        "modelVersion": metric_row.get("model_version"),
    }


def _serialize_analysis_report(analysis: dict) -> dict[str, object]:
    score = _safe_float(analysis.get("score"), 0) or 0
    confidence_score = _safe_float(analysis.get("confidence_score"), 0) or 0
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
        "confidenceLabel": _confidence_label(confidence_score) if confidence_score else None,
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
        "expectedReturn": f"{expected_return:+.1f}%" if expected_return is not None else "—",
        "expectedYieldKgDecare": round(_safe_float(item.get("expected_yield_kg_decare"), 0) or 0, 1) if item.get("expected_yield_kg_decare") is not None else None,
        "estimatedProductionTon": round(_safe_float(item.get("expected_production_ton"), 0) or 0, 1) if item.get("expected_production_ton") is not None else None,
        "predictedProductionTon": round(_safe_float(item.get("predicted_production_ton"), 0) or 0, 1) if item.get("predicted_production_ton") is not None else None,
        "reason": item.get("reason"),
    }



def _serialize_analysis_response(analysis: dict, recommendations: list[dict], trend_rows: list[dict] | None = None) -> dict[str, object]:
    selected_crop_name = analysis.get("selected_crop_name") or analysis.get("focus_crop_name")
    confidence_score = _safe_float(analysis.get("confidence_score"), 0) or 0
    score = _safe_float(analysis.get("score"), 0) or 0

    return {
        "success": True,
        "analysisId": str(analysis["id"]),
        "analyzedAt": analysis.get("analyzed_at").isoformat() if analysis.get("analyzed_at") else None,
        "score": round(score, 1),
        "confidence": {
            "score": round(confidence_score, 1),
            "label": _confidence_label(confidence_score),
        },
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
        },
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
                "predictedProduction": round(_safe_float(row.get("predicted_production_ton"), 0) or 0, 1) if row.get("predicted_production_ton") is not None else None,
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
    return analyzed_at >= updated_at


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
    crop_options = get_city_crop_options(city_name, limit=8)
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
            trend_rows = get_crop_projection_series(cached_analysis.get("city"), focus_crop, history_limit=5, forecast_limit=3)
            if not trend_rows and focus_crop:
                trend_rows = get_crop_projection_series(None, focus_crop, history_limit=5, forecast_limit=3)
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

    latest_actual_year = max((item.get("latest_year") or 0) for item in candidate_pool)
    horizon = int(_clamp((forecast_year - latest_actual_year) if latest_actual_year else 1, 1, 3))
    confidence = _build_confidence_payload(get_walk_forward_summary(horizon=horizon))
    demand_map = get_consumption_projection_map([item["product_name"] for item in candidate_pool], forecast_year)

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
        demand_value = _safe_float((demand_map.get(item["product_name"]) or {}).get("consumption_value"), None)
        projected_growth = ((predicted_production - latest_production) / latest_production) * 100 if latest_production else None

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
                "demand_value": demand_value,
                "projected_growth_percent": projected_growth,
            }
        )

    yield_values = [item["expected_yield_kg_decare"] for item in raw_items if item["expected_yield_kg_decare"] is not None]
    forecast_values = [item["predicted_production_ton"] for item in raw_items if item["predicted_production_ton"] is not None]
    demand_values = [item["demand_value"] for item in raw_items if item["demand_value"] is not None]
    yield_min, yield_max = (min(yield_values), max(yield_values)) if yield_values else (None, None)
    forecast_min, forecast_max = (min(forecast_values), max(forecast_values)) if forecast_values else (None, None)
    demand_min, demand_max = (min(demand_values), max(demand_values)) if demand_values else (None, None)
    climate_base = 100 - risk["score"]

    scored_items = []
    for item in raw_items:
        yield_score = round(_normalize_range(item["expected_yield_kg_decare"], yield_min, yield_max, default=55), 1)
        forecast_score = round(_normalize_range(item["predicted_production_ton"], forecast_min, forecast_max, default=55), 1)
        demand_score = round(_normalize_range(item["demand_value"], demand_min, demand_max, default=50), 1)
        climate_score = round(_clamp((climate_base * 0.6) + ((item["stability_score"] or 55) * 0.4), 20, 95), 1)
        total_score = round((yield_score * 0.32) + (forecast_score * 0.33) + (demand_score * 0.17) + (climate_score * 0.18), 1)

        item.update(
            {
                "yield_score": yield_score,
                "forecast_score": forecast_score,
                "demand_score": demand_score,
                "climate_score": climate_score,
                "total_score": total_score,
                "reason": (
                    f"{city_name} için geçmiş ortalama verim {item['expected_yield_kg_decare']:.1f} kg/dekar, "
                    f"{forecast_year} model projeksiyonu {item['predicted_production_ton']:,.0f} ton seviyesinde."
                    if item["expected_yield_kg_decare"] is not None
                    else f"{city_name} için {forecast_year} model projeksiyonu {item['predicted_production_ton']:,.0f} ton seviyesinde."
                ),
            }
        )
        scored_items.append(item)

    scored_items.sort(key=lambda row: (row["total_score"], row["predicted_production_ton"], row["expected_yield_kg_decare"] or 0), reverse=True)
    selected_item = next((item for item in scored_items if _comparison_key(item["product_name"]) == selected_key), None) or scored_items[0]
    focus_crop = selected_item["product_name"]
    selected_key = _comparison_key(focus_crop)

    alternatives = [item for item in scored_items if _comparison_key(item["product_name"]) != selected_key][:3]
    score_breakdown = [
        {"key": "yield", "label": "Geçmiş verim", "value": selected_item["yield_score"], "weight": 32},
        {"key": "forecast", "label": "Model projeksiyonu", "value": selected_item["forecast_score"], "weight": 33},
        {"key": "demand", "label": "Tüketim eğilimi", "value": selected_item["demand_score"], "weight": 17},
        {"key": "climate", "label": "İklim dayanıklılığı", "value": selected_item["climate_score"], "weight": 18},
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
    market_comment = (
        f"Tüketim eğilimi ve model projeksiyonu birlikte değerlendirildiğinde {focus_crop} için güven skoru %{confidence['score']:.1f} seviyesinde. "
        f"{confidence['summary']}"
    )

    trend_rows = get_crop_projection_series(city_name, focus_crop, history_limit=5, forecast_limit=3)
    if not trend_rows and focus_crop:
        trend_rows = get_crop_projection_series(None, focus_crop, history_limit=5, forecast_limit=3)

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
    trend_rows = get_crop_projection_series(analysis.get("city"), focus_crop, history_limit=5, forecast_limit=3)
    if not trend_rows and focus_crop:
        trend_rows = get_crop_projection_series(None, focus_crop, history_limit=5, forecast_limit=3)
    return _serialize_analysis_response(analysis, recommendations, trend_rows)


@app.get("/api/regional-analysis")
def get_regional_analysis(city: str | None = None, user=Depends(require_current_user)):
    city_name = _dashboard_city(user, city)
    climate = get_latest_climate(city_name)
    climate_rows = list(reversed(get_climate_series(city_name, limit=12)))
    production_overview = get_city_production_overview(city_name)
    production_trend = get_city_production_trend(city_name, limit=6)
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
