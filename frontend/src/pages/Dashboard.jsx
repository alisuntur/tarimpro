import React, { useEffect, useMemo, useState } from 'react';
import {
    CloudSun,
    Droplets,
    TrendingUp,
    AlertTriangle,
    AlertCircle,
    Leaf,
    MapPin,
    Info,
    CheckCircle2,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './Dashboard.css';

const initialSummary = {
    weather: { temp: '—', condition: 'Yükleniyor...', humidity: '—', city: '', district: null, source: '', date: null },
    soilMoisture: { level: '—', status: 'Yükleniyor...', source: '' },
    marketTrend: { status: 'Yükleniyor...', indicator: '0.0%' },
};

const emptyLocationOptions = {
    cities: [],
    districtsByCity: {},
};

const parsePercentValue = (value) => {
    const numeric = Number(String(value || '').replace('%', '').replace('+', '').replace(',', '.'));
    return Number.isFinite(numeric) ? numeric : null;
};

const formatLocation = (city, district) => {
    if (city && district) return `${city} / ${district}`;
    return city || district || '';
};

const locationOptionKey = (value) => (
    String(value || '')
        .trim()
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/\s+/g, ' ')
);

const addUnique = (items, value) => {
    if (!value) return;
    const valueKey = locationOptionKey(value);
    if (!items.some((item) => locationOptionKey(item) === valueKey)) {
        items.push(value);
    }
};

const buildSmartNotes = (summary, locationLabel) => {
    const soilLevel = parsePercentValue(summary.soilMoisture.level);
    const marketTrend = parsePercentValue(summary.marketTrend.indicator);
    const place = locationLabel || 'Seçili bölge';
    const notes = [];

    if (soilLevel !== null && soilLevel < 35) {
        notes.push({
            id: 'soil-low',
            type: 'warning',
            title: 'Toprak nemi takibi',
            message: `${place} için toprak nemi düşük görünüyor. Sulama planını kontrol etmek iyi olur.`,
            time: 'Güncel özet verisine göre',
        });
    } else if (soilLevel !== null && soilLevel > 70) {
        notes.push({
            id: 'soil-high',
            type: 'warning',
            title: 'Nem yüksek',
            message: `${place} için toprak nemi yüksek. Drenaj ve mantari hastalık riskini izleyin.`,
            time: 'Güncel özet verisine göre',
        });
    } else if (soilLevel !== null) {
        notes.push({
            id: 'soil-ok',
            type: 'success',
            title: 'Toprak nemi dengeli',
            message: `${place} için toprak nemi normal aralıkta görünüyor.`,
            time: 'Güncel özet verisine göre',
        });
    }

    if (marketTrend !== null && marketTrend < -1) {
        notes.push({
            id: 'market-down',
            type: 'warning',
            title: 'Piyasa trendi zayıf',
            message: `Model projeksiyonu ${place} için düşüş sinyali veriyor. Yeni plan öncesi ürün alternatiflerini karşılaştırın.`,
            time: `${summary.marketTrend.indicator} model projeksiyonu`,
        });
    } else if (marketTrend !== null && marketTrend > 1) {
        notes.push({
            id: 'market-up',
            type: 'info',
            title: 'Piyasa trendi pozitif',
            message: `Model projeksiyonu ${place} için üretim trendinde yükseliş gösteriyor.`,
            time: `${summary.marketTrend.indicator} model projeksiyonu`,
        });
    }

    if (notes.length === 0) {
        notes.push({
            id: 'no-critical-alert',
            type: 'info',
            title: 'Kritik uyarı yok',
            message: `${place} için şu anda acil müdahale gerektiren bir sinyal görünmüyor.`,
            time: 'Veriler yenilendikçe güncellenir',
        });
    }

    return notes.slice(0, 3);
};

const renderAlertIcon = (type) => {
    if (type === 'danger') return <AlertCircle size={20} />;
    if (type === 'success') return <CheckCircle2 size={20} />;
    if (type === 'info') return <Info size={20} />;
    return <AlertTriangle size={20} />;
};

const Dashboard = () => {
    const navigate = useNavigate();
    const routeLocation = useLocation();
    const { user } = useAuth();
    const profileLocation = useMemo(() => ({
        city: user?.city || '',
        district: user?.district || '',
    }), [user?.city, user?.district]);
    const [summary, setSummary] = useState(initialSummary);
    const [alerts, setAlerts] = useState([]);
    const [history, setHistory] = useState([]);
    const [locationOptions, setLocationOptions] = useState(emptyLocationOptions);
    const [locationForm, setLocationForm] = useState(profileLocation);
    const [appliedLocation, setAppliedLocation] = useState(profileLocation);
    const [loading, setLoading] = useState(true);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        setLocationForm(profileLocation);
        setAppliedLocation(profileLocation);
    }, [profileLocation]);

    useEffect(() => {
        let active = true;

        const loadDashboardData = async () => {
            try {
                const [alertsData, historyData, locationsData] = await Promise.all([
                    apiFetch('/api/dashboard/alerts'),
                    apiFetch('/api/dashboard/history'),
                    apiFetch('/api/locations/options'),
                ]);

                if (!active) return;
                setAlerts(alertsData);
                setHistory(historyData);
                setLocationOptions({
                    cities: locationsData.cities || [],
                    districtsByCity: locationsData.districtsByCity || {},
                });

                const profileCity = locationsData.profile?.city || profileLocation.city;
                const profileDistrict = locationsData.profile?.district || profileLocation.district;
                if (profileCity) {
                    const nextLocation = { city: profileCity, district: profileDistrict || '' };
                    setLocationForm(nextLocation);
                    setAppliedLocation(nextLocation);
                }
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
    }, [profileLocation.city, profileLocation.district]);

    useEffect(() => {
        let active = true;

        const loadSummary = async () => {
            setSummaryLoading(true);
            try {
                const query = new URLSearchParams();
                if (appliedLocation.city) query.set('city', appliedLocation.city);
                if (appliedLocation.district) query.set('district', appliedLocation.district);
                const suffix = query.toString() ? `?${query.toString()}` : '';
                const summaryData = await apiFetch(`/api/dashboard/summary${suffix}`);
                if (active) setSummary(summaryData);
            } catch (err) {
                if (active) setError(err.message || 'Özet verileri yüklenemedi.');
            } finally {
                if (active) setSummaryLoading(false);
            }
        };

        loadSummary();
        return () => {
            active = false;
        };
    }, [appliedLocation]);

    useEffect(() => {
        if (routeLocation.hash !== '#alerts' || loading) return;
        const timer = window.setTimeout(() => {
            document.getElementById('dashboard-alerts')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 80);
        return () => window.clearTimeout(timer);
    }, [routeLocation.hash, loading, alerts.length]);

    const cityOptions = useMemo(() => {
        const options = [];
        (locationOptions.cities || []).forEach((city) => addUnique(options, city));
        addUnique(options, profileLocation.city);
        addUnique(options, locationForm.city);
        addUnique(options, appliedLocation.city);
        return options;
    }, [locationOptions.cities, profileLocation.city, locationForm.city, appliedLocation.city]);

    const districtOptions = useMemo(() => {
        const options = [];
        (locationOptions.districtsByCity[locationForm.city] || []).forEach((district) => addUnique(options, district));
        addUnique(options, profileLocation.city === locationForm.city ? profileLocation.district : '');
        addUnique(options, locationForm.district);
        return options;
    }, [locationOptions.districtsByCity, locationForm.city, locationForm.district, profileLocation.city, profileLocation.district]);

    const weatherLocation = summary.weather.district
        ? `${summary.weather.city} / ${summary.weather.district}`
        : summary.weather.city;
    const weatherSource = [summary.weather.source, summary.weather.date].filter(Boolean).join(' • ');
    const currentLocationLabel = weatherLocation || formatLocation(appliedLocation.city, appliedLocation.district) || 'Profil konumu';
    const smartNotes = useMemo(() => buildSmartNotes(summary, currentLocationLabel), [summary, currentLocationLabel]);
    const displayedAlerts = alerts.length > 0 ? alerts : smartNotes;
    const showingSmartNotes = alerts.length === 0;

    const handleCityChange = (event) => {
        setLocationForm({ city: event.target.value, district: '' });
    };

    const handleDistrictChange = (event) => {
        setLocationForm((prev) => ({ ...prev, district: event.target.value }));
    };

    const handleLocationApply = (event) => {
        event.preventDefault();
        if (!locationForm.city) {
            setError('Konum güncellemek için önce il seçmelisiniz.');
            return;
        }
        setError('');
        setAppliedLocation({
            city: locationForm.city,
            district: locationForm.district,
        });
    };

    if (loading) {
        return (
            <div className="loading-state">
                <div className="spinner"></div>
                <p>Verileriniz veritabanından yükleniyor...</p>
            </div>
        );
    }

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
                                <div className="summary-card-heading">
                                    <p className="card-label">Bölgesel Hava Durumu</p>
                                    {summaryLoading && <span className="summary-refreshing">Güncelleniyor</span>}
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
                                        <th>İşlem</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="text-muted">
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
                                            <td className="history-action-cell">
                                                <button
                                                    type="button"
                                                    className="btn-secondary history-action-btn"
                                                    onClick={() => navigate(`/ai-recommendations?planId=${plan.id}`)}
                                                >
                                                    Raporu Aç
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="dashboard-sidebar">
                    <form className="location-filter-card card" onSubmit={handleLocationApply}>
                        <div className="location-filter-header">
                            <div className="location-filter-icon">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <h2>Konum Seçimi</h2>
                                <p>{formatLocation(appliedLocation.city, appliedLocation.district) || currentLocationLabel}</p>
                            </div>
                        </div>

                        <div className="location-filter-grid">
                            <label className="location-field">
                                <span>İl</span>
                                <select value={locationForm.city} onChange={handleCityChange}>
                                    <option value="">İl seçin</option>
                                    {cityOptions.map((city) => (
                                        <option key={city} value={city}>{city}</option>
                                    ))}
                                </select>
                            </label>
                            <label className="location-field">
                                <span>İlçe</span>
                                <select value={locationForm.district} onChange={handleDistrictChange} disabled={!locationForm.city || districtOptions.length === 0}>
                                    <option value="">İl geneli</option>
                                    {districtOptions.map((district) => (
                                        <option key={district} value={district}>{district}</option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        <button className="btn-primary w-full" type="submit" disabled={summaryLoading || !locationForm.city}>
                            {summaryLoading ? 'Güncelleniyor...' : 'Uygula'}
                        </button>
                    </form>

                    <div id="dashboard-alerts" className="alerts-section card">
                        <div className="section-header">
                            <h2>{showingSmartNotes ? 'Bölgesel Notlar' : 'Acil Uyarılar'}</h2>
                            <span className={`alert-count ${showingSmartNotes ? 'neutral' : ''}`}>{displayedAlerts.length}</span>
                        </div>

                        <div className="alerts-list">
                            {displayedAlerts.map((alert) => (
                                <div key={alert.id} className={`alert-item alert-${alert.type}`}>
                                    <div className="alert-icon">
                                        {renderAlertIcon(alert.type)}
                                    </div>
                                    <div className="alert-content">
                                        {alert.title && <span className="alert-title">{alert.title}</span>}
                                        <p className="alert-message">{alert.message}</p>
                                        <span className="alert-time">{alert.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="ai-insight-box">
                            <p className="insight-title">Yapay Zeka Yorumu</p>
                            <p className="insight-text">
                                {currentLocationLabel} için veritabanındaki iklim ve üretim planı verilerine göre yeni bir üretim planı oluşturarak riskleri daha iyi yönetebilirsiniz.
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
