import React, { useEffect, useState } from 'react';
import TurkeyMap from 'turkey-map-react';
import {
    Cloud,
    Droplets,
    MapPin,
    Sprout,
    Thermometer,
    TrendingUp,
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    ComposedChart,
    Legend,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import { apiFetch } from '../lib/api';
import './RegionalAnalysis.css';

const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;

    return (
        <div style={{
            background: 'rgba(20, 30, 24, 0.95)',
            border: '1px solid var(--color-primary)',
            borderRadius: '10px',
            padding: '10px 16px',
            fontSize: '0.82rem',
            color: '#e2e8f0',
        }}>
            <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--color-primary-light)' }}>{label}</p>
            {payload.map((item) => (
                <p key={item.dataKey} style={{ color: item.color || '#e2e8f0', margin: '2px 0' }}>
                    {item.name}: <strong>{item.value}</strong>
                </p>
            ))}
        </div>
    );
};

const riskClassName = (riskLevel) => {
    if (!riskLevel) return 'risk-orta';
    return `risk-${riskLevel.toLocaleLowerCase('tr-TR').replace('ü', 'u').replace('ş', 's')}`;
};

const RegionalAnalysis = () => {
    const [selectedCity, setSelectedCity] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [historyRange, setHistoryRange] = useState('5Y');

    useEffect(() => {
        if (!selectedCity) return;

        let active = true;

        const loadAnalysis = async () => {
            setLoading(true);
            setError('');
            try {
                const payload = await apiFetch(`/api/regional-analysis?city=${encodeURIComponent(selectedCity)}&historyRange=${encodeURIComponent(historyRange)}`);
                if (active) setAnalysis(payload);
            } catch (err) {
                if (active) {
                    setAnalysis(null);
                    setError(err.message || 'Bölgesel analiz verisi yüklenemedi.');
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        loadAnalysis();
        return () => {
            active = false;
        };
    }, [selectedCity, historyRange]);

    return (
        <div className="regional-analysis-container animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Bölgesel Analiz</h1>
                    <p className="page-subtitle text-muted">Haritadan bir şehir seçin; ekran şehir bazlı iklim ve üretim kayıtlarını veritabanından çeksin.</p>
                    {error && <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</p>}
                </div>
            </div>

            <div className="analysis-grid">
                <div className="map-card card">
                    <div className="map-header">
                        <h2>Türkiye Haritası</h2>
                        <span className="tooltip-info">İl seçmek için harita üstüne tıklayın</span>
                    </div>
                    <div className="map-wrapper">
                        <TurkeyMap
                            hoverable
                            onClick={({ name }) => setSelectedCity(name)}
                            cityWrapper={(cityComponent, cityData) => (
                                <g key={cityData.name} className="city-tooltip-wrapper">
                                    <title>{cityData.name}</title>
                                    {cityComponent}
                                </g>
                            )}
                            customStyle={{
                                idleColor: '#e2e8f0',
                                hoverColor: '#74c69d',
                                selectedColor: '#2d6a4f',
                            }}
                        />
                    </div>
                </div>

                <div className="city-details-card card">
                    {selectedCity && analysis ? (
                        <>
                            <div className="city-header border-b">
                                <div className="city-title-group">
                                    <div className="icon-wrapper bg-primary-light">
                                        <MapPin color="var(--color-primary-dark)" size={24} />
                                    </div>
                                    <div>
                                        <h2>{analysis.city} Analizi</h2>
                                        <div className={`risk-badge ${riskClassName(analysis.risk?.level)}`}>
                                            Risk Seviyesi: {analysis.risk?.level} · Skor {analysis.risk?.score}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="city-stats-grid">
                                <div className="stat-box">
                                    <div className="stat-icon-wrapper text-warning">
                                        <Thermometer size={20} />
                                    </div>
                                    <div className="stat-details">
                                        <h4>Son Sıcaklık Ortalaması</h4>
                                        <span className="stat-value">{analysis.climate?.temperature}°C</span>
                                    </div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-icon-wrapper text-info">
                                        <Cloud size={20} />
                                    </div>
                                    <div className="stat-details">
                                        <h4>Son Yağış Ortalaması</h4>
                                        <span className="stat-value">{analysis.climate?.rainfall} mm</span>
                                    </div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-icon-wrapper text-info">
                                        <Droplets size={20} />
                                    </div>
                                    <div className="stat-details">
                                        <h4>Toprak Nemi</h4>
                                        <span className="stat-value">%{analysis.climate?.soilMoisture}</span>
                                    </div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-icon-wrapper text-success">
                                        <TrendingUp size={20} />
                                    </div>
                                    <div className="stat-details">
                                        <h4>Ortalama Verim</h4>
                                        <span className="stat-value">{analysis.production?.averageYieldKgDecare || '—'} kg/dönüm</span>
                                    </div>
                                </div>
                            </div>

                            <p className="regional-note">
                                {analysis.latestObservationDate
                                    ? `Son gözlem tarihi: ${analysis.latestObservationDate}`
                                    : 'Son gözlem tarihi bulunamadı.'}
                            </p>
                            <p className="regional-summary">{analysis.risk?.summary}</p>

                            <div className="recommended-crops">
                                <h3>Modelde Öne Çıkan Ürünler</h3>
                                <div className="crop-tags">
                                    {analysis.recommendedCrops?.map((crop) => (
                                        <span key={`${crop.name}-${crop.forecastYear}`} className="crop-tag">
                                            <Sprout size={16} />
                                            {crop.name}
                                        </span>
                                    ))}
                                </div>
                            </div>

                            <div className="recommended-crops secondary-crops">
                                <h3>Son Üretim Sezonunun Güçlü Ürünleri</h3>
                                <div className="crop-tags muted-crops">
                                    {analysis.topCrops?.map((crop) => (
                                        <span key={`${crop.name}-${crop.latestYear}`} className="crop-tag secondary">
                                            <Sprout size={16} />
                                            {crop.name}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-icon text-muted">
                                <MapPin size={48} />
                            </div>
                            <h3>{loading ? 'Analiz yükleniyor...' : 'Şehir Seçilmedi'}</h3>
                            <p className="text-muted">
                                {loading
                                    ? 'Seçilen şehir için analitik veriler hazırlanıyor.'
                                    : 'Analiz verilerini görüntülemek için harita üzerinden bir il seçiniz.'}
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {selectedCity && analysis && (
                <div className="regional-charts-grid">
                    <div className="card forecast-chart-card">
                        <div className="chart-title-row">
                            <Cloud size={22} color="var(--color-primary)" />
                            <h2>Son 12 Ay İklim Görünümü</h2>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <ComposedChart data={analysis.climateSeries} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(203, 213, 225, 0.35)" />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Bar yAxisId="left" dataKey="rainfall" name="Yağış (mm)" fill="rgba(56, 189, 248, 0.75)" radius={[4, 4, 0, 0]} />
                                <Line yAxisId="right" type="monotone" dataKey="temperature" name="Sıcaklık (°C)" stroke="#f97316" strokeWidth={3} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="card forecast-chart-card">
                        <div className="chart-title-row chart-title-row-spread">
                            <div className="chart-title-inline">
                                <TrendingUp size={22} color="var(--color-primary)" />
                                <div>
                                    <h2>{'Üretim Trendi'}</h2>
                                    <p className="chart-subtitle">
                                        {analysis.productionSeries?.length > 0
                                            ? `${analysis.productionSeries[0].year} - ${analysis.productionSeries[analysis.productionSeries.length - 1].year} arası veri gösteriliyor`
                                            : 'Üretim geçmişi gösteriliyor'}
                                    </p>
                                </div>
                            </div>
                            <div className="range-switch" role="group" aria-label="Üretim trendi zaman aralığı">
                                <button type="button" className={`range-switch-btn ${historyRange === '5Y' ? 'active' : ''}`} onClick={() => setHistoryRange('5Y')}>{'5 Yıl'}</button>
                                <button type="button" className={`range-switch-btn ${historyRange === '10Y' ? 'active' : ''}`} onClick={() => setHistoryRange('10Y')}>{'10 Yıl'}</button>
                                <button type="button" className={`range-switch-btn ${historyRange === 'ALL' ? 'active' : ''}`} onClick={() => setHistoryRange('ALL')}>{'Tüm Veri'}</button>
                            </div>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={analysis.productionSeries} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(203, 213, 225, 0.35)" />
                                <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                                <YAxis tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                <Bar dataKey="totalProductionTon" name="Toplam Üretim (Ton)" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RegionalAnalysis;
