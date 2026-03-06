import React from 'react';
import { CloudSun, TrendingUp, AlertTriangle, RefreshCcw, Calendar } from 'lucide-react';
import { MOCK_WEATHER, RECENT_UPDATES } from '../constants';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '../contexts/ThemeContext';

const Dashboard: React.FC = () => {
  const { theme } = useTheme();
  const isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);

  const data = [
    { name: 'Oca', val: 4000 },
    { name: 'Şub', val: 3000 },
    { name: 'Mar', val: 2000 },
    { name: 'Nis', val: 2780 },
    { name: 'May', val: 1890 },
    { name: 'Haz', val: 2390 },
    { name: 'Tem', val: 3490 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Ana Panel</h1>
        <p className="text-slate-500 dark:text-slate-400">Hoş geldiniz, bugünün tarımsal özet durumu.</p>
      </div>

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Weather Card */}
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-blue-100 text-sm font-medium">Hava Durumu</p>
                <h3 className="text-3xl font-bold mt-1">{MOCK_WEATHER.temp}°C</h3>
                <p className="text-blue-100 mt-1 flex items-center gap-1">
                  <span className="font-semibold">{MOCK_WEATHER.city}</span> | {MOCK_WEATHER.condition}
                </p>
              </div>
              <CloudSun size={40} className="text-blue-200 opacity-80" />
            </div>
            <div className="mt-4 flex gap-4 text-sm text-blue-100">
              <span>Nem: %{MOCK_WEATHER.humidity}</span>
              <span>Rüzgar: {MOCK_WEATHER.wind} km/s</span>
            </div>
          </div>
          <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white opacity-10 rounded-full"></div>
        </div>

        {/* Yield Estimate */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Tahmini Verim</p>
              <h3 className="text-2xl font-bold text-emerald-600 mt-1">1.250 kg/da</h3>
              <p className="text-emerald-600 text-xs mt-1 flex items-center gap-1 bg-emerald-50 dark:bg-emerald-900/30 w-fit px-2 py-0.5 rounded-full">
                <TrendingUp size={12} />
                <span>Geçen sezona göre +%5</span>
              </p>
            </div>
            <div className="p-3 bg-emerald-100 dark:bg-emerald-900/20 rounded-lg text-emerald-600">
              <TrendingUp size={24} />
            </div>
          </div>
        </div>

        {/* Risk Alert */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Risk Durumu</p>
              <h3 className="text-2xl font-bold text-amber-500 mt-1">Orta Risk</h3>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Arz fazlası ihtimali</p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg text-amber-600">
              <AlertTriangle size={24} />
            </div>
          </div>
        </div>

        {/* Last Updates */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700 hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">Son Güncelleme</p>
              <h3 className="text-2xl font-bold text-slate-800 dark:text-white mt-1">10:45</h3>
              <p className="text-slate-400 dark:text-slate-500 text-xs mt-1">Veriler senkronize</p>
            </div>
            <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300">
              <RefreshCcw size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart Area */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-semibold text-slate-800 dark:text-white">Sezonluk Verim Trendi</h3>
            <select className="text-sm border border-slate-200 dark:border-slate-600 rounded-md px-2 py-1 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-700 outline-none">
              <option>Buğday</option>
              <option>Mısır</option>
            </select>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "#334155" : "#f1f5f9"} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: isDark ? '#1e293b' : '#fff',
                    borderRadius: '8px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    color: isDark ? '#fff' : '#000'
                  }}
                />
                <Area type="monotone" dataKey="val" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorVal)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Updates Feed */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-sm border border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-800 dark:text-white mb-4">Son Gelişmeler</h3>
          <div className="space-y-4">
            {RECENT_UPDATES.map((update) => (
              <div key={update.id} className="flex gap-3 items-start pb-3 border-b border-slate-50 dark:border-slate-700 last:border-0">
                <div className={`w-2 h-2 mt-2 rounded-full shrink-0 ${update.type === 'climate' ? 'bg-blue-500' :
                    update.type === 'market' ? 'bg-emerald-500' : 'bg-amber-500'
                  }`} />
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{update.title}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{update.time}</p>
                </div>
              </div>
            ))}
          </div>
          <button className="w-full mt-4 text-sm text-emerald-600 font-medium hover:bg-emerald-50 dark:hover:bg-emerald-900/20 py-2 rounded-lg transition-colors">
            Tümünü Gör
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <button className="p-4 bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/30 rounded-xl flex items-center gap-4 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors group">
          <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 rounded-full group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <Calendar size={24} />
          </div>
          <div className="text-left">
            <h4 className="font-semibold text-slate-800 dark:text-white">Ekim Planla</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">Yeni sezon için analiz yap</p>
          </div>
        </button>
      </div>
    </div>
  );
};

export default Dashboard;