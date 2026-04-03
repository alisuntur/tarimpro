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
import { ChevronLeft, MapPin, Scaling, Leaf } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '../lib/api';
import './AiRecommendations.css';

const numberFormatter = new Intl.NumberFormat('tr-TR');

const AiRecommendations = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const planId = searchParams.get('planId');
    const legacyPlan = location.state || null;
    const [analysis, setAnalysis] = useState({ score: 0, recommendations: [], trendSeries: [], plan: null, focusCrop: '' });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;

        const loadAnalysis = async () => {
            setLoading(true);
            setError('');

            try {
                if (!planId && !legacyPlan) {
                    throw new Error('Önce analiz edilecek bir plan oluşturmanız gerekiyor.');
                }

                const payload = await apiFetch('/api/ai/analyze-plan', {
                    method: 'POST',
                    body: planId
                        ? { planId }
                        : {
                            region: legacyPlan?.city || 'Manisa',
                            size: Number(legacyPlan?.size || 100),
                            crop: legacyPlan?.crop || '',
                        },
                });

                if (active) {
                    setAnalysis(payload);
                }
            } catch (err) {
                if (active) {
                    setError(err.message || 'AI analizi alınamadı.');
                }
            } finally {
                if (active) setLoading(false);
            }
        };

        loadAnalysis();
        return () => {
            active = false;
        };
    }, [legacyPlan, planId]);

    const score = analysis.score || 0;
    const gaugeData = [
        { name: 'Score', value: score },
        { name: 'Rest', value: 100 - score },
    ];
    const chartData = analysis.trendSeries || [];
    const plan = analysis.plan || {};
    const focusCrop = analysis.focusCrop || plan.selectedCropName || 'Öne çıkan ürün';
    const colors = ['var(--color-accent)', '#e0e0e0'];

    return (
        <div className="recommendations-container animate-fade-in">
            <div className="recommendations-header">
                <div className="header-text-group" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flex: 1 }}>
                    <button className="back-btn" onClick={() => navigate(-1)}>
                        <ChevronLeft size={20} />
                        Geri Dön
                    </button>
                    <div className="header-text">
                        <h1>Yapay Zeka Analiz Sonuçları</h1>
                        <p className="text-muted">Kayıtlı plan üzerinden üretilen veri tabanlı öneriler</p>
                    </div>
                </div>
            </div>

            <div className="plan-context-chips">
                <div className="context-chip">
                    <MapPin size={16} />
                    <span>{plan.city || legacyPlan?.city || 'Şehir bilgisi yok'}</span>
                </div>
                <div className="context-chip">
                    <Scaling size={16} />
                    <span>{numberFormatter.format(Number(plan.plannedAreaDecare || legacyPlan?.size || 0))} dönüm</span>
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
            </div>

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
                        <h2>%{score}</h2>
                        <p>Plan Uygunluk Skoru</p>
                    </div>
                </div>
                <div className="gauge-info">
                    <h3>Seçilen Planın Genel Değerlendirmesi</h3>
                    <p>
                        {plan.city || legacyPlan?.city || 'Seçili şehir'} için kaydedilen plan, veritabanındaki üretim tahminleriyle
                        karşılaştırıldı. <strong>{focusCrop}</strong> planın odağındaki ürün olarak kullanıldı ve aşağıdaki alternatifler
                        aynı il bağlamında sıralandı.
                    </p>
                    {error && <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</p>}
                </div>
            </div>

            <div className="recommendations-content">
                <div className="recommendations-left">
                    <h2 className="section-title">Alternatif Ürün Önerileri</h2>
                    <div className="recommendation-cards">
                        {loading ? (
                            <div className="suggestion-card card"><p>Analiz yükleniyor...</p></div>
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
                                    <div className="suggestion-body">
                                        <p className="reason-label">Neden bu ürün?</p>
                                        <p>{item.reason}</p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="suggestion-card card"><p>Gösterilecek öneri bulunamadı.</p></div>
                        )}
                    </div>
                </div>

                <div className="recommendations-right">
                    <h2 className="section-title">Geçmiş Üretim ve Gelecek Projeksiyonu</h2>
                    <div className="chart-card card">
                        {chartData.length > 0 ? (
                            <ResponsiveContainer width="100%" height={400}>
                                <ComposedChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(203, 213, 225, 0.4)" />
                                    <XAxis dataKey="year" axisLine tickLine={false} tick={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine tickLine={false} tick={{ fontSize: 13, fill: '#64748b', fontWeight: 600 }} dx={-10} tickCount={5} />
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
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '20px', fontWeight: '600', fontSize: '14px' }} iconType="circle" />
                                    <Bar name="Geçmiş Üretim (Ton)" dataKey="historicalProduction" fill="var(--color-primary)" radius={[4, 4, 0, 0]} barSize={32} />
                                    <Line type="monotone" name="Model Projeksiyonu (Ton)" dataKey="predictedProduction" stroke="#f59e0b" strokeWidth={4} dot={{ r: 5, fill: 'white', stroke: '#f59e0b', strokeWidth: 2 }} activeDot={{ r: 8, fill: '#f59e0b', stroke: 'white', strokeWidth: 2 }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-chart-state">
                                Bu plan için yeterli üretim trendi bulunamadı.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AiRecommendations;
