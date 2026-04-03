import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MapPin,
    Scaling,
    Sprout,
    Sparkles,
    Leaf,
    Sun,
    Droplet,
    Droplets,
    Apple,
    Grape,
    Nut,
    Trees,
    Map
} from 'lucide-react';
import './PlanWizard.css';

// Alphabetically sorted flat list of featured cities
const citiesList = [
    'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Aksaray', 'Amasya', 'Ankara',
    'Antalya', 'Aydın', 'Balıkesir', 'Batman', 'Burdur', 'Bursa', 'Çanakkale',
    'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum',
    'Eskişehir', 'Gaziantep', 'Giresun', 'Hatay', 'Isparta', 'İstanbul', 'İzmir',
    'Kahramanmaraş', 'Kars', 'Kayseri', 'Kırıkkale', 'Kocaeli', 'Konya', 'Kütahya',
    'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla', 'Nevşehir', 'Ordu',
    'Osmaniye', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sivas', 'Şanlıurfa',
    'Tekirdağ', 'Tokat', 'Trabzon', 'Uşak', 'Van', 'Zonguldak'
];

const PlanWizard = () => {
    const [city, setCity] = useState('');
    const [size, setSize] = useState('');
    const [selectedCrop, setSelectedCrop] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const navigate = useNavigate();

    const crops = [
        { id: 'wheat', name: 'Buğday', icon: <Leaf size={28} /> },
        { id: 'sunflower', name: 'Ayçiçeği', icon: <Sun size={28} /> },
        { id: 'cotton', name: 'Pamuk', icon: <Droplet size={28} /> },
        { id: 'corn', name: 'Mısır', icon: <Sprout size={28} /> },
        { id: 'sugar_beet', name: 'Şeker Pancarı', icon: <Leaf size={28} /> },
        { id: 'olive', name: 'Zeytin', icon: <Trees size={28} /> },
        { id: 'hazelnut', name: 'Fındık', icon: <Nut size={28} /> },
        { id: 'grape', name: 'Üzüm', icon: <Grape size={28} /> },
        { id: 'apple', name: 'Elma', icon: <Apple size={28} /> },
    ];

    const handleAnalyze = () => {
        if (!city || !size) return;

        setIsAnalyzing(true);

        // Simulate AI processing delay
        setTimeout(() => {
            setIsAnalyzing(false);
            navigate('/ai-recommendations', {
                state: { city, size, crop: selectedCrop }
            });
        }, 2000);
    };

    const isFormValid = city !== '' && size !== '';

    return (
        <div className="wizard-container animate-fade-in">
            <div className="wizard-header-text">
                <h1>Yeni Üretim Planı Oluştur</h1>
                <p className="text-muted">Tarlanızın verileriyle en doğru kararı verin</p>
            </div>

            <div className="wizard-card card">
                {/* Step 1: Location */}
                <div className="wizard-step">
                    <div className="step-header">
                        <div className="step-number">1</div>
                        <h3>Tarlanız Hangi Şehirde?</h3>
                    </div>
                    <div className="step-content">
                        <div className="location-inputs-wrapper">
                            <div className="input-with-icon" style={{ marginBottom: '1rem' }}>
                                <MapPin className="input-icon" size={20} />
                                <select
                                    className="wizard-input select-field"
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                >
                                    <option value="" disabled>Türkiye'den Bir Şehir Seçiniz...</option>
                                    {citiesList.map((cityName) => (
                                        <option key={cityName} value={cityName}>{cityName}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Step 2: Size */}
                <div className="wizard-step">
                    <div className="step-header">
                        <div className="step-number">2</div>
                        <h3>Tarla Büyüklüğünüz</h3>
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
                    </div>
                </div>

                {/* Step 3: Crop Selection */}
                <div className="wizard-step">
                    <div className="step-header">
                        <div className="step-number">3</div>
                        <h3>Düşündüğünüz Ürün (Opsiyonel)</h3>
                    </div>
                    <div className="step-content">
                        <div className="crop-selector">
                            {crops.map((crop) => (
                                <button
                                    key={crop.id}
                                    className={`crop-btn ${selectedCrop === crop.id ? 'selected' : ''}`}
                                    onClick={() => setSelectedCrop(selectedCrop === crop.id ? '' : crop.id)}
                                >
                                    <div className="crop-icon-wrapper">
                                        {crop.icon}
                                    </div>
                                    <span className="crop-name">{crop.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Action Button */}
                <div className="wizard-action">
                    <button
                        className={`btn-ai-analyze ${isFormValid ? 'ready' : ''} ${isAnalyzing ? 'analyzing' : ''}`}
                        onClick={handleAnalyze}
                        disabled={!isFormValid || isAnalyzing}
                    >
                        {isAnalyzing ? (
                            <>
                                <div className="spinner-small"></div>
                                Yapay Zeka Analiz Ediyor...
                            </>
                        ) : (
                            <>
                                <Sparkles size={24} className="sparkle-icon" />
                                Yapay Zeka ile Analiz Et
                            </>
                        )}
                    </button>
                    {!isFormValid && (
                        <p className="validation-text">Lütfen analiz için şehir ve büyüklük bilgilerini doldurun.</p>
                    )}
                </div>
            </div>

            {/* Analysis Factors Section */}
            <div className="analysis-factors-card card animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <div className="factors-header">
                    <Sparkles className="factors-icon" size={28} />
                    <h2>Neye Göre Analiz Yapıyoruz?</h2>
                </div>
                <p className="factors-description">
                    Yapay zeka modelimiz, tarımsal veriminizi maksimize etmek için aşağıdaki faktörleri dikkate alarak size en uygun üretim planını sunar:
                </p>
                <div className="factors-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))' }}>
                    <div className="factor-item">
                        <div className="factor-icon-wrapper bg-warning-light">
                            <Sun className="text-warning" size={24} />
                        </div>
                        <div className="factor-content">
                            <h4>İklim ve Hava Durumu</h4>
                            <p>Bölgenin yıllık yağış miktarı, sıcaklık ortalamaları ve don riski gibi meteorolojik veriler analiz edilir.</p>
                        </div>
                    </div>

                    <div className="factor-item">
                        <div className="factor-icon-wrapper bg-primary-light-custom">
                            <Leaf className="text-primary-dark" size={24} />
                        </div>
                        <div className="factor-content">
                            <h4>Pazar ve Verim Oranları</h4>
                            <p>Geçmiş yılların hasat verileri, bölgesel hastalık riskleri ve pazar talepleri göz önünde bulundurulur.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PlanWizard;
