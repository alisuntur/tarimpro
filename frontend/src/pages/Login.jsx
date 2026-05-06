import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { login, isAuthenticated, loading } = useAuth();

    useEffect(() => {
        if (!loading && isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, loading, navigate]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await login({ identifier, password, rememberMe });
            navigate('/dashboard', { replace: true });
        } catch (err) {
            setError(err.message || 'Giriş sırasında bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container">
            <div className="login-image-section">
                <div className="image-overlay">
                    <div className="brand-logo animate-fade-in">
                        <Sprout size={48} color="var(--color-accent)" />
                        <h1>TarımZeka</h1>
                    </div>
                    <div className="quote-container animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <h2>Verinizle toprağınıza bereket katın.</h2>
                        <p>
                            Tarımsal Karar Destek Sistemi sayesinde tarlanızı dijitalden yönetin,
                            yapay zeka destekli önerilerle riskleri en aza indirin.
                        </p>
                    </div>
                </div>
            </div>

            <div className="login-form-section">
                <div className="form-wrapper animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="form-header">
                        <h2>Hoş Geldiniz</h2>
                        <p>Sisteme giriş yaparak tarlanızı yönetmeye devam edin.</p>
                    </div>

                    <form onSubmit={handleLogin} className="login-form">
                        <div className="input-group">
                            <label htmlFor="identifier">T.C. Kimlik No, Telefon veya E-posta</label>
                            <input
                                id="identifier"
                                type="text"
                                className="input-field"
                                placeholder="Örn: 12345678901 / 05551234567 / ahmet.yilmaz@tarim.test"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                required
                            />
                        </div>

                        <div className="input-group">
                            <label htmlFor="password">Şifre</label>
                            <input
                                id="password"
                                type="password"
                                className="input-field"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        <div className="form-options">
                            <label className="checkbox-container">
                                <input
                                    type="checkbox"
                                    checked={rememberMe}
                                    onChange={(e) => setRememberMe(e.target.checked)}
                                />
                                <span className="checkmark"></span>
                                Beni Hatırla
                            </label>
                            <span className="forgot-password">Demo şifre: demo123</span>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary login-btn"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Giriş Yapılıyor...' : 'Sisteme Giriş Yap'}
                        </button>

                        {error && <p style={{ color: '#b91c1c', marginTop: '0.75rem' }}>{error}</p>}
                    </form>

                    <div className="login-footer-links">
                        <div className="register-link">
                            Hesabın yok mu? <Link to="/register">Kayıt ol</Link>
                        </div>
                        <div className="admin-login-link">
                            <Link to="/admin/login">Yönetici Girişi</Link>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
