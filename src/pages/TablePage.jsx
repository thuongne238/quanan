import { useState, useEffect, useMemo } from 'react';
import {
  LayoutGrid, Plus, Edit, Trash2, X, Users, Check,
  Coffee, IceCreamCone, Pizza, Sandwich, Salad, Cake, Wine,
  Search, Minus, ShoppingBag, Printer, ChevronDown, ChevronRight
} from 'lucide-react';
import Card from '../components/ui/Card';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { formatCurrency, printBill } from '../utils/printer';
import {
  fetchTables, fetchCategories, fetchProducts, createOrder, create, update, remove
} from '../firebase/firestore';

const iconMap = {
  coffee: Coffee, ice_cream: IceCreamCone, pizza: Pizza,
  sandwich: Sandwich, salad: Salad, cake: Cake, wine: Wine,
};

const TablePage = () => {
  const { user, isAdmin } = useAuth();
  const { storeInfo } = useSettings();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);

  // Table CRUD modal
  const [tableModal, setTableModal] = useState(false);
  const [editTable, setEditTable] = useState(null);
  const [tableForm, setTableForm] = useState({ name: '', capacity: 4 });
  const [tableError, setTableError] = useState('');
  const [tableToDelete, setTableToDelete] = useState(null);

  // Menu / ordering for a table
  const [activeTable, setActiveTable] = useState(null); // the table being ordered/viewed
  const [menuOpen, setMenuOpen] = useState(false);      // open menu panel
  const [billOpen, setBillOpen] = useState(false);      // open bill panel

  // Menu data
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [orderItems, setOrderItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [expandedCats, setExpandedCats] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Print toggle
  const [printEnabled, setPrintEnabled] = useState(false);
  const [printType, setPrintType] = useState('cash');

  useEffect(() => {
    const load = async () => {
      try {
        const [tbls, cats, prods] = await Promise.all([
          fetchTables(),
          fetchCategories(),
          fetchProducts(),
        ]);
        setTables(tbls);
        setCategories(cats);
        setProducts(prods.filter(p => p.status !== 'inactive'));
      } catch (err) {
        console.error('TablePage load error:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ===== Table CRUD =====
  const openAddTable = () => {
    setEditTable(null);
    setTableForm({ name: '', capacity: 4 });
    setTableError('');
    setTableModal(true);
  };

  const openEditTable = (t) => {
    setEditTable(t);
    setTableForm({ name: t.name, capacity: t.capacity || 4 });
    setTableError('');
    setTableModal(true);
  };

  const handleSaveTable = async () => {
    const trimmed = tableForm.name.trim();
    if (!trimmed) return;
    const isDuplicate = tables.some(t => t.name.toLowerCase() === trimmed.toLowerCase() && t.id !== editTable?.id);
    if (isDuplicate) { setTableError('Tên bàn đã tồn tại!'); return; }

    try {
      if (editTable) {
        await update('tables', editTable.id, { name: trimmed, capacity: tableForm.capacity });
      } else {
        await create('tables', {
          name: trimmed,
          capacity: tableForm.capacity,
          status: 'empty',
          sort_order: tables.length,
        });
      }
      const freshTables = await fetchTables();
      setTables(freshTables);
      setTableModal(false);
    } catch (err) {
      console.error('Save table error:', err);
    }
  };

  const confirmDeleteTable = async () => {
    if (!tableToDelete) return;
    try {
      await remove('tables', tableToDelete.id);
      setTables(prev => prev.filter(t => t.id !== tableToDelete.id));
    } catch (err) { console.error('Delete table error:', err); }
    setTableToDelete(null);
  };

  // ===== Click on table =====
  const handleTableClick = (table) => {
    setActiveTable(table);
    if (table.status === 'empty') {
      // Open menu to order
      setOrderItems([]);
      setProductSearch('');
      setPrintEnabled(false);
      setPrintType('cash');
      setMenuOpen(true);
      setBillOpen(false);
    } else {
      // Table occupied → show bill
      setBillOpen(true);
      setMenuOpen(false);
    }
  };

  // ===== Menu helpers =====
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const q = productSearch.toLowerCase();
    return products.filter(p => p.name.toLowerCase().includes(q));
  }, [products, productSearch]);

  const groupedProducts = useMemo(() => {
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c.name; });
    const grouped = {};
    filteredProducts.forEach(p => {
      const catId = p.category_id || '__other';
      if (!grouped[catId]) grouped[catId] = [];
      grouped[catId].push(p);
    });
    const result = [];
    categories.forEach(cat => {
      if (grouped[cat.id]) result.push({ id: cat.id, name: cat.name, products: grouped[cat.id] });
    });
    if (grouped['__other']) result.push({ id: '__other', name: 'Khác', products: grouped['__other'] });
    return result;
  }, [filteredProducts, categories]);

  const toggleCat = (catId) => setExpandedCats(prev => ({ ...prev, [catId]: prev[catId] === false ? true : false }));

  const addItem = (product) => {
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

  const updateItemQty = (id, qty) => {
    if (qty <= 0) setOrderItems(prev => prev.filter(i => i.id !== id));
    else setOrderItems(prev => prev.map(i => i.id === id ? { ...i, qty } : i));
  };

  const orderTotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
  const orderCount = orderItems.reduce((s, i) => s + i.qty, 0);

  // ===== Checkout (create order + mark table occupied) =====
  const handleCheckout = async () => {
    if (orderItems.length === 0 || !activeTable) return;
    setSubmitting(true);
    try {
      const orderData = {
        items: orderItems.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
        total_amount: orderTotal,
        cashier_id: user?.uid || 'unknown',
        cashier_name: user?.displayName || user?.email || 'Staff',
        payment_method: printEnabled ? printType : 'cash',
        source: 'table',
        table_name: activeTable.name,
        table_id: activeTable.id,
      };
      const orderId = await createOrder(orderData);
      // Mark table occupied, store orderId
      await update('tables', activeTable.id, { status: 'occupied', current_order: { ...orderData, id: orderId } });
      if (printEnabled) {
        await printBill({ ...orderData, id: orderId, timestamp: new Date() }, storeInfo);
      }
      // Refresh tables
      const freshTables = await fetchTables();
      setTables(freshTables);
      setMenuOpen(false);
      setActiveTable(null);
    } catch (err) {
      console.error('Checkout table error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Mark table paid =====
  const handlePaid = async () => {
    if (!activeTable) return;
    setSubmitting(true);
    try {
      await update('tables', activeTable.id, { status: 'empty', current_order: null });
      const freshTables = await fetchTables();
      setTables(freshTables);
      setBillOpen(false);
      setActiveTable(null);
    } catch (err) {
      console.error('Mark paid error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ===== Render =====
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-[var(--md-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative pb-4 animate-fade-in">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[var(--md-surface)] pt-4 pb-3 px-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-[var(--md-on-surface)]">Bàn</h1>
        {isAdmin && (
          <button onClick={openAddTable}
            className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-xs font-medium transition-all active:scale-95">
            <Plus size={14} /> Thêm bàn
          </button>
        )}
      </div>

      {/* Tables grid — 2 columns */}
      <div className="px-4 mt-1">
        {tables.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-[var(--md-on-surface-variant)]">
            <LayoutGrid size={48} strokeWidth={1.5} className="mb-3 opacity-40" />
            <p className="text-sm">Chưa có bàn nào</p>
            {isAdmin && (
              <button onClick={openAddTable}
                className="mt-3 flex items-center gap-1 px-4 py-2 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-sm font-medium transition-all active:scale-95">
                <Plus size={16} /> Thêm bàn mới
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {tables.map(table => (
              <Card key={table.id} variant="elevated"
                className="overflow-hidden cursor-pointer active:scale-[0.97] transition-transform"
                onClick={() => handleTableClick(table)}
              >
                {/* Color band */}
                <div className={`h-2 w-full ${table.status === 'occupied' ? 'bg-[var(--md-primary)]' : 'bg-[var(--md-surface-container-highest)]'}`} />
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-base font-bold text-[var(--md-on-surface)]">{table.name}</h3>
                      <p className="text-xs text-[var(--md-on-surface-variant)] flex items-center gap-1">
                        <Users size={11} /> {table.capacity || 4} người
                      </p>
                    </div>
                    {isAdmin && (
                      <div className="flex gap-0.5" onClick={e => e.stopPropagation()}>
                        <button onClick={() => openEditTable(table)}
                          className="p-1.5 rounded-full hover:bg-[var(--md-surface-container)] transition-colors">
                          <Edit size={13} className="text-[var(--md-on-surface-variant)]" />
                        </button>
                        <button onClick={() => setTableToDelete(table)}
                          className="p-1.5 rounded-full hover:bg-[var(--md-error)]/10 transition-colors">
                          <Trash2 size={13} className="text-[var(--md-error)]" />
                        </button>
                      </div>
                    )}
                  </div>

                  {table.status === 'occupied' ? (
                    <div>
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-[10px] font-bold">
                        🟢 Có khách
                      </span>
                      {table.current_order && (
                        <p className="text-xs text-[var(--md-primary)] font-semibold mt-1.5">
                          {formatCurrency(table.current_order.total_amount || 0)}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface-variant)] text-[10px] font-bold">
                      ⚪ Trống
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* ===== Table CRUD Modal ===== */}
      <Modal open={tableModal} onClose={() => setTableModal(false)} title={editTable ? 'Sửa bàn' : 'Thêm bàn'}>
        <div className="space-y-4">
          {tableError && (
            <div className="px-4 py-3 rounded-[var(--md-radius-md)] bg-[var(--md-error)]/10 text-[var(--md-error)] text-sm animate-slide-down">
              {tableError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Tên bàn *</label>
            <input type="text" value={tableForm.name} onChange={e => setTableForm({ ...tableForm, name: e.target.value })}
              className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
              placeholder="Bàn 1, Bàn VIP, Sân thượng..." />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Sức chứa (người)</label>
            <input type="number" min="1" max="20" value={tableForm.capacity} onChange={e => setTableForm({ ...tableForm, capacity: parseInt(e.target.value) || 1 })}
              className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors" />
          </div>
          <button onClick={handleSaveTable} disabled={!tableForm.name.trim()}
            className="w-full h-12 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] font-semibold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50">
            {editTable ? 'Cập nhật' : 'Thêm bàn'}
          </button>
        </div>
      </Modal>

      {/* ===== Menu Panel (ordering for empty table) ===== */}
      <Modal open={menuOpen} onClose={() => { setMenuOpen(false); setActiveTable(null); }}
        title={`Gọi món — ${activeTable?.name || ''}`} size="sheet">
        <div className="space-y-3">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--md-on-surface-variant)]" />
            <input type="text" value={productSearch} onChange={e => setProductSearch(e.target.value)}
              placeholder="Tìm món..."
              className="w-full h-10 pl-9 pr-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors" />
          </div>

          {/* Product list by category */}
          <div className="max-h-52 overflow-y-auto space-y-1 rounded-[var(--md-radius-md)] bg-[var(--md-surface-container-low)] p-2">
            {groupedProducts.length === 0 ? (
              <p className="text-center text-xs text-[var(--md-on-surface-variant)] py-3">Không tìm thấy món</p>
            ) : (
              groupedProducts.map(group => {
                const isSearching = productSearch.trim().length > 0;
                const isCatExpanded = isSearching || expandedCats[group.id] !== false;
                const catCount = group.products.reduce((s, p) => {
                  const item = orderItems.find(i => i.id === p.id);
                  return s + (item ? item.qty : 0);
                }, 0);
                return (
                  <div key={group.id}>
                    <button onClick={() => toggleCat(group.id)}
                      className="w-full flex items-center justify-between py-1.5 px-1 text-xs font-bold text-[var(--md-on-surface)] sticky top-0 bg-[var(--md-surface-container-low)] z-10">
                      <div className="flex items-center gap-1.5">
                        {isCatExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        <span>{group.name}</span>
                        <span className="text-[var(--md-on-surface-variant)] font-normal">({group.products.length})</span>
                      </div>
                      {catCount > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[var(--md-primary)] text-[var(--md-on-primary)]">{catCount}</span>
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
                                  <button onClick={() => updateItemQty(p.id, inCart.qty - 1)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--md-surface-container-highest)]">
                                    {inCart.qty === 1 ? <Trash2 size={12} /> : <Minus size={12} />}
                                  </button>
                                  <span className="w-6 text-center text-sm font-semibold text-[var(--md-on-surface)]">{inCart.qty}</span>
                                  <button onClick={() => updateItemQty(p.id, inCart.qty + 1)}
                                    className="w-7 h-7 flex items-center justify-center rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]">
                                    <Plus size={12} />
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => addItem(p)}
                                  className="px-3 py-1 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-xs font-medium active:scale-95 transition-all">
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

          {/* Order summary */}
          {orderItems.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium text-[var(--md-on-surface)] flex items-center gap-1.5">
                  <ShoppingBag size={16} /> Đã chọn ({orderCount} món)
                </h4>
                <button onClick={() => setOrderItems([])}
                  className="text-xs text-[var(--md-error)] px-2 py-1 rounded-full hover:bg-[var(--md-error)]/10 transition-colors">
                  Xóa tất cả
                </button>
              </div>
              {orderItems.map(item => (
                <div key={item.id} className="flex justify-between text-sm p-2 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-low)]">
                  <span className="text-[var(--md-on-surface)] flex-1 truncate">{item.name} <span className="text-[var(--md-on-surface-variant)]">x{item.qty}</span></span>
                  <span className="font-medium text-[var(--md-on-surface)] ml-2">{formatCurrency(item.price * item.qty)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Print toggle */}
          <div className="rounded-[var(--md-radius-lg)] bg-[var(--md-surface-container-highest)] p-3 space-y-2">
            <button onClick={() => setPrintEnabled(v => !v)} className="w-full flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer size={16} className={printEnabled ? 'text-[var(--md-primary)]' : 'text-[var(--md-on-surface-variant)]'} />
                <span className="text-sm font-medium text-[var(--md-on-surface)]">In hóa đơn</span>
              </div>
              <div className={`w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-0.5 ${printEnabled ? 'bg-[var(--md-primary)]' : 'bg-[var(--md-surface-container)]'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${printEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
            </button>
            {printEnabled && (
              <div className="flex gap-2 pt-1 animate-fade-in">
                <button onClick={() => setPrintType('cash')}
                  className={`flex-1 py-1.5 rounded-[var(--md-radius-md)] text-xs font-semibold transition-all ${printType === 'cash' ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)]' : 'bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]'}`}>
                  💵 Tiền mặt
                </button>
                <button onClick={() => setPrintType('transfer')}
                  className={`flex-1 py-1.5 rounded-[var(--md-radius-md)] text-xs font-semibold transition-all ${printType === 'transfer' ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)]' : 'bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]'}`}>
                  📱 QR Chuyển khoản
                </button>
              </div>
            )}
          </div>

          {/* Checkout button */}
          {orderItems.length > 0 && (
            <div className="border-t border-[var(--md-outline-variant)] pt-3">
              <div className="flex justify-between items-center mb-3">
                <span className="text-base font-medium text-[var(--md-on-surface-variant)]">Tổng cộng</span>
                <span className="text-xl font-bold text-[var(--md-primary)]">{formatCurrency(orderTotal)}</span>
              </div>
              <button onClick={handleCheckout} disabled={submitting}
                className="w-full h-12 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] font-semibold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2">
                {submitting
                  ? <div className="w-5 h-5 border-2 border-[var(--md-on-primary)] border-t-transparent rounded-full animate-spin" />
                  : <>Xác nhận đặt bàn • {formatCurrency(orderTotal)}</>
                }
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* ===== Bill Panel (occupied table) ===== */}
      <Modal open={billOpen} onClose={() => { setBillOpen(false); setActiveTable(null); }}
        title={`Hóa đơn — ${activeTable?.name || ''}`} size="sheet">
        {activeTable?.current_order && (
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[var(--md-on-surface-variant)]">Bàn:</span>
                <span className="font-semibold text-[var(--md-primary)]">{activeTable.name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--md-on-surface-variant)]">Thu ngân:</span>
                <span className="text-[var(--md-on-surface)]">{activeTable.current_order.cashier_name || '--'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[var(--md-on-surface-variant)]">Phương thức:</span>
                <span className="font-bold text-[var(--md-on-surface)]">
                  {activeTable.current_order.payment_method === 'transfer' ? 'Chuyển khoản' : 'Tiền mặt'}
                </span>
              </div>
            </div>

            <div className="border-t border-[var(--md-outline-variant)] pt-3">
              <h4 className="text-sm font-medium text-[var(--md-on-surface)] mb-2">Danh sách món</h4>
              <div className="space-y-2">
                {activeTable.current_order.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-[var(--md-on-surface)]">{item.name} <span className="text-[var(--md-on-surface-variant)]">x{item.qty}</span></span>
                    <span className="font-medium text-[var(--md-on-surface)]">{formatCurrency(item.price * item.qty)}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-[var(--md-outline-variant)] pt-3 flex justify-between items-center">
              <span className="text-base font-medium text-[var(--md-on-surface)]">Tổng cộng</span>
              <span className="text-xl font-bold text-[var(--md-primary)]">{formatCurrency(activeTable.current_order.total_amount || 0)}</span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button onClick={() => {
                const order = activeTable.current_order;
                printBill({ ...order, timestamp: new Date() }, storeInfo);
              }}
                className="flex-1 h-12 rounded-[var(--md-radius-xl)] bg-[var(--md-secondary-container)] text-[var(--md-on-secondary-container)] font-semibold text-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2">
                <Printer size={18} /> In hóa đơn
              </button>
              <button onClick={handlePaid} disabled={submitting}
                className="flex-1 h-12 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] font-semibold text-sm transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2">
                {submitting
                  ? <div className="w-5 h-5 border-2 border-[var(--md-on-primary)] border-t-transparent rounded-full animate-spin" />
                  : <><Check size={18} /> Đã thanh toán</>
                }
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== Delete Confirm ===== */}
      <ConfirmDialog
        open={!!tableToDelete}
        title="Xóa bàn"
        message={`Bạn có chắc muốn xóa "${tableToDelete?.name}"? Hành động này không thể hoàn tác.`}
        confirmText="Xóa bàn"
        onConfirm={confirmDeleteTable}
        onClose={() => setTableToDelete(null)}
        type="danger"
      />
    </div>
  );
};

export default TablePage;
