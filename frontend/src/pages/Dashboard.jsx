import React, { useState, useEffect } from 'react';
import {
    CloudSun,
    Droplets,
    TrendingUp,
    AlertTriangle,
    AlertCircle,
    Leaf
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const Dashboard = () => {
    const navigate = useNavigate();
    const [summary, setSummary] = useState({
        weather: { temp: "—", condition: "Yükleniyor...", humidity: "—" },
        soilMoisture: { level: "%42", status: "Optimum" },
        marketTrend: { status: "Yükseliş", indicator: "+%5.2" }
    });
    const [alerts, setAlerts] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);

    // YENİ: Hava durumu için şehir seçimi
    const [weatherCity, setWeatherCity] = useState('Adana');
    const cities = [
        'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
        'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale',
        'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum',
        'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin',
        'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli',
        'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş',
        'Nevşehir', 'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas',
        'Tekirdağ', 'Tokat', 'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat',
        'Zonguldak', 'Aksaray', 'Bayburt', 'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın',
        'Ardahan', 'Iğdır', 'Yalova', 'Karabük', 'Kilis', 'Osmaniye', 'Düzce'
    ].sort((a, b) => a.localeCompare(b, 'tr'));


    // Simulate fetching data from the backend
    useEffect(() => {
        setTimeout(() => {
            setAlerts([
                { id: 1, type: "warning", message: "Bölgenizde önümüzdeki hafta %20 kuraklık riski bekleniyor.", time: "2 saat önce" },
                { id: 2, type: "danger", message: "Arz Uyardısı: Buğday ekiminde bölgesel doygunluğa ulaşıldı.", time: "5 saat önce" }
            ]);
            setHistory([
                { id: 101, name: "2024 Buğday Ekimi", targetYield: "%95", status: "Hasat Bekliyor", date: "12 Ekim 2023" },
                { id: 102, name: "2023 Ayçiçeği", targetYield: "%88", status: "Tamamlandı", date: "15 Nisan 2023" },
                { id: 103, name: "2023 Mısır (2. Mahsul)", targetYield: "%92", status: "Tamamlandı", date: "20 Haziran 2023" }
            ]);
            setLoading(false);
        }, 500);
    }, []);

    // Dinamik hava durumu verisi çekme işlemi - bağımsız olarak çalışır
    useEffect(() => {

        const fetchWeather = async () => {
            try {
                // Şehir ismini lokasyona çevir (Geocoding API)
                const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${weatherCity}&count=1&language=tr&format=json`);
                const geoData = await geoRes.json();

                if (!geoData.results || geoData.results.length === 0) {
                    console.warn(`No geocoding results for ${weatherCity}`);
                    setSummary(prev => {
                        if (!prev) return prev;
                        return {
                            ...prev,
                            weather: { temp: "N/A", condition: "Bulunamadı", humidity: "N/A" }
                        };
                    });
                    return;
                }
                const { latitude, longitude } = geoData.results[0];

                // Hava durumu API'si (Koordinatlar ile - Toprak Nemi de dahil edildi)
                const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,weather_code&hourly=soil_moisture_0_to_1cm&timezone=auto&forecast_days=1`);
                const data = await response.json();

                const wmoCodes = {
                    0: "Açık", 1: "Çoğunlukla Açık", 2: "Parçalı Bulutlu", 3: "Kapalı",
                    45: "Sisli", 48: "Puslu", 51: "Hafif Çisenti", 53: "Çisenti", 55: "Yoğun Çisenti",
                    61: "Hafif Yağmurlu", 63: "Yağmurlu", 65: "Kuvvetli Yağmurlu",
                    71: "Hafif Kar Yağışlı", 73: "Kar Yağışlı", 75: "Yoğun Kar Yağışlı",
                    77: "Kar Taneleri", 80: "Hafif Sağanak", 81: "Sağanak Yağışlı", 82: "Kuvvetli Sağanak",
                    95: "Gök Gürültülü Fırtına", 96: "Hafif Dolulu Fırtına", 99: "Dolulu Fırtına"
                };

                const current = data.current;
                const condition = wmoCodes[current.weather_code] || "Bilinmiyor";

                // Gerçek uydusal toprak nemini al (0-1cm derinlik, m³/m³ cinsinden)
                // Hourly verisinin ilk saatini (şu an) alırız. 0.150 m³/m³ gibi bir değer döner
                let moistureValue = 0.3; // fallback 
                if (data.hourly && data.hourly.soil_moisture_0_to_1cm && data.hourly.soil_moisture_0_to_1cm.length > 0) {
                    moistureValue = data.hourly.soil_moisture_0_to_1cm[0];
                }

                // m³/m³ değerini % oranına çevirme (Örn: 0.180 -> %18) ve tarımsal 0.5 max kapasiteye göre ölçekleme
                // Genellikle %10 altı aşırı kurak, %15-30 optimum, %35 üstü suya doygun sayılır
                const moisturePercentage = Math.round(moistureValue * 100);
                let soilStatus = "Optimum";
                if (moisturePercentage < 15) soilStatus = "Kuru";
                if (moisturePercentage > 35) soilStatus = "Islak";

                setSummary(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        weather: {
                            temp: `${Math.round(current.temperature_2m)}°C`,
                            condition: condition,
                            humidity: `%${Math.round(current.relative_humidity_2m)}`
                        },
                        // Artık gerçek değerle gösteriliyor (%)
                        soilMoisture: { level: `%${moisturePercentage}`, status: soilStatus }
                    };
                });
            } catch (error) {
                console.error("Hava durumu çekilemedi:", error);
                setSummary(prev => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        weather: { temp: "Hata", condition: "Yüklenemedi", humidity: "Hata" }
                    };
                });
            }
        };

        fetchWeather();
    }, [weatherCity]);

    const handleLoadMoreHistory = () => {
        setIsLoadingMore(true);
        // Simulate an API call to fetch older records
        setTimeout(() => {
            const moreHistory = [
                { id: 104, name: "2022 Şeker Pancarı", targetYield: "%85", status: "Tamamlandı", date: "10 Mart 2022" },
                { id: 105, name: "2022 Buğday Ekimi", targetYield: "%90", status: "Tamamlandı", date: "05 Ekim 2021" },
                { id: 106, name: "2021 Pamuk", targetYield: "%82", status: "Tamamlandı", date: "20 Nisan 2021" }
            ];
            setHistory(prev => [...prev, ...moreHistory]);
            setIsLoadingMore(false);
            setHasMoreHistory(false); // Only mock one extra page
        }, 600);
    };

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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    <p className="card-label" style={{ marginBottom: 0 }}>Bölgesel Hava Durumu</p>
                                    <select
                                        value={weatherCity}
                                        onChange={(e) => setWeatherCity(e.target.value)}
                                        className="city-select-small"
                                        style={{ alignSelf: 'flex-start', maxWidth: '100%' }}
                                    >
                                        {cities.map(city => <option key={city} value={city}>{city}</option>)}
                                    </select>
                                </div>
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
                            {hasMoreHistory && (
                                <button
                                    className="btn-link"
                                    onClick={handleLoadMoreHistory}
                                    disabled={isLoadingMore}
                                >
                                    {isLoadingMore ? "Yükleniyor..." : "Tümünü Gör"}
                                </button>
                            )}
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
                                Mevcut piyasa verilerine ve bölgesel analizlere göre riskleri minimize etmek için yeni bir üretim planı oluşturmanız önerilmektedir.
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
