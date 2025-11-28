import React from 'react';
import { 
  LayoutDashboard, 
  Sprout, 
  LineChart, 
  Scale, 
  CloudRain, 
  Database, 
  FileText, 
  Settings, 
  HelpCircle,
  LogOut
} from 'lucide-react';

interface SidebarProps {
  activePage: string;
  setActivePage: (page: string) => void;
  userRole: string;
  onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, setActivePage, userRole, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Ana Panel', icon: LayoutDashboard },
    { id: 'planning', label: 'Ürün Planlama', icon: Sprout },
    { id: 'models', label: 'Tahmin Modelleri', icon: LineChart },
    { id: 'supply-demand', label: 'Arz-Talep Analizi', icon: Scale },
    { id: 'climate', label: 'İklim Risk Haritası', icon: CloudRain },
    { id: 'reports', label: 'Raporlama', icon: FileText },
  ];

  // Add Data Management only for Researchers/Admins
  if (userRole === 'RESEARCHER') {
    menuItems.splice(5, 0, { id: 'data-mgmt', label: 'Veri Yönetimi', icon: Database });
  }

  const bottomItems = [
    { id: 'settings', label: 'Ayarlar', icon: Settings },
    { id: 'help', label: 'Yardım', icon: HelpCircle },
  ];

  return (
    <div className="w-64 bg-slate-900 text-white h-screen flex flex-col fixed left-0 top-0 shadow-xl z-50">
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-2 text-emerald-400 font-bold text-2xl">
          <Sprout size={28} />
          <span>TarımPro</span>
        </div>
        <p className="text-slate-400 text-xs mt-2 ml-1 uppercase tracking-wider font-semibold">
          {userRole === 'RESEARCHER' ? 'Yönetici Paneli' : 'Çiftçi Portalı'}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <nav className="px-4 space-y-1">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                activePage === item.id 
                  ? 'bg-emerald-600 text-white shadow-md' 
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-700">
        <div className="space-y-1 mb-4">
          {bottomItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2 rounded-lg transition-colors ${
                activePage === item.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              <item.icon size={18} />
              <span className="text-sm">{item.label}</span>
            </button>
          ))}
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center gap-2 px-4 py-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors text-sm font-medium"
        >
          <LogOut size={18} />
          <span>Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;