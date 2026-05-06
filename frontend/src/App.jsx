import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminProtectedRoute from './components/AdminProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { AdminAuthProvider } from './context/AdminAuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PlanWizard from './pages/PlanWizard';
import AiRecommendations from './pages/AiRecommendations';
import ClimateMarket from './pages/ClimateMarket';
import RegionalAnalysis from './pages/RegionalAnalysis';
import Profile from './pages/Profile';

const pageTitles = {
  '/': 'TarimZeka',
  '/login': 'Giriş | TarimZeka',
  '/admin/login': 'Yönetici Girişi | TarimZeka',
  '/admin': 'Yönetici Paneli | TarimZeka',
  '/register': 'Kayıt Ol | TarimZeka',
  '/dashboard': 'Ana Sayfa | TarimZeka',
  '/plan-wizard': 'Yeni Üretim Planı | TarimZeka',
  '/regional-analysis': 'Bölgesel Analiz | TarimZeka',
  '/ai-recommendations': 'Yapay Zeka Önerileri | TarimZeka',
  '/climate-market': 'İklim ve Risk Raporları | TarimZeka',
  '/profile': 'Profil | TarimZeka',
};

const PageTitle = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = pageTitles[pathname] || 'TarimZeka';
  }, [pathname]);

  return null;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AdminAuthProvider>
          <Router>
            <PageTitle />
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={(
                  <AdminProtectedRoute>
                    <AdminDashboard />
                  </AdminProtectedRoute>
                )}
              />
              <Route path="/register" element={<Register />} />
              <Route
                path="/"
                element={(
                  <ProtectedRoute>
                    <Layout />
                  </ProtectedRoute>
                )}
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />
                <Route path="plan-wizard" element={<PlanWizard />} />
                <Route path="regional-analysis" element={<RegionalAnalysis />} />
                <Route path="ai-recommendations" element={<AiRecommendations />} />
                <Route path="climate-market" element={<ClimateMarket />} />
                <Route path="profile" element={<Profile />} />
              </Route>
            </Routes>
          </Router>
        </AdminAuthProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
