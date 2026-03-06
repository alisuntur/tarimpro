import React, { useState } from 'react';
import { CITIES, CROPS } from '../constants';
import { AnalysisResult } from '../types';
import { Sprout, AlertTriangle, CheckCircle, ArrowRight, Loader2 } from 'lucide-react';

const ProductPlanning: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedCrop, setSelectedCrop] = useState('');
  const [landSize, setLandSize] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleCalculate = () => {
    if (!selectedCity || !selectedCrop || !landSize) return;

    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const cropName = CROPS.find(c => c.id === selectedCrop)?.name || '';

      // Mock logic for demo
      const isHighRisk = cropName === 'Ayçiçeği' && selectedCity === '42'; // High risk for Sunflower in Konya (mock)

      setResult({
        cropName,
        recommendationScore: isHighRisk ? 45 : 88,
        yieldForecast: isHighRisk ? 250 : 450,
        priceForecast: isHighRisk ? 12.5 : 8.4,
        riskLevel: isHighRisk ? 'High' : 'Low',
        riskMessage: isHighRisk
          ? `${cropName} üretimi ilinizde su kısıtı nedeniyle yüksek risk taşımaktadır.`
          : `${cropName} üretimi ilinizde talep açığı verebilir. Ekim önerisi: +%25`
      });
      setLoading(false);
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Ürün Planlama Modülü</h1>
        <p className="text-slate-500 dark:text-slate-400">Araziniz ve bölgeniz için en doğru ürünü bilimsel verilerle seçin.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Input Form */}
        <div className="lg:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 h-fit">
          <h2 className="font-semibold text-lg mb-6 flex items-center gap-2 text-slate-800 dark:text-white">
            <Sprout className="text-emerald-600" />
            Planlama Kriterleri
          </h2>

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">İl Seçimi</label>
              <select
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
              >
                <option value="">İl Seçiniz...</option>
                {CITIES.map(city => (
                  <option key={city.id} value={city.id}>{city.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ürün Seçimi (58 Ürün)</label>
              <select
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
                value={selectedCrop}
                onChange={(e) => setSelectedCrop(e.target.value)}
              >
                <option value="">Ürün Seçiniz...</option>
                {CROPS.map(crop => (
                  <option key={crop.id} value={crop.id}>{crop.name} ({crop.category})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Arazi Büyüklüğü (Dönüm)</label>
              <input
                type="number"
                placeholder="Örn: 50"
                className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500"
                value={landSize}
                onChange={(e) => setLandSize(e.target.value)}
              />
            </div>

            <button
              onClick={handleCalculate}
              disabled={loading || !selectedCity || !selectedCrop || !landSize}
              className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 dark:disabled:bg-emerald-800 text-white font-medium py-3 rounded-lg transition-colors flex justify-center items-center gap-2 mt-4"
            >
              {loading ? <Loader2 className="animate-spin" /> : 'Analiz Et ve Hesapla'}
            </button>
          </div>
        </div>

        {/* Results Display */}
        <div className="lg:col-span-2 space-y-6">
          {!result && !loading && (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-slate-100/50 dark:bg-slate-800/50 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 text-slate-400 dark:text-slate-500">
              <Sprout size={48} className="mb-4 opacity-50" />
              <p className="text-lg">Analiz sonuçlarını görmek için sol taraftan seçim yapınız.</p>
            </div>
          )}

          {loading && (
            <div className="h-full min-h-[400px] flex flex-col items-center justify-center bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
              <Loader2 size={48} className="text-emerald-600 animate-spin mb-4" />
              <p className="text-slate-600 dark:text-slate-300 font-medium">Yapay zeka modelleri çalıştırılıyor...</p>
              <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">İklim verileri, arz-talep dengesi ve toprak yapısı analiz ediliyor.</p>
            </div>
          )}

          {result && !loading && (
            <div className="animate-fade-in space-y-6">
              {/* Main Alert Box */}
              <div className={`p-6 rounded-xl border-l-8 shadow-sm ${result.riskLevel === 'High'
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-500 text-red-900 dark:text-red-200'
                  : 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-500 text-emerald-900 dark:text-emerald-200'
                }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-full ${result.riskLevel === 'High' ? 'bg-red-100 dark:bg-red-900/40' : 'bg-emerald-100 dark:bg-emerald-900/40'
                    }`}>
                    {result.riskLevel === 'High' ? <AlertTriangle size={24} /> : <CheckCircle size={24} />}
                  </div>
                  <div>
                    <h3 className="font-bold text-xl mb-1">
                      {result.riskLevel === 'High' ? 'Dikkat: Yüksek Risk Tespit Edildi' : 'Öneri: Ekim İçin Uygun'}
                    </h3>
                    <p className="opacity-90">{result.riskMessage}</p>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 text-center">
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-1">Ekim Önerisi Skoru</p>
                  <div className="relative w-24 h-24 mx-auto flex items-center justify-center">
                    <svg className="w-full h-full transform -rotate-90">
                      <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-100 dark:text-slate-700" />
                      <circle cx="48" cy="48" r="40" stroke="currentColor" strokeWidth="8" fill="transparent"
                        strokeDasharray={251.2}
                        strokeDashoffset={251.2 - (251.2 * result.recommendationScore) / 100}
                        className={result.recommendationScore > 70 ? 'text-emerald-500' : 'text-amber-500'}
                      />
                    </svg>
                    <span className="absolute text-2xl font-bold text-slate-700 dark:text-white">%{result.recommendationScore}</span>
                  </div>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center items-center">
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">Tahmini Verim</p>
                  <p className="text-3xl font-bold text-emerald-600">{result.yieldForecast}</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">kg / dekar</p>
                </div>

                <div className="bg-white dark:bg-slate-800 p-5 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-center items-center">
                  <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">Tahmini Fiyat</p>
                  <p className="text-3xl font-bold text-blue-600">{result.priceForecast} ₺</p>
                  <p className="text-sm text-slate-400 dark:text-slate-500">kg başına</p>
                </div>
              </div>

              {/* Action Section */}
              <div className="bg-slate-800 dark:bg-slate-700 text-white p-6 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
                <div>
                  <h4 className="font-semibold text-lg">Detaylı Rapor Oluştur</h4>
                  <p className="text-slate-400 dark:text-slate-300 text-sm">Bu analizi PDF olarak indirin veya uzmanla paylaşın.</p>
                </div>
                <button className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 rounded-lg font-medium transition-colors flex items-center gap-2">
                  Raporu İndir <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductPlanning;