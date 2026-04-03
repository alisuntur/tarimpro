import React from 'react';
import {
    PieChart, Pie, Cell,
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { Sprout, CheckCircle2, TrendingUp, ChevronLeft } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import './AiRecommendations.css';

const AiRecommendations = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const planData = location.state || { region: 'marmara', size: 100, crop: 'wheat' };

    // Mock AI Data
    const score = 85;
    const gaugeData = [
        { name: 'Score', value: score },
        { name: 'Rest', value: 100 - score }
    ];
    const COLORS = ['var(--color-accent)', '#e0e0e0'];

    const recommendations = [
        {
            id: 1,
            crop: "Mısır",
            expectedReturn: "%18 Artış",
            reason: "Bölgenizde yağışlar bu yıl %15 daha fazla bekleniyor, mısır ekimi daha kârlı olabilir.",
            icon: <Sprout size={32} />
        },
        {
            id: 2,
            crop: "Soya Fasulyesi",
            expectedReturn: "%14 Artış",
            reason: "Toprak yapınız ve güncel piyasa talebi soya fasulyesi için oldukça uygun.",
            icon: <TrendingUp size={32} />
        },
        {
            id: 3,
            crop: "Kanola",
            expectedReturn: "%11 Artış",
            reason: "Alternatif yağlı tohum olarak düşük su tüketimi ile avantajlı bir seçenek.",
            icon: <CheckCircle2 size={32} />
        }
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

    return (
        <div className="recommendations-container animate-fade-in">
            <div className="recommendations-header">
                <button className="back-btn" onClick={() => navigate(-1)}>
                    <ChevronLeft size={20} />
                    Geri Dön
                </button>
                <div className="header-text">
                    <h1>Yapay Zeka Analiz Sonuçları</h1>
                    <p className="text-muted">Tarlanız için en uygun strateji başarı oranı</p>
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
                    <h2 className="section-title">Modelin Alternatif Önerileri</h2>
                    <div className="recommendation-cards">
                        {recommendations.map(item => (
                            <div key={item.id} className="suggestion-card card">
                                <div className="suggestion-header">
                                    <div className="suggestion-icon">
                                        {item.icon}
                                    </div>
                                    <div className="suggestion-title">
                                        <h3>{item.crop}</h3>
                                        <span className="expected-return">{item.expectedReturn}</span>
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
                            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="year" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6c757d' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6c757d' }} />
                                <RechartsTooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: 'var(--shadow-md)' }}
                                />
                                <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                <Line
                                    type="monotone"
                                    name="Üretim (Bin Ton)"
                                    dataKey="uretim"
                                    stroke="var(--color-primary)"
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2 }}
                                    activeDot={{ r: 6 }}
                                />
                                <Line
                                    type="monotone"
                                    name="Tüketim (Bin Ton)"
                                    dataKey="tuketim"
                                    stroke="var(--color-warning)"
                                    strokeWidth={3}
                                    dot={{ r: 4, strokeWidth: 2 }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiRecommendations;
