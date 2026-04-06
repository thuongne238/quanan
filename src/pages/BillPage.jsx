import { useState, useEffect, useMemo } from 'react';
import { Receipt, Search, ChevronRight, ChevronDown, Printer, Plus, Minus, Trash2, ShoppingBag } from 'lucide-react';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { formatCurrency, printBill } from '../utils/printer';
import { fetchOrders, fetchProducts, fetchCategories, createOrder, remove } from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';

const BillPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [expandedDates, setExpandedDates] = useState(() => {
    try {
      const saved = localStorage.getItem('pos-bill-expanded-dates');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('pos-bill-expanded-dates', JSON.stringify(expandedDates));
  }, [expandedDates]);

  const { user, isAdmin } = useAuth();

  // New order creation
  const [newOrderModal, setNewOrderModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [successToast, setSuccessToast] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash'); // 'cash' or 'transfer'
  const [expandedCategories, setExpandedCategories] = useState({});

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
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.id?.toLowerCase().includes(q) ||
        o.cashier_name?.toLowerCase().includes(q) ||
        o.items?.some(i => i.name.toLowerCase().includes(q))
      );
    }
    return result;
  }, [orders, search]);

  const groupedOrders = useMemo(() => {
    const groups = {};
    filtered.forEach(order => {
      const ts = order.timestamp;
      let dateString = '--';
      if (ts) {
        const d = ts.toDate ? ts.toDate() : new Date(ts);
        dateString = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      }
      if (!groups[dateString]) {
        groups[dateString] = [];
      }
      groups[dateString].push(order);
    });

    const sortedKeys = Object.keys(groups).sort((a, b) => {
      if (a === '--') return 1;
      if (b === '--') return -1;
      const [dayA, monthA, yearA] = a.split('/');
      const [dayB, monthB, yearB] = b.split('/');
      const dateA = new Date(yearA, monthA - 1, dayA);
      const dateB = new Date(yearB, monthB - 1, dayB);
      return dateB - dateA; // Descending
    });

    return sortedKeys.map(key => ({
      date: key,
      orders: groups[key].sort((a, b) => {
        // Sort orders within a day by time descending
        const d1 = a.timestamp?.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
        const d2 = b.timestamp?.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
        return d2 - d1;
      })
    }));
  }, [filtered]);

  const toggleDateGroup = (dateStr) => {
    setExpandedDates(prev => ({
      ...prev,
      [dateStr]: prev[dateStr] === false ? true : false // Default is expanded (undefined), toggle to false
    }));
  };


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
      setPaymentMethod('cash');
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

  const groupedProducts = useMemo(() => {
    const groups = [];
    const catMap = {};
    categories.forEach(cat => {
      catMap[cat.id] = cat.name;
    });
    const grouped = {};
    filteredProducts.forEach(p => {
      const catId = p.category_id || '__uncategorized';
      if (!grouped[catId]) grouped[catId] = [];
      grouped[catId].push(p);
    });
    // Sort by category order
    categories.forEach(cat => {
      if (grouped[cat.id]) {
        groups.push({ id: cat.id, name: cat.name, products: grouped[cat.id] });
      }
    });
    if (grouped['__uncategorized']) {
      groups.push({ id: '__uncategorized', name: 'Khác', products: grouped['__uncategorized'] });
    }
    return groups;
  }, [filteredProducts, categories]);

  const toggleCategory = (catId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [catId]: prev[catId] === false ? true : false
    }));
  };

  const handleCreateOrder = async () => {
    if (orderItems.length === 0) return;
    setCreating(true);
    try {
      await createOrder({
        items: orderItems.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
        total_amount: orderTotal,
        cashier_id: user?.uid || 'unknown',
        cashier_name: user?.displayName || user?.email || 'Staff',
        payment_method: paymentMethod,
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
    <div className="relative pb-4 animate-fade-in">
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

      {/* Orders list */}
      <div className="px-4 mt-2 space-y-4 pb-4">
        {groupedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--md-on-surface-variant)]">
            <Receipt size={48} strokeWidth={1.5} className="mb-3 opacity-40" />
            <p className="text-sm">Không có hóa đơn</p>
            <button onClick={openNewOrder}
              className="mt-3 flex items-center gap-1 px-4 py-2 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-sm font-medium transition-all active:scale-95">
              <Plus size={16} /> Tạo đơn hàng mới
            </button>
          </div>
        ) : (
          groupedOrders.map((group) => {
            const isExpanded = expandedDates[group.date] !== false; // Default expanded
            const totalForDay = group.orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
            return (
              <div key={group.date} className="space-y-2">
                <button 
                  onClick={() => toggleDateGroup(group.date)}
                  className="w-full flex items-center justify-between py-2 px-1 text-sm font-medium text-[var(--md-on-surface-variant)] active:opacity-70 transition-opacity"
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                    <span className="font-bold text-[var(--md-on-surface)]">{group.date} <span className="font-normal text-[var(--md-on-surface-variant)]">({group.orders.length})</span></span>
                  </div>
                  <span className="text-[var(--md-primary)] font-semibold">{formatCurrency(totalForDay)}</span>
                </button>
                
                {isExpanded && (
                  <div className="space-y-2">
                    {group.orders.map(order => (
                      <Card key={order.id} variant="elevated" onClick={() => setSelectedOrder(order)}
                        className="p-4 cursor-pointer active:scale-[0.98] transition-transform">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-xs text-[var(--md-on-surface-variant)] font-medium">{formatShortDate(order.timestamp)}</span>
                              <span className="text-xs font-medium text-[var(--md-on-tertiary-container)] px-2 py-0.5 rounded bg-[var(--md-tertiary-container)]">
                                {order.cashier_name || 'Staff'}
                              </span>
                              {order.payment_method && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                  order.payment_method === 'transfer' 
                                    ? 'border-[var(--md-primary)] text-[var(--md-primary)] bg-[var(--md-primary-container)]/10' 
                                    : 'border-[var(--md-outline-variant)] text-[var(--md-on-surface-variant)] bg-[var(--md-surface-container-highest)]'
                                }`}>
                                  {order.payment_method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-[var(--md-on-surface-variant)] truncate">
                              {order.items?.map(i => `${i.name} x${i.qty}`).join(', ') || 'Không có món'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-3">
                            <span className="text-sm font-bold text-[var(--md-on-surface)]">{formatCurrency(order.total_amount || 0)}</span>
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
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
                <span className="text-[var(--md-on-surface-variant)]">Phương thức:</span>
                <span className={`font-bold ${selectedOrder.payment_method === 'transfer' ? 'text-[var(--md-primary)]' : 'text-[var(--md-on-surface)]'}`}>
                  {selectedOrder.payment_method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
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

          {/* Product quick-add list grouped by category */}
          <div className="max-h-52 overflow-y-auto space-y-1 rounded-[var(--md-radius-md)] bg-[var(--md-surface-container-low)] p-2">
            {groupedProducts.length === 0 ? (
              <p className="text-center text-xs text-[var(--md-on-surface-variant)] py-3">Không tìm thấy món</p>
            ) : (
              groupedProducts.map(group => {
                const isSearching = productSearch.trim().length > 0;
                const isCatExpanded = isSearching || expandedCategories[group.id] !== false;
                const catItemCount = group.products.reduce((sum, p) => {
                  const inCart = orderItems.find(i => i.id === p.id);
                  return sum + (inCart ? inCart.qty : 0);
                }, 0);
                return (
                  <div key={group.id}>
                    <button
                      onClick={() => toggleCategory(group.id)}
                      className="w-full flex items-center justify-between py-1.5 px-1 text-xs font-bold text-[var(--md-on-surface)] active:opacity-70 transition-opacity sticky top-0 bg-[var(--md-surface-container-low)] z-10"
                    >
                      <div className="flex items-center gap-1.5">
                        {isCatExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{group.name}</span>
                        <span className="text-[var(--md-on-surface-variant)] font-normal">({group.products.length})</span>
                      </div>
                      {catItemCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--md-primary)] text-[var(--md-on-primary)]">
                          {catItemCount}
                        </span>
                      )}
                    </button>
                    {isCatExpanded && (
                      <div className="space-y-0.5 ml-1">
                        {group.products.map(p => {
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
                        })}
                      </div>
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

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-[var(--md-on-surface)]">Phương thức thanh toán</h4>
            <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-[var(--md-radius-lg)] border-2 transition-all ${
                  paymentMethod === 'cash' 
                    ? 'border-[var(--md-primary)] bg-[var(--md-primary-container)]/10 text-[var(--md-primary)]' 
                    : 'border-[var(--md-outline-variant)] text-[var(--md-on-surface-variant)] hover:border-[var(--md-on-surface-variant)]'
                }`}
              >
                <span className="text-sm font-bold">Tiền mặt</span>
                <span className="text-[10px] opacity-70">Thanh toán tay</span>
              </button>
              <button 
                type="button"
                onClick={() => setPaymentMethod('transfer')}
                className={`flex-1 flex flex-col items-center justify-center p-3 rounded-[var(--md-radius-lg)] border-2 transition-all ${
                  paymentMethod === 'transfer' 
                    ? 'border-[var(--md-primary)] bg-[var(--md-primary-container)]/10 text-[var(--md-primary)]' 
                    : 'border-[var(--md-outline-variant)] text-[var(--md-on-surface-variant)] hover:border-[var(--md-on-surface-variant)]'
                }`}
              >
                <span className="text-sm font-bold">Chuyển khoản</span>
                <span className="text-[10px] opacity-70">Quét mã VietQR</span>
              </button>
            </div>
          </div>

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
