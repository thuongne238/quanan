import { formatCurrency } from '../../utils/printer';

const ThermalBill = ({ order, storeInfo = {}, width = '58mm' }) => {
  const { storeName = 'Pos công thương', address = '', phone = '' } = storeInfo;

  const date = order?.timestamp?.toDate
    ? order.timestamp.toDate().toLocaleString('vi-VN')
    : new Date().toLocaleString('vi-VN');

  return (
    <div className={`thermal-bill ${width === '80mm' ? 'w-80mm' : ''}`}
      style={{ width, fontFamily: 'monospace', fontSize: '11px', padding: '4mm', background: '#fff', color: '#000' }}
    >
      <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14px', marginBottom: '4px' }}>
        {storeName}
      </div>
      {address && <div style={{ textAlign: 'center', fontSize: '10px' }}>{address}</div>}
      {phone && <div style={{ textAlign: 'center', fontSize: '10px' }}>ĐT: {phone}</div>}

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
      <div style={{ fontSize: '10px' }}>Ngày: {date}</div>
      {order?.cashier_name && <div style={{ fontSize: '10px' }}>Thu ngân: {order.cashier_name}</div>}

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ fontWeight: 'bold', borderBottom: '1px solid #000' }}>
            <td style={{ textAlign: 'left' }}>Món</td>
            <td style={{ textAlign: 'center' }}>SL</td>
            <td style={{ textAlign: 'right' }}>T.Tiền</td>
          </tr>
        </thead>
        <tbody>
          {order?.items?.map((item, i) => (
            <tr key={i}>
              <td style={{ textAlign: 'left', padding: '2px 0' }}>{item.name}</td>
              <td style={{ textAlign: 'center', padding: '2px 4px' }}>{item.qty}</td>
              <td style={{ textAlign: 'right', padding: '2px 0' }}>{formatCurrency(item.price * item.qty)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px' }}>
        <span>TỔNG CỘNG:</span>
        <span>{formatCurrency(order?.total_amount || 0)}</span>
      </div>

      <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />

      <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '8px' }}>Cảm ơn quý khách!</div>
      <div style={{ textAlign: 'center', fontSize: '9px' }}>--- Hẹn gặp lại ---</div>
    </div>
  );
};

export default ThermalBill;
