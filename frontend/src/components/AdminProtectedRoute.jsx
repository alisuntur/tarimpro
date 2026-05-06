import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import '../pages/Admin.css';

const AdminProtectedRoute = ({ children }) => {
  const { loading, isAuthenticated } = useAdminAuth();

  if (loading) {
    return (
      <div className="admin-loading-state">
        <div className="admin-spinner"></div>
        <p>Yönetici oturumu doğrulanıyor...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  return children;
};

export default AdminProtectedRoute;
