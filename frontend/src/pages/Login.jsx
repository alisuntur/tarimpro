import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tractor, Sprout, Leaf } from 'lucide-react';
import './Login.css';

const Login = () => {
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();
        setIsLoading(true);

        // Simulate API call
        setTimeout(() => {
            setIsLoading(false);
            navigate('/dashboard');
        }, 1500);
    };

    return (
        <div className="login-container">
            {/* Left Side - Illustration/Image */}
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

            {/* Right Side - Form */}
            <div className="login-form-section">
                <div className="form-wrapper animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="form-header">
                        <h2>Hoş Geldiniz</h2>
                        <p>Sisteme giriş yaparak tarlanızı yönetmeye devam edin.</p>
                    </div>

                    <form onSubmit={handleLogin} className="login-form">
                        <div className="input-group">
                            <label htmlFor="identifier">T.C. Kimlik No veya Telefon Numarası</label>
                            <input
                                id="identifier"
                                type="text"
                                className="input-field"
                                placeholder="Örn: 12345678901 veya 05XXXXXXXXX"
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
                            <a href="#" className="forgot-password">Şifremi Unuttum</a>
                        </div>

                        <button
                            type="submit"
                            className="btn-primary login-btn"
                            disabled={isLoading}
                        >
                            {isLoading ? 'Giriş Yapılıyor...' : 'Sisteme Giriş Yap'}
                        </button>
                    </form>

                    <div className="register-link">
                        Henüz hesabınız yok mu?{' '}
                        <a href="#">Çiftçi Kayıt Sistemi (ÇKS) ile üye olun</a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;
