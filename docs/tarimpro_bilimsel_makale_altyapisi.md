# TarimPro Bilimsel Makale Altyapisi

> Not: Bu belge, projenin guncel canonical durumunu anlatir. Repo icindeki `README.md` ve bazi eski HTML raporlar ilk Sprint 4 backtest kosusunu tarihi kayit olarak tutar. Bilimsel makale icin referans alinmasi gereken sayilar, bu belgede ve `docs/ahp_metodoloji.md` dosyasinda verilen guncel `horizon=1` product-level sonuclaridir.

## 1. Projenin Amaci ve Bilimsel Konumu

TarimPro, tarimsal uretim karari veren bir kullanicinin:

- hangi urunu,
- hangi ilde,
- hangi alan buyuklugunde,
- hangi zaman ufkunda

ekmesi gerektigine dair veri destekli bir karar destegi saglar.

Sistem tek bir modelden ibaret degildir. Uretim tahmini, tuketim tahmini, AHP ile agirliklandirma, walk-forward backtest, model guveni ve arz-talep yorumu birlikte calisir. Bu nedenle proje, klasik bir "tahmin modeli" degil; cok katmanli bir karar destek sistemi olarak tasarlanmistir.

Bu dokumanin hedefi, projeyi makale seviyesinde sunabilmek icin su sorulara yanit vermektir:

1. Veri hangi kaynaklardan geliyor?
2. Uretim modeli nasil egitiliyor?
3. Tuketim modeli nasil calisiyor?
4. AHP agirliklari nasil uretiliyor?
5. Backtest neden guncellendi ve sonuclar nasil degisti?
6. Guven skoru ve arz-talep karti hangi mantikla uretiliyor?

---

## 2. Veri Altyapisi ve Sistem Mimarisi

### 2.1 Ana semalar

Veritabani iki ana sema uzerine kuruludur:

- `app`: kullanici, oturum, tarla, plan, AI analiz ve oneriler
- `analytics`: tarihsel uretim, iklim, tuketim, model tahminleri ve dogrulama tablolari

### 2.2 Temel veri akisi

1. Excel/ham veri dosyalari `tools/import_veri.py` ile PostgreSQL'e aktarilir.
2. Uretim, tuketim, iklim ve model ciktilari `analytics` semasinda saklanir.
3. UI uzerinden bir plan olusturuldugunda backend ilgili tarihsel ve forecast tablolarini sorgular.
4. AHP agirlari `backend/scoring_profile.json` uzerinden okunur.
5. Uretim modelinin tarihsel backtest kayitlari `analytics.walk_forward_predictions` ve `analytics.walk_forward_metrics` uzerinden gelir.

### 2.3 Temel tablolar

| Tablo | Rol |
|---|---|
| `analytics.production_history` | Iller ve urunler bazinda tarihsel uretim ve verim |
| `analytics.climate_history` | Iller bazinda tarihsel iklim gozlemleri |
| `analytics.consumption_history` | Urun bazinda tuketim serileri |
| `analytics.model_predictions` | Canli/gelecek uretim tahminleri |
| `analytics.walk_forward_metrics` | Horizon bazli backtest metrikleri |
| `analytics.walk_forward_predictions` | Tarihsel tahmin-gerceklesen satirlari |
| `app.ai_analyses` | Plan bazli AI analiz snapshot'i |
| `app.ai_recommendations` | Alternatif urun onerileri |

### 2.4 Import katmani

`tools/import_veri.py` su isleri yapar:

- Excel dosyalarini okur
- kolon adlarini normalize eder
- Turkce karakterleri ve farkli yazim varyantlarini birlestirir
- `analytics.*` tablolarini doldurur
- model ciktilarini ve backtest sheet'lerini veritabanina aktarir
- import loglarini `analytics.dataset_imports` tablosuna yazar

Bu tasarim sayesinde model notebook'lari ile uygulama backend'i ayni veri gercegini paylasir.

---

## 3. Uretim Tahmin Modeli

### 3.1 Problem tanimi

Uretim modeli, il + urun + uretim yontemi seviyesinde gelecekteki uretimi tahmin eder. Model recursive tahmin yerine `direct horizon` mantigini benimser. Yani:

- `t+1` icin ayrik model
- `t+2` icin ayrik model
- `t+3` icin ayrik model

Bu secim, tahminin uzerine tahmin bindirme hatasini azaltmak icindir.

### 3.2 Kullanilan veri kaynaklari

Ana kaynaklar:

- `veri/Detayli_Meyve_Tam_Yatay.xlsx`
- `veri/Detayli_Sebze_Tam_Yatay.xlsx`
- `veri/Detayli_Tahil_Verisi_Yatay.xlsx`
- `veri/Turkiye_81_Il_Tarimsal_Iklim_2013_2024.xlsx`

Notebook bu dosyalari okuyarak iller, urunler ve iklim serileri uzerinde calisir.

### 3.3 Veri temizleme ve standardizasyon

Uretim verisi yuklenirken:

- sehir, urun, yil ve uretim kolonlari bulunur
- eksik satirlar elenir
- sayisal kolonlar numeric hale getirilir
- ayni `Kategori + Sehir_Adi + Urun_Adi + Uretim_Yontemi + Yil` kombinasyonlari toplanir
- seri kimligi `Series_ID` olarak birlestirilir

Kullanim:

```text
Series_ID = Kategori | Sehir_Adi | Urun_Adi | Uretim_Yontemi
```

### 3.4 Leakage-safe feature engineering

Modelin en kritik teknik noktasi, veri sızıntisini engelleyen ozellik muhendisligidir.

Olusturulan baslica ozellikler:

| Ozellik | Anlam |
|---|---|
| `current_y` | Gozlenen guncel uretim |
| `current_log_y` | `log1p(current_y)` |
| `lag1_y`, `lag2_y`, `lag3_y` | Onceki 1, 2 ve 3 yilin uretimi |
| `lag1_log`, `lag2_log`, `lag3_log` | Laglerin log donusumu |
| `recent_mean_3` | Son 3 yillik ortalama |
| `recent_median_3` | Son 3 yillik medyan |
| `recent_std_3` | Son 3 yillik standart sapma |
| `recent_mean_log_3` | Son 3 yillik log ortalama |
| `recent_yoy_1`, `recent_yoy_2` | Yillik degisim oranlari |
| `delta_log_hist_1`, `delta_log_hist_2` | Log fark trendi |
| `area_current`, `area_lag1`, `area_lag2` | Alan proxy serisi |
| `area_yoy` | Alan degisim oranı |
| `series_count_so_far` | Seri uzunlugu |
| `age_of_series` | Serinin yasi |
| `urun_hist_medyan` | Urun bazli tarihsel medyan |
| `sehir_hist_medyan` | Sehir bazli tarihsel medyan |
| `series_hist_medyan` | Seri bazli tarihsel medyan |
| `series_hist_max` | Seri bazli tarihsel maksimum |

Ikim verisinden gelen ek ozellikler:

- sicaklik ortalamasi
- yagis
- ruzgar hizi
- toprak nemi
- bunlarin anomali versiyonlari

### 3.5 Leakage kontrol mantigi

`historical_group_stat_by_year()` fonksiyonu, ayni yildaki satirlari kullanarak ozellik uretilmesini engeller.

Kural:

```text
Bir satir icin grup istatistigi sadece o satirin yilindan STRICTLY onceki yillardan hesaplanir.
```

Bu onemlidir; cunku ayni yil icindeki baska satirlardan bilgi sızmasi model performansini sahte olarak yukseltebilir.

### 3.6 Direct horizon dataset yapisi

Her horizon icin ayri hedef uretilir:

```text
target_y = Uretim_Ton.shift(-h)
target_delta_log = log1p(target_y) - log1p(current_y)
```

Horizonlar:

- `h = 1`
- `h = 2`
- `h = 3`

Ek olarak grup-tabanli gelecek median projeksiyonlari uretilir:

- `urun_yil_medyan_est`
- `sehir_yil_medyan_est`

Bu projeksiyonlar, modelin zayif kaldigi noktalarda tarihsel grup sinyali verir.

### 3.7 Model mimarisi

Kullanimdaki algoritma: `XGBRegressor`

Model parametreleri:

| Parametre | Deger |
|---|---:|
| `n_estimators` | 1400 |
| `learning_rate` | 0.025 |
| `max_depth` | 6 |
| `min_child_weight` | 10 |
| `subsample` | 0.85 |
| `colsample_bytree` | 0.85 |
| `reg_alpha` | 0.25 |
| `reg_lambda` | 2.5 |
| `objective` | `reg:squarederror` |
| `tree_method` | `hist` |
| `max_cat_to_onehot` | 16 |
| `enable_categorical` | `True` |
| `random_state` | 42 |
| `n_jobs` | `-1` |
| `early_stopping_rounds` | 60 |

Bu secimlerin teknik anlamı:

- `hist`: buyuk veri icin hizli histogram tabanli egitim
- `enable_categorical`: kategorik kolonlari native destekleme
- `early_stopping_rounds=60`: asiri uyumu azaltma
- `reg_alpha` ve `reg_lambda`: model karmasikligini sinirlama

### 3.8 Baseline + guardrail + post-process mimarisi

Bu model sadece ham tahmin uretiyor gibi davranmaz. Uzerine bir post-processing katmani uygulanir.

#### 3.8.1 Baseline delta

```text
mean_delta = ortalama(delta_log_hist_1, delta_log_hist_2)
delta_base = mean_delta * scale_map[h] * damp_map[h]
```

Horizon katsayilari:

- `h=1`: scale `1.00`, damp `0.95`
- `h=2`: scale `1.65`, damp `0.82`
- `h=3`: scale `2.15`, damp `0.72`

Bu baseline, saf ML tahminine bir tarihsel trend ankrajı ekler.

#### 3.8.2 Adaptif guardrail

`compute_adaptive_guardrails()` fonksiyonu, log seviyesinde tarihsel farklari inceleyerek tahmin farki icin alt/ust limit uretir.

Temel mantik:

1. `hist_series` -> `log1p`
2. `diff(horizon)` alinir
3. 10. ve 90. yuzdelikler hesaplanir
4. volatiliteye bagli tampon eklenir
5. horizon ve volatiliteye bagli sert limit uygulanir

Sonuc:

```text
lo <= delta_hat <= hi
```

#### 3.8.3 Seviyesel sinirlar

`compute_level_bounds()` fonksiyonu, tahmini sadece delta uzayinda degil, mutlak tonaj uzayinda da kontrol eder.

Negatif trend durumunda daha kontrollu alt bant, pozitif trend durumunda daha genis ust bant kullanilir.

#### 3.8.4 Delta blending

ML ciktisi ile baseline birlestirilir:

| Horizon | ML agırlığı | Baseline agırlığı |
|---|---:|---:|
| 1 | 0.70 | 0.30 |
| 2 | 0.65 | 0.35 |
| 3 | 0.60 | 0.40 |

#### 3.8.5 Son post-process

`post_process_prediction()` su sirayi uygular:

1. delta guardrail ile clip edilir
2. trendi tersine ceviren asiri hareketler yumusatilir
3. `log1p` uzayindan tekrar seviyeye donulur
4. son olarak seviyesel bounds ile tekrar clip edilir

Bu mekanizma modelin fiziksel olmayan sıçramalar yapmasini engeller.

### 3.9 Walk-forward backtest tasarimi

Backtest fonksiyonu horizon bazinda calisir:

- her horizon icin ayri model
- her origin year icin ayri fold
- training set: `year < origin_year`
- test set: `year == origin_year`
- minimum train boyutu: 500

Hesaplanan metrikler:

- `R2`
- `MAE`
- `RMSE`
- `SMAPE_%`
- `WAPE_%`

### 3.10 Uretim modeli backtest sonuclari

Guncel kaynak workbook: `models/uretim/Dengeli_XGBoost_DirectHorizon_2025_2027_Tahminler.xlsx`

#### Horizon bazli ortalamalar

| Horizon | R2 | MAE | RMSE | SMAPE_% | WAPE_% |
|---|---:|---:|---:|---:|---:|
| 1 | 0.945536 | 4121.881904 | 22171.755568 | 20.550942 | 19.140022 |
| 2 | 0.918573 | 5633.761282 | 27559.415740 | 31.246179 | 25.699290 |
| 3 | 0.920723 | 6158.446975 | 27907.911220 | 37.430942 | 27.258086 |

#### Folds

| Horizon | Origin years |
|---|---|
| 1 | 2019, 2020, 2021, 2022, 2023 |
| 2 | 2019, 2020, 2021, 2022 |
| 3 | 2019, 2020, 2021 |

### 3.11 Uretim modeli ciktilari

Notebook ve calisma akisi su ciktilari uretiyor:

- `models/uretim/Dengeli_XGBoost_DirectHorizon_2025_2027_Tahminler.xlsx`
- `models/uretim/model_grafikleri/` altinda grafikler
- `WalkForward_Metrikler` sheet'i
- `WalkForward_Tahminler` sheet'i

Bu ciktilar import sirasinda `veri/` klasorune de senkronlanir ve backend tarafinda kullanilabilir hale gelir.

---

## 4. Tuketim Tahmin Modeli

### 4.1 Problem tanimi

Tuketim modeli, urun bazinda ulusal tuketim serisini tahmin eder. Buradaki hedef, arz-talep yorumuna girdi olacak makul bir piyasa sinyali uretilmesidir.

### 4.2 Veri kaynaklari

Kullanimdaki dosyalar:

- `veri/tuketim_meyve.xlsx`
- `veri/tuketim_sebze.xlsx`
- `veri/tuketim_tahil.xlsx`
- `veri/Nufus*.xlsx`
- `veri/Endeks_Verileri_2014_2024.xlsx`
- `veri/*Hanehalk*.xlsx`

### 4.3 Feature engineering

Uygulanan temel ozellikler:

| Ozellik | Anlam |
|---|---|
| `Lag1` | Bir onceki yil tuketim |
| `RollingMean3` | Son 3 yil gecikmeli ortalama |
| `Lag1_log` | `log1p(Lag1)` |
| `RollingMean3_log` | `log1p(RollingMean3)` |
| `Trend` | Zaman trendi |
| `Nufus` | Ulusal nufus |
| `Endeks_Ortalama` | Endeks serisi |
| `Hanehalki_Gelir` | Hanehalki gelir serisi |

Kritik nokta:

```text
RollingMean3, shift(1) + rolling(3) ile uretilir.
Yani gelecek yil bilgisi feature'a sızmaz.
```

### 4.4 Model mimarisi

Model bir `Pipeline` olarak kuruludur:

- `ColumnTransformer`
- sayisal ozellikler icin `StandardScaler`
- urun adi icin `OneHotEncoder(handle_unknown="ignore")`
- regresor olarak `Ridge`

### 4.5 Hiperparametre secimi

Denenen `alpha` adaylari:

```text
[0.01, 0.1, 1.0, 10.0, 100.0, 1000.0]
```

Secim yontemi:

- validation years = 2020, 2021, 2022
- train: yil < validation_year
- valid: yil == validation_year
- kriter: mean WAPE ve mean SMAPE

### 4.6 Secilen model parametresi

Guncel calismada secilen Ridge parametresi:

```text
alpha = 10.0
```

### 4.7 Holdout sonuclari

Test yili: 2023

| Metrik | Deger |
|---|---:|
| R2 | 0.9205 |
| MAE | 243855.01 |
| RMSE | 581222.27 |
| SMAPE | 21.02 |
| WAPE | 21.82 |

Bu sonuclar, tuketim serisinin ulusal tahmin seviyesinde oldukca guclu bir sinyal verdigini gosterir.

### 4.8 Gelecek tuketim tahmini

2024-2027 tuketim tahminleri icin:

1. `Nufus`, `Endeks_Ortalama` ve `Hanehalki_Gelir` serileri 2023'e kadar olan veriden LinearRegression ile projekte edilir.
2. Her urun icin recursive forecast calistirilir.
3. Stabilizasyon uygulanir:

```text
pred = 0.7 * pred + 0.3 * rolling
```

4. Asiri dalgalanmayi sinirlamak icin:

```text
pred = clip(pred, rolling * 0.5, rolling * 1.8)
```

### 4.9 Tuketim modelinin ciktilari

- `models/tuketim_tahminleri_2024_2027v3.xlsx`
- `models/tuketim_ve_tahmin_birlesik.xlsx`
- ayni dosyalar `veri/` klasorune de kopyalanir
- grafikler ve PDF raporlar uretilir

---

## 5. AHP Agirliklandirma ve Skorlama

### 5.1 Kriterler

Sistem dort ana kriter kullanir:

1. Gecmis verim
2. Model projeksiyonu
3. Tuketim egilimi / piyasa sinyali
4. Iklim dayanikliligi

### 5.2 Ikili karsilastirma matrisi

Kaynak dosya: `docs/ahp_pairwise_matrix.csv`

| criterion | yield | forecast | demand | climate |
|---|---:|---:|---:|---:|
| yield | 1 | 1/2 | 2 | 1 |
| forecast | 2 | 1 | 3 | 2 |
| demand | 1/2 | 1/3 | 1 | 1/2 |
| climate | 1 | 1/2 | 2 | 1 |

### 5.3 Hesaplanan AHP agirliklari

| Kriter | Agırlık | Yuzde |
|---|---:|---:|
| Gecmis verim | 0.22704446506343962 | 22.7% |
| Model projeksiyonu | 0.42358691334964627 | 42.4% |
| Tuketim egilimi | 0.1223241565234746 | 12.2% |
| Iklim dayanikliligi | 0.22704446506343962 | 22.7% |

### 5.4 Tutarlilik metrikleri

| Metrik | Deger |
|---|---:|
| Lambda max | 4.0103629022 |
| Consistency Index | 0.0034543007 |
| Consistency Ratio | 0.0038381119 |

`CR < 0.10` oldugu icin matris tutarlidir.

### 5.5 Skor formulu

Sistem, her kriteri once 0-100 bandina normalize eder, sonra agirliklandirir.

```text
Toplam Skor =
  0.2270 * GecmisVerim +
  0.4236 * ModelProjeksiyonu +
  0.1223 * TuketimEgilimi +
  0.2270 * IklimDayanikliligi
```

### 5.6 Skorlama kodu

`backend/scoring.py` icindeki ana fonksiyonlar:

- `ahp_weights_from_matrix()`
- `normalize_weights()`
- `compute_weighted_score()`
- `get_scoring_profile()`
- `dcg_at_k()`

`backend/scoring_profile.json` profili versioned bir yapida tutar.

### 5.7 Profil versiyonu

Aktif profil bilgileri:

- `profileName`: `ahp_v1_expert_seed`
- `updatedAt`: `2026-04-03`
- `source`: AHP pairwise comparison matrix with agricultural domain judgment

---

## 6. Backtest Neden Guncellendi?

### 6.1 Eski durum

Ilk Sprint 4 backtest kosusu, `analytics.walk_forward_predictions` tablosundaki tum horizon satirlarini bir arada kullaniyordu. Bu durumda:

- horizon 1
- horizon 2
- horizon 3

satirlari ayni ranking uzayinda karisiyordu.

Bu metodolojik olarak sorunluydu; cunku modelin gercek kullanimi `horizon=1` ile uyumlu iken backtest, karisık ufuklardan aday topluyordu.

### 6.2 Neden degisti?

Degisiklik nedeni:

1. Backtesti modelin gercek kullanim ufkuyla eslemek
2. Farkli horizonlari ayni rankingde karistirmamak
3. Uretim modeli ile AHP skor sistemini metodolojik olarak tutarli hale getirmek
4. Makalede savunulabilir bir "product-level horizon=1" degerlendirme verebilmek

### 6.3 Kodda ne degisti?

`backend/devtools/ahp_backtest.py` dosyasinda:

- `--forecast-horizon` CLI parametresi eklendi
- sorguya `AND horizon = %(forecast_horizon)s` filtresi geldi
- adaylar `city_name + product_name + forecast_year` bazinda toplandi
- `predicted_production` ve `actual_production` product-level olarak sum edildi

Bu, ayni urunun farkli production_method satirlarini tek adayda birlestirir.

### 6.4 Eski ve yeni sonuc karsilastirmasi

#### Tarihi Sprint 4 ilk kosusu

| Metrik | Deger |
|---|---:|
| scenarioCount | 405 |
| candidateCount | 60,820 |
| top1ExactRate | 15.31% |
| top3HitRate | 74.57% |
| meanSpearman | 0.4141 |
| meanNdcgAt3 | 0.9178 |

Bu set, artik tarihsel olarak saklanan ama makale icin ana referans olmayan ilk kosudur.

#### Guncel canonical kosu

Kaynak: `docs/ahp_backtest_report.json` ve `docs/ahp_metodoloji.md`

| Metrik | Deger |
|---|---:|
| scenarioCount | 405 |
| candidateCount | 21,281 |
| top1ExactRate | 82.72% |
| top3HitRate | 98.52% |
| meanSpearman | 0.5079 |
| meanNdcgAt3 | 0.9303 |

#### Repository icindeki alternatif horizon=1 artifact

`docs/ahp_backtest_report_product_level.json` dosyasinda ayrica:

| Metrik | Deger |
|---|---:|
| candidateCount | 21,290 |
| top1ExactRate | 81.98% |
| top3HitRate | 98.27% |
| meanSpearman | 0.5112 |
| meanNdcgAt3 | 0.9311 |

Bu fark, backtestin canlı veritabanindan okumasindan dolayi veri snapshot'ındaki ufak degisikliklere duyarlidir. Bilimsel makale icin tek sayi kullanilacaksa, `docs/ahp_metodoloji.md` ile uyumlu canonical deger olan `%82.72` alinmalidir.

### 6.5 Bu fark ne anlama geliyor?

Degisim su sekildedir:

- Top-1 exact rate dramatik sekilde iyilesti
- Top-3 hit rate neredeyse tam kapsama seviyesine cikti
- Spearman ve nDCG de yukselmis oldu
- Aday sayisi, horizon karisikliklari elenince ciddi sekilde dustu

Bu, modelin tek basina "birinciyi kesin bulma" iddiasi tasimadigini; ancak aday siralamada guclu bir karar destegi sundugunu gosterir.

---

## 7. Guven Skoru, Kalibrasyon ve Arz-Talep Yorumu

### 7.1 Guven skoru mantigi

AI analiz ekranindaki guven skoru, "hasat garantisi" degildir. Bu skor, gercek uretimin modelin bekledigi alt-ust bant icinde kalma olasiligini temsil eder.

`backend/main.py` icindeki `_build_confidence_payload()` fonksiyonu su kaynaklari birlestirir:

- global walk-forward istatistikleri
- product-level walk-forward istatistikleri
- local city+product walk-forward istatistikleri
- horizon bazli genel model metriği

Bu mekanizma ampirik Bayes shrinkage kullanir:

```text
posterior_rate = (local_success + alpha_prior) / (local_sample + alpha_prior + beta_prior)
```

Burada:

- `local_success`: yerel basari sayisi
- `local_sample`: yerel ornek sayisi
- `alpha_prior`, `beta_prior`: prior dagilim parametreleri

### 7.2 Guven skorunun alanlari

UI ve API tarafinda sunulan alanlar:

- `score`
- `label`
- `calibrationLevel`
- `horizon`
- `horizonLabel`
- `localSampleSize`
- `referenceSampleSize`
- `observedCoveragePct`
- `avgAbsErrorPct`
- `avgIntervalWidthPct`
- `probabilityRange`

### 7.3 Guven skorunun bilimsel yorumu

Bu skor, modelin hata ortalamasini tek basina degil, test verisinde cikis araligini ne kadar yakaladigini soyler. Bu nedenle model guveni ile tahmin hatasi ayni sey degildir.

### 7.4 Arz-talep karti

`backend/db/repositories.py` icindeki `get_product_supply_demand_projection()` ve `_build_supply_demand_payload()` fonksiyonlari:

- `analytics.model_predictions` uzerinden tahmini arz alir
- `analytics.consumption_history` uzerinden tahmini talep alir
- coverage ratio hesaplar
- durumu uretir:
  - `Arz açığı`
  - `Dengeli`
  - `Üretim fazlası`

### 7.5 Arz-talep skor yorumu

Temel siniflandirma:

- `coverage_ratio < 0.95` -> arz acigi
- `0.95 <= coverage_ratio <= 1.05` -> dengeli
- `coverage_ratio > 1.05` -> uretim fazlasi

Bu kart, il bazli hasat tahmini degil; ulusal urun seviyesi piyasa okumasidir.

---

## 8. Uygulama Entegrasyonu

### 8.1 AI analiz pipeline'i

`backend/main.py` icindeki analiz akisi su sirayi izler:

1. Il ve urun secilir
2. `yield_context` hesaplanir
3. `forecast_score` model projeksiyonundan gelir
4. `demand_score` tuketim verisinden gelir
5. `climate_score` iklim dayanikliligindan gelir
6. AHP agirliklari ile toplam skor uretilir
7. `score_breakdown` JSON olarak kaydedilir
8. `confidence_payload` ve `supply_demand` eklenir
9. `app.ai_analyses` ve `app.ai_recommendations` tablolari doldurulur

### 8.2 Skor bileşenleri

`score_breakdown` icinde her madde su yapidadadir:

- `key`
- `label`
- `value`
- `weight`

### 8.3 Model ciktilari UI tarafinda nasil okunur?

`frontend/src/pages/AiRecommendations.jsx` sayfasi:

- plan notunu
- guven skorunu
- guven araligini
- arz-talep durumunu
- alternatif urunleri

ayri ayriz kartlar halinde gosterecek sekilde tasarlanmistir.

---

## 9. Bilimsel Makale Icin Hazir Ozet Tablo

### 9.1 Uretim modeli

| Bilesen | Deger |
|---|---|
| Algoritma | XGBoost |
| Tahmin tipi | Direct horizon |
| Horizonlar | 1, 2, 3 |
| En iyi horizon-1 R2 | 0.945536 |
| Horizon-1 WAPE | 19.140022 |
| Guardrail | Quantile + volatilite + trend tabanli |

### 9.2 Tuketim modeli

| Bilesen | Deger |
|---|---|
| Algoritma | Ridge regression |
| Feature set | Lag1_log, RollingMean3_log, Trend, Nufus, Endeks_Ortalama, Hanehalki_Gelir, Urun_Adi |
| Secilen alpha | 10.0 |
| Holdout yili | 2023 |
| R2 | 0.9205 |
| WAPE | 21.82 |

### 9.3 AHP

| Bilesen | Deger |
|---|---|
| Kriter sayisi | 4 |
| Dominant kriter | Model projeksiyonu |
| Agirlik | 0.42358691334964627 |
| CR | 0.0038381119 |
| Tutarlilik | Kabul edilebilir |

### 9.4 Canonical backtest

| Metrik | Deger |
|---|---:|
| scenarioCount | 405 |
| candidateCount | 21,281 |
| top1ExactRate | 82.72% |
| top3HitRate | 98.52% |
| meanSpearman | 0.5079 |
| meanNdcgAt3 | 0.9303 |

---

## 10. Sinirlar ve Gelecek Calismalar

### 10.1 Sinirlar

- AHP matrisi su an tek uzman tohumu niteligi tasir
- tuketim verisi ulusal seviyededir; il bazli degildir
- backtest live veritabanina baglidir; snapshot farklari kucuk sayisal farklar uretebilir
- guven skoru "garanti" degil, kalibrasyon göstergesidir

### 10.2 Gelecek calisma onerileri

- AHP matrisini cok disiplinli uzman paneli ile yeniden kurmak
- sehir + urun bazli ayrik AHP profilleri olusturmak
- horizon-2 ve horizon-3 icin ayrik canonical backtest raporlari yayinlamak
- dis ticaret verisi ekleyip arz-talep yorumunu guclendirmek
- model projeksiyonu icin belirsizlik bandini daha formel hale getirmek

---

## 11. Makalede Dogrudan Kullanilabilecek Kisa Metin

Bu calismada tarimsal uretim karari, gecmis verim, model projeksiyonu, tuketim egilimi ve iklim dayanikliligi olmak uzere dort kriterli cok katmanli bir karar destek sistemi olarak ele alinmistir. Kriter agirliklari Analitik Hiyerarsi Prosesi (AHP) ile uretilmis, tutarlilik orani `CR = 0.0038381119` ile kabul edilebilir bulunmustur. Uretim modeli direct-horizon XGBoost mimarisi ile egitilmis; horizon-1 icin ortalama `R2 = 0.945536`, `WAPE = 19.14%` elde edilmistir. Tuketim modeli Ridge regresyon tabanlidir ve 2023 holdout setinde `R2 = 0.9205`, `WAPE = 21.82%` performansi vermistir. Backtest tarafinda horizon-1 product-level degerlendirme ile `top1 exact rate = 82.72%`, `top3 hit rate = 98.52%`, `mean Spearman = 0.5079` ve `mean nDCG@3 = 0.9303` elde edilmiştir.

---

## 12. Kaynak Dosyalar

- `backend/devtools/ahp_backtest.py`
- `backend/scoring.py`
- `backend/scoring_profile.json`
- `backend/main.py`
- `backend/db/repositories.py`
- `tools/import_veri.py`
- `models/uretim/dengeli_xgboost_direct_horizon_guardrailli_pipeline.ipynb`
- `models/Tuketimv3.ipynb`
- `docs/ahp_metodoloji.md`
- `docs/ahp_backtest_report.json`
- `docs/ahp_backtest_report_product_level.json`
- `docs/ahp_backtest_report_h1_product_level.json`

