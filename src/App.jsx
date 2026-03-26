import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { CartProvider } from './context/CartContext';
import AppShell from './components/layout/AppShell';
import ProtectedRoute from './components/layout/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import FoodDrinkPage from './pages/FoodDrinkPage';
import BillPage from './pages/BillPage';
import SettingPage from './pages/SettingPage';

const AppRoutes = () => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--md-surface)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 border-3 border-[var(--md-primary)] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[var(--md-on-surface-variant)]">Đang tải...</span>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={isAdmin ? '/dashboard' : '/menu'} replace /> : <LoginPage />}
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute adminOnly>
            <AppShell><DashboardPage /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/menu"
        element={
          <ProtectedRoute>
            <AppShell><FoodDrinkPage /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/bills"
        element={
          <ProtectedRoute>
            <AppShell><BillPage /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute adminOnly>
            <AppShell><SettingPage /></AppShell>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to={user ? (isAdmin ? '/dashboard' : '/menu') : '/login'} replace />} />
    </Routes>
  );
};

const App = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CartProvider>
            <AppRoutes />
          </CartProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
