import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './Profile.css';
import './Settings.css';

const emptyFieldForm = {
    name: '',
    city: '',
    district: '',
    regionCode: '',
    areaDecare: '',
    soilType: '',
    latitude: '',
    longitude: '',
    notes: '',
};

const inputStyle = {
    width: '100%',
    borderRadius: '12px',
    border: '1px solid #d1d5db',
    padding: '0.75rem 0.9rem',
    fontSize: '0.95rem',
};

const formGridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '1rem',
};

const Profile = () => {
    const [activeTab, setActiveTab] = useState('personal');
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [profileForm, setProfileForm] = useState({ fullName: '', phone: '', email: '', city: '', district: '' });
    const [savingProfile, setSavingProfile] = useState(false);
    const [fieldForm, setFieldForm] = useState(emptyFieldForm);
    const [editingFieldId, setEditingFieldId] = useState(null);
    const [savingField, setSavingField] = useState(false);
    const [fieldError, setFieldError] = useState('');
    const navigate = useNavigate();
    const { logout, refreshSession } = useAuth();

    const loadProfile = async () => {
        const payload = await apiFetch('/api/profile/me');
        setProfile(payload);
        setProfileForm({
            fullName: payload.user?.name || '',
            phone: payload.user?.phone || '',
            email: payload.user?.email || '',
            city: payload.user?.city || '',
            district: payload.user?.district || '',
        });
    };

    useEffect(() => {
        let active = true;

        const run = async () => {
            try {
                const payload = await apiFetch('/api/profile/me');
                if (!active) return;
                setProfile(payload);
                setProfileForm({
                    fullName: payload.user?.name || '',
                    phone: payload.user?.phone || '',
                    email: payload.user?.email || '',
                    city: payload.user?.city || '',
                    district: payload.user?.district || '',
                });
            } catch (err) {
                if (active) setError(err.message || 'Profil verileri al?namad?.');
            } finally {
                if (active) setLoading(false);
            }
        };

        run();
        return () => {
            active = false;
        };
    }, []);

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    const handleProfileSave = async (e) => {
        e.preventDefault();
        setSavingProfile(true);
        setError('');
        try {
            await apiFetch('/api/profile/me', {
                method: 'PUT',
                body: profileForm,
            });
            await loadProfile();
            await refreshSession();
        } catch (err) {
            setError(err.message || 'Profil g?ncellenemedi.');
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

            await loadProfile();
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
            regionCode: field.regionCode || '',
            areaDecare: field.size ?? '',
            soilType: field.soilType || '',
            latitude: field.latitude ?? '',
            longitude: field.longitude ?? '',
            notes: field.notes || '',
        });
        setActiveTab('fields');
    };

    const handleDeleteField = async (fieldId) => {
        const confirmed = window.confirm('Bu tarlay? silmek istedi?inize emin misiniz?');
        if (!confirmed) return;

        try {
            await apiFetch(`/api/fields/${fieldId}`, { method: 'DELETE' });
            await loadProfile();
            if (editingFieldId === fieldId) {
                resetFieldForm();
            }
        } catch (err) {
            setFieldError(err.message || 'Tarla silinemedi.');
        }
    };

    if (loading) {
        return (
            <div className="loading-state">
                <div className="spinner"></div>
                <p>Profil verileri veritaban?ndan y?kleniyor...</p>
            </div>
        );
    }

    const user = profile?.user;
    const fields = profile?.fields || [];
    const reports = profile?.reports || [];

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
                            <h1>{user?.name || 'Kullan?c?'}</h1>
                            <span className="farmer-badge">
                                <Award size={16} />
                                Aktif ?ift?i
                            </span>
                        </div>
                        <p className="text-muted">{user?.city} / {user?.district} ? ?ye tarihi: {user?.memberSince || '?'}</p>
                    </div>
                    <div className="profile-actions">
                        <button className="btn-secondary" onClick={() => setActiveTab('personal')}>Profili G?r</button>
                        <button className="btn-danger-outline" onClick={() => setShowLogoutModal(true)}>
                            <LogOut size={18} />
                            G?venli ??k?? Yap
                        </button>
                    </div>
                </div>
            </div>

            <div className="profile-content">
                <div className="profile-sidebar card">
                    <nav className="profile-nav">
                        <button className={`profile-nav-btn ${activeTab === 'personal' ? 'active' : ''}`} onClick={() => setActiveTab('personal')}>
                            <User size={20} />
                            Ki?isel Bilgiler
                        </button>
                        <button className={`profile-nav-btn ${activeTab === 'fields' ? 'active' : ''}`} onClick={() => setActiveTab('fields')}>
                            <Map size={20} />
                            Kay?tl? Tarlalar?m
                        </button>
                        <button className={`profile-nav-btn ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
                            <FileText size={20} />
                            Ge?mi? Analiz Raporlar?
                        </button>
                        <button className={`profile-nav-btn ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                            <Settings size={20} />
                            Sistem Ayarlar?
                        </button>
                    </nav>
                </div>

                <div className="profile-main card">
                    {error && <p style={{ color: '#b91c1c', marginBottom: '1rem' }}>{error}</p>}

                    {activeTab === 'personal' && (
                        <div className="tab-pane animate-fade-in">
                            <h2 className="tab-title">Ki?isel Bilgiler</h2>
                            <div className="info-grid">
                                <div className="info-group">
                                    <label>T.C. Kimlik No</label>
                                    <p>{user?.tc || '?'}</p>
                                </div>
                                <div className="info-group">
                                    <label>Telefon Numaras?</label>
                                    <p>{user?.phone || '?'}</p>
                                </div>
                                <div className="info-group">
                                    <label>E-posta Adresi</label>
                                    <p>{user?.email || '?'}</p>
                                </div>
                                <div className="info-group">
                                    <label>?l / ?l?e</label>
                                    <p>{user?.city} / {user?.district}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fields' && (
                        <div className="tab-pane animate-fade-in">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                                <h2 className="tab-title" style={{ marginBottom: 0 }}>Kay?tl? Tarlalar?m</h2>
                                <button className="btn-secondary" onClick={resetFieldForm}>
                                    <Plus size={16} />
                                    Yeni Tarla
                                </button>
                            </div>

                            <form onSubmit={handleFieldSubmit} style={{ display: 'grid', gap: '1rem', marginBottom: '1.5rem' }}>
                                <div style={formGridStyle}>
                                    <input style={inputStyle} placeholder="Tarla ad?" value={fieldForm.name} onChange={(e) => setFieldForm((prev) => ({ ...prev, name: e.target.value }))} />
                                    <input style={inputStyle} placeholder="?l" value={fieldForm.city} onChange={(e) => setFieldForm((prev) => ({ ...prev, city: e.target.value }))} />
                                    <input style={inputStyle} placeholder="?l?e" value={fieldForm.district} onChange={(e) => setFieldForm((prev) => ({ ...prev, district: e.target.value }))} />
                                    <input style={inputStyle} placeholder="B?lge kodu" value={fieldForm.regionCode} onChange={(e) => setFieldForm((prev) => ({ ...prev, regionCode: e.target.value }))} />
                                    <input style={inputStyle} type="number" min="0.1" step="0.1" placeholder="D?n?m" value={fieldForm.areaDecare} onChange={(e) => setFieldForm((prev) => ({ ...prev, areaDecare: e.target.value }))} />
                                    <input style={inputStyle} placeholder="Toprak tipi" value={fieldForm.soilType} onChange={(e) => setFieldForm((prev) => ({ ...prev, soilType: e.target.value }))} />
                                    <input style={inputStyle} type="number" step="0.000001" placeholder="Enlem" value={fieldForm.latitude} onChange={(e) => setFieldForm((prev) => ({ ...prev, latitude: e.target.value }))} />
                                    <input style={inputStyle} type="number" step="0.000001" placeholder="Boylam" value={fieldForm.longitude} onChange={(e) => setFieldForm((prev) => ({ ...prev, longitude: e.target.value }))} />
                                </div>
                                <textarea style={{ ...inputStyle, minHeight: '90px', resize: 'vertical' }} placeholder="Notlar" value={fieldForm.notes} onChange={(e) => setFieldForm((prev) => ({ ...prev, notes: e.target.value }))} />
                                {fieldError && <p style={{ color: '#b91c1c', margin: 0 }}>{fieldError}</p>}
                                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                                    <button className="btn-primary" type="submit" disabled={savingField}>
                                        {savingField ? 'Kaydediliyor...' : editingFieldId ? 'Tarlay? G?ncelle' : 'Tarlay? Kaydet'}
                                    </button>
                                    {editingFieldId && (
                                        <button className="btn-secondary" type="button" onClick={resetFieldForm}>D?zenlemeyi ?ptal Et</button>
                                    )}
                                </div>
                            </form>

                            <div className="field-list">
                                {fields.map((field) => (
                                    <div className="field-item" key={field.id} style={{ justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                                        <div className="field-info">
                                            <h4>{field.name}</h4>
                                            <p className="text-muted">{field.size} D?n?m ? Toprak Tipi: {field.soilType || 'Belirtilmedi'}</p>
                                            <p className="text-muted">{field.city} / {field.district}</p>
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                            <button className="btn-secondary" onClick={() => handleEditField(field)}>
                                                <Pencil size={16} />
                                                D?zenle
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
                            <h2 className="tab-title">Ge?mi? Analiz Raporlar?</h2>
                            <div className="field-list">
                                {reports.map((report) => (
                                    <div className="field-item" key={report.id}>
                                        <div className="field-info">
                                            <h4>{report.type}</h4>
                                            <p className="text-muted">{report.field} ? {report.date}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {activeTab === 'settings' && (
                        <div className="tab-pane animate-fade-in">
                            <h2 className="tab-title">Sistem Ayarlar?</h2>
                            <form onSubmit={handleProfileSave} style={{ display: 'grid', gap: '1rem' }}>
                                <div style={formGridStyle}>
                                    <input style={inputStyle} placeholder="Ad Soyad" value={profileForm.fullName} onChange={(e) => setProfileForm((prev) => ({ ...prev, fullName: e.target.value }))} />
                                    <input style={inputStyle} placeholder="Telefon" value={profileForm.phone} onChange={(e) => setProfileForm((prev) => ({ ...prev, phone: e.target.value }))} />
                                    <input style={inputStyle} placeholder="E-posta" value={profileForm.email} onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))} />
                                    <input style={inputStyle} placeholder="?l" value={profileForm.city} onChange={(e) => setProfileForm((prev) => ({ ...prev, city: e.target.value }))} />
                                    <input style={inputStyle} placeholder="?l?e" value={profileForm.district} onChange={(e) => setProfileForm((prev) => ({ ...prev, district: e.target.value }))} />
                                </div>
                                <div>
                                    <button className="btn-primary" type="submit" disabled={savingProfile}>
                                        {savingProfile ? 'Kaydediliyor...' : 'Bilgileri Kaydet'}
                                    </button>
                                </div>
                            </form>
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
                        <h2>Oturumunuz kapat?l?yor</h2>
                        <p className="modal-message">
                            Verileriniz g?venle kaydedildi.<br />
                            <strong>Bereketli sezonlar dileriz!</strong>
                        </p>
                        <div className="modal-actions">
                            <button className="btn-secondary w-full" onClick={() => setShowLogoutModal(false)}>
                                ?ptal Et
                            </button>
                            <button className="btn-primary w-full logout-confirm-btn" onClick={handleLogout}>
                                ??k?? Yap
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
