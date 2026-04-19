import { createContext, useContext, useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const SETTINGS_DOC = 'app_settings';
const SETTINGS_COLLECTION = 'settings';

const defaultStoreInfo = {
  storeName: 'Pos công thương',
  address: '',
  phone: '',
};

const defaultBankInfo = {
  bankName: 'TPBank',
  accountNumber: '18623082005',
  accountName: 'NGUYEN CONG THUONG',
};

const SettingsContext = createContext(null);

export const SettingsProvider = ({ children }) => {
  const [storeInfo, setStoreInfo] = useState(() => {
    try { return { ...defaultStoreInfo, ...JSON.parse(localStorage.getItem('pos-store-info') || '{}') }; }
    catch { return defaultStoreInfo; }
  });

  const [bankInfo, setBankInfo] = useState(() => {
    try { return { ...defaultBankInfo, ...JSON.parse(localStorage.getItem('pos-bank-info') || '{}') }; }
    catch { return defaultBankInfo; }
  });

  const [settingsLoading, setSettingsLoading] = useState(true);

  // Real-time listener từ Firestore
  useEffect(() => {
    const ref = doc(db, SETTINGS_COLLECTION, SETTINGS_DOC);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.storeInfo) {
          const merged = { ...defaultStoreInfo, ...data.storeInfo };
          setStoreInfo(merged);
          localStorage.setItem('pos-store-info', JSON.stringify(merged));
        }
        if (data.bankInfo) {
          const merged = { ...defaultBankInfo, ...data.bankInfo };
          setBankInfo(merged);
          localStorage.setItem('pos-bank-info', JSON.stringify(merged));
        }
      }
      setSettingsLoading(false);
    }, (err) => {
      console.error('Settings listener error:', err);
      setSettingsLoading(false);
    });
    return () => unsub();
  }, []);

  // Lưu store info lên Firestore (và cache localStorage)
  const saveStoreInfo = async (data) => {
    const merged = { ...defaultStoreInfo, ...data };
    await setDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC), { storeInfo: merged }, { merge: true });
    // localStorage sẽ được cập nhật bởi onSnapshot listener
  };

  // Lưu bank info lên Firestore (và cache localStorage)
  const saveBankInfo = async (data) => {
    const merged = { ...defaultBankInfo, ...data };
    await setDoc(doc(db, SETTINGS_COLLECTION, SETTINGS_DOC), { bankInfo: merged }, { merge: true });
  };

  return (
    <SettingsContext.Provider value={{ storeInfo, bankInfo, saveStoreInfo, saveBankInfo, settingsLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider');
  return ctx;
};
