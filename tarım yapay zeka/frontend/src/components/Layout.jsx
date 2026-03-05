import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
    Home,
    Map,
    BrainCircuit,
    CloudSun,
    Settings,
    Menu,
    Bell,
    User,
    Sprout,
    LogOut
} from 'lucide-react';
import './Layout.css';

const Layout = () => {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const navigate = useNavigate();

    const toggleSidebar = () => {
        setSidebarOpen(!sidebarOpen);
    };

    const menuItems = [
        { path: '/dashboard', label: 'Ana Sayfa', icon: <Home size={20} /> },
        { path: '/plan-wizard', label: 'Yeni Üretim Planı', icon: <Map size={20} /> },
        { path: '/ai-recommendations', label: 'Yapay Zeka Önerileri', icon: <BrainCircuit size={20} /> },
        { path: '/climate-market', label: 'İklim ve Risk Raporları', icon: <CloudSun size={20} /> },
        { path: '/profile', label: 'Ayarlar', icon: <Settings size={20} /> },
    ];

    return (
        <div className="layout-container">
            {/* Sidebar */}
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
                    <button className="nav-item logout-btn" onClick={() => navigate('/login')}>
                        <div className="nav-icon"><LogOut size={20} color="var(--color-danger)" /></div>
                        {sidebarOpen && <span className="nav-label text-danger">Çıkış Yap</span>}
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="main-content">
                {/* Header */}
                <header className="top-header">
                    <div className="header-left">
                        <button className="menu-toggle" onClick={toggleSidebar}>
                            <Menu size={24} color="var(--color-text-main)" />
                        </button>
                        <h2 className="welcome-text">Hoş Geldiniz, Ahmet! 👋</h2>
                    </div>

                    <div className="header-right">
                        <button className="notification-btn">
                            <Bell size={22} color="var(--color-text-muted)" />
                            <span className="badge">2</span>
                        </button>
                        <div className="user-profile" onClick={() => navigate('/profile')}>
                            <div className="avatar">
                                <User size={20} color="white" />
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="page-container">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};

export default Layout;
