const FAB = ({ icon: Icon, onClick, label, size = 'default', className = '', badge, color = 'primary' }) => {
  const sizes = {
    small: 'w-10 h-10',
    default: 'w-14 h-14',
    large: 'w-24 h-14 rounded-[var(--md-radius-lg)] gap-2 px-4',
  };

  const colors = {
    primary: 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] hover:elevation-2',
    secondary: 'bg-[var(--md-secondary-container)] text-[var(--md-on-secondary-container)] hover:elevation-2',
    tertiary: 'bg-[var(--md-tertiary-container)] text-[var(--md-on-tertiary-container)] hover:elevation-2',
    surface: 'bg-[var(--md-surface-container-high)] text-[var(--md-primary)] hover:elevation-2',
  };

  const isExtended = size === 'large' && label;

  return (
    <button
      onClick={onClick}
      className={`
        relative inline-flex items-center justify-center
        rounded-[var(--md-radius-lg)] elevation-1
        transition-all duration-200 active:scale-95
        ${sizes[size]} ${colors[color]}
        ${className}
      `}
    >
      {Icon && <Icon size={size === 'small' ? 18 : 22} />}
      {isExtended && <span className="font-medium text-sm">{label}</span>}
      {badge > 0 && <span className="cart-badge">{badge}</span>}
    </button>
  );
};

export default FAB;
