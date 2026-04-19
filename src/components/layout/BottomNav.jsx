import { useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, UtensilsCrossed, Receipt, Settings, LayoutGrid } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const tabs = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
  { path: '/menu', label: 'Thực đơn', icon: UtensilsCrossed },
  { path: '/tables', label: 'Bàn', icon: LayoutGrid },
  { path: '/bills', label: 'Hóa đơn', icon: Receipt },
  { path: '/settings', label: 'Cài đặt', icon: Settings },
];

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);

  return (
    <nav className="
      fixed bottom-0 left-0 right-0 z-40
      safe-bottom
      bg-[var(--md-surface-container)] elevation-2
      border-t border-[var(--md-surface-container-highest)]
    ">
      <div className="flex items-center justify-around h-20 max-w-lg mx-auto px-2">
        {visibleTabs.map((tab) => {
          const active = location.pathname === tab.path;
          const Icon = tab.icon;
          return (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className="
                flex flex-col items-center justify-center gap-1
                min-w-[56px] py-1 transition-all duration-200
                group relative
              "
            >
              {/* Pill indicator */}
              <div className={`
                relative flex items-center justify-center
                w-14 h-8 rounded-full transition-all duration-300
                ${active
                  ? 'bg-[var(--md-secondary-container)]'
                  : 'bg-transparent group-hover:bg-[var(--md-surface-container-highest)]'
                }
              `}>
                <Icon
                  size={22}
                  className={`transition-colors duration-200 ${
                    active
                      ? 'text-[var(--md-on-secondary-container)]'
                      : 'text-[var(--md-on-surface-variant)]'
                  }`}
                  strokeWidth={active ? 2.5 : 2}
                />
              </div>
              <span className={`
                text-[10px] font-medium transition-colors duration-200
                ${active ? 'text-[var(--md-on-surface)]' : 'text-[var(--md-on-surface-variant)]'}
              `}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
