import { useState, useEffect, useMemo } from 'react';
import {
  Settings, Users, FolderTree, Wifi, WifiOff, Bluetooth, BluetoothSearching,
  Moon, Sun, Store, Phone, MapPin, ChevronRight, ChevronDown, Plus, Trash2, Edit,
  LogOut, Shield, Signal, UserPlus, Eye, EyeOff, Save, History, Printer, CreditCard
} from 'lucide-react';
import Card from '../components/ui/Card';
import Toggle from '../components/ui/Toggle';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { formatCurrency, printBill, getPrinterInfo, testPrinter } from '../utils/printer';
import { getNetworkStatus, addNetworkListener } from '../utils/network';
import { scanDevices, isBluetoothAvailable } from '../utils/bluetooth';
import { fetchCategories, fetchUsers, fetchOrders, create, update, remove } from '../firebase/firestore';
import { createUserAccount } from '../firebase/auth';

const SettingPage = () => {
  const { isDark, toggleTheme } = useTheme();
  const { user, isAdmin, logout } = useAuth();
  const { storeInfo: savedStoreInfo, bankInfo: savedBankInfo, saveStoreInfo, saveBankInfo } = useSettings();

  // Network
  const [netStatus, setNetStatus] = useState({ connected: navigator.onLine, connectionType: 'unknown' });
  // Bluetooth
  const [bleAvailable, setBleAvailable] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [bleDevices, setBleDevices] = useState([]);
  // Categories
  const [categories, setCategories] = useState([]);
  const [catModal, setCatModal] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', icon_name: 'coffee', sort_order: 0 });
  const [catError, setCatError] = useState('');
  const [catListCollapsed, setCatListCollapsed] = useState(true);
  // Users
  const [users, setUsers] = useState([]);
  const [userModal, setUserModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [userForm, setUserForm] = useState({ email: '', password: '', displayName: '', role: 'staff' });
  const [showPw, setShowPw] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState('');
  // Store info — local edit state, synced from context
  const [storeInfo, setStoreInfo] = useState(savedStoreInfo);
  const [storeSaved, setStoreSaved] = useState(false);
  const [storeSaving, setStoreSaving] = useState(false);
  const [storeInfoDirty, setStoreInfoDirty] = useState(false);

  // Bank info — local edit state, synced from context
  const [bankInfo, setBankInfo] = useState(savedBankInfo);
  const [bankSaved, setBankSaved] = useState(false);
  const [bankSaving, setBankSaving] = useState(false);
  const [bankInfoDirty, setBankInfoDirty] = useState(false);

  // Sync local state from Firestore ONLY when user has no unsaved changes
  // This prevents onSnapshot (triggered on app resume) from overwriting user input
  useEffect(() => {
    if (!storeInfoDirty) setStoreInfo(savedStoreInfo);
  }, [JSON.stringify(savedStoreInfo)]);
  useEffect(() => {
    if (!bankInfoDirty) setBankInfo(savedBankInfo);
  }, [JSON.stringify(savedBankInfo)]);

  // Printer status
  const [printerStatus, setPrinterStatus] = useState('Đang kiểm tra...');

  // History / Orders
  const [historyOrders, setHistoryOrders] = useState([]);
  const [collapsedDays, setCollapsedDays] = useState({});
  const [historyModal, setHistoryModal] = useState(false);

  useEffect(() => {
    getNetworkStatus().then(setNetStatus);
    let cleanup;
    addNetworkListener(setNetStatus).then(fn => { cleanup = fn; });
    isBluetoothAvailable().then(setBleAvailable);

    // Load printer status
    getPrinterInfo().then(info => {
      if (info.isSunmiDevice && info.connected) setPrinterStatus('✅ Sunmi V1S (Máy in tích hợp)');
      else if (info.isNative) setPrinterStatus('📱 Capacitor Native');
      else setPrinterStatus('🖥️ Desktop (window.print)');
    }).catch(() => setPrinterStatus('⚠️ Không xác định'));

    if (isAdmin) {
      fetchCategories().then(setCategories).catch(console.error);
      fetchUsers().then(setUsers).catch(console.error);
      fetchOrders().then(setHistoryOrders).catch(console.error);
    }
    return () => cleanup?.();
  }, [isAdmin]);

  const groupedOrders = useMemo(() => {
    const groups = {};
    historyOrders.forEach(o => {
      const d = (o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.timestamp)).toLocaleDateString('vi-VN');
      if (!groups[d]) groups[d] = [];
      groups[d].push(o);
    });
    return Object.entries(groups).sort((a, b) => {
      const parseDate = (ds) => ds.split('/').reverse().join('-');
      return parseDate(b[0]).localeCompare(parseDate(a[0]));
    });
  }, [historyOrders]);

  const toggleDay = (day) => setCollapsedDays(prev => ({ ...prev, [day]: !prev[day] }));

  // Bluetooth scan
  const handleScan = async () => {
    setScanning(true);
    setBleDevices([]);
    try {
      const devices = await scanDevices(5000);
      setBleDevices(devices);
    } catch (err) {
      console.error('BLE scan error:', err);
    } finally {
      setScanning(false);
    }
  };

  const handleTestPrint = async () => {
    const result = await testPrinter();
    if (result.success) {
      setPrinterStatus('✅ ' + result.method);
    } else {
      setPrinterStatus('❌ Lỗi: ' + (result.error || 'Không rõ'));
      printBill({
        items: [{ name: 'Test kết nối máy in', price: 0, qty: 1 }],
        total_amount: 0,
        timestamp: new Date(),
        cashier_name: user?.displayName || user?.email || 'Nhân viên'
      }, storeInfo);
    }
  };

  // Category CRUD
  const [catToDelete, setCatToDelete] = useState(null);

  const handleSaveCat = async () => {
    try {
      setCatError('');
      const trimmedName = catForm.name.trim();
      if (!trimmedName) return;

      const isDuplicate = categories.some(c => c.name.toLowerCase() === trimmedName.toLowerCase() && c.id !== editCat?.id);
      if (isDuplicate) {
        setCatError('Tên danh mục đã tồn tại!');
        return;
      }

      if (editCat) {
        await update('categories', editCat.id, catForm);
      } else {
        await create('categories', catForm);
      }
      const cats = await fetchCategories();
      setCategories(cats);
      setCatModal(false);
      setEditCat(null);
      setCatForm({ name: '', icon_name: 'coffee', sort_order: 0 });
    } catch (err) {
      console.error('Save category error:', err);
    }
  };

  const requestDeleteCat = (id) => { setCatToDelete(id); };

  const confirmDeleteCat = async () => {
    if (!catToDelete) return;
    try {
      await remove('categories', catToDelete);
      setCategories(prev => prev.filter(c => c.id !== catToDelete));
    } catch (err) {
      console.error('Delete category error:', err);
    }
    setCatToDelete(null);
  };

  // User CRUD
  const [userToDelete, setUserToDelete] = useState(null);

  const openAddUser = () => {
    setEditUser(null);
    setUserForm({ email: '', password: '', displayName: '', role: 'staff' });
    setUserError('');
    setShowPw(false);
    setUserModal(true);
  };

  const openEditUser = (u) => {
    setEditUser(u);
    setUserForm({ email: u.email || '', password: '', displayName: u.displayName || '', role: u.role || 'staff' });
    setUserError('');
    setUserModal(true);
  };

  const handleSaveUser = async () => {
    setUserError('');
    setUserLoading(true);
    try {
      if (editUser) {
        await update('users', editUser.id, {
          displayName: userForm.displayName,
          role: userForm.role,
        });
      } else {
        if (!userForm.email || !userForm.password) {
          setUserError('Email và mật khẩu là bắt buộc');
          setUserLoading(false);
          return;
        }
        if (userForm.password.length < 6) {
          setUserError('Mật khẩu phải ít nhất 6 ký tự');
          setUserLoading(false);
          return;
        }
        await createUserAccount(userForm.email, userForm.password, {
          displayName: userForm.displayName,
          role: userForm.role,
        });
      }
      const updatedUsers = await fetchUsers();
      setUsers(updatedUsers);
      setUserModal(false);
      setEditUser(null);
    } catch (err) {
      console.error('Save user error:', err);
      if (err.code === 'auth/email-already-in-use') {
        setUserError('Email đã được sử dụng');
      } else if (err.code === 'auth/weak-password') {
        setUserError('Mật khẩu quá yếu');
      } else {
        setUserError(err.message || 'Đã có lỗi xảy ra');
      }
    } finally {
      setUserLoading(false);
    }
  };

  const requestDeleteUser = (u) => {
    if (u.id === user?.uid) {
      setUserError('Không thể xóa tài khoản đang đăng nhập!');
      setUserModal(true);
      setTimeout(() => { setUserModal(false); setUserError(''); }, 2000);
      return;
    }
    setUserToDelete(u);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    try {
      await remove('users', userToDelete.id);
      setUsers(prev => prev.filter(x => x.id !== userToDelete.id));
    } catch (err) {
      console.error('Delete user error:', err);
    }
    setUserToDelete(null);
  };

  // Store info save → Firestore
  const handleSaveStoreInfo = async () => {
    setStoreSaving(true);
    try {
      await saveStoreInfo(storeInfo);
      setStoreSaved(true);
      setStoreInfoDirty(false); // Reset dirty — now safe to sync from Firestore again
      setTimeout(() => setStoreSaved(false), 2000);
    } catch (err) {
      console.error('Save store info error:', err);
    } finally {
      setStoreSaving(false);
    }
  };

  // Bank info save → Firestore
  const handleSaveBankInfo = async () => {
    setBankSaving(true);
    try {
      await saveBankInfo(bankInfo);
      setBankSaved(true);
      setBankInfoDirty(false); // Reset dirty — now safe to sync from Firestore again
      setTimeout(() => setBankSaved(false), 2000);
    } catch (err) {
      console.error('Save bank info error:', err);
    } finally {
      setBankSaving(false);
    }
  };

  const SectionTitle = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-2 mb-3 mt-6 first:mt-0">
      <Icon size={18} className="text-[var(--md-primary)]" />
      <h3 className="text-sm font-semibold text-[var(--md-on-surface)] uppercase tracking-wide">{title}</h3>
    </div>
  );

  return (
    <div className="p-4 max-w-lg mx-auto animate-fade-in pb-8">
      <h1 className="text-xl font-bold text-[var(--md-on-surface)] mb-1">Cài đặt</h1>
      <p className="text-xs text-[var(--md-on-surface-variant)] mb-4">
        {user?.email} • {isAdmin ? 'Admin' : 'Nhân viên'}
      </p>

      {/* ===== Connectivity ===== */}
      <SectionTitle icon={Signal} title="Kết nối" />
      <Card variant="elevated" className="p-4 space-y-4">
        {/* WiFi */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {netStatus.connected
              ? <Wifi size={20} className="text-[var(--md-primary)]" />
              : <WifiOff size={20} className="text-[var(--md-error)]" />
            }
            <div>
              <p className="text-sm font-medium text-[var(--md-on-surface)]">WiFi</p>
              <p className="text-xs text-[var(--md-on-surface-variant)]">
                {netStatus.connected ? 'Đã kết nối' : 'Mất kết nối'} • {netStatus.connectionType}
              </p>
            </div>
          </div>
          <div className={`w-2.5 h-2.5 rounded-full ${netStatus.connected ? 'bg-green-500' : 'bg-red-500'} ${netStatus.connected ? '' : 'animate-pulse'}`} />
        </div>

        <div className="border-t border-[var(--md-outline-variant)]" />

        {/* Printer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Printer size={20} className="text-[var(--md-primary)]" />
            <div>
              <p className="text-sm font-medium text-[var(--md-on-surface)]">Máy in</p>
              <p className="text-xs text-[var(--md-on-surface-variant)]">
                {printerStatus}
              </p>
            </div>
          </div>
          <button onClick={handleTestPrint}
             className="px-3 py-1.5 rounded-[var(--md-radius-xl)] bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-xs font-medium transition-all active:scale-95">
             Kiểm tra
          </button>
        </div>

        <div className="border-t border-[var(--md-outline-variant)]" />

        {/* Bluetooth */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Bluetooth size={20} className="text-[var(--md-tertiary)]" />
              <div>
                <p className="text-sm font-medium text-[var(--md-on-surface)]">Bluetooth</p>
                <p className="text-xs text-[var(--md-on-surface-variant)]">
                  {bleAvailable ? 'Sẵn sàng' : 'Không khả dụng (chỉ trên Mobile)'}
                </p>
              </div>
            </div>
            <button
              onClick={handleScan}
              disabled={scanning || !bleAvailable}
              className="px-3 py-1.5 rounded-[var(--md-radius-xl)] bg-[var(--md-tertiary-container)] text-[var(--md-on-tertiary-container)] text-xs font-medium transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <BluetoothSearching size={14} className={scanning ? 'animate-pulse' : ''} />
              {scanning ? 'Đang quét...' : 'Quét'}
            </button>
          </div>

          {bleDevices.length > 0 && (
            <div className="ml-8 space-y-2">
              {bleDevices.map(dev => (
                <div key={dev.deviceId} className="flex items-center justify-between p-2 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)]">
                  <div>
                    <p className="text-xs font-medium text-[var(--md-on-surface)]">{dev.name}</p>
                    <p className="text-[10px] text-[var(--md-on-surface-variant)]">RSSI: {dev.rssi}</p>
                  </div>
                  <button className="text-xs text-[var(--md-primary)] font-medium px-2 py-1 rounded-full hover:bg-[var(--md-primary-container)] transition-colors">
                    Kết nối
                  </button>
                </div>
              ))}
            </div>
          )}
          {scanning && (
            <div className="ml-8 flex items-center gap-2 text-xs text-[var(--md-on-surface-variant)]">
              <div className="w-4 h-4 border-2 border-[var(--md-tertiary)] border-t-transparent rounded-full animate-spin" />
              Đang tìm thiết bị...
            </div>
          )}
        </div>
      </Card>

      {/* ===== Appearance ===== */}
      <SectionTitle icon={isDark ? Moon : Sun} title="Giao diện" />
      <Card variant="elevated" className="p-4">
        <Toggle checked={isDark} onChange={toggleTheme} label="Chế độ tối" description="Chuyển đổi giữa giao diện sáng và tối" />
      </Card>

      {/* ===== Store Info (Admin) ===== */}
      {isAdmin && (
        <>
          <SectionTitle icon={Store} title="Thông tin cửa hàng" />
          <Card variant="elevated" className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Tên cửa hàng</label>
              <input type="text" value={storeInfo.storeName} onChange={e => { setStoreInfoDirty(true); setStoreInfo({ ...storeInfo, storeName: e.target.value }); }}
                className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Địa chỉ</label>
              <input type="text" value={storeInfo.address} onChange={e => { setStoreInfoDirty(true); setStoreInfo({ ...storeInfo, address: e.target.value }); }}
                className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
                placeholder="123 Đường ABC, Quận XYZ" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Số điện thoại</label>
              <input type="tel" value={storeInfo.phone} onChange={e => { setStoreInfoDirty(true); setStoreInfo({ ...storeInfo, phone: e.target.value }); }}
                className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
                placeholder="0909 123 456" />
            </div>
            <button onClick={handleSaveStoreInfo} disabled={storeSaving}
              className={`w-full h-10 rounded-[var(--md-radius-xl)] font-semibold text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60
                ${storeSaved ? 'bg-green-500 text-white' : 'bg-[var(--md-primary)] text-[var(--md-on-primary)]'}`}>
              {storeSaving
                ? <div className="w-4 h-4 border-2 border-[var(--md-on-primary)] border-t-transparent rounded-full animate-spin" />
                : <Save size={16} />}
              {storeSaved ? '✓ Đã lưu!' : storeSaving ? 'Đang lưu...' : 'Lưu thông tin cửa hàng'}
            </button>
          </Card>

          {/* ===== Bank Info (Admin) ===== */}
          <SectionTitle icon={CreditCard} title="Thông tin chuyển khoản" />
          <Card variant="elevated" className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Ngân hàng</label>
              <input type="text" value={bankInfo.bankName} onChange={e => { setBankInfoDirty(true); setBankInfo({ ...bankInfo, bankName: e.target.value }); }}
                className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
                placeholder="TPBank" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Số tài khoản</label>
              <input type="text" value={bankInfo.accountNumber} onChange={e => { setBankInfoDirty(true); setBankInfo({ ...bankInfo, accountNumber: e.target.value }); }}
                className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
                placeholder="18623082005" />
            </div>
            <div>
              <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Tên chủ tài khoản</label>
              <input type="text" value={bankInfo.accountName} onChange={e => { setBankInfoDirty(true); setBankInfo({ ...bankInfo, accountName: e.target.value }); }}
                className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
                placeholder="NGUYEN VAN A" />
            </div>
            <p className="text-[10px] text-[var(--md-on-surface-variant)] ml-1">
              💡 Tên ngân hàng dùng cho VietQR (ví dụ: TPBank, VietcomBank, MBBank...)
            </p>
            <button onClick={handleSaveBankInfo} disabled={bankSaving}
              className={`w-full h-10 rounded-[var(--md-radius-xl)] font-semibold text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-60
                ${bankSaved ? 'bg-green-500 text-white' : 'bg-[var(--md-primary)] text-[var(--md-on-primary)]'}`}>
              {bankSaving
                ? <div className="w-4 h-4 border-2 border-[var(--md-on-primary)] border-t-transparent rounded-full animate-spin" />
                : <Save size={16} />}
              {bankSaved ? '✓ Đã lưu!' : bankSaving ? 'Đang lưu...' : 'Lưu thông tin ngân hàng'}
            </button>
          </Card>
        </>
      )}

      {/* ===== Category Management (Admin) ===== */}
      {isAdmin && (
        <>
          <SectionTitle icon={FolderTree} title="Quản lý danh mục" />
          <Card variant="elevated" className="overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between p-4">
              <button
                onClick={() => setCatListCollapsed(v => !v)}
                className="flex items-center gap-2 flex-1 text-left active:opacity-70 transition-opacity"
              >
                {catListCollapsed
                  ? <ChevronRight size={18} className="text-[var(--md-on-surface-variant)]" />
                  : <ChevronDown size={18} className="text-[var(--md-on-surface-variant)]" />
                }
                <p className="text-sm text-[var(--md-on-surface-variant)]">
                  {categories.length} danh mục
                </p>
              </button>
              <button onClick={() => { setEditCat(null); setCatForm({ name: '', icon_name: 'coffee', sort_order: categories.length }); setCatError(''); setCatModal(true); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-xs font-medium transition-all active:scale-95">
                <Plus size={14} /> Thêm
              </button>
            </div>

            {/* Collapsible list */}
            {!catListCollapsed && (
              <div className="px-4 pb-4 space-y-2 border-t border-[var(--md-outline-variant)]">
                <div className="h-2" />
                {categories.length === 0 && (
                  <p className="text-sm text-center text-[var(--md-on-surface-variant)] py-2">Chưa có danh mục</p>
                )}
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)]">
                    <span className="text-sm text-[var(--md-on-surface)]">{cat.name}</span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditCat(cat); setCatForm({ name: cat.name, icon_name: cat.icon_name || 'coffee', sort_order: cat.sort_order || 0 }); setCatError(''); setCatModal(true); }}
                        className="p-1.5 rounded-full hover:bg-[var(--md-surface-container)] transition-colors">
                        <Edit size={14} className="text-[var(--md-on-surface-variant)]" />
                      </button>
                      <button onClick={() => requestDeleteCat(cat.id)}
                        className="p-1.5 rounded-full hover:bg-[var(--md-error)]/10 transition-colors">
                        <Trash2 size={14} className="text-[var(--md-error)]" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

      {/* ===== User Management (Admin) ===== */}
      {isAdmin && (
        <>
          <SectionTitle icon={Users} title="Quản lý nhân viên" />
          <Card variant="elevated" className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-[var(--md-on-surface-variant)]">{users.length} nhân viên</p>
              <button onClick={openAddUser}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-xs font-medium transition-all active:scale-95">
                <UserPlus size={14} /> Thêm
              </button>
            </div>
            <div className="space-y-2">
              {users.map(u => (
                <div key={u.id} className="flex items-center justify-between p-2.5 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)]">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--md-primary-container)] flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-[var(--md-on-primary-container)]">
                        {(u.displayName || u.email || '?')[0].toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--md-on-surface)] truncate">{u.displayName || u.email}</p>
                      <p className="text-xs text-[var(--md-on-surface-variant)] truncate">{u.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex items-center gap-1
                      ${u.role === 'admin' ? 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]' : 'bg-[var(--md-surface-container)] text-[var(--md-on-surface-variant)]'}`}>
                      {u.role === 'admin' && <Shield size={10} />}
                      {u.role === 'admin' ? 'Admin' : 'Staff'}
                    </span>
                    <button onClick={() => openEditUser(u)} className="p-1.5 rounded-full hover:bg-[var(--md-surface-container)] transition-colors">
                      <Edit size={14} className="text-[var(--md-on-surface-variant)]" />
                    </button>
                    <button onClick={() => requestDeleteUser(u)} className="p-1.5 rounded-full hover:bg-[var(--md-error)]/10 transition-colors">
                      <Trash2 size={14} className="text-[var(--md-error)]" />
                    </button>
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <p className="text-sm text-center text-[var(--md-on-surface-variant)] py-4">Chưa có nhân viên</p>
              )}
            </div>
          </Card>

          {/* History */}
          <SectionTitle icon={History} title="Lịch sử hóa đơn" />
          <Card variant="elevated" className="overflow-hidden">
            <button onClick={() => setHistoryModal(true)} className="w-full flex items-center justify-between p-4 bg-[var(--md-surface-container)] hover:bg-[var(--md-surface-container-high)] transition-colors active:opacity-70">
              <span className="font-medium text-sm text-[var(--md-on-surface)]">Xem danh sách biên lai</span>
              <ChevronRight size={18} className="text-[var(--md-on-surface-variant)]" />
            </button>
          </Card>
        </>
      )}

      {/* Logout */}
      <div className="mt-8">
        <button onClick={logout}
          className="w-full h-12 rounded-[var(--md-radius-xl)] bg-[var(--md-error)]/10 text-[var(--md-error)] font-semibold text-sm transition-all duration-200 active:scale-[0.98] flex items-center justify-center gap-2">
          <LogOut size={18} /> Đăng xuất
        </button>
      </div>

      {/* ===== Category Modal ===== */}
      <Modal open={catModal} onClose={() => { setCatModal(false); setEditCat(null); setCatError(''); }} title={editCat ? 'Sửa danh mục' : 'Thêm danh mục'}>
        <div className="space-y-4">
          {catError && (
            <div className="px-4 py-3 rounded-[var(--md-radius-md)] bg-[var(--md-error)]/10 text-[var(--md-error)] text-sm animate-slide-down">
              {catError}
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Tên danh mục</label>
            <input type="text" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })}
              className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
              placeholder="Tên danh mục" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Icon</label>
            <select value={catForm.icon_name} onChange={e => setCatForm({ ...catForm, icon_name: e.target.value })}
              className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors">
              <option value="coffee">☕ Coffee</option>
              <option value="ice_cream">🍦 Ice Cream</option>
              <option value="pizza">🍕 Pizza</option>
              <option value="sandwich">🥪 Sandwich</option>
              <option value="salad">🥗 Salad</option>
              <option value="cake">🍰 Cake</option>
              <option value="wine">🍷 Wine</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Thứ tự</label>
            <input type="number" value={catForm.sort_order} onChange={e => setCatForm({ ...catForm, sort_order: parseInt(e.target.value) || 0 })}
              className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors" />
          </div>
          <button onClick={handleSaveCat} disabled={!catForm.name.trim()}
            className="w-full h-12 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] font-semibold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-50">
            {editCat ? 'Cập nhật' : 'Thêm mới'}
          </button>
        </div>
      </Modal>

      {/* ===== User Modal ===== */}
      <Modal open={userModal} onClose={() => { setUserModal(false); setEditUser(null); }} title={editUser ? 'Sửa nhân viên' : 'Thêm nhân viên'}>
        <div className="space-y-4">
          {userError && (
            <div className="px-4 py-3 rounded-[var(--md-radius-md)] bg-[var(--md-error)]/10 text-[var(--md-error)] text-sm animate-slide-down">
              {userError}
            </div>
          )}

          {!editUser && (
            <>
              <div>
                <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Email *</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
                  placeholder="staff@example.com" />
              </div>
              <div>
                <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Mật khẩu *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full h-10 px-3 pr-10 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
                    placeholder="Ít nhất 6 ký tự" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--md-on-surface-variant)]">
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Tên hiển thị</label>
            <input type="text" value={userForm.displayName} onChange={e => setUserForm({ ...userForm, displayName: e.target.value })}
              className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
              placeholder="Nguyễn Văn A" />
          </div>

          <div>
            <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Vai trò</label>
            <div className="flex gap-2">
              {['staff', 'admin'].map(r => (
                <button key={r} onClick={() => setUserForm({ ...userForm, role: r })}
                  className={`flex-1 h-10 rounded-[var(--md-radius-sm)] text-sm font-medium transition-all flex items-center justify-center gap-1.5
                    ${userForm.role === r
                      ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)]'
                      : 'bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-container-high)]'
                    }`}>
                  {r === 'admin' && <Shield size={14} />}
                  {r === 'admin' ? 'Admin' : 'Nhân viên'}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSaveUser} disabled={userLoading}
            className="w-full h-12 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] font-semibold text-sm transition-all duration-200 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2">
            {userLoading ? (
              <div className="w-5 h-5 border-2 border-[var(--md-on-primary)] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>{editUser ? 'Cập nhật' : 'Tạo nhân viên'}</>
            )}
          </button>
        </div>
      </Modal>

      {/* ===== Delete Confirm Dialogs ===== */}
      <ConfirmDialog
        open={!!catToDelete}
        title="Xóa danh mục"
        message="Bạn có chắc chắn muốn xóa danh mục này không? Hành động này không thể hoàn tác."
        confirmText="Xóa danh mục"
        onConfirm={confirmDeleteCat}
        onClose={() => setCatToDelete(null)}
        type="danger"
      />

      <ConfirmDialog
        open={!!userToDelete}
        title="Xóa nhân viên"
        message={`Bạn có chắc chắn muốn xóa nhân viên "${userToDelete?.displayName || userToDelete?.email}" không? Lưu ý: Chỉ xóa dữ liệu trên hệ thống ứng dụng, tài khoản đăng nhập vẫn tồn tại.`}
        confirmText="Xóa nhân viên"
        onConfirm={confirmDeleteUser}
        onClose={() => setUserToDelete(null)}
        type="danger"
      />

      {/* ===== History Modal ===== */}
      <Modal open={historyModal} onClose={() => setHistoryModal(false)} title="Lịch sử hóa đơn" size="sheet">
        <div className="space-y-3 pb-8">
          {groupedOrders.length === 0 ? (
            <p className="text-sm text-center text-[var(--md-on-surface-variant)] py-4">Chưa có hóa đơn nào</p>
          ) : (
            groupedOrders.map(([day, orders]) => {
              const isCollapsed = collapsedDays[day];
              const dayTotal = orders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
              return (
                <Card key={day} variant="elevated" className="overflow-hidden">
                  <button onClick={() => toggleDay(day)} className="w-full flex items-center justify-between p-4 bg-[var(--md-surface-container)] hover:bg-[var(--md-surface-container-high)] transition-colors">
                    <div className="flex flex-col items-start gap-1">
                      <span className="font-bold text-sm text-[var(--md-on-surface)]">{day}</span>
                      <span className="text-xs text-[var(--md-on-surface-variant)]">{orders.length} đơn • <span className="text-[var(--md-primary)] font-bold">{formatCurrency(dayTotal)}</span></span>
                    </div>
                    {isCollapsed ? <ChevronRight size={20} className="text-[var(--md-on-surface-variant)]" /> : <ChevronDown size={20} className="text-[var(--md-on-surface-variant)]" />}
                  </button>
                  {!isCollapsed && (
                    <div className="p-2 space-y-2 bg-[var(--md-surface)]">
                      {orders.map(o => (
                        <div key={o.id} className="flex items-center justify-between p-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-lowest)] border border-[var(--md-surface-variant)]">
                          <div className="flex flex-col flex-1 min-w-0">
                            <span className="text-xs text-[var(--md-on-surface-variant)] mb-1">{(o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.timestamp)).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} • {o.cashier_name || 'Staff'}</span>
                            <span className="text-sm font-medium text-[var(--md-on-surface)] truncate pr-2">{o.items?.map(i => `${i.name} x${i.qty}`).join(', ') || 'Không có món'}</span>
                          </div>
                          <span className="text-sm font-bold text-[var(--md-primary)] ml-2 flex-shrink-0">{formatCurrency(o.total_amount || 0)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SettingPage;
