import { useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Minus, Plus, Trash2, X, ShoppingBag, Printer, ChevronDown } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { formatCurrency } from '../../utils/printer';

const CartDrawer = ({ open, onClose, onCheckout }) => {
  const { items, updateQty, removeItem, clearCart, cartTotal, cartCount } = useCart();
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const currentY = useRef(0);

  // Print toggle state
  const [printEnabled, setPrintEnabled] = useState(false);
  const [printType, setPrintType] = useState('cash'); // 'cash' | 'transfer'

  const onPointerDown = useCallback((e) => {
    startY.current = e.clientY;
    currentY.current = 0;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onPointerMove = useCallback((e) => {
    if (!isDragging) return;
    const diff = e.clientY - startY.current;
    if (diff > 0) {
      currentY.current = diff;
      setDragY(diff);
    }
  }, [isDragging]);

  const onPointerUp = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    if (currentY.current > 100) {
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

  return createPortal(
    <div
      className="fixed inset-0 z-[60]"
      style={{ animation: 'fadeIn 0.2s ease-out' }}
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-black/40 transition-opacity"
        style={{ opacity: dragY > 0 ? Math.max(0, 1 - dragY / 400) : 1 }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-[var(--md-surface-container)] overflow-hidden"
        style={{
          animation: 'slideUp 0.3s cubic-bezier(0.2, 0, 0, 1)',
          borderRadius: 'var(--md-radius-xl) var(--md-radius-xl) 0 0',
          transform: dragY > 0 ? `translateY(${dragY}px)` : undefined,
          transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.2, 0, 0, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Drag handle */}
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

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3">
          <div className="flex items-center gap-2">
            <ShoppingBag size={22} className="text-[var(--md-primary)]" />
            <h2 className="text-lg font-semibold text-[var(--md-on-surface)]">
              Giỏ hàng ({cartCount})
            </h2>
          </div>
          <div className="flex items-center gap-2">
            {items.length > 0 && (
              <button onClick={clearCart}
                className="text-xs text-[var(--md-error)] px-3 py-1.5 rounded-full hover:bg-[var(--md-error)]/10 transition-colors">
                Xóa tất cả
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-full hover:bg-[var(--md-surface-container-highest)] transition-colors">
              <X size={20} className="text-[var(--md-on-surface-variant)]" />
            </button>
          </div>
        </div>

        {/* Items */}
        <div className="px-5 overflow-y-auto max-h-[40vh]">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-[var(--md-on-surface-variant)]">
              <ShoppingBag size={48} strokeWidth={1.5} className="mb-3 opacity-40" />
              <p className="text-sm">Giỏ hàng trống</p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {items.map((item) => (
                <div key={item.id}
                  className="flex items-center gap-3 p-3 rounded-[var(--md-radius-md)] bg-[var(--md-surface-container-low)]">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--md-on-surface)] truncate">{item.name}</p>
                    <p className="text-xs text-[var(--md-primary)] font-semibold mt-0.5">{formatCurrency(item.price)}</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => updateQty(item.id, item.qty - 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface)] transition-colors hover:bg-[var(--md-primary-container)]">
                      {item.qty === 1 ? <Trash2 size={14} /> : <Minus size={14} />}
                    </button>
                    <span className="w-8 text-center text-sm font-semibold text-[var(--md-on-surface)]">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, item.qty + 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] transition-colors">
                      <Plus size={14} />
                    </button>
                  </div>
                  <p className="w-20 text-right text-sm font-semibold text-[var(--md-on-surface)]">
                    {formatCurrency(item.price * item.qty)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-5 pt-3 pb-28 safe-bottom border-t border-[var(--md-outline-variant)] space-y-3">
            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-base font-medium text-[var(--md-on-surface-variant)]">Tổng cộng</span>
              <span className="text-xl font-bold text-[var(--md-primary)]">{formatCurrency(cartTotal)}</span>
            </div>

            {/* Print toggle */}
            <div className="rounded-[var(--md-radius-lg)] bg-[var(--md-surface-container-highest)] p-3 space-y-2">
              <button
                onClick={() => setPrintEnabled(v => !v)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Printer size={16} className={printEnabled ? 'text-[var(--md-primary)]' : 'text-[var(--md-on-surface-variant)]'} />
                  <span className="text-sm font-medium text-[var(--md-on-surface)]">In hóa đơn</span>
                </div>
                {/* Toggle pill */}
                <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-0.5
                  ${printEnabled ? 'bg-[var(--md-primary)]' : 'bg-[var(--md-surface-container)]'}`}>
                  <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200
                    ${printEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </button>

              {/* Print type dropdown */}
              {printEnabled && (
                <div className="flex gap-2 pt-1 animate-fade-in">
                  <button
                    onClick={() => setPrintType('cash')}
                    className={`flex-1 py-1.5 rounded-[var(--md-radius-md)] text-xs font-semibold transition-all
                      ${printType === 'cash'
                        ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)]'
                        : 'bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]'}`}>
                    💵 Tiền mặt
                  </button>
                  <button
                    onClick={() => setPrintType('transfer')}
                    className={`flex-1 py-1.5 rounded-[var(--md-radius-md)] text-xs font-semibold transition-all
                      ${printType === 'transfer'
                        ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)]'
                        : 'bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]'}`}>
                    📱 QR Chuyển khoản
                  </button>
                </div>
              )}
            </div>

            <button onClick={() => onCheckout({ printEnabled, printType })}
              className="w-full h-14 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] font-semibold text-base transition-all duration-200 active:scale-[0.98] elevation-1 hover:elevation-2">
              Thanh toán • {formatCurrency(cartTotal)}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.getElementById('portal-root') || document.body
  );
};

export default CartDrawer;
