import React, { useEffect, useMemo, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { Calendar, BrainCircuit, Droplet, ThermometerSun } from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './ClimateMarket.css';

const periodLabels = { '6M': '6 Ay', '1Y': '1 Yıl', '5Y': '5 Yıl' };

const addUnique = (items, value) => {
    if (value && !items.includes(value)) items.push(value);
};

const ClimateMarket = () => {
    const { user } = useAuth();
    const [period, setPeriod] = useState('1Y');
    const [selectedCity, setSelectedCity] = useState(user?.city || '');
    const [cityOptions, setCityOptions] = useState([]);
    const [climateData, setClimateData] = useState([]);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!selectedCity && user?.city) {
            setSelectedCity(user.city);
        }
    }, [selectedCity, user?.city]);

    useEffect(() => {
        let active = true;

        const loadLocations = async () => {
            try {
                const payload = await apiFetch('/api/locations/options');
                if (!active) return;
                const nextCities = payload.cities || [];
                setCityOptions(nextCities);
                const profileCity = payload.profile?.city || user?.city || '';
                setSelectedCity((currentCity) => currentCity || profileCity);
            } catch (err) {
                if (active) setError(err.message || 'Konum seçenekleri yüklenemedi.');
            }
        };

        loadLocations();
        return () => {
            active = false;
        };
    }, [user?.city]);

    useEffect(() => {
        if (!selectedCity) {
            setLoading(false);
            setClimateData([]);
            setComment('');
            return undefined;
        }

        let active = true;

        const loadClimate = async () => {
            setLoading(true);
            setError('');
            try {
                const payload = await apiFetch(`/api/climate/data?period=${period}&city=${encodeURIComponent(selectedCity)}`);
                if (!active) return;
                setClimateData(payload.series || []);
                setComment(payload.ai_comment || 'Analiz bulunamadı.');
            } catch (err) {
                if (active) {
                    setClimateData([]);
                    setComment('');
                    setError(err.message || 'İklim verileri yüklenemedi.');
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        loadClimate();
        return () => {
            active = false;
        };
    }, [period, selectedCity]);

    const cities = useMemo(() => {
        const options = [...cityOptions];
        addUnique(options, user?.city || '');
        addUnique(options, selectedCity);
        return options;
    }, [cityOptions, selectedCity, user?.city]);

    const getRiskColor = (risk) => {
        if (risk < 30) return '#10b981';
        if (risk < 60) return '#f59e0b';
        return '#ef4444';
    };

    return (
        <div className="climate-container animate-fade-in">
            <div className="climate-header">
                <div className="header-text">
                    <h1>{'İklim ve Risk Raporları'}</h1>
                    <p className="text-muted">{'Veritabanındaki yağış, sıcaklık ve kuraklık risk serileri bu ekranda özetlenir.'}</p>
                    {error && <p className="climate-error">{error}</p>}
                </div>

                <div className="header-actions">
                    <div className="city-selector">
                        <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="city-select">
                            <option value="">İl seçin</option>
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
                        {selectedCity ? (
                            <ResponsiveContainer width="100%" height={240}>
                                <BarChart data={climateData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                    <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value, name) => [value, name]} labelFormatter={(label) => `Dönem: ${label}`} />
                                    <Bar dataKey="rainfall" name="Yağış (mm)" fill="var(--color-primary-light)" radius={[4, 4, 0, 0]} barSize={30} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-chart-state">İklim verilerini görmek için il seçin.</div>
                        )}
                    </div>

                    <div className="chart-card card">
                        <div className="chart-header">
                            <div className="chart-title-wrapper">
                                <ThermometerSun className="text-danger" size={24} />
                                <h3>Sıcaklık ve Kuraklık Riski</h3>
                            </div>
                        </div>
                        {selectedCity ? (
                            <>
                                <ResponsiveContainer width="100%" height={240}>
                                    <BarChart data={climateData} margin={{ top: 20, right: 0, left: -20, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                        <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                        <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                                        <RechartsTooltip cursor={{ fill: 'transparent' }} formatter={(value, name) => [value, name]} labelFormatter={(label) => `Dönem: ${label}`} />
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
                            </>
                        ) : (
                            <div className="empty-chart-state">Sıcaklık serisi için il seçin.</div>
                        )}
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
                            ) : selectedCity ? (
                                <>
                                    <p className="insight-lead">{selectedCity} için iklim geçmişi ve model verileri analiz edilmiştir.</p>
                                    <ul className="insight-points">
                                        <li><strong>Şehir:</strong> {selectedCity}</li>
                                        <li><strong>{'Dönem:'}</strong> {periodLabels[period] || period}</li>
                                        <li><strong>Yorum:</strong> {comment || 'Analiz bulunamadı.'}</li>
                                    </ul>
                                </>
                            ) : (
                                <p className="text-muted">Profil iliniz bulunamadı. Analiz için bir il seçin.</p>
                            )}
                        </div>

                        <div className="panel-footer">
                            <p className="footer-note">{'Kaynak: PostgreSQL içindeki analytics.climate_history kayıtları'}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ClimateMarket;
