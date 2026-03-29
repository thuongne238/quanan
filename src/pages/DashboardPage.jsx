import { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { TrendingUp, ShoppingBag, DollarSign, Star, Calendar } from 'lucide-react';
import Card from '../components/ui/Card';
import Chip from '../components/ui/Chip';
import { formatCurrency } from '../utils/printer';
import { fetchOrders } from '../firebase/firestore';

const DashboardPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('today');

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

  // Process data for charts
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

  // Best selling items
  const itemCounts = {};
  filteredOrders.forEach(o => {
    o.items?.forEach(item => {
      if (!itemCounts[item.name]) itemCounts[item.name] = { name: item.name, count: 0, revenue: 0 };
      itemCounts[item.name].count += item.qty;
      itemCounts[item.name].revenue += item.price * item.qty;
    });
  });
  const topItems = Object.values(itemCounts).sort((a, b) => b.count - a.count).slice(0, 5);

  // Revenue chart data (hourly for today, daily otherwise)
  const chartData = (() => {
    if (period === 'today') {
      const hours = Array.from({ length: 24 }, (_, i) => ({ name: `${i}h`, revenue: 0, orders: 0 }));
      filteredOrders.forEach(o => {
        const h = (o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.timestamp)).getHours();
        hours[h].revenue += o.total_amount || 0;
        hours[h].orders += 1;
      });
      return hours.filter(h => h.revenue > 0 || h.orders > 0);
    }
    const days = {};
    filteredOrders.forEach(o => {
      const d = (o.timestamp?.toDate ? o.timestamp.toDate() : new Date(o.timestamp)).toLocaleDateString('vi-VN');
      if (!days[d]) days[d] = { name: d, revenue: 0, orders: 0 };
      days[d].revenue += o.total_amount || 0;
      days[d].orders += 1;
    });
    return Object.values(days);
  })();

  const stats = [
    { label: 'Doanh thu', value: formatCurrency(totalRevenue), icon: DollarSign, color: 'var(--md-primary)' },
    { label: 'Đơn hàng', value: totalOrders, icon: ShoppingBag, color: 'var(--md-tertiary)' },
    { label: 'TB / Đơn', value: formatCurrency(avgOrder), icon: TrendingUp, color: 'var(--md-secondary)' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-3 border-[var(--md-primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-[var(--md-on-surface)]">Bảng Điều Khiển Công Thương Pos</h1>
          <p className="text-xs text-[var(--md-on-surface-variant)] mt-0.5 flex items-center gap-1">
            <Calendar size={12} /> {todayStr}
          </p>
        </div>
      </div>

      {/* Period chips */}
      <div className="flex gap-2">
        {[
          { key: 'today', label: 'Hôm nay' },
          { key: 'week', label: '7 ngày' },
          { key: 'month', label: 'Tháng này' },
        ].map(p => (
          <Chip key={p.key} label={p.label} selected={period === p.key} onClick={() => setPeriod(p.key)} />
        ))}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Card key={s.label} variant="elevated" className="p-3 text-center">
            <div className="w-9 h-9 rounded-full mx-auto mb-2 flex items-center justify-center"
              style={{ background: `color-mix(in srgb, ${s.color} 15%, transparent)` }}
            >
              <s.icon size={18} style={{ color: s.color }} />
            </div>
            <p className="text-base font-bold text-[var(--md-on-surface)] leading-tight">{s.value}</p>
            <p className="text-[10px] text-[var(--md-on-surface-variant)] mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      <Card variant="elevated" className="p-4">
        <h3 className="text-sm font-semibold text-[var(--md-on-surface)] mb-3">Biểu đồ doanh thu</h3>
        <div className="h-48">
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--md-primary)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--md-primary)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--md-outline-variant)" opacity={0.5} />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--md-on-surface-variant)' }} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--md-on-surface-variant)' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--md-surface-container)',
                    border: '1px solid var(--md-outline-variant)',
                    borderRadius: 'var(--md-radius-md)',
                    fontSize: '12px',
                  }}
                  formatter={(v) => [formatCurrency(v), 'Doanh thu']}
                />
                <Area type="monotone" dataKey="revenue" stroke="var(--md-primary)" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-[var(--md-on-surface-variant)]">
              Chưa có dữ liệu
            </div>
          )}
        </div>
      </Card>

      {/* Top selling */}
      <Card variant="elevated" className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Star size={16} className="text-[var(--md-tertiary)]" />
          <h3 className="text-sm font-semibold text-[var(--md-on-surface)]">Món bán chạy</h3>
        </div>
        {topItems.length > 0 ? (
          <div className="space-y-2.5">
            {topItems.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className={`
                  w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold
                  ${i === 0 ? 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)]'
                    : 'bg-[var(--md-surface-container-highest)] text-[var(--md-on-surface-variant)]'}
                `}>
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--md-on-surface)] truncate">{item.name}</p>
                  <p className="text-xs text-[var(--md-on-surface-variant)]">{item.count} phần</p>
                </div>
                <span className="text-sm font-semibold text-[var(--md-primary)]">
                  {formatCurrency(item.revenue)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-[var(--md-on-surface-variant)] text-center py-4">Chưa có dữ liệu</p>
        )}
      </Card>
    </div>
  );
};

export default DashboardPage;
