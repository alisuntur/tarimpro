import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Sprout } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../lib/api';
import './Login.css';
import './Register.css';

const emptyLocationOptions = {
    cities: [],
    districtsByCity: {},
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

const Register = () => {
    const [form, setForm] = useState({
        fullName: '',
        phone: '',
        email: '',
        city: '',
        district: '',
        tcIdentityNo: '',
        password: '',
        passwordConfirm: '',
    });
    const [locationOptions, setLocationOptions] = useState(emptyLocationOptions);
    const [locationLoading, setLocationLoading] = useState(true);
    const [locationError, setLocationError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();
    const { register, isAuthenticated, loading } = useAuth();

    useEffect(() => {
        if (!isLoading && !loading && isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, isLoading, loading, navigate]);

    useEffect(() => {
        let active = true;

        const loadLocationOptions = async () => {
            try {
                const payload = await apiFetch('/api/locations/options', { auth: false });
                if (!active) return;
                setLocationOptions({
                    cities: payload.cities || [],
                    districtsByCity: payload.districtsByCity || {},
                });
            } catch (err) {
                if (active) {
                    setLocationError(err.message || 'İl ve ilçe listesi yüklenemedi.');
                }
            } finally {
                if (active) setLocationLoading(false);
            }
        };

        loadLocationOptions();
        return () => {
            active = false;
        };
    }, []);

    const updateField = (field, value) => {
        setForm((prev) => ({ ...prev, [field]: value }));
        setError('');
    };

    const cityOptions = useMemo(() => {
        const options = [];
        (locationOptions.cities || []).forEach((city) => addUnique(options, city));
        addUnique(options, form.city);
        return options;
    }, [form.city, locationOptions.cities]);

    const districtOptions = useMemo(() => {
        const options = [];
        (locationOptions.districtsByCity[form.city] || []).forEach((district) => addUnique(options, district));
        addUnique(options, form.district);
        return options;
    }, [form.city, form.district, locationOptions.districtsByCity]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        setError('');

        if (form.password !== form.passwordConfirm) {
            setError('Şifreler birbiriyle eşleşmiyor.');
            return;
        }

        setIsLoading(true);
        try {
            await register({
                fullName: form.fullName,
                phone: form.phone,
                email: form.email || null,
                city: form.city || null,
                district: form.district || null,
                tcIdentityNo: form.tcIdentityNo || null,
                password: form.password,
            });
            navigate('/profile', { replace: true, state: { onboarding: true } });
        } catch (err) {
            setError(err.message || 'Kayıt sırasında bir hata oluştu.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="login-container register-container">
            <div className="login-image-section">
                <div className="image-overlay register-overlay">
                    <div className="brand-logo animate-fade-in">
                        <Sprout size={48} color="var(--color-accent)" />
                        <h1>TarımZeka</h1>
                    </div>
                    <div className="quote-container animate-fade-in" style={{ animationDelay: '0.2s' }}>
                        <h2>Yeni hesabını oluştur, üretim planını veriye bağla.</h2>
                        <p>
                            Kayıt sonrası otomatik giriş yapılır; ardından ilk tarlanı ekleyip üretim planı oluşturmaya başlayabilirsin.
                        </p>
                    </div>
                </div>
            </div>

            <div className="login-form-section">
                <div className="form-wrapper register-form-wrapper animate-fade-in" style={{ animationDelay: '0.1s' }}>
                    <div className="form-header">
                        <h2>Hesap Oluştur</h2>
                        <p>Bilgilerini gir, sistem seni otomatik olarak içeri alsın.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form register-form">
                        <div className="input-group">
                            <label htmlFor="fullName">Ad Soyad</label>
                            <input
                                id="fullName"
                                type="text"
                                className="input-field"
                                placeholder="Örn: Ayşe Yılmaz"
                                value={form.fullName}
                                onChange={(event) => updateField('fullName', event.target.value)}
                                required
                            />
                        </div>

                        <div className="register-grid">
                            <div className="input-group">
                                <label htmlFor="phone">Telefon</label>
                                <input
                                    id="phone"
                                    type="tel"
                                    className="input-field"
                                    placeholder="05551234567"
                                    value={form.phone}
                                    onChange={(event) => updateField('phone', event.target.value)}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label htmlFor="email">E-posta</label>
                                <input
                                    id="email"
                                    type="email"
                                    className="input-field"
                                    placeholder="ornek@mail.com"
                                    value={form.email}
                                    onChange={(event) => updateField('email', event.target.value)}
                                />
                            </div>
                        </div>

                        <div className="register-grid">
                            <div className="input-group">
                                <label htmlFor="city">İl</label>
                                <select
                                    id="city"
                                    className="input-field"
                                    value={form.city}
                                    onChange={(event) => {
                                        const city = event.target.value;
                                        setForm((prev) => ({ ...prev, city, district: '' }));
                                        setError('');
                                    }}
                                    disabled={locationLoading || cityOptions.length === 0}
                                >
                                    <option value="">{locationLoading ? 'İller yükleniyor...' : 'İl seçin'}</option>
                                    {cityOptions.map((city) => (
                                        <option key={city} value={city}>{city}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="input-group">
                                <label htmlFor="district">İlçe</label>
                                <select
                                    id="district"
                                    className="input-field"
                                    value={form.district}
                                    onChange={(event) => updateField('district', event.target.value)}
                                    disabled={!form.city || districtOptions.length === 0}
                                >
                                    <option value="">{form.city ? 'İlçe seçin' : 'Önce il seçin'}</option>
                                    {districtOptions.map((district) => (
                                        <option key={district} value={district}>{district}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {locationError && <p className="auth-error">{locationError}</p>}

                        <div className="input-group">
                            <label htmlFor="tcIdentityNo">T.C. Kimlik No <span className="optional-label">Opsiyonel</span></label>
                            <input
                                id="tcIdentityNo"
                                type="text"
                                className="input-field"
                                placeholder="11 haneli kimlik numarası"
                                value={form.tcIdentityNo}
                                onChange={(event) => updateField('tcIdentityNo', event.target.value)}
                                maxLength={11}
                            />
                        </div>

                        <div className="register-grid">
                            <div className="input-group">
                                <label htmlFor="password">Şifre</label>
                                <input
                                    id="password"
                                    type="password"
                                    className="input-field"
                                    placeholder="En az 6 karakter"
                                    value={form.password}
                                    onChange={(event) => updateField('password', event.target.value)}
                                    minLength={6}
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label htmlFor="passwordConfirm">Şifre Tekrar</label>
                                <input
                                    id="passwordConfirm"
                                    type="password"
                                    className="input-field"
                                    placeholder="Şifreni tekrar gir"
                                    value={form.passwordConfirm}
                                    onChange={(event) => updateField('passwordConfirm', event.target.value)}
                                    minLength={6}
                                    required
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary login-btn" disabled={isLoading}>
                            {isLoading ? 'Hesap Oluşturuluyor...' : 'Hesap Oluştur ve Giriş Yap'}
                        </button>

                        {error && <p className="auth-error">{error}</p>}
                    </form>

                    <div className="register-link">
                        Zaten hesabın var mı? <Link to="/login">Giriş yap</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Register;
