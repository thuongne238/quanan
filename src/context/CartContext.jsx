import { createContext, useContext, useState, useCallback } from 'react';

const CartContext = createContext(null);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
};

export const CartProvider = ({ children }) => {
  const [items, setItems] = useState([]);

  const addItem = useCallback((product) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === product.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = { ...updated[idx], qty: updated[idx].qty + 1 };
        return updated;
      }
      return [...prev, { ...product, qty: 1 }];
    });
  }, []);

  const removeItem = useCallback((productId) => {
    setItems(prev => prev.filter(i => i.id !== productId));
  }, []);

  const updateQty = useCallback((productId, qty) => {
    if (qty <= 0) {
      setItems(prev => prev.filter(i => i.id !== productId));
      return;
    }
    setItems(prev => prev.map(i => i.id === productId ? { ...i, qty } : i));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const cartTotal = items.reduce((sum, i) => sum + i.price * i.qty, 0);
  const cartCount = items.reduce((sum, i) => sum + i.qty, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQty, clearCart, cartTotal, cartCount }}>
      {children}
    </CartContext.Provider>
  );
};
