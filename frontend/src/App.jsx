import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import Login from './components/Login';
import Register from './components/Register';
import UserDashboard from './components/UserDashboard';
import AddressManagement from './components/AddressManagement';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { token, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Redirect if already logged in
const AuthRoute = ({ children }) => {
  const { token, loading } = useAuth();

  if (loading) return null;
  
  if (token) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          
          <Route 
            path="/login" 
            element={
              <AuthRoute>
                <Login />
              </AuthRoute>
            } 
          />
          <Route 
            path="/register" 
            element={
              <AuthRoute>
                <Register />
              </AuthRoute>
            } 
          />
          
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <UserDashboard />
              </ProtectedRoute>
            }
          >
            {/* Child routes for dashboard outlet */}
            <Route path="addresses" element={<AddressManagement />} />
            {/* Placeholders for other routes */}
            <Route path="orders" element={<div>Orders Content Placeholder</div>} />
            <Route path="payments" element={<div>Payments Content Placeholder</div>} />
            <Route path="wishlist" element={<div>Wishlist Content Placeholder</div>} />
            <Route path="settings" element={<div>Settings Content Placeholder</div>} />
            <Route path="notifications" element={<div>Notifications Content Placeholder</div>} />
          </Route>
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
