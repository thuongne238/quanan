import {
  collection, doc, getDocs, getDoc, addDoc, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, serverTimestamp, onSnapshot
} from 'firebase/firestore';
import { db } from './config';

// Set document with specific ID
export const setDocument = async (collectionName, id, data) => {
  await setDoc(doc(db, collectionName, id), data, { merge: true });
};

// ===== Generic Helpers =====
const getCollection = (name) => collection(db, name);

export const fetchAll = async (collectionName, ...constraints) => {
  const q = constraints.length
    ? query(getCollection(collectionName), ...constraints)
    : getCollection(collectionName);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
};

export const fetchOne = async (collectionName, id) => {
  const snap = await getDoc(doc(db, collectionName, id));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
};

export const create = async (collectionName, data) => {
  const ref = await addDoc(getCollection(collectionName), {
    ...data,
    createdAt: serverTimestamp()
  });
  return ref.id;
};

export const update = async (collectionName, id, data) => {
  await updateDoc(doc(db, collectionName, id), {
    ...data,
    updatedAt: serverTimestamp()
  });
};

export const remove = async (collectionName, id) => {
  await deleteDoc(doc(db, collectionName, id));
};

// ===== Realtime Listener =====
export const listenCollection = (collectionName, callback, ...constraints) => {
  const q = constraints.length
    ? query(getCollection(collectionName), ...constraints)
    : getCollection(collectionName);
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  });
};

// ===== Domain-Specific =====
export const fetchCategories = () => fetchAll('categories', orderBy('sort_order'));
export const fetchProducts = () => fetchAll('products');
export const fetchProductsByCategory = (catId) => fetchAll('products', where('category_id', '==', catId));
export const fetchOrders = () => fetchAll('orders', orderBy('timestamp', 'desc'));
export const fetchUsers = () => fetchAll('users');
export const fetchTables = () => fetchAll('tables', orderBy('sort_order'));

export const createOrder = (orderData) => create('orders', {
  ...orderData,
  timestamp: serverTimestamp(),
  status: 'completed',
  source: orderData.source || 'menu',
});
