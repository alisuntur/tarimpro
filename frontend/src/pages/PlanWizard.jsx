import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MapPin,
    Scaling,
    Sprout,
    Sparkles,
    Leaf,
    Sun,
    Droplet,
    Apple,
    Grape,
    Nut,
    Trees,
    Database,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import './PlanWizard.css';

const citiesList = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara',
    'Antalya', 'Aydın', 'Balıkesir', 'Batman', 'Burdur', 'Bursa', 'Çanakkale',
    'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum',
    'Eskişehir', 'Gaziantep', 'Giresun', 'Hatay', 'Isparta', 'İstanbul', 'İzmir',
    'Kahramanmaraş', 'Kars', 'Kayseri', 'Kırıkkale', 'Kocaeli', 'Konya', 'Kütahya',
    'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Nevşehir', 'Ordu',
    'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sivas', 'Şanlıurfa',
    'Tekirdağ', 'Tokat', 'Trabzon', 'Uşak', 'Van', 'Zonguldak',
];

const numberFormatter = new Intl.NumberFormat('tr-TR');

const cropIconFor = (cropName) => {
    const normalized = cropName.toLocaleLowerCase('tr-TR');

    if (normalized.includes('ayçiçe')) return <Sun size={28} />;
    if (normalized.includes('pamuk')) return <Droplet size={28} />;
    if (normalized.includes('mısır')) return <Sprout size={28} />;
    if (normalized.includes('üzüm')) return <Grape size={28} />;
    if (normalized.includes('fındık')) return <Nut size={28} />;
    if (normalized.includes('zeytin')) return <Trees size={28} />;
    if (normalized.includes('elma')) return <Apple size={28} />;
    return <Leaf size={28} />;
};

const PlanWizard = () => {
    const navigate = useNavigate();
    const [selectedFieldId, setSelectedFieldId] = useState('');
    const [fieldOptions, setFieldOptions] = useState([]);
    const [city, setCity] = useState('');
    const [size, setSize] = useState('');
    const [selectedCrop, setSelectedCrop] = useState('');
    const [cropOptions, setCropOptions] = useState([]);
    const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
    const [optionsLoading, setOptionsLoading] = useState(true);
    const [cropLoading, setCropLoading] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState('');

    const selectedField = useMemo(
        () => fieldOptions.find((field) => field.id === selectedFieldId) || null,
        [fieldOptions, selectedFieldId],
    );

    useEffect(() => {
        let active = true;

        const loadInitialOptions = async () => {
            setOptionsLoading(true);
            setError('');
            try {
                const payload = await apiFetch('/api/plans/options');
                if (!active) return;
                setFieldOptions(payload.fields || []);
                setCropOptions(payload.cropOptions || []);
                setSeasonYear(payload.seasonYear || new Date().getFullYear());
                setCity(payload.defaultCity || '');
            } catch (err) {
                if (active) {
                    setError(err.message || 'Plan seçenekleri yüklenemedi.');
                }
            } finally {
                if (active) setOptionsLoading(false);
            }
        };

        loadInitialOptions();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (!city) return;

        let active = true;

        const loadCropOptions = async () => {
            setCropLoading(true);
            setError('');
            try {
                const payload = await apiFetch(`/api/plans/options?city=${encodeURIComponent(city)}`);
                if (!active) return;
                setFieldOptions(payload.fields || []);
                setCropOptions(payload.cropOptions || []);
                setSeasonYear(payload.seasonYear || new Date().getFullYear());
            } catch (err) {
                if (active) {
                    setError(err.message || 'İl bazlı ürün verileri yüklenemedi.');
                    setCropOptions([]);
                }
            } finally {
                if (active) setCropLoading(false);
            }
        };

        loadCropOptions();
        return () => {
            active = false;
        };
    }, [city]);

    useEffect(() => {
        if (!selectedField) return;
        if (selectedField.city && selectedField.city !== city) {
            setCity(selectedField.city);
        }
        if (!size) {
            setSize(String(selectedField.size || ''));
        }
    }, [selectedField, city, size]);

    useEffect(() => {
        if (selectedCrop && !cropOptions.some((crop) => crop.name === selectedCrop)) {
            setSelectedCrop('');
        }
    }, [cropOptions, selectedCrop]);

    const handleFieldChange = (fieldId) => {
        setSelectedFieldId(fieldId);
        setError('');
    };

    const handleCityChange = (nextCity) => {
        setCity(nextCity);
        setError('');
        if (selectedField && selectedField.city !== nextCity) {
            setSelectedFieldId('');
        }
    };

    const handleAnalyze = async () => {
        if (!city || !size) return;

        setIsAnalyzing(true);
        setError('');

        try {
            const payload = await apiFetch('/api/plans', {
                method: 'POST',
                body: {
                    fieldId: selectedFieldId || null,
                    city,
                    district: selectedField?.district || null,
                    regionCode: selectedField?.regionCode || null,
                    plannedAreaDecare: Number(size),
                    selectedCropName: selectedCrop || null,
                    seasonYear,
                },
            });

            navigate(`/ai-recommendations?planId=${payload.plan.id}`);
        } catch (err) {
            setError(err.message || 'Plan oluşturulamadı.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const isFormValid = city !== '' && size !== '';

    return (
        <div className="wizard-container animate-fade-in">
            <div className="wizard-header-text">
                <h1>Yeni Üretim Planı Oluştur</h1>
                <p className="text-muted">Üretim planını veritabanına kaydet, sonra gerçek verilerle analiz et</p>
            </div>

            <div className="wizard-card card">
                <div className="wizard-step">
                    <div className="step-header">
                        <div className="step-number">0</div>
                        <h3>Kayıtlı Tarla Seçimi</h3>
                    </div>
                    <div className="step-content">
                        <div className="input-with-icon" style={{ marginBottom: '0.75rem' }}>
                            <Database className="input-icon" size={20} />
                            <select
                                className="wizard-input select-field"
                                value={selectedFieldId}
                                onChange={(e) => handleFieldChange(e.target.value)}
                            >
                                <option value="">Kayıtlı tarla seçmeden devam et</option>
                                {fieldOptions.map((field) => (
                                    <option key={field.id} value={field.id}>
                                        {field.name} · {field.city} · {numberFormatter.format(field.size)} dönüm
                                    </option>
                                ))}
                            </select>
                        </div>
                        <p className="wizard-helper-text">
                            Tarla seçersen şehir bilgisi ve öneriler o tarla bağlamına göre şekillenir.
                        </p>
                    </div>
                </div>

                <div className="wizard-step">
                    <div className="step-header">
                        <div className="step-number">1</div>
                        <h3>Planın Şehri</h3>
                    </div>
                    <div className="step-content">
                        <div className="location-inputs-wrapper">
                            <div className="input-with-icon" style={{ marginBottom: '0.75rem' }}>
                                <MapPin className="input-icon" size={20} />
                                <select
                                    className="wizard-input select-field"
                                    value={city}
                                    onChange={(e) => handleCityChange(e.target.value)}
                                >
                                    <option value="" disabled>Türkiye'den bir şehir seçiniz...</option>
                                    {citiesList.map((cityName) => (
                                        <option key={cityName} value={cityName}>{cityName}</option>
                                    ))}
                                </select>
                            </div>
                            {selectedField && (
                                <div className="selected-field-summary">
                                    <strong>{selectedField.name}</strong>
                                    <span>{selectedField.city}{selectedField.district ? ` / ${selectedField.district}` : ''}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="wizard-step">
                    <div className="step-header">
                        <div className="step-number">2</div>
                        <h3>Planlanan Alan</h3>
                    </div>
                    <div className="step-content">
                        <div className="size-input-wrapper">
                            <Scaling className="input-icon" size={20} />
                            <input
                                type="number"
                                className="wizard-input size-input"
                                placeholder="Örn: 150"
                                value={size}
                                onChange={(e) => setSize(e.target.value)}
                                min="1"
                            />
                            <span className="unit-label">Dönüm</span>
                        </div>
                        <p className="wizard-helper-text">
                            İstersen kayıtlı tarlanın tamamı yerine yalnızca analiz etmek istediğin alanı yazabilirsin.
                        </p>
                    </div>
                </div>

                <div className="wizard-step">
                    <div className="step-header">
                        <div className="step-number">3</div>
                        <h3>Düşündüğünüz Ürün</h3>
                    </div>
                    <div className="step-content">
                        <p className="wizard-helper-text crop-helper">
                            Bu liste seçtiğin ilin son üretim sezonu verilerinden oluşturulur. İstersen boş bırakıp genel öneri alabilirsin.
                        </p>
                        {cropLoading ? (
                            <div className="loading-inline">İl bazlı ürün seçenekleri yükleniyor...</div>
                        ) : cropOptions.length > 0 ? (
                            <div className="crop-selector">
                                {cropOptions.map((crop) => (
                                    <button
                                        key={crop.name}
                                        type="button"
                                        className={`crop-btn ${selectedCrop === crop.name ? 'selected' : ''}`}
                                        onClick={() => setSelectedCrop(selectedCrop === crop.name ? '' : crop.name)}
                                    >
                                        <div className="crop-icon-wrapper">
                                            {cropIconFor(crop.name)}
                                        </div>
                                        <span className="crop-name">{crop.name}</span>
                                        <span className="crop-meta">
                                            {crop.latestYear || 'Son yıl'} · {crop.latestProductionTon ? `${numberFormatter.format(crop.latestProductionTon)} ton` : 'Üretim verisi yok'}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-inline-state">
                                Seçilen şehir için ürün verisi bulunamadı. Şehri değiştirip tekrar deneyebilirsin.
                            </div>
                        )}
                    </div>
                </div>

                <div className="wizard-action">
                    <button
                        className={`btn-ai-analyze ${isFormValid ? 'ready' : ''} ${isAnalyzing ? 'analyzing' : ''}`}
                        onClick={handleAnalyze}
                        disabled={!isFormValid || isAnalyzing || optionsLoading}
                    >
                        {isAnalyzing ? (
                            <>
                                <div className="spinner-small"></div>
                                Plan Kaydediliyor ve Analiz Başlatılıyor...
                            </>
                        ) : (
                            <>
                                <Sparkles size={24} className="sparkle-icon" />
                                Planı Kaydet ve Analize Geç
                            </>
                        )}
                    </button>
                    {!isFormValid && (
                        <p className="validation-text">Lütfen analiz için şehir ve büyüklük bilgilerini doldurun.</p>
                    )}
                    {error && <p className="validation-text validation-error">{error}</p>}
                </div>
            </div>

            <div className="analysis-factors-card card animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="factors-header">
                    <Sparkles className="factors-icon" size={28} />
                    <h2>Neye Göre Analiz Yapıyoruz?</h2>
                </div>
                <p className="factors-description">
                    Sprint 2 ile bu akış yerel state yerine gerçek veritabanı kayıtları üstünden ilerler. Kaydettiğin plan, AI analiz ekranında tekrar okunur ve şehir bazlı geçmiş üretim verileriyle desteklenir.
                </p>
                <div className="factors-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                    <div className="factor-item">
                        <div className="factor-icon-wrapper bg-warning-light">
                            <Sun className="text-warning" size={24} />
                        </div>
                        <div className="factor-content">
                            <h4>İklim ve Hava Verisi</h4>
                            <p>Bölgenin sıcaklık, yağış ve toprak nemi serileri doğrudan analitik veritabanından okunur.</p>
                        </div>
                    </div>

                    <div className="factor-item">
                        <div className="factor-icon-wrapper bg-primary-light-custom">
                            <Leaf className="text-primary-dark" size={24} />
                        </div>
                        <div className="factor-content">
                            <h4>Geçmiş Üretim Kayıtları</h4>
                            <p>Seçilen ilin son üretim sezonu kayıtları ürün listesini ve sonraki analiz ekranındaki karşılaştırmaları belirler.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlanWizard;
