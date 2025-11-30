import React from 'react';
import { User, Bell, Shield, Moon, Save } from 'lucide-react';

const Settings: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Ayarlar</h1>
                    <p className="text-slate-600">Hesap tercihlerinizi ve uygulama ayarlarınızı yönetin</p>
                </div>
                <button className="bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors flex items-center gap-2">
                    <Save size={20} />
                    <span>Değişiklikleri Kaydet</span>
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Sidebar Navigation for Settings (Visual only for now) */}
                <div className="md:col-span-1">
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                        <nav className="flex flex-col">
                            <button className="flex items-center gap-3 px-4 py-3 bg-emerald-50 text-emerald-700 border-l-4 border-emerald-600 font-medium">
                                <User size={20} />
                                <span>Profil Ayarları</span>
                            </button>
                            <button className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 transition-colors border-l-4 border-transparent">
                                <Bell size={20} />
                                <span>Bildirimler</span>
                            </button>
                            <button className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 transition-colors border-l-4 border-transparent">
                                <Shield size={20} />
                                <span>Güvenlik</span>
                            </button>
                            <button className="flex items-center gap-3 px-4 py-3 text-slate-600 hover:bg-slate-50 transition-colors border-l-4 border-transparent">
                                <Moon size={20} />
                                <span>Görünüm</span>
                            </button>
                        </nav>
                    </div>
                </div>

                {/* Main Content Area */}
                <div className="md:col-span-2 space-y-6">
                    {/* Profile Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                            <User className="text-emerald-600" size={24} />
                            Profil Bilgileri
                        </h2>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ad</label>
                                    <input
                                        type="text"
                                        defaultValue="Ahmet"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Soyad</label>
                                    <input
                                        type="text"
                                        defaultValue="Yılmaz"
                                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">E-posta Adresi</label>
                                <input
                                    type="email"
                                    defaultValue="ahmet.yilmaz@example.com"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Telefon Numarası</label>
                                <input
                                    type="tel"
                                    defaultValue="+90 555 123 45 67"
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Biyografi</label>
                                <textarea
                                    rows={3}
                                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                                    placeholder="Kendinizden kısaca bahsedin..."
                                ></textarea>
                            </div>
                        </div>
                    </div>

                    {/* Preferences Section */}
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">Tercihler</h2>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                <div>
                                    <p className="font-medium text-slate-800">E-posta Bildirimleri</p>
                                    <p className="text-sm text-slate-500">Önemli güncellemeler hakkında e-posta al</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" defaultChecked />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b border-slate-100">
                                <div>
                                    <p className="font-medium text-slate-800">SMS Bildirimleri</p>
                                    <p className="text-sm text-slate-500">Acil durumlar için SMS al</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Settings;
