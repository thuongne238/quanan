import { useState, useEffect, useMemo } from 'react';
import { Search, ShoppingCart, Plus, Coffee, IceCreamCone, Pizza, Sandwich, Salad, Cake, Wine, Edit, Trash2, MoreVertical, FolderPlus, X, ChevronDown, ChevronRight } from 'lucide-react';
import Card from '../components/ui/Card';
import Chip from '../components/ui/Chip';
import FAB from '../components/ui/FAB';
import CartDrawer from '../components/cart/CartDrawer';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { formatCurrency, printBill } from '../utils/printer';
import { fetchCategories, fetchProducts, createOrder, create, update, remove } from '../firebase/firestore';

const iconMap = {
  coffee: Coffee, ice_cream: IceCreamCone, pizza: Pizza,
  sandwich: Sandwich, salad: Salad, cake: Cake, wine: Wine,
};

const FoodDrinkPage = () => {
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [selectedCat, setSelectedCat] = useState('all');
  const [search, setSearch] = useState('');
  const [cartOpen, setCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const { addItem, items: cartItems, cartCount, clearCart, cartTotal } = useCart();
  const { user, isAdmin } = useAuth();
  const { storeInfo } = useSettings();

  // Product modal
  const [productModal, setProductModal] = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: '', price: '', category_id: '', status: 'active' });
  const [productError, setProductError] = useState('');

  // Category modal
  const [catModal, setCatModal] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', icon_name: 'coffee', sort_order: 0 });
  const [catError, setCatError] = useState('');

  // Long-press / action menu
  const [actionProduct, setActionProduct] = useState(null);
  const [collapsedCats, setCollapsedCats] = useState(() => {
    const saved = localStorage.getItem('pos-collapsed-cats');
    return saved ? JSON.parse(saved) : {};
  });

  useEffect(() => {
    localStorage.setItem('pos-collapsed-cats', JSON.stringify(collapsedCats));
  }, [collapsedCats]);

  useEffect(() => {
    const load = async () => {
      try {
        const [cats, prods] = await Promise.all([fetchCategories(), fetchProducts()]);
        setCategories(cats);
        setProducts(prods);
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = products;
    if (selectedCat !== 'all') result = result.filter(p => p.category_id === selectedCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q));
    }
    return result;
  }, [products, selectedCat, search]);

  const groupedProducts = useMemo(() => {
    const groups = {};
    filtered.forEach(p => {
      const catId = p.category_id || 'uncategorized';
      if (!groups[catId]) groups[catId] = [];
      groups[catId].push(p);
    });
    return groups;
  }, [filtered]);

  const toggleCat = (catId) => {
    setCollapsedCats(prev => ({ ...prev, [catId]: !prev[catId] }));
  };

  const handleCheckout = async (printOptions = {}) => {
    try {
      const orderData = {
        items: cartItems.map(i => ({ name: i.name, price: i.price, qty: i.qty })),
        total_amount: cartTotal,
        cashier_id: user?.uid || 'unknown',
        cashier_name: user?.displayName || user?.email || 'Staff',
        source: 'menu',
        payment_method: printOptions.printEnabled ? printOptions.printType : 'cash',
      };
      await createOrder(orderData);
      if (printOptions.printEnabled) {
        await printBill({ ...orderData, timestamp: new Date() }, storeInfo);
      }
      clearCart();
      setCartOpen(false);
      setCheckoutSuccess(true);
      setTimeout(() => setCheckoutSuccess(false), 2500);
    } catch (err) {
      console.error('Checkout failed:', err);
    }
  };

  // === Product CRUD ===
  const [productToDelete, setProductToDelete] = useState(null);

  const openAddProduct = () => {
    setEditProduct(null);
    setProductForm({ name: '', price: '', category_id: categories[0]?.id || '', status: 'active' });
    setProductError('');
    setProductModal(true);
  };

  const openEditProduct = (product) => {
    setEditProduct(product);
    setProductForm({ name: product.name, price: String(product.price), category_id: product.category_id || '', status: product.status || 'active' });
    setActionProduct(null);
    setProductError('');
    setProductModal(true);
  };

  const handleSaveProduct = async () => {
    try {
      setProductError('');
      const trimmedName = productForm.name.trim();
      if (!trimmedName || !productForm.price) return;
      
      const isDuplicate = products.some(p => p.name.toLowerCase() === trimmedName.toLowerCase() && p.id !== editProduct?.id);
      if (isDuplicate) {
        setProductError('Tên món ăn đã tồn tại, vui lòng chọn tên khác!');
        return;
      }

      const data = {
        name: trimmedName,
        price: parseInt(productForm.price) || 0,
        category_id: productForm.category_id,
        status: productForm.status,
      };
      if (editProduct) {
        await update('products', editProduct.id, data);
      } else {
        await create('products', data);
      }
      const prods = await fetchProducts();
      setProducts(prods);
      setProductModal(false);
      setEditProduct(null);
    } catch (err) {
      console.error('Save product error:', err);
    }
  };

  const requestDeleteProduct = (product) => {
    setProductToDelete(product);
    setActionProduct(null);
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;
    try {
      await remove('products', productToDelete.id);
      setProducts(prev => prev.filter(p => p.id !== productToDelete.id));
    } catch (err) {
      console.error('Delete product error:', err);
    }
    setProductToDelete(null);
  };

  // === Category quick-add ===
  const handleAddCategory = async () => {
    try {
      setCatError('');
      const trimmedName = catForm.name.trim();
      if (!trimmedName) return;

      const isDuplicate = categories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase());
      if (isDuplicate) {
        setCatError('Tên danh mục đã tồn tại!');
        return;
      }

      await create('categories', { ...catForm, name: trimmedName });
      const cats = await fetchCategories();
      setCategories(cats);
      setCatModal(false);
      setCatForm({ name: '', icon_name: 'coffee', sort_order: cats.length });
    } catch (err) {
      console.error('Add category error:', err);
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
          <h1 className="text-xl font-bold text-[var(--md-on-surface)]">Thực đơn</h1>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={() => { setCatForm({ name: '', icon_name: 'coffee', sort_order: categories.length }); setCatError(''); setCatModal(true); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--md-secondary-container)] text-[var(--md-on-secondary-container)] text-xs font-medium transition-all active:scale-95">
                <FolderPlus size={14} /> Danh mục
              </button>
              <button onClick={openAddProduct}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-xs font-medium transition-all active:scale-95">
                <Plus size={14} /> Thêm món
              </button>
            </div>
          )}
        </div>
        <div className="relative">
          <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--md-on-surface-variant)]" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Tìm món ăn, thức uống..."
            className="w-full h-11 pl-10 pr-4 rounded-[var(--md-radius-xl)] bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface)] text-sm border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors placeholder:text-[var(--md-on-surface-variant)]/50" />
        </div>
      </div>

      {/* Category chips */}
      <div className="px-4 py-2 overflow-x-auto">
        <div className="flex gap-2 pb-1" style={{ minWidth: 'max-content' }}>
          <Chip label="Tất cả" selected={selectedCat === 'all'} onClick={() => setSelectedCat('all')} />
          {categories.map(cat => {
            const IconComp = iconMap[cat.icon_name] || Coffee;
            return <Chip key={cat.id} label={cat.name} icon={IconComp} selected={selectedCat === cat.id} onClick={() => setSelectedCat(cat.id)} />;
          })}
        </div>
      </div>

      {/* Products grouped by category */}
      <div className="px-4 mt-2 space-y-4">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-[var(--md-on-surface-variant)]">
            <Coffee size={48} strokeWidth={1.5} className="mb-3 opacity-40" />
            <p className="text-sm">Không tìm thấy món nào</p>
            {isAdmin && (
              <button onClick={openAddProduct}
                className="mt-3 flex items-center gap-1 px-4 py-2 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-sm font-medium transition-all active:scale-95">
                <Plus size={16} /> Thêm món mới
              </button>
            )}
          </div>
        ) : (
          [...categories, { id: 'uncategorized', name: 'Khác', icon_name: 'coffee' }].map(cat => {
            const catProducts = groupedProducts[cat.id];
            if (!catProducts || catProducts.length === 0) return null;
            const isCollapsed = collapsedCats[cat.id];
            
            return (
              <div key={cat.id} className="space-y-3">
                {/* Category Header */}
                <button onClick={() => toggleCat(cat.id)} className="w-full flex items-center justify-between py-1 text-[var(--md-on-surface)] active:opacity-70 transition-opacity">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base tracking-wide">{cat.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface-variant)]">
                      {catProducts.length} món
                    </span>
                  </div>
                  {isCollapsed ? <ChevronRight size={20} className="text-[var(--md-on-surface-variant)]" /> : <ChevronDown size={20} className="text-[var(--md-on-surface-variant)]" />}
                </button>
                
                {/* Products Grid */}
                {!isCollapsed && (
                  <div className="grid grid-cols-2 gap-3">
                    {catProducts.map(product => (
                      <Card key={product.id} variant="elevated" className="overflow-hidden group relative">
                        {/* Status Badge */}
                        <div className="absolute top-2 left-2 z-10 pointer-events-none">
                          {product.status === 'inactive' ? (
                            <span className="px-2 py-0.5 rounded-full bg-[var(--md-error)] text-[var(--md-on-error)] text-[10px] font-bold shadow-sm inline-flex">Ngừng bán</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-[var(--md-primary)] text-[var(--md-on-primary)] text-[10px] font-bold shadow-sm inline-flex">Đang bán</span>
                          )}
                        </div>

                        {/* Action menu for admin */}
                        {isAdmin && (
                          <button onClick={(e) => { e.stopPropagation(); setActionProduct(actionProduct?.id === product.id ? null : product); }}
                            className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-black/30 hover:bg-black/40 transition-colors">
                            <MoreVertical size={16} className="text-white" />
                          </button>
                        )}

                        {/* Action dropdown */}
                        {actionProduct?.id === product.id && (
                          <div className="absolute top-9 right-2 z-20 bg-[var(--md-surface-container)] rounded-[var(--md-radius-md)] elevation-2 overflow-hidden animate-scale-in">
                            <button onClick={() => openEditProduct(product)}
                              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-[var(--md-on-surface)] hover:bg-[var(--md-surface-container-highest)] transition-colors">
                              <Edit size={14} /> Sửa
                            </button>
                            <button onClick={() => requestDeleteProduct(product)}
                              className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-[var(--md-error)] hover:bg-[var(--md-error)]/10 transition-colors">
                              <Trash2 size={14} /> Xóa
                            </button>
                          </div>
                        )}

                        <div className={product.status === 'inactive' ? 'opacity-50 grayscale' : ''}>
                          <div className="h-24 bg-gradient-to-br from-[var(--md-primary-container)] to-[var(--md-tertiary-container)] flex items-center justify-center">
                            {(() => {
                              const pcat = categories.find(c => c.id === product.category_id); const IconComp = pcat ? iconMap[pcat.icon_name] || Coffee : Coffee;
                              return <IconComp size={32} className="text-[var(--md-on-primary-container)] opacity-60" />;
                            })()}
                          </div>
                          <div className="p-3 pb-0">
                            <h3 className="text-sm font-semibold text-[var(--md-on-surface)] truncate">{product.name}</h3>
                            <p className="text-xs text-[var(--md-primary)] font-bold mt-1">{formatCurrency(product.price)}</p>
                          </div>
                        </div>

                        <div className="p-3 pt-2">
                          <button onClick={() => addItem(product)} disabled={product.status === 'inactive'}
                            className={`w-full h-9 rounded-[var(--md-radius-xl)] text-xs font-semibold transition-all duration-200 flex items-center justify-center gap-1 ${
                              product.status === 'inactive'
                                ? 'bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface-variant)] cursor-not-allowed opacity-60'
                                : 'bg-[var(--md-primary)] text-[var(--md-on-primary)] active:scale-95'
                            }`}>
                            <Plus size={14} /> Thêm
                          </button>
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

      {/* Close action menus on background click */}
      {actionProduct && <div className="fixed inset-0 z-10" onClick={() => setActionProduct(null)} />}

      {/* Floating Cart FAB */}
      {cartCount > 0 && (
        <div className="fixed bottom-28 right-4 z-30 animate-scale-in">
          <FAB icon={ShoppingCart} onClick={() => setCartOpen(true)} badge={cartCount} color="primary" />
        </div>
      )}

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={handleCheckout} />

      {checkoutSuccess && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-slide-down">
          <div className="px-5 py-3 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] text-sm font-medium elevation-2">
            ✓ Đơn hàng đã được tạo thành công!
          </div>
        </div>
      )}

      {/* ===== Product Modal ===== */}
      <Modal open={productModal} onClose={() => { setProductModal(false); setEditProduct(null); setProductError(''); }} title={editProduct ? 'Sửa món' : 'Thêm món mới'}>
        <div className="space-y-4">
          {productError && (
            <div className="px-4 py-3 rounded-[var(--md-radius-md)] bg-[var(--md-error)]/10 text-[var(--md-error)] text-sm animate-slide-down">
              {productError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Tên món *</label>
            <input type="text" value={productForm.name} onChange={e => setProductForm({ ...productForm, name: e.target.value })}
              className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
              placeholder="Tên món ăn / thức uống" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Giá (VNĐ) *</label>
            <input type="number" value={productForm.price} onChange={e => setProductForm({ ...productForm, price: e.target.value })}
              className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
              placeholder="25000" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Danh mục</label>
            <select value={productForm.category_id} onChange={e => setProductForm({ ...productForm, category_id: e.target.value })}
              className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors">
              <option value="">-- Chọn danh mục --</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Trạng thái</label>
            <div className="flex gap-2">
              {['active', 'inactive'].map(s => (
                <button key={s} onClick={() => setProductForm({ ...productForm, status: s })}
                  className={`flex-1 h-10 rounded-[var(--md-radius-sm)] text-sm font-medium transition-all
                    ${productForm.status === s
                      ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)]'
                      : 'bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface-variant)]'}`}>
                  {s === 'active' ? 'Đang bán' : 'Ngừng bán'}
                </button>
              ))}
            </div>
          </div>
          <button onClick={handleSaveProduct} disabled={!productForm.name.trim() || !productForm.price}
            className="w-full h-12 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] font-semibold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50">
            {editProduct ? 'Cập nhật' : 'Thêm mới'}
          </button>
        </div>
      </Modal>

      {/* ===== Category Quick-Add Modal ===== */}
      <Modal open={catModal} onClose={() => { setCatModal(false); setCatError(''); }} title="Thêm danh mục">
        <div className="space-y-4">
          {catError && (
            <div className="px-4 py-3 rounded-[var(--md-radius-md)] bg-[var(--md-error)]/10 text-[var(--md-error)] text-sm animate-slide-down">
              {catError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Tên danh mục *</label>
            <input type="text" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })}
              className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
              placeholder="Tên danh mục" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Icon</label>
            <select value={catForm.icon_name} onChange={e => setCatForm({ ...catForm, icon_name: e.target.value })}
              className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors">
              <option value="coffee">☕ NƯỚC</option>
              <option value="ice_cream">🍦 ĂN vẶT</option>
              <option value="pizza">🍕 ĂN CHÍNH</option>
              <option value="sandwich">🥪 LAI RAI</option>
              <option value="salad">🥗 MÓN PHỤ</option>
              <option value="cake">🍰 BÁNH</option>
              <option value="wine">🍷 KHÁC</option>
            </select>
          </div>
          <button onClick={handleAddCategory} disabled={!catForm.name.trim()}
            className="w-full h-12 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] font-semibold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50">
            Thêm danh mục
          </button>
        </div>
      </Modal>
      {/* ===== Delete Product Confirm ===== */}
      <ConfirmDialog
        open={!!productToDelete}
        title="Xóa món ăn"
        message={`Bạn có chắc chắn muốn xóa "${productToDelete?.name}" khỏi thực đơn? Hành động này không thể hoàn tác.`}
        confirmText="Xóa món"
        onConfirm={confirmDeleteProduct}
        onClose={() => setProductToDelete(null)}
        type="danger"
      />
    </div>
  );
};

export default FoodDrinkPage;
