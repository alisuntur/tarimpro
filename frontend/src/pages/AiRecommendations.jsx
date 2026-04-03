import React, { useState, useEffect } from 'react';
import {
    PieChart, Pie, Cell,
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Sprout, CheckCircle2, TrendingUp, ChevronLeft, MapPin } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AiRecommendations.css';

const AiRecommendations = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const planData = location.state || { region: 'marmara', size: 100, crop: 'wheat' };

    const initialCity = planData.city || 'Adana';
    const [selectedCity, setSelectedCity] = useState(initialCity);

    // List of cities for the dropdown
    const cities = [
        'Adana', 'Ankara', 'Antalya', 'Bursa', 'Diyarbakır',
        'Erzurum', 'İstanbul', 'İzmir', 'Konya', 'Mardin',
        'Manisa', 'Samsun', 'Şanlıurfa', 'Tekirdağ', 'Trabzon'
    ];

    // If navigated with a new city, update state
    useEffect(() => {
        if (location.state && location.state.city) {
            setSelectedCity(location.state.city);
        }
    }, [location.state]);

    // Mock AI Data
    const scoreBase = (selectedCity.charCodeAt(0) % 20); // 0-19
    const score = 75 + scoreBase; // 75-94 score range for dynamism

    const gaugeData = [
        { name: 'Score', value: score },
        { name: 'Rest', value: 100 - score }
    ];
    const COLORS = ['var(--color-accent)', '#e0e0e0'];

    // Generate dynamic mock recommendations based on city
    const getRecommendations = (city) => {
        const seed = city.charCodeAt(0) + city.length;

        const cropsList = [
            { crop: "Mısır", icon: <Sprout size={32} strokeWidth={1.5} />, waterDemand: "Yüksek" },
            { crop: "Soya Fasulyesi", icon: <TrendingUp size={32} strokeWidth={1.5} />, waterDemand: "Orta" },
            { crop: "Kanola", icon: <CheckCircle2 size={32} strokeWidth={1.5} />, waterDemand: "Düşük" },
            { crop: "Ayçiçeği", icon: <Sprout size={32} strokeWidth={1.5} />, waterDemand: "Orta" },
            { crop: "Pamuk", icon: <TrendingUp size={32} strokeWidth={1.5} />, waterDemand: "Yüksek" },
            { crop: "Şeker Pancarı", icon: <CheckCircle2 size={32} strokeWidth={1.5} />, waterDemand: "Yüksek" },
            { crop: "Arpa", icon: <Sprout size={32} strokeWidth={1.5} />, waterDemand: "Düşük" },
            { crop: "Nohut", icon: <CheckCircle2 size={32} strokeWidth={1.5} />, waterDemand: "Düşük" }
        ];

        // Pick 3 pseudo-random crops based on the seed
        // Ensure they are unique by using modulo offset spacing
        const rec1 = cropsList[seed % cropsList.length];
        const rec2 = cropsList[(seed + 3) % cropsList.length];
        const rec3 = cropsList[(seed + 5) % cropsList.length];

        return [
            {
                id: 1,
                crop: rec1.crop,
                expectedReturn: `%${10 + (seed % 15)} Artış`,
                riskLevel: (seed % 3 === 0) ? "Yüksek Risk" : ((seed % 2 === 0) ? "Orta Risk" : "Düşük Risk"),
                waterDemand: rec1.waterDemand,
                reason: `${city} geneli toprak yapısı ve beklenen yağış rejimine göre ${rec1.crop} ekimi kârlı bir alternatif olabilir.`,
                icon: rec1.icon
            },
            {
                id: 2,
                crop: rec2.crop,
                expectedReturn: `%${8 + (seed % 12)} Artış`,
                riskLevel: ((seed + 1) % 3 === 0) ? "Yüksek Risk" : (((seed + 1) % 2 === 0) ? "Orta Risk" : "Düşük Risk"),
                waterDemand: rec2.waterDemand,
                reason: `Güncel piyasa talebi ve ${city} bölgesindeki lojistik avantajlar ${rec2.crop} üretiminde fırsat sunuyor.`,
                icon: rec2.icon
            },
            {
                id: 3,
                crop: rec3.crop,
                expectedReturn: `%${5 + (seed % 10)} Artış`,
                riskLevel: ((seed + 2) % 3 === 0) ? "Yüksek Risk" : (((seed + 2) % 2 === 0) ? "Orta Risk" : "Düşük Risk"),
                waterDemand: rec3.waterDemand,
                reason: `Alternatif ürün rotasyonu kapsamında, ${city} iklim koşulları ${rec3.crop} için oldukça elverişli görünüyor.`,
                icon: rec3.icon
            }
        ];
    };

    const recommendations = getRecommendations(selectedCity);

    const chartData = [
        { year: '2019', uretim: 120, tuketim: 110 },
        { year: '2020', uretim: 130, tuketim: 125 },
        { year: '2021', uretim: 115, tuketim: 135 },
        { year: '2022', uretim: 140, tuketim: 145 },
        { year: '2023', uretim: 155, tuketim: 150 },
        { year: '2024 (Tahmin)', uretim: 145, tuketim: 160 },
        { year: '2025 (Tahmin)', uretim: 165, tuketim: 170 },
    ];

    return (
        <div className="recommendations-container animate-fade-in">
            <div className="recommendations-header">
                <div className="header-text-group" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <ChevronLeft size={20} />
                        Geri Dön
                    </button>
                    <div className="header-text">
                        <h1>Yapay Zeka Analiz Sonuçları</h1>
                        <p className="text-muted">Tarlanız için en uygun strateji başarı oranı</p>
                    </div>
                </div>

                <div className="header-actions">
                    <div className="city-selector" style={{ position: 'relative' }}>
                        <select
                            value={selectedCity}
                            onChange={(e) => setSelectedCity(e.target.value)}
                            className="city-select"
                            style={{ paddingLeft: '2.5rem' }}
                        >
                            {cities.map(city => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                        <MapPin size={18} className="text-primary" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                </div>
            </div>

            {/* Top Section - Gauge Chart */}
            <div className="gauge-section card">
                <div className="gauge-chart-container">
                    <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                            <Pie
                                data={gaugeData}
                                cx="50%"
                                cy="70%"
                                startAngle={180}
                                endAngle={0}
                                innerRadius={80}
                                outerRadius={120}
                                dataKey="value"
                                stroke="none"
                            >
                                {gaugeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="gauge-overlay-text">
                        <h2>%{score}</h2>
                        <p>Başarı Beklentisi</p>
                    </div>
                </div>
                <div className="gauge-info">
                    <h3>Seçtiğiniz Plana Onay Skoru</h3>
                    <p>
                        Mevcut iklim, toprak ve piyasa verilerine göre <strong>{planData.crop}</strong> ekimi için başarı beklentisi oldukça yüksek.
                        Ancak riskleri minimize etmek adına aşağıdaki alternatifleri de değerlendirebilirsiniz.
                    </p>
                </div>
            </div>

            <div className="recommendations-content">
                {/* Left Column - Recommendations */}
                <div className="recommendations-left">
                    <h2 className="section-title">{selectedCity} İçin Alternatif Öneriler</h2>
                    <div className="recommendation-cards">
                        {recommendations.map(item => (
                            <div key={item.id} className="suggestion-card card">
                                <div className="suggestion-header">
                                    <div className="suggestion-icon">
                                        {item.icon}
                                    </div>
                                    <div className="suggestion-title">
                                        <div className="title-row">
                                            <h3>{item.crop}</h3>
                                            <span className="expected-return">{item.expectedReturn}</span>
                                        </div>
                                        <div className="badge-row">
                                            <span className="status-badge fallback-badge">{item.riskLevel}</span>
                                            <span className="status-badge fallback-badge">Su İhtiyacı: {item.waterDemand}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="suggestion-body">
                                    <p className="reason-label">Neden bu ürün?</p>
                                    <p>{item.reason}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Right Column - Charts */}
                <div className="recommendations-right">
                    <h2 className="section-title">Piyasa Üretim/Tüketim Trendi</h2>
                    <div className="chart-card card">
                        <ResponsiveContainer width="100%" height={400}>
                            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorUretimBar" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.9} />
                                        <stop offset="95%" stopColor="var(--color-primary-light)" stopOpacity={0.4} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(203, 213, 225, 0.4)" />
                                <XAxis dataKey="year" axisLine={true} tickLine={false} tick={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }} dy={10} />
                                <YAxis axisLine={true} tickLine={false} tick={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }} dx={-10} tickCount={5} />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }} /* Subtle hover background for bars */
                                    contentStyle={{
                                        borderRadius: '16px',
                                        border: '1px solid rgba(226, 232, 240, 0.8)',
                                        boxShadow: 'var(--shadow-xl)',
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(8px)',
                                        padding: '16px',
                                        fontSize: '14px',
                                        fontWeight: '500'
                                    }}
                                    itemStyle={{ padding: '6px 0', fontSize: '15px', fontWeight: 'bold' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: '600', fontSize: '14px' }} iconType="circle" />

                                {/* Production as Bar */}
                                <Bar
                                    name="Üretim (Bin Ton)"
                                    dataKey="uretim"
                                    fill="url(#colorUretimBar)"
                                    radius={[4, 4, 0, 0]}
                                    barSize={32}
                                />

                                {/* Consumption as Line */}
                                <Line
                                    type="monotone"
                                    name="Tüketim (Bin Ton)"
                                    dataKey="tuketim"
                                    stroke="#f59e0b" /* amber-500 */
                                    strokeWidth={4}
                                    dot={{ r: 5, fill: 'white', stroke: '#f59e0b', strokeWidth: 2 }}
                                    activeDot={{ r: 8, fill: '#f59e0b', stroke: 'white', strokeWidth: 2 }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiRecommendations;
