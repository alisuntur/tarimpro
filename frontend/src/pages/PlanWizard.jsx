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

const getCropCategory = (cropName) => {
    const normalized = cropName.toLocaleLowerCase('tr-TR');

    if (normalized.includes('mısır') || normalized.includes('buğday') || normalized.includes('arpa') || 
        normalized.includes('çavdar') || normalized.includes('yulaf')) {
        return 'Tahıllar';
    }
    if (normalized.includes('ayçiçe') || normalized.includes('soya') || normalized.includes('kanola') || 
        normalized.includes('kolza')) {
        return 'Yağlı Tohumlar';
    }
    if (normalized.includes('pamuk')) {
        return 'Lifli Ürünler';
    }
    if (normalized.includes('fındık')) {
        return 'Kabuklu Meyveler';
    }
    if (normalized.includes('zeytin')) {
        return 'Ağaç Ürünleri';
    }
    if (normalized.includes('elma') || normalized.includes('armut') || normalized.includes('kiraz') ||
        normalized.includes('şeftali') || normalized.includes('kayısı') || normalized.includes('karpuz')) {
        return 'Meyve';
    }
    if (normalized.includes('çilek') || normalized.includes('böğürtlen') || normalized.includes('ahududu')) {
        return 'Berry Ürünleri';
    }
    if (normalized.includes('domates') || normalized.includes('biber') || normalized.includes('salatalık') ||
        normalized.includes('kabak') || normalized.includes('patlıcan')) {
        return 'Sebze';
    }
    return 'Diğer';
};

const groupCropsByCategory = (crops) => {
    const grouped = {};
    crops.forEach((crop) => {
        const category = getCropCategory(crop.name);
        if (!grouped[category]) {
            grouped[category] = [];
        }
        grouped[category].push(crop);
    });
    return grouped;
};

const CATEGORY_ORDER = [
    'Tahıllar',
    'Yağlı Tohumlar',
    'Lifli Ürünler',
    'Sebze',
    'Meyve',
    'Berry Ürünleri',
    'Kabuklu Meyveler',
    'Ağaç Ürünleri',
    'Diğer',
];

const PlanWizard = () => {
    const navigate = useNavigate();
    const [selectedFieldId, setSelectedFieldId] = useState('');
    const [fieldOptions, setFieldOptions] = useState([]);
    const [city, setCity] = useState('');
    const [size, setSize] = useState('');
    const [selectedCrop, setSelectedCrop] = useState('');
    const [cropOptions, setCropOptions] = useState([]);
    const [selectedCropCategory, setSelectedCropCategory] = useState('');
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
                    district: selectedField && selectedField.city === city ? selectedField.district || null : null,
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
                            <>
                                {(() => {
                                    const groupedCrops = groupCropsByCategory(cropOptions);
                                    const availableCategories = CATEGORY_ORDER.filter((cat) => groupedCrops[cat]?.length > 0);
                                    const defaultCategory = availableCategories[0] || '';
                                    const activeCategory = selectedCropCategory || defaultCategory;
                                    const cropsInCategory = groupedCrops[activeCategory] || [];

                                    return (
                                        <>
                                            <div className="crop-category-tabs">
                                                {availableCategories.map((category) => (
                                                    <button
                                                        key={category}
                                                        className={`crop-category-tab ${activeCategory === category ? 'active' : ''}`}
                                                        onClick={() => setSelectedCropCategory(category)}
                                                    >
                                                        {category}
                                                        <span className="category-count">{groupedCrops[category].length}</span>
                                                    </button>
                                                ))}
                                            </div>
                                            <div className="crop-selector">
                                                {cropsInCategory.map((crop) => (
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
                                        </>
                                    );
                                })()}
                            </>
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
                    Üretim planın kaydedildikten sonra AI analiz sistemi üç ana faktörü dikkate alarak kişiselleştirilmiş öneriler sunacaktır.
                </p>
                <div className="factors-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                    <div className="factor-item">
                        <div className="factor-icon-wrapper bg-warning-light">
                            <Sun className="text-warning" size={24} />
                        </div>
                        <div className="factor-content">
                            <h4>İklim ve Hava Verisi</h4>
                            <p>Seçilen bölgenin tarihsel sıcaklık, yağış, rüzgar hızı ve toprak nemi verileri analiz edilir ve ürün tavsiyelerine yansıtılır.</p>
                        </div>
                    </div>

                    <div className="factor-item">
                        <div className="factor-icon-wrapper bg-success-light">
                            <Leaf className="text-success" size={24} />
                        </div>
                        <div className="factor-content">
                            <h4>Geçmiş Üretim Kayıtları</h4>
                            <p>Seçilen ilin son 5 sezonunun ürün verim ve üretim miktarları karşılaştırılır. Bölgede en başarılı ürünler öne çıkarılır.</p>
                        </div>
                    </div>

                    <div className="factor-item">
                        <div className="factor-icon-wrapper bg-info-light">
                            <Database className="text-info" size={24} />
                        </div>
                        <div className="factor-content">
                            <h4>Pazar Tahmini ve Arz-Talep Dengesi</h4>
                            <p>Makine öğrenmesinin tahmin ettiği ürün talebine karşın beklenen arzı analiz ederek hassas kârlılık tavsiyesi sunulur.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlanWizard;
