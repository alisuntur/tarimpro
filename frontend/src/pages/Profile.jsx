import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    User,
    Map,
    FileText,
    Settings,
    LogOut,
    Award,
    Pencil,
    Trash2,
    Plus,
    Sun,
    Moon,
    Info,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import './Profile.css';
import './Settings.css';

const emptyFieldForm = {
    name: '',
    city: '',
    district: '',
    areaDecare: '',
    soilType: '',
    latitude: '',
    longitude: '',
    notes: '',
};

const inputStyle = {
    width: '100%',
    borderRadius: '8px',
    border: '1px solid var(--color-border-strong)',
    backgroundColor: 'var(--color-bg-card)',
    color: 'var(--color-text-main)',
    padding: '0.75rem 0.9rem',
    fontSize: '0.95rem',
};

const emptyLocationOptions = {
    cities: [],
    districtsByCity: {},
    coordinatesByLocation: {},
};

const locationOptionKey = (value) => (
    String(value || '')
        .trim()
        .toLocaleLowerCase('tr-TR')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/ı/g, 'i')
        .replace(/\s+/g, ' ')
);

const addUnique = (items, value) => {
    if (!value) return;
    const valueKey = locationOptionKey(value);
    if (!items.some((item) => locationOptionKey(item) === valueKey)) {
        items.push(value);
    }
};

const formGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
};

const Profile = () => {
    const [activeTab, setActiveTab] = useState('personal');
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
    const [profile, setProfile] = useState(null);
    const [profileLoading, setProfileLoading] = useState(true);
    const [fieldsLoading, setFieldsLoading] = useState(false);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [fieldsLoaded, setFieldsLoaded] = useState(false);
    const [reportsLoaded, setReportsLoaded] = useState(false);
    const [locationsLoaded, setLocationsLoaded] = useState(false);
    const [locationOptions, setLocationOptions] = useState(emptyLocationOptions);
    const [error, setError] = useState('');
    const [profileForm, setProfileForm] = useState({ fullName: '', phone: '', email: '', city: '', district: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [fieldForm, setFieldForm] = useState(emptyFieldForm);
    const [editingFieldId, setEditingFieldId] = useState(null);
    const [savingField, setSavingField] = useState(false);
    const [fieldError, setFieldError] = useState('');
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleteAccountError, setDeleteAccountError] = useState('');
    const [deletingAccount, setDeletingAccount] = useState(false);
    const navigate = useNavigate();
    const location = useLocation();
    const { user: authUser, logout, refreshSession } = useAuth();
    const { theme, setTheme } = useTheme();

    useEffect(() => {
        if (location.state?.onboarding) {
            setActiveTab('fields');
        }
    }, [location.state]);
    const applyProfileUser = useCallback((userPayload) => {
        setProfile((prev) => ({
            ...(prev || {}),
            user: userPayload,
            fields: prev?.fields || [],
            reports: prev?.reports || [],
        }));
        setProfileForm({
            fullName: userPayload?.name || '',
            phone: userPayload?.phone || '',
            email: userPayload?.email || '',
            city: userPayload?.city || '',
            district: userPayload?.district || '',
        });
    }, []);

    const loadFields = useCallback(async () => {
        setFieldsLoading(true);
        setFieldError('');
        try {
            const payload = await apiFetch('/api/fields');
            setProfile((prev) => ({ ...(prev || {}), fields: payload || [] }));
            setFieldsLoaded(true);
        } catch (err) {
            setFieldError(err.message || 'Tarlalar yüklenemedi.');
            setFieldsLoaded(true);
        } finally {
            setFieldsLoading(false);
        }
    }, []);

    const loadLocationOptions = useCallback(async () => {
        try {
            const payload = await apiFetch('/api/locations/options');
            setLocationOptions({
                cities: payload.cities || [],
                districtsByCity: payload.districtsByCity || {},
                coordinatesByLocation: payload.coordinatesByLocation || {},
            });
        } catch (err) {
            setFieldError(err.message || 'İl ve ilçe seçenekleri yüklenemedi.');
        } finally {
            setLocationsLoaded(true);
        }
    }, []);

    const loadReports = useCallback(async ({ silent = false } = {}) => {
        setReportsLoading(true);
        if (!silent) {
            setError('');
        }
        try {
            const payload = await apiFetch('/api/analyses');
            setProfile((prev) => ({ ...(prev || {}), reports: payload.reports || [] }));
            setReportsLoaded(true);
        } catch (err) {
            if (!silent) {
                setError(err.message || 'Analiz raporları yüklenemedi.');
            }
            setReportsLoaded(true);
        } finally {
            setReportsLoading(false);
        }
    }, []);

    useEffect(() => {
        let active = true;

        const run = async () => {
            try {
                const payload = await apiFetch('/api/profile/summary');
                if (!active) return;
                applyProfileUser(payload.user);
                if (Array.isArray(payload.fields)) {
                    setProfile((prev) => ({ ...(prev || {}), fields: payload.fields }));
                    setFieldsLoaded(true);
                }
                if (Array.isArray(payload.reports)) {
                    setProfile((prev) => ({ ...(prev || {}), reports: payload.reports }));
                    setReportsLoaded(true);
                }
            } catch (err) {
                if (active) setError(err.message || 'Profil verileri alınamadı.');
            } finally {
                if (active) setProfileLoading(false);
            }
        };

        run();
        return () => {
            active = false;
        };
    }, [applyProfileUser]);

    useEffect(() => {
        if (activeTab === 'fields' && !fieldsLoaded && !fieldsLoading) {
            loadFields();
        }
        if (activeTab === 'fields' && !locationsLoaded) {
            loadLocationOptions();
        }
        if (activeTab === 'reports' && !reportsLoaded && !reportsLoading) {
            loadReports();
        }
    }, [activeTab, fieldsLoaded, fieldsLoading, loadFields, loadLocationOptions, loadReports, locationsLoaded, reportsLoaded, reportsLoading]);

    useEffect(() => {
        if (reportsLoaded || reportsLoading || profileLoading) {
            return undefined;
        }

        const runPrefetch = () => {
            if (!reportsLoaded && !reportsLoading) {
                loadReports({ silent: true });
            }
        };

        let cleanup;
        if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
            const idleId = window.requestIdleCallback(runPrefetch, { timeout: 1800 });
            cleanup = () => {
                if (typeof window.cancelIdleCallback === 'function') {
                    window.cancelIdleCallback(idleId);
                }
            };
        } else {
            const timerId = window.setTimeout(runPrefetch, 900);
            cleanup = () => window.clearTimeout(timerId);
        }

        return cleanup;
    }, [loadReports, profileLoading, reportsLoaded, reportsLoading]);

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    const openDeleteAccountModal = () => {
        setShowLogoutModal(false);
        setDeleteConfirmText('');
        setDeleteAccountError('');
        setShowDeleteAccountModal(true);
    };

    const closeDeleteAccountModal = () => {
        if (deletingAccount) return;
        setShowDeleteAccountModal(false);
        setDeleteConfirmText('');
        setDeleteAccountError('');
    };

    const handleDeleteAccount = async () => {
        const normalizedConfirmation = deleteConfirmText.trim().toLocaleUpperCase('tr-TR');
        if (normalizedConfirmation !== 'HESABIMI SİL') {
            setDeleteAccountError('Onaylamak için HESABIMI SİL yazmalısın.');
            return;
        }

        setDeletingAccount(true);
        setDeleteAccountError('');

        try {
            await apiFetch('/api/profile/me', {
                method: 'DELETE',
            });
            await logout();
            navigate('/login', { replace: true });
        } catch (err) {
            setDeleteAccountError(err.message || 'Hesap silinemedi.');
        } finally {
            setDeletingAccount(false);
        }
    };

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setSavingProfile(true);
        setError('');
        try {
            const payload = await apiFetch('/api/profile/me', {
                method: 'PUT',
                body: profileForm,
            });
            applyProfileUser(payload.user);
            await refreshSession();
        } catch (err) {
            setError(err.message || 'Profil güncellenemedi.');
        } finally {
            setSavingProfile(false);
        }
    };

    const resetFieldForm = () => {
        setFieldForm(emptyFieldForm);
        setEditingFieldId(null);
        setFieldError('');
    };

    const handleFieldSubmit = async (e) => {
        e.preventDefault();
        setSavingField(true);
        setFieldError('');

        try {
            const payload = {
                ...fieldForm,
                areaDecare: Number(fieldForm.areaDecare || 0),
                latitude: fieldForm.latitude === '' ? null : Number(fieldForm.latitude),
                longitude: fieldForm.longitude === '' ? null : Number(fieldForm.longitude),
            };

            if (editingFieldId) {
                await apiFetch(`/api/fields/${editingFieldId}`, {
                    method: 'PUT',
                    body: payload,
                });
            } else {
                await apiFetch('/api/fields', {
                    method: 'POST',
                    body: payload,
                });
            }

            await loadFields();
            resetFieldForm();
            setActiveTab('fields');
        } catch (err) {
            setFieldError(err.message || 'Tarla kaydedilemedi.');
        } finally {
            setSavingField(false);
        }
    };

    const handleEditField = (field) => {
        setEditingFieldId(field.id);
        setFieldForm({
            name: field.name || '',
            city: field.city || '',
            district: field.district || '',
            areaDecare: field.size ?? '',
            soilType: field.soilType || '',
            latitude: field.latitude ?? '',
            longitude: field.longitude ?? '',
            notes: field.notes || '',
        });
        setActiveTab('fields');
    };

    const handleDeleteField = async (fieldId) => {
        const confirmed = window.confirm('Bu tarlayı silmek istediğinize emin misiniz?');
        if (!confirmed) return;

        try {
            await apiFetch(`/api/fields/${fieldId}`, { method: 'DELETE' });
            await loadFields();
            if (editingFieldId === fieldId) {
                resetFieldForm();
            }
        } catch (err) {
            setFieldError(err.message || 'Tarla silinemedi.');
        }
    };

    const user = profile?.user || {
        name: authUser?.name,
        city: authUser?.city,
        district: authUser?.district,
        memberSince: '-',
    };
    const fields = profile?.fields || [];
    const reports = profile?.reports || [];
    const cityOptions = useMemo(() => {
        const options = [];
        (locationOptions.cities || []).forEach((city) => addUnique(options, city));
        addUnique(options, user?.city);
        addUnique(options, fieldForm.city);
        return options;
    }, [fieldForm.city, locationOptions.cities, user?.city]);
    const districtOptions = useMemo(() => {
        const options = [];
        (locationOptions.districtsByCity[fieldForm.city] || []).forEach((district) => addUnique(options, district));
        addUnique(options, user?.city === fieldForm.city ? user?.district : '');
        addUnique(options, fieldForm.district);
        return options;
    }, [fieldForm.city, fieldForm.district, locationOptions.districtsByCity, user?.city, user?.district]);
    const getCoordinatesForLocation = useCallback((city, district) => {
        const cityCoordinates = locationOptions.coordinatesByLocation?.[city] || {};
        return cityCoordinates[district || ''] || cityCoordinates[''] || null;
    }, [locationOptions.coordinatesByLocation]);
    const resolveCoordinateFields = useCallback((city, district) => {
        const coordinates = getCoordinatesForLocation(city, district);
        return {
            latitude: coordinates?.latitude ?? '',
            longitude: coordinates?.longitude ?? '',
        };
    }, [getCoordinatesForLocation]);
    const handleFieldCityChange = (event) => {
        const city = event.target.value;
        setFieldForm((prev) => ({
            ...prev,
            city,
            district: '',
            ...resolveCoordinateFields(city, ''),
        }));
    };
    const handleFieldDistrictChange = (event) => {
        const district = event.target.value;
        setFieldForm((prev) => ({
            ...prev,
            district,
            ...resolveCoordinateFields(prev.city, district),
        }));
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
                            <h1>{user?.name || 'Kullanıcı'}</h1>
                            <span className="farmer-badge">
                                <Award size={16} />
                                Aktif Çiftçi
                            </span>
                        </div>
                        <p className="text-muted">{user?.city} / {user?.district} • Üye tarihi: {user?.memberSince || '-'}</p>
                    </div>
                    <div className="profile-actions">
                        <button className="btn-secondary" onClick={() => setActiveTab('personal')}>Profili Gör</button>
                        <button className="btn-danger-outline" onClick={() => setShowLogoutModal(true)}>
                            <LogOut size={18} />
                            Güvenli Çıkış Yap
                        </button>
                    </div>
                </div>
            </div>

            <div className="profile-content">
                <div className="profile-sidebar card">
                    <nav className="profile-nav">
                        <button className={`profile-nav-btn ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
                            <User size={20} />
                            Kişisel Bilgiler
                        </button>
                        <button className={`profile-nav-btn ${activeTab === 'fields' ? 'active' : ''}`} onClick={() => setActiveTab('fields')}>
                            <Map size={20} />
                            Kayıtlı Tarlalarım
                        </button>
                        <button className={`profile-nav-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
                            <FileText size={20} />
                            Geçmiş Analiz Raporları
                        </button>
                        <button className={`profile-nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                            <Settings size={20} />
                            Sistem Ayarları
                        </button>
                    </nav>
                </div>

                <div className="profile-main card">
                    {profileLoading && <p className="profile-inline-loading">Profil bilgileri yükleniyor...</p>}
                    {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

                    {activeTab === 'personal' && (
                        <div className="tab-pane animate-fade-in">
                            <h2 className="tab-title">Kişisel Bilgiler</h2>
                            <div className="info-grid">
                                <div className="info-group">
                                    <label>T.C. Kimlik No</label>
                                    <p>{user?.tc || '-'}</p>
                                </div>
                                <div className="info-group">
                                    <label>Telefon Numarası</label>
                                    <p>{user?.phone || '-'}</p>
                                </div>
                                <div className="info-group">
                                    <label>E-posta Adresi</label>
                                    <p>{user?.email || '-'}</p>
                                </div>
                                <div className="info-group">
                                    <label>İl / İlçe</label>
                                    <p>{user?.city} / {user?.district}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fields' && (
                        <div className="tab-pane animate-fade-in">
                            <div className="profile-section-toolbar">
                                <h2 className="tab-title profile-tab-title-spread">Kayıtlı Tarlalarım</h2>
                                <button className="btn-secondary" onClick={resetFieldForm}>
                                    <Plus size={16} />
                                    Yeni Tarla
                                </button>
                            </div>

                            <form onSubmit={handleFieldSubmit} className="profile-form-stack profile-fields-form">
                                <div style={formGridStyle}>
                                    <input style={inputStyle} placeholder="Tarla adı" value={fieldForm.name} onChange={(e) => setFieldForm((prev) => ({ ...prev, name: e.target.value }))} />
                                    <select style={inputStyle} value={fieldForm.city} onChange={handleFieldCityChange}>
                                        <option value="">İl seçin</option>
                                        {cityOptions.map((city) => (
                                            <option key={city} value={city}>{city}</option>
                                        ))}
                                    </select>
                                    <select style={inputStyle} value={fieldForm.district} onChange={handleFieldDistrictChange} disabled={!fieldForm.city || districtOptions.length === 0}>
                                        <option value="">İlçe seçin</option>
                                        {districtOptions.map((district) => (
                                            <option key={district} value={district}>{district}</option>
                                        ))}
                                    </select>
                                    <input style={inputStyle} type="number" min="0.1" step="0.1" placeholder="Dönüm" value={fieldForm.areaDecare} onChange={(e) => setFieldForm((prev) => ({ ...prev, areaDecare: e.target.value }))} />
                                    <div className="soil-type-field">
                                        <input className="field-readonly-input" style={inputStyle} placeholder="Toprak tipi" value={fieldForm.soilType || ''} readOnly />
                                        <button className="soil-info-button" type="button" aria-label="Toprak tipi bilgisi">
                                            <Info size={16} />
                                            <span className="soil-info-tooltip" role="tooltip">
                                                Toprak tipi şu an modelde kullanılmıyor. Bu alan ileride eklenecek özellik için şimdilik değiştirilemez bırakıldı.
                                            </span>
                                        </button>
                                    </div>
                                    <input className="field-readonly-input" style={inputStyle} type="number" step="0.000001" placeholder="Enlem otomatik gelir" value={fieldForm.latitude} readOnly />
                                    <input className="field-readonly-input" style={inputStyle} type="number" step="0.000001" placeholder="Boylam otomatik gelir" value={fieldForm.longitude} readOnly />
                                </div>
                                <textarea className="profile-notes-textarea" style={inputStyle} placeholder="Notlar" value={fieldForm.notes} onChange={(e) => setFieldForm((prev) => ({ ...prev, notes: e.target.value }))} />
                                {fieldError && <p className="profile-inline-error">{fieldError}</p>}
                                <div className="profile-form-actions">
                                    <button className="btn-primary" type="submit" disabled={savingField}>
                                        {savingField ? 'Kaydediliyor...' : editingFieldId ? 'Tarlayı Güncelle' : 'Tarlayı Kaydet'}
                                    </button>
                                    {editingFieldId && (
                                        <button className="btn-secondary" type="button" onClick={resetFieldForm}>Düzenlemeyi İptal Et</button>
                                    )}
                                </div>
                            </form>

                            <div className="field-list">
                                {fieldsLoading ? (
                                    <div className="field-item">
                                        <div className="field-info">
                                            <h4>Tarlalar yükleniyor...</h4>
                                            <p className="text-muted">Kayıtlı tarla bilgilerin getiriliyor.</p>
                                        </div>
                                    </div>
                                ) : fields.length === 0 ? (
                                    <div className="field-item">
                                        <div className="field-info">
                                            <h4>Henüz kayıtlı tarla yok</h4>
                                            <p className="text-muted">İlk tarlanı ekleyerek üretim planı ve analiz akışını kişiselleştirebilirsin.</p>
                                        </div>
                                    </div>
                                ) : fields.map((field) => (
                                    <div className="field-item field-item--stackable" key={field.id}>
                                        <div className="field-info">
                                            <h4>{field.name}</h4>
                                            <p className="text-muted">{field.size} Dönüm • Toprak Tipi: {field.soilType || 'Belirtilmedi'}</p>
                                            <p className="text-muted">{field.city} / {field.district}</p>
                                        </div>
                                        <div className="field-actions">
                                            <button className="btn-secondary" onClick={() => handleEditField(field)}>
                                                <Pencil size={16} />
                                                Düzenle
                                            </button>
                                            <button className="btn-danger-outline" onClick={() => handleDeleteField(field.id)}>
                                                <Trash2 size={16} />
                                                Sil
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'reports' && (
                        <div className="tab-pane animate-fade-in">
                            <h2 className="tab-title">Geçmiş Analiz Raporları</h2>
                            <div className="field-list">
                                {reportsLoading ? (
                                    <div className="field-item">
                                        <div className="field-info">
                                            <h4>Raporlar yükleniyor...</h4>
                                            <p className="text-muted">Geçmiş analiz kayıtların getiriliyor.</p>
                                        </div>
                                    </div>
                                ) : reports.length > 0 ? reports.map((report) => (
                                    <div className="field-item field-item--stackable" key={report.id}>
                                        <div className="field-info">
                                            <h4>{report.type}</h4>
                                            <p className="text-muted">{report.field} • {report.date}</p>
                                            <p className="text-muted">Skor: %{Math.round(report.score || 0)} • Güven: {report.confidenceLabel || '-'}{report.confidenceScore ? ` (%${Math.round(report.confidenceScore)})` : ''}</p>
                                        </div>
                                        <button className="btn-secondary" onClick={() => navigate(`/ai-recommendations?analysisId=${report.analysisId}`)}>
                                            Raporu Aç
                                        </button>
                                    </div>
                                )) : (
                                    <div className="field-item">
                                        <div className="field-info">
                                            <h4>Henüz kayıtlı analiz yok</h4>
                                            <p className="text-muted">Yeni bir üretim planı analiz ettiğinizde raporlar burada listelenecek.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="tab-pane animate-fade-in">
                            <h2 className="tab-title">Sistem Ayarları</h2>
                            <div className="theme-settings-panel">
                                <div>
                                    <h3>Tema</h3>
                                    <p className="text-muted">Seçiminiz tüm ekranlarda uygulanır ve sonraki girişinizde korunur.</p>
                                </div>
                                <div className="theme-choice-group" role="radiogroup" aria-label="Tema seçimi">
                                    <button
                                        type="button"
                                        className={`theme-choice-btn ${theme === 'light' ? 'active' : ''}`}
                                        aria-pressed={theme === 'light'}
                                        onClick={() => setTheme('light')}
                                    >
                                        <Sun size={18} />
                                        <span>Aydınlık</span>
                                    </button>
                                    <button
                                        type="button"
                                        className={`theme-choice-btn ${theme === 'dark' ? 'active' : ''}`}
                                        aria-pressed={theme === 'dark'}
                                        onClick={() => setTheme('dark')}
                                    >
                                        <Moon size={18} />
                                        <span>Karanlık</span>
                                    </button>
                                </div>
                            </div>
                            <form onSubmit={handleProfileSave} className="profile-form-stack">
                                <div style={formGridStyle}>
                                    <input style={inputStyle} placeholder="Ad Soyad" value={profileForm.fullName} onChange={(e) => setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))} />
                                    <input style={inputStyle} placeholder="Telefon" value={profileForm.phone} onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))} />
                                    <input style={inputStyle} placeholder="E-posta" value={profileForm.email} onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))} />
                                    <input style={inputStyle} placeholder="İl" value={profileForm.city} onChange={(e) => setProfileForm((prev) => ({ ...prev, city: e.target.value }))} />
                                    <input style={inputStyle} placeholder="İlçe" value={profileForm.district} onChange={(e) => setProfileForm((prev) => ({ ...prev, district: e.target.value }))} />
                                </div>
                                <div>
                                    <button className="btn-primary" type="submit" disabled={savingProfile}>
                                        {savingProfile ? 'Kaydediliyor...' : 'Bilgileri Kaydet'}
                                    </button>
                                </div>
                            </form>

                            <div className="account-danger-zone">
                                <div>
                                    <h3>Hesabı Sil</h3>
                                    <p className="text-muted">
                                        Bu işlem hesabını, bağlı tarlaları, geçmiş analiz raporlarını, üretim planlarını ve oturumlarını kalıcı olarak siler.
                                    </p>
                                </div>
                                <button type="button" className="btn-danger-outline" onClick={openDeleteAccountModal}>
                                    <Trash2 size={18} />
                                    Hesabı Sil
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {showLogoutModal && (
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
                            <button className="btn-secondary w-full" onClick={() => setShowLogoutModal(false)}>
                                İptal Et
                            </button>
                            <button className="btn-primary w-full logout-confirm-btn" onClick={handleLogout}>
                                Çıkış Yap
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDeleteAccountModal && (
                <div className="modal-overlay animate-fade-in">
                    <div className="logout-modal delete-modal card">
                        <div className="modal-icon-wrapper delete-icon-wrapper">
                            <Trash2 size={30} className="delete-modal-icon" />
                        </div>
                        <h2>Hesabını kalıcı olarak sil</h2>
                        <p className="modal-message">
                            Bu işlem geri alınamaz. Hesabın, tarlaların, planların ve geçmiş analiz raporların kalıcı olarak silinecek.
                            <strong>Onaylamak için HESABIMI SİL yaz.</strong>
                        </p>
                        <input
                            type="text"
                            className="input-field delete-confirm-input"
                            placeholder="HESABIMI SİL"
                            value={deleteConfirmText}
                            onChange={(event) => {
                                setDeleteConfirmText(event.target.value);
                                setDeleteAccountError('');
                            }}
                            disabled={deletingAccount}
                        />
                        {deleteAccountError && <p className="profile-inline-error delete-error">{deleteAccountError}</p>}
                        <div className="modal-actions">
                            <button
                                type="button"
                                className="btn-secondary w-full"
                                onClick={closeDeleteAccountModal}
                                disabled={deletingAccount}
                            >
                                Vazgeç
                            </button>
                            <button
                                type="button"
                                className="btn-danger-outline w-full delete-account-btn"
                                onClick={handleDeleteAccount}
                                disabled={deletingAccount || deleteConfirmText.trim().toLocaleUpperCase('tr-TR') !== 'HESABIMI SİL'}
                            >
                                {deletingAccount ? 'Siliniyor...' : 'Hesabımı Sil'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const SproutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 20h10" />
        <path d="M10 20c5.5-2.5.8-6.4 3-10" />
        <path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
        <path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
    </svg>
);

export default Profile;
