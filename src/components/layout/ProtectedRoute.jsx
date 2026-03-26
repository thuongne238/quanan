import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--md-surface)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-[var(--md-primary)] border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-[var(--md-on-surface-variant)]">Đang tải...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/menu" replace />;
  }

  return children;
};

export default ProtectedRoute;
