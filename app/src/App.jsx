import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
};

import Dashboard from './pages/Dashboard';
import Categories from './pages/Categories';
import Transactions from './pages/Transactions';
import Budgets from './pages/Budgets';
import FixedDebts from './pages/FixedDebts';
import Profile from './pages/Profile';
import Stats from './pages/Stats';
import Settings from './pages/Settings';

const MainLayout = ({ children }) => {
  return (
    <div className="layout-container">
      <Sidebar />
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
};

const AppRoutes = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen text-gradient">
        <h1>RootCash</h1>
        <p>Cargando tu entorno...</p>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={<ProtectedRoute><MainLayout><Dashboard /></MainLayout></ProtectedRoute>} />
      <Route path="/categorias" element={<ProtectedRoute><MainLayout><Categories /></MainLayout></ProtectedRoute>} />
      <Route path="/movimientos" element={<ProtectedRoute><MainLayout><Transactions /></MainLayout></ProtectedRoute>} />
      <Route path="/presupuestos" element={<ProtectedRoute><MainLayout><Budgets /></MainLayout></ProtectedRoute>} />
      <Route path="/deudas" element={<ProtectedRoute><MainLayout><FixedDebts /></MainLayout></ProtectedRoute>} />
      <Route path="/perfil" element={<ProtectedRoute><MainLayout><Profile /></MainLayout></ProtectedRoute>} />
      <Route path="/estadisticas" element={<ProtectedRoute><MainLayout><Stats /></MainLayout></ProtectedRoute>} />
      <Route path="/configuracion" element={<ProtectedRoute><MainLayout><Settings /></MainLayout></ProtectedRoute>} />
      {/* Añadiremos las otras rutas en breve */}
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
