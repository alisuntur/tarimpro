# TarimPro AHP ve Backtest Metodolojisi

## 1. Amaç
Bu çalışma, ürün öneri skorunun sabit ve gerekçesiz katsayılardan çıkarılıp savunulabilir bir çok kriterli karar verme yaklaşımına taşınması için hazırlanmıştır. Sistem artık dört ana kriteri birlikte değerlendirir:

- Geçmiş verim
- Model projeksiyonu
- Tüketim eğilimi
- İklim dayanıklılığı

## 2. Neden AHP?
AHP, kriterler arasındaki göreli önemi uzman görüşü ile sayısallaştırmak için kullanılmıştır. Tarımsal karar probleminde her kriter aynı önemde değildir. Özellikle ileriye dönük karar desteğinde model projeksiyonu ve agronomik uygulanabilirlik birlikte ele alınmalıdır.

Bu projede AHP şu amaçlarla kullanılmıştır:
- Başlangıç ağırlıklarını sistematik biçimde üretmek
- Kriter önceliklerini açıkça belgelemek
- Tutarlılık oranı üzerinden uzman kararlarının kalitesini kontrol etmek

## 3. Kullanılan Kriterler
### 3.1 Geçmiş verim
İlgili şehir ve ürün için son 5 yıllık `yield_kg_decare` verileri üzerinden hesaplanır. Amaç, yerel üretim başarısını ve üretim istikrarını temsil etmektir.

### 3.2 Model projeksiyonu
`analytics.model_predictions` veya backtest senaryosunda `analytics.walk_forward_predictions` kullanılır. Amaç, gelecek dönemde beklenen üretim potansiyelini temsil etmektir.

### 3.3 Tüketim eğilimi
`analytics.consumption_history` tablosundaki tüketim metrikleri kullanılır. Amaç, sadece üretilebilir değil aynı zamanda talep gören ürünleri öne çıkarmaktır.

### 3.4 İklim dayanıklılığı
Şehrin iklim göstergeleri ile ürünün tarihsel stabilitesi birlikte değerlendirilir. Amaç, ürünün ilgili şehirde iklim riskine karşı daha dayanıklı olup olmadığını temsil etmektir.

## 4. AHP İkili Karşılaştırma Matrisi
AHP matrisi `docs/ahp_pairwise_matrix.csv` dosyasında tutulur.

| Kriter | Geçmiş verim | Projeksiyon | Tüketim | İklim |
|---|---:|---:|---:|---:|
| Geçmiş verim | 1 | 1/2 | 2 | 1 |
| Projeksiyon | 2 | 1 | 3 | 2 |
| Tüketim | 1/2 | 1/3 | 1 | 1/2 |
| İklim | 1 | 1/2 | 2 | 1 |

Bu kurgu şu yoruma dayanır:
- Projeksiyon, ileriye dönük öneri üretildiği için en baskın kriterdir.
- Geçmiş verim ile iklim dayanıklılığı aynı seviyede tutulmuştur.
- Tüketim eğilimi önemlidir fakat agronomik kriterlerin gerisindedir.

## 5. Elde Edilen Ağırlıklar
AHP çözümü sonucunda ağırlıklar aşağıdaki gibi hesaplanmıştır:

| Kriter | Ağırlık | Yüzde |
|---|---:|---:|
| Geçmiş verim | 0.2270 | %22.7 |
| Model projeksiyonu | 0.4236 | %42.4 |
| Tüketim eğilimi | 0.1223 | %12.2 |
| İklim dayanıklılığı | 0.2270 | %22.7 |

Bu ağırlıklar `backend/scoring_profile.json` dosyasına kaydedilmiştir.

## 6. Tutarlılık Kontrolü
AHP matrisi için hesaplanan değerler:
- Lambda max: 4.0104
- CI: 0.00345
- CR: 0.00384

AHP literatüründe genel kabul gören koşul `CR < 0.10` olduğundan bu matris tutarlı kabul edilmiştir.

## 7. Skor Formülü
Ürün uygunluk skoru aşağıdaki formül ile hesaplanır:

```text
Toplam Skor =
  (Geçmiş Verim x 0.2270) +
  (Projeksiyon x 0.4236) +
  (Tüketim x 0.1223) +
  (İklim x 0.2270)
```

Her alt kriter önce 0-100 bandına normalize edilir. Sonra bu ağırlıklarla tek bir toplam puana dönüştürülür.

## 8. Backtest Yaklaşımı
Backtest scripti `backend/devtools/ahp_backtest.py` dosyasındadır.

Scriptin çalışma mantığı:
1. AHP matrisi `docs/ahp_pairwise_matrix.csv` dosyasından okunur.
2. Ağırlıklar ve tutarlılık oranı hesaplanır.
3. `analytics.walk_forward_predictions` tablosundan 2020-2024 şehir-yıl senaryoları çekilir.
4. Her ürün için son 5 yıllık verim, model tahmini, tüketim ve iklim puanları yeniden üretilir.
5. Sistem sıralaması, gerçek üretim sonuçları ile karşılaştırılır.

## 9. Backtest Metrikleri
Script aşağıdaki metrikleri üretir:
- `top1ExactRate`: En yüksek skorlu ürün gerçekten birinci çıktı mı?
- `top3HitRate`: En yüksek skorlu ürün gerçek ilk 3 içinde mi?
- `meanSpearman`: Sistem sıralaması ile gerçek sıralama arasındaki korelasyon
- `meanNdcgAt3`: İlk 3 önerinin kalite skoru

Rapor dosyası varsayılan olarak `docs/ahp_backtest_report.json` içine yazılır.

## 10. Uygulama Entegrasyonu
API tarafında skor hesabı artık sabit katsayılar yerine `backend/scoring_profile.json` içindeki ağırlıkları kullanır. Böylece:
- ağırlıklar koddan ayrılmış olur
- yeni AHP matrisi ile profil güncellenebilir
- backtest sonrası yeni ağırlıklar sisteme kontrollü biçimde alınabilir

## 11. Akademik Savunma Metni
Bu projede ürün uygunluk skoru, çok kriterli karar verme yaklaşımı ile hesaplanmaktadır. Kriter ağırlıkları Analitik Hiyerarşi Prosesi (AHP) kullanılarak projenin amacına uygun olarak ekip arkadaşımla yorumlamaya dayalı olarak elde edilmiş, ardından walk-forward tahmin seti üzerinde şehir-yıl bazlı backtest ile sıralama performansı test edilmiştir. Böylece öneri sistemi hem projenin amacına hem de tarihsel doğrulamaya dayanan hibrit bir yapıya taşınmıştır.

## 12. Sonraki Aşama
Bir sonraki aşamada aşağıdakiler önerilir:
- AHP matrisini ziraat mühendisi, iklim uzmanı ve pazar uzmanı ile yeniden doldurmak
- Şehir + ürün bazlı ayrı ağırlık kalibrasyonu yapmak
- Backtest sonuçlarına göre profil sürümlemek
- Güven skorunu genel model seviyesinden şehir + ürün seviyesine indirmek
