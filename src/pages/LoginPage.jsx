import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, Coffee } from 'lucide-react';
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

  // Load saved credentials on mount
  useEffect(() => {
    const saved = localStorage.getItem('pos-saved-login');
    if (saved) {
      try {
        const { email: savedEmail, password: savedPw } = JSON.parse(saved);
        setEmail(savedEmail || '');
        setPassword(savedPw || '');
        setRememberMe(true);
      } catch {}
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      // Save or clear credentials
      if (rememberMe) {
        localStorage.setItem('pos-saved-login', JSON.stringify({ email, password }));
      } else {
        localStorage.removeItem('pos-saved-login');
      }

      const user = await login(email, password);
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
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--md-surface)]">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-64 h-64 rounded-full bg-[var(--md-primary-container)] opacity-30 blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-64 h-64 rounded-full bg-[var(--md-tertiary-container)] opacity-30 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm animate-scale-in">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-[var(--md-radius-xl)] bg-[var(--md-primary-container)] flex items-center justify-center mb-4 elevation-1">
            <Coffee size={28} className="text-[var(--md-on-primary-container)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--md-on-surface)]">POS Takeaway</h1>
          <p className="text-sm text-[var(--md-on-surface-variant)] mt-1">Đăng nhập để tiếp tục</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="glass rounded-[var(--md-radius-xl)] p-6 space-y-5 elevation-1">
          {error && (
            <div className="px-4 py-3 rounded-[var(--md-radius-md)] bg-[var(--md-error)]/10 text-[var(--md-error)] text-sm animate-slide-down">
              {error}
            </div>
          )}

          {/* Email */}
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1.5 ml-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="
                w-full h-12 px-4 rounded-[var(--md-radius-md)]
                bg-[var(--md-surface-container-highest)]
                text-[var(--md-on-surface)] text-sm
                border border-transparent
                focus:border-[var(--md-primary)] focus:outline-none
                transition-colors placeholder:text-[var(--md-on-surface-variant)]/50
              "
              placeholder="your@email.com"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1.5 ml-1">
              Mật khẩu
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="
                  w-full h-12 px-4 pr-12 rounded-[var(--md-radius-md)]
                  bg-[var(--md-surface-container-highest)]
                  text-[var(--md-on-surface)] text-sm
                  border border-transparent
                  focus:border-[var(--md-primary)] focus:outline-none
                  transition-colors placeholder:text-[var(--md-on-surface-variant)]/50
                "
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--md-on-surface-variant)]"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Remember me */}
          <label className="flex items-center gap-3 cursor-pointer py-1 select-none">
            <button
              type="button"
              onClick={() => setRememberMe(!rememberMe)}
              className={`
                w-5 h-5 rounded-[4px] border-2 flex items-center justify-center
                transition-all duration-200
                ${rememberMe
                  ? 'bg-[var(--md-primary)] border-[var(--md-primary)]'
                  : 'bg-transparent border-[var(--md-outline)]'
                }
              `}
            >
              {rememberMe && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M2 6L5 9L10 3" stroke="var(--md-on-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
            <span className="text-sm text-[var(--md-on-surface-variant)]">Lưu đăng nhập</span>
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="
              w-full h-12 rounded-[var(--md-radius-xl)]
              bg-[var(--md-primary)] text-[var(--md-on-primary)]
              font-semibold text-sm
              transition-all duration-200 active:scale-[0.98]
              disabled:opacity-60 disabled:cursor-not-allowed
              elevation-1 hover:elevation-2
              flex items-center justify-center gap-2
            "
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-[var(--md-on-primary)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <LogIn size={18} />
                Đăng nhập
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
