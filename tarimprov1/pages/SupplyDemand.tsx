import React from 'react';
import { MOCK_SUPPLY_DEMAND } from '../constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import TurkeyMap from '../components/TurkeyMap';
import { useState, useMemo } from 'react';

const SupplyDemand: React.FC = () => {
  const [selectedCity, setSelectedCity] = useState<string | null>(null);

  const chartData = useMemo(() => {
    if (!selectedCity || selectedCity === 'Türkiye Geneli') {
      return MOCK_SUPPLY_DEMAND;
    }
    // Generate randomized data based on city name length to be deterministic but different
    const seed = selectedCity.length;
    return MOCK_SUPPLY_DEMAND.map(item => ({
      ...item,
      production: item.production * (0.8 + (seed % 5) / 10),
      consumption: item.consumption * (0.9 + (seed % 4) / 10),
    }));
  }, [selectedCity]);

  const handleCitySelect = (city: string) => {
    setSelectedCity(city === selectedCity ? null : city);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Arz-Talep Analizi</h1>
          <p className="text-slate-500">58 ürün için il bazlı denge ve risk analizleri.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm"
            value={selectedCity || 'Türkiye Geneli'}
            onChange={(e) => setSelectedCity(e.target.value === 'Türkiye Geneli' ? null : e.target.value)}
          >
            <option>Türkiye Geneli</option>
            <option>Konya</option>
            <option>Adana</option>
            <option>Ankara</option>
            <option>İzmir</option>
            <option>Antalya</option>
          </select>
          <select className="border border-slate-300 rounded-lg px-3 py-2 bg-white text-sm">
            <option>Buğday</option>
            <option>Mısır</option>
            <option>Ayçiçeği</option>
          </select>
        </div>
      </div>

      {/* Map Placeholder (Stylized) */}
      {/* Interactive Map */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100 relative overflow-hidden h-[500px]">
        <h3 className="font-semibold text-slate-800 mb-4 absolute top-6 left-6 z-10">Türkiye Risk Haritası</h3>
        <div className="absolute right-6 top-6 z-10 flex flex-col gap-2 text-xs font-medium bg-white/90 p-2 rounded shadow-sm backdrop-blur-sm">
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-emerald-500"></div>Seçili</div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-slate-200"></div>Normal</div>
        </div>
        <div className="w-full h-full flex items-center justify-center bg-blue-50/30 pt-10">
          <TurkeyMap
            selectedCity={selectedCity}
            onCitySelect={handleCitySelect}
            className="w-full h-full"
          />
        </div>
      </div>

      {/* Chart */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
        <h3 className="font-semibold text-slate-800 mb-6">Üretim vs Tüketim Dengesi (Son 5 Yıl)</h3>
        <div className="h-[400px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="year" axisLine={false} tickLine={false} />
              <YAxis axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
              <Legend iconType="circle" />
              <Bar dataKey="production" name="Üretim (Ton)" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="consumption" name="Tüketim (Ton)" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-amber-50 p-6 rounded-xl border border-amber-100">
          <h4 className="font-bold text-amber-900 mb-2">Tahmini Arz Fazlası Riski</h4>
          <p className="text-amber-800 text-sm">
            2025 projeksiyonlarına göre, seçilen bölgede <strong>%12</strong> oranında arz fazlası beklenmektedir.
            Depolama maliyetlerinin artması öngörülmektedir.
          </p>
        </div>
        <div className="bg-emerald-50 p-6 rounded-xl border border-emerald-100">
          <h4 className="font-bold text-emerald-900 mb-2">İhracat Potansiyeli</h4>
          <p className="text-emerald-800 text-sm">
            Bu ürün grubunda global talep artışı gözlenmektedir. Üretim fazlasının ihracata yönlendirilmesi
            gelir artışı sağlayabilir.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SupplyDemand;