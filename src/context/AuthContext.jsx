import { createContext, useContext, useState, useEffect } from 'react';
import { onAuthChange, loginWithEmail, logout as fbLogout } from '../firebase/auth';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthChange((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const u = await loginWithEmail(email, password);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fbLogout();
    setUser(null);
  };

  const role = user?.role || 'staff';
  const isAdmin = role === 'admin';

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, role, isAdmin }}>
      {children}
    </AuthContext.Provider>
  );
};
