import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Coffee, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const LoginPage = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const saved = localStorage.getItem('pos-saved-login');
    if (saved) {
      try {
        const { email: savedEmail, password: savedPw } = JSON.parse(saved);
        setEmail(savedEmail || '');
        setPassword(savedPw || '');
        setRememberMe(true);
      } catch { }
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (rememberMe) {
        localStorage.setItem('pos-saved-login', JSON.stringify({ email, password }));
      } else {
        localStorage.removeItem('pos-saved-login');
      }

      const user = await login(email, password);
      // Chuyển hướng dựa trên vai trò
      navigate(user.role === 'admin' ? '/dashboard' : '/menu', { replace: true });
    } catch (err) {
      setError(err.code === 'auth/invalid-credential'
        ? 'Email hoặc mật khẩu không đúng'
        : 'Đã có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--md-surface)] relative overflow-hidden">
      {/* Hiệu ứng nền Blur nghệ thuật */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[30%] bg-[var(--md-primary-container)] blur-[100px] opacity-40 rounded-full" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[30%] bg-[var(--md-secondary-container)] blur-[100px] opacity-40 rounded-full" />

      <div className="w-full max-w-sm z-10 animate-fade-in">
        {/* Header Brand */}
        <div className="text-center mb-10">
          <div className="inline-flex p-4 rounded-[2rem] bg-[var(--md-primary)] text-white shadow-2xl shadow-[var(--md-primary)]/30 mb-6">
            <Coffee size={40} strokeWidth={2.5} />
          </div>
          <h1 className="text-3xl font-black text-[var(--md-on-surface)] tracking-tight">Pos công thương</h1>
          <p className="text-xs font-bold text-[var(--md-primary)] uppercase tracking-[0.2em] mt-2 opacity-70">Hệ thống quản lý bán hàng</p>
        </div>

        {/* Login Card */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-4 rounded-2xl bg-red-50 border border-red-100 text-red-600 text-xs font-bold flex items-center gap-2 animate-shake">
              <ShieldCheck size={16} /> {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="text-[10px] font-black text-[var(--md-on-surface-variant)] uppercase ml-2 tracking-widest">Tài khoản Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              placeholder="name@example.com"
              className="w-full h-14 px-5 rounded-2xl bg-[var(--md-surface-container-high)] border-2 border-transparent focus:border-[var(--md-primary)] focus:bg-[var(--md-surface)] outline-none transition-all font-medium text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-[var(--md-on-surface-variant)] uppercase ml-2 tracking-widest">Mật khẩu</label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                className="w-full h-14 px-5 pr-14 rounded-2xl bg-[var(--md-surface-container-high)] border-2 border-transparent focus:border-[var(--md-primary)] focus:bg-[var(--md-surface)] outline-none transition-all font-medium text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-[var(--md-on-surface-variant)] active:scale-90 transition-transform"
              >
                {showPw ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* Remember & Forgot */}
          <div className="flex items-center justify-between px-2 pt-1">
            <label className="flex items-center gap-2 cursor-pointer group">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={() => setRememberMe(!rememberMe)}
                className="hidden"
              />
              <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${rememberMe ? 'bg-[var(--md-primary)] border-[var(--md-primary)]' : 'border-[var(--md-outline)]'}`}>
                {rememberMe && <div className="w-2 h-2 bg-white rounded-full" />}
              </div>
              <span className="text-xs font-bold text-[var(--md-on-surface-variant)]">Ghi nhớ tôi</span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 mt-4 bg-[var(--md-primary)] text-white rounded-2xl font-black text-sm shadow-xl shadow-[var(--md-primary)]/20 flex items-center justify-center gap-3 active:scale-[0.97] transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={20} />
                ĐĂNG NHẬP NGAY
              </>
            )}
          </button>
        </form>

        <p className="text-center mt-10 text-[10px] font-bold text-[var(--md-on-surface-variant)] uppercase tracking-[0.2em] opacity-40">
          <div>
            © 2026 POS Công Thương

          </div>
          <div>
            Version 1.2
          </div>
        </p>

      </div>
    </div>
  );
};

export default LoginPage;