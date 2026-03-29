import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import LoadingScreen from './components/ui/LoadingScreen';
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

const AuthLayout = () => {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
};

const AppRoutes = () => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to={isAdmin ? '/dashboard' : '/menu'} replace /> : <LoginPage />}
      />

      <Route element={<AuthLayout />}>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute adminOnly>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/menu"
          element={
            <ProtectedRoute>
              <FoodDrinkPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/bills"
          element={
            <ProtectedRoute>
              <BillPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute adminOnly>
              <SettingPage />
            </ProtectedRoute>
          }
        />
      </Route>
      
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
