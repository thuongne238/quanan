// Thermal printer utility
// Generates print content and sends via window.print() or Bluetooth

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

export const generateBillHTML = (order, storeInfo = {}) => {
  const {
    storeName = 'Pos công thương',
    address = '',
    phone = '',
  } = storeInfo;

  const itemsRows = order.items.map(item => `
    <tr>
      <td style="text-align:left;padding:2px 0;">${item.name}</td>
      <td style="text-align:center;padding:2px 4px;">${item.qty}</td>
      <td style="text-align:right;padding:2px 0;">${formatCurrency(item.price * item.qty)}</td>
    </tr>
  `).join('');

  const date = order.timestamp?.toDate
    ? order.timestamp.toDate().toLocaleString('vi-VN')
    : new Date().toLocaleString('vi-VN');

  return `
    <div id="receipt-content" style="width:100%;font-family:'Courier Prime',monospace;font-size:12px;padding:2mm;">
      <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:4px;">${storeName}</div>
      ${address ? `<div style="text-align:center;font-size:10px;">${address}</div>` : ''}
      ${phone ? `<div style="text-align:center;font-size:10px;">ĐT: ${phone}</div>` : ''}
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      <div style="font-size:10px;">Ngày: ${date}</div>
      ${order.cashier_name ? `<div style="font-size:10px;">Thu ngân: ${order.cashier_name}</div>` : ''}
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr style="font-weight:bold;border-bottom:1px solid #000;">
            <td style="text-align:left;">Món</td>
            <td style="text-align:center;">SL</td>
            <td style="text-align:right;">T.Tiền</td>
          </tr>
        </thead>
        <tbody>${itemsRows}</tbody>
      </table>
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px;">
        <span>TỔNG CỘNG:</span>
        <span>${formatCurrency(order.total_amount)}</span>
      </div>
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      <div style="text-align:center;font-size:10px;margin-top:8px;">Cảm ơn quý khách!</div>
      <div style="text-align:center;font-size:9px;">--- Hẹn gặp lại ---</div>
    </div>
  `;
};

export const printBill = (order, storeInfo) => {
  const html = generateBillHTML(order, storeInfo);
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Hóa đơn</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
            
            @media print {
              @page {
                size: 58mm auto;
                margin: 0;
              }
              body { margin: 0; padding: 0; }
              #receipt-content {
                width: 100% !important;
                padding: 2mm !important;
                background: white !important;
                font-family: 'Courier Prime', monospace;
                font-size: 12px;
              }
              #receipt-content * { color: black !important; }
            }

            body {
              margin: 0;
              padding: 0;
              font-family: 'Courier Prime', monospace;
            }
          </style>
        </head>
        <body>${html}</body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      setTimeout(() => printWindow.close(), 500);
    }, 300);
  }
};
