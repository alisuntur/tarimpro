import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    User,
    Map,
    FileText,
    Settings,
    LogOut,
    Award,
    ChevronRight
} from 'lucide-react';
import './Profile.css';

const Profile = () => {
    const [activeTab, setActiveTab] = useState('personal');
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const navigate = useNavigate();

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
                            <h1>Ahmet Yılmaz</h1>
                            <span className="farmer-badge">
                                <Award size={16} />
                                Aktif Çiftçi
                            </span>
                        </div>
                        <p className="text-muted">Manisa, Akhisar • Üye tarihi: 2021</p>
                    </div>
                    <div className="profile-actions">
                        <button className="btn-secondary">Profili Düzenle</button>
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
                            <div className="info-grid">
                                <div className="info-group">
                                    <label>T.C. Kimlik No</label>
                                    <p>123******01</p>
                                </div>
                                <div className="info-group">
                                    <label>Telefon Numarası</label>
                                    <p>+90 53X XXX XX XX</p>
                                </div>
                                <div className="info-group">
                                    <label>E-posta Adresi</label>
                                    <p>ahmet.yilmaz@tarim.test</p>
                                </div>
                                <div className="info-group">
                                    <label>İl / İlçe</label>
                                    <p>Manisa / Akhisar</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'fields' && (
                        <div className="tab-pane animate-fade-in">
                            <h2 className="tab-title">Kayıtlı Tarlalarım</h2>
                            <div className="field-list">
                                <div className="field-item">
                                    <div className="field-info">
                                        <h4>Kuzey Parseli (Akhisar)</h4>
                                        <p className="text-muted">150 Dönüm • Toprak Tipi: Tınlı</p>
                                    </div>
                                    <button className="icon-btn"><ChevronRight size={20} /></button>
                                </div>
                                <div className="field-item">
                                    <div className="field-info">
                                        <h4>Güney Mevkii (Akhisar)</h4>
                                        <p className="text-muted">85 Dönüm • Toprak Tipi: Killi-Tınlı</p>
                                    </div>
                                    <button className="icon-btn"><ChevronRight size={20} /></button>
                                </div>
                            </div>
                            <button className="btn-primary" style={{ marginTop: '1.5rem' }}>
                                + Yeni Tarla Ekle
                            </button>
                        </div>
                    )}

                    {(activeTab === 'reports' || activeTab === 'settings') && (
                        <div className="tab-pane animate-fade-in">
                            <h2 className="tab-title">Yapım Aşamasında</h2>
                            <p className="text-muted">Bu bölüm yakında erişime açılacaktır.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Logout Modal */}
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
            )}
        </div>
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
