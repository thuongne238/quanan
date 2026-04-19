// Thermal printer utility for Sunmi V1S POS (Capacitor Native)
// Uses @kduma-autoid/capacitor-sunmi-printer plugin
// Fallback to window.print() on desktop/browser

import { Capacitor } from '@capacitor/core';

// Dynamically import Sunmi plugin only on native platform
let SunmiPrinter = null;
let AlignmentModeEnum = null;

const loadSunmiPlugin = async () => {
  if (SunmiPrinter) return true;
  if (!Capacitor.isNativePlatform()) return false;

  try {
    const mod = await import('@kduma-autoid/capacitor-sunmi-printer');
    SunmiPrinter = mod.SunmiPrinter;
    AlignmentModeEnum = mod.AlignmentModeEnum;
    return true;
  } catch (err) {
    console.warn('⚠️ Sunmi plugin not available:', err);
    return false;
  }
};

// Pre-load on startup
loadSunmiPlugin();

/**
 * Ensure the Sunmi printer service is bound and ready.
 * Plugin returns { status: 'FoundPrinter' | 'CheckPrinter' | 'NoPrinter' | 'LostPrinter' }
 * Retries up to 10 times with 500ms intervals (5 seconds total).
 */
const ensurePrinterReady = async () => {
  if (!SunmiPrinter) {
    const loaded = await loadSunmiPlugin();
    if (!loaded) return false;
  }

  try {
    // Check if already connected
    const status = await SunmiPrinter.getServiceStatus();
    console.log('📋 Printer status:', JSON.stringify(status));
    if (status?.status === 'FoundPrinter') {
      console.log('✅ Printer service already connected');
      return true;
    }
  } catch (e) {
    console.warn('⚠️ getServiceStatus failed:', e);
  }

  // Try to bind and poll for connection
  console.log('🔄 Binding printer service...');
  try {
    await SunmiPrinter.bindService();
  } catch (e) {
    console.warn('⚠️ bindService call failed:', e);
  }

  // Poll for connection up to 10 times (5 seconds)
  for (let i = 0; i < 10; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const status = await SunmiPrinter.getServiceStatus();
      console.log(`🔄 Poll ${i + 1}: status = ${status?.status}`);
      if (status?.status === 'FoundPrinter') {
        console.log(`✅ Printer service connected after ${(i + 1) * 500}ms`);
        return true;
      }
    } catch (e) {
      // continue polling
    }
  }

  console.error('❌ Printer service did not connect within 5 seconds');
  return false;
};

// ============================================
// Helpers
// ============================================

export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(amount);
};

/**
 * Format currency as plain text (no symbol for narrow receipts)
 */
const formatAmount = (amount) => {
  return new Intl.NumberFormat('vi-VN').format(amount) + 'đ';
};

// ============================================
// Sunmi Native Printing (Capacitor Plugin)
// ============================================

const printViaSunmi = async (order, storeInfo = {}) => {
  const loaded = await loadSunmiPlugin();
  if (!loaded || !SunmiPrinter) return false;

  const {
    storeName = 'Pos công thương',
    address = '',
    phone = '',
  } = storeInfo;

  // Read bank info from localStorage
  const bankInfo = (() => {
    try { return JSON.parse(localStorage.getItem('pos-bank-info') || '{}'); } catch { return {}; }
  })();
  const bankName = bankInfo.bankName || 'TPBank';
  const bankAccount = bankInfo.accountNumber || '18623082005';
  const bankHolder = bankInfo.accountName || 'NGUYEN CONG THUONG';

  try {
    // Ensure printer service is bound and ready
    const ready = await ensurePrinterReady();
    if (!ready) {
      console.error('❌ Printer service failed to initialize');
      return false;
    }

    // Initialize printer and enter buffer mode
    await SunmiPrinter.printerInit();
    await SunmiPrinter.enterPrinterBuffer({ clean: true });

    // === Header: Store name ===
    await SunmiPrinter.setAlignment({ alignment: AlignmentModeEnum.CENTER });
    await SunmiPrinter.setBold({ enable: true });
    await SunmiPrinter.setFontSize({ size: 28 });
    await SunmiPrinter.printText({ text: storeName + '\n' });

    // Address & phone
    if (address) {
      await SunmiPrinter.setFontSize({ size: 20 });
      await SunmiPrinter.setBold({ enable: false });
      await SunmiPrinter.printText({ text: address + '\n' });
    }
    if (phone) {
      await SunmiPrinter.setFontSize({ size: 20 });
      await SunmiPrinter.setBold({ enable: false });
      await SunmiPrinter.printText({ text: 'ĐT: ' + phone + '\n' });
    }

    // === Dashed line ===
    await SunmiPrinter.setFontSize({ size: 22 });
    await SunmiPrinter.printText({ text: '--------------------------------\n' });

    // === Date & Cashier ===
    await SunmiPrinter.setAlignment({ alignment: AlignmentModeEnum.LEFT });
    await SunmiPrinter.setFontSize({ size: 22 });
    await SunmiPrinter.setBold({ enable: false });

    const date = order.timestamp?.toDate
      ? order.timestamp.toDate().toLocaleString('vi-VN')
      : new Date().toLocaleString('vi-VN');
    await SunmiPrinter.printText({ text: 'Ngày: ' + date + '\n' });

    if (order.cashier_name) {
      await SunmiPrinter.printText({ text: 'Thu ngân: ' + order.cashier_name + '\n' });
    }
    if (order.payment_method) {
      const methodText = order.payment_method === 'transfer' ? 'CHUYỂN KHOẢN' : 'TIỀN MẶT';
      await SunmiPrinter.printText({ text: 'P.Thức: ' + methodText + '\n' });
    }

    await SunmiPrinter.printText({ text: '--------------------------------\n' });

    // === Items ===
    await SunmiPrinter.setBold({ enable: true });
    await SunmiPrinter.setFontSize({ size: 22 });

    // Column header
    await SunmiPrinter.printColumnsText({
      lines: [
        { text: 'Món', width: 16, align: AlignmentModeEnum.LEFT },
        { text: 'SL', width: 4, align: AlignmentModeEnum.CENTER },
        { text: 'T.Tiền', width: 12, align: AlignmentModeEnum.RIGHT },
      ]
    });

    await SunmiPrinter.setBold({ enable: false });
    await SunmiPrinter.printText({ text: '--------------------------------\n' });

    // Item rows
    if (order.items && order.items.length > 0) {
      for (const item of order.items) {
        await SunmiPrinter.printColumnsText({
          lines: [
            { text: item.name, width: 16, align: AlignmentModeEnum.LEFT },
            { text: 'x' + item.qty, width: 4, align: AlignmentModeEnum.CENTER },
            { text: formatAmount(item.price * item.qty), width: 12, align: AlignmentModeEnum.RIGHT },
          ]
        });
      }
    }

    await SunmiPrinter.printText({ text: '--------------------------------\n' });

    // === Total ===
    await SunmiPrinter.setBold({ enable: true });
    await SunmiPrinter.setFontSize({ size: 26 });
    await SunmiPrinter.printColumnsText({
      lines: [
        { text: 'TỔNG CỘNG:', width: 16, align: AlignmentModeEnum.LEFT },
        { text: formatAmount(order.total_amount || 0), width: 16, align: AlignmentModeEnum.RIGHT },
      ]
    });

    await SunmiPrinter.setFontSize({ size: 22 });
    await SunmiPrinter.setBold({ enable: false });
    await SunmiPrinter.printText({ text: '--------------------------------\n' });

    // === QR Code for transfer payment ===
    if (order.payment_method === 'transfer') {
      await SunmiPrinter.setAlignment({ alignment: AlignmentModeEnum.CENTER });
      await SunmiPrinter.setBold({ enable: true });
      await SunmiPrinter.setFontSize({ size: 22 });
      await SunmiPrinter.printText({ text: 'QUÉT MÃ ĐỂ THANH TOÁN\n' });
      await SunmiPrinter.setBold({ enable: false });

      // Bank abbreviation for VietQR URL (e.g. TPBank -> tpb)
      const bankCode = bankAccount;
      const qrContent = `https://img.vietqr.io/image/${bankName.toLowerCase().replace(/\s/g,'')}-${bankCode}-compact2.png?amount=${order.total_amount || 0}&addInfo=${encodeURIComponent(order.id || '')}&accountName=${encodeURIComponent(bankHolder)}`;
      await SunmiPrinter.printQRCode({
        content: qrContent,
        size: 8,
        error_correction: 1,
      });

      await SunmiPrinter.setFontSize({ size: 18 });
      await SunmiPrinter.printText({ text: `${bankName} - ${bankAccount}\n` });
      await SunmiPrinter.printText({ text: `${bankHolder}\n` });
      await SunmiPrinter.printText({ text: '--------------------------------\n' });
    }

    // === Footer ===
    await SunmiPrinter.setAlignment({ alignment: AlignmentModeEnum.CENTER });
    await SunmiPrinter.setFontSize({ size: 22 });
    await SunmiPrinter.printText({ text: 'Cảm ơn quý khách!\n' });
    await SunmiPrinter.setFontSize({ size: 20 });
    await SunmiPrinter.printText({ text: '--- Hẹn gặp lại ---\n' });

    // Feed paper
    await SunmiPrinter.lineWrap({ lines: 3 });

    // Commit buffer and print
    await SunmiPrinter.exitPrinterBuffer({ commit: true });

    console.log('✅ Printed via Sunmi Capacitor plugin');
    return true;
  } catch (err) {
    console.error('❌ Sunmi print error:', err);
    return false;
  }
};

// ============================================
// HTML Receipt (for window.print fallback)
// ============================================

export const generateBillHTML = (order, storeInfo = {}) => {
  const {
    storeName = 'Pos công thương',
    address = '',
    phone = '',
  } = storeInfo;

  // Read bank info from localStorage
  const bankInfo = (() => {
    try { return JSON.parse(localStorage.getItem('pos-bank-info') || '{}'); } catch { return {}; }
  })();
  const bankName = bankInfo.bankName || 'TPBank';
  const bankAccount = bankInfo.accountNumber || '18623082005';
  const bankHolder = bankInfo.accountName || 'NGUYEN CONG THUONG';

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

  const tableName = order.table_name ? `<div style="font-size:10px;">Bàn: ${order.table_name}</div>` : '';

  return `
    <div id="receipt-content" style="width:100%;font-family:'Courier Prime',monospace;font-size:12px;padding:2mm;">
      <div style="text-align:center;font-weight:bold;font-size:14px;margin-bottom:4px;">${storeName}</div>
      ${address ? `<div style="text-align:center;font-size:10px;">${address}</div>` : ''}
      ${phone ? `<div style="text-align:center;font-size:10px;">ĐT: ${phone}</div>` : ''}
      <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      <div style="font-size:10px;">Ngày: ${date}</div>
      ${tableName}
      ${order.cashier_name ? `<div style="font-size:10px;">Thu ngân: ${order.cashier_name}</div>` : ''}
      ${order.payment_method ? `<div style="font-size:10px;">P.Thức: ${order.payment_method === 'transfer' ? 'CHUYỂN KHOẢN' : 'TIỀN MẶT'}</div>` : ''}
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

      ${order.payment_method === 'transfer' ? `
      <div style="margin-top:12px;text-align:center;">
        <div style="font-size:10px;margin-bottom:4px;font-weight:bold;">QUÉT MÃ ĐỂ THANH TOÁN</div>
        <img src="https://img.vietqr.io/image/${bankName.toLowerCase().replace(/\s/g,'')}-${bankAccount}-compact2.png?amount=${order.total_amount || 0}&addInfo=${encodeURIComponent(order.id || '')}&accountName=${encodeURIComponent(bankHolder)}" 
             style="width:160px;height:160px;margin:0 auto;display:block;" 
             alt="VietQR" />
        <div style="font-size:9px;margin-top:4px;">${bankName} - ${bankAccount} - ${bankHolder}</div>
      </div>
      ` : ''}

      <div style="border-top:1px dashed #000;margin:6px 0;"></div>
      <div style="text-align:center;font-size:10px;margin-top:8px;">Cảm ơn quý khách!</div>
      <div style="text-align:center;font-size:9px;">--- Hẹn gặp lại ---</div>
    </div>
  `;
};

const printViaWindowPrint = (order, storeInfo) => {
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
              @page { size: 58mm auto; margin: 0; }
              body { margin: 0; padding: 0; }
              #receipt-content {
                width: 100% !important; padding: 2mm !important;
                background: white !important; font-family: 'Courier Prime', monospace; font-size: 12px;
              }
              #receipt-content * { color: black !important; }
              img { max-width: 100%; height: auto; }
            }
            body { margin: 0; padding: 0; font-family: 'Courier Prime', monospace; }
          </style>
        </head>
        <body>
          ${html}
          <script>
            document.addEventListener('DOMContentLoaded', function() {
              const images = document.querySelectorAll('img');
              let loaded = 0;
              if (images.length === 0) {
                window.focus(); window.print(); setTimeout(() => window.close(), 500);
              } else {
                images.forEach(img => {
                  if (img.complete) { check(); } else { img.onload = check; img.onerror = check; }
                });
              }
              function check() {
                loaded++;
                if (loaded === images.length) { window.focus(); window.print(); setTimeout(() => window.close(), 500); }
              }
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }
};

// ============================================
// Main Print Function
// ============================================

/**
 * Print a bill/receipt.
 * - On Sunmi V1S (Capacitor native): Uses Sunmi plugin → built-in thermal printer
 * - On Desktop/Browser: Falls back to window.print()
 */
export const printBill = async (order, storeInfo) => {
  console.log('🖨️ printBill called');

  // 1. Try Sunmi Capacitor plugin (native)
  if (Capacitor.isNativePlatform()) {
    console.log('📱 Native platform detected, trying Sunmi...');
    const success = await printViaSunmi(order, storeInfo);
    if (success) return;
    console.warn('⚠️ Sunmi print failed, falling back...');
  }

  // 2. Fallback to window.print()
  console.log('🖥️ Using window.print() fallback');
  printViaWindowPrint(order, storeInfo);
};

// ============================================
// Printer Info & Test
// ============================================

/**
 * Get printer status info
 */
export const getPrinterInfo = async () => {
  const isNative = Capacitor.isNativePlatform();

  if (!isNative) {
    return {
      isSunmiDevice: false,
      isNative: false,
      connected: false,
      model: null,
      printMethod: 'window.print() (Desktop)',
    };
  }

  const loaded = await loadSunmiPlugin();
  if (!loaded || !SunmiPrinter) {
    return {
      isSunmiDevice: false,
      isNative: true,
      connected: false,
      model: null,
      printMethod: 'Capacitor (Plugin not loaded)',
    };
  }

  try {
    // Ensure service is bound first
    const ready = await ensurePrinterReady();
    const status = await SunmiPrinter.getServiceStatus();
    const isConnected = status?.status === 'FoundPrinter';
    
    let model = null;
    if (isConnected) {
      try {
        const modelResult = await SunmiPrinter.getPrinterModel();
        model = modelResult?.model || null;
      } catch { /* ignore */ }
    }

    return {
      isSunmiDevice: true,
      isNative: true,
      connected: isConnected,
      model,
      printMethod: isConnected ? 'Sunmi Capacitor Plugin ✅' : `Sunmi (status: ${status?.status})`,
    };
  } catch (err) {
    return {
      isSunmiDevice: false,
      isNative: true,
      connected: false,
      model: null,
      printMethod: 'Error: ' + err.message,
    };
  }
};

/**
 * Test printer connection
 */
export const testPrinter = async () => {
  if (!Capacitor.isNativePlatform()) {
    return { success: true, method: 'window.print() (Desktop)' };
  }

  const loaded = await loadSunmiPlugin();
  if (!loaded || !SunmiPrinter) {
    return { success: false, method: 'none', error: 'Sunmi plugin không tải được' };
  }

  // Ensure service is bound
  const ready = await ensurePrinterReady();
  if (!ready) {
    return { success: false, method: 'Sunmi Plugin', error: 'Printer service không kết nối được' };
  }

  try {
    await SunmiPrinter.printerInit();
    await SunmiPrinter.enterPrinterBuffer({ clean: true });

    await SunmiPrinter.setAlignment({ alignment: AlignmentModeEnum.CENTER });
    await SunmiPrinter.setBold({ enable: true });
    await SunmiPrinter.setFontSize({ size: 28 });
    await SunmiPrinter.printText({ text: '=== TEST IN ===\n' });

    await SunmiPrinter.setBold({ enable: false });
    await SunmiPrinter.setFontSize({ size: 22 });
    await SunmiPrinter.printText({ text: 'Máy in Sunmi V1S\n' });
    await SunmiPrinter.printText({ text: 'Kết nối thành công!\n' });
    await SunmiPrinter.printText({ text: '--------------------------------\n' });
    await SunmiPrinter.printText({ text: new Date().toLocaleString('vi-VN') + '\n' });

    await SunmiPrinter.lineWrap({ lines: 3 });
    await SunmiPrinter.exitPrinterBuffer({ commit: true });

    return { success: true, method: 'Sunmi Capacitor Plugin' };
  } catch (err) {
    return { success: false, method: 'Sunmi Plugin', error: err.message };
  }
};
