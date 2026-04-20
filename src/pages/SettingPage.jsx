import { useState, useEffect, useMemo } from 'react';
import {
  Settings, Users, FolderTree, Wifi, WifiOff, Bluetooth, BluetoothSearching,
  Moon, Sun, Store, Phone, MapPin, ChevronRight, ChevronDown, Plus, Trash2, Edit,
  LogOut, Shield, Signal, UserPlus, Eye, EyeOff, Save, History, Printer, CreditCard,
  Building2, Pencil
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
  const [userListModal, setUserListModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [userForm, setUserForm] = useState({ email: '', password: '', displayName: '', role: 'staff' });
  const [showPw, setShowPw] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState('');

  // Store layout modals
  const [storeModal, setStoreModal] = useState(false);
  const [bankModal, setBankModal] = useState(false);

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
      setTimeout(() => {
        setStoreSaved(false);
        setStoreModal(false);
      }, 1000);
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
      setTimeout(() => {
        setBankSaved(false);
        setBankModal(false);
      }, 1000);
    } catch (err) {
      console.error('Save bank info error:', err);
    } finally {
      setBankSaving(false);
    }
  };

  const SectionTitle = ({ icon: Icon, title }) => (
    <div className="flex items-center gap-2 mb-2 mt-5 first:mt-0">
      <Icon size={16} className="text-[var(--md-primary)]" />
      <h3 className="text-[11px] font-bold text-[var(--md-on-surface-variant)] uppercase tracking-wider">{title}</h3>
    </div>
  );

  return (
    <div className="p-4 max-w-lg mx-auto animate-fade-in pb-10">
      <h1 className="text-2xl font-black text-[var(--md-on-surface)] mb-4">Cài đặt</h1>

      {/* ===== Profile Quán ===== */}
      {isAdmin && (
        <Card variant="filled" 
          onClick={() => setStoreModal(true)}
          className="p-4 mb-6 bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] border-none cursor-pointer hover:opacity-90 transition-all active:scale-[0.98] relative overflow-hidden group"
        >
          <div className="relative z-10">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-[var(--md-primary)] flex items-center justify-center shadow-lg">
                  <Building2 size={24} className="text-[var(--md-on-primary)]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold leading-tight">{savedStoreInfo.storeName || 'Tên cửa hàng'}</h2>
                  <p className="text-xs opacity-80 flex items-center gap-1 mt-0.5">
                    <MapPin size={12} /> {savedStoreInfo.address || 'Chưa cập nhật địa chỉ'}
                  </p>
                </div>
              </div>
              <div className="p-2 bg-white/20 rounded-full">
                <Pencil size={16} />
              </div>
            </div>
            <div className="mt-4 flex gap-4 text-xs font-medium">
               <span className="flex items-center gap-1"><Phone size={12} /> {savedStoreInfo.phone || 'N/A'}</span>
               <span className="flex items-center gap-1"><CreditCard size={12} /> {savedBankInfo.bankName || 'Chưa có NH'}</span>
            </div>
          </div>
          {/* Decor background */}
          <div className="absolute -right-4 -bottom-4 opacity-10 group-hover:scale-110 transition-transform">
             <Store size={100} />
          </div>
        </Card>
      )}

      {/* ===== Quick Actions: Appearance & Network ===== */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card variant="elevated" className="p-3 flex flex-col justify-between">
           <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[var(--md-on-surface-variant)] uppercase">Giao diện</span>
              {isDark ? <Moon size={16}/> : <Sun size={16}/>}
           </div>
           <Toggle checked={isDark} onChange={toggleTheme} label="Chế độ tối" />
        </Card>
        
        <Card variant="elevated" className="p-3 flex flex-col justify-between cursor-pointer active:scale-[0.98] transition-transform" onClick={() => isAdmin && setBankModal(true)}>
           <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[var(--md-on-surface-variant)] uppercase">Thanh toán</span>
              <CreditCard size={16} className="text-[var(--md-primary)]"/>
           </div>
           <p className="text-xs text-[var(--md-on-surface-variant)] truncate">{savedBankInfo.accountNumber || 'Cài đặt QR'}</p>
        </Card>
      </div>

      {/* ===== Connectivity & Printer ===== */}
      <SectionTitle icon={Signal} title="Hệ thống & Kết nối" />
      <Card variant="elevated" className="p-0 overflow-hidden divide-y divide-[var(--md-outline-variant)]">
        {/* WiFi */}
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {netStatus.connected ? <Wifi size={18} className="text-green-500" /> : <WifiOff size={18} className="text-red-500" />}
            <span className="text-sm font-medium">Internet: {netStatus.connected ? 'Sẵn sàng' : 'Ngoại tuyến'}</span>
          </div>
          <div className={`w-2 h-2 rounded-full ${netStatus.connected ? 'bg-green-500' : 'bg-red-500'}`} />
        </div>
        
        {/* Printer */}
        <div className="p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Printer size={18} className="text-[var(--md-primary)]" />
            <div>
              <p className="text-sm font-medium">Máy in</p>
              <p className="text-[10px] text-[var(--md-on-surface-variant)]">{printerStatus}</p>
            </div>
          </div>
          <button onClick={handleTestPrint} className="text-[10px] font-bold text-[var(--md-primary)] bg-[var(--md-primary-container)] px-3 py-1 rounded-full active:scale-95 transition-transform">KIỂM TRA</button>
        </div>

        {/* Bluetooth */}
        <div className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <Bluetooth size={18} className="text-[var(--md-tertiary)]" />
              <div>
                <p className="text-sm font-medium text-[var(--md-on-surface)]">Bluetooth</p>
                <p className="text-[10px] text-[var(--md-on-surface-variant)]">
                  {bleAvailable ? 'Sẵn sàng' : 'Không khả dụng'}
                </p>
              </div>
            </div>
            <button
              onClick={handleScan}
              disabled={scanning || !bleAvailable}
              className="text-[10px] font-bold text-[var(--md-on-tertiary-container)] bg-[var(--md-tertiary-container)] px-3 py-1 rounded-full active:scale-95 transition-transform disabled:opacity-50 flex items-center gap-1"
            >
              {scanning ? 'ĐANG QUÉT' : 'QUÉT'}
            </button>
          </div>

          {bleDevices.length > 0 && (
            <div className="mt-2 space-y-1">
              {bleDevices.map(dev => (
                <div key={dev.deviceId} className="flex items-center justify-between p-2 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)]">
                  <div>
                    <p className="text-xs font-medium text-[var(--md-on-surface)]">{dev.name}</p>
                    <p className="text-[10px] text-[var(--md-on-surface-variant)]">RSSI: {dev.rssi}</p>
                  </div>
                  <button className="text-[10px] font-bold text-[var(--md-primary)] px-2 py-1 rounded-full bg-[var(--md-primary)]/10">
                    Kết nối
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* ===== Management Sections (Chỉ Admin) ===== */}
      {isAdmin && (
        <>
          <SectionTitle icon={FolderTree} title="Quản trị nội dung" />
          <div className="space-y-2">
            {/* Categories */}
            <Card variant="elevated" className="p-0 overflow-hidden">
               <button onClick={() => setCatListCollapsed(!catListCollapsed)} className="w-full p-4 flex items-center justify-between transition-colors active:bg-[var(--md-surface-container-high)]">
                  <div className="flex items-center gap-3">
                     <FolderTree size={18} />
                     <span className="text-sm font-medium">Danh mục sản phẩm ({categories.length})</span>
                  </div>
                  {catListCollapsed ? <ChevronRight size={18}/> : <ChevronDown size={18}/>}
               </button>
               {!catListCollapsed && (
                 <div className="px-4 pb-4 space-y-2 animate-slide-down border-t border-[var(--md-outline-variant)] pt-3">
                    <button onClick={() => { setEditCat(null); setCatForm({ name: '', icon_name: 'coffee', sort_order: categories.length }); setCatError(''); setCatModal(true); }} className="w-full py-2 border-2 border-dashed border-[var(--md-outline-variant)] rounded-lg text-xs font-bold text-[var(--md-on-surface-variant)] flex items-center justify-center gap-1 hover:border-[var(--md-primary)] hover:text-[var(--md-primary)] transition-colors active:scale-[0.98]">
                       <Plus size={14}/> THÊM DANH MỤC
                    </button>
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center justify-between bg-[var(--md-surface-container-highest)] p-2 rounded-lg">
                         <span className="text-sm">{cat.name}</span>
                         <div className="flex gap-1">
                            <button onClick={() => { setEditCat(cat); setCatForm({ name: cat.name, icon_name: cat.icon_name || 'coffee', sort_order: cat.sort_order || 0 }); setCatError(''); setCatModal(true); }} className="p-1.5 rounded-full hover:bg-[var(--md-surface-container)]"><Edit size={14}/></button>
                            <button onClick={() => requestDeleteCat(cat.id)} className="p-1.5 text-red-500 rounded-full hover:bg-[var(--md-error)]/10"><Trash2 size={14}/></button>
                         </div>
                      </div>
                    ))}
                 </div>
               )}
            </Card>

            {/* Users & History */}
            <div className="grid grid-cols-2 gap-2">
               <Card variant="elevated" className="p-4 flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform hover:bg-[var(--md-surface-container-high)]" onClick={() => setUserListModal(true)}>
                  <Users size={20} className="text-[var(--md-secondary)]" />
                  <span className="text-xs font-bold text-[var(--md-on-surface)]">Nhân viên</span>
               </Card>
               <Card variant="elevated" className="p-4 flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform hover:bg-[var(--md-surface-container-high)]" onClick={() => setHistoryModal(true)}>
                  <History size={20} className="text-[var(--md-tertiary)]" />
                  <span className="text-xs font-bold text-[var(--md-on-surface)]">Lịch sử đơn</span>
               </Card>
            </div>
          </div>
        </>
      )}

      {/* Logout */}
      <button onClick={logout} className="w-full mt-8 h-12 rounded-[var(--md-radius-xl)] bg-[var(--md-error)] text-[var(--md-on-error)] font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] shadow-sm hover:opacity-90">
        <LogOut size={18} /> Đăng xuất
      </button>

      {/* ================= MODALS ================= */}
      
      {/* Modal Cửa Hàng (Store) */}
      <Modal open={storeModal} onClose={() => setStoreModal(false)} title="Thông tin cửa hàng">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Tên cửa hàng</label>
            <input type="text" value={storeInfo.storeName} onChange={e => { setStoreInfoDirty(true); setStoreInfo({...storeInfo, storeName: e.target.value}); }} className="w-full h-12 px-4 bg-[var(--md-surface-container-highest)] rounded-[var(--md-radius-xl)] outline-none focus:ring-2 ring-[var(--md-primary)] text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Địa chỉ</label>
            <input type="text" value={storeInfo.address} onChange={e => { setStoreInfoDirty(true); setStoreInfo({...storeInfo, address: e.target.value}); }} className="w-full h-12 px-4 bg-[var(--md-surface-container-highest)] rounded-[var(--md-radius-xl)] outline-none focus:ring-2 ring-[var(--md-primary)] text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Số điện thoại</label>
            <input type="tel" value={storeInfo.phone} onChange={e => { setStoreInfoDirty(true); setStoreInfo({...storeInfo, phone: e.target.value}); }} className="w-full h-12 px-4 bg-[var(--md-surface-container-highest)] rounded-[var(--md-radius-xl)] outline-none focus:ring-2 ring-[var(--md-primary)] text-sm" />
          </div>
          <button onClick={handleSaveStoreInfo} disabled={storeSaving} className={`w-full mt-2 h-12 rounded-[var(--md-radius-xl)] font-bold flex items-center justify-center gap-2 text-sm transition-all duration-200 active:scale-[0.98] ${storeSaved ? 'bg-green-500 text-white' : 'bg-[var(--md-primary)] text-[var(--md-on-primary)]'}`}>
            {storeSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18}/>}
            {storeSaved ? 'Đã lưu thành công!' : 'LƯU THÔNG TIN'}
          </button>
        </div>
      </Modal>

      {/* Modal Ngân hàng (Bank) */}
      <Modal open={bankModal} onClose={() => setBankModal(false)} title="Thông tin chuyển khoản">
        <div className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Ngân hàng (VietQR)</label>
            <input type="text" value={bankInfo.bankName} placeholder="TPBank, MBBank, VCB..." onChange={e => { setBankInfoDirty(true); setBankInfo({...bankInfo, bankName: e.target.value}); }} className="w-full h-12 px-4 bg-[var(--md-surface-container-highest)] rounded-[var(--md-radius-xl)] outline-none focus:ring-2 ring-[var(--md-primary)] text-sm" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Số tài khoản</label>
            <input type="text" value={bankInfo.accountNumber} onChange={e => { setBankInfoDirty(true); setBankInfo({...bankInfo, accountNumber: e.target.value}); }} className="w-full h-12 px-4 bg-[var(--md-surface-container-highest)] rounded-[var(--md-radius-xl)] outline-none focus:ring-2 ring-[var(--md-primary)] text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Tên chủ tài khoản</label>
            <input type="text" value={bankInfo.accountName} onChange={e => { setBankInfoDirty(true); setBankInfo({...bankInfo, accountName: e.target.value}); }} className="w-full h-12 px-4 bg-[var(--md-surface-container-highest)] rounded-[var(--md-radius-xl)] outline-none focus:ring-2 ring-[var(--md-primary)] text-sm uppercase" />
          </div>
          <button onClick={handleSaveBankInfo} disabled={bankSaving} className={`w-full mt-2 h-12 rounded-[var(--md-radius-xl)] font-bold flex items-center justify-center gap-2 text-sm transition-all duration-200 active:scale-[0.98] ${bankSaved ? 'bg-green-500 text-white' : 'bg-[var(--md-primary)] text-[var(--md-on-primary)]'}`}>
            {bankSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save size={18}/>}
            {bankSaved ? 'Đã lưu thành công!' : 'LƯU QUÉT MÃ QR'}
          </button>
        </div>
      </Modal>

      {/* Modal User List */}
      <Modal open={userListModal} onClose={() => setUserListModal(false)} title="Quản lý nhân viên">
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-[var(--md-on-surface)]">{users.length} nhân viên</p>
            <button onClick={openAddUser}
              className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-xs font-bold transition-all active:scale-95 shadow-sm">
              <UserPlus size={14} /> THÊM MỚI
            </button>
          </div>
          <div className="space-y-2">
            {users.length === 0 && (
              <p className="text-center text-sm py-4 text-[var(--md-on-surface-variant)]">Chưa có dữ liệu</p>
            )}
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-[var(--md-radius-xl)] bg-[var(--md-surface-container-highest)]">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[var(--md-secondary-container)] flex items-center justify-center text-[var(--md-on-secondary-container)] shrink-0 shadow-sm">
                    <span className="font-bold">{(u.displayName || u.email || '?')[0].toUpperCase()}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[var(--md-on-surface)] truncate">{u.displayName || 'Nhân viên'}</p>
                    <p className="text-xs text-[var(--md-on-surface-variant)] truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 uppercase tracking-wide
                    ${u.role === 'admin' ? 'bg-[var(--md-tertiary-container)] text-[var(--md-on-tertiary-container)]' : 'bg-[var(--md-surface-variant)] text-[var(--md-on-surface-variant)]'}`}>
                    {u.role === 'admin' && <Shield size={10} />}
                    {u.role === 'admin' ? 'Admin' : 'Staff'}
                  </span>
                  <div className="flex flex-col gap-1 border-l border-[var(--md-outline-variant)] pl-2">
                    <button onClick={() => openEditUser(u)} className="p-1.5 rounded-full hover:bg-[var(--md-surface-container)] transition-colors"><Edit size={14} className="text-[var(--md-on-surface-variant)]" /></button>
                    <button onClick={() => requestDeleteUser(u)} className="p-1.5 rounded-full hover:bg-[var(--md-error)]/10 transition-colors"><Trash2 size={14} className="text-[var(--md-error)]" /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* Category Editor Modal & User Editor Modal (Dùng lại nội dung cũ, điều chỉnh UI nhẹ) */}
      <Modal open={catModal} onClose={() => { setCatModal(false); setEditCat(null); setCatError(''); }} title={editCat ? 'Sửa danh mục' : 'Thêm danh mục'}>
        <div className="space-y-4">
          {catError && <div className="p-3 rounded-lg bg-[var(--md-error)]/10 text-[var(--md-error)] text-sm">{catError}</div>}
          <div>
            <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Tên danh mục</label>
            <input type="text" value={catForm.name} onChange={e => setCatForm({ ...catForm, name: e.target.value })}
              className="w-full h-12 px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-surface-container-highest)] outline-none focus:ring-2 ring-[var(--md-primary)]" />
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div>
                <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Icon</label>
                <select value={catForm.icon_name} onChange={e => setCatForm({ ...catForm, icon_name: e.target.value })}
                  className="w-full h-12 px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-surface-container-highest)] outline-none">
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
                <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Thứ tự</label>
                <input type="number" value={catForm.sort_order} onChange={e => setCatForm({ ...catForm, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full h-12 px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-surface-container-highest)] outline-none" />
             </div>
          </div>
          <button onClick={handleSaveCat} disabled={!catForm.name.trim()}
            className="w-full h-12 mt-2 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] font-bold text-sm disabled:opacity-50 active:scale-[0.98] transition-transform">
            {editCat ? 'CẬP NHẬT' : 'THÊM MỚI'}
          </button>
        </div>
      </Modal>

      <Modal open={userModal} onClose={() => { setUserModal(false); setEditUser(null); }} title={editUser ? 'Sửa nhân viên' : 'Thêm nhân viên'}>
        <div className="space-y-4">
          {userError && <div className="p-3 rounded-lg bg-[var(--md-error)]/10 text-[var(--md-error)] text-sm">{userError}</div>}

          {!editUser && (
            <>
              <div>
                <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Email *</label>
                <input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })}
                  className="w-full h-12 px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-surface-container-highest)] outline-none focus:ring-2 ring-[var(--md-primary)]" placeholder="staff@example.com" />
              </div>
              <div>
                <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Mật khẩu *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })}
                    className="w-full h-12 px-4 pr-12 rounded-[var(--md-radius-xl)] bg-[var(--md-surface-container-highest)] outline-none focus:ring-2 ring-[var(--md-primary)]" placeholder="Ít nhất 6 ký tự" />
                  <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 p-1 opacity-60 hover:opacity-100">
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </>
          )}

          <div>
            <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Tên hiển thị</label>
            <input type="text" value={userForm.displayName} onChange={e => setUserForm({ ...userForm, displayName: e.target.value })}
              className="w-full h-12 px-4 rounded-[var(--md-radius-xl)] bg-[var(--md-surface-container-highest)] outline-none focus:ring-2 ring-[var(--md-primary)]" placeholder="Nguyễn Văn A" />
          </div>

          <div>
            <label className="text-[10px] font-bold ml-1 uppercase opacity-60">Vai trò</label>
            <div className="flex gap-2 mt-1">
              {['staff', 'admin'].map(r => (
                <button key={r} onClick={() => setUserForm({ ...userForm, role: r })}
                  className={`flex-1 h-12 rounded-[var(--md-radius-xl)] text-sm font-bold transition-all flex items-center justify-center gap-2
                    ${userForm.role === r ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)]' : 'bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface-variant)] border border-transparent'}`}>
                  {r === 'admin' && <Shield size={16} />}
                  {r === 'admin' ? 'Quản trị' : 'Nhân viên'}
                </button>
              ))}
            </div>
          </div>

          <button onClick={handleSaveUser} disabled={userLoading}
            className="w-full h-12 mt-2 rounded-[var(--md-radius-xl)] bg-[var(--md-primary)] text-[var(--md-on-primary)] font-bold text-sm transition-transform active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2">
            {userLoading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : (editUser ? 'CẬP NHẬT' : 'TẠO TÀI KHOẢN')}
          </button>
        </div>
      </Modal>

      {/* ===== Dialogs & History ===== */}
      <ConfirmDialog
        open={!!catToDelete} title="Xóa danh mục"
        message="Bạn có chắc chắn muốn xóa danh mục này? Hành động không thể hoàn tác." confirmText="Xóa luôn"
        onConfirm={confirmDeleteCat} onClose={() => setCatToDelete(null)} type="danger"
      />
      <ConfirmDialog
        open={!!userToDelete} title="Xóa nhân viên"
        message={`Xóa quyền truy cập của "${userToDelete?.displayName || userToDelete?.email}"? Tên nhân viên này vẫn có thể hiển thị trong Lịch sử giao dịch cũ.`} confirmText="Xóa nhân viên"
        onConfirm={confirmDeleteUser} onClose={() => setUserToDelete(null)} type="danger"
      />

      {/* History Modal */}
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
