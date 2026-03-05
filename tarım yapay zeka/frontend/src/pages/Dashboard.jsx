import React, { useState, useEffect } from 'react';
import {
    CloudSun,
    Droplets,
    TrendingUp,
    AlertTriangle,
    AlertCircle,
    ChevronRight,
    Leaf
} from 'lucide-react';
import './Dashboard.css';

const Dashboard = () => {
    const [summary, setSummary] = useState(null);
    const [alerts, setAlerts] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);

    // Simulate fetching data from the backend
    useEffect(() => {
        setTimeout(() => {
            setSummary({
                weather: { temp: "24°C", condition: "Güneşli", humidity: "%65" },
                soilMoisture: { level: "%42", status: "Optimum" },
                marketTrend: { status: "Yükseliş", indicator: "+%5.2" }
            });
            setAlerts([
                { id: 1, type: "warning", message: "Bölgenizde önümüzdeki hafta %20 kuraklık riski bekleniyor.", time: "2 saat önce" },
                { id: 2, type: "danger", message: "Arz Uyarısı: Buğday ekiminde bölgesel doygunluğa ulaşıldı.", time: "5 saat önce" }
            ]);
            setHistory([
                { id: 101, name: "2024 Buğday Ekimi", targetYield: "%95", status: "Hasat Bekliyor", date: "12 Ekim 2023" },
                { id: 102, name: "2023 Ayçiçeği", targetYield: "%88", status: "Tamamlandı", date: "15 Nisan 2023" },
                { id: 103, name: "2023 Mısır (2. Mahsul)", targetYield: "%92", status: "Tamamlandı", date: "20 Haziran 2023" }
            ]);
            setLoading(false);
        }, 800);
    }, []);

    if (loading) {
        return (
            <div className="loading-state">
                <div className="spinner"></div>
                <p>Verileriniz Yapay Zeka ile Analiz Ediliyor...</p>
            </div>
        );
    }

    return (
        <div className="dashboard-wrapper animate-fade-in">
            <div className="dashboard-header-text">
                <h1>Genel Durum Özeti</h1>
                <p className="text-muted">Tarlanızın ve piyasanın anlık durumu</p>
            </div>

            <div className="dashboard-grid">
                {/* Left Column (Main Content) */}
                <div className="dashboard-main">
                    {/* Top Cards */}
                    <div className="summary-cards">
                        <div className="summary-card card">
                            <div className="card-icon-wrapper weather-icon">
                                <CloudSun size={24} />
                            </div>
                            <div className="card-content">
                                <p className="card-label">Bölgesel Hava Durumu</p>
                                <h3 className="card-value">{summary.weather.temp}</h3>
                                <p className="card-meta">{summary.weather.condition} • Nem: {summary.weather.humidity}</p>
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
                            </div>
                        </div>

                        <div className="summary-card card">
                            <div className="card-icon-wrapper trend-icon">
                                <TrendingUp size={24} />
                            </div>
                            <div className="card-content">
                                <p className="card-label">Genel Piyasa Trendi</p>
                                <h3 className="card-value">{summary.marketTrend.status}</h3>
                                <p className="card-meta text-primary">{summary.marketTrend.indicator} (Son 30 Gün)</p>
                            </div>
                        </div>
                    </div>

                    {/* Past Plans Table */}
                    <div className="history-section card">
                        <div className="section-header">
                            <h2>Geçmiş Üretim Planlarım</h2>
                            <button className="btn-link">Tümünü Gör</button>
                        </div>
                        <div className="table-responsive">
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>Plan Adı</th>
                                        <th>Planlama Tarihi</th>
                                        <th>Hedeflenen Verim</th>
                                        <th>Durum</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((plan) => (
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
                                            <td>
                                                <button className="icon-btn" aria-label="Detayları Gör">
                                                    <ChevronRight size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Right Column (Alerts) */}
                <div className="dashboard-sidebar">
                    <div className="alerts-section card">
                        <div className="section-header">
                            <h2>Acil Uyarılar</h2>
                            <span className="alert-count">{alerts.length}</span>
                        </div>

                        <div className="alerts-list">
                            {alerts.map((alert) => (
                                <div key={alert.id} className={`alert-item alert-${alert.type}`}>
                                    <div className="alert-icon">
                                        {alert.type === 'danger' ? (
                                            <AlertCircle size={20} />
                                        ) : (
                                            <AlertTriangle size={20} />
                                        )}
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
                                Uyarılar doğrultusunda, bu sezon su tüketimi düşük olan alternatif ürünlere yönelmeniz önerilmektedir.
                                Yeni plan oluşturarak riskleri düşürebilirsiniz.
                            </p>
                            <button className="btn-primary w-full mt-3">Yeni Plan Analizi Başlat</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
