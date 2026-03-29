import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

import LoadingScreen from '../ui/LoadingScreen';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading, isAdmin } = useAuth();

  if (loading) {
    return <LoadingScreen />;
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
