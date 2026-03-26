import { forwardRef } from 'react';

const Card = forwardRef(({ children, variant = 'elevated', className = '', onClick, ...props }, ref) => {
  const base = 'rounded-[var(--md-radius-md)] transition-all duration-200';

  const variants = {
    elevated: `bg-[var(--md-surface-container-low)] elevation-1 hover:elevation-2`,
    outlined: `bg-[var(--md-surface)] border border-[var(--md-outline-variant)]`,
    filled: `bg-[var(--md-surface-container-highest)]`,
  };

  return (
    <div
      ref={ref}
      className={`${base} ${variants[variant]} ${onClick ? 'cursor-pointer active:scale-[0.98]' : ''} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';
export default Card;
