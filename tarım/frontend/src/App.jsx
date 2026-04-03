import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PlanWizard from './pages/PlanWizard';
import AiRecommendations from './pages/AiRecommendations';
import ClimateMarket from './pages/ClimateMarket';
import Profile from './pages/Profile';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        
        {/* Protected Routes enclosed in Layout */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="plan-wizard" element={<PlanWizard />} />
          <Route path="ai-recommendations" element={<AiRecommendations />} />
          <Route path="climate-market" element={<ClimateMarket />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
