from contextlib import asynccontextmanager
from datetime import date, datetime

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict

from db import bootstrap_database
from db.repositories import (
    create_field,
    create_production_plan,
    create_user_session,
    delete_field,
    get_ai_recommendations,
    get_city_crop_options,
    get_city_production_overview,
    get_city_production_trend,
    get_climate_series,
    get_crop_projection_series,
    get_dashboard_alerts,
    get_field_for_user,
    get_fields_for_user,
    get_latest_climate,
    get_market_projection,
    get_plan_history,
    get_production_plan_for_user,
    get_production_plans_for_user,
    get_user_by_identifier,
    revoke_user_session,
    update_field,
    update_production_plan,
    update_user_profile,
)
from dependencies import require_current_user, security
from security import generate_session_token, hash_session_token, verify_password


TURKISH_ASCII_TRANSLATION = str.maketrans({"ç": "c", "Ç": "C", "ğ": "g", "Ğ": "G", "ı": "i", "İ": "I", "ö": "o", "Ö": "O", "ş": "s", "Ş": "S", "ü": "u", "Ü": "U"})

STATUS_LABELS = {"Taslak": "Taslak", "draft": "Taslak", "Analiz Hazır": "Analiz Hazır", "Analiz Hazir": "Analiz Hazır", "Hasat Bekliyor": "Hasat Bekliyor", "Tamamlandı": "Tamamlandı", "Tamamlandi": "Tamamlandı"}

CROP_LABELS = {
    "wheat": "Buğday",
    "Bugday": "Buğday",
    "sunflower": "Ayçiçeği",
    "Aycicegi": "Ayçiçeği",
    "cotton": "Pamuk",
    "corn": "Mısır",
    "Misir": "Mısır",
    "sugar_beet": "Şeker Pancarı",
    "olive": "Zeytin",
    "hazelnut": "Fındık",
    "grape": "Üzüm",
    "apple": "Elma",
}
MONTH_LABELS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"]


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
        "status": "Analiz Hazır",
        "target_yield_percent": None,
        "planned_area_decare": planned_area,
        "planned_sowing_date": None,
        "planned_harvest_date": None,
        "city": city,
        "district": (payload.district or (field or {}).get("district") or user.get("district") or "").strip() or None,
    }


def _build_profile_response(user: dict) -> dict:
    fields = get_fields_for_user(user["id"])
    plans = get_plan_history(user["id"], limit=20)
    return {
        "user": _serialize_profile_user(user),
        "fields": [_serialize_field(field) for field in fields],
        "reports": [
            {
                "id": str(plan["id"]),
                "date": _format_date(plan["created_at"]),
                "field": plan.get("field_name") or plan.get("city") or "Kayıtlı Plan",
                "type": f"{_display_crop_name(plan['selected_crop_name'])} Üretim Planı" if plan.get("selected_crop_name") else "Üretim Planı",
                "status": _display_status(plan["status"]),
            }
            for plan in plans
        ],
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
    city_name = request.region or user.get("city") or "Manisa"
    selected_crop = _display_crop_name(request.crop) if request.crop else ""
    planned_area = request.size or 0

    if request.planId:
        plan = get_production_plan_for_user(user["id"], request.planId)
        if not plan:
            raise HTTPException(status_code=404, detail="Analiz için plan bulunamadı.")
        city_name = plan.get("city") or plan.get("field_city") or user.get("city") or "Manisa"
        selected_crop = plan.get("selected_crop_name") or ""
        planned_area = float(plan.get("planned_area_decare") or 0)

    recommendations = get_ai_recommendations(city_name, limit=6) or get_ai_recommendations(None, limit=6)
    if not recommendations:
        raise HTTPException(status_code=404, detail="Analiz için yeterli model tahmini bulunamadı.")

    selected_key = _comparison_key(selected_crop)
    filtered = [item for item in recommendations if _comparison_key(item["product_name"]) != selected_key] if selected_key else recommendations
    final_recommendations = (filtered or recommendations)[:3]
    predicted_values = [float(item["predicted_production_ton"]) for item in final_recommendations] or [1.0]
    top_value = max(predicted_values)
    min_value = min(predicted_values)

    selected_rank = next(
        (
            index
            for index, item in enumerate(recommendations, start=1)
            if _comparison_key(item["product_name"]) == selected_key
        ),
        None,
    )
    if selected_rank == 1:
        score = 92
    elif selected_rank == 2:
        score = 87
    elif selected_rank == 3:
        score = 83
    elif selected_key:
        score = 78
    else:
        score = 85

    response_items = []
    for index, item in enumerate(final_recommendations, start=1):
        production_value = float(item["predicted_production_ton"])
        normalized = 0 if top_value == min_value else (production_value - min_value) / (top_value - min_value)
        expected_return = 8 + round(normalized * 12)
        response_items.append(
            {
                "id": index,
                "crop": item["product_name"],
                "forecastYear": item.get("forecast_year"),
                "expectedReturn": f"%{expected_return}",
                "reason": (
                    f"{city_name} için {item.get('forecast_year')} model tahminlerinde yüksek üretim potansiyeli gösteriyor. "
                    f"Yaklaşık {production_value:,.0f} tonluk üretim projeksiyonu sayesinde güçlü bir alternatif olarak öne çıkıyor."
                ),
            }
        )

    focus_crop = selected_crop or (final_recommendations[0]["product_name"] if final_recommendations else "")
    trend_rows = get_crop_projection_series(city_name, focus_crop, history_limit=5, forecast_limit=3)
    if not trend_rows and focus_crop:
        trend_rows = get_crop_projection_series(None, focus_crop, history_limit=5, forecast_limit=3)

    plan_summary = _serialize_plan(plan) if plan else {
        "id": None,
        "fieldId": None,
        "fieldName": None,
        "city": city_name,
        "district": user.get("district"),
        "selectedCropName": selected_crop or None,
        "plannedAreaDecare": float(planned_area or 0),
        "seasonYear": date.today().year,
        "status": "Analiz Hazır",
        "targetYieldPercent": None,
        "createdAt": None,
        "updatedAt": None,
    }

    return {
        "success": True,
        "score": score,
        "focusCrop": focus_crop,
        "plan": plan_summary,
        "recommendations": response_items,
        "trendSeries": [
            {
                "year": str(row["year"]),
                "historicalProduction": round(float(row["historical_production_ton"]), 1) if row.get("historical_production_ton") is not None else None,
                "predictedProduction": round(float(row["predicted_production_ton"]), 1) if row.get("predicted_production_ton") is not None else None,
            }
            for row in trend_rows
        ],
    }

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
