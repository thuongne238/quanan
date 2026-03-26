import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const Modal = ({ open, onClose, title, children, size = 'md' }) => {
  const sheetRef = useRef(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
      setDragY(0);
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const isSheet = size === 'sheet';

  // Use pointer events instead of touch - works on both mobile & desktop
  const onPointerDown = useCallback((e) => {
    if (!isSheet) return;
    startY.current = e.clientY;
    currentY.current = 0;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [isSheet]);

  const onPointerMove = useCallback((e) => {
    if (!isDragging || !isSheet) return;
    const diff = e.clientY - startY.current;
    if (diff > 0) {
      currentY.current = diff;
      setDragY(diff);
    }
  }, [isDragging, isSheet]);

  const onPointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (currentY.current > 100) {
      // Animate out then close
      setDragY(window.innerHeight);
      setTimeout(() => {
        onClose();
        setDragY(0);
      }, 200);
    } else {
      setDragY(0);
    }
  }, [isDragging, onClose]);

  if (!open) return null;

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    full: 'max-w-full mx-2',
    sheet: 'max-w-full w-full rounded-t-[var(--md-radius-xl)] rounded-b-none fixed bottom-0 left-0 max-h-[85vh]',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      onClick={onClose}
    >
      {/* Scrim */}
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        style={{ opacity: isSheet && dragY > 0 ? Math.max(0, 1 - dragY / 400) : 1 }}
      />

      {/* Content */}
      <div
        ref={sheetRef}
        className={`
          relative z-10 bg-[var(--md-surface-container)]
          ${isSheet ? '' : 'rounded-[var(--md-radius-xl)]'}
          ${sizes[size]} w-full overflow-hidden
        `}
        style={{
          animation: isSheet ? 'slideUp 0.3s cubic-bezier(0.2, 0, 0, 1)' : 'scaleIn 0.25s ease-out',
          transform: isSheet && dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)',
          borderRadius: isSheet ? 'var(--md-radius-xl) var(--md-radius-xl) 0 0' : undefined,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle - ONLY this area triggers swipe */}
        {isSheet && (
          <div
            className="flex justify-center pt-3 pb-2 cursor-grab active:cursor-grabbing touch-none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            style={{ touchAction: 'none' }}
          >
            <div className={`w-10 h-1.5 rounded-full transition-colors ${isDragging ? 'bg-[var(--md-primary)]' : 'bg-[var(--md-outline-variant)]'}`} />
          </div>
        )}

        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-3">
            <h2 className="text-lg font-semibold text-[var(--md-on-surface)]">{title}</h2>
            <button
              onClick={onClose}
              className="p-2 rounded-full hover:bg-[var(--md-surface-container-highest)] transition-colors"
            >
              <X size={20} className="text-[var(--md-on-surface-variant)]" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className={`px-5 overflow-y-auto ${isSheet ? 'max-h-[70vh] pb-24' : 'max-h-[60vh] pb-5'}`}>
          {children}
        </div>
      </div>
    </div>,
    document.getElementById('portal-root') || document.body
  );
};

export default Modal;
