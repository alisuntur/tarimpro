import React, { useEffect, useState } from 'react';
import {
    PieChart,
    Pie,
    Cell,
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';
import { ChevronLeft, MapPin, Scaling, Leaf, ShieldCheck, BarChart3 } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import './AiRecommendations.css';

const numberFormatter = new Intl.NumberFormat('tr-TR');
const percentFormatter = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
const tonFormatter = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 });
const compactTonFormatter = new Intl.NumberFormat('tr-TR', { notation: 'compact', maximumFractionDigits: 1 });

const formatPercent = (value) => (value == null ? '-' : `%${percentFormatter.format(value)}`);
const formatCount = (value) => (value == null ? '-' : numberFormatter.format(value));
const formatTon = (value) => (value == null ? '-' : `${tonFormatter.format(value)} ton`);
const formatCompactTon = (value) => (value == null ? '-' : compactTonFormatter.format(value));

const formatMarketTon = (value) => {
    if (value == null) {
        return '-';
    }
    const absValue = Math.abs(Number(value));
    if (absValue >= 1_000_000) {
        return `${tonFormatter.format(Number(value) / 1_000_000)} milyon ton`;
    }
    if (absValue >= 1_000) {
        return `${tonFormatter.format(Number(value) / 1_000)} bin ton`;
    }
    return formatTon(value);
};

const formatSignedMarketTon = (value) => {
    if (value == null) {
        return '-';
    }
    const sign = value > 0 ? '+' : value < 0 ? '-' : '';
    return `${sign}${formatMarketTon(Math.abs(Number(value)))}`;
};

const formatReadableHorizon = (value) => (value || 'Seçilen tahmin süresi').replace('tahmin ufku', 'tahmin süresi');

const getReadableCalibrationLevel = (value) => {
    if (!value) {
        return '-';
    }

    return value
        .replace('Şehir + ürün + tahmin ufku', 'Seçilen şehir ve ürün kayıtları')
        .replace('Şehir örneklemi sınırlı, üst düzey seri ile kalibre edildi', 'Yerel kayıt az, daha geniş ürün kayıtlarıyla desteklendi')
        .replace('Ürün + tahmin ufku', 'Seçilen ürün kayıtları')
        .replace('Tahmin ufku geneli', 'Genel test kayıtları');
};

const getPlanScoreMessage = (score) => {
    if (score >= 70) {
        return 'güçlü bir başlangıç sinyali veriyor';
    }
    if (score >= 50) {
        return 'orta seviyede bir sinyal veriyor';
    }
    return 'temkinli ilerlenmesi gerektiğini gösteriyor';
};

const buildFarmerSummary = ({ crop, city, area, score, productionTon, forecastYear }) => {
    const yearText = forecastYear ? `${forecastYear} tahminine göre ` : '';
    const areaText = area ? `${numberFormatter.format(area)} dönüm ` : '';
    const productionText = productionTon != null
        ? `Bu alanda beklenen üretim yaklaşık ${tonFormatter.format(productionTon)} ton. `
        : '';

    return `${yearText}${city} için ${areaText}${crop} plan notu %${percentFormatter.format(score)}; bu not ${getPlanScoreMessage(score)}. Bu yüzde başarı ihtimali değil, yerel verim, model üretim tahmini, Türkiye piyasa sinyali ve iklim bilgisinin birlikte okunmasıdır. ${productionText}Kararı verirken alıcı bağlantısı, sulama durumu, maliyet ve güncel fiyatı ayrıca kontrol edin.`;
};

const buildConfidenceBasisText = (confidence) => {
    const horizonText = formatReadableHorizon(confidence.horizonLabel);
    if (confidence.localSampleSize) {
        return `${horizonText} için ${formatCount(confidence.localSampleSize)} benzer yerel kayıt incelendi. Yerel kayıt azsa sonuç daha geniş ürün kayıtlarıyla desteklenir.`;
    }
    if (confidence.referenceSampleSize) {
        return `${horizonText} için yerel kayıt sınırlı kaldı; ${formatCount(confidence.referenceSampleSize)} benzer ürün kaydı referans alındı.`;
    }
    return 'Bu gösterge, geçmiş test kayıtları sınırlı olduğu için genel model görünümüyle okunmalıdır.';
};

const buildMarketPlainSummary = (supplyDemand) => {
    const ratioText = supplyDemand.coverageRatioPct != null
        ? `Üretim tahmini, tüketim tahmininin yaklaşık ${formatPercent(supplyDemand.coverageRatioPct)} düzeyinde. `
        : '';
    const balance = Number(supplyDemand.balanceTon);
    const hasBalance = Number.isFinite(balance);
    const balanceText = hasBalance
        ? balance > 0
            ? `Tahmini üretim tüketimden ${formatMarketTon(balance)} daha yüksek görünüyor. `
            : balance < 0
                ? `Tahmini tüketim üretimden ${formatMarketTon(Math.abs(balance))} daha yüksek görünüyor. `
                : 'Tahmini üretim ve tüketim birbirine çok yakın görünüyor. '
        : '';

    if (!ratioText && !balanceText) {
        return 'Türkiye geneli üretim-tüketim sinyali için yeterli veri bulunamadı.';
    }

    return `${ratioText}${balanceText}Bu kesin fiyat yorumu değildir; stok, ithalat, alıcı kanalı ve hasat zamanı sonucu değiştirebilir.`;
};

const seriesLabels = {
    historicalProduction: 'Türkiye gerçekleşen üretim (ton)',
    predictedSupply: 'Türkiye tahmini üretim (ton)',
    predictedDemand: 'Türkiye tahmini tüketim (ton)',
};

const breakdownHelp = {
    yield: 'Seçilen ilde bu ürün geçmişte ne kadar verimli olmuş?',
    forecast: 'Model bu ürünün seçilen ildeki üretim görünümünü diğer ürünlerle karşılaştırır.',
    demand: 'Türkiye genelinde üretim tüketimi karşılıyor mu, yoksa fazla/açık sinyali mi var?',
    climate: 'Son iklim görünümü ve ürünün geçmişte ne kadar dengeli sonuç verdiği birlikte okunur.',
};

const emptyAnalysis = {
    score: 0,
    confidence: {
        score: 0,
        label: '',
        calibrationLevel: '',
        observedCoveragePct: null,
        avgAbsErrorPct: null,
        avgIntervalWidthPct: null,
    },
    recommendations: [],
    trendSeries: [],
    plan: null,
    focusCrop: '',
    selectedCrop: null,
    scoreBreakdown: [],
    summary: '',
    climateComment: '',
    marketComment: '',
    supplyDemand: null,
};

const shouldRefreshStalePlanAnalysis = (payload) => {
    const plannedArea = Number(payload?.plan?.plannedAreaDecare || 0);
    return Boolean(payload?.plan?.id && plannedArea > 0 && payload?.selectedCrop?.expectedProductionTon == null);
};

const AiRecommendations = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const planId = searchParams.get('planId');
    const analysisId = searchParams.get('analysisId');
    const legacyPlan = location.state || null;
    const [analysis, setAnalysis] = useState(emptyAnalysis);
    const [planItems, setPlanItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [emptyState, setEmptyState] = useState(false);
    const isSelectionMode = !analysisId && !planId && !legacyPlan;

    useEffect(() => {
        let active = true;

        const loadAnalysis = async () => {
            setLoading(true);
            setError('');
            setEmptyState(false);

            try {
                let payload;

                if (isSelectionMode) {
                    const overview = await apiFetch('/api/plan-analyses');
                    if (active) {
                        setPlanItems(overview.items || []);
                        setAnalysis(emptyAnalysis);
                    }
                    return;
                }

                if (analysisId) {
                    payload = await apiFetch(`/api/analyses/${analysisId}`);
                } else if (planId || legacyPlan) {
                    payload = await apiFetch('/api/ai/analyze-plan', {
                        method: 'POST',
                        body: planId
                            ? { planId }
                            : {
                                region: legacyPlan?.city || '',
                                size: Number(legacyPlan?.size || 100),
                                crop: legacyPlan?.crop || '',
                            },
                    });
                }

                if (shouldRefreshStalePlanAnalysis(payload)) {
                    payload = await apiFetch('/api/ai/analyze-plan', {
                        method: 'POST',
                        body: { planId: payload.plan.id },
                    });
                }

                if (active) {
                    setAnalysis({ ...emptyAnalysis, ...payload });
                }
            } catch (err) {
                if (active) {
                    setAnalysis(emptyAnalysis);
                    setError(err.message || 'AI analizi alınamadı.');
                    if (isSelectionMode) {
                        setEmptyState(true);
                    }
                }
            } finally {
                if (active) {
                    setLoading(false);
                }
            }
        };

        loadAnalysis();
        return () => {
            active = false;
        };
    }, [analysisId, isSelectionMode, legacyPlan, planId]);

    const score = analysis.score || 0;
    const confidence = analysis.confidence || { score: 0, label: '' };
    const chartData = analysis.trendSeries || [];
    const plan = analysis.plan || {};
    const focusCrop = analysis.focusCrop || plan.selectedCropName || 'Öne çıkan ürün';
    const selectedCrop = analysis.selectedCrop || {};
    const supplyDemand = analysis.supplyDemand || {};
    const scoreBreakdown = analysis.scoreBreakdown || [];
    const planCity = plan.city || legacyPlan?.city || 'Seçilen il';
    const planArea = Number(plan.plannedAreaDecare || legacyPlan?.size || 0);
    const localPlanScope = `${planCity}${planArea ? `, ${numberFormatter.format(planArea)} dönüm` : ''}`;
    const selectedCropName = selectedCrop.name || focusCrop;
    const farmerSummary = buildFarmerSummary({
        crop: selectedCropName,
        city: planCity,
        area: planArea,
        score,
        productionTon: selectedCrop.expectedProductionTon,
        forecastYear: selectedCrop.forecastYear || plan.seasonYear,
    });
    const confidenceBasisText = buildConfidenceBasisText(confidence);
    const confidenceRangeText = confidence.probabilityRange?.lower != null && confidence.probabilityRange?.upper != null
        ? `${formatPercent(confidence.probabilityRange.lower)} - ${formatPercent(confidence.probabilityRange.upper)}`
        : null;
    const marketPlainSummary = buildMarketPlainSummary(supplyDemand);
    const colors = ['var(--color-accent)', '#e0e0e0'];
    const shouldShowEmptyState = emptyState && !loading;
    const gaugeData = [
        { name: 'Score', value: shouldShowEmptyState ? 0 : score },
        { name: 'Rest', value: shouldShowEmptyState ? 100 : Math.max(0, 100 - score) },
    ];

    const handlePlanItemOpen = (item) => {
        if (item.analysisId) {
            navigate(`/ai-recommendations?analysisId=${item.analysisId}`);
            return;
        }
        navigate(`/ai-recommendations?planId=${item.planId}`);
    };

    if (isSelectionMode) {
        return (
            <div className="recommendations-container animate-fade-in">
                <div className="recommendations-header">
                    <div className="header-text-group" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                        <button className="back-btn" onClick={() => navigate(-1)}>
                            <ChevronLeft size={20} />
                            {'Geri Dön'}
                        </button>
                        <div className="header-text">
                            <h1>{'Yapay Zeka Önerileri'}</h1>
                            <p className="text-muted">{'Önceki üretim planlarından birini seçerek rapor ve önerileri açın'}</p>
                        </div>
                    </div>
                </div>

                <div className="analysis-picker card">
                    <div className="analysis-picker-header">
                        <div>
                            <h2>{'Önceki Planlar'}</h2>
                            <p>{'En yeni planlar üstte listelenir.'}</p>
                        </div>
                        <button type="button" className="primary-analysis-action" onClick={() => navigate('/plan-wizard')}>
                            {'Yeni Plan Oluştur'}
                        </button>
                    </div>

                    {loading ? (
                        <div className="analysis-picker-empty">
                            {'Planlar yükleniyor...'}
                        </div>
                    ) : planItems.length > 0 ? (
                        <div className="analysis-picker-list">
                            {planItems.map((item) => {
                                const locationLabel = [item.city, item.district].filter(Boolean).join(' / ') || 'Konum bilgisi yok';
                                return (
                                    <button
                                        type="button"
                                        key={item.id}
                                        className="analysis-picker-item"
                                        onClick={() => handlePlanItemOpen(item)}
                                    >
                                        <div className="analysis-picker-main">
                                            <div className="analysis-picker-title-row">
                                                <h3>{item.selectedCropName || 'Ürün seçilmemiş plan'}</h3>
                                                <span className={`analysis-status-pill ${item.hasAnalysis ? 'ready' : 'pending'}`}>
                                                    {item.hasAnalysis ? 'Analiz hazır' : 'Analiz bekliyor'}
                                                </span>
                                            </div>
                                            <div className="analysis-picker-meta">
                                                <span><MapPin size={15} />{locationLabel}</span>
                                                <span><Scaling size={15} />{numberFormatter.format(Number(item.plannedAreaDecare || 0))} dönüm</span>
                                                <span><Leaf size={15} />{item.fieldName || `${item.seasonYear || 'Sezon'} planı`}</span>
                                            </div>
                                            <p className="analysis-picker-date">
                                                {item.hasAnalysis
                                                    ? `Analiz tarihi: ${item.analyzedDate || '-'}`
                                                    : `Plan tarihi: ${item.createdDate || '-'}`}
                                            </p>
                                        </div>
                                        <div className="analysis-picker-score">
                                            {item.hasAnalysis ? (
                                                <>
                                                    <strong>%{Math.round(item.score || 0)}</strong>
                                                    <span>{item.confidenceLabel || 'Güven skoru'}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <strong>Yeni</strong>
                                                    <span>Analiz oluştur</span>
                                                </>
                                            )}
                                            <em>{item.actionLabel}</em>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="analysis-picker-empty">
                            <h3>{'Henüz üretim planı yok'}</h3>
                            <p>{'Yeni plan oluşturduğunuzda analizleri burada seçip açabilirsiniz.'}</p>
                        </div>
                    )}
                    {error && <p style={{ color: '#b91c1c', marginTop: '1rem' }}>{error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div className="recommendations-container animate-fade-in">
            <div className="recommendations-header">
                <div className="header-text-group" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <ChevronLeft size={20} />
                        {'Geri Dön'}
                    </button>
                    <div className="header-text">
                        <h1>{'Yapay Zeka Analiz Sonuçları'}</h1>
                        <p className="text-muted">{'Kayıtlı plan ve geçmiş veri üzerinden oluşturulan öneriler'}</p>
                    </div>
                </div>
            </div>

            {!loading && !shouldShowEmptyState && (
                <div className="plan-context-chips">
                    <div className="context-chip">
                        <MapPin size={16} />
                        <span>{plan.city || legacyPlan?.city || 'Şehir bilgisi yok'}</span>
                    </div>
                    <div className="context-chip">
                        <Scaling size={16} />
                        <span>{numberFormatter.format(Number(plan.plannedAreaDecare || legacyPlan?.size || 0))} {'dönüm'}</span>
                    </div>
                    <div className="context-chip">
                        <Leaf size={16} />
                        <span>{plan.selectedCropName || focusCrop}</span>
                    </div>
                    {plan.fieldName && (
                        <div className="context-chip">
                            <span>{plan.fieldName}</span>
                        </div>
                    )}
                    {analysis.analyzedAt && (
                        <div className="context-chip">
                            <span>{new Date(analysis.analyzedAt).toLocaleString('tr-TR')}</span>
                        </div>
                    )}
                </div>
            )}

            <div className="gauge-section card">
                <div className="gauge-chart-container">
                    <ResponsiveContainer width="100%" height={260}>
                        <PieChart>
                            <Pie
                                data={gaugeData}
                                cx="50%"
                                cy="70%"
                                startAngle={180}
                                endAngle={0}
                                innerRadius={80}
                                outerRadius={120}
                                dataKey="value"
                                stroke="none"
                            >
                                {gaugeData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="gauge-overlay-text">
                        {loading ? (
                            <>
                                <h2>{'...'}</h2>
                                <p>{'Analiz yükleniyor'}</p>
                            </>
                        ) : shouldShowEmptyState ? (
                            <>
                                <h2>{'Henüz'}</h2>
                                <p>{'Analiz kaydı yok'}</p>
                            </>
                        ) : (
                            <>
                                <h2>%{score}</h2>
                                <p>{'Plan Notu'}</p>
                            </>
                        )}
                    </div>
                </div>
                <div className="gauge-info">
                    <div className="analysis-summary-header">
                        <h3>{'Seçilen Ürün Değerlendirmesi'}</h3>
                        <div className="confidence-pill">
                            <ShieldCheck size={16} />
                            <span>{loading || shouldShowEmptyState ? 'Analiz Durumu' : 'Model Güven Göstergesi'}</span>
                            <strong>{loading ? 'Yükleniyor' : shouldShowEmptyState ? 'Bekleniyor' : formatPercent(confidence.score || 0)}</strong>
                        </div>
                    </div>
                    {loading ? (
                        <p>{'Analiz yükleniyor...'}</p>
                    ) : shouldShowEmptyState ? (
                        <>
                            <p>{'Bu rapor için kayıtlı analiz bulunamadı. Önce yeni bir üretim planı oluşturup analizi başlatmanız gerekiyor.'}</p>
                            <p className="text-muted">{'Plan oluşturduktan sonra seçtiğiniz il, dönüm ve ürün için geçmiş üretim ile model projeksiyonlarına dayalı değerlendirmeyi burada görebileceksiniz.'}</p>
                            <div className="empty-analysis-actions">
                                <button type="button" className="primary-analysis-action" onClick={() => navigate('/plan-wizard')}>
                                    {'Yeni Plan Oluştur'}
                                </button>
                                <button type="button" className="secondary-analysis-action" onClick={() => navigate('/profile')}>
                                    {'Geçmiş Raporlara Git'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <p>{farmerSummary}</p>
                            <p className="text-muted">{analysis.climateComment}</p>
                            <p className="text-muted">{marketPlainSummary}</p>
                        </>
                    )}
                    {error && <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</p>}
                </div>
            </div>

            {!loading && !shouldShowEmptyState && (
                <>
                    <div className="analysis-insight-grid">
                        <div className="analysis-insight-card card local-plan-card">
                            <div className="insight-title-row">
                                <Leaf size={18} />
                                <h3>{'Yerel Plan Çıktısı'}</h3>
                            </div>
                            <p className="card-scope-note">{`${localPlanScope} için hesaplanır. Buradaki tonaj, Türkiye geneli piyasa tonajı değil, seçtiğiniz alanın tahmini üretimidir.`}</p>
                            <p className="insight-metric">{'Ürün'}: <strong>{selectedCrop.name || focusCrop}</strong></p>
                            <p className="insight-metric">{'Beklenen Verim'}: <strong>{selectedCrop.expectedYieldKgDecare != null ? `${numberFormatter.format(selectedCrop.expectedYieldKgDecare)} kg/dekar` : 'Veri yok'}</strong></p>
                            <p className="insight-metric">{'Plan Bazlı Beklenen Üretim'}: <strong>{selectedCrop.expectedProductionTon != null ? `${numberFormatter.format(selectedCrop.expectedProductionTon)} ton` : 'Veri yok'}</strong></p>
                            <p className="insight-metric">{'Tahmin Yılı'}: <strong>{selectedCrop.forecastYear || '-'}</strong></p>
                            <p className="insight-metric">{'Yerel Verim Notu'}: <strong>{formatPercent(selectedCrop.yieldScore)}</strong></p>
                            <p className="insight-metric">{`${planCity}/Türkiye Verim Endeksi`}: <strong>{formatPercent(selectedCrop.yieldIndexPct)}</strong></p>
                            <p className="insight-metric">{'İller Arası Verim Konumu'}: <strong>{formatPercent(selectedCrop.yieldPercentile)}</strong></p>
                        </div>

                        <div className="analysis-insight-card card">
                            <div className="insight-title-row">
                                <ShieldCheck size={18} />
                                <h3>{'Model Güveni Ne Anlatıyor?'}</h3>
                            </div>
                            <p className="card-scope-note">{'Bu yüzde, plan notundan farklıdır. Geçmiş testlerde modelin gerçek üretimi kendi beklenen alt-üst aralığı içinde yakalama düzeyini anlatır; gelir, fiyat veya kesin hasat sözü değildir.'}</p>
                            <div className="confidence-detail-list">
                                <div className="confidence-detail-row">
                                    <span>{'Tahmin Aralığında Kalma'}</span>
                                    <strong>{formatPercent(confidence.score)}</strong>
                                </div>
                                <div className="confidence-detail-row">
                                    <span>{'Yorum'}</span>
                                    <strong>{confidence.label || '-'}</strong>
                                </div>
                                <div className="confidence-detail-row">
                                    <span>{'Benzer Yerel Kayıt'}</span>
                                    <strong>{formatCount(confidence.localSampleSize)}</strong>
                                </div>
                                <div className="confidence-detail-row">
                                    <span>{'Karşılaştırma Verisi'}</span>
                                    <strong>{confidence.referenceSampleSize ? `${formatCount(confidence.referenceSampleSize)} kayıt` : '-'}</strong>
                                </div>
                                {confidenceRangeText && (
                                    <div className="confidence-detail-row">
                                        <span>{'Beklenen Güven Aralığı'}</span>
                                        <strong>{confidenceRangeText}</strong>
                                    </div>
                                )}
                            </div>
                            <p className="text-muted confidence-note">{confidenceBasisText}</p>
                            <details className="technical-confidence-details">
                                <summary>{'Teknik ölçümleri göster'}</summary>
                                <div className="confidence-detail-list">
                                    <div className="confidence-detail-row">
                                        <span>{'Veri Kaynağı'}</span>
                                        <strong>{getReadableCalibrationLevel(confidence.calibrationLevel)}</strong>
                                    </div>
                                    <div className="confidence-detail-row">
                                        <span>{'Referans Kırılımı'}</span>
                                        <strong>{confidence.referenceLevel ? getReadableCalibrationLevel(confidence.referenceLevel) : '-'}</strong>
                                    </div>
                                    <div className="confidence-detail-row">
                                        <span>{'Gözlenen Aralık Yakalama'}</span>
                                        <strong>{formatPercent(confidence.observedCoveragePct)}</strong>
                                    </div>
                                    <div className="confidence-detail-row">
                                        <span>{'Ortalama Hata'}</span>
                                        <strong>{formatPercent(confidence.avgAbsErrorPct)}</strong>
                                    </div>
                                    <div className="confidence-detail-row">
                                        <span>{'Ortalama Tahmin Aralığı'}</span>
                                        <strong>{formatPercent(confidence.avgIntervalWidthPct)}</strong>
                                    </div>
                                </div>
                            </details>
                        </div>

                        <div className="analysis-insight-card card market-scope-card">
                            <div className="insight-title-row">
                                <Scaling size={18} />
                                <h3>{'Türkiye Geneli Piyasa Sinyali'}</h3>
                            </div>
                            <p className="card-scope-note">{`Bu kart ${localPlanScope} için beklenen hasat hesabı değildir; ürünün Türkiye genelinde üretim-tüketim dengesini anlatır.`}</p>
                            <p className="insight-metric">{'Durum'}: <strong>{supplyDemand.status || '-'}</strong></p>
                            <p className="insight-metric">{'Üretim / Tüketim Oranı'}: <strong>{formatPercent(supplyDemand.coverageRatioPct)}</strong></p>
                            <p className="insight-metric">{'Türkiye Üretim Tahmini'}: <strong>{formatMarketTon(supplyDemand.predictedSupplyTon)}</strong></p>
                            <p className="insight-metric">{'Türkiye Tüketim Tahmini'}: <strong>{formatMarketTon(supplyDemand.predictedDemandTon)}</strong></p>
                            <p className="insight-metric">{'Tahmini Fazla / Açık'}: <strong>{formatSignedMarketTon(supplyDemand.balanceTon)}</strong></p>
                            <p className="text-muted confidence-note">{marketPlainSummary}</p>
                        </div>

                        <div className="analysis-insight-card card">
                            <div className="insight-title-row">
                                <BarChart3 size={18} />
                                <h3>{'Plan Notu Nelerden Oluşur?'}</h3>
                            </div>
                            <p className="card-scope-note">{'Plan notu; yerel verim, model üretim tahmini, Türkiye piyasa sinyali ve iklim bilgisinin birlikte hesaplanmış özetidir. Tek başına kâr veya hasat garantisi değildir.'}</p>
                            <div className="breakdown-list">
                                {scoreBreakdown.map((item) => (
                                    <div key={item.key} className="breakdown-row detailed-breakdown-row">
                                        <div>
                                            <span>{item.label}</span>
                                            <small>{breakdownHelp[item.key] || 'Bu bölüm plan notunun bir parçasıdır.'}</small>
                                            {item.weight != null && <em>{`Etki payı: ${formatPercent(item.weight)}`}</em>}
                                        </div>
                                        <strong>{formatPercent(item.value)}</strong>
                                    </div>
                                ))}
                                {scoreBreakdown.length === 0 && <p className="text-muted">{'Plan notu detayı bulunamadı.'}</p>}
                            </div>
                        </div>
                    </div>

                    <div className="recommendations-content">
                        <div className="recommendations-left">
                            <h2 className="section-title">{'Alternatif Ürün Önerileri'}</h2>
                            <div className="recommendation-cards">
                                {loading ? (
                                    <div className="suggestion-card card"><p>{'Analiz yükleniyor...'}</p></div>
                                ) : analysis.recommendations.length > 0 ? (
                                    analysis.recommendations.map((item) => (
                                        <div key={item.id} className="suggestion-card card">
                                            <div className="suggestion-header">
                                                <div className="suggestion-title">
                                                    <div className="title-row">
                                                        <h3>{item.crop}</h3>
                                                        <span className="expected-return">{item.expectedReturn}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="suggestion-meta-grid">
                                                <span>{'Plan notu'}: <strong>%{Math.round(item.score || 0)}</strong></span>
                                                <span>{'Beklenen verim'}: <strong>{item.expectedYieldKgDecare != null ? `${numberFormatter.format(item.expectedYieldKgDecare)} kg/dekar` : 'Veri yok'}</strong></span>
                                                <span>{'Plan bazlı üretim'}: <strong>{item.estimatedProductionTon != null ? `${numberFormatter.format(item.estimatedProductionTon)} ton` : 'Veri yok'}</strong></span>
                                            </div>
                                            <div className="suggestion-body">
                                                <p className="reason-label">{'Neden bu ürün?'}</p>
                                                <p>{item.reason}</p>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="suggestion-card card"><p>{'Gösterilecek öneri bulunamadı.'}</p></div>
                                )}
                            </div>
                        </div>

                        <div className="recommendations-right">
                            <h2 className="section-title">{'Piyasa Grafiği (Türkiye Geneli)'}</h2>
                            <p className="section-subtitle">{`${focusCrop} için ülke geneli toplam üretim ve tüketim serisi; ${localPlanScope} hasat tahmini değildir.`}</p>
                            <div className="chart-card card">
                                {chartData.length > 0 ? (
                                    <>
                                        <ResponsiveContainer width="100%" height={400}>
                                            <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(203, 213, 225, 0.4)" />
                                                <XAxis dataKey="year" axisLine tickLine={false} tick={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }} dy={10} />
                                                <YAxis
                                                    axisLine={false}
                                                    tickLine={false}
                                                    tick={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }}
                                                    dx={-10}
                                                    tickCount={5}
                                                    tickFormatter={formatCompactTon}
                                                />
                                                <RechartsTooltip
                                                    cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                                                    contentStyle={{
                                                        borderRadius: '16px',
                                                        border: '1px solid rgba(226, 232, 240, 0.8)',
                                                        boxShadow: 'var(--shadow-xl)',
                                                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                                        backdropFilter: 'blur(8px)',
                                                        padding: '16px',
                                                    }}
                                                    formatter={(value, name) => [formatMarketTon(value), seriesLabels[name] || name]}
                                                />
                                                <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: 600, fontSize: '14px' }} iconType="circle" />
                                                <Bar name={seriesLabels.historicalProduction} dataKey="historicalProduction" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={28} />
                                                <Line type="monotone" name={seriesLabels.predictedSupply} dataKey="predictedSupply" stroke="#f59e0b" strokeWidth={4} dot={{ r: 5, fill: 'white', stroke: '#f59e0b', strokeWidth: 2 }} activeDot={{ r: 8, fill: '#f59e0b', stroke: 'white', strokeWidth: 2 }} />
                                                <Line type="monotone" name={seriesLabels.predictedDemand} dataKey="predictedDemand" stroke="#1d4ed8" strokeWidth={3} strokeDasharray="7 5" dot={{ r: 4, fill: 'white', stroke: '#1d4ed8', strokeWidth: 2 }} activeDot={{ r: 7, fill: '#1d4ed8', stroke: 'white', strokeWidth: 2 }} />
                                            </ComposedChart>
                                        </ResponsiveContainer>
                                        <p className="text-muted confidence-note chart-note">{'Grafikteki milyon ton değerleri Türkiye geneli toplam piyasa ölçeğidir. Yerel plan hasat hesabı üstteki Yerel Plan Çıktısı kartında gösterilir.'}</p>
                                    </>
                                ) : (
                                    <div className="empty-chart-state">
                                        {'Bu ürün için yeterli üretim ve tüketim serisi bulunamadı.'}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default AiRecommendations;
