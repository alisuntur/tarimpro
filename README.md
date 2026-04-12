# TarimPro / TarimZeka

TarimPro, ciftcilerin il, tarla buyuklugu ve urun tercihine gore daha bilincli ekim karari alabilmesi icin gelistirilmis web tabanli bir tarimsal karar destek platformudur. Sistem; tarihsel uretim ve verim verilerini, iklim gostergelerini, tuketim egilimlerini ve XGBoost tabanli uretim projeksiyonlarini birlestirerek kullaniciya siralanmis urun onerileri sunar.

Proje Sprint 1-4 boyunca demo/prototip seviyesinden; gercek kullanici oturumu, veritabanina kaydedilen planlar, tekrar acilabilen AI analiz raporlari, AHP tabanli agirliklandirma, walk-forward backtest ve arz-talep dengesi iceren daha savunulabilir bir MVP yapisina tasinmistir.

## One Cikan Ozellikler

- Kullanici girisi, logout ve Bearer token ile tasinan veritabani tabanli session yonetimi
- Kullaniciya ozel profil, tarla ve uretim plani yonetimi
- Il ve urun bazli veritabanina bagli plan sihirbazi
- Gercek analitik tablolardan beslenen bolgesel analiz ekrani
- Gecmis verim, model projeksiyonu, tuketim egilimi ve iklim dayanıkliligindan hesaplanan AI urun uygunluk skoru
- Analiz sonucunu `app.ai_analyses` ve `app.ai_recommendations` tablolarina snapshot olarak kaydetme
- AHP ile hesaplanan kriter agirliklari ve `backend/scoring_profile.json` uzerinden surumlenebilir skor profili
- `analytics.walk_forward_predictions` uzerinden AHP agirlikli skor sisteminin tarihsel backtest'i
- Walk-forward kalibrasyonuna dayali olasiliksal model guveni
- Ulusal seviyede tahmini uretim / tahmini tuketim karsilastirmasi ile arz-talep dengesi karti

## Teknik Yigin

| Katman | Teknoloji |
|---|---|
| Frontend | React 19, Vite, React Router, Recharts |
| Backend | FastAPI, Pydantic, psycopg |
| Veritabani | PostgreSQL |
| Veri isleme | pandas, openpyxl |
| Harita/grafikler | turkey-map-react, Recharts |
| Skorlama | AHP agirlik profili + cok kriterli skor |
| Tahmin kaynagi | `Dengeli_XGBoost_DirectHorizon` model ciktisi |

## Proje Yapisi

```text
tarimpro/
  backend/
    main.py                    # FastAPI uygulamasi ve API endpoint'leri
    security.py                # Sifre dogrulama, session token uretimi, token hashleme
    dependencies.py            # Current-user dependency katmani
    scoring.py                 # AHP agirlik okuma, skor ve backtest yardimcilari
    scoring_profile.json       # Aktif AHP agirlik profili
    db/
      schema.sql               # app ve analytics semalari
      repositories.py          # DB sorgu katmani
      bootstrap.py             # Baslangic sema kurulumu
    devtools/
      ahp_backtest.py          # AHP skor sisteminin walk-forward backtest araci

  frontend/
    src/
      App.jsx
      lib/api.js               # Merkezi API istemcisi
      context/AuthContext.jsx
      components/
      pages/
        Dashboard.jsx
        PlanWizard.jsx
        AiRecommendations.jsx
        RegionalAnalysis.jsx
        ClimateMarket.jsx
        Profile.jsx
        Login.jsx

  tools/
    import_veri.py             # Excel veri dosyalarini PostgreSQL'e aktarma araci

  veri/                        # Uretim, tuketim, iklim ve model tahmin Excel dosyalari
  docs/                        # Sprint, AHP, backtest ve proje raporlari
```

## Veritabani Mimarisi

Proje iki ana sema kullanir:

- `app`: kullanici, session, tarla, plan, AI analiz ve oneriler
- `analytics`: uretim gecmisi, iklim gecmisi, tuketim verileri, model tahminleri ve walk-forward dogrulama tablolari

Onemli tablolar:

- `app.users`
- `app.user_sessions`
- `app.fields`
- `app.production_plans`
- `app.ai_analyses`
- `app.ai_recommendations`
- `analytics.production_history`
- `analytics.climate_history`
- `analytics.geo_locations`
- `analytics.weather_daily_cache`
- `analytics.consumption_history`
- `analytics.model_predictions`
- `analytics.walk_forward_metrics`
- `analytics.walk_forward_predictions`

Open-Meteo entegrasyonu iki cache tablosu kullanir:

- `analytics.geo_locations`: il/ilce koordinatlarini tutar. Koordinat yoksa Open-Meteo Geocoding API ile cozulup cache'lenir.
- `analytics.weather_daily_cache`: konum bazli gunluk hava/tarim verisini tutar. Bugunun kaydi varsa dashboard DB'den okur; yoksa Open-Meteo'dan cekip upsert eder.

Gunluk toplu yenileme komutu:

```powershell
.\.venv\Scripts\python.exe tools\refresh_weather_cache.py --batch-size 50
```

Backend calisirken ayni is otomatik olarak her gun `09:00`'da tetiklenir. Local testte server 09:00'da kapaliysa, backend sonraki acilista bugunun eksik cache kayitlarini arka planda bir kez tamamlar. Saat ve batch boyutu icin ortam degiskenleri:

```powershell
$env:WEATHER_CACHE_REFRESH_HOUR="9"
$env:WEATHER_CACHE_REFRESH_MINUTE="0"
$env:WEATHER_CACHE_BATCH_SIZE="50"
```

Gerekirse otomatik backend scheduler kapatilabilir:

```powershell
$env:WEATHER_CACHE_SCHEDULER_ENABLED="false"
```

Acilista eksik cache tamamlama davranisi da ayri kapatilabilir:

```powershell
$env:WEATHER_CACHE_STARTUP_REFRESH_ENABLED="false"
```

Elimizde il/ilce koordinat CSV'si varsa once koordinatlari seed edip sonra gunluk cache'i yenilemek icin:

```powershell
.\.venv\Scripts\python.exe tools\refresh_weather_cache.py --locations-csv veri\il_ilce_koordinat_utf8_bom.csv --batch-size 50 --force
```

Sadece koordinat seed etmek icin `--skip-weather-refresh` eklenebilir.

## Skorlama ve AHP

Sprint 3'te urun uygunluk skoru manuel agirliklarla hesaplanıyordu:

```text
skor =
  0.32 * gecmis_verim +
  0.33 * model_projeksiyonu +
  0.17 * tuketim_egilimi +
  0.18 * iklim_dayanikliligi
```

Sprint 4'te bu sabit katsayilar AHP ile uretilen agirlik profiline tasindi:

| Kriter | AHP agirligi |
|---|---:|
| Gecmis verim | 0.2270 |
| Model projeksiyonu | 0.4236 |
| Tuketim egilimi / arz-talep | 0.1223 |
| Iklim dayanıkliligi | 0.2270 |

AHP tutarlilik metrikleri:

| Metrik | Deger |
|---|---:|
| Lambda max | 4.0104 |
| Consistency Index | 0.00345 |
| Consistency Ratio | 0.00384 |

`CR < 0.10` oldugu icin matris tutarli kabul edilmistir. Aktif profil `backend/scoring_profile.json`, ikili karsilastirma matrisi ise `docs/ahp_pairwise_matrix.csv` icindedir.

## Backtest Ozeti

`backend/devtools/ahp_backtest.py` modeli yeniden egitmez. Daha once uretilmis `analytics.walk_forward_predictions` tablosundaki hazir tahmin-gerceklesen kayitlarini okur ve AHP agirlikli skor sisteminin tarihsel senaryolarda nasil siralama yaptigini test eder.

Backtest ozeti:

| Metrik | Deger |
|---|---:|
| Donem | 2020-2024 |
| Senaryo sayisi | 405 |
| Aday kayit | 60,820 |
| Top-1 exact rate | %15.31 |
| Top-3 hit rate | %74.57 |
| Mean Spearman | 0.4142 |
| Mean nDCG@3 | 0.9175 |

Bu sonuc sistemin tek bir kesin karar verici olarak degil, kullaniciya guclu bir ilk aday havuzu sunan karar destek araci olarak konumlandirilmasi gerektigini gosterir.

## Kurulum

### Gereksinimler

- Python 3.12 veya uyumlu bir Python 3 surumu
- Node.js ve npm
- PostgreSQL
- Windows ortaminda veri importu icin `psql.exe` ve `createdb.exe` yolunun bilinmesi

### Backend

```powershell
cd backend
pip install -r requirements.txt
python -m uvicorn main:app --reload
```

Varsayilan API adresi:

```text
http://127.0.0.1:8000
```

Backend veritabani baglantisi su environment variable'lari ile ayarlanabilir:

```powershell
$env:PGHOST="127.0.0.1"
$env:PGPORT="5432"
$env:PGDATABASE="tarimpro"
$env:PGUSER="postgres"
$env:PGPASSWORD="postgres_sifreniz"
```

Deger verilmezse backend varsayilan olarak `127.0.0.1:5432`, `tarimpro`, `postgres` ayarlarini kullanir.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Varsayilan Vite adresi:

```text
http://127.0.0.1:5173
```

Frontend API adresi `VITE_API_BASE` ile degistirilebilir. Varsayilan deger:

```text
http://127.0.0.1:8000
```

## Veri Aktarimi

Excel dosyalarini PostgreSQL'e aktarmak icin:

```powershell
python tools/import_veri.py --db-name tarimpro --db-user postgres
```

PostgreSQL binary dizini farkliysa:

```powershell
python tools/import_veri.py --db-name tarimpro --db-user postgres --pg-bin "C:\Program Files\PostgreSQL\18\bin"
```

Veritabani zaten olusturulduysa:

```powershell
python tools/import_veri.py --skip-create-db
```

## AHP Backtest Calistirma

Varsayilan ayarlarla:

```powershell
cd backend
python devtools/ahp_backtest.py
```

Profil dosyasini yeniden yazmak icin:

```powershell
cd backend
python devtools/ahp_backtest.py --write-profile
```

Farkli yil araligi icin:

```powershell
cd backend
python devtools/ahp_backtest.py --start-year 2020 --end-year 2024 --min-products 4
```

Varsayilan ciktilar:

- `backend/scoring_profile.json`
- `docs/ahp_backtest_report.json`

## Demo Giris

Veri importu sonrasinda demo kullanici bilgisi:

```text
Telefon: 05551234567
Sifre: demo123
```

## Onemli API Uclari

| Method | Endpoint | Aciklama |
|---|---|---|
| `POST` | `/api/auth/login` | Giris ve session token uretimi |
| `POST` | `/api/auth/logout` | Session iptali |
| `GET` | `/api/auth/me` | Aktif kullanici |
| `GET` | `/api/dashboard/summary` | Dashboard ozeti |
| `GET` | `/api/plans/options` | Plan secenekleri |
| `POST` | `/api/plans` | Plan olusturma |
| `PUT` | `/api/plans/{plan_id}` | Plan guncelleme |
| `POST` | `/api/ai/analyze-plan` | AI plan analizi |
| `GET` | `/api/analyses` | Kayitli analizler |
| `GET` | `/api/analyses/{analysis_id}` | Analiz detayi |
| `GET` | `/api/regional-analysis` | Bolgesel analiz |
| `GET` | `/api/climate/data` | Iklim verisi |
| `GET` | `/api/profile/me` | Profil ve rapor ozeti |
| `GET` | `/api/fields` | Tarla listesi |

## Dokumantasyon

Detayli raporlar `docs/` altindadir:

- `docs/tarimzeka_proje_raporu.html`
- `docs/haftalik_sprint_raporu_3_nisan.md`
- `docs/SPRINTLER_DETAYLI_ANALIZ.md`
- `docs/ahp_metodoloji.md`
- `docs/ahp_backtest_report.json`
- `docs/sprint4_ahp_model_dogrulama_raporu.html`

## Bilinen Sinirlar

- AHP matrisi su an uzman tohumu niteligindedir; ziraat, iklim ve piyasa uzmanlarindan olusan daha genis bir panel ile guclendirilebilir.
- Arz-talep analizi il bazinda degil, Turkiye geneli urun seviyesi uzerinden yorumlanir.
- Backtest skorlama sistemini tarihsel olarak degerlendirir; XGBoost modelini yeniden egitmez.
- Top-1 exact rate dusuk oldugu icin sistem kesin karar verici olarak degil, karar destek araci olarak ele alinmalidir.

## Lisans / Not

Bu repo, TarimPro / TarimZeka tarimsal karar destek sistemi icin hazirlanan MVP ve tez oncesi proje calismasini icerir.
