import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import ProductPlanning from './pages/ProductPlanning';
import SupplyDemand from './pages/SupplyDemand';
import Login from './pages/Login';
import Register from './pages/Register';
import Settings from './pages/Settings';
import Support from './pages/Support';
import { UserRole } from './types';

const App: React.FC = () => {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [activePage, setActivePage] = useState('dashboard');

  const handleLogin = (role: UserRole) => {
    setUserRole(role);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setUserRole(null);
    setActivePage('dashboard');
  };

  // Layout for Authenticated User
  const AuthenticatedLayout = () => (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors duration-300">
      <Sidebar
        activePage={activePage}
        setActivePage={setActivePage}
        userRole={userRole || UserRole.FARMER}
        onLogout={handleLogout}
      />
      <main className="ml-64 flex-1 p-8">
        <div className="max-w-7xl mx-auto">
          {activePage === 'dashboard' && <Dashboard />}
          {activePage === 'planning' && <ProductPlanning />}
          {activePage === 'supply-demand' && <SupplyDemand />}
          {/* Placeholders for other modules to keep the code concise but routing functional */}
          {activePage === 'models' && <div className="p-12 text-center text-slate-400 dark:text-slate-500 font-medium text-lg">Tahmin Modelleri Modülü (Yapım Aşamasında)</div>}
          {activePage === 'climate' && <div className="p-12 text-center text-slate-400 dark:text-slate-500 font-medium text-lg">İklim Risk Haritası (Yapım Aşamasında)</div>}
          {activePage === 'reports' && <div className="p-12 text-center text-slate-400 dark:text-slate-500 font-medium text-lg">Raporlama Modülü (Yapım Aşamasında)</div>}
          {activePage === 'settings' && <Settings />}
          {activePage === 'help' && <Support />}
        </div>
      </main>
    </div>
  );

  return (
    <Router>
      <Routes>
        <Route path="/login" element={!isLoggedIn ? <Login onLogin={handleLogin} /> : <Navigate to="/" />} />
        <Route path="/register" element={!isLoggedIn ? <Register onLogin={handleLogin} /> : <Navigate to="/" />} />
        <Route
          path="/"
          element={isLoggedIn ? <AuthenticatedLayout /> : <Navigate to="/login" />}
        />
      </Routes>
    </Router>
  );
};

export default App;