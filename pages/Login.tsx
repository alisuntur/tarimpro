import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { UserRole } from '../types';
import { Sprout, Lock, User, CheckSquare } from 'lucide-react';

interface LoginProps {
  onLogin: (role: UserRole) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [email, setEmail] = useState('ciftci@ornek.com');
  const [password, setPassword] = useState('password');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Simple mock validation for prototype
    if (email.includes('admin')) {
      onLogin(UserRole.RESEARCHER);
    } else {
      onLogin(UserRole.FARMER);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-500 to-teal-700 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
        <div className="p-8 bg-emerald-50 border-b border-emerald-100 text-center">
            <div className="mx-auto bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mb-4 text-emerald-600">
                <Sprout size={32} />
            </div>
            <h2 className="text-2xl font-bold text-emerald-900">TarımPro'ya Giriş</h2>
            <p className="text-emerald-700 mt-2 text-sm">Geleceğin tarımını bugünden planlayın.</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">E-posta veya Kullanıcı Adı</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-slate-400" size={20} />
              <input 
                type="text" 
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="ciftci@ornek.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Şifre</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-slate-400" size={20} />
              <input 
                type="password" 
                className="w-full border border-slate-300 rounded-lg pl-10 pr-4 py-2.5 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <label className="flex items-center gap-2 cursor-pointer text-slate-600 hover:text-emerald-600">
                <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500" />
                <span>Beni Hatırla</span>
            </label>
            <a href="#" className="text-emerald-600 font-medium hover:underline">Şifremi Unuttum?</a>
          </div>

          <button 
            type="submit" 
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-lg shadow-lg shadow-emerald-600/20 transition-transform active:scale-[0.98]"
          >
            Giriş Yap
          </button>
        </form>

        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center text-sm text-slate-600">
          Hesabınız yok mu? <Link to="/register" className="text-emerald-600 font-bold hover:underline">Kayıt Olun</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;