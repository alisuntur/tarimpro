import React, { useState } from 'react';
import { User, Bell, Shield, Moon, Save, Lock, Smartphone, Mail, Eye, EyeOff } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

type Tab = 'profile' | 'notifications' | 'security' | 'appearance';

const Settings: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('profile');
    const { theme, setTheme, fontSize, setFontSize } = useTheme();

    // Profile State
    const [profile, setProfile] = useState({
        name: 'Ahmet',
        surname: 'Yılmaz',
        email: 'ahmet.yilmaz@example.com',
        phone: '+90 555 123 45 67',
        bio: 'Çiftçi ve Ziraat Mühendisi'
    });

    // Security State
    const [showPassword, setShowPassword] = useState(false);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        e.target.select();
    };

    const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'profile':
                return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 animate-fadeIn">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                            <User className="text-emerald-600" size={24} />
                            Profil Bilgileri
                        </h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ad</label>
                                    <input
                                        type="text"
                                        name="name"
                                        value={profile.name}
                                        onChange={handleProfileChange}
                                        onFocus={handleFocus}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-slate-700 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Soyad</label>
                                    <input
                                        type="text"
                                        name="surname"
                                        value={profile.surname}
                                        onChange={handleProfileChange}
                                        onFocus={handleFocus}
                                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-slate-700 dark:text-white"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">E-posta Adresi</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={profile.email}
                                    onChange={handleProfileChange}
                                    onFocus={handleFocus}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-slate-700 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Telefon Numarası</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={profile.phone}
                                    onChange={handleProfileChange}
                                    onFocus={handleFocus}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-slate-700 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Biyografi</label>
                                <textarea
                                    name="bio"
                                    rows={3}
                                    value={profile.bio}
                                    onChange={handleProfileChange}
                                    onFocus={handleFocus}
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all bg-white dark:bg-slate-700 dark:text-white"
                                ></textarea>
                            </div>
                        </div>
                    </div>
                );

            case 'notifications':
                return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 animate-fadeIn">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                            <Bell className="text-emerald-600" size={24} />
                            Bildirim Tercihleri
                        </h2>
                        <div className="space-y-6">
                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">İletişim Kanalları</h3>
                                <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
                                            <Mail size={20} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-white">E-posta Bildirimleri</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Haftalık raporlar ve bültenler</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" defaultChecked />
                                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                </div>
                                <div className="flex items-center justify-between py-3 border-b border-slate-100 dark:border-slate-700">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
                                            <Smartphone size={20} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-slate-800 dark:text-white">SMS Bildirimleri</p>
                                            <p className="text-sm text-slate-500 dark:text-slate-400">Acil durum ve güvenlik uyarıları</p>
                                        </div>
                                    </div>
                                    <label className="relative inline-flex items-center cursor-pointer">
                                        <input type="checkbox" className="sr-only peer" />
                                        <div className="w-11 h-6 bg-slate-200 dark:bg-slate-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 dark:peer-focus:ring-emerald-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                    </label>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bildirim Türleri</h3>
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-slate-700 dark:text-slate-300">Piyasa Fiyat Değişimleri</span>
                                    <input type="checkbox" className="accent-emerald-600 w-4 h-4" defaultChecked />
                                </div>
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-slate-700 dark:text-slate-300">Hava Durumu Uyarıları</span>
                                    <input type="checkbox" className="accent-emerald-600 w-4 h-4" defaultChecked />
                                </div>
                                <div className="flex items-center justify-between py-2">
                                    <span className="text-slate-700 dark:text-slate-300">Kampanya ve Duyurular</span>
                                    <input type="checkbox" className="accent-emerald-600 w-4 h-4" />
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'security':
                return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 animate-fadeIn">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                            <Shield className="text-emerald-600" size={24} />
                            Güvenlik Ayarları
                        </h2>

                        <div className="space-y-8">
                            <div>
                                <h3 className="text-md font-medium text-slate-800 dark:text-white mb-4">Şifre Değiştir</h3>
                                <div className="space-y-4 max-w-md">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Mevcut Şifre</label>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? "text" : "password"}
                                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white dark:bg-slate-700 dark:text-white"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                            >
                                                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                            </button>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Yeni Şifre</label>
                                        <input
                                            type="password"
                                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white dark:bg-slate-700 dark:text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Yeni Şifre (Tekrar)</label>
                                        <input
                                            type="password"
                                            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none bg-white dark:bg-slate-700 dark:text-white"
                                        />
                                    </div>
                                    <button className="text-emerald-600 font-medium text-sm hover:text-emerald-700">Şifremi Unuttum?</button>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                                <h3 className="text-md font-medium text-slate-800 dark:text-white mb-4">İki Faktörlü Doğrulama (2FA)</h3>
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-slate-600 dark:text-slate-400 text-sm mb-1">Hesabınızı ekstra güvenli hale getirin.</p>
                                        <p className="text-slate-400 dark:text-slate-500 text-xs">Giriş yaparken telefonunuza kod gönderilir.</p>
                                    </div>
                                    <button className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium">
                                        Kurulum Yap
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );

            case 'appearance':
                return (
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 animate-fadeIn">
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                            <Moon className="text-emerald-600" size={24} />
                            Görünüm Ayarları
                        </h2>

                        <div className="space-y-6">
                            <div>
                                <h3 className="text-md font-medium text-slate-800 dark:text-white mb-4">Tema</h3>
                                <div className="grid grid-cols-3 gap-4">
                                    <button
                                        onClick={() => setTheme('light')}
                                        className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${theme === 'light' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600 bg-white dark:bg-slate-700'}`}
                                    >
                                        <div className="w-full h-20 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center justify-center">
                                            <span className="text-2xl">☀️</span>
                                        </div>
                                        <span className={`font-medium ${theme === 'light' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>Aydınlık</span>
                                    </button>
                                    <button
                                        onClick={() => setTheme('dark')}
                                        className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${theme === 'dark' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600 bg-white dark:bg-slate-700'}`}
                                    >
                                        <div className="w-full h-20 bg-slate-800 rounded-lg shadow-sm flex items-center justify-center">
                                            <span className="text-2xl">🌙</span>
                                        </div>
                                        <span className={`font-medium ${theme === 'dark' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>Karanlık</span>
                                    </button>
                                    <button
                                        onClick={() => setTheme('system')}
                                        className={`p-4 border-2 rounded-xl flex flex-col items-center gap-2 transition-all ${theme === 'system' ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' : 'border-transparent hover:border-slate-200 dark:hover:border-slate-600 bg-white dark:bg-slate-700'}`}
                                    >
                                        <div className="w-full h-20 bg-gradient-to-br from-white to-slate-800 rounded-lg shadow-sm flex items-center justify-center">
                                            <span className="text-2xl">⚙️</span>
                                        </div>
                                        <span className={`font-medium ${theme === 'system' ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-300'}`}>Sistem</span>
                                    </button>
                                </div>
                            </div>

                            <div className="pt-6 border-t border-slate-100 dark:border-slate-700">
                                <h3 className="text-md font-medium text-slate-800 dark:text-white mb-4">Yazı Boyutu</h3>
                                <div className="flex items-center gap-4">
                                    <span className="text-sm text-slate-500 dark:text-slate-400">A</span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="2"
                                        step="1"
                                        value={fontSize === 'small' ? 0 : fontSize === 'medium' ? 1 : 2}
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            if (val === 0) setFontSize('small');
                                            if (val === 1) setFontSize('medium');
                                            if (val === 2) setFontSize('large');
                                        }}
                                        className="w-full accent-emerald-600"
                                    />
                                    <span className="text-xl text-slate-500 dark:text-slate-400">A</span>
                                </div>
                                <div className="flex justify-between text-xs text-slate-400 mt-1 px-1">
                                    <span>Küçük</span>
                                    <span>Orta</span>
                                    <span>Büyük</span>
                                </div>
                            </div>
                        </div>
                    </div>
                );
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Ayarlar</h1>
                    <p className="text-slate-600 dark:text-slate-400">Hesap tercihlerinizi ve uygulama ayarlarınızı yönetin</p>
                </div>
                <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2 shadow-sm shadow-emerald-200 dark:shadow-none">
                    <Save size={20} />
                    <span>Değişiklikleri Kaydet</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Sidebar Navigation */}
                <div className="md:col-span-1">
                    <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden sticky top-6">
                        <nav className="flex flex-col">
                            <button
                                onClick={() => setActiveTab('profile')}
                                className={`flex items-center gap-3 px-4 py-3 transition-colors border-l-4 ${activeTab === 'profile' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-600 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-transparent'}`}
                            >
                                <User size={20} />
                                <span>Profil</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('notifications')}
                                className={`flex items-center gap-3 px-4 py-3 transition-colors border-l-4 ${activeTab === 'notifications' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-600 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-transparent'}`}
                            >
                                <Bell size={20} />
                                <span>Bildirimler</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('security')}
                                className={`flex items-center gap-3 px-4 py-3 transition-colors border-l-4 ${activeTab === 'security' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-600 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-transparent'}`}
                            >
                                <Shield size={20} />
                                <span>Güvenlik</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('appearance')}
                                className={`flex items-center gap-3 px-4 py-3 transition-colors border-l-4 ${activeTab === 'appearance' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border-emerald-600 font-medium' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 border-transparent'}`}
                            >
                                <Moon size={20} />
                                <span>Görünüm</span>
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="md:col-span-3">
                    {renderContent()}
                </div>
            </div>
        </div>
    );
};

export default Settings;
