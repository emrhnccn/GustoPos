/**
 * GustoPOS – Client-Side Yazdırma Servisi
 * 
 * Bu modül, print server (localhost:9100) ile iletişim kurar
 * ve mutfak/hesap fişi formatları üretir.
 */

const PRINT_SERVER_URL = 'http://localhost:9100';

// ===================== PRINT SERVER İLETİŞİMİ =====================

/**
 * Print server'ın çalışıp çalışmadığını kontrol et
 */
export async function checkPrintServerStatus(): Promise<boolean> {
  try {
    const res = await fetch(`${PRINT_SERVER_URL}/health`, { 
      signal: AbortSignal.timeout(3000) 
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Windows'ta tanımlı yazıcıları print server'dan getir
 */
export async function getWindowsPrinters(): Promise<Array<{
  name: string;
  driverName: string;
  portName: string;
  status: string;
  shared: boolean;
}>> {
  try {
    const res = await fetch(`${PRINT_SERVER_URL}/printers`, {
      signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error('Yazıcı listesi alınamadı.');
    const data = await res.json();
    return data.printers || [];
  } catch (err: any) {
    console.error('Windows yazıcıları alınamadı:', err);
    return [];
  }
}

/**
 * Belirtilen yazıcıya metin gönder
 */
export async function sendToPrinter(printerName: string, text: string): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${PRINT_SERVER_URL}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName, text }),
      signal: AbortSignal.timeout(30000)
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Yazdırma hatası');
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message || 'Yazıcıya ulaşılamadı.' };
  }
}

// ===================== FİŞ FORMATLARI =====================

function padRight(text: string, width: number): string {
  if (text.length >= width) return text.substring(0, width);
  return text + ' '.repeat(width - text.length);
}

function padLeft(text: string, width: number): string {
  if (text.length >= width) return text.substring(0, width);
  return ' '.repeat(width - text.length) + text;
}

function centerText(text: string, width: number): string {
  if (text.length >= width) return text.substring(0, width);
  const pad = Math.floor((width - text.length) / 2);
  return ' '.repeat(pad) + text;
}

function line(char: string, width: number): string {
  return char.repeat(width);
}

interface ReceiptSettings {
  businessName: string;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  taxNo: string;
  footerLine1: string;
  footerLine2: string;
  footerLine3: string;
  showWaiterName: boolean;
  showDateTime: boolean;
  showOrderNote: boolean;
}

interface OrderItem {
  productName: string;
  quantity: number;
  unitPrice: number;
  note?: string | null;
  status: string;
  selectedModifiers?: string | null;
}

interface OrderData {
  tableName: string;
  waiterName: string;
  createdAt: string;
  items: OrderItem[];
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  note?: string | null;
  payments?: Array<{
    amount: number;
    paymentMethod: string;
  }>;
}

/**
 * Mutfak fişi metni oluştur (80mm termal yazıcı için 42 karakter genişliği)
 */
export function generateKitchenTicketText(
  items: Array<{
    productName: string;
    quantity: number;
    note?: string;
    selectedModifiers?: Array<{ name: string; price: number }>;
  }>,
  tableName: string,
  waiterName: string,
  paperWidth: number = 80
): string {
  const W = paperWidth === 58 ? 32 : 42; // karakter genişliği
  const lines: string[] = [];

  lines.push('');
  lines.push(centerText('*** SİPARİŞ FİŞİ ***', W));
  lines.push(line('=', W));
  lines.push('');
  
  // Masa ve garson bilgisi
  lines.push(padRight(`MASA: ${tableName}`, W));
  lines.push(padRight(`GARSON: ${waiterName}`, W));
  lines.push(padRight(`SAAT: ${new Date().toLocaleTimeString('tr-TR')}`, W));
  lines.push(padRight(`TARİH: ${new Date().toLocaleDateString('tr-TR')}`, W));
  
  lines.push(line('-', W));
  lines.push('');

  // Sipariş kalemleri
  items.forEach(item => {
    const qtyStr = `${item.quantity}x`;
    const itemLine = `${qtyStr} ${item.productName}`;
    lines.push(padRight(itemLine, W));
    
    // Modifiers
    if (item.selectedModifiers && item.selectedModifiers.length > 0) {
      const modText = '  + ' + item.selectedModifiers.map(m => m.name).join(', ');
      lines.push(padRight(modText, W));
    }
    
    // Not
    if (item.note) {
      lines.push(padRight(`  NOT: ${item.note}`, W));
    }
    
    lines.push('');
  });

  lines.push(line('=', W));
  lines.push(centerText(`TOPLAM: ${items.length} KALEM`, W));
  lines.push(centerText(`${items.reduce((s, i) => s + i.quantity, 0)} ADET`, W));
  lines.push(line('=', W));
  lines.push('');
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

/**
 * Hesap fişi metni oluştur (termal yazıcı için)
 */
export function generateReceiptText(
  orderData: OrderData,
  settings: ReceiptSettings,
  paperWidth: number = 80
): string {
  const W = paperWidth === 58 ? 32 : 42;
  const lines: string[] = [];
  const remaining = orderData.totalAmount - orderData.paidAmount;

  lines.push('');
  
  // İşletme Bilgileri
  if (settings.businessName) {
    lines.push(centerText(settings.businessName, W));
  }
  if (settings.addressLine1) {
    lines.push(centerText(settings.addressLine1, W));
  }
  if (settings.addressLine2) {
    lines.push(centerText(settings.addressLine2, W));
  }
  if (settings.phone) {
    lines.push(centerText(`TEL: ${settings.phone}`, W));
  }
  if (settings.taxNo) {
    lines.push(centerText(`VKN: ${settings.taxNo}`, W));
  }

  lines.push(line('-', W));
  lines.push(centerText('ADİSYON DETAYI', W));
  lines.push(line('-', W));
  
  // Masa, tarih, garson
  lines.push(`Masa: ${padLeft(orderData.tableName, W - 6)}`);
  
  if (settings.showDateTime) {
    const date = new Date(orderData.createdAt);
    lines.push(`Tarih: ${padLeft(date.toLocaleDateString('tr-TR'), W - 7)}`);
    lines.push(`Saat: ${padLeft(date.toLocaleTimeString('tr-TR'), W - 6)}`);
  }
  
  if (settings.showWaiterName) {
    lines.push(`Garson: ${padLeft(orderData.waiterName, W - 8)}`);
  }

  lines.push(line('-', W));

  // Ürünler
  const activeItems = orderData.items.filter(item => item.status !== 'CANCELLED');
  
  activeItems.forEach(item => {
    const modifiers = item.selectedModifiers ? JSON.parse(item.selectedModifiers) : [];
    const modTotal = modifiers.reduce((s: number, m: any) => s + m.price, 0);
    const displayPrice = item.unitPrice + modTotal;

    if (item.status === 'COMPLIMENTARY') {
      const left = `${item.quantity}x ${item.productName}`;
      const right = 'İkram';
      const space = W - left.length - right.length;
      lines.push(left + (space > 0 ? ' '.repeat(space) : ' ') + right);
    } else {
      const total = (displayPrice * item.quantity).toFixed(2);
      const left = `${item.quantity}x ${item.productName}`;
      const right = total;
      const space = W - left.length - right.length;
      lines.push(left + (space > 0 ? ' '.repeat(space) : ' ') + right);
    }
    
    // Modifiers göster
    if (modifiers.length > 0) {
      const modText = '  + ' + modifiers.map((m: any) => m.name).join(', ');
      lines.push(padRight(modText, W));
    }
  });

  lines.push(line('-', W));

  // Toplamlar
  const subtotal = activeItems
    .filter(i => i.status === 'ACTIVE')
    .reduce((sum, item) => {
      const mods = item.selectedModifiers ? JSON.parse(item.selectedModifiers) : [];
      const modTotal = mods.reduce((s: number, m: any) => s + m.price, 0);
      return sum + (item.unitPrice + modTotal) * item.quantity;
    }, 0);

  const subLabel = 'Ara Toplam:';
  const subVal = `${subtotal.toFixed(2)} TL`;
  lines.push(subLabel + padLeft(subVal, W - subLabel.length));

  if (orderData.discountAmount > 0) {
    const discLabel = 'İndirim:';
    const discVal = `-${orderData.discountAmount.toFixed(2)} TL`;
    lines.push(discLabel + padLeft(discVal, W - discLabel.length));
  }

  if (orderData.paidAmount > 0) {
    const paidLabel = 'Ödenen:';
    const paidVal = `${orderData.paidAmount.toFixed(2)} TL`;
    lines.push(paidLabel + padLeft(paidVal, W - paidLabel.length));
  }

  lines.push(line('=', W));
  
  const totalLabel = remaining <= 0 ? 'TOPLAM:' : 'KALAN:';
  const totalVal = `${(remaining <= 0 ? orderData.totalAmount : remaining).toFixed(2)} TL`;
  lines.push(totalLabel + padLeft(totalVal, W - totalLabel.length));
  
  lines.push(line('=', W));

  // Ödeme detayları
  if (orderData.payments && orderData.payments.length > 0) {
    lines.push('');
    lines.push(centerText('ÖDEME DETAYI', W));
    lines.push(line('-', W));
    orderData.payments.forEach(p => {
      const methodName = p.paymentMethod === 'CASH' ? 'Nakit' 
        : p.paymentMethod === 'CREDIT_CARD' ? 'Kredi Kartı' 
        : p.paymentMethod === 'MEAL_CARD' ? 'Yemek Kartı' 
        : 'Cari/Veresiye';
      const pLine = `${methodName}:`;
      const pVal = `${p.amount.toFixed(2)} TL`;
      lines.push(pLine + padLeft(pVal, W - pLine.length));
    });
  }

  // Sipariş notu
  if (settings.showOrderNote && orderData.note) {
    lines.push('');
    lines.push(line('-', W));
    lines.push(`Not: ${orderData.note}`);
  }

  lines.push('');
  lines.push(line('-', W));

  // Footer
  if (settings.footerLine1) lines.push(centerText(settings.footerLine1, W));
  if (settings.footerLine2) lines.push(centerText(settings.footerLine2, W));
  if (settings.footerLine3) lines.push(centerText(settings.footerLine3, W));

  lines.push('');
  lines.push('');
  lines.push('');

  return lines.join('\n');
}

// ===================== YAZDIRMA İŞLEMLERİ =====================

/**
 * Mutfak fişi yazdır – öğeleri kategori bazlı gruplara ayırıp ilgili yazıcılara gönder
 */
export async function printKitchenTickets(
  items: Array<{
    productName: string;
    quantity: number;
    note?: string;
    categoryId: string;
    selectedModifiers?: Array<{ name: string; price: number }>;
  }>,
  tableName: string,
  waiterName: string,
  printerAssignments: Array<{
    printerId: string;
    categoryId: string;
    printer: {
      windowsName: string;
      paperWidth: number;
    };
  }>
): Promise<Array<{ printerName: string; success: boolean; error?: string }>> {
  const results: Array<{ printerName: string; success: boolean; error?: string }> = [];
  
  // Yazıcı bazında öğeleri grupla
  const printerGroups: Map<string, {
    windowsName: string;
    paperWidth: number;
    items: typeof items;
  }> = new Map();

  for (const item of items) {
    // Bu kategorinin atandığı yazıcıları bul
    const assignments = printerAssignments.filter(a => a.categoryId === item.categoryId);
    
    for (const assignment of assignments) {
      const key = assignment.printerId;
      if (!printerGroups.has(key)) {
        printerGroups.set(key, {
          windowsName: assignment.printer.windowsName,
          paperWidth: assignment.printer.paperWidth,
          items: []
        });
      }
      printerGroups.get(key)!.items.push(item);
    }
  }

  // Her yazıcı grubunu yazdır
  for (const [, group] of printerGroups) {
    const ticketText = generateKitchenTicketText(
      group.items,
      tableName,
      waiterName,
      group.paperWidth
    );

    const result = await sendToPrinter(group.windowsName, ticketText);
    results.push({
      printerName: group.windowsName,
      ...result
    });
  }

  return results;
}

/**
 * Hesap fişi yazdır
 */
export async function printReceipt(
  orderData: OrderData,
  settings: ReceiptSettings,
  printerWindowsName: string,
  paperWidth: number = 80
): Promise<{ success: boolean; error?: string }> {
  const receiptText = generateReceiptText(orderData, settings, paperWidth);
  return sendToPrinter(printerWindowsName, receiptText);
}
