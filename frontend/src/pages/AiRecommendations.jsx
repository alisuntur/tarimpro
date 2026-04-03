import React, { useEffect, useState } from 'react';
import {
    PieChart, Pie, Cell,
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { ChevronLeft, MapPin } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import './AiRecommendations.css';

const cities = [
    'Adana', 'Ankara', 'Antalya', 'Bursa', 'Diyarbakır', 'Erzurum', 'İstanbul', 'İzmir',
    'Konya', 'Mardin', 'Manisa', 'Samsun', 'Şanlıurfa', 'Tekirdağ', 'Trabzon'
];

const chartData = [
    { year: '2019', uretim: 120, tuketim: 110 },
    { year: '2020', uretim: 130, tuketim: 125 },
    { year: '2021', uretim: 115, tuketim: 135 },
    { year: '2022', uretim: 140, tuketim: 145 },
    { year: '2023', uretim: 155, tuketim: 150 },
    { year: '2024 (Tahmin)', uretim: 145, tuketim: 160 },
    { year: '2025 (Tahmin)', uretim: 165, tuketim: 170 },
];

const AiRecommendations = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const planData = location.state || { city: 'Manisa', size: 100, crop: 'wheat' };
    const [selectedCity, setSelectedCity] = useState(planData.city || 'Manisa');
    const [analysis, setAnalysis] = useState({ score: 85, recommendations: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;

        const loadAnalysis = async () => {
            setLoading(true);
            setError('');
            try {
                const payload = await apiFetch('/api/ai/analyze-plan', {
                    method: 'POST',
                    body: {
                        region: selectedCity,
                        size: Number(planData.size || 100),
                        crop: planData.crop || '',
                    },
                });
                if (active) setAnalysis(payload);
            } catch (err) {
                if (active) setError(err.message || 'AI analizi alınamadı.');
            } finally {
                if (active) setLoading(false);
            }
        };

        loadAnalysis();
        return () => {
            active = false;
        };
    }, [selectedCity, planData.crop, planData.size]);

    const score = analysis.score || 0;
    const gaugeData = [
        { name: 'Score', value: score },
        { name: 'Rest', value: 100 - score },
    ];
    const COLORS = ['var(--color-accent)', '#e0e0e0'];

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
                            {cities.map((city) => (
                                <option key={city} value={city}>{city}</option>
                            ))}
                        </select>
                        <MapPin size={18} className="text-primary" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
                    </div>
                </div>
            </div>

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
                        {selectedCity} için veritabanındaki model tahminleri ve iklim verilerine göre
                        <strong> {planData.crop || 'seçili ürün'}</strong> planı değerlendirilmiştir.
                        Alternatifler aşağıda listelenmiştir.
                    </p>
                    {error && <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</p>}
                </div>
            </div>

            <div className="recommendations-content">
                <div className="recommendations-left">
                    <h2 className="section-title">{selectedCity} İçin Alternatif Öneriler</h2>
                    <div className="recommendation-cards">
                        {loading ? (
                            <div className="suggestion-card card"><p>Analiz yükleniyor...</p></div>
                        ) : (
                            analysis.recommendations.map((item) => (
                                <div key={item.id} className="suggestion-card card">
                                    <div className="suggestion-header">
                                        <div className="suggestion-title">
                                            <div className="title-row">
                                                <h3>{item.crop}</h3>
                                                <span className="expected-return">{item.expectedReturn}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="suggestion-body">
                                        <p className="reason-label">Neden bu ürün?</p>
                                        <p>{item.reason}</p>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="recommendations-right">
                    <h2 className="section-title">Piyasa Üretim/Tüketim Trendi</h2>
                    <div className="chart-card card">
                        <ResponsiveContainer width="100%" height={400}>
                            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(203, 213, 225, 0.4)" />
                                <XAxis dataKey="year" axisLine tickLine={false} tick={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }} dy={10} />
                                <YAxis axisLine tickLine={false} tick={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }} dx={-10} tickCount={5} />
                                <RechartsTooltip
                                    cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                                    contentStyle={{
                                        borderRadius: '16px',
                                        border: '1px solid rgba(226, 232, 240, 0.8)',
                                        boxShadow: 'var(--shadow-xl)',
                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                        backdropFilter: 'blur(8px)',
                                        padding: '16px',
                                    }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: '600', fontSize: '14px' }} iconType="circle" />
                                <Bar name="Üretim (Bin Ton)" dataKey="uretim" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={32} />
                                <Line type="monotone" name="Tüketim (Bin Ton)" dataKey="tuketim" stroke="#f59e0b" strokeWidth={4} dot={{ r: 5, fill: 'white', stroke: '#f59e0b', strokeWidth: 2 }} activeDot={{ r: 8, fill: '#f59e0b', stroke: 'white', strokeWidth: 2 }} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiRecommendations;
