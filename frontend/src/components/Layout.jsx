import React, { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    Home,
    Map,
    BrainCircuit,
    CloudSun,
    Menu,
    Bell,
    User,
    Sprout,
    LogOut,
    Globe,
} from 'lucide-react';
import { apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const Layout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [alertCount, setAlertCount] = useState(0);
    const [alerts, setAlerts] = useState([]);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const notificationRef = useRef(null);
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    useEffect(() => {
        let active = true;

        const loadAlerts = async () => {
            try {
                const dashboardAlerts = await apiFetch('/api/dashboard/alerts');
                if (active) {
                    setAlerts(dashboardAlerts);
                    setAlertCount(dashboardAlerts.length);
                }
            } catch {
                if (active) {
                    setAlerts([]);
                    setAlertCount(0);
                }
            }
        };

        loadAlerts();
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        const handleDocumentClick = (event) => {
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setNotificationsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleDocumentClick);
        return () => {
            document.removeEventListener('mousedown', handleDocumentClick);
        };
    }, []);

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const handleLogout = async () => {
        await logout();
        navigate('/login', { replace: true });
    };

    const handleAlertsNavigate = () => {
        setNotificationsOpen(false);
        navigate('/dashboard#alerts');
    };

    const firstName = user?.name?.split(' ')[0] || 'Çiftçi';
    const recentAlerts = alerts.slice(0, 3);

    const menuItems = [
        { path: '/dashboard', label: 'Ana Sayfa', icon: <Home size={20} /> },
        { path: '/plan-wizard', label: 'Yeni Üretim Planı', icon: <Map size={20} /> },
        { path: '/regional-analysis', label: 'Bölgesel Analiz', icon: <Globe size={20} /> },
        { path: '/ai-recommendations', label: 'Yapay Zeka Önerileri', icon: <BrainCircuit size={20} /> },
        { path: '/climate-market', label: 'İklim ve Risk Raporları', icon: <CloudSun size={20} /> },
        { path: '/profile', label: 'Profil', icon: <User size={20} /> },
    ];

    return (
        <div className="layout-container">
            <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <div className="logo">
                        {sidebarOpen ? (
                            <div className="logo-full">
                                <Sprout color="var(--color-accent)" size={28} />
                                <span>TarımZeka</span>
                            </div>
                        ) : (
                            <Sprout color="var(--color-accent)" size={28} />
                        )}
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                        >
                            <div className="nav-icon">{item.icon}</div>
                            {sidebarOpen && <span className="nav-label animate-fade-in">{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button className="nav-item logout-btn" onClick={handleLogout}>
                        <div className="nav-icon"><LogOut size={20} color="var(--color-danger)" /></div>
                        {sidebarOpen && <span className="nav-label text-danger">Çıkış Yap</span>}
                    </button>
                </div>
            </aside>

            <main className="main-content">
                <header className="top-header">
                    <div className="header-left">
                        <button className="menu-toggle" onClick={toggleSidebar}>
                            <Menu size={24} color="var(--color-text-main)" />
                        </button>
                        <h2 className="welcome-text">Hoş geldiniz, {firstName}!</h2>
                    </div>

                    <div className="header-right">
                        <div className="notification-wrapper" ref={notificationRef}>
                            <button
                                className="notification-btn"
                                type="button"
                                aria-expanded={notificationsOpen}
                                aria-label="Bildirimleri aç"
                                onClick={() => setNotificationsOpen((open) => !open)}
                            >
                                <Bell size={22} color="var(--color-text-muted)" />
                                <span className={`badge ${alertCount === 0 ? 'badge-empty' : ''}`}>{alertCount}</span>
                            </button>

                            {notificationsOpen && (
                                <div className="notification-menu">
                                    <div className="notification-menu-header">
                                        <strong>Bildirimler</strong>
                                        <span>{alertCount} uyarı</span>
                                    </div>

                                    <div className="notification-menu-list">
                                        {recentAlerts.length === 0 ? (
                                            <div className="notification-empty">
                                                <p>Kritik bildirim yok</p>
                                                <span>Yeni uyarılar oluştuğunda burada görünecek.</span>
                                            </div>
                                        ) : recentAlerts.map((alert) => (
                                            <button
                                                key={alert.id}
                                                type="button"
                                                className={`notification-item notification-${alert.type}`}
                                                onClick={handleAlertsNavigate}
                                            >
                                                <span>{alert.title || 'Uyarı'}</span>
                                                <p>{alert.message}</p>
                                                <small>{alert.time}</small>
                                            </button>
                                        ))}
                                    </div>

                                    <button className="notification-footer-btn" type="button" onClick={handleAlertsNavigate}>
                                        Uyarılara Git
                                    </button>
                                </div>
                            )}
                        </div>
                        <div className="user-profile" onClick={() => navigate('/profile')} title={user?.name || 'Profil'}>
                            <div className="avatar">
                                <User size={20} color="white" />
                            </div>
                        </div>
                    </div>
                </header>

                <div className="page-container">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
