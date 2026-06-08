'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  DollarSign, 
  CreditCard, 
  Percent, 
  Printer, 
  CheckCircle, 
  Plus, 
  UserCheck, 
  ArrowLeft,
  ChevronRight,
  Lock,
  ListFilter,
  Check
} from 'lucide-react';
import { UserSession, processPayment, applyDiscountApi, fetchCustomers } from '@/lib/api';

interface TableOrder {
  id: string;
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  createdAt: string;
  note: string | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    note: string | null;
    status: string;
    selectedModifiers?: string | null;
  }>;
  payments: Array<{
    id: string;
    amount: number;
    paymentMethod: string;
    createdAt: string;
    customer?: { name: string } | null;
  }>;
}

interface TableData {
  id: string;
  name: string;
  area: string;
  status: 'EMPTY' | 'OCCUPIED' | 'BILL_REQUESTED';
  activeOrderId: string | null;
  activeOrder: TableOrder | null;
}

interface CheckoutModalProps {
  user: UserSession;
  table: TableData;
  onCloseAction: () => void;
  refreshDataAction: () => Promise<void>;
}

export default function CheckoutModal({
  user,
  table,
  onCloseAction,
  refreshDataAction,
}: CheckoutModalProps) {
  const order = table.activeOrder;
  const remaining = order ? order.totalAmount - order.paidAmount : 0;

  // Ödeme Yöntemi: CASH, CREDIT_CARD, MEAL_CARD, CARI
  const [selectedMethod, setSelectedMethod] = useState<'CASH' | 'CREDIT_CARD' | 'MEAL_CARD' | 'CARI'>('CASH');

  // Cari Müşteri Listesi
  const [customers, setCustomers] = useState<Array<{ id: string; name: string; phone: string; balance: number }>>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');

  // Alman Usulü (Ürün Bazlı) Ödeme State'leri
  const [isSplitBilling, setIsSplitBilling] = useState<boolean>(false);
  const [splitQuantities, setSplitQuantities] = useState<Record<string, number>>({});

  // Numpad ve Ödeme Giriş State'leri
  const [paymentAmountInput, setPaymentAmountInput] = useState<string>('');

  // İndirim State'leri
  const [discountModalOpen, setDiscountModalOpen] = useState<boolean>(false);
  const [discountType, setDiscountType] = useState<'percentage' | 'amount'>('percentage');
  const [discountValue, setDiscountValue] = useState<string>('');
  
  // Güvenlik PIN State'leri
  const [adminPin, setAdminPin] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  
  // Yazdırma Önizleme Modalı State
  const [showReceipt, setShowReceipt] = useState<boolean>(false);

  // Garson ödeme kısıtlama onayı state'leri
  const [paymentAuthModalOpen, setPaymentAuthModalOpen] = useState<boolean>(false);
  const [paymentAuthPin, setPaymentAuthPin] = useState<string>('');
  const [paymentAuthError, setPaymentAuthError] = useState<string>('');

  // Cari müşterileri yükle
  useEffect(() => {
    async function loadCustomers() {
      try {
        const data = await fetchCustomers();
        setCustomers(data);
      } catch (err) {
        console.error('Cari müşteriler yüklenemedi:', err);
      }
    }
    loadCustomers();
  }, []);

  // Split billing modu açıldığında miktarları sıfırla
  useEffect(() => {
    if (isSplitBilling && order) {
      const initialQtys: Record<string, number> = {};
      order.items
        .filter((item) => item.status === 'ACTIVE' || item.status === 'COMPLIMENTARY')
        .forEach((item) => {
          initialQtys[item.id] = 0;
        });
      setSplitQuantities(initialQtys);
      setPaymentAmountInput('');
    }
  }, [isSplitBilling]);

  if (!order) {
    return (
      <div className="flex-1 flex items-center justify-center p-6 text-slate-400">
        Bu masada aktif bir adisyon bulunmuyor.
      </div>
    );
  }

  // Ürünlerin ek fiyat seçeneklerini parse et
  const getItemModifiersTotal = (item: any) => {
    const modifiers = item.selectedModifiers ? JSON.parse(item.selectedModifiers) : [];
    return modifiers.reduce((mSum: number, m: any) => mSum + m.price, 0);
  };

  // Alman Usulü Seçilen Ürün Toplamı
  const getSelectedSplitAmount = () => {
    return order.items
      .filter((item) => item.status === 'ACTIVE' || item.status === 'COMPLIMENTARY')
      .reduce((sum, item) => {
        const qtyToPay = splitQuantities[item.id] || 0;
        if (qtyToPay <= 0) return sum;
        const singlePrice = item.unitPrice + getItemModifiersTotal(item);
        return sum + singlePrice * qtyToPay;
      }, 0);
  };

  // Numpad Buton Tıklaması
  const handleNumPress = (val: string) => {
    if (isSplitBilling) return; // Alman usulü modunda numpad pasiftir
    if (val === 'C') {
      setPaymentAmountInput('');
    } else if (val === '.') {
      if (!paymentAmountInput.includes('.')) {
        setPaymentAmountInput(prev => prev === '' ? '0.' : prev + '.');
      }
    } else {
      setPaymentAmountInput(prev => prev + val);
    }
  };

  // Hızlı Tutar Seçenekleri
  const handleQuickAmount = (amount: number) => {
    if (isSplitBilling) return;
    if (amount > remaining) {
      setPaymentAmountInput(remaining.toFixed(2));
    } else {
      setPaymentAmountInput(amount.toString());
    }
  };

  const handleAllRemaining = () => {
    if (isSplitBilling) return;
    setPaymentAmountInput(remaining.toFixed(2));
  };

  // Alman Usulü Miktar Seçici
  const handleSplitQtyChange = (itemId: string, maxQty: number, increment: boolean) => {
    setSplitQuantities((prev) => {
      const current = prev[itemId] || 0;
      let next = increment ? current + 1 : current - 1;
      if (next < 0) next = 0;
      if (next > maxQty) next = maxQty;
      return { ...prev, [itemId]: next };
    });
  };

  // Ödeme İşlemini Kaydet
  const handlePaymentSubmit = async (bypassWaiterCheck: boolean = false) => {
    if (user.role === 'WAITER' && !bypassWaiterCheck) {
      setPaymentAuthModalOpen(true);
      setPaymentAuthPin('');
      setPaymentAuthError('');
      return;
    }

    let finalAmount = 0;
    let itemsToPayPayload = undefined;

    if (isSplitBilling) {
      // Alman Usulü Ödeme payload'ı
      itemsToPayPayload = Object.entries(splitQuantities)
        .filter(([_, qty]) => qty > 0)
        .map(([itemId, qty]) => ({
          orderItemId: itemId,
          quantityToPay: qty
        }));

      if (itemsToPayPayload.length === 0) {
        setErrorMessage('Lütfen ödeme almak için en az 1 ürün miktarı seçin.');
        return;
      }
      finalAmount = getSelectedSplitAmount();
    } else {
      // Normal tutar bazlı ödeme
      finalAmount = parseFloat(paymentAmountInput);
      if (isNaN(finalAmount) || finalAmount <= 0) {
        setErrorMessage('Lütfen geçerli bir ödeme tutarı girin.');
        return;
      }

      if (finalAmount > remaining + 0.01) {
        setErrorMessage(`Ödeme tutarı kalan bakiyeyi (${remaining.toFixed(2)} TL) aşamaz.`);
        return;
      }
    }

    if (selectedMethod === 'CARI' && !selectedCustomerId) {
      setErrorMessage('Lütfen veresiye yazılacak cari müşteriyi seçin.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const res = await processPayment(
        table.id, 
        finalAmount, 
        selectedMethod, 
        selectedMethod === 'CARI' ? selectedCustomerId : undefined,
        itemsToPayPayload
      );
      await refreshDataAction();
      
      setPaymentAmountInput('');
      setIsSplitBilling(false);
      setSuccessMessage(`${finalAmount.toFixed(2)} TL ödeme başarıyla alındı!`);
      
      if (res.isClosed || res.remaining <= 0) {
        setSuccessMessage('Hesap tamamen kapandı. Masa boşaltıldı!');
        setTimeout(() => {
          onCloseAction();
        }, 1500);
      } else {
        setTimeout(() => setSuccessMessage(''), 3000);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Ödeme sırasında hata oluştu.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentAuthSubmit = async () => {
    setPaymentAuthError('');
    try {
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: paymentAuthPin }),
      });
      if (!authRes.ok) {
        setPaymentAuthError('Hatalı yetkili PIN kodu!');
        return;
      }
      const authUser = await authRes.json();
      if (authUser.role !== 'CASHIER' && authUser.role !== 'MANAGER' && authUser.role !== 'ADMIN') {
        setPaymentAuthError('Ödeme almak için yetkiniz bulunmuyor! Kasiyer, Müdür veya Yönetici PIN kodu girin.');
        return;
      }
      setPaymentAuthModalOpen(false);
      await handlePaymentSubmit(true);
    } catch (err) {
      setPaymentAuthError('Yetkilendirme sırasında hata oluştu.');
    }
  };

  // İndirim Onayı
  const handleDiscountSubmit = async () => {
    setAuthError('');
    const val = parseFloat(discountValue);
    if (isNaN(val) || val <= 0) {
      setAuthError('Lütfen geçerli bir indirim değeri girin.');
      return;
    }

    try {
      // Admin PIN doğrula
      const authRes = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: adminPin }),
      });

      if (!authRes.ok) {
        setAuthError('Hatalı Yönetici PIN kodu!');
        return;
      }

      const adminUser = await authRes.json();
      if (adminUser.role !== 'ADMIN' && adminUser.role !== 'MANAGER') {
        setAuthError('Bu işlem için YÖNETİCİ veya MÜDÜR yetkisi gerekmektedir!');
        return;
      }

      // İndirimi uygula
      await applyDiscountApi(order.id, discountType, val, adminUser.id, user.id);
      await refreshDataAction();

      setSuccessMessage('İndirim başarıyla uygulandı.');
      setTimeout(() => setSuccessMessage(''), 3000);
      setDiscountModalOpen(false);
      setDiscountValue('');
      setAdminPin('');
    } catch (err: any) {
      setAuthError(err.message || 'İndirim uygulanırken hata oluştu.');
    }
  };

  // Adisyon Alt Toplamı (İptal edilmeyen tüm ürünler, modifier'lar dahil)
  const subtotal = order.items
    .filter(item => item.status === 'ACTIVE')
    .reduce((sum, item) => {
      const modTotal = getItemModifiersTotal(item);
      return sum + (item.unitPrice + modTotal) * item.quantity;
    }, 0);

  const displayPaymentAmount = isSplitBilling ? getSelectedSplitAmount() : parseFloat(paymentAmountInput || '0');

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden max-w-7xl mx-auto w-full md:p-4 gap-4">
      {/* Sol Panel: Sipariş Detayları ve Ödeme Geçmişi */}
      <div className="flex-1 flex flex-col glass-card md:rounded-2xl p-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
          <button
            onClick={onCloseAction}
            className="active-press flex items-center space-x-2 text-slate-400 hover:text-white transition duration-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="font-heading font-semibold text-sm">Kat Planına Dön</span>
          </button>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-slate-400">Hesap:</span>
            <span className="font-heading font-bold text-white text-base bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-xl">
              {table.name}
            </span>
          </div>
        </div>

        {/* Ödeme Modu Seçici */}
        <div className="flex bg-slate-950 p-1 border border-slate-800/80 rounded-xl mb-4 text-xs font-semibold">
          <button
            onClick={() => setIsSplitBilling(false)}
            className={`flex-1 text-center py-2 rounded-lg transition duration-150 cursor-pointer ${
              !isSplitBilling ? 'gradient-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Tutar Bazlı Ödeme
          </button>
          <button
            onClick={() => setIsSplitBilling(true)}
            className={`flex-1 text-center py-2 rounded-lg transition duration-150 cursor-pointer ${
              isSplitBilling ? 'gradient-accent text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Alman Usulü (Ürün Bazlı Ödeme)
          </button>
        </div>

        {/* İçerik */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
          
          {/* Sipariş Kalemleri Listesi */}
          <div className="flex-1 flex flex-col border border-slate-800/80 rounded-xl p-3 bg-slate-950/20 overflow-hidden">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
              {isSplitBilling ? 'Ödenen Ürünleri Seçin' : 'Adisyon Kalemleri'}
            </h3>
            
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs scrollbar-thin">
              {order.items
                .filter(item => item.status !== 'CANCELLED')
                .map((item) => {
                  const modTotal = getItemModifiersTotal(item);
                  const singlePrice = item.unitPrice + modTotal;
                  const isPaidItem = item.status === 'PAID';

                  return (
                    <div 
                      key={item.id} 
                      className={`flex justify-between items-center bg-slate-900/60 p-2.5 rounded-lg border transition ${
                        isPaidItem ? 'border-emerald-950 bg-emerald-950/5 opacity-55' : 'border-slate-800/50'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-200 flex items-center">
                          <span>{item.productName}</span>
                          {isPaidItem && (
                            <span className="ml-1.5 bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide">
                              Ödendi
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.quantity} adet × {singlePrice.toFixed(2)} TL
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="font-bold text-slate-100 text-right">
                          {item.status === 'COMPLIMENTARY' ? (
                            <span className="text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-full text-[10px]">İkram</span>
                          ) : (
                            `${(singlePrice * item.quantity).toFixed(2)} TL`
                          )}
                        </div>

                        {/* Alman Usulü Seçiciler */}
                        {isSplitBilling && !isPaidItem && (
                          <div className="flex items-center space-x-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
                            <button
                              onClick={() => handleSplitQtyChange(item.id, item.quantity, false)}
                              className="bg-slate-800 text-white w-5 h-5 rounded flex items-center justify-center font-bold text-xs"
                            >
                              -
                            </button>
                            <span className="w-5 text-center font-bold text-slate-200">
                              {splitQuantities[item.id] || 0}
                            </span>
                            <button
                              onClick={() => handleSplitQtyChange(item.id, item.quantity, true)}
                              className="bg-slate-800 text-white w-5 h-5 rounded flex items-center justify-center font-bold text-xs"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Yapılmış Ödemelerin Geçmişi */}
          <div className="w-full md:w-64 flex flex-col border border-slate-800/80 rounded-xl p-3 bg-slate-950/20 overflow-hidden">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Ödeme Geçmişi</h3>
            <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 text-xs scrollbar-thin">
              {order.payments.length === 0 ? (
                <div className="text-center py-8 text-slate-500 italic">Henüz ödeme yapılmadı.</div>
              ) : (
                order.payments.map((p) => (
                  <div key={p.id} className="flex justify-between items-center bg-emerald-950/15 border border-emerald-900/30 p-2.5 rounded-lg">
                    <div>
                      <div className="font-semibold text-emerald-400">
                        {p.paymentMethod === 'CASH' ? 'Nakit' : p.paymentMethod === 'CREDIT_CARD' ? 'Kredi Kartı' : p.paymentMethod === 'MEAL_CARD' ? 'Yemek Kartı' : 'Cari (Veresiye)'}
                      </div>
                      {p.customer && (
                        <div className="text-[9px] text-slate-400 font-semibold mt-0.5">
                          Müşteri: {p.customer.name}
                        </div>
                      )}
                      <div className="text-[9px] text-slate-500">
                        {new Date(p.createdAt).toLocaleTimeString('tr-TR')}
                      </div>
                    </div>
                    <div className="font-bold text-emerald-300">+{p.amount.toFixed(2)} TL</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sağ Panel: Tahsilat / NumPad & Hesap Kapatma Arayüzü */}
      <div className="w-full md:w-96 flex flex-col glass-card md:rounded-2xl p-4 overflow-hidden border-t md:border-t-0 md:border-l border-slate-800">
        
        {/* Hesap Özeti Kartı */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-2 mb-4">
          <div className="flex justify-between text-xs text-slate-400">
            <span>Ara Toplam (Brüt)</span>
            <span className="font-semibold text-slate-200">{subtotal.toFixed(2)} TL</span>
          </div>
          {order.discountAmount > 0 && (
            <div className="flex justify-between text-xs text-rose-400">
              <span>Uygulanan İndirim</span>
              <span className="font-semibold">- {order.discountAmount.toFixed(2)} TL</span>
            </div>
          )}
          <div className="flex justify-between text-xs text-emerald-400">
            <span>Ödenen Tutar</span>
            <span className="font-semibold">+ {order.paidAmount.toFixed(2)} TL</span>
          </div>
          <div className="border-t border-slate-800/80 pt-2 flex justify-between items-center">
            <span className="text-sm font-bold text-white">Kalan Bakiye</span>
            <span className="text-xl font-heading font-black text-indigo-300">
              {remaining.toFixed(2)} TL
            </span>
          </div>
        </div>

        {/* Ödeme Yöntemi Seçici */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <button
            onClick={() => setSelectedMethod('CASH')}
            className={`active-press py-3 rounded-xl border flex flex-col items-center justify-center space-y-1 transition duration-150 cursor-pointer ${
              selectedMethod === 'CASH'
                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/10'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4 text-emerald-400" />
            <span className="text-[10px] font-semibold">Nakit</span>
          </button>

          <button
            onClick={() => setSelectedMethod('CREDIT_CARD')}
            className={`active-press py-3 rounded-xl border flex flex-col items-center justify-center space-y-1 transition duration-150 cursor-pointer ${
              selectedMethod === 'CREDIT_CARD'
                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/10'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <CreditCard className="w-4 h-4 text-indigo-400" />
            <span className="text-[10px] font-semibold">Kart</span>
          </button>

          <button
            onClick={() => setSelectedMethod('MEAL_CARD')}
            className={`active-press py-3 rounded-xl border flex flex-col items-center justify-center space-y-1 transition duration-150 cursor-pointer ${
              selectedMethod === 'MEAL_CARD'
                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/10'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <DollarSign className="w-4 h-4 text-orange-400" />
            <span className="text-[10px] font-semibold">Yemek K.</span>
          </button>

          <button
            onClick={() => setSelectedMethod('CARI')}
            className={`active-press py-3 rounded-xl border flex flex-col items-center justify-center space-y-1 transition duration-150 cursor-pointer ${
              selectedMethod === 'CARI'
                ? 'bg-indigo-500/10 border-indigo-500 text-indigo-300 shadow-md shadow-indigo-500/10'
                : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-semibold">Cari/Veresiye</span>
          </button>
        </div>

        {/* Cari Müşteri Seçimi (Sadece CARI seçildiğinde görünür) */}
        {selectedMethod === 'CARI' && (
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 mb-4 space-y-2">
            <label className="block text-xs font-semibold text-slate-300">Cari Hesabı Seçin</label>
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-lg p-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="">-- Müşteri Seçin --</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} - ({c.phone}) - Bakiye: {c.balance.toFixed(2)} TL
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Tutar Giriş Alanı */}
        <div className="relative mb-3">
          <input
            type="text"
            readOnly
            value={displayPaymentAmount ? `${displayPaymentAmount.toFixed(2)} TL` : '0.00 TL'}
            placeholder="0.00 TL"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl py-3 px-4 text-center font-heading font-black text-lg text-white placeholder-slate-700 focus:outline-none"
          />
          {!isSplitBilling && paymentAmountInput && (
            <button
              onClick={() => setPaymentAmountInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Nümeric Klavye (NumPad) */}
        <div className="grid grid-cols-3 gap-1.5 mb-4">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'C'].map((num) => (
            <button
              key={num}
              onClick={() => handleNumPress(num)}
              disabled={isSplitBilling}
              className="active-press bg-slate-900 hover:bg-slate-800 disabled:opacity-40 border border-slate-800/80 text-slate-200 font-semibold py-2.5 rounded-xl transition text-sm cursor-pointer"
            >
              {num}
            </button>
          ))}
        </div>

        {/* Hızlı Ödeme Miktarları */}
        <div className="grid grid-cols-4 gap-1.5 mb-4">
          {[50, 100, 200, 500].map((amt) => (
            <button
              key={amt}
              onClick={() => handleQuickAmount(amt)}
              disabled={isSplitBilling}
              className="active-press bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 font-semibold py-1.5 rounded-lg text-[10px] cursor-pointer"
            >
              {amt} TL
            </button>
          ))}
        </div>

        <button
          onClick={handleAllRemaining}
          disabled={isSplitBilling}
          className="active-press w-full bg-indigo-500/10 hover:bg-indigo-500/20 disabled:opacity-40 border border-indigo-500/30 text-indigo-300 font-semibold py-2 rounded-xl text-xs mb-4 cursor-pointer"
        >
          Kalan Tutarı Doldur ({remaining.toFixed(2)} TL)
        </button>

        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-300 p-2 rounded-xl text-xs mb-3 animate-pulse">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-2 rounded-xl text-xs mb-3">
            {errorMessage}
          </div>
        )}

        {/* Alt İşlem Butonları */}
        <div className="grid grid-cols-3 gap-2.5 border-t border-slate-800 pt-4">
          <button
            onClick={() => setDiscountModalOpen(true)}
            className="active-press bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 rounded-xl flex flex-col items-center justify-center space-y-1 transition text-[10px] cursor-pointer shadow-lg shadow-amber-600/10"
          >
            <Percent className="w-4 h-4" />
            <span>İndirim Yap</span>
          </button>

          <button
            onClick={() => setShowReceipt(true)}
            className="active-press bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold py-3 rounded-xl border border-slate-700 flex flex-col items-center justify-center space-y-1 transition text-[10px] cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Fiş Önizle</span>
          </button>

          <button
            onClick={() => handlePaymentSubmit(false)}
            disabled={(isSplitBilling ? getSelectedSplitAmount() <= 0 : !paymentAmountInput) || isLoading}
            className="active-press bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl flex flex-col items-center justify-center space-y-1 transition text-[10px] cursor-pointer shadow-lg shadow-emerald-600/10"
          >
            <CheckCircle className="w-4 h-4" />
            <span>{isLoading ? 'Tahsil ediliyor' : 'Ödeme Al'}</span>
          </button>
        </div>
      </div>

      {/* DISCOUNT MODAL */}
      {discountModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in">
            <h3 className="font-heading font-bold text-base text-white mb-2 flex items-center space-x-2">
              <Percent className="w-5 h-5 text-amber-400" />
              <span>Adisyon İndirimi</span>
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              Bu işlem yetkili onayı gerektirir. Lütfen indirim tipini, değerini ve <strong>Müdür PIN</strong> kodunu girin.
            </p>

            <div className="space-y-4">
              {/* Discount Type */}
              <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setDiscountType('percentage')}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition ${
                    discountType === 'percentage' ? 'gradient-primary text-white' : 'text-slate-400'
                  }`}
                >
                  Yüzde (%)
                </button>
                <button
                  onClick={() => setDiscountType('amount')}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition ${
                    discountType === 'amount' ? 'gradient-primary text-white' : 'text-slate-400'
                  }`}
                >
                  Tutar (TL)
                </button>
              </div>

              {/* Discount Value */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  {discountType === 'percentage' ? 'İndirim Yüzdesi (%)' : 'İndirim Tutarı (TL)'}
                </label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'Örn: 10' : 'Örn: 50'}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Admin PIN */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Müdür PIN Kodu</label>
                <input
                  type="password"
                  maxLength={4}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-center text-lg font-bold tracking-widest text-slate-100 focus:outline-none focus:border-amber-500"
                />
              </div>

              {authError && (
                <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-2 rounded-xl text-xs">
                  {authError}
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    setDiscountModalOpen(false);
                    setDiscountValue('');
                    setAdminPin('');
                    setAuthError('');
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleDiscountSubmit}
                  disabled={!discountValue || adminPin.length < 4}
                  className="flex-1 bg-amber-650 hover:bg-amber-550 disabled:opacity-50 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  İndirimi Uygula
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THERMAL RECEIPT PREVIEW MODAL */}
      {showReceipt && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white text-slate-950 w-full max-w-sm rounded-lg p-6 shadow-2xl font-mono text-xs flex flex-col relative max-h-[90vh] animate-scale-in">
            <button
              onClick={() => setShowReceipt(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Receipt Content */}
            <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin">
              <div className="text-center">
                <h2 className="text-base font-bold uppercase tracking-wider">GUSTO RESTORAN</h2>
                <p className="text-[10px] text-slate-600">CADDE NO: 12 ATAŞEHİR / İSTANBUL</p>
                <p className="text-[10px] text-slate-600">TEL: 0216 555 4433</p>
                <p className="text-[10px] text-slate-600">---------------------------------</p>
                <p className="text-[10px] font-bold">ADİSYON DETAYI</p>
                <p className="text-[10px] text-slate-600">---------------------------------</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Masa:</span>
                  <span className="font-bold">{table.name}</span>
                </div>
                <div className="flex justify-between">
                  <span>Tarih:</span>
                  <span>{new Date(order.createdAt).toLocaleDateString('tr-TR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Saat:</span>
                  <span>{new Date(order.createdAt).toLocaleTimeString('tr-TR')}</span>
                </div>
                <div className="flex justify-between">
                  <span>Garson:</span>
                  <span>{user.name}</span>
                </div>
              </div>

              <div>
                <p className="text-slate-600">---------------------------------</p>
                <div className="space-y-1">
                  {order.items
                    .filter(item => item.status !== 'CANCELLED')
                    .map((item, idx) => {
                      const modTotal = getItemModifiersTotal(item);
                      const displayPrice = item.unitPrice + modTotal;

                      return (
                        <div key={idx} className="flex justify-between">
                          <span className="truncate max-w-[200px]">
                            {item.quantity}x {item.productName}
                          </span>
                          <span>
                            {item.status === 'COMPLIMENTARY' ? 'İkram' : `${(displayPrice * item.quantity).toFixed(2)}`}
                          </span>
                        </div>
                      );
                    })}
                </div>
                <p className="text-slate-600">---------------------------------</p>
              </div>

              <div className="space-y-1 text-right">
                <div className="flex justify-between">
                  <span>Ara Toplam:</span>
                  <span>{subtotal.toFixed(2)} TL</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-slate-700">
                    <span>Uygulanan İndirim:</span>
                    <span>-{order.discountAmount.toFixed(2)} TL</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-700">
                  <span>Ödenen Tutar:</span>
                  <span>{order.paidAmount.toFixed(2)} TL</span>
                </div>
                <div className="flex justify-between font-bold text-sm border-t border-dashed border-slate-400 pt-1">
                  <span>Kalan Borç:</span>
                  <span>{remaining.toFixed(2)} TL</span>
                </div>
              </div>

              <div className="text-center pt-4">
                <p className="text-[10px] text-slate-500">BİZİ TERCİH ETTİĞİNİZ İÇİN</p>
                <p className="text-[10px] text-slate-500">TEŞEKKÜR EDERİZ.</p>
                <p className="text-[10px] text-slate-500">GUSTOPOS RESTORAN YAZILIMI</p>
              </div>
            </div>

            <button
              onClick={() => {
                alert('Yazdırma işlemi simüle edildi (Termal Fiş Gönderildi).');
                setShowReceipt(false);
              }}
              className="mt-4 w-full bg-slate-900 hover:bg-slate-800 text-white py-2 rounded font-bold transition flex items-center justify-center space-x-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>Yazıcıya Gönder</span>
            </button>
          </div>
        </div>
      )}

      {/* WAITER PAYMENT AUTH MODAL */}
      {paymentAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-base text-white mb-2 flex items-center space-x-2">
              <Lock className="w-5 h-5 text-indigo-400" />
              <span>Ödeme Yetki Onayı</span>
            </h3>
            <p className="text-[11px] text-slate-400 mb-4 font-sans">
              Garsonların ödeme alması kısıtlanmıştır. Lütfen ödemeyi tamamlamak için bir <strong>Kasiyer, Müdür veya Yönetici PIN</strong> kodu girin.
            </p>

            <div className="space-y-4 font-sans">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Yetkili PIN Kodu</label>
                <input
                  type="password"
                  maxLength={4}
                  value={paymentAuthPin}
                  onChange={(e) => setPaymentAuthPin(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 px-3 text-center text-lg font-bold tracking-widest text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {paymentAuthError && (
                <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-2 rounded-xl text-xs">
                  {paymentAuthError}
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    setPaymentAuthModalOpen(false);
                    setPaymentAuthPin('');
                    setPaymentAuthError('');
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handlePaymentAuthSubmit}
                  disabled={paymentAuthPin.length < 4}
                  className="flex-1 gradient-primary hover:bg-indigo-500 disabled:opacity-50 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  Onayla
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
