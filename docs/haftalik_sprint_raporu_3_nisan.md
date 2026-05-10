# TarimPro Haftalik Sprint Raporu

Bu rapor, 03.04.2026 tarihinden itibaren GitHub commit gecmisine bakilarak hazirlanmistir. Amac, bir haftalik gelisim surecinde hangi sprintte ne yapildigini, neden yapildigini, sirasiyla hangi problemlerle karsilasildigini ve ozellikle AHP oncesi manuel agirliklardan AHP ile hesaplanan agirliklara gecisi aciklamaktir.

Raporun ana kaynagi 03.04.2026 ve 06.04.2026 tarihli commitlerdir. Mevcut teknik baglam icin `docs/mvp_sprint_plan.html`, `docs/ahp_metodoloji.md`, `docs/ahp_backtest_report.json`, `backend/scoring.py`, `backend/scoring_profile.json` ve `backend/devtools/ahp_backtest.py` dosyalari da dikkate alinmistir.

Not: Bu rapordaki backtest sayilari Sprint 4'ün ilk koşusuna aittir. Güncel canonical ürün-level ve `horizon=1` raporu `docs/ahp_backtest_report.json` dosyasindadir.

## 1. Commit Zaman Cizelgesi

| Sira | Commit | Tarih | Baslik | Ana anlam |
|---:|---|---|---|---|
| 0 | `a5063e2` | 03.04.2026 12:18 | `chore: tarimpro son hal - tüm frontend ve backend dosyaları` | Mevcut frontend/backend tabaninin repoya alinmasi |
| 1 | `3eec948` | 03.04.2026 18:32 | `Sprint 1 tamamlandı.` | Auth, session, gercek kullanici baglami, profil ve tarla yonetimi |
| 2 | `3c0da7b` | 03.04.2026 19:07 | `Metinlerde oluşan harf hataları düzeltildi...` | Turkce karakter duzeltmeleri ve sunucu baslatma notu |
| 3 | `0658933` | 03.04.2026 19:53 | `Sprint 2 tamamlandı.` | Plan olusturma ve bolgesel analizi DB tabanli hale getirme |
| 4 | `f6dc5f3` | 03.04.2026 20:44 | `Sprint 3 tamamlandı.` | Gercek AI analizi, skor kirilimi, rapor gecmisi ve analiz snapshot'i |
| 5 | `be809f2` | 03.04.2026 21:13 | `fix: complete analysis flow...` | Kalan mock benzeri bosluklarin kapatilmasi |
| 6 | `eb7cb38` | 03.04.2026 21:35 | `Bölgesel analiz renk paleti güncelleme` | RegionalAnalysis gorsel iyilestirme |
| 7 | `93b7887` | 03.04.2026 23:43 | `Sprint 4 tamamlandı.` | AHP, backtest, model guveni ve arz-talep dengesi |
| 8 | `173fd6b` | 03.04.2026 23:49 | `Model sprint4 raporu eklendi` | Sprint 4 AHP/model dogrulama raporunun eklenmesi |
| 9 | `15232ba` | 06.04.2026 15:22 | `Update .gitignore` | Bazi dokuman ciktilarinin git disinda tutulmasi |

Haftalik akisin yogun bolumu 03.04.2026 tarihinde tamamlanmistir. 06.04.2026 tarihli commit ise asil urun fonksiyonundan cok depo duzeni ve dokuman ciktilarini git disinda tutma isidir.

## 2. Baslangic Durumu: Mevcut Prototipin Repoya Alinmasi

Ilk commit olan `a5063e2`, TarimPro uygulamasinin o anki frontend ve backend dosyalarini repoya aldi. Bu asamada uygulamada React/Vite tabanli frontend sayfalari, FastAPI backend girisi, ilk dashboard, iklim/pazar sayfalari, plan sihirbazi, profil sayfasi ve bazi veri dosyalari zaten bulunuyordu.

Bu commit bir sprint tamamlama commit'i degil, sprintlerin uzerine insa edilecegi taban durumdu. Bu nedenle raporda "Sprint 0" gibi dusunulebilir:

- Frontend tarafinda `Dashboard`, `PlanWizard`, `AiRecommendations`, `ClimateMarket`, `RegionalAnalysis`, `Login`, `Profile` sayfalari vardi.
- Backend tarafinda ilk `main.py` ve gereksinim dosyalari vardi.
- Ancak kullanici baglami, planlarin kalici saklanmasi, analizlerin DB uzerinden uretilmesi ve metodolojik skor aciklamasi henuz yeterince guclu degildi.
- Veri dosyalari repoya alinmisti, fakat uygulama akisi henuz tamamen "gercek kullanici, gercek plan, gercek analiz" zincirine oturmamisti.

Bu noktadaki temel problem, sistemin calisan bir prototip olmasina ragmen MVP savunmasi icin "kimin verisi, hangi plan, hangi analiz, hangi skor mantigi" sorularina yeterince net cevap verememesiydi.

## 3. Sprint 1: Auth, Session ve Gercek Kullanici Baglami

Commit: `3eec948`  
Tarih: 03.04.2026 18:32  
Odak: "Demo kullanici" hissini kirip uygulamayi gercek oturum ve kullanici verisi ile calistirmak.

### Neden Yapildi?

Projede plan, tarla, profil ve analiz verileri kullaniciya ozel olmaliydi. Gercek auth olmadan sistem ilk kullaniciyi veya sabit demo veriyi kullanmaya devam ederse, daha sonra yapilacak plan ve analiz gelistirmeleri guvenilir olmazdi. Bu yuzden ilk sprint, sonraki tum sprintlerin zemini olarak ele alindi.

### Yapilanlar

Backend tarafinda:

- `backend/security.py` eklendi.
- `backend/dependencies.py` eklendi.
- `backend/db/bootstrap.py`, `backend/db/config.py`, `backend/db/connection.py`, `backend/db/repositories.py` ve `backend/db/schema.sql` ile veritabani katmani genisletildi.
- Login artik sifre dogrulamasi yapiyor, session token uretiyor ve token hash'i uzerinden kullaniciyi taniyor.
- `/api/auth/me` ve logout akisi eklendi.
- Korumali endpoint'ler ilk kullaniciyi almak yerine oturumdaki kullaniciyi kullanmaya basladi.
- Profil guncelleme, tarla ekleme, tarla duzenleme ve tarla silme DB'ye kalici yazilir hale geldi.

Frontend tarafinda:

- `frontend/src/context/AuthContext.jsx` eklendi.
- `frontend/src/components/ProtectedRoute.jsx` eklendi.
- `frontend/src/lib/api.js` eklendi.
- `App.jsx`, `Layout.jsx`, `Login.jsx`, `Profile.jsx` gercek auth akisi ile baglandi.
- 401 alindiginda frontend oturumu dusurme davranisi eklendi.
- Layout'taki sabit kullanici ismi ve sabit bildirim hissi kaldirildi.

Veri tarafinda:

- `tools/import_veri.py` eklendi.
- `veri/` altindaki tahmin, tuketim, uretim, nufus ve iklim Excel dosyalari repoya alindi.
- Bu veri katmani, sonraki sprintlerde AI analizi ve bolgesel analiz ekranlarinin mock'tan cikarilmasi icin temel oldu.

### Karsilasilan Durumlar

Bu sprintte asil karsilasilan sorun, uygulamanin onceki halinde kullanici baglaminin yeterince net olmamasiydi. Profil ve tarla gibi veriler kullaniciya ozel gorunse bile teknik olarak oturumdaki kullanici ile garanti altina alinmiyordu. Sprint 1 bunu session tablosu, auth dependency ve frontend route guard ile cozdu.

Ikinci konu, veritabani semasinin ileriki sprintleri tasiyacak kadar genis tutulmasiydi. Bu nedenle yalnizca login degil, kullanici session, tarla, plan ve analiz tablolarina zemin hazirlayan bir DB yapi kurulmaya baslandi.

### Sonuc

Sprint 1 sonunda uygulama demo akistan cikti. Kullanici giris yapabiliyor, session ile taniniyor, kendi profilini ve tarlalarini yonetebiliyor hale geldi. Bu, Sprint 2'de planlarin gercek kullaniciya bagli kaydedilebilmesi icin gerekliydi.

## 4. Ara Duzeltme: Turkce Karakterler ve Sunucu Baslatma Notu

Commit: `3c0da7b`  
Tarih: 03.04.2026 19:07  
Odak: Metinlerdeki bozulmus Turkce karakterleri duzeltmek ve sunucu baslatma bilgisini eklemek.

### Neden Yapildi?

Sprint 1'den sonra uygulama teknik olarak daha gercekci hale geldi, fakat kullanici arayuzunde ve backend mesajlarinda Turkce karakterler bozuk gorunuyordu. Ornegin `Bu?day`, `M?s?r`, `Giri?` gibi metinler hem sunum kalitesini dusuruyor hem de tarimsal urun isimlerinde anlam karmasasi olusturuyordu.

### Yapilanlar

- `backend/main.py` icindeki urun etiketleri, hata mesajlari, ay adlari ve aciklama metinleri duzeltildi.
- `frontend/src/pages/Login.jsx`, `Profile.jsx`, `Layout.jsx`, `ProtectedRoute.jsx` ve API yardimci dosyalarindaki metinler temizlendi.
- `sunucubaslat.txt` eklendi. Bu dosya sunucularin nasil baslatilacagina dair pratik not olarak kullanildi.

### Sonuc

Bu commit fonksiyonel bir sprintten cok kalite duzeltmesi niteligindeydi. Ancak rapor acisindan onemli, cunku "sirasiyla nelerle karsilastik" sorusunun cevabinda ilk karsilasilan gercek sorunlardan biri Turkce metin/encoding problemiydi.

## 5. Sprint 2: Plan Akisi ve Bolgesel Analizi DB Tabanli Yapma

Commit: `0658933`  
Tarih: 03.04.2026 19:53  
Odak: Kullanicinin sistemde gercek bir is yapabilmesi: plan olusturma, planin DB'ye yazilmasi ve bolgesel analizin gercek veriden beslenmesi.

### Neden Yapildi?

Sprint 1 kullanici baglamini cozdu. Bir sonraki problem, kullanicinin uygulamada olusturdugu planin sadece frontend state'inde kalmasiydi. Eger plan DB'ye yazilmazsa AI analiz ekrani da gercek bir `planId` uzerinden ilerleyemezdi.

Ayrica bolgesel analiz sayfasi da MVP savunmasi icin mock veya random veri hissinden cikmaliydi. Bolgesel analiz, secilen sehir icin veritabanindaki uretim, iklim ve model verilerine dayanmaliydi.

### Yapilanlar

Backend tarafinda:

- `app.production_plans` tablosu `city` ve `district` alanlariyla genisletildi.
- `idx_plans_city_year` gibi sorgu performansi icin indeksler eklendi.
- `backend/db/bootstrap.py` ve `backend/db/repositories.py` plan ve bolgesel analiz akisini destekleyecek sekilde guncellendi.
- `backend/main.py` icinde plan olusturma, plan listeleme, plan detayi ve bolgesel analiz endpoint'leri guclendirildi.

Frontend tarafinda:

- `PlanWizard.jsx` local state odakli bir akistan DB'ye plan yazan bir akisa tasindi.
- Plan olusturulduktan sonra AI analiz ekrani `planId` ile acilir hale geldi.
- Sehir bazli urun secenekleri backend'den cekilmeye baslandi.
- `RegionalAnalysis.jsx` mock veri yerine DB kaynakli iklim, uretim ve onerilen urun verilerini kullanacak sekilde yenilendi.
- `AiRecommendations.jsx` Sprint 2 seviyesinde kayitli plan ve gercek trend verisini okuyacak hale getirildi.

### Karsilasilan Durumlar

Birinci sorun, PlanWizard'in kullanici girdisini sadece sayfa icinde tutmasiydi. Bu durum, sayfa yenilenince veya analiz ekranina gidince verinin kopmasina neden olabilirdi. Cozum olarak plan DB'ye yazildi ve sonraki ekranlar `planId` uzerinden calismaya basladi.

Ikinci sorun, bolgesel analiz ekraninda veri kaynagi netligiydi. Random veya sabit degerler yerine `analytics` tablolari ve repo sorgulari kullanilarak sehir bazli gercek gorunum olusturuldu.

Ucuncu konu, Sprint 2 commit mesajinda da belirtildigi gibi AI skor formulu henuz bu sprintte derinlestirilmedi. Yani Sprint 2, AI motorunu tamamen cozmek yerine AI motorunun kullanacagi plan ve bolgesel veri temelini hazirladi.

### Sonuc

Sprint 2 sonunda kullanici sistemde gercek bir uretim plani olusturabiliyor, bu plan DB'ye kaydediliyor, AI ekrani kayitli plan uzerinden aciliyor ve bolgesel analiz mock'tan cikarak veritabanina dayaniyordu.

## 6. Sprint 3: Gercek AI Onerileri, Skor Kirilimi ve Rapor Gecmisi

Commit: `f6dc5f3`  
Tarih: 03.04.2026 20:44  
Odak: AI analiz ekranini gercek verilerle calistirmak, analiz sonucunu DB'ye snapshot olarak kaydetmek ve rapor gecmisini profil sayfasindan tekrar acilabilir yapmak.

### Neden Yapildi?

Sprint 2 plan akisini DB'ye bagladi. Ancak kullanici "analiz et" dediginde sistemin gercekten gecmis uretim, model tahmini, tuketim ve iklim verilerinden skor uretmesi gerekiyordu.

Bu sprintte asil soru suydu:

> Kullanici bir il, donum ve urun secince sistem gercek veriye dayali bir puan ve alternatif urun onerisi uretebiliyor mu?

Bu soru cozulmeden AHP gibi metodolojik bir katmana gecmek erken olurdu. Once calisan, kaydedilen ve tekrar acilabilen gercek analiz akisi kuruldu.

### Yapilanlar

Backend tarafinda:

- `app.ai_analyses` tablosu genisletildi.
- `app.ai_recommendations` tablosu genisletildi.
- Analiz icin `score`, `confidence_score`, `summary`, `climate_comment`, `market_comment`, `model_name`, `selected_crop_name`, `focus_crop_name`, `forecast_year`, `planned_area_decare`, `expected_yield_kg_decare`, `expected_production_ton`, `score_breakdown` gibi alanlar tutulmaya baslandi.
- `POST /api/ai/analyze-plan` artik plan verisinden baslayip aday urunleri veritabanindan alip skorlayacak hale getirildi.
- `GET /api/analyses` ve `GET /api/analyses/{analysis_id}` endpoint'leri eklendi.
- Ayni plan degismediyse mevcut analizi tekrar kullanma, yani cache/snapshot davranisi eklendi.
- Profil sayfasindaki rapor listesi plan gecmisi yerine gercek AI analiz gecmisinden beslenmeye basladi.

Frontend tarafinda:

- `AiRecommendations.jsx` kayitli analizleri `analysisId` ile acacak hale getirildi.
- Secilen urun ozeti, guven skoru, puan kirilimi ve alternatif urunler gosterildi.
- `Profile.jsx` icinde "Raporu Aç" akisi gercek analiz snapshot'ina baglandi.
- `AiRecommendations.css` yeni analiz kartlari ve skor kirilimi icin guncellendi.

### AHP Oncesi Manuel Agirliklar

Sprint 3'te skor calisiyordu ama agirliklar henuz AHP ile uretilmemisti. Committeki calisan kodda skor su mantikla hesaplaniyordu:

```text
toplam_skor =
  gecmis_verim_skoru * 0.32 +
  model_projeksiyonu_skoru * 0.33 +
  tuketim_egilimi_skoru * 0.17 +
  iklim_dayanikliligi_skoru * 0.18
```

Puan kiriliminda kullaniciya su yuzdeler gosteriliyordu:

| Kriter | Sprint 3 manuel agirlik |
|---|---:|
| Gecmis verim | %32 |
| Model projeksiyonu | %33 |
| Tuketim egilimi | %17 |
| Iklim dayanikliligi | %18 |

Bu agirliklar bizim belirledigimiz, calisan MVP icin makul ama metodolojik olarak savunmasi zayif sabit katsayilardi. Yani sistem skor uretiyordu, fakat "neden model projeksiyonu %33, neden iklim %18?" sorusuna matematiksel bir cevap veremiyordu.

### Karsilasilan Durumlar

Birinci sorun, AI ekraninin sadece guzel gorunen bir arayuz olmaktan cikip gercek veriyle calismasi gerekliligiydi. Bu nedenle secilen plan, aday urunler, gecmis verim, model tahmini, tuketim verisi ve iklim riski ayni analiz akisi icinde birlestirildi.

Ikinci sorun, analizlerin tekrar acilabilir olmasiydi. Eger analiz sonucunu sadece frontend'de hesaplayip gosterirsek, kullanici daha sonra profilden eski raporu acamazdi. Bu nedenle analiz snapshot'i DB'ye kaydedildi.

Ucuncu sorun, skorun calismasina ragmen agirliklarin manuel kalmasiydi. Bu bilincli olarak Sprint 4'e birakildi. Sprint 3'un cikis hedefi metodoloji degil, once gercek veri ile calisan AI analiz hattini kurmakti.

### Sonuc

Sprint 3 sonunda sistem secilen plan icin gercek verilerden skor ureten, alternatif urun onerileri veren, guven skoru gosterip analiz sonucunu DB'ye kaydeden bir yapida calisti. Ancak bu noktada skor formulu hala manuel agirliklara dayaniyordu.

## 7. Sprint 3 Sonrasi Duzeltmeler: Kalan Mock Benzeri Bosluklar

Commitler: `be809f2`, `eb7cb38`  
Tarih: 03.04.2026 21:13 ve 21:35  
Odak: Analiz akisini tamamlama, kalan veri bosluklarini temizleme ve bolgesel analiz gorselini iyilestirme.

### Neden Yapildi?

Sprint 3'te ana analiz akisi kurulmus olsa da, gercek kullanimda bazi kenar durumlar kaldi:

- AI uretim projeksiyon serisinde 2025 yilina dair bosluk hissi.
- Plan sihirbazinda sehir bazli tum gecerli urunlerin gosterilmesi gerekliligi.
- Bolgesel analizde 5Y / 10Y / Tum Veri araligi ihtiyaci.
- Analiz ekrani acildiginda son raporun otomatik acilmasi veya rapor yoksa kullanicinin plan olusturmaya yonlendirilmesi.
- Iklim ekraninda donem ve yagis etiketlerinin Turkceye daha iyi oturmasi.
- Backend'de `history_range` kaynakli gizli endpoint hatalarinin temizlenmesi.

### Yapilanlar

- `backend/db/repositories.py` ve `backend/main.py` uzerinde kalan endpoint/sorgu hatalari temizlendi.
- `AiRecommendations.jsx` analiz akisini daha tamamli hale getirecek sekilde guncellendi.
- `ClimateMarket.jsx` ve `RegionalAnalysis.jsx` uzerinde etiket ve veri sunumu iyilestirildi.
- `RegionalAnalysis.css` ve `RegionalAnalysis.jsx` ile bolgesel analiz ekraninin kontrasti ve renk paleti iyilestirildi.

### Sonuc

Bu commitler, Sprint 3 ile Sprint 4 arasinda sistemin "calisiyor ama bazi yerlerde demo hissi var" durumunu toparladi. Bu sayede Sprint 4'te skorlama metodolojisine gecildiginde temel akista daha az belirsizlik kaldi.

## 8. Sprint 4: AHP, Backtest, Model Guveni ve Arz-Talep Dengesi

Commit: `93b7887`  
Tarih: 03.04.2026 23:43  
Odak: AI skor sistemini sadece calisan degil, akademik ve teknik olarak savunulabilir hale getirmek.

### Neden Yapildi?

Sprint 3 sonunda sistem gercek verilerle skor uretiyordu. Fakat kritik soru hala acikti:

> Urun uygunluk skoru nereden geliyor ve neden bu agirliklarla hesaplaniyor?

Sprint 3'te kullandigimiz %32, %33, %17, %18 agirliklari bizim belirledigimiz sabit katsayilardi. Bu, MVP icin calisirdi ama rapor/sunum tarafinda zayifti. AHP, bu sorunu cozmek icin secildi.

AHP'nin secilme nedeni:

- Karar problemi cok kriterliydi: gecmis verim, model projeksiyonu, tuketim/talep ve iklim dayanıkliligi ayni anda degerlendirilmeliydi.
- Kriterler esit onemde degildi.
- Uzman yorumu ikili karsilastirma matrisiyle sayisallastirilabilirdi.
- Elde edilen agirliklarin tutarliligi `Consistency Ratio` ile kontrol edilebilirdi.
- Agirliklar kodun icinden cikarilip dosyadan yonetilebilir hale getirilebilirdi.

### Yapilanlar

Yeni dosyalar:

- `backend/scoring.py`
- `backend/scoring_profile.json`
- `backend/devtools/ahp_backtest.py`
- `docs/ahp_pairwise_matrix.csv`
- `docs/ahp_metodoloji.md`
- `docs/ahp_backtest_report.json`

Guncellenen ana dosyalar:

- `backend/main.py`
- `backend/db/repositories.py`
- `frontend/src/pages/AiRecommendations.jsx`
- `frontend/src/pages/AiRecommendations.css`
- `docs/mvp_sprint_plan.html`

Backend tarafinda:

- Skor hesabi `backend/scoring.py` icine ayrildi.
- Agirliklar `backend/scoring_profile.json` dosyasindan okunur hale geldi.
- `compute_weighted_score` fonksiyonu ile toplam skor hesaplandi.
- `get_scoring_profile` ile profil okuma ve agirlik yuzdelerini olusturma islemi merkezilesti.
- Gecmis verim skoru metodolojik olarak duzeltildi: artik farkli urunleri ayni havuzda karsilastirmak yerine, ayni urunun sehir performansini ulusal ayni-urun baglaminda degerlendiriyor.
- Model guveni, Sprint 3'teki SMAPE/WAPE temelli heuristik yorumdan cikti ve walk-forward kalibrasyonuna dayali basari olasiligina donustu.
- Arz-talep dengesi icin urun bazli tahmini uretim ve tahmini tuketim karsilastirmasi eklendi.

Frontend tarafinda:

- AI analiz ekranina model guveni detaylari eklendi.
- Kalibrasyon seviyesi, yerel orneklem sayisi, referans orneklem, gozlenen kapsama ve olasilik araligi gosterildi.
- Arz-talep dengesi karti eklendi.
- Grafik serisine gecmis uretim, tahmini uretim ve tahmini tuketim birlikte dahil edildi.
- Puan kirilimi artik AHP agirlik profilinden gelen yuzdelerle gosterildi.

## 9. AHP Oncesi ve Sonrasi Agirlik Degisimi

### AHP Oncesi: Sprint 3 Manuel Agirliklari

Sprint 3'te agirliklar kod icine gomulu manuel degerlerdi:

| Kriter | Sprint 3 agirligi | Yorum |
|---|---:|---|
| Gecmis verim | %32 | Yerel uretim basarisi icin onemli kabul edildi |
| Model projeksiyonu | %33 | Gelecek potansiyeli icin en yuksek agirliklardan biri verildi |
| Tuketim egilimi | %17 | Pazar/talep yonu eklendi ama daha dusuk tutuldu |
| Iklim dayanıkliligi | %18 | Risk ve stabiliteyi temsil etti |

Bu yapi calisiyordu, fakat bu sayilarin neden bu degerler oldugu sistematik degildi. Ayrica agirliklar kodun icindeydi. Yani yeni bir agirlik profili denemek icin kod degistirmek gerekiyordu.

### AHP Matrisi

Sprint 4'te AHP icin ikili karsilastirma matrisi `docs/ahp_pairwise_matrix.csv` dosyasina alindi:

| Kriter | Gecmis verim | Projeksiyon | Tuketim | Iklim |
|---|---:|---:|---:|---:|
| Gecmis verim | 1 | 1/2 | 2 | 1 |
| Projeksiyon | 2 | 1 | 3 | 2 |
| Tuketim | 1/2 | 1/3 | 1 | 1/2 |
| Iklim | 1 | 1/2 | 2 | 1 |

Bu matris su yoruma dayaniyor:

- Model projeksiyonu, ileriye donuk karar destek sistemi oldugu icin en baskin kriter kabul edildi.
- Gecmis verim ile iklim dayanıkliligi esit seviyede tutuldu.
- Tuketim egilimi karar icin onemli ama agronomik ve model temelli kriterlerin arkasinda konumlandirildi.

### AHP Sonrasi Hesaplanan Agirliklar

AHP hesaplamasi sonucunda aktif profil su sekilde olustu:

| Kriter | AHP agirligi | Yuzde | Degisim |
|---|---:|---:|---|
| Gecmis verim | 0.2270444651 | %22.7 | Sprint 3'teki %32'den dustu |
| Model projeksiyonu | 0.4235869133 | %42.4 | Sprint 3'teki %33'ten belirgin sekilde artti |
| Tuketim egilimi | 0.1223241565 | %12.2 | Sprint 3'teki %17'den dustu |
| Iklim dayanıkliligi | 0.2270444651 | %22.7 | Sprint 3'teki %18'den artti |

Yeni formul:

```text
toplam_skor =
  gecmis_verim_skoru * 0.2270 +
  model_projeksiyonu_skoru * 0.4236 +
  tuketim_egilimi_skoru * 0.1223 +
  iklim_dayanikliligi_skoru * 0.2270
```

Bu degisimle agirliklar artik "biz boyle uygun gorduk" seviyesinden cikti. Kriterler ikili karsilastirildi, matris dosyaya alindi, hesaplanan sonuc profile yazildi ve tutarlilik kontrolu yapildi.

### Tutarlilik Kontrolu

AHP matrisinden elde edilen tutarlilik degerleri:

| Metrik | Deger | Yorum |
|---|---:|---|
| Lambda max | 4.0103629022 | 4 kriterli matris icin ideal 4'e cok yakin |
| Consistency Index | 0.0034543007 | Tutarsizlik cok dusuk |
| Consistency Ratio | 0.0038381119 | 0.10 esiginin cok altinda |
| Karar | Kabul edilebilir | Matris tutarli kabul edildi |

Bu sonuc, uzman yorumu ile verilen karsilastirmalarin kendi icinde celiskili olmadigini gosterdi.

## 10. Backtest: AHP Agirliklari Gercek Veride Ne Yaptı?

AHP agirliklari teoride mantikli olabilir, fakat sistemin gecmis senaryolarda nasil davrandigini gormek gerekiyordu. Bu nedenle `backend/devtools/ahp_backtest.py` scripti yazildi.

Not: Aşağıdaki metrikler ilk Sprint 4 koşusunun ham çıktısıdır; ürün-level horizon=1 mimarisine göre güncel değerlendirme için `docs/ahp_backtest_report.json` esas alınmalıdır.

### Backtest Tasarimi

- Donem: 2020-2024
- Senaryo tanimi: sehir + tahmin yili
- Toplam senaryo: 405
- Toplam aday kayit: 60,820
- Veri kaynagi: `analytics.walk_forward_predictions`, `analytics.production_history`, `analytics.consumption_history`, `analytics.climate_history`

Scriptin akisi:

1. AHP matrisi `docs/ahp_pairwise_matrix.csv` dosyasindan okunur.
2. AHP agirliklari hesaplanir.
3. 2020-2024 arasindaki walk-forward tahmin senaryolari cekilir.
4. Her aday urun icin gecmis verim, model tahmini, tuketim ve iklim alt skorlari uretilir.
5. AHP agirliklariyla toplam skor hesaplanir.
6. Sistem siralamasi gercek uretim siralamasi ile karsilastirilir.
7. Sonuc `docs/ahp_backtest_report.json` dosyasina yazilir.

### Backtest Sonuclari

| Metrik | Sonuc | Yorum |
|---|---:|---|
| Senaryo sayisi | 405 | 81 il x 5 yil mantigina yakin genis senaryo seti |
| Aday sayisi | 60,820 | Urun-senaryo bazli siralama alani |
| Top-1 exact rate | %15.31 | Sistem her zaman tek birinci urunu bulmuyor |
| Top-3 hit rate | %74.57 | Ilk onerinin gercek ilk 3'e girme orani yuksek |
| Mean Spearman | 0.4141 | Sistem siralamasi ile gercek siralama arasinda orta duzey korelasyon var |
| Mean nDCG@3 | 0.9178 | Ilk 3 onerinin kalite skoru guclu |

### Backtest Yorumu

Bu sonuc bize sunu gosterdi:

- Sistem "kesin karar verici" olarak konumlandirilmamali.
- Top-1 basari dusuk oldugu icin "bu urunu ekersen kesin en iyi sonuc" denemez.
- Ancak Top-3 hit rate %74.57 ve nDCG@3 0.9178 oldugu icin sistem, ciftciye guclu bir aday havuzu sunan karar destek araci olarak savunulabilir.
- Bu nedenle Sprint 4 sonunda anlatim "tek dogru urun tahmini" degil, "veriye dayali ilk 3 aday seti" olarak kuruldu.

## 11. Model Guveninin Degisimi

### Sprint 3'teki Durum

Sprint 3'te model guveni SMAPE/WAPE gibi hata metriklerinden turetilen heuristik bir yuzdeydi. Temel mantik su sekildeydi:

```text
confidence_score = 100 - (SMAPE * 1.1) - (WAPE * 0.35)
```

Bu yapi anlasilir ve hizliydi ama kullaniciya su sorunun cevabini dogrudan vermiyordu:

> Bu onerinin benzer gecmis senaryolarda basarili olma olasiligi nedir?

### Sprint 4'teki Durum

Sprint 4'te model guveni walk-forward kalibrasyonuna dayali basari olasiligi olarak yeniden tasarlandi.

Yeni mantik:

- Sehir + urun + tahmin ufku seviyesinde benzer walk-forward senaryolari aranir.
- Yerel orneklem yetersizse urun + tahmin ufku veya genel tahmin ufku referans alinir.
- Kucuk orneklem etkisi ampirik Bayes kalibrasyonu ile yumusatilir.
- Kullaniciya yalnizca tek skor degil, kalibrasyon seviyesi, orneklem sayisi, gozlenen kapsama, hata yuzdesi ve olasilik araligi da gosterilir.

Bu degisiklik, model guvenini "ortalama hata dusuk gorunuyor" seviyesinden "benzer gecmis senaryolarda bu onerinin basari olasiligi su" seviyesine tasidi.

## 12. Arz-Talep Dengesi Katmani

Sprint 4'te tuketim egilimi yalnizca soyut bir skor olarak kalmadi. AI analiz ekranina arz-talep dengesi karti eklendi.

Bu katmanda:

- Tahmini uretim
- Tahmini tuketim
- Karsilama orani
- Denge farki
- Arz acigi, dengeli durum veya uretim fazlasi etiketi

hesaplaniyor ve gosteriliyor.

Bu katmanin onemi, tarimsal kararin sadece "burada yetisir mi?" sorusuna indirgenmemesidir. Sprint 4 ile sistem "piyasa baskisi var mi, talep uretimi karsiliyor mu?" sorularina da bir cevap vermeye basladi.

Veri siniri de acikca not edildi: Tuketime dair veri Turkiye geneli oldugu icin bu analiz il bazinda kesin ithalat/ihracat yorumu yapmaz. Ulusal urun dengesi seviyesinde karar destegi sunar.

## 13. Sprint 4 Rapor Commit'i

Commit: `173fd6b`  
Tarih: 03.04.2026 23:49  
Odak: Sprint 4 model/AHP raporunun dokuman olarak eklenmesi.

Bu commit ile `docs/sprint4_ahp_model_dogrulama_raporu.html` dosyasi eklendi. Bu dosya Sprint 4 kapsamindaki metodolojik gelistirmeleri sunum/rapor formatinda aciklar:

- AHP ile kriter agirliklarinin uretilmesi
- Tutarlilik kontrolu
- Walk-forward backtest kurgusu
- Model guveninin yeniden tasarimi
- Arz-talep dengesi katmani
- Sprint 4 sonuc ve sinirliliklari

Bu dokuman, kod tarafinda yapilan Sprint 4 gelistirmesinin akademik savunma metnine donusmus halidir.

## 14. 06 Nisan Kapanis Commit'i

Commit: `15232ba`  
Tarih: 06.04.2026 15:22  
Odak: `.gitignore` guncellemesi.

Bu committe `.gitignore` dosyasina su iki satir eklendi:

```text
docs/danisman_birlesik_dokuman.html
docs/mac_kurulum_rehberi.html
```

Bu, sprint fonksiyonlarindan cok dokuman ciktilarini depo takibinden ayirmaya yonelik bir temizliktir. Haftalik rapor acisindan ana gelistirme 03.04.2026 tarihinde tamamlanmis, 06.04.2026'da ise repo duzeniyle ilgili kucuk bir kapanis yapilmistir.

## 15. Genel Haftalik Degerlendirme

Bu haftada proje dort asamali bir olgunlasma gecirdi:

1. Once gercek kullanici ve session zemini kuruldu.
2. Sonra kullanicinin gercek plan olusturmasi ve bolgesel verileri DB uzerinden gormesi saglandi.
3. Ardindan AI analizleri gercek veriyle hesaplanan, kaydedilen ve tekrar acilan raporlara donustu.
4. Son olarak skor sistemi AHP, backtest, model guveni kalibrasyonu ve arz-talep dengesi ile metodolojik olarak savunulabilir hale getirildi.

En kritik evrim, Sprint 3'ten Sprint 4'e geciste yasandi. Sprint 3'te sistem artik calisiyordu ama skoru bizim belirledigimiz sabit agirliklarla uretiyordu. Sprint 4'te bu agirliklar AHP ile hesaplandi, dosyadan okunur hale getirildi ve 2020-2024 walk-forward senaryolarinda test edildi.

Son durum su sekilde ozetlenebilir:

- Sistem gercek kullanici oturumu ile calisiyor.
- Planlar ve tarlalar kullaniciya ozel DB kayitlari olarak tutuluyor.
- Bolgesel analiz random/mock veriden cikti.
- AI onerileri gercek verilerden uretiliyor.
- Analizler snapshot olarak saklaniyor ve profilden tekrar aciliyor.
- Skor formulu AHP agirliklari ile calisiyor.
- Model guveni heuristik hata yuzdesinden kalibre edilmis basari olasiligina tasindi.
- Arz-talep dengesi AI karar ekranina eklendi.
- Backtest sonucunda sistemin tek karar verici degil, ilk 3 aday havuzu sunan karar destek araci olarak konumlanmasi gerektigi netlesti.

## 16. Sunumda Kullanilabilecek Kisa Anlatim

03.04.2026 tarihinden itibaren proje once teknik temelini guclendirdi: Sprint 1'de gercek auth/session ve kullaniciya ozel profil-tarla yonetimi kuruldu. Sprint 2'de plan olusturma ve bolgesel analiz DB tabanli hale getirildi. Sprint 3'te AI analiz ekrani gercek uretim, model tahmini, tuketim ve iklim verilerinden skor ureten, sonucu kaydeden ve rapor gecmisinden tekrar acilabilen bir yapida calisti.

Sprint 3'te urun skoru calisiyordu ama agirliklar manuel olarak belirlenmisti: gecmis verim %32, model projeksiyonu %33, tuketim %17, iklim %18. Sprint 4'te bu zayiflik giderildi. AHP ikili karsilastirma matrisi olusturuldu, agirliklar sistematik olarak hesaplandi ve yeni profil su hale geldi: gecmis verim %22.7, model projeksiyonu %42.4, tuketim %12.2, iklim %22.7. Tutarlilik orani 0.00384 cikti ve 0.10 esiginin cok altinda oldugu icin matris kabul edilebilir bulundu.

Son olarak AHP tabanli skor sistemi 2020-2024 walk-forward senaryolarinda test edildi. 405 senaryo ve 60,820 aday kayit uzerinde Top-1 exact rate %15.31, Top-3 hit rate %74.57, Mean Spearman 0.4141 ve Mean nDCG@3 0.9178 bulundu. Bu sonuc, sistemin tek bir kesin karar verici degil, ciftciye guclu bir ilk 3 aday havuzu sunan veri temelli karar destek araci olarak degerlendirilmesi gerektigini gosterdi.
