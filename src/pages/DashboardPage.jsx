import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ShoppingBag, DollarSign, Star, Calendar, BarChart3 } from 'lucide-react';
import Card from '../components/ui/Card';
import { formatCurrency } from '../utils/printer';
import { fetchOrders } from '../firebase/firestore';
import { useSettings } from '../context/SettingsContext';

const DashboardPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');

  const { storeInfo } = useSettings();
  const storeName = storeInfo.storeName || 'Cửa hàng';

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

  const now = new Date();
  const todayStr = now.toLocaleDateString('vi-VN');

  const filteredOrders = orders.filter(o => {
    if (!o.timestamp) return false;
    const orderDate = o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.timestamp);
    if (period === 'today') return orderDate.toLocaleDateString('vi-VN') === todayStr;
    if (period === 'week') {
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      return orderDate >= weekAgo;
    }
    if (period === 'month') {
      return orderDate.getMonth() === now.getMonth() && orderDate.getFullYear() === now.getFullYear();
    }
    return true;
  });

  const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
  const totalOrders = filteredOrders.length;
  const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  const itemCounts = {};
  filteredOrders.forEach(o => {
    o.items?.forEach(item => {
      if (!itemCounts[item.name]) itemCounts[item.name] = { name: item.name, count: 0, revenue: 0 };
      itemCounts[item.name].count += item.qty;
      itemCounts[item.name].revenue += item.price * item.qty;
    });
  });
  const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 5);

  const chartData = (() => {
    if (period === 'today') {
      const hours = Array.from({ length: 24 }, (_, i) => ({ name: `${i}h`, revenue: 0 }));
      filteredOrders.forEach(o => {
        const h = (o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.timestamp)).getHours();
        hours[h].revenue += o.total_amount || 0;
      });
      return hours.filter(h => h.revenue > 0);
    }
    const days = {};
    filteredOrders.forEach(o => {
      const d = (o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.timestamp)).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
      if (!days[d]) days[d] = { name: d, revenue: 0 };
      days[d].revenue += o.total_amount || 0;
    });
    return Object.values(days);
  })();

  const stats = [
    { label: 'Doanh thu', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'var(--md-primary)', bg: 'var(--md-primary-container)' },
    { label: 'Đơn hàng', value: totalOrders, icon: ShoppingBag, color: 'var(--md-tertiary)', bg: 'var(--md-tertiary-container)' },
    { label: 'TB/Đơn', value: formatCurrency(avgOrder), icon: TrendingUp, color: 'var(--md-secondary)', bg: 'var(--md-secondary-container)' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-[var(--md-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-6 animate-fade-in pb-10">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-2xl font-black text-[var(--md-on-surface)] leading-none">Báo cáo</h1>
          <p className="text-xs font-bold text-[var(--md-primary)] uppercase tracking-wider mt-2">{storeName}</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--md-surface-container-high)] rounded-full text-[10px] font-bold text-[var(--md-on-surface-variant)]">
          <Calendar size={12} /> {todayStr}
        </div>
      </div>

      {/* Period Selectors */}
      <div className="flex gap-2 p-1 bg-[var(--md-surface-container-highest)] rounded-2xl w-fit">
        {['today', 'week', 'month'].map(p => (
          <button 
            key={p} 
            onClick={() => setPeriod(p)}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${period === p ? 'bg-[var(--md-surface)] text-[var(--md-primary)] shadow-sm' : 'text-[var(--md-on-surface-variant)] opacity-70'}`}
          >
            {p === 'today' ? 'Hôm nay' : p === 'week' ? '7 ngày' : 'Tháng này'}
          </button>
        ))}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label} variant="elevated" className="p-3 border-none flex flex-col items-center justify-center text-center">
            <div className="w-10 h-10 rounded-2xl mb-2 flex items-center justify-center shadow-sm" style={{ backgroundColor: s.bg }}>
              <s.icon size={20} style={{ color: s.color }} />
            </div>
            <p className="text-sm font-black text-[var(--md-on-surface)] leading-tight">{s.value}</p>
            <p className="text-[9px] font-bold text-[var(--md-on-surface-variant)] uppercase mt-1 tracking-widest">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      <Card variant="elevated" className="p-4 border-none relative overflow-hidden">
        <div className="flex items-center gap-2 mb-6">
          <BarChart3 size={16} className="text-[var(--md-primary)]" />
          <h3 className="text-xs font-bold text-[var(--md-on-surface-variant)] uppercase tracking-widest">Xu hướng doanh thu</h3>
        </div>
        <div className="h-44">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--md-primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--md-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--md-outline-variant)" opacity={0.4} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold', fill: 'var(--md-on-surface-variant)' }} />
                <YAxis hide />
                <Tooltip
                  contentStyle={{ background: 'var(--md-surface-container-high)', border: 'none', borderRadius: '12px', fontSize: '10px', fontWeight: 'bold' }}
                  itemStyle={{ color: 'var(--md-on-surface)' }}
                  formatter={(v) => [formatCurrency(v), '']}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--md-primary)" fill="url(#revGrad)" strokeWidth={3} dot={{ r: 3, fill: 'var(--md-primary)' }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-xs font-bold opacity-30">KHÔNG CÓ DỮ LIỆU</div>
          )}
        </div>
      </Card>

      {/* Best Sellers */}
      <Card variant="elevated" className="p-4 border-none">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Star size={16} className="text-[var(--md-tertiary)]" />
            <h3 className="text-xs font-bold text-[var(--md-on-surface-variant)] uppercase tracking-widest">Món bán chạy</h3>
          </div>
        </div>
        {topItems.length > 0 ? (
          <div className="space-y-3">
            {topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3 p-2 rounded-xl bg-[var(--md-surface-container-lowest)]">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black
                  ${i === 0 ? 'bg-[var(--md-primary)] text-[var(--md-on-primary)] shadow-sm'
                  : i === 1 ? 'bg-[var(--md-secondary)] text-[var(--md-on-secondary)] shadow-sm'
                  : i === 2 ? 'bg-[var(--md-tertiary)] text-[var(--md-on-tertiary)] shadow-sm'
                  : 'bg-[var(--md-surface-container-high)] text-[var(--md-on-surface-variant)]'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[var(--md-on-surface)] truncate">{item.name}</p>
                  <p className="text-[10px] font-bold text-[var(--md-on-surface-variant)] opacity-70 uppercase">{item.count} phần đã bán</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-black text-[var(--md-primary)]">{formatCurrency(item.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs font-bold text-center py-4 opacity-30">CHƯA CÓ DỮ LIỆU</p>
        )}
      </Card>
    </div>
  );
};

export default DashboardPage;
