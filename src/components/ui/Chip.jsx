const Chip = ({ label, selected, onClick, icon: Icon, variant = 'filter', className = '' }) => {
  const base = `
    inline-flex items-center gap-1.5 px-3 py-1.5
    rounded-[var(--md-radius-sm)] text-sm font-medium
    transition-all duration-200 cursor-pointer select-none
    active:scale-95 whitespace-nowrap
  `;

  const variants = {
    filter: selected
      ? 'bg-[var(--md-secondary-container)] text-[var(--md-on-secondary-container)] elevation-1'
      : 'bg-transparent border border-[var(--md-outline)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-highest)]',
    assist: 'bg-transparent border border-[var(--md-outline)] text-[var(--md-on-surface)] hover:bg-[var(--md-surface-container-highest)]',
    suggestion: 'bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface-variant)] hover:elevation-1',
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick}>
      {Icon && <Icon size={16} />}
      {label}
    </button>
  );
};

export default Chip;
