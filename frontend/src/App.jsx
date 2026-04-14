import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import PlanWizard from './pages/PlanWizard';
import AiRecommendations from './pages/AiRecommendations';
import ClimateMarket from './pages/ClimateMarket';
import RegionalAnalysis from './pages/RegionalAnalysis';
import Profile from './pages/Profile';

const pageTitles = {
  '/': 'TarımZeka',
  '/login': 'Giriş | TarımZeka',
  '/register': 'Kayıt Ol | TarımZeka',
  '/dashboard': 'Ana Sayfa | TarımZeka',
  '/plan-wizard': 'Yeni Üretim Planı | TarımZeka',
  '/regional-analysis': 'Bölgesel Analiz | TarımZeka',
  '/ai-recommendations': 'Yapay Zeka Önerileri | TarımZeka',
  '/climate-market': 'İklim ve Risk Raporları | TarımZeka',
  '/profile': 'Profil | TarımZeka',
};

const PageTitle = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    document.title = pageTitles[pathname] || 'TarımZeka';
  }, [pathname]);

  return null;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <PageTitle />
          <Routes>
            <Route path="/login" element={<Login />} />
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
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
