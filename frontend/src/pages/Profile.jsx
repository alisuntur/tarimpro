import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User,
    Map,
    FileText,
    LogOut,
    Award,
    ChevronRight,
    Settings,
    Save,
    Lock,
    MapPin,
    Bell,
    ShieldCheck,
    Smartphone,
    Trash2,
    Plus,
    Download,
    Eye
} from 'lucide-react';
import './Profile.css';
import './Settings.css';

const Profile = () => {
    const [activeTab, setActiveTab] = useState('personal');
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    // Personal Info State
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [userName, setUserName] = useState('Ahmet Yılmaz');
    const [userTc, setUserTc] = useState('123******01');
    const [userPhone, setUserPhone] = useState('+90 53X XXX XX XX');
    const [userEmail, setUserEmail] = useState('ahmet.yilmaz@tarim.test');
    const [userLocation, setUserLocation] = useState('Manisa / Akhisar');

    // Settings State
    const [city, setCity] = useState('Manisa');
    const [district, setDistrict] = useState('Akhisar');
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [smsEnabled, setSmsEnabled] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Fields State
    const [fields, setFields] = useState([
        { id: 1, name: 'Kuzey Parseli (Akhisar)', size: 150, soilType: 'Tınlı' },
        { id: 2, name: 'Güney Mevkii (Akhisar)', size: 85, soilType: 'Killi-Tınlı' }
    ]);
    const [isAddingField, setIsAddingField] = useState(false);
    const [newFieldName, setNewFieldName] = useState('');
    const [newFieldSize, setNewFieldSize] = useState('');
    const [newFieldType, setNewFieldType] = useState('Tınlı');
    // Düzenleme
    const [editingFieldId, setEditingFieldId] = useState(null);
    const [editFieldName, setEditFieldName] = useState('');
    const [editFieldSize, setEditFieldSize] = useState('');
    const [editFieldType, setEditFieldType] = useState('Tınlı');

    // Reports State
    const [reports] = useState([
        { id: 101, date: '15 Mart 2026', field: 'Kuzey Parseli', type: 'Yapay Zeka Ekim Önerisi', status: 'Tamamlandı' },
        { id: 102, date: '02 Şubat 2026', field: 'Güney Mevkii', type: 'Detaylı İklim Risk Raporu', status: 'Tamamlandı' },
        { id: 103, date: '18 Kasım 2025', field: 'Kuzey Parseli', type: 'Hasat & Verim Analizi', status: 'Tamamlandı' },
    ]);

    const handleSaveGeneral = (e) => {
        e.preventDefault();
        alert('Genel ayarlarınız başarıyla güncellendi.');
    };

    const handlePasswordChange = (e) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            alert('Yeni şifreler eşleşmiyor!');
            return;
        }
        alert('Şifreniz başarıyla değiştirildi.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
    };

    const handleSaveProfile = (e) => {
        e.preventDefault();
        setIsEditingProfile(false);
        alert('Kişisel bilgileriniz başarıyla güncellendi.');
    };

    const handleAddField = (e) => {
        e.preventDefault();
        if (!newFieldName || !newFieldSize) return;

        const newField = {
            id: Date.now(),
            name: newFieldName,
            size: Number(newFieldSize),
            soilType: newFieldType
        };

        setFields([...fields, newField]);
        setIsAddingField(false);
        setNewFieldName('');
        setNewFieldSize('');
        setNewFieldType('Tınlı');
        alert('Yeni tarla başarıyla eklendi.');
    };

    const handleRemoveField = (id) => {
        if (window.confirm('Bu tarlayı silmek istediğinize emin misiniz?')) {
            setFields(fields.filter(field => field.id !== id));
            if (editingFieldId === id) setEditingFieldId(null);
        }
    };

    const handleStartEdit = (field) => {
        if (editingFieldId === field.id) {
            setEditingFieldId(null); // Toggle kapat
        } else {
            setEditingFieldId(field.id);
            setEditFieldName(field.name);
            setEditFieldSize(String(field.size));
            setEditFieldType(field.soilType);
        }
    };

    const handleSaveField = (e) => {
        e.preventDefault();
        setFields(fields.map(f => f.id === editingFieldId
            ? { ...f, name: editFieldName, size: Number(editFieldSize), soilType: editFieldType }
            : f
        ));
        setEditingFieldId(null);
    };

    const handleLogout = () => {
        // Simulate API call for logout
        setTimeout(() => {
            navigate('/login');
        }, 1500);
    };

    return (
        <div className="profile-container animate-fade-in">
            <div className="profile-header card">
                <div className="profile-cover"></div>
                <div className="profile-info-wrapper">
                    <div className="profile-avatar">
                        <User size={48} color="var(--color-primary-dark)" />
                    </div>
                    <div className="profile-details">
                        <div className="name-badge-wrapper">
                            <h1>{userName}</h1>
                            <span className="farmer-badge">
                                <Award size={16} />
                                Aktif Çiftçi
                            </span>
                        </div>
                        <p className="text-muted">{userLocation} • Üye tarihi: 2021</p>
                    </div>
                    <div className="profile-actions">
                        <button className="btn-secondary" onClick={() => setIsEditingProfile(!isEditingProfile)}>
                            {isEditingProfile ? 'İptal Et' : 'Profili Düzenle'}
                        </button>
                        <button
                            className="btn-danger-outline"
                            onClick={() => setShowLogoutModal(true)}
                        >
                            <LogOut size={18} />
                            Güvenli Çıkış Yap
                        </button>
                    </div>
                </div>
            </div>

            <div className="profile-content">
                <div className="profile-sidebar card">
                    <nav className="profile-nav">
                        <button
                            className={`profile-nav-btn ${activeTab === 'personal' ? 'active' : ''}`}
                            onClick={() => setActiveTab('personal')}
                        >
                            <User size={20} />
                            Kişisel Bilgiler
                        </button>
                        <button
                            className={`profile-nav-btn ${activeTab === 'fields' ? 'active' : ''}`}
                            onClick={() => setActiveTab('fields')}
                        >
                            <Map size={20} />
                            Kayıtlı Tarlalarım
                        </button>
                        <button
                            className={`profile-nav-btn ${activeTab === 'reports' ? 'active' : ''}`}
                            onClick={() => setActiveTab('reports')}
                        >
                            <FileText size={20} />
                            Geçmiş Analiz Raporları
                        </button>
                        <button
                            className={`profile-nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
                            onClick={() => setActiveTab('settings')}
                        >
                            <Settings size={20} />
                            Sistem Ayarları
                        </button>
                    </nav>
                </div>

                <div className="profile-main card">
                    {activeTab === 'personal' && (
                        <div className="tab-pane animate-fade-in">
                            <h2 className="tab-title">Kişisel Bilgiler</h2>

                            {!isEditingProfile ? (
                                <div className="info-grid">
                                    <div className="info-group">
                                        <label>T.C. Kimlik No</label>
                                        <p>{userTc}</p>
                                    </div>
                                    <div className="info-group">
                                        <label>Telefon Numarası</label>
                                        <p>{userPhone}</p>
                                    </div>
                                    <div className="info-group">
                                        <label>E-posta Adresi</label>
                                        <p>{userEmail}</p>
                                    </div>
                                    <div className="info-group">
                                        <label>İl / İlçe</label>
                                        <p>{userLocation}</p>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleSaveProfile} className="settings-form" style={{ marginTop: '1rem', padding: '1.5rem', backgroundColor: '#f8fafc', borderRadius: 'var(--radius-md)', border: '1px dashed #cbd5e1' }}>
                                    <div className="settings-grid">
                                        <div className="form-group">
                                            <label>Ad Soyad</label>
                                            <input type="text" className="input-field" value={userName} onChange={(e) => setUserName(e.target.value)} required />
                                        </div>
                                        <div className="form-group">
                                            <label>T.C. Kimlik No</label>
                                            <input type="text" className="input-field" value={userTc} onChange={(e) => setUserTc(e.target.value)} disabled title="T.C. Kimlik numaranızı değiştiremezsiniz." style={{ backgroundColor: '#e2e8f0', cursor: 'not-allowed' }} />
                                        </div>
                                        <div className="form-group">
                                            <label>Telefon Numarası</label>
                                            <input type="text" className="input-field" value={userPhone} onChange={(e) => setUserPhone(e.target.value)} required />
                                        </div>
                                        <div className="form-group">
                                            <label>E-posta Adresi</label>
                                            <input type="email" className="input-field" value={userEmail} onChange={(e) => setUserEmail(e.target.value)} required />
                                        </div>
                                        <div className="form-group">
                                            <label>İl / İlçe</label>
                                            <input type="text" className="input-field" value={userLocation} onChange={(e) => setUserLocation(e.target.value)} required />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                                        <button type="submit" className="btn-primary flex items-center gap-2">
                                            <Save size={18} /> Bilgileri Kaydet
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}

                    {activeTab === 'fields' && (
                        <div className="tab-pane animate-fade-in">
                            <h2 className="tab-title">Kayıtlı Tarlalarım</h2>

                            <div className="field-list">
                                {fields.length === 0 && (
                                    <p className="text-muted" style={{ padding: '1rem 0' }}>Henüz kayıtlı bir tarlanız bulunmamaktadır.</p>
                                )}
                                {fields.map(field => (
                                    <div key={field.id}>
                                        <div className="field-item" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div className="field-info">
                                                <h4>{field.name}</h4>
                                                <p className="text-muted">{field.size} Dönüm • Toprak Tipi: {field.soilType}</p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button className="icon-btn text-danger" onClick={() => handleRemoveField(field.id)} title="Tarlayı Sil">
                                                    <Trash2 size={18} />
                                                </button>
                                                <button
                                                    className={`icon-btn ${editingFieldId === field.id ? 'active' : ''}`}
                                                    onClick={() => handleStartEdit(field)}
                                                    title="Düzenle"
                                                    style={editingFieldId === field.id ? { color: 'var(--color-primary)', transform: 'rotate(90deg)', transition: 'transform 0.2s' } : { transition: 'transform 0.2s' }}
                                                >
                                                    <ChevronRight size={20} />
                                                </button>
                                            </div>
                                        </div>
                                        {editingFieldId === field.id && (
                                            <div style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '12px', padding: '1.25rem', marginTop: '0.5rem', marginBottom: '0.75rem' }}>
                                                <h4 style={{ marginBottom: '1rem', fontSize: '0.95rem', color: 'var(--color-primary-dark)' }}>Tarla Düzenle</h4>
                                                <form onSubmit={handleSaveField} className="settings-form">
                                                    <div className="form-group">
                                                        <label>Tarla Adı / Mevkii</label>
                                                        <input type="text" className="input-field" value={editFieldName} onChange={e => setEditFieldName(e.target.value)} required />
                                                    </div>
                                                    <div className="settings-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                                                        <div className="form-group">
                                                            <label>Büyüklük (Dönüm)</label>
                                                            <input type="number" className="input-field" value={editFieldSize} onChange={e => setEditFieldSize(e.target.value)} required min="1" />
                                                        </div>
                                                        <div className="form-group">
                                                            <label>Toprak Tipi</label>
                                                            <select className="input-field" value={editFieldType} onChange={e => setEditFieldType(e.target.value)}>
                                                                <option value="Tınlı">Tınlı</option>
                                                                <option value="Killi">Killi</option>
                                                                <option value="Kumlu">Kumlu</option>
                                                                <option value="Kireçli">Kireçli</option>
                                                                <option value="Killi-Tınlı">Killi-Tınlı</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                                        <button type="button" className="btn-secondary w-full" onClick={() => setEditingFieldId(null)}>Vazgeç</button>
                                                        <button type="submit" className="btn-primary w-full" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                                                            <Save size={16} /> Kaydet
                                                        </button>
                                                    </div>
                                                </form>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {!isAddingField ? (
                                <button className="btn-primary" style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }} onClick={() => setIsAddingField(true)}>
                                    <Plus size={18} /> Yeni Tarla Ekle
                                </button>
                            ) : (
                                <div className="card add-field-card mt-4 p-4" style={{ backgroundColor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
                                    <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Yeni Tarla Bilgileri</h3>
                                    <form onSubmit={handleAddField} className="settings-form">
                                        <div className="form-group">
                                            <label>Tarla Adı / Mevkii</label>
                                            <input type="text" className="input-field" value={newFieldName} onChange={(e) => setNewFieldName(e.target.value)} placeholder="Örn: Doğu Tarlası" required />
                                        </div>
                                        <div className="settings-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.5rem' }}>
                                            <div className="form-group">
                                                <label>Büyüklük (Dönüm)</label>
                                                <input type="number" className="input-field" value={newFieldSize} onChange={(e) => setNewFieldSize(e.target.value)} placeholder="Örn: 50" required min="1" />
                                            </div>
                                            <div className="form-group">
                                                <label>Toprak Tipi</label>
                                                <select className="input-field" value={newFieldType} onChange={(e) => setNewFieldType(e.target.value)}>
                                                    <option value="Tınlı">Tınlı</option>
                                                    <option value="Killi">Killi</option>
                                                    <option value="Kumlu">Kumlu</option>
                                                    <option value="Kireçli">Kireçli</option>
                                                    <option value="Killi-Tınlı">Killi-Tınlı</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
                                            <button type="button" className="btn-secondary w-full" onClick={() => setIsAddingField(false)}>İptal</button>
                                            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2">
                                                <Save size={18} /> Kaydet
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="tab-pane animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 className="tab-title" style={{ margin: 0 }}>Geçmiş Analiz Raporları</h2>
                                <button className="btn-secondary" style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>Tümünü İndir (.zip)</button>
                            </div>

                            <div className="field-list">
                                {reports.length === 0 ? (
                                    <p className="text-muted" style={{ padding: '1rem 0' }}>Henüz kaydedilmiş bir analiz raporunuz bulunmuyor.</p>
                                ) : (
                                    reports.map(report => (
                                        <div className="field-item" key={report.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <div className="field-info">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
                                                    <h4 style={{ margin: 0 }}>{report.type}</h4>
                                                    <span className="badge" style={{ backgroundColor: 'var(--color-success)', color: 'white', fontSize: '0.7rem', padding: '0.15rem 0.5rem', borderRadius: '1rem' }}>{report.status}</span>
                                                </div>
                                                <p className="text-muted" style={{ margin: 0, fontSize: '0.9rem' }}>{report.field} • {report.date}</p>
                                            </div>
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button className="icon-btn" title="Raporu Görüntüle" onClick={() => alert('Rapor görüntüleniyor... (Demo)')}>
                                                    <Eye size={18} className="text-primary" />
                                                </button>
                                                <button className="icon-btn" title="PDF Olarak İndir" onClick={() => alert('Rapor indiriliyor... (Demo)')}>
                                                    <Download size={18} className="text-primary" />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="tab-pane animate-fade-in settings-container" style={{ maxWidth: '100%', padding: '0' }}>
                            <div className="settings-header" style={{ marginBottom: '1.5rem' }}>
                                <h2 className="tab-title" style={{ marginBottom: '0.25rem' }}>Sistem Ayarları</h2>
                                <p className="text-muted">Hesap tercihlerinizi, güvenliğinizi ve bildirimlerinizi yönetin.</p>
                            </div>

                            <div className="settings-grid">
                                {/* Column 1: General & Notifications */}
                                <div className="settings-column">
                                    <div className="card settings-card" style={{ padding: '1.25rem' }}>
                                        <div className="settings-card-header" style={{ borderBottom: '1px solid rgba(15, 23, 42, 0.06)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <MapPin size={24} className="text-primary" />
                                            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Bölgesel Tercihler</h3>
                                        </div>
                                        <form onSubmit={handleSaveGeneral} className="settings-form">
                                            <div className="form-group">
                                                <label>Varsayılan Şehir</label>
                                                <select
                                                    className="input-field"
                                                    value={city}
                                                    onChange={(e) => setCity(e.target.value)}
                                                >
                                                    <option value="Adana">Adana</option>
                                                    <option value="Ankara">Ankara</option>
                                                    <option value="Antalya">Antalya</option>
                                                    <option value="Bursa">Bursa</option>
                                                    <option value="İzmir">İzmir</option>
                                                    <option value="Konya">Konya</option>
                                                    <option value="Manisa">Manisa</option>
                                                    <option value="Şanlıurfa">Şanlıurfa</option>
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label>Varsayılan İlçe</label>
                                                <input
                                                    type="text"
                                                    className="input-field"
                                                    value={district}
                                                    onChange={(e) => setDistrict(e.target.value)}
                                                    placeholder="İlçe giriniz"
                                                />
                                            </div>
                                            <button type="submit" className="btn-primary flex items-center gap-2 mt-2">
                                                <Save size={18} />
                                                Tercihleri Kaydet
                                            </button>
                                        </form>
                                    </div>

                                    <div className="card settings-card" style={{ padding: '1.25rem' }}>
                                        <div className="settings-card-header" style={{ borderBottom: '1px solid rgba(15, 23, 42, 0.06)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <Bell size={24} className="text-primary" />
                                            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Bildirim Ayarları</h3>
                                        </div>
                                        <div className="toggle-list">
                                            <div className="toggle-item">
                                                <div className="toggle-info">
                                                    <ShieldCheck size={20} className="text-muted" />
                                                    <div>
                                                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem' }}>Sistem Bildirimleri</h4>
                                                        <p className="text-muted text-sm" style={{ margin: 0, fontSize: '0.8rem' }}>Tarla riskleri, hava durumu ve piyasa uyarıları.</p>
                                                    </div>
                                                </div>
                                                <label className="switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={notificationsEnabled}
                                                        onChange={() => setNotificationsEnabled(!notificationsEnabled)}
                                                    />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>

                                            <div className="toggle-item">
                                                <div className="toggle-info">
                                                    <Smartphone size={20} className="text-muted" />
                                                    <div>
                                                        <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.95rem' }}>SMS Bilgilendirme</h4>
                                                        <p className="text-muted text-sm" style={{ margin: 0, fontSize: '0.8rem' }}>Sadece acil don ve kuraklık uyarılarında SMS al.</p>
                                                    </div>
                                                </div>
                                                <label className="switch">
                                                    <input
                                                        type="checkbox"
                                                        checked={smsEnabled}
                                                        onChange={() => setSmsEnabled(!smsEnabled)}
                                                    />
                                                    <span className="slider round"></span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Column 2: Security */}
                                <div className="settings-column">
                                    <div className="card settings-card" style={{ padding: '1.25rem' }}>
                                        <div className="settings-card-header" style={{ borderBottom: '1px solid rgba(15, 23, 42, 0.06)', paddingBottom: '0.75rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                            <Lock size={24} className="text-primary" />
                                            <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Güvenlik & Şifre Değiştirme</h3>
                                        </div>
                                        <form onSubmit={handlePasswordChange} className="settings-form">
                                            <div className="form-group">
                                                <label>Mevcut Şifre</label>
                                                <input
                                                    type="password"
                                                    className="input-field"
                                                    value={currentPassword}
                                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                                    placeholder="••••••••"
                                                    required
                                                />
                                            </div>
                                            <div className="form-group mt-2">
                                                <label>Yeni Şifre</label>
                                                <input
                                                    type="password"
                                                    className="input-field"
                                                    value={newPassword}
                                                    onChange={(e) => setNewPassword(e.target.value)}
                                                    placeholder="En az 8 karakter"
                                                    required
                                                    minLength={8}
                                                />
                                            </div>
                                            <div className="form-group mb-2">
                                                <label>Yeni Şifre (Tekrar)</label>
                                                <input
                                                    type="password"
                                                    className="input-field"
                                                    value={confirmPassword}
                                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                                    placeholder="Şifreyi doğrulayın"
                                                    required
                                                />
                                            </div>
                                            <div className="security-notice">
                                                <ShieldCheck size={16} className="text-success" />
                                                <span>Şifreniz endüstri standardı yöntemlerle şifrelenerek saklanmaktadır.</span>
                                            </div>
                                            <button type="submit" className="btn-primary w-full flex items-center justify-center gap-2 mt-4">
                                                <Lock size={18} />
                                                Şifreyi Güncelle
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Logout Modal */}
            {
                showLogoutModal && (
                    <div className="modal-overlay animate-fade-in">
                        <div className="logout-modal card">
                            <div className="modal-icon-wrapper">
                                <SproutIcon className="leaf-icon" />
                            </div>
                            <h2>Oturumunuz kapatılıyor</h2>
                            <p className="modal-message">
                                Verileriniz güvenle kaydedildi.<br />
                                <strong>Bereketli sezonlar dileriz!</strong>
                            </p>
                            <div className="modal-actions">
                                <button
                                    className="btn-secondary w-full"
                                    onClick={() => setShowLogoutModal(false)}
                                >
                                    İptal Et
                                </button>
                                <button
                                    className="btn-primary w-full logout-confirm-btn"
                                    onClick={handleLogout}
                                >
                                    Çıkış Yap
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};

// Mini inline component for the animated leaf
const SproutIcon = () => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="48"
        height="48"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
    >
        <path d="M7 20h10" />
        <path d="M10 20c5.5-2.5.8-6.4 3-10" />
        <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
        <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </svg>
);

export default Profile;
