from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Tarım Yapay Zeka API")

# Setup CORS for the React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    identifier: str
    password: str
    rememberMe: bool

@app.get("/")
def read_root():
    return {"message": "Welcome to Tarım Yapay Zeka API"}

@app.post("/api/auth/login")
def login(request: LoginRequest):
    # Mocking a successful login
    if request.identifier and request.password:
        return {
            "success": True, 
            "token": "mock-jwt-token-7x89a",
            "user": {
                "name": "Ahmet Yılmaz",
                "role": "farmer",
                "activeBadge": True
            }
        }
    return {"success": False, "message": "Invalid credentials"}

@app.get("/api/dashboard/summary")
def get_dashboard_summary():
    return {
        "weather": {"temp": "24°C", "condition": "Güneşli", "humidity": "%65"},
        "soilMoisture": {"level": "%42", "status": "Optimum"},
        "marketTrend": {"status": "Yükseliş", "indicator": "+%5.2"}
    }
    
@app.get("/api/dashboard/alerts")
def get_alerts():
    return [
        {"id": 1, "type": "warning", "message": "Bölgenizde önümüzdeki hafta %20 kuraklık riski bekleniyor.", "color": "yellow"},
        {"id": 2, "type": "danger", "message": "Arz Uyarısı: Buğday ekiminde bölgesel doygunluğa ulaşıldı.", "color": "red"}
    ]

@app.get("/api/dashboard/history")
def get_plan_history():
    return [
        {"id": 101, "name": "2024 Buğday Ekimi", "targetYield": "%95", "status": "Hasat Bekliyor"},
        {"id": 102, "name": "2023 Ayçiçeği", "targetYield": "%88", "status": "Tamamlandı"}
    ]

class AIAnalysisRequest(BaseModel):
    region: str
    size: float
    crop: str

@app.post("/api/ai/analyze-plan")
def analyze_plan(request: AIAnalysisRequest):
    return {
        "success": True,
        "score": 85,
        "recommendations": [
            {
                "id": 1,
                "crop": "Mısır",
                "expectedReturn": "%18",
                "reason": "Bölgenizde yağışlar bu yıl %15 daha fazla bekleniyor, mısır ekimi daha kârlı olabilir."
            },
            {
                "id": 2,
                "crop": "Soya Fasulyesi",
                "expectedReturn": "%14",
                "reason": "Toprak yapınız ve güncel piyasa talebi soya fasulyesi için oldukça uygun."
            },
            {
                "id": 3,
                "crop": "Kanola",
                "expectedReturn": "%11",
                "reason": "Alternatif yağlı tohum olarak düşük su tüketimi ile avantajlı bir seçenek."
            }
        ]
    }

@app.get("/api/climate/data")
def get_climate_data(period: str = "1Y"):
    return {
        "period": period,
        "rainfall": [40, 55, 60, 80, 45, 30, 20, 15, 25, 50, 65, 55],
        "temperature": [8, 12, 15, 20, 25, 28, 30, 29, 24, 18, 12, 9],
        "ai_comment": "Grafiklere göre son 1 yılda yaz aylarında belirgin bir sıcaklık artışı ve düşük yağış gözlemlenmiştir. Kuraklığa dayanıklı ürün desenlerine (%60) ağırlık verilmesi önerilmektedir."
    }
