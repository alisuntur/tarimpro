# Uretim Modeli

Bu klasor uretim tahmin modelinin duzeltilmis calisma alanidir.

- Notebook: `dengeli_xgboost_direct_horizon_guardrailli_pipeline.ipynb`
- Cikti: `Dengeli_XGBoost_DirectHorizon_2025_2027_Tahminler.xlsx`
- Ana metodolojik duzeltme: urun/sehir/seri tarihsel istatistikleri artik ayni yil satirlarini karistirmadan, yalnizca ilgili satirin yilindan onceki yillardan hesaplanir.
- Yeniden egitim icin `.venv` icinde `xgboost`, `scikit-learn`, `matplotlib`, `pandas`, `numpy`, `openpyxl` gerekir.
- Full walk-forward backtest uzun surebilir; notebook artik fold bazli progress mesaji basar.
