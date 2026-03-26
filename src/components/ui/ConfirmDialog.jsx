import { createPortal } from 'react-dom';
import { AlertCircle, Trash2, X } from 'lucide-react';

const ConfirmDialog = ({ open, title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', onConfirm, onClose, type = 'danger' }) => {
  if (!open) return null;

  const isDanger = type === 'danger';
  const Icon = isDanger ? Trash2 : AlertCircle;

  return createPortal(
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      {/* Scrim */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />

      {/* Content */}
      <div
        className="relative z-10 w-full max-w-sm bg-[var(--md-surface-container)] rounded-[var(--md-radius-xl)] overflow-hidden animate-scale-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className={`w-12 h-12 flex items-center justify-center rounded-full shrink-0 ${
              isDanger ? 'bg-[var(--md-error)]/10 text-[var(--md-error)]' : 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]'
            }`}>
              <Icon size={24} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[var(--md-on-surface)]">{title}</h3>
              <p className="text-sm text-[var(--md-on-surface-variant)] mt-1 leading-relaxed">
                {message}
              </p>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              onClick={onClose}
              className="flex-1 h-11 rounded-[var(--md-radius-xl)] font-semibold text-sm bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface)] transition-colors active:scale-95"
            >
              {cancelText}
            </button>
            <button
              onClick={() => {
                onConfirm();
                onClose();
              }}
              className={`flex-1 h-11 rounded-[var(--md-radius-xl)] font-semibold text-sm transition-all active:scale-95 text-[var(--md-on-primary)] ${
                isDanger ? 'bg-[var(--md-error)]' : 'bg-[var(--md-primary)]'
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.getElementById('portal-root') || document.body
  );
};

export default ConfirmDialog;
