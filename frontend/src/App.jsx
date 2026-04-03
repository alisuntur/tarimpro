import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PlanWizard from './pages/PlanWizard';
import AiRecommendations from './pages/AiRecommendations';
import ClimateMarket from './pages/ClimateMarket';
import RegionalAnalysis from './pages/RegionalAnalysis';
import Profile from './pages/Profile';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
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
  );
}

export default App;
