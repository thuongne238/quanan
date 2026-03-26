import { useState, useEffect, useMemo } from 'react';
import { Receipt, Search, ChevronRight, Printer, CheckCircle, XCircle, Clock, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import Card from '../components/ui/Card';
import Chip from '../components/ui/Chip';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { formatCurrency, printBill } from '../utils/printer';
import { fetchOrders, fetchProducts, fetchCategories, createOrder, remove } from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';

const statusConfig = {
  completed: { label: 'Hoàn thành', icon: CheckCircle, color: 'var(--md-primary)' },
  cancelled: { label: 'Đã hủy', icon: XCircle, color: 'var(--md-error)' },
  pending: { label: 'Đang xử lý', icon: Clock, color: 'var(--md-tertiary)' },
};

const BillPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const { user, isAdmin } = useAuth();

  // New order creation
  const [newOrderModal, setNewOrderModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [successToast, setSuccessToast] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchOrders();
        setOrders(data);
      } catch (err) {
        console.error('Failed to load orders:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = orders;
    if (statusFilter !== 'all') result = result.filter(o => o.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.id?.toLowerCase().includes(q) ||
        o.cashier_name?.toLowerCase().includes(q) ||
        o.items?.some(i => i.name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [orders, statusFilter, search]);

  const [orderToDelete, setOrderToDelete] = useState(null);

  const requestDeleteOrder = (orderId) => {
    if (!isAdmin) return;
    setOrderToDelete(orderId);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      await remove('orders', orderToDelete);
      setOrders(prev => prev.filter(o => o.id !== orderToDelete));
      setSelectedOrder(null);
    } catch (err) {
      console.error('Delete order error:', err);
    }
    setOrderToDelete(null);
  };

  const formatDate = (ts) => {
    if (!ts) return '--';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const formatShortDate = (ts) => {
    if (!ts) return '--';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  };

  // === New Order ===
  const openNewOrder = async () => {
    try {
      const [prods, cats] = await Promise.all([fetchProducts(), fetchCategories()]);
      setProducts(prods.filter(p => p.status !== 'inactive'));
      setCategories(cats);
      setOrderItems([]);
      setProductSearch('');
      setNewOrderModal(true);
    } catch (err) {
      console.error('Load products error:', err);
    }
  };

  const addOrderItem = (product) => {
    setOrderItems(prev => {
      const idx = prev.findIndex(i => i.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        return updated;
      }
      return [...prev, { id: product.id, name: product.name, price: product.price, qty: 1 }];
    });
  };

  const updateOrderItemQty = (id, qty) => {
    if (qty <= 0) {
      setOrderItems(prev => prev.filter(i => i.id !== id));
    } else {
      setOrderItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
    }
  };

  const orderTotal = orderItems.reduce((sum, i) => sum + i.price * i.qty, 0);
  const orderCount = orderItems.reduce((sum, i) => sum + i.qty, 0);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  const handleCreateOrder = async () => {
    if (orderItems.length === 0) return;
    setCreating(true);
    try {
      await createOrder({
        items: orderItems.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
        total_amount: orderTotal,
        cashier_id: user?.uid || 'unknown',
        cashier_name: user?.displayName || user?.email || 'Staff',
      });
      // Refresh orders
      const data = await fetchOrders();
      setOrders(data);
      setNewOrderModal(false);
      setSuccessToast(true);
      setTimeout(() => setSuccessToast(false), 2500);
    } catch (err) {
      console.error('Create order error:', err);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-[var(--md-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header & Search */}
      <div className="sticky top-0 z-20 bg-[var(--md-surface)] pt-4 pb-2 px-4">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-bold text-[var(--md-on-surface)]">Hóa đơn</h1>
          <button onClick={openNewOrder}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-xs font-medium transition-all active:scale-95">
            <Plus size={14} /> Tạo đơn
          </button>
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--md-on-surface-variant)]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm hóa đơn..."
            className="w-full h-11 pl-10 pr-4 rounded-[var(--md-radius-xl)] bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface)] text-sm border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors placeholder:text-[var(--md-on-surface-variant)]/50" />
        </div>
      </div>

      {/* Status filter chips */}
      <div className="px-4 py-2 overflow-x-auto">
        <div className="flex gap-2" style={{ minWidth: 'max-content' }}>
          <Chip label="Tất cả" selected={statusFilter === 'all'} onClick={() => setStatusFilter('all')} />
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <Chip key={key} label={cfg.label} icon={cfg.icon} selected={statusFilter === key} onClick={() => setStatusFilter(key)} />
          ))}
        </div>
      </div>

      {/* Orders list */}
      <div className="px-4 mt-2 space-y-2 pb-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--md-on-surface-variant)]">
            <Receipt size={48} strokeWidth={1.5} className="mb-3 opacity-40" />
            <p className="text-sm">Không có hóa đơn</p>
            <button onClick={openNewOrder}
              className="mt-3 flex items-center gap-1 px-4 py-2 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-sm font-medium transition-all active:scale-95">
              <Plus size={16} /> Tạo đơn hàng mới
            </button>
          </div>
        ) : (
          filtered.map(order => {
            const status = statusConfig[order.status] || statusConfig.pending;
            const StatusIcon = status.icon;
            return (
              <Card key={order.id} variant="elevated" onClick={() => setSelectedOrder(order)}
                className="p-4 cursor-pointer active:scale-[0.98] transition-transform">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusIcon size={16} style={{ color: status.color }} />
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ background: `color-mix(in srgb, ${status.color} 15%, transparent)`, color: status.color }}>
                        {status.label}
                      </span>
                      <span className="text-xs text-[var(--md-on-surface-variant)]">{formatShortDate(order.timestamp)}</span>
                    </div>
                    <p className="text-xs text-[var(--md-on-surface-variant)] truncate">
                      {order.items?.map(i => `${i.name} x${i.qty}`).join(', ') || 'Không có món'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <span className="text-sm font-bold text-[var(--md-primary)]">{formatCurrency(order.total_amount || 0)}</span>
                    <ChevronRight size={16} className="text-[var(--md-on-surface-variant)]" />
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      {/* Order Detail Modal */}
      <Modal open={!!selectedOrder} onClose={() => setSelectedOrder(null)} title="Chi tiết hóa đơn" size="sheet">
        {selectedOrder && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--md-on-surface-variant)]">Mã đơn:</span>
                <span className="font-mono text-xs text-[var(--md-on-surface)]">{selectedOrder.id?.slice(0, 12)}...</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--md-on-surface-variant)]">Thời gian:</span>
                <span className="text-[var(--md-on-surface)]">{formatDate(selectedOrder.timestamp)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--md-on-surface-variant)]">Thu ngân:</span>
                <span className="text-[var(--md-on-surface)]">{selectedOrder.cashier_name || '--'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--md-on-surface-variant)]">Trạng thái:</span>
                <span className="font-medium" style={{ color: (statusConfig[selectedOrder.status] || statusConfig.pending).color }}>
                  {(statusConfig[selectedOrder.status] || statusConfig.pending).label}
                </span>
              </div>
            </div>
            <div className="border-t border-[var(--md-outline-variant)] pt-3">
              <h4 className="text-sm font-medium text-[var(--md-on-surface)] mb-2">Danh sách món</h4>
              <div className="space-y-2">
                {selectedOrder.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-[var(--md-on-surface)]">{item.name} <span className="text-[var(--md-on-surface-variant)]">x{item.qty}</span></span>
                    <span className="font-medium text-[var(--md-on-surface)]">{formatCurrency(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="border-t border-[var(--md-outline-variant)] pt-3 flex justify-between items-center">
              <span className="text-base font-medium text-[var(--md-on-surface)]">Tổng cộng</span>
              <span className="text-xl font-bold text-[var(--md-primary)]">{formatCurrency(selectedOrder.total_amount || 0)}</span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => printBill(selectedOrder)}
                className="flex-1 h-12 rounded-[var(--md-radius-xl)] bg-[var(--md-secondary-container)] text-[var(--md-on-secondary-container)] font-semibold text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2">
                <Printer size={18} /> In hóa đơn
              </button>
              {isAdmin && (
                <button onClick={() => requestDeleteOrder(selectedOrder.id)}
                  className="w-12 h-12 flex items-center justify-center rounded-[var(--md-radius-xl)] bg-[var(--md-error)]/10 text-[var(--md-error)] transition-all hover:bg-[var(--md-error)] hover:text-[var(--md-on-error)] active:scale-95">
                  <Trash2 size={20} />
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ===== NEW ORDER MODAL ===== */}
      <Modal open={newOrderModal} onClose={() => setNewOrderModal(false)} title="Tạo đơn hàng mới" size="sheet">
        <div className="space-y-4">
          {/* Search products */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--md-on-surface-variant)]" />
            <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
              placeholder="Tìm món để thêm..."
              className="w-full h-10 pl-9 pr-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors" />
          </div>

          {/* Product quick-add list */}
          <div className="max-h-40 overflow-y-auto space-y-1 rounded-[var(--md-radius-md)] bg-[var(--md-surface-container-low)] p-2">
            {filteredProducts.length === 0 ? (
              <p className="text-center text-xs text-[var(--md-on-surface-variant)] py-3">Không tìm thấy món</p>
            ) : (
              filteredProducts.map(p => {
                const inCart = orderItems.find(i => i.id === p.id);
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-[var(--md-radius-sm)] hover:bg-[var(--md-surface-container-highest)] transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--md-on-surface)] truncate">{p.name}</p>
                      <p className="text-xs text-[var(--md-primary)] font-semibold">{formatCurrency(p.price)}</p>
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-1">
                        <button onClick={() => updateOrderItemQty(p.id, inCart.qty - 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--md-surface-container-highest)] transition-colors">
                          {inCart.qty === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                        </button>
                        <span className="w-6 text-center text-sm font-semibold text-[var(--md-on-surface)]">{inCart.qty}</span>
                        <button onClick={() => updateOrderItemQty(p.id, inCart.qty + 1)}
                          className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] transition-colors">
                          <Plus size={12} />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => addOrderItem(p)}
                        className="px-3 py-1 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-xs font-medium transition-all active:scale-95">
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Selected items summary */}
          {orderItems.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-[var(--md-on-surface)] flex items-center gap-1.5">
                  <ShoppingBag size={16} /> Đơn hàng ({orderCount} món)
                </h4>
                <button onClick={() => setOrderItems([])}
                  className="text-xs text-[var(--md-error)] px-2 py-1 rounded-full hover:bg-[var(--md-error)]/10 transition-colors">
                  Xóa tất cả
                </button>
              </div>
              <div className="space-y-1.5">
                {orderItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between text-sm p-2 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-low)]">
                    <span className="text-[var(--md-on-surface)] flex-1 truncate">{item.name} <span className="text-[var(--md-on-surface-variant)]">x{item.qty}</span></span>
                    <span className="font-medium text-[var(--md-on-surface)] ml-2">{formatCurrency(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Total & Submit */}
          {orderItems.length > 0 && (
            <div className="border-t border-[var(--md-outline-variant)] pt-3">
              <div className="flex items-center justify-between mb-3">
                <span className="text-base font-medium text-[var(--md-on-surface-variant)]">Tổng cộng</span>
                <span className="text-xl font-bold text-[var(--md-primary)]">{formatCurrency(orderTotal)}</span>
              </div>
              <button onClick={handleCreateOrder} disabled={creating}
                className="w-full h-12 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] font-semibold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2">
                {creating ? (
                  <div className="w-5 h-5 border-2 border-[var(--md-on-primary)] border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>Tạo đơn hàng • {formatCurrency(orderTotal)}</>
                )}
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Success toast */}
      {successToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="px-5 py-3 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] text-sm font-medium elevation-2">
            ✓ Đơn hàng đã được tạo thành công!
          </div>
        </div>
      )}

      {/* Delete Order Confirm */}
      <ConfirmDialog
        open={!!orderToDelete}
        title="Xóa hóa đơn"
        message="Bạn có chắc chắn muốn xóa hóa đơn này không? Hành động này không thể hoàn tác."
        confirmText="Xóa hóa đơn"
        onConfirm={confirmDeleteOrder}
        onClose={() => setOrderToDelete(null)}
        type="danger"
      />
    </div>
  );
};

export default BillPage;
