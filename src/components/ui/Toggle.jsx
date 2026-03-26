const Toggle = ({ checked, onChange, label, description }) => {
  return (
    <label className="flex items-center justify-between cursor-pointer py-2 group">
      <div className="flex-1 mr-4">
        {label && (
          <span className="text-sm font-medium text-[var(--md-on-surface)] block">
            {label}
          </span>
        )}
        {description && (
          <span className="text-xs text-[var(--md-on-surface-variant)] block mt-0.5">
            {description}
          </span>
        )}
      </div>
      <button
        role="switch"
        type="button"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`
          relative inline-flex h-8 w-[52px] shrink-0 items-center
          rounded-full transition-colors duration-300 focus:outline-none
          ${checked
            ? 'bg-[var(--md-primary)]'
            : 'bg-[var(--md-surface-container-highest)] border-2 border-[var(--md-outline)]'
          }
        `}
      >
        <span
          className={`
            inline-block rounded-full transition-all duration-300 shadow-sm
            ${checked
              ? 'h-6 w-6 translate-x-[26px] bg-[var(--md-on-primary)]'
              : 'h-4 w-4 translate-x-[6px] bg-[var(--md-outline)]'
            }
          `}
        />
      </button>
    </label>
  );
};

export default Toggle;
