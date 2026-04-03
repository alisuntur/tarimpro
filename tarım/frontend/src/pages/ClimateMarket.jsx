import React, { useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell
} from 'recharts';
import { Calendar, BrainCircuit, Droplet, ThermometerSun } from 'lucide-react';
import './ClimateMarket.css';

const ClimateMarket = () => {
    const [period, setPeriod] = useState('1Y');

    // Simulated data based on selected period
    const climateData = [
        { month: 'Oca', rainfall: 65, temp: 4, droughtRisk: 10 },
        { month: 'Şub', rainfall: 55, temp: 6, droughtRisk: 15 },
        { month: 'Mar', rainfall: 50, temp: 9, droughtRisk: 20 },
        { month: 'Nis', rainfall: 40, temp: 14, droughtRisk: 35 },
        { month: 'May', rainfall: 30, temp: 19, droughtRisk: 50 },
        { month: 'Haz', rainfall: 20, temp: 24, droughtRisk: 75 },
        { month: 'Tem', rainfall: 10, temp: 28, droughtRisk: 90 },
        { month: 'Ağu', rainfall: 15, temp: 27, droughtRisk: 85 },
        { month: 'Eyl', rainfall: 25, temp: 22, droughtRisk: 60 },
        { month: 'Eki', rainfall: 45, temp: 16, droughtRisk: 30 },
        { month: 'Kas', rainfall: 60, temp: 10, droughtRisk: 15 },
        { month: 'Ara', rainfall: 70, temp: 6, droughtRisk: 5 },
    ];

    // Colors for Heatmap simulation (Drought Risk)
    const getRiskColor = (risk) => {
        if (risk < 30) return '#a3b18a'; // Safe Green
        if (risk < 60) return '#e9b56f'; // Warning Yellow/Orange
        return '#e63946'; // Danger Red
    };

    return (
        <div className="climate-container animate-fade-in">
            <div className="climate-header">
                <div className="header-text">
                    <h1>İklim ve Pazar Verileri</h1>
                    <p className="text-muted">Bölgesel makro veriler ve yapay zeka analizleri</p>
                </div>

                <div className="period-filters">
                    <Calendar size={18} className="text-muted" />
                    <button
                        className={`filter-btn ${period === '6M' ? 'active' : ''}`}
                        onClick={() => setPeriod('6M')}
                    >
                        Gelecek 6 Ay (Tahmin)
                    </button>
                    <button
                        className={`filter-btn ${period === '1Y' ? 'active' : ''}`}
                        onClick={() => setPeriod('1Y')}
                    >
                        Son 1 Yıl
                    </button>
                    <button
                        className={`filter-btn ${period === '5Y' ? 'active' : ''}`}
                        onClick={() => setPeriod('5Y')}
                    >
                        Son 5 Yıl
                    </button>
                </div>
            </div>

            <div className="climate-grid">
                {/* Left Column - Charts */}
                <div className="charts-column">

                    {/* Rainfall Bar Chart */}
                    <div className="chart-card card">
                        <div className="chart-header">
                            <div className="chart-title-wrapper">
                                <Droplet className="text-primary" size={24} />
                                <h3>Aylık Ortalama Yağış Miktarı (mm)</h3>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={climateData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="rainfall" fill="var(--color-primary-light)" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Temperature & Drought Risk (Heatmap Simulation) */}
                    <div className="chart-card card">
                        <div className="chart-header">
                            <div className="chart-title-wrapper">
                                <ThermometerSun className="text-danger" size={24} />
                                <h3>Sıcaklık ve Kuraklık Riski Isı Haritası</h3>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={climateData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="temp" name="Ort. Sıcaklık (°C)" radius={[4, 4, 0, 0]} barSize={40}>
                                    {climateData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={getRiskColor(entry.droughtRisk)} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                        <div className="heatmap-legend">
                            <span className="legend-item"><span className="legend-color safe"></span> Düşük Risk</span>
                            <span className="legend-item"><span className="legend-color warning"></span> Orta Risk</span>
                            <span className="legend-item"><span className="legend-color danger"></span> Yüksek Kuraklık Riski</span>
                        </div>
                    </div>

                </div>

                {/* Right Column - AI Insights */}
                <div className="insights-column">
                    <div className="ai-insight-panel card">
                        <div className="panel-header">
                            <BrainCircuit size={28} className="text-primary-dark" />
                            <h2>Yapay Zeka Yorumu</h2>
                        </div>

                        <div className="insight-content">
                            <p className="insight-lead">
                                Veriler incelendiğinde yaz aylarında (Haziran - Ağustos) şiddetli bir kuraklık riski tespit edilmiştir.
                            </p>

                            <ul className="insight-points">
                                <li>
                                    <strong>Yağış Rejimi:</strong> Geçen yıla oranla bahar yağışlarında %15 azalma var. Erken ekim stratejileri tercih edilmeli.
                                </li>
                                <li>
                                    <strong>Sıcaklık Stresi:</strong> Temmuz ayında ortalama sıcaklıkların ekstrem seviyelere (28°C+) ulaşması bekleniyor. Su stresine dayanıklı tohum tipleri kullanılmalı.
                                </li>
                                <li>
                                    <strong>Pazar Yorumu:</strong> Kuraklık beklentisi sebebiyle mısır ve pamuk gibi çok su tüketen ürünlerde arz sıkıntısı yaşanabilir, bu durum hasat sonu piyasa fiyatlarını %20 oranında yukarı çekebilir.
                                </li>
                            </ul>
                        </div>

                        <div className="panel-footer">
                            <p className="footer-note">Son Güncelleme: TÜİK & MGM Verileri (Bugün 09:00)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClimateMarket;
