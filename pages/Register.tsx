import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRole } from '../types';
import { Sprout, Tractor, Microscope } from 'lucide-react';

interface RegisterProps {
  onLogin: (role: UserRole) => void;
}

const Register: React.FC<RegisterProps> = ({ onLogin }) => {
  const [role, setRole] = useState<UserRole>(UserRole.FARMER);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin(role);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-700 p-4 py-8">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col my-4">
        <div className="p-6 bg-emerald-50 border-b border-emerald-100">
            <h2 className="text-2xl font-bold text-emerald-900 text-center">Yeni Hesap Oluştur</h2>
        </div>
        
        <div className="p-8">
            {/* Role Selection */}
            <p className="text-center text-slate-600 mb-4 font-medium">Kullanıcı türünü seçiniz:</p>
            <div className="grid grid-cols-2 gap-4 mb-8">
                <button 
                    type="button"
                    onClick={() => setRole(UserRole.FARMER)}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                        role === UserRole.FARMER 
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-700' 
                        : 'border-slate-200 text-slate-400 hover:border-emerald-200'
                    }`}
                >
                    <Tractor size={32} />
                    <span className="font-bold">Çiftçi</span>
                </button>
                <button 
                    type="button"
                    onClick={() => setRole(UserRole.RESEARCHER)}
                    className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${
                        role === UserRole.RESEARCHER 
                        ? 'border-blue-500 bg-blue-50 text-blue-700' 
                        : 'border-slate-200 text-slate-400 hover:border-blue-200'
                    }`}
                >
                    <Microscope size={32} />
                    <span className="font-bold">Araştırmacı</span>
                </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Ad</label>
                        <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none" required />
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Soyad</label>
                        <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none" required />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Telefon</label>
                    <input type="tel" className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none" required />
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">E-posta</label>
                    <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none" required />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">İl</label>
                        <select className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                            <option>Adana</option>
                            <option>Konya</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">İlçe</label>
                        <select className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none bg-white">
                            <option>Merkez</option>
                        </select>
                    </div>
                </div>

                {role === UserRole.FARMER && (
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Üretici Numarası (Opsiyonel)</label>
                        <input type="text" className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                )}

                <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Şifre Oluştur</label>
                    <input type="password" className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-emerald-500 outline-none" required />
                </div>

                <div className="pt-2 pb-4">
                    <label className="flex items-start gap-2 cursor-pointer text-slate-600 text-sm">
                        <input type="checkbox" className="mt-1 w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" required />
                        <span>KVKK ve Açık Rıza metnini okudum, onaylıyorum.</span>
                    </label>
                </div>

                <button 
                    type="submit" 
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 rounded-lg shadow-lg transition-all"
                >
                    Kayıt Ol
                </button>
            </form>
        </div>

        <div className="p-4 bg-slate-50 border-t border-slate-100 text-center text-sm text-slate-600">
          Zaten hesabınız var mı? <Link to="/login" className="text-emerald-600 font-bold hover:underline">Giriş Yap</Link>
        </div>
      </div>
    </div>
  );
};

export default Register;