import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  Database,
  LineChart,
  LogOut,
  Send,
  Shield,
  TrendingUp,
  Users,
  X,
  Info,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart as RechartsLineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { apiFetch } from '../lib/api';
import { useAdminAuth } from '../context/AdminAuthContext';
import './Admin.css';

const numberFormatter = new Intl.NumberFormat('tr-TR');
const percentFormatter = new Intl.NumberFormat('tr-TR', {
  style: 'percent',
  maximumFractionDigits: 1,
});
const dateTimeFormatter = new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const monthFormatter = new Intl.DateTimeFormat('tr-TR', {
  month: 'short',
  year: 'numeric',
});

const formatNumber = (value) => numberFormatter.format(Number(value || 0));

const formatPercent = (value) => percentFormatter.format(Number(value || 0) / 100);

const formatDateTime = (value) => {
  if (!value) {
    return 'Bilgi yok';
  }

  const parsedDate = new Date(value);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return dateTimeFormatter.format(parsedDate);
};

const formatMonth = (value) => {
  if (!value) {
    return '';
  }

  const parsedDate = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return String(value);
  }

  return monthFormatter.format(parsedDate);
};

const truncateLabel = (value, max = 14) => {
  const text = String(value || '');
  if (text.length <= max) {
    return text;
  }
  return `${text.slice(0, max - 1)}…`;
};

const formatLocation = (city, district) => {
  if (city && district) return `${city} / ${district}`;
  return city || district || 'Bilgi yok';
};

const ROLE_LABELS = {
  farmer: 'Çiftçi',
  admin: 'Yönetici',
  analyst: 'Analist',
  viewer: 'İzleyici',
  guest: 'Misafir',
  user: 'Kullanıcı',
};

const formatRoleLabel = (role) => {
  const key = String(role || '').trim().toLowerCase();
  return ROLE_LABELS[key] || (role ? role : 'Kullanıcı');
};

const ALERT_TYPE_OPTIONS = [
  {
    value: 'info',
    label: 'Bilgi',
    description: 'Genel bilgilendirme ve duyuru için.',
    badgeClass: 'info',
  },
  {
    value: 'warning',
    label: 'Uyarı',
    description: 'Dikkat edilmesi gereken durumlar için.',
    badgeClass: 'warning',
  },
  {
    value: 'danger',
    label: 'Kritik',
    description: 'Acil ve önemli bildirimler için.',
    badgeClass: 'danger',
  },
];

const METRIC_DEFINITIONS = [
  {
    key: 'total_users',
    valueKey: 'total_users',
    label: 'Toplam kullanıcı',
    shortNote: 'Kayıtlı tüm hesap sayısı.',
    detail: 'Sisteme kayıt olmuş tüm hesapların toplamını gösterir.',
    formula: 'app.users tablosundaki tüm satırlar',
    source: 'app.users',
    interpretation: 'Bu sayı platformun büyüklüğünü ve erişim alanını gösterir.',
  },
  {
    key: 'active_users',
    valueKey: 'active_users',
    label: 'Aktif kullanıcı',
    shortNote: 'Giriş yapabilen ve durumu açık hesaplar.',
    detail: 'Şu anda aktif durumda olan, sistemden yararlanabilen kullanıcı sayısıdır.',
    formula: 'is_active = true olan kullanıcı sayısı',
    source: 'app.users',
    interpretation: 'Aktif kullanım düzeyini ve canlı hesap sağlığını gösterir.',
  },
  {
    key: 'inactive_users',
    valueKey: 'inactive_users',
    label: 'Pasif kullanıcı',
    shortNote: 'Erişimi kapatılmış hesaplar.',
    detail: 'Girişe kapatılmış veya devre dışı bırakılmış kullanıcıları gösterir.',
    formula: 'is_active = false olan kullanıcı sayısı',
    source: 'app.users',
    interpretation: 'Yetkisiz ya da kullanım dışı hesapları takip etmek için kullanılır.',
  },
  {
    key: 'badge_users',
    valueKey: 'badge_users',
    label: 'Rozetli kullanıcı',
    shortNote: 'Onaylı veya öne çıkarılmış hesaplar.',
    detail: 'Sistem içinde rozet verilen, doğrulanmış ya da öncelikli görülen hesapları ifade eder.',
    formula: 'active_badge = true olan kullanıcı sayısı',
    source: 'app.users',
    interpretation: 'Güven düzeyi yüksek hesapların sayısını verir.',
  },
  {
    key: 'new_users_30d',
    valueKey: 'new_users_30d',
    label: 'Son 30 günde yeni kullanıcı',
    shortNote: 'Kayıt akışının güncel hızı.',
    detail: 'Son 30 gün içinde sisteme katılan yeni hesapları gösterir.',
    formula: 'created_at >= now() - interval 30 days',
    source: 'app.users',
    interpretation: 'Kayıt büyümesinin hızını ve kampanya etkisini okumaya yardım eder.',
  },
  {
    key: 'total_fields',
    valueKey: 'total_fields',
    label: 'Toplam tarla',
    shortNote: 'Kullanıcıların sisteme eklediği tarla sayısı.',
    detail: 'Kayıtlı parsel ve alanların toplamını gösterir.',
    formula: 'app.fields tablosundaki tüm satırlar',
    source: 'app.fields',
    interpretation: 'Kullanıcıların tarım verisini ne kadar aktif kullandığını gösterir.',
  },
  {
    key: 'total_plans',
    valueKey: 'total_plans',
    label: 'Toplam plan',
    shortNote: 'Oluşturulan üretim planlarının sayısı.',
    detail: 'Sistemde kayıtlı üretim planlarının toplamını gösterir.',
    formula: 'app.production_plans tablosundaki tüm satırlar',
    source: 'app.production_plans',
    interpretation: 'Planlama kullanım yoğunluğunu ve sistem benimsenmesini gösterir.',
  },
  {
    key: 'total_analyses',
    valueKey: 'total_analyses',
    label: 'Toplam analiz',
    shortNote: 'Yapay zekâ ile üretilen analiz kayıtları.',
    detail: 'Sistemde kaç adet analiz üretildiğini gösterir.',
    formula: 'app.ai_analyses tablosundaki tüm satırlar',
    source: 'app.ai_analyses',
    interpretation: 'Karar destek motorunun toplam kullanımını anlatır.',
  },
  {
    key: 'users_with_analyses',
    valueKey: 'users_with_analyses',
    label: 'Analiz yapan kullanıcı',
    shortNote: 'En az bir analiz oluşturan hesaplar.',
    detail: 'En az bir kez analiz yapan farklı kullanıcı sayısıdır.',
    formula: 'Analizi olan farklı user_id sayısı',
    source: 'app.ai_analyses + app.production_plans',
    interpretation: 'Aktif karar desteği kullanan kullanıcı tabanını gösterir.',
  },
  {
    key: 'total_recommendations',
    valueKey: 'total_recommendations',
    label: 'Toplam öneri',
    shortNote: 'Analizlerden çıkan öneri satırları.',
    detail: 'Her analiz içinde yer alan ürün öneri kayıtlarının toplamını gösterir.',
    formula: 'app.ai_recommendations tablosundaki tüm satırlar',
    source: 'app.ai_recommendations',
    interpretation: 'Analizlerin kaç öneri ürettiğini ve içerik hacmini gösterir.',
  },
  {
    key: 'total_alerts',
    valueKey: 'total_alerts',
    label: 'Toplam uyarı',
    shortNote: 'Sistemdeki aktif ve geçmiş uyarılar.',
    detail: 'Kullanıcılara oluşturulan uyarı kayıtlarının toplamını gösterir. Toplu duyurular da bu alana yansır.',
    formula: 'app.alerts tablosundaki tüm satırlar',
    source: 'app.alerts',
    interpretation: 'Bildirim yoğunluğunu ve yönetici iletişimini takip etmeye yarar.',
  },
];

const metricMap = METRIC_DEFINITIONS.reduce((acc, metric) => {
  acc[metric.key] = metric;
  return acc;
}, {});

const chartColors = ['#163a2f', '#2d6a4f', '#c59c3d', '#5b8c74', '#7aa88f', '#a5c9b3'];

const metricLabelMap = {
  total_users: 'Toplam kullanıcı',
  active_users: 'Aktif kullanıcı',
  inactive_users: 'Pasif kullanıcı',
  badge_users: 'Rozetli kullanıcı',
  new_users_30d: 'Son 30 günde yeni kullanıcı',
  total_fields: 'Toplam tarla',
  total_plans: 'Toplam plan',
  total_analyses: 'Toplam analiz',
  users_with_analyses: 'Analiz yapan kullanıcı',
  total_recommendations: 'Toplam öneri',
  total_alerts: 'Toplam uyarı',
};

const formatChartNumber = (value) => formatNumber(value);

const AdminDashboard = () => {
  const navigate = useNavigate();
  const { admin, token, logout } = useAdminAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const [error, setError] = useState('');
  const [broadcastError, setBroadcastError] = useState('');
  const [broadcastSuccess, setBroadcastSuccess] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({
    alertType: 'warning',
    title: '',
    message: '',
  });
  const [selectedMetricKey, setSelectedMetricKey] = useState(null);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      if (!token) {
        setLoading(false);
        return;
      }

      if (refreshTick === 0) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      try {
        const payload = await apiFetch('/api/admin/dashboard?limit=12', {
          token,
          clearOn401: false,
        });

        if (active) {
          setDashboard(payload);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Yönetici özeti yüklenemedi.');
        }
      } finally {
        if (active) {
          if (refreshTick === 0) {
            setLoading(false);
          } else {
            setRefreshing(false);
          }
        }
      }
    };

    loadDashboard();
    return () => {
      active = false;
    };
  }, [token, refreshTick]);

  const summary = dashboard?.summary || {};
  const activityRows = dashboard?.activity || [];
  const recentUsers = dashboard?.recent_users || [];
  const monthlyTrends = dashboard?.monthly_trends || [];

  const analysisSharePercent = useMemo(() => {
    const totalUsers = Number(summary.total_users || 0);
    const analysts = Number(summary.users_with_analyses || 0);
    if (!totalUsers) return 0;
    return (analysts / totalUsers) * 100;
  }, [summary.total_users, summary.users_with_analyses]);

  const monthlyTrendData = useMemo(() => (
    monthlyTrends.map((row) => ({
      month: formatMonth(row.month_start),
      kayıt: Number(row.registration_count || 0),
      plan: Number(row.plan_count || 0),
      analiz: Number(row.analysis_count || 0),
    }))
  ), [monthlyTrends]);

  const activeStatusData = useMemo(() => ([
    {
      name: 'Aktif',
      value: Number(summary.active_users || 0),
    },
    {
      name: 'Pasif',
      value: Number(summary.inactive_users || 0),
    },
  ]), [summary.active_users, summary.inactive_users]);

  const activityChartData = useMemo(() => (
    activityRows.slice(0, 8).map((row) => ({
      name: truncateLabel(row.full_name, 14),
      Tarla: Number(row.field_count || 0),
      Plan: Number(row.plan_count || 0),
      Analiz: Number(row.analysis_count || 0),
    }))
  ), [activityRows]);

  const metricRows = useMemo(() => (
    METRIC_DEFINITIONS.map((metric) => ({
      ...metric,
      value: Number(summary[metric.valueKey] || 0),
    }))
  ), [summary]);

  const selectedMetric = selectedMetricKey ? {
    ...metricMap[selectedMetricKey],
    value: Number(summary[selectedMetricKey] || 0),
  } : null;

  const overviewCards = [
    {
      label: 'Toplam kullanıcı',
      value: formatNumber(summary.total_users),
      note: 'Kayıtlı tüm hesapların sayısı. Bu sayı sistemin genel büyüklüğünü gösterir.',
      icon: <Users size={20} />,
      detailKey: 'total_users',
    },
    {
      label: 'Toplam analiz',
      value: formatNumber(summary.total_analyses),
      note: 'Sistemde üretilen tüm yapay zekâ analizlerinin toplamı.',
      icon: <BarChart3 size={20} />,
      detailKey: 'total_analyses',
    },
    {
      label: 'Analiz yapan kullanıcı',
      value: formatNumber(summary.users_with_analyses),
      note: 'En az bir kez analiz yapan farklı hesapların sayısı.',
      icon: <Database size={20} />,
      detailKey: 'users_with_analyses',
    },
    {
      label: 'Analiz oranı',
      value: formatPercent(analysisSharePercent),
      note: 'Analiz yapan kullanıcıların toplam kullanıcı içindeki payı.',
      icon: <TrendingUp size={20} />,
      detailKey: null,
    },
  ];

  const openMetricDetail = (metricKey) => {
    if (!metricKey) return;
    setSelectedMetricKey(metricKey);
  };

  const closeMetricDetail = () => {
    setSelectedMetricKey(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/admin/login', { replace: true });
  };

  const handleBroadcastChange = (field, value) => {
    setBroadcastForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBroadcastSubmit = async (event) => {
    event.preventDefault();
    setBroadcastSending(true);
    setBroadcastError('');
    setBroadcastSuccess('');

    try {
      const payload = await apiFetch('/api/admin/alerts/broadcast', {
        method: 'POST',
        token,
        clearOn401: false,
        body: broadcastForm,
      });

      setBroadcastSuccess(`"${payload.title}" başlıklı uyarı ${formatNumber(payload.recipientCount)} kullanıcıya gönderildi.`);
      setBroadcastForm({
        alertType: broadcastForm.alertType,
        title: '',
        message: '',
      });
      setRefreshTick((value) => value + 1);
    } catch (err) {
      setBroadcastError(err.message || 'Uyarı gönderilemedi.');
    } finally {
      setBroadcastSending(false);
    }
  };

  if (loading && !dashboard) {
    return (
      <div className="admin-loading-state">
        <div className="admin-spinner" />
        <p>Yönetici paneli yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div className="admin-panel">
        <header className="admin-topbar">
          <div className="admin-brand">
            <div className="admin-brand-mark">
              <Shield size={22} />
            </div>
            <div className="admin-brand-copy">
              <p className="admin-kicker">Yönetici paneli</p>
              <h1 className="admin-topbar-title">TarımPro sistem özeti</h1>
              <p className="admin-topbar-subtitle">
                Kayıt, analiz ve kullanım yoğunluğu tek ekranda. {dashboard?.generatedAt ? `Son güncelleme: ${formatDateTime(dashboard.generatedAt)}.` : ''}
                {refreshing ? ' Veriler yenileniyor.' : ''}
              </p>
            </div>
          </div>

          <div className="admin-topbar-actions">
            <div className="admin-session-chip">
              <strong>{admin?.displayName || 'Sistem Yöneticisi'}</strong>
              <span>Oturum bitişi: {formatDateTime(admin?.sessionExpiresAt)}</span>
            </div>
            <button type="button" className="admin-button danger" onClick={handleLogout}>
              <LogOut size={16} />
              Çıkış yap
            </button>
          </div>
        </header>

        {error && <div className="admin-error-banner">{error}</div>}
        {broadcastSuccess && <div className="admin-success-banner">{broadcastSuccess}</div>}
        {broadcastError && <div className="admin-error-banner">{broadcastError}</div>}

        <section className="admin-kpi-grid" aria-label="Sistem özeti">
          {overviewCards.map((card) => (
            <article key={card.label} className="admin-kpi-card">
              <div className="admin-brand" style={{ gap: '0.65rem' }}>
                <div className="admin-brand-mark" style={{ width: '2.5rem', height: '2.5rem' }}>
                  {card.icon}
                </div>
                <span className="admin-kpi-label">{card.label}</span>
              </div>
              <p className="admin-kpi-value">{card.value}</p>
              <p className="admin-kpi-note">{card.note}</p>
              {card.detailKey && (
                <button type="button" className="admin-detail-button" onClick={() => openMetricDetail(card.detailKey)}>
                  Ayrıntı
                </button>
              )}
            </article>
          ))}
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <p className="admin-section-kicker">Grafikler</p>
              <h2 className="admin-section-title">Zaman ve kullanım eğilimleri</h2>
            </div>
            <p className="admin-section-note">
              İlk grafik son 6 ayın kayıt, plan ve analiz hareketini; ikinci grafik aktif ve pasif kullanıcı dağılımını; üçüncü grafik ise en yoğun kullanıcı davranışını gösterir.
            </p>
          </div>

          <div className="admin-chart-grid">
            <article className="admin-chart-card admin-chart-card--wide">
              <div className="admin-chart-card-header">
                <div>
                  <span className="admin-chart-kicker"><LineChart size={14} /> Aylık eğilim</span>
                  <h3 className="admin-chart-title">Kayıt, plan ve analiz akışı</h3>
                </div>
                <span className="admin-chart-badge">Son 6 ay</span>
              </div>

              <div className="admin-chart-surface">
                {monthlyTrendData.length === 0 ? (
                  <div className="admin-chart-empty">Aylık eğilim verisi bulunamadı.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsLineChart data={monthlyTrendData} margin={{ top: 10, right: 12, left: -6, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(22, 58, 47, 0.08)" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip
                        formatter={(value, name) => [formatChartNumber(value), name]}
                        labelStyle={{ color: '#163a2f', fontWeight: 700 }}
                      />
                      <Line type="monotone" dataKey="kayıt" name="Kayıt" stroke="#163a2f" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="plan" name="Plan" stroke="#2d6a4f" strokeWidth={3} dot={false} />
                      <Line type="monotone" dataKey="analiz" name="Analiz" stroke="#c59c3d" strokeWidth={3} dot={false} />
                      <Legend />
                    </RechartsLineChart>
                  </ResponsiveContainer>
                )}
              </div>

              <p className="admin-chart-note">
                Bu çizgiler büyüme hızını okumanı sağlar. Kayıt artışı ile analiz artışı arasındaki fark, kullanıcıların sisteme ne kadar derinlemesine girdiğini gösterir.
              </p>
            </article>

            <article className="admin-chart-card">
              <div className="admin-chart-card-header">
                <div>
                  <span className="admin-chart-kicker"><Activity size={14} /> Hesap durumu</span>
                  <h3 className="admin-chart-title">Aktif ve pasif kullanıcı dağılımı</h3>
                </div>
                <span className="admin-chart-badge">{formatNumber(summary.total_users)} hesap</span>
              </div>

              <div className="admin-chart-surface">
                {activeStatusData.every((item) => item.value === 0) ? (
                  <div className="admin-chart-empty">Hesap verisi bulunamadı.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={activeStatusData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={50}
                        outerRadius={86}
                        paddingAngle={3}
                        stroke="transparent"
                      >
                        {activeStatusData.map((entry, index) => (
                          <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [formatChartNumber(value), 'Kullanıcı']} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>

              <p className="admin-chart-note">
                Aktif kullanıcı sayısı, sistemin canlı kullanımını anlatır. Pasif kullanıcılar ise kapatılmış ya da erişimi dondurulmuş hesapları temsil eder.
              </p>
            </article>

            <article className="admin-chart-card admin-chart-card--full">
              <div className="admin-chart-card-header">
                <div>
                  <span className="admin-chart-kicker"><BarChart3 size={14} /> Kullanım yoğunluğu</span>
                  <h3 className="admin-chart-title">En aktif kullanıcıların işlem dağılımı</h3>
                </div>
                <span className="admin-chart-badge">İlk 8 kullanıcı</span>
              </div>

              <div className="admin-chart-surface">
                {activityChartData.length === 0 ? (
                  <div className="admin-chart-empty">Aktivite grafiği için veri bulunamadı.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activityChartData} margin={{ top: 10, right: 12, left: -8, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(22, 58, 47, 0.08)" />
                      <XAxis dataKey="name" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip formatter={(value, name) => [formatChartNumber(value), name]} />
                      <Legend />
                      <Bar dataKey="Tarla" fill="#2d6a4f" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Plan" fill="#5b8c74" radius={[6, 6, 0, 0]} />
                      <Bar dataKey="Analiz" fill="#c59c3d" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <p className="admin-chart-note">
                Aynı kullanıcı için tarla, plan ve analiz sayıları birlikte görünür. Böylece hangi hesapların sadece kayıtlı olup hangi hesapların aktif çalıştığı anlaşılır.
              </p>
            </article>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <p className="admin-section-kicker">Toplu uyarı</p>
              <h2 className="admin-section-title">Tüm kullanıcılara bildirim gönder</h2>
            </div>
            <p className="admin-section-note">
              Bu form, girilen mesajı sistemdeki her kullanıcı için ayrı uyarı kaydı olarak oluşturur. Kullanıcılar kendi bildirim alanlarında bu mesajı görür.
            </p>
          </div>

          <div className="admin-broadcast-grid">
            <form className="admin-broadcast-form" onSubmit={handleBroadcastSubmit}>
              <div className="admin-form-grid">
                <label className="admin-input-group">
                  <span>Uyarı türü</span>
                  <select
                    className="admin-input admin-select"
                    value={broadcastForm.alertType}
                    onChange={(event) => handleBroadcastChange('alertType', event.target.value)}
                  >
                    {ALERT_TYPE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <small className="admin-form-help">
                    {ALERT_TYPE_OPTIONS.find((option) => option.value === broadcastForm.alertType)?.description}
                  </small>
                </label>

                <label className="admin-input-group">
                  <span>Başlık</span>
                  <input
                    className="admin-input"
                    type="text"
                    placeholder="Örn: Planlı bakım bildirimi"
                    value={broadcastForm.title}
                    onChange={(event) => handleBroadcastChange('title', event.target.value)}
                    required
                  />
                </label>
              </div>

              <label className="admin-input-group">
                <span>Mesaj</span>
                <textarea
                  className="admin-input admin-textarea"
                  rows="5"
                  placeholder="Kullanıcılara gönderilecek kısa ve net mesajı yazın."
                  value={broadcastForm.message}
                  onChange={(event) => handleBroadcastChange('message', event.target.value)}
                  required
                />
              </label>

              <div className="admin-form-actions">
                <button type="submit" className="admin-button primary" disabled={broadcastSending}>
                  <Send size={16} />
                  {broadcastSending ? 'Gönderiliyor...' : 'Tüm kullanıcılara gönder'}
                </button>
                <p className="admin-form-help">
                  Mesaj gönderildiğinde her kullanıcı için ayrı uyarı kaydı oluşturulur.
                </p>
              </div>
            </form>

            <aside className="admin-broadcast-preview">
              <div className="admin-broadcast-preview-header">
                <Bell size={18} />
                <h3>Gönderim özeti</h3>
              </div>

              <div className="admin-mini-stats">
                <div className="admin-mini-stat">
                  <span>Alıcı sayısı</span>
                  <strong>{formatNumber(summary.total_users)}</strong>
                </div>
                <div className="admin-mini-stat">
                  <span>Uyarı türü</span>
                  <strong>{ALERT_TYPE_OPTIONS.find((option) => option.value === broadcastForm.alertType)?.label}</strong>
                </div>
                <div className="admin-mini-stat">
                  <span>Kapsam</span>
                  <strong>Tüm kullanıcılar</strong>
                </div>
              </div>

              <div className="admin-broadcast-note">
                Bu bölüm sadece yönetici içindir. Buradan basılan uyarılar, kullanıcıların kendi anasayfa bildirimlerine düşer.
              </div>

              <div className="admin-broadcast-preview-text">
                <strong>{broadcastForm.title || 'Başlık önizlemesi'}</strong>
                <p>{broadcastForm.message || 'Mesaj girildiğinde burada kısa bir önizleme görünecek.'}</p>
              </div>
            </aside>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <p className="admin-section-kicker">Metrikler</p>
              <h2 className="admin-section-title">Sistem metrikleri</h2>
            </div>
            <p className="admin-section-note">
              Her satırda bir detay butonu var. Tıkladığında metrik neyi anlattığını, hangi tablodan geldiğini ve nasıl yorumlanacağını görebilirsin.
            </p>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Metrik</th>
                  <th>Değer</th>
                  <th>Kısa açıklama</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {metricRows.map((metric) => (
                  <tr key={metric.key}>
                    <td className="admin-user-cell">
                      <span className="admin-user-name">{metric.label}</span>
                    </td>
                    <td>
                      <span className="admin-pill neutral">{formatNumber(metric.value)}</span>
                    </td>
                    <td className="admin-location">{metric.shortNote}</td>
                    <td className="admin-table-action-cell">
                      <button
                        type="button"
                        className="admin-button secondary admin-detail-button"
                        onClick={() => openMetricDetail(metric.key)}
                      >
                        Detay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <p className="admin-section-kicker">Kullanıcı listesi</p>
              <h2 className="admin-section-title">En aktif kullanıcılar</h2>
            </div>
            <p className="admin-section-note">
              Bu liste analiz sayısına göre sıralanır.  "Çiftçi" okunur.
            </p>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Konum</th>
                  <th>Tarla</th>
                  <th>Plan</th>
                  <th>Analiz</th>
                  <th>Son hareket</th>
                  <th>Rol</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {activityRows.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="admin-empty-state">Aktivite kaydı bulunamadı.</div>
                    </td>
                  </tr>
                ) : (
                  activityRows.map((row) => (
                    <tr key={row.id}>
                      <td className="admin-user-cell">
                        <span className="admin-user-name">{row.full_name}</span>
                        <span className="admin-user-meta">
                          {row.phone || row.email || 'İletişim bilgisi yok'}
                        </span>
                      </td>
                      <td className="admin-location">{formatLocation(row.city, row.district)}</td>
                      <td>{formatNumber(row.field_count)}</td>
                      <td>{formatNumber(row.plan_count)}</td>
                      <td>{formatNumber(row.analysis_count)}</td>
                      <td>{formatDateTime(row.last_activity_at)}</td>
                      <td>
                        <span className="admin-pill info">{formatRoleLabel(row.role)}</span>
                      </td>
                      <td>
                        <span className={`admin-pill ${row.is_active ? 'success' : 'danger'}`}>
                          {row.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="admin-section">
          <div className="admin-section-header">
            <div>
              <p className="admin-section-kicker">Son kayıtlar</p>
              <h2 className="admin-section-title">Yeni oluşan hesaplar</h2>
            </div>
            <p className="admin-section-note">
              Bu tablo yeni gelen kullanıcıları gösterir. 
            </p>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Kullanıcı</th>
                  <th>Konum</th>
                  <th>Kayıt tarihi</th>
                  <th>Rol</th>
                  <th>Durum</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      <div className="admin-empty-state">Kayıt bulunamadı.</div>
                    </td>
                  </tr>
                ) : (
                  recentUsers.map((row) => (
                    <tr key={row.id}>
                      <td className="admin-user-cell">
                        <span className="admin-user-name">{row.full_name}</span>
                        <span className="admin-user-meta">
                          {row.phone || row.email || 'İletişim bilgisi yok'}
                        </span>
                      </td>
                      <td className="admin-location">{formatLocation(row.city, row.district)}</td>
                      <td>{formatDateTime(row.created_at)}</td>
                      <td>
                        <span className="admin-pill info">{formatRoleLabel(row.role)}</span>
                      </td>
                      <td>
                        <span className={`admin-pill ${row.is_active ? 'success' : 'danger'}`}>
                          {row.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedMetric && (
        <div className="admin-modal-backdrop" role="presentation" onClick={closeMetricDetail}>
          <div className="admin-modal-panel" role="dialog" aria-modal="true" aria-labelledby="admin-metric-title" onClick={(event) => event.stopPropagation()}>
            <div className="admin-modal-header">
              <div>
                <p className="admin-section-kicker">Metrik detay</p>
                <h3 id="admin-metric-title" className="admin-modal-title">{selectedMetric.label}</h3>
              </div>
              <button type="button" className="admin-modal-close" onClick={closeMetricDetail} aria-label="Detayı kapat">
                <X size={18} />
              </button>
            </div>

            <div className="admin-modal-value">
              <span>Güncel değer</span>
              <strong>{formatNumber(selectedMetric.value)}</strong>
            </div>

            <div className="admin-detail-list">
              <div className="admin-detail-item">
                <span className="admin-detail-label">Neyi anlatır?</span>
                <p className="admin-detail-value">{selectedMetric.detail}</p>
              </div>
              <div className="admin-detail-item">
                <span className="admin-detail-label">Kaynak</span>
                <p className="admin-detail-value">{selectedMetric.source}</p>
              </div>
              <div className="admin-detail-item">
                <span className="admin-detail-label">Hesap mantığı</span>
                <p className="admin-detail-value">{selectedMetric.formula}</p>
              </div>
              <div className="admin-detail-item">
                <span className="admin-detail-label">Yorum</span>
                <p className="admin-detail-value">{selectedMetric.interpretation}</p>
              </div>
            </div>

            <div className="admin-modal-footer">
              <div className="admin-detail-note">
                <Info size={16} />
                <span>Bu metrik tek başına karar vermez; diğer metriklerle birlikte okunmalıdır.</span>
              </div>
              <button type="button" className="admin-button primary" onClick={closeMetricDetail}>
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
