import React, { useState } from 'react';
import TurkeyMap from 'turkey-map-react';
import { Cloud, Droplets, MapPin, Sprout, Thermometer, CalendarDays } from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import './RegionalAnalysis.css';

const getDynamicMockData = (cityName) => {
    const crops = ['Buğday', 'Arpa', 'Ayçiçeği', 'Mısır', 'Pamuk', 'Şeker Pancarı', 'Zeytin', 'Fındık'];
    const randomCrop1 = crops[Math.floor(Math.random() * crops.length)];
    let randomCrop2 = crops[Math.floor(Math.random() * crops.length)];
    while (randomCrop1 === randomCrop2) {
        randomCrop2 = crops[Math.floor(Math.random() * crops.length)];
    }
    const soils = ['Killi-Tınlı', 'Kumlu-Tınlı', 'Kireçli', 'Humuslu'];
    const precipitations = [300, 450, 600, 800, 1000, 1200];

    return {
        name: cityName,
        temperature: '...',
        precipitation: precipitations[Math.floor(Math.random() * precipitations.length)],
        soilType: soils[Math.floor(Math.random() * soils.length)],
        recommendedCrops: [randomCrop1, randomCrop2],
        riskLevel: Math.random() > 0.7 ? 'Yüksek' : (Math.random() > 0.4 ? 'Orta' : 'Düşük'),
        humidity: '...'
    };
};

const DAYS_TR = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];

const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
        return (
            <div style={{
                background: 'rgba(20,30,24,0.95)',
                border: '1px solid var(--color-primary)',
                borderRadius: '10px',
                padding: '10px 16px',
                fontSize: '0.82rem',
                color: '#e2e8f0'
            }}>
                <p style={{ fontWeight: 700, marginBottom: 6, color: 'var(--color-primary-light)' }}>{label}</p>
                {payload.map((p, i) => (
                    <p key={i} style={{ color: p.color, margin: '2px 0' }}>
                        {p.name}: <strong>{p.value}{p.name === 'Sıcaklık (°C)' ? '°C' : '%'}</strong>
                    </p>
                ))}
            </div>
        );
    }
    return null;
};

const RegionalAnalysis = () => {
    const [selectedCity, setSelectedCity] = useState(null);
    const [cityData, setCityData] = useState(null);
    const [isLoadingWeather, setIsLoadingWeather] = useState(false);
    const [forecastData, setForecastData] = useState([]);
    const [isLoadingForecast, setIsLoadingForecast] = useState(false);

    React.useEffect(() => {
        if (!selectedCity) return;

        let isMounted = true;
        setIsLoadingWeather(true);
        setIsLoadingForecast(true);
        setForecastData([]);

        const mockData = getDynamicMockData(selectedCity);
        setCityData(mockData);

        const fetchWeatherData = async () => {
            try {
                // Geocoding
                const geoRes = await fetch(
                    `https://geocoding-api.open-meteo.com/v1/search?name=${selectedCity}&count=1&language=tr&format=json`
                );
                const geoData = await geoRes.json();

                if (!geoData.results || geoData.results.length === 0) {
                    if (isMounted) {
                        setIsLoadingWeather(false);
                        setIsLoadingForecast(false);
                        setCityData(prev => ({ ...prev, temperature: 'Bulunamadı', humidity: 'Bulunamadı' }));
                    }
                    return;
                }
                const { latitude, longitude } = geoData.results[0];

                // Anlık + 16 günlük tahmin (günlük + saatlik)
                const response = await fetch(
                    `https://api.open-meteo.com/v1/forecast?` +
                    `latitude=${latitude}&longitude=${longitude}` +
                    `&current=temperature_2m,relative_humidity_2m` +
                    `&hourly=soil_moisture_0_to_1cm` +
                    `&daily=temperature_2m_max,temperature_2m_min,precipitation_sum` +
                    `&timezone=auto&forecast_days=16`
                );
                const data = await response.json();

                if (!isMounted) return;

                // Anlık veri
                if (data.current) {
                    let moistureValue = 0.3;
                    if (data.hourly?.soil_moisture_0_to_1cm?.length > 0) {
                        moistureValue = data.hourly.soil_moisture_0_to_1cm[0];
                    }
                    const moisturePercentage = Math.round(moistureValue * 100);
                    let soilDescription = 'Optimum Nem';
                    if (moisturePercentage < 15) soilDescription = 'Kuru / Düşük Nem';
                    if (moisturePercentage > 35) soilDescription = 'Islak / Yüksek Nem';

                    setCityData(prev => ({
                        ...prev,
                        temperature: Math.round(data.current.temperature_2m),
                        humidity: Math.round(data.current.relative_humidity_2m),
                        soilType: `${prev.soilType} (${soilDescription}: %${moisturePercentage})`
                    }));
                    setIsLoadingWeather(false);
                }

                // 16 Günlük tahmin (günlük)
                if (data.daily?.time) {
                    // Saatlik toprak nemi: günlük ortalama için 24'erli grupla
                    const hourlyMoisture = data.hourly?.soil_moisture_0_to_1cm || [];

                    const parsed = data.daily.time.map((dateStr, i) => {
                        const date = new Date(dateStr);
                        const label = `${DAYS_TR[date.getDay()]} ${date.getDate()}/${date.getMonth() + 1}`;

                        // O güne ait saatler: i*24 → (i+1)*24
                        const dayMoistureSlice = hourlyMoisture.slice(i * 24, (i + 1) * 24);
                        const avgMoisture = dayMoistureSlice.length > 0
                            ? dayMoistureSlice.reduce((a, b) => a + b, 0) / dayMoistureSlice.length
                            : 0.3;

                        return {
                            label,
                            maxTemp: data.daily.temperature_2m_max[i],
                            minTemp: data.daily.temperature_2m_min[i],
                            yagis: Math.round((data.daily.precipitation_sum[i] || 0) * 10) / 10,
                            toprakNemi: Math.round(avgMoisture * 100)
                        };
                    });

                    setForecastData(parsed);
                    setIsLoadingForecast(false);
                }
            } catch (error) {
                console.error('Hava durumu verisi çekilemedi:', error);
                if (isMounted) {
                    setIsLoadingWeather(false);
                    setIsLoadingForecast(false);
                    setCityData(prev => ({ ...prev, temperature: 'Hata', humidity: 'Hata' }));
                }
            }
        };

        fetchWeatherData();
        return () => { isMounted = false; };
    }, [selectedCity]);

    return (
        <div className="regional-analysis-container animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Bölgesel Analiz</h1>
                    <p className="page-subtitle text-muted">Devam etmek veya daha fazla analiz görmek için haritadan bir şehir seçin.</p>
                </div>
            </div>

            <div className="analysis-grid">
                {/* Harita */}
                <div className="map-card card">
                    <div className="map-header">
                        <h2>Türkiye Haritası</h2>
                        <span className="tooltip-info">Şehir seçmek için üzerine tıklayın</span>
                    </div>
                    <div className="map-wrapper">
                        <TurkeyMap
                            hoverable={true}
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
                                selectedColor: '#2d6a4f'
                            }}
                        />
                    </div>
                </div>

                {/* Şehir Detayları */}
                <div className="city-details-card card">
                    {selectedCity && cityData ? (
                        <>
                            <div className="city-header border-b">
                                <div className="city-title-group">
                                    <div className="icon-wrapper bg-primary-light">
                                        <MapPin color="var(--color-primary-dark)" size={24} />
                                    </div>
                                    <div>
                                        <h2>{selectedCity} Analizi</h2>
                                        <div className={`risk-badge risk-${cityData.riskLevel.toLowerCase().replace('ü', 'u').replace('ş', 's')}`}>
                                            Risk Seviyesi: {cityData.riskLevel}
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
                                        <h4>Anlık Sıcaklık</h4>
                                        <span className="stat-value">{isLoadingWeather ? '...' : `${cityData.temperature}°C`}</span>
                                    </div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-icon-wrapper text-info">
                                        <Cloud size={20} />
                                    </div>
                                    <div className="stat-details">
                                        <h4>Yıllık Yağış</h4>
                                        <span className="stat-value">{cityData.precipitation} mm</span>
                                    </div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-icon-wrapper text-info">
                                        <Droplets size={20} />
                                    </div>
                                    <div className="stat-details">
                                        <h4>Nem Oranı</h4>
                                        <span className="stat-value">{isLoadingWeather ? '...' : `%${cityData.humidity}`}</span>
                                    </div>
                                </div>
                                <div className="stat-box">
                                    <div className="stat-icon-wrapper text-success">
                                        <Sprout size={20} />
                                    </div>
                                    <div className="stat-details">
                                        <h4>Toprak Tipi</h4>
                                        <span className="stat-value" style={{ fontSize: '0.8rem' }}>{cityData.soilType}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="recommended-crops">
                                <h3>Önerilen Ürünler</h3>
                                <div className="crop-tags">
                                    {cityData.recommendedCrops.map((crop, index) => (
                                        <span key={index} className="crop-tag">
                                            <Sprout size={16} />
                                            {crop}
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
                            <h3>Şehir Seçilmedi</h3>
                            <p className="text-muted">Analiz verilerini görüntülemek için harita üzerinden bir il seçiniz.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 16 Günlük Tahmin Grafiği */}
            {selectedCity && (
                <div className="card forecast-chart-card" style={{ marginTop: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginBottom: '1.25rem' }}>
                        <CalendarDays size={22} color="var(--color-primary)" />
                        <h2 style={{ margin: 0 }}>16 Günlük Hava Tahmini — {selectedCity}</h2>
                    </div>

                    {isLoadingForecast ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 220, color: 'var(--color-text-muted)', gap: 12 }}>
                            <div className="spinner" style={{ width: 24, height: 24 }} />
                            <span>Tahmin verileri yükleniyor...</span>
                        </div>
                    ) : forecastData.length > 0 ? (
                        <>
                            {/* Sıcaklık Grafiği */}
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                                Günlük Min / Maks Sıcaklık (°C)
                            </p>
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={forecastData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradMax" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f97316" stopOpacity={0.35} />
                                            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradMin" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.35} />
                                            <stop offset="95%" stopColor="#38bdf8" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit="°" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '0.82rem' }} />
                                    <Area type="monotone" dataKey="maxTemp" name="Maks (°C)" stroke="#f97316" fill="url(#gradMax)" strokeWidth={2} dot={false} />
                                    <Area type="monotone" dataKey="minTemp" name="Min (°C)" stroke="#38bdf8" fill="url(#gradMin)" strokeWidth={2} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>

                            {/* Toprak Nemi Grafiği */}
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', margin: '1.25rem 0 0.5rem' }}>
                                Günlük Ortalama Toprak Nemi (%)
                            </p>
                            <ResponsiveContainer width="100%" height={180}>
                                <AreaChart data={forecastData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                                    <defs>
                                        <linearGradient id="gradMoisture" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#2d6a4f" stopOpacity={0.5} />
                                            <stop offset="95%" stopColor="#2d6a4f" stopOpacity={0.05} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.07)" />
                                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#94a3b8' }} />
                                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} unit="%" />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '0.82rem' }} />
                                    <Area type="monotone" dataKey="toprakNemi" name="Toprak Nemi (%)" stroke="var(--color-primary)" fill="url(#gradMoisture)" strokeWidth={2} dot={false} />
                                </AreaChart>
                            </ResponsiveContainer>

                            {/* Yağış Özeti */}
                            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem', margin: '1.25rem 0 0.75rem' }}>
                                Günlük Yağış (mm)
                            </p>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                {forecastData.map((d, i) => (
                                    <div key={i} style={{
                                        flex: '1 1 60px',
                                        textAlign: 'center',
                                        background: d.yagis > 0 ? 'rgba(56,189,248,0.12)' : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${d.yagis > 0 ? '#38bdf8' : 'rgba(255,255,255,0.08)'}`,
                                        borderRadius: '8px',
                                        padding: '6px 4px'
                                    }}>
                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginBottom: 2 }}>{d.label}</div>
                                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: d.yagis > 0 ? '#38bdf8' : '#64748b' }}>
                                            {d.yagis > 0 ? `${d.yagis}mm` : '—'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    ) : (
                        <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0' }}>
                            Tahmin verisi alınamadı.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default RegionalAnalysis;
