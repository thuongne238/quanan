import { useState, useEffect } from 'react';
import {
  Settings, Users, FolderTree, Wifi, WifiOff, Bluetooth, BluetoothSearching,
  Moon, Sun, Store, Phone, MapPin, ChevronRight, Plus, Trash2, Edit,
  LogOut, Shield, Signal, UserPlus, Eye, EyeOff, Save
} from 'lucide-react';
import Card from '../components/ui/Card';
import Toggle from '../components/ui/Toggle';
import Modal from '../components/ui/Modal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getNetworkStatus, addNetworkListener } from '../utils/network';
import { scanDevices, isBluetoothAvailable } from '../utils/bluetooth';
import { fetchCategories, fetchUsers, create, update, remove } from '../firebase/firestore';
import { createUserAccount } from '../firebase/auth';

const SettingPage = () => {
  const { isDark, toggleTheme } = useTheme();
  const { user, isAdmin, logout } = useAuth();

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
  // Users
  const [users, setUsers] = useState([]);
  const [userModal, setUserModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [userForm, setUserForm] = useState({ email: '', password: '', displayName: '', role: 'staff' });
  const [showPw, setShowPw] = useState(false);
  const [userLoading, setUserLoading] = useState(false);
  const [userError, setUserError] = useState('');
  // Store info
  const [storeInfo, setStoreInfo] = useState(() => {
    const saved = localStorage.getItem('pos-store-info');
    return saved ? JSON.parse(saved) : { storeName: 'POS Takeaway', address: '', phone: '' };
  });

  useEffect(() => {
    getNetworkStatus().then(setNetStatus);
    let cleanup;
    addNetworkListener(setNetStatus).then(fn => { cleanup = fn; });
    isBluetoothAvailable().then(setBleAvailable);

    if (isAdmin) {
      fetchCategories().then(setCategories).catch(console.error);
      fetchUsers().then(setUsers).catch(console.error);
    }
    return () => cleanup?.();
  }, [isAdmin]);

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

  // Category CRUD
  const [catToDelete, setCatToDelete] = useState(null);

  const handleSaveCat = async () => {
    try {
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

  const requestDeleteCat = (id) => {
    setCatToDelete(id);
  };

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
        // Update existing user role/displayName in Firestore
        await update('users', editUser.id, {
          displayName: userForm.displayName,
          role: userForm.role,
        });
      } else {
        // Create new user (Firebase Auth + Firestore)
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
      // Use the existing user error state to show this instead of alert
      setUserError('Không thể xóa tài khoản đang đăng nhập!');
      setUserModal(true); // Open modal just to show the error
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

  // Store info save
  const saveStoreInfo = () => {
    localStorage.setItem('pos-store-info', JSON.stringify(storeInfo));
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

      {/* ===== Store Info ===== */}
      <SectionTitle icon={Store} title="Thông tin cửa hàng" />
      <Card variant="elevated" className="p-4 space-y-3">
        <div>
          <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Tên cửa hàng</label>
          <input type="text" value={storeInfo.storeName} onChange={e => setStoreInfo({ ...storeInfo, storeName: e.target.value })} onBlur={saveStoreInfo}
            className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Địa chỉ</label>
          <input type="text" value={storeInfo.address} onChange={e => setStoreInfo({ ...storeInfo, address: e.target.value })} onBlur={saveStoreInfo}
            className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
            placeholder="123 Đường ABC, Quận XYZ" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[var(--md-on-surface-variant)] mb-1 ml-1">Số điện thoại</label>
          <input type="tel" value={storeInfo.phone} onChange={e => setStoreInfo({ ...storeInfo, phone: e.target.value })} onBlur={saveStoreInfo}
            className="w-full h-10 px-3 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)] text-sm text-[var(--md-on-surface)] border border-transparent focus:border-[var(--md-primary)] focus:outline-none transition-colors"
            placeholder="0909 123 456" />
        </div>
      </Card>

      {/* ===== Category Management (Admin) ===== */}
      {isAdmin && (
        <>
          <SectionTitle icon={FolderTree} title="Quản lý danh mục" />
          <Card variant="elevated" className="p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm text-[var(--md-on-surface-variant)]">{categories.length} danh mục</p>
              <button onClick={() => { setEditCat(null); setCatForm({ name: '', icon_name: 'coffee', sort_order: categories.length }); setCatModal(true); }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] text-xs font-medium transition-all active:scale-95">
                <Plus size={14} /> Thêm
              </button>
            </div>
            <div className="space-y-2">
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center justify-between p-2.5 rounded-[var(--md-radius-sm)] bg-[var(--md-surface-container-highest)]">
                  <span className="text-sm text-[var(--md-on-surface)]">{cat.name}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditCat(cat); setCatForm({ name: cat.name, icon_name: cat.icon_name || 'coffee', sort_order: cat.sort_order || 0 }); setCatModal(true); }}
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
      <Modal open={catModal} onClose={() => { setCatModal(false); setEditCat(null); }} title={editCat ? 'Sửa danh mục' : 'Thêm danh mục'}>
        <div className="space-y-4">
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

          {/* Only email+password when creating new */}
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
    </div>
  );
};

export default SettingPage;
