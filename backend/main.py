from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import BaseModel, ConfigDict

from db import bootstrap_database
from db.repositories import (
    create_field,
    create_user_session,
    delete_field,
    get_ai_recommendations,
    get_climate_series,
    get_dashboard_alerts,
    get_field_for_user,
    get_fields_for_user,
    get_latest_climate,
    get_market_projection,
    get_plan_history,
    get_user_by_identifier,
    revoke_user_session,
    update_field,
    update_user_profile,
)
from dependencies import require_current_user, security
from security import generate_session_token, hash_session_token, verify_password


CROP_LABELS = {
    "wheat": "Bu?day",
    "Bugday": "Bu?day",
    "sunflower": "Ay?i?e?i",
    "Aycicegi": "Ay?i?e?i",
    "cotton": "Pamuk",
    "corn": "M?s?r",
    "Misir": "M?s?r",
    "sugar_beet": "?eker Pancar?",
    "olive": "Zeytin",
    "hazelnut": "F?nd?k",
    "grape": "?z?m",
    "apple": "Elma",
}
MONTH_LABELS = ["Oca", "?ub", "Mar", "Nis", "May", "Haz", "Tem", "A?u", "Eyl", "Eki", "Kas", "Ara"]


@asynccontextmanager
async def lifespan(app: FastAPI):
    bootstrap_database()
    yield


app = FastAPI(title="Tar?m Yapay Zeka API", lifespan=lifespan)

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


def _display_crop_name(value: str | None) -> str:
    if not value:
        return "?r?n"
    return CROP_LABELS.get(value, value)



def _condition_from_climate(temp: float, rainfall: float) -> str:
    if rainfall >= 80:
        return "Ya?murlu"
    if rainfall >= 40:
        return "Par?al? Bulutlu"
    if temp >= 24:
        return "G?ne?li"
    if temp <= 8:
        return "Serin"
    return "A??k"



def _soil_status(soil_moisture: float) -> str:
    if soil_moisture < 20:
        return "Kuru"
    if soil_moisture > 55:
        return "Islak"
    return "Optimum"



def _format_relative_time(value) -> str:
    if not value:
        return "Az ?nce"
    now = datetime.now(value.tzinfo) if getattr(value, "tzinfo", None) else datetime.now()
    delta = now - value.replace(tzinfo=now.tzinfo) if getattr(value, "tzinfo", None) and now.tzinfo else now - value.replace(tzinfo=None)
    hours = max(1, int(delta.total_seconds() // 3600))
    if hours < 24:
        return f"{hours} saat ?nce"
    days = max(1, hours // 24)
    return f"{days} g?n ?nce"



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



def _normalize_profile_payload(payload: ProfileUpdateRequest) -> dict[str, object]:
    if not payload.fullName.strip():
        raise HTTPException(status_code=400, detail="Ad soyad bo? b?rak?lamaz.")
    if not payload.phone.strip():
        raise HTTPException(status_code=400, detail="Telefon numaras? bo? b?rak?lamaz.")
    return {
        "full_name": payload.fullName.strip(),
        "phone": payload.phone.strip(),
        "email": (payload.email or "").strip() or None,
        "city": (payload.city or "").strip() or None,
        "district": (payload.district or "").strip() or None,
    }



def _normalize_field_payload(payload: FieldUpsertRequest, user: dict) -> dict[str, object]:
    if not payload.name.strip():
        raise HTTPException(status_code=400, detail="Tarla ad? bo? b?rak?lamaz.")
    if payload.areaDecare <= 0:
        raise HTTPException(status_code=400, detail="Tarla b?y?kl??? s?f?rdan b?y?k olmal?d?r.")
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
                "field": plan.get("field_name") or "Kay?tl? Tarla",
                "type": f"{_display_crop_name(plan['selected_crop_name'])} ?retim Plan?",
                "status": plan["status"],
            }
            for plan in plans
        ],
    }


@app.get("/")
def read_root():
    return {"message": "Welcome to Tar?m Yapay Zeka API"}


@app.post("/api/auth/login")
def login(request: LoginRequest):
    if not request.identifier.strip() or not request.password:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Kimlik bilgileri eksik.")

    user = get_user_by_identifier(request.identifier.strip())
    if not user or not user.get("is_active") or not verify_password(request.password, user.get("password_hash")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Ge?ersiz kimlik bilgileri.")

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
        market_status = "Y?kseli?"
    elif market_delta < -1:
        market_status = "D????"
    else:
        market_status = "Dura?an"

    return {
        "weather": {
            "temp": f"{temp}?C",
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
            "name": f"{plan['season_year']} {_display_crop_name(plan['selected_crop_name'])} Ekimi",
            "targetYield": f"%{int(round(float(plan['target_yield_percent'] or 0)))}",
            "status": plan["status"],
            "date": _format_date(plan["created_at"]),
            "field": plan.get("field_name"),
        }
        for plan in plans
    ]


@app.post("/api/ai/analyze-plan")
def analyze_plan(request: AIAnalysisRequest, user=Depends(require_current_user)):
    city_name = request.region or user.get("city") or "Manisa"
    selected_crop = _display_crop_name(request.crop)
    recommendations = get_ai_recommendations(city_name, forecast_year=2025, limit=6) or get_ai_recommendations(None, forecast_year=2025, limit=6)

    filtered = [item for item in recommendations if _display_crop_name(item["product_name"]) != selected_crop]
    final_recommendations = (filtered or recommendations)[:3]
    predicted_values = [float(item["predicted_production_ton"]) for item in final_recommendations] or [1.0]
    top_value = max(predicted_values)
    min_value = min(predicted_values)
    selected_rank = next(
        (
            index
            for index, item in enumerate(recommendations, start=1)
            if _display_crop_name(item["product_name"]) == selected_crop
        ),
        None,
    )
    if selected_rank == 1:
        score = 92
    elif selected_rank == 2:
        score = 87
    elif selected_rank == 3:
        score = 83
    elif request.crop:
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
                "crop": _display_crop_name(item["product_name"]),
                "expectedReturn": f"%{expected_return}",
                "reason": f"{city_name} i?in 2025 model tahminlerinde y?ksek ?retim potansiyeli g?steriyor. Yakla??k {production_value:,.0f} tonluk ?retim projeksiyonu sayesinde g??l? bir alternatif olarak ?ne ??k?yor.",
            }
        )

    return {
        "success": True,
        "score": score,
        "recommendations": response_items,
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
    risk_comment = "y?ksek" if avg_temp > 22 and avg_rainfall < 45 else "orta"

    return {
        "period": period,
        "city": city_name,
        "rainfall": rainfall_values,
        "temperature": temperature_values,
        "ai_comment": f"{city_name} i?in son {period} d?nemi verilerine g?re s?cakl?k ortalamas? {avg_temp:.1f}?C, ya??? ortalamas? {avg_rainfall:.1f} mm seviyesinde. Bu desen {risk_comment} kurakl?k riski i?aret ediyor.",
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
        raise HTTPException(status_code=404, detail="Tarla bulunamad?.")

    field = update_field(user["id"], field_id, _normalize_field_payload(request, user))
    return {
        "success": True,
        "field": _serialize_field(field),
    }


@app.delete("/api/fields/{field_id}")
def delete_user_field(field_id: str, user=Depends(require_current_user)):
    deleted = delete_field(user["id"], field_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Tarla bulunamad?.")
    return {"success": True}
