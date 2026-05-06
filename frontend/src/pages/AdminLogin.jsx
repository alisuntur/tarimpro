import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';
import './Admin.css';

const AdminLogin = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { login, isAuthenticated, loading } = useAdminAuth();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/admin', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      await login({ username, password });
      navigate('/admin', { replace: true });
    } catch (err) {
      setError(err.message || 'Yönetici girişi başarısız oldu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="admin-shell">
      <div className="admin-login-grid">
        <section className="admin-login-hero">
          <div className="admin-login-grid-copy">
            <div className="admin-brand" style={{ alignItems: 'center' }}>
              <div className="admin-brand-mark">
                <Shield size={22} />
              </div>
              <div>
                <p className="admin-login-kicker">Yönetici erişimi</p>
                <h1 className="admin-login-title">TarımPro yönetici paneli</h1>
              </div>
            </div>

            <p className="admin-login-text">
              Bu ekran yalnızca sistem yöneticisi için tasarlandı. Kullanıcı verileri değiştirilmez;
              panel sadece kayıt sayıları, analiz yoğunluğu, grafikler ve son durum özeti sunar.
            </p>

            <p className="admin-login-hint">
              Ayrı bir yönetici oturumu kullanılır. Normal kullanıcı girişi bu panelden bağımsızdır.
            </p>
          </div>

          <div className="admin-login-metric">
            <div className="admin-login-metric-card">
              <strong>1 oturum</strong>
              <span>Yönetici için ayrık yetki</span>
            </div>
            <div className="admin-login-metric-card">
              <strong>Salt-okuma</strong>
              <span>Bilgi ve rapor odaklı</span>
            </div>
            <div className="admin-login-metric-card">
              <strong>Detaylı görünüm</strong>
              <span>Tablo + grafik + uyarı</span>
            </div>
          </div>
        </section>

        <section className="admin-login-panel">
          <p className="admin-login-kicker">Panel girişi</p>
          <h2 className="admin-section-title">Yönetici kimlik doğrulama</h2>
          <p className="admin-login-text">
            Kod içine gömülü hesap ile giriş yapın. Yetki doğrulandığında sistem özeti açılır.
          </p>

          <form className="admin-form" onSubmit={handleSubmit}>
            <div className="admin-input-group">
              <label htmlFor="admin-username">Yönetici kullanıcı adı</label>
              <input
                id="admin-username"
                className="admin-input"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                required
              />
            </div>

            <div className="admin-input-group">
              <label htmlFor="admin-password">Şifre</label>
              <input
                id="admin-password"
                className="admin-input"
                type="password"
                autoComplete="current-password"
                placeholder="Yönetici şifresi"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <div className="admin-login-actions">
              <button className="admin-button primary" type="submit" disabled={isLoading}>
                {isLoading ? 'Giriş doğrulanıyor...' : 'Yönetici girişi'}
              </button>
              <Link className="admin-login-link" to="/login">
                Normal girişe dön
              </Link>
            </div>

            {error && <div className="admin-error-banner">{error}</div>}
          </form>
        </section>
      </div>
    </div>
  );
};

export default AdminLogin;
