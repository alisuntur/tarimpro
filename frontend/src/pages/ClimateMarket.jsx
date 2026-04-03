import React, { useEffect, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Calendar, BrainCircuit, Droplet, ThermometerSun } from 'lucide-react';
import { apiFetch } from '../lib/api';
import './ClimateMarket.css';

const cities = [
    'Adana', 'Ankara', 'Antalya', 'Bursa', 'Diyarbakır', 'Erzurum', 'İstanbul', 'İzmir',
    'Konya', 'Mardin', 'Manisa', 'Samsun', 'Şanlıurfa', 'Tekirdağ', 'Trabzon'
];

const ClimateMarket = () => {
    const [period, setPeriod] = useState('1Y');
    const [selectedCity, setSelectedCity] = useState('Manisa');
    const [climateData, setClimateData] = useState([]);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;

        const loadClimate = async () => {
            setLoading(true);
            try {
                const payload = await apiFetch(`/api/climate/data?period=${period}&city=${encodeURIComponent(selectedCity)}`);
                if (!active) return;
                setClimateData(payload.series || []);
                setComment(payload.ai_comment || 'Analiz bulunamadı.');
            } finally {
                if (active) setLoading(false);
            }
        };

        loadClimate();
        return () => {
            active = false;
        };
    }, [period, selectedCity]);

    const getRiskColor = (risk) => {
        if (risk < 30) return '#10b981';
        if (risk < 60) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className="climate-container animate-fade-in">
            <div className="climate-header">
                <div className="header-text">
                    <h1>İklim ve Pazar Verileri</h1>
                    <p className="text-muted">Veritabanındaki bölgesel makro veriler ve yapay zeka analizleri</p>
                </div>

                <div className="header-actions">
                    <div className="city-selector">
                        <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="city-select">
                            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
                        </select>
                    </div>

                    <div className="period-filters">
                        <Calendar size={18} className="text-muted" />
                        <button className={`filter-btn ${period === '6M' ? 'active' : ''}`} onClick={() => setPeriod('6M')}>6 Ay</button>
                        <button className={`filter-btn ${period === '1Y' ? 'active' : ''}`} onClick={() => setPeriod('1Y')}>1 Yıl</button>
                        <button className={`filter-btn ${period === '5Y' ? 'active' : ''}`} onClick={() => setPeriod('5Y')}>5 Yıl</button>
                    </div>
                </div>
            </div>

            <div className="climate-grid">
                <div className="charts-column">
                    <div className="chart-card card">
                        <div className="chart-header">
                            <div className="chart-title-wrapper">
                                <Droplet className="text-primary" size={24} />
                                <h3>Yağış Serisi (mm)</h3>
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

                    <div className="chart-card card">
                        <div className="chart-header">
                            <div className="chart-title-wrapper">
                                <ThermometerSun className="text-danger" size={24} />
                                <h3>Sıcaklık ve Kuraklık Riski</h3>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={240}>
                            <BarChart data={climateData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                <RechartsTooltip cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="temperature" name="Ort. Sıcaklık (°C)" radius={[4, 4, 0, 0]} barSize={40}>
                                    {climateData.map((entry, index) => <Cell key={`cell-${index}`} fill={getRiskColor(entry.droughtRisk)} />)}
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

                <div className="insights-column">
                    <div className="ai-insight-panel card">
                        <div className="panel-header">
                            <BrainCircuit size={28} className="text-primary-dark" />
                            <h2>Yapay Zeka Yorumu</h2>
                        </div>

                        <div className="insight-content">
                            {loading ? (
                                <p className="text-muted">Analiz yükleniyor...</p>
                            ) : (
                                <>
                                    <p className="insight-lead">{selectedCity} için iklim geçmişi ve model verileri analiz edilmiştir.</p>
                                    <ul className="insight-points">
                                        <li><strong>Şehir:</strong> {selectedCity}</li>
                                        <li><strong>Dönem:</strong> {period}</li>
                                        <li><strong>Yorum:</strong> {comment}</li>
                                    </ul>
                                </>
                            )}
                        </div>

                        <div className="panel-footer">
                            <p className="footer-note">Kaynak: PostgreSQL içindeki analytics iklim verileri</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClimateMarket;
