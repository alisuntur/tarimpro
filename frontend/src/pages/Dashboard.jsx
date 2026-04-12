import React, { useEffect, useState } from 'react';
import {
    CloudSun,
    Droplets,
    TrendingUp,
    AlertTriangle,
    AlertCircle,
    Leaf,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import './Dashboard.css';

const cities = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
    'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale',
    'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum',
    'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin',
    'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli',
    'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş',
    'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas',
    'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat',
    'Zonguldak',
].sort((a, b) => a.localeCompare(b, 'tr'));

const initialSummary = {
    weather: { temp: '—', condition: 'Yükleniyor...', humidity: '—', city: 'Manisa', district: null, source: '', date: null },
    soilMoisture: { level: '—', status: 'Yükleniyor...', source: '' },
    marketTrend: { status: 'Yükleniyor...', indicator: '0.0%' },
};

const Dashboard = () => {
    const navigate = useNavigate();
    const [summary, setSummary] = useState(initialSummary);
    const [alerts, setAlerts] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [weatherCity, setWeatherCity] = useState('Manisa');
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;

        const loadDashboardData = async () => {
            try {
                const [alertsData, historyData] = await Promise.all([
                    apiFetch('/api/dashboard/alerts'),
                    apiFetch('/api/dashboard/history'),
                ]);

                if (!active) return;
                setAlerts(alertsData);
                setHistory(historyData);
            } catch (err) {
                if (!active) return;
                setError(err.message || 'Gösterge paneli verileri yüklenemedi.');
            } finally {
                if (active) setLoading(false);
            }
        };

        loadDashboardData();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        let active = true;

        const loadSummary = async () => {
            try {
                const summaryData = await apiFetch(`/api/dashboard/summary?city=${encodeURIComponent(weatherCity)}`);
                if (active) setSummary(summaryData);
            } catch (err) {
                if (active) setError(err.message || 'Özet verileri yüklenemedi.');
            }
        };

        loadSummary();
        return () => {
            active = false;
        };
    }, [weatherCity]);

    if (loading) {
        return (
            <div className="loading-state">
                <div className="spinner"></div>
                <p>Verileriniz veritabanından yükleniyor...</p>
            </div>
        );
    }

    const weatherLocation = summary.weather.district
        ? `${summary.weather.city} / ${summary.weather.district}`
        : summary.weather.city;
    const weatherSource = [summary.weather.source, summary.weather.date].filter(Boolean).join(' • ');

    return (
        <div className="dashboard-wrapper animate-fade-in">
            <div className="dashboard-header-text">
                <h1>Genel Durum Özeti</h1>
                <p className="text-muted">Tarlanızın ve piyasanın anlık durumu</p>
                {error && <p style={{ color: '#b91c1c', marginTop: '0.5rem' }}>{error}</p>}
            </div>

            <div className="dashboard-grid">
                <div className="dashboard-main">
                    <div className="summary-cards">
                        <div className="summary-card card">
                            <div className="card-icon-wrapper weather-icon">
                                <CloudSun size={24} />
                            </div>
                            <div className="card-content">
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <p className="card-label" style={{ marginBottom: 0 }}>Bölgesel Hava Durumu</p>
                                    <select
                                        value={weatherCity}
                                        onChange={(e) => setWeatherCity(e.target.value)}
                                        className="city-select-small"
                                        style={{ alignSelf: 'flex-start', maxWidth: '100%' }}
                                    >
                                        {cities.map((city) => <option key={city} value={city}>{city}</option>)}
                                    </select>
                                </div>
                                <h3 className="card-value">{summary.weather.temp}</h3>
                                <p className="card-meta">{summary.weather.condition} • Nem: {summary.weather.humidity}</p>
                                <p className="card-meta">{weatherLocation}{weatherSource ? ` • ${weatherSource}` : ''}</p>
                            </div>
                        </div>

                        <div className="summary-card card">
                            <div className="card-icon-wrapper moisture-icon">
                                <Droplets size={24} />
                            </div>
                            <div className="card-content">
                                <p className="card-label">Toprak Nemi</p>
                                <h3 className="card-value">{summary.soilMoisture.level}</h3>
                                <p className="card-meta text-success">{summary.soilMoisture.status} Seviyede</p>
                                {summary.soilMoisture.source && <p className="card-meta">{summary.soilMoisture.source}</p>}
                            </div>
                        </div>

                        <div className="summary-card card">
                            <div className="card-icon-wrapper trend-icon">
                                <TrendingUp size={24} />
                            </div>
                            <div className="card-content">
                                <p className="card-label">Genel Piyasa Trendi</p>
                                <h3 className="card-value">{summary.marketTrend.status}</h3>
                                <p className="card-meta text-primary">{summary.marketTrend.indicator} (Model Projeksiyonu)</p>
                            </div>
                        </div>
                    </div>

                    <div className="history-section card">
                        <div className="section-header">
                            <h2>Geçmiş Üretim Planlarım</h2>
                        </div>
                        <div className="table-responsive">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Plan Adı</th>
                                        <th>Planlama Tarihi</th>
                                        <th>Hedeflenen Verim</th>
                                        <th>Durum</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="text-muted">
                                                Henüz üretim planı oluşturmadınız. İlk planınızı oluşturduğunuzda geçmiş kayıtlar burada listelenecek.
                                            </td>
                                        </tr>
                                    ) : history.map((plan) => (
                                        <tr key={plan.id}>
                                            <td>
                                                <div className="plan-name-cell">
                                                    <Leaf size={16} className="text-primary" />
                                                    <span className="font-medium">{plan.name}</span>
                                                </div>
                                            </td>
                                            <td className="text-muted">{plan.date}</td>
                                            <td>
                                                <span className="yield-badge">{plan.targetYield}</span>
                                            </td>
                                            <td>
                                                <span className={`status-badge ${plan.status === 'Tamamlandı' ? 'success' : 'pending'}`}>
                                                    {plan.status}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="dashboard-sidebar">
                    <div className="alerts-section card">
                        <div className="section-header">
                            <h2>Acil Uyarılar</h2>
                            <span className="alert-count">{alerts.length}</span>
                        </div>

                        <div className="alerts-list">
                            {alerts.length === 0 ? (
                                <div className="alert-item">
                                    <div className="alert-content">
                                        <p className="alert-message">Henüz acil uyarı yok.</p>
                                        <span className="alert-time">Yeni analiz ve planlarınız oluştukça uyarılar burada görünecek.</span>
                                    </div>
                                </div>
                            ) : alerts.map((alert) => (
                                <div key={alert.id} className={`alert-item alert-${alert.type}`}>
                                    <div className="alert-icon">
                                        {alert.type === 'danger' ? <AlertCircle size={20} /> : <AlertTriangle size={20} />}
                                    </div>
                                    <div className="alert-content">
                                        <p className="alert-message">{alert.message}</p>
                                        <span className="alert-time">{alert.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="ai-insight-box">
                            <p className="insight-title">Yapay Zeka Yorumu</p>
                            <p className="insight-text">
                                Veritabanındaki iklim ve üretim planı verilerine göre yeni bir üretim planı oluşturarak riskleri daha iyi yönetebilirsiniz.
                            </p>
                            <button className="btn-primary w-full mt-3" onClick={() => navigate('/plan-wizard')}>
                                Yeni Plan Analizi Başlat
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
