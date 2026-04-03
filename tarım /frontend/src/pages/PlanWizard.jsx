import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    MapPin,
    Scaling,
    Sprout,
    Sparkles,
    Leaf,
    Sun,
    Droplet
} from 'lucide-react';
import './PlanWizard.css';

const PlanWizard = () => {
    const [region, setRegion] = useState('');
    const [size, setSize] = useState('');
    const [selectedCrop, setSelectedCrop] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const navigate = useNavigate();

    const crops = [
        { id: 'wheat', name: 'Buğday', icon: <Leaf size={28} /> },
        { id: 'sunflower', name: 'Ayçiçeği', icon: <Sun size={28} /> },
        { id: 'cotton', name: 'Pamuk', icon: <Droplet size={28} /> },
        { id: 'corn', name: 'Mısır', icon: <Sprout size={28} /> },
    ];

    const handleAnalyze = () => {
        if (!region || !size || !selectedCrop) return;

        setIsAnalyzing(true);

        // Simulate AI processing delay
        setTimeout(() => {
            setIsAnalyzing(false);
            navigate('/ai-recommendations', {
                state: { region, size, crop: selectedCrop }
            });
        }, 2000);
    };

    const isFormValid = region !== '' && size !== '' && selectedCrop !== '';

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
                        <h3>Tarlanız Hangi Bölgede?</h3>
                    </div>
                    <div className="step-content">
                        <div className="input-with-icon">
                            <MapPin className="input-icon" size={20} />
                            <select
                                className="wizard-input select-field"
                                value={region}
                                onChange={(e) => setRegion(e.target.value)}
                            >
                                <option value="" disabled>İl veya Bölge Seçiniz...</option>
                                <option value="marmara">Marmara Bölgesi (Balıkesir, Bursa...)</option>
                                <option value="ic_anadolu">İç Anadolu Bölgesi (Konya, Ankara...)</option>
                                <option value="ege">Ege Bölgesi (İzmir, Manisa...)</option>
                                <option value="akdeniz">Akdeniz Bölgesi (Adana, Mersin...)</option>
                                <option value="guneydogu">Güneydoğu Anadolu (Şanlıurfa, Gaziantep...)</option>
                            </select>
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
                                    onClick={() => setSelectedCrop(crop.id)}
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
                        <p className="validation-text">Lütfen analiz için tüm alanları doldurun.</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default PlanWizard;
