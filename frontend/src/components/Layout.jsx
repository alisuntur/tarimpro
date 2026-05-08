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
    X,
} from 'lucide-react';
import { ALERTS_EVENT, apiFetch } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import './Layout.css';

const Layout = () => {
    const getIsMobile = () => (typeof window !== 'undefined'
        ? window.matchMedia('(max-width: 1024px)').matches
        : false);
    const [sidebarOpen, setSidebarOpen] = useState(() => !getIsMobile());
    const [isMobile, setIsMobile] = useState(getIsMobile);
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
                    setAlerts(Array.isArray(dashboardAlerts)
                        ? dashboardAlerts.map((alert) => ({
                            ...alert,
                            isRead: Boolean(alert.isRead),
                        }))
                        : []);
                }
            } catch {
                if (active) {
                    setAlerts([]);
                }
            }
        };

        loadAlerts();
        return () => {
            active = false;
        };
    }, []);

    const markAlertsRead = async (alertIds = []) => {
        const uniqueAlertIds = [...new Set(alertIds.filter(Boolean).map((alertId) => String(alertId)))];
        if (uniqueAlertIds.length === 0) {
            return;
        }

        try {
            await apiFetch('/api/dashboard/alerts/read', {
                method: 'POST',
                body: { alertIds: uniqueAlertIds },
            });

            const idsToMark = new Set(uniqueAlertIds);
            setAlerts((currentAlerts) => currentAlerts.map((alert) => (
                idsToMark.has(alert.id) ? { ...alert, isRead: true } : alert
            )));
            window.dispatchEvent(new Event(ALERTS_EVENT));
        } catch {
            // Keep the cached list as-is; the next fetch will resync from the server.
        }
    };

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

    useEffect(() => {
        const mediaQuery = window.matchMedia('(max-width: 1024px)');

        const handleMediaChange = (event) => {
            setIsMobile(event.matches);
            setSidebarOpen(!event.matches);
        };

        handleMediaChange(mediaQuery);

        if (typeof mediaQuery.addEventListener === 'function') {
            mediaQuery.addEventListener('change', handleMediaChange);
        } else {
            mediaQuery.addListener(handleMediaChange);
        }

        return () => {
            if (typeof mediaQuery.removeEventListener === 'function') {
                mediaQuery.removeEventListener('change', handleMediaChange);
            } else {
                mediaQuery.removeListener(handleMediaChange);
            }
        };
    }, []);

    useEffect(() => {
        if (!isMobile) return undefined;

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = sidebarOpen ? 'hidden' : previousOverflow;

        return () => {
            document.body.style.overflow = previousOverflow;
        };
    }, [isMobile, sidebarOpen]);

    useEffect(() => {
        if (!isMobile || !sidebarOpen) return undefined;

        const handleEscape = (event) => {
            if (event.key === 'Escape') {
                setSidebarOpen(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [isMobile, sidebarOpen]);

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const unreadAlertCount = alerts.reduce((count, alert) => count + (alert.isRead ? 0 : 1), 0);
    const recentAlerts = alerts.slice(0, 3);

    const handleNotificationsToggle = () => {
        if (notificationsOpen) {
            setNotificationsOpen(false);
            return;
        }

        setNotificationsOpen(true);
        void markAlertsRead(recentAlerts.filter((alert) => !alert.isRead).map((alert) => alert.id));
    };

    const handleNavItemClick = () => {
        setNotificationsOpen(false);
        if (isMobile) {
            setSidebarOpen(false);
        }
    };

    const handleLogout = async () => {
        setNotificationsOpen(false);
        if (isMobile) {
            setSidebarOpen(false);
        }
        await logout();
        navigate('/login', { replace: true });
    };

    const handleAlertsNavigate = async () => {
        setNotificationsOpen(false);
        if (isMobile) {
            setSidebarOpen(false);
        }
        await markAlertsRead(alerts.filter((alert) => !alert.isRead).map((alert) => alert.id));
        navigate('/dashboard#alerts');
    };

    const firstName = user?.name?.split(' ')[0] || 'Çiftçi';
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
            <aside
                className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}
                aria-hidden={isMobile && !sidebarOpen}
            >
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
                    {isMobile && sidebarOpen && (
                        <button
                            type="button"
                            className="sidebar-close-btn"
                            aria-label="Menüyü kapat"
                            onClick={() => setSidebarOpen(false)}
                        >
                            <X size={20} color="var(--color-text-main)" />
                        </button>
                    )}
                </div>

                <nav className="sidebar-nav">
                    {menuItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            onClick={handleNavItemClick}
                        >
                            <div className="nav-icon">{item.icon}</div>
                            {sidebarOpen && <span className="nav-label animate-fade-in">{item.label}</span>}
                        </NavLink>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button type="button" className="nav-item logout-btn" onClick={handleLogout}>
                        <div className="nav-icon"><LogOut size={20} color="var(--color-danger)" /></div>
                        {sidebarOpen && <span className="nav-label text-danger">Çıkış Yap</span>}
                    </button>
                </div>
            </aside>

            <div
                className={`sidebar-backdrop ${isMobile && sidebarOpen ? 'visible' : ''}`}
                aria-hidden="true"
                onClick={() => setSidebarOpen(false)}
            />

            <main className="main-content">
                <header className="top-header">
                    <div className="header-left">
                        <button
                            type="button"
                            className="menu-toggle"
                            aria-label={sidebarOpen ? 'Menüyü kapat' : 'Menüyü aç'}
                            aria-expanded={sidebarOpen}
                            onClick={toggleSidebar}
                        >
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
                                onClick={handleNotificationsToggle}
                            >
                                <Bell size={22} color="var(--color-text-muted)" />
                                <span className={`badge ${unreadAlertCount === 0 ? 'badge-empty' : ''}`}>{unreadAlertCount}</span>
                            </button>

                            {notificationsOpen && (
                                <div className="notification-menu">
                                    <div className="notification-menu-header">
                                        <strong>Bildirimler</strong>
                                        <span>{unreadAlertCount} uyarı</span>
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
                        <button
                            type="button"
                            className="user-profile"
                            onClick={() => {
                                setNotificationsOpen(false);
                                if (isMobile) {
                                    setSidebarOpen(false);
                                }
                                navigate('/profile');
                            }}
                            title={user?.name || 'Profil'}
                            aria-label="Profili aç"
                        >
                            <div className="avatar">
                                <User size={20} color="white" />
                            </div>
                        </button>
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
