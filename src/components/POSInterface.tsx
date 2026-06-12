'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Plus, 
  Minus, 
  Trash2, 
  Gift, 
  MessageSquare, 
  Send, 
  Edit3, 
  Lock, 
  Check, 
  DollarSign,
  Search,
  Star,
  Printer
} from 'lucide-react';
import { UserSession, fetchCategories, addSiparis, applyItemAction, fetchPrinters, fetchReceiptSettings } from '@/lib/api';
import { checkPrintServerStatus, printKitchenTickets, sendToPrinter, generateReceiptText } from '@/lib/printService';

interface Product {
  id: string;
  name: string;
  price: number;
  image?: string | null;
  categoryId: string;
  isStockControlled: boolean;
  stockLevel: number;
  modifiers?: Array<{ id: string; name: string; price: number }>;
}

interface Category {
  id: string;
  name: string;
  sortOrder: number;
  products: Product[];
}

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
    status: string; // 'ACTIVE', 'COMPLIMENTARY', 'CANCELLED', 'PAID'
    selectedModifiers?: string | null; // serialized JSON
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

interface POSInterfaceProps {
  user: UserSession;
  table: TableData;
  onBackAction: () => void;
  refreshDataAction: () => Promise<void>;
}

interface NewOrderItem {
  productId: string;
  productName: string;
  unitPrice: number;
  quantity: number;
  note: string;
  selectedModifiers?: Array<{ name: string; price: number }>;
}

export default function POSInterface({
  user,
  table,
  onBackAction,
  refreshDataAction,
}: POSInterfaceProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string>('favorites');
  const [newItems, setNewItems] = useState<NewOrderItem[]>([]);
  const [generalNote, setGeneralNote] = useState<string>(table.activeOrder?.note || '');
  
  // Arama state'i
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modifier state'leri
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [modalSelectedModifiers, setModalSelectedModifiers] = useState<Array<{ name: string; price: number }>>([]);
  const [modalItemNote, setModalItemNote] = useState<string>('');

  // Mutfak hızlı not etiketleri
  const quickNotes = ['Az Şekerli', 'Buzsuz', 'Sıcak Olsun', 'Acılı', 'Double', 'Porsiyon', 'Paket', 'Soslu', 'Tuzsuz'];

  // Note Modal state (Sepetteki kalemin notunu düzenlemek için)
  const [noteModalItem, setNoteModalItem] = useState<{ type: 'new' | 'active', index: number, id?: string, text: string } | null>(null);
  
  // Admin PIN Onay Modalı State'leri
  const [adminAuthModal, setAdminAuthModal] = useState<{
    action: 'cancel' | 'complimentary' | 'price_override';
    orderItemId?: string;
    newPrice?: number;
    maxQty?: number;
  } | null>(null);
  const [adminPin, setAdminPin] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [cancelReason, setCancelReason] = useState<string>('Müşteri vazgeçti');
  const [actionQty, setActionQty] = useState<number>(1);
  const [overridePriceInput, setOverridePriceInput] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPrintingReceipt, setIsPrintingReceipt] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Kategorileri yükle
  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await fetchCategories();
        setCategories(data);
      } catch (err) {
        console.error('Kategoriler yüklenemedi:', err);
      }
    }
    loadCategories();
  }, []);

  // Modifiers fetch has been removed as modifiers are now loaded inline with products

  // Favori ürünleri hesapla (En çok satan veya varsayılan ilk 6 ürün)
  const getFavoriteProducts = () => {
    const allProducts = categories.flatMap((c) => c.products);
    const favNames = ['Serpme Kahvaltı', 'Menemen', 'Karışık Tost', 'Bardak Çay', 'Türk Kahvesi', 'Latte'];
    const favs = allProducts.filter((p) => favNames.includes(p.name));
    if (favs.length > 0) return favs;
    return allProducts.slice(0, 6);
  };

  // Kategorileri Favoriler ile genişlet
  const categoriesWithFavorites = [
    { id: 'favorites', name: '★ Favoriler', sortOrder: 0, products: getFavoriteProducts() },
    ...categories
  ];

  const activeCategory = categoriesWithFavorites.find((c) => c.id === activeCategoryId);

  // Arama sonucuna göre ürünleri filtrele
  const filteredProducts = activeCategory
    ? activeCategory.products.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  // Ürün tıklandığında Modifier modalını aç
  const handleProductClick = (product: Product) => {
    setSelectedProductForModal(product);
    setModalSelectedModifiers([]);
    setModalItemNote('');
  };

  // Modifier seçimi
  const handleToggleModifier = (mod: { name: string; price: number }) => {
    setModalSelectedModifiers((prev) => {
      const exists = prev.find((m) => m.name === mod.name);
      if (exists) {
        return prev.filter((m) => m.name !== mod.name);
      } else {
        return [...prev, mod];
      }
    });
  };

  // Hızlı not ekle
  const handleAddQuickNote = (note: string) => {
    setModalItemNote((prev) => (prev ? `${prev}, ${note}` : note));
  };

  // Modaldan sepete ekle
  const handleAddProductFromModal = () => {
    if (!selectedProductForModal) return;

    setNewItems((prev) => {
      // Aynı ürün, aynı not ve aynı modifier'lara sahip bir kalem sepette var mı kontrol edelim
      const existingIndex = prev.findIndex((item) => {
        if (item.productId !== selectedProductForModal.id) return false;
        if (item.note !== modalItemNote) return false;
        
        // Modifier karşılaştırması
        const m1 = item.selectedModifiers || [];
        const m2 = modalSelectedModifiers;
        if (m1.length !== m2.length) return false;
        return m1.every((x) => m2.some((y) => y.name === x.name));
      });

      if (existingIndex > -1) {
        return prev.map((item, i) =>
          i === existingIndex
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [
          ...prev,
          {
            productId: selectedProductForModal.id,
            productName: selectedProductForModal.name,
            unitPrice: selectedProductForModal.price,
            quantity: 1,
            note: modalItemNote,
            selectedModifiers: modalSelectedModifiers.length > 0 ? modalSelectedModifiers : undefined
          },
        ];
      }
    });

    setSelectedProductForModal(null);
  };

  // Sepetteki yeni ürünün miktarını güncelle
  const handleUpdateNewItemQty = (index: number, increment: boolean) => {
    setNewItems((prev) => {
      const item = prev[index];
      const newQty = increment ? item.quantity + 1 : item.quantity - 1;
      if (newQty <= 0) {
        return prev.filter((_, i) => i !== index);
      }
      return prev.map((item, i) =>
        i === index ? { ...item, quantity: newQty } : item
      );
    });
  };

  // Sepet Not Modalı Kaydet
  const handleSaveNote = () => {
    if (!noteModalItem) return;
    if (noteModalItem.type === 'new') {
      setNewItems((prev) =>
        prev.map((item, i) =>
          i === noteModalItem.index ? { ...item, note: noteModalItem.text } : item
        )
      );
    }
    setNoteModalItem(null);
  };

  // Hesap Fişi Yazdır (Siparişi onaylamadan, sadece aktif kalemler için)
  const handlePrintReceipt = async () => {
    if (!table.activeOrder) return;
    setIsPrintingReceipt(true);
    setErrorMessage('');
    
    try {
      const serverOnline = await checkPrintServerStatus();
      if (!serverOnline) {
        setErrorMessage('Yazdırma sunucusu kapalı! Lütfen "node print-server.js" çalıştırın.');
        setIsPrintingReceipt(false);
        return;
      }

      const settings = await fetchReceiptSettings();
      let printerWindowsName = '';
      let paperWidth = 80;

      if (settings?.receiptPrinterId) {
        const printersData = await fetchPrinters();
        const receiptPrinter = printersData.find((p: any) => p.id === settings.receiptPrinterId);
        if (receiptPrinter) {
          printerWindowsName = receiptPrinter.windowsName;
          paperWidth = receiptPrinter.paperWidth;
        }
      }

      if (!printerWindowsName) {
        setErrorMessage('Hesap fişi yazıcısı ayarlanmamış!');
        setIsPrintingReceipt(false);
        return;
      }

      const receiptText = generateReceiptText(
        {
          tableName: table.name,
          waiterName: user.name,
          createdAt: table.activeOrder.createdAt,
          items: table.activeOrder.items,
          totalAmount: table.activeOrder.totalAmount,
          discountAmount: table.activeOrder.discountAmount,
          paidAmount: table.activeOrder.paidAmount,
          note: table.activeOrder.note,
          payments: [],
        },
        settings,
        paperWidth
      );

      const result = await sendToPrinter(printerWindowsName, receiptText);
      if (result.success) {
        setSuccessMessage('Hesap fişi yazdırıldı!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrorMessage('Yazdırma hatası: ' + (result.error || ''));
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Hesap fişi yazdırılırken hata oluştu.');
    } finally {
      setIsPrintingReceipt(false);
    }
  };

  // Siparişleri Veritabanına Gönder
  const handleSendOrder = async () => {
    if (newItems.length === 0) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      await addSiparis(table.id, newItems, user.id);
      await refreshDataAction();
      setSuccessMessage('Sipariş mutfağa başarıyla iletildi!');

      // Otomatik mutfak fisi yazdirma
      try {
        const settings = await fetchReceiptSettings();
        if (settings.autoPrintKitchen) {
          const serverOnline = await checkPrintServerStatus();
          if (serverOnline) {
            const printersData = await fetchPrinters();
            const allAssignments: Array<{
              printerId: string;
              productId: string;
              printer: { windowsName: string; paperWidth: number };
            }> = [];
            printersData.forEach((p: any) => {
              if (p.type === 'KITCHEN' && p.isActive) {
                (p.productAssignments || []).forEach((a: any) => {
                  allAssignments.push({
                    printerId: a.printerId,
                    productId: a.productId,
                    printer: { windowsName: p.windowsName, paperWidth: p.paperWidth },
                  });
                });
              }
            });

            if (allAssignments.length > 0) {
              const printItems = newItems.map(item => ({
                productName: item.productName,
                quantity: item.quantity,
                note: item.note || undefined,
                productId: item.productId,
                selectedModifiers: item.selectedModifiers,
              }));

              await printKitchenTickets(
                printItems,
                table.name,
                user.name,
                allAssignments
              );
            }
          }
        }
      } catch (printErr) {
        console.error('Mutfak fisi yazdirilamadi (siparis kaydedildi):', printErr);
      }

      setNewItems([]);
      setTimeout(() => {
        setSuccessMessage('');
        onBackAction();
      }, 1500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Sipariş gönderilirken bir hata oluştu.');
      setIsLoading(false);
    }
  };

  // Admin PIN Onayı ve İşlemin Gerçekleştirilmesi
  const handleAdminVerify = async () => {
    setAuthError('');
    if (!adminAuthModal) return;

    try {
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

      if (adminAuthModal.action === 'cancel' && adminAuthModal.orderItemId) {
        await applyItemAction(
          'cancel',
          adminAuthModal.orderItemId,
          actionQty,
          adminUser.id,
          user.id,
          cancelReason
        );
        setSuccessMessage('Sipariş kalemi iptal edildi.');
      } else if (adminAuthModal.action === 'complimentary' && adminAuthModal.orderItemId) {
        await applyItemAction(
          'complimentary',
          adminAuthModal.orderItemId,
          actionQty,
          adminUser.id,
          user.id
        );
        setSuccessMessage('Ürün ikram olarak işaretlendi.');
      }

      await refreshDataAction();
      setTimeout(() => setSuccessMessage(''), 3000);
      closeAdminAuth();
    } catch (err: any) {
      setAuthError(err.message || 'İşlem sırasında bir sunucu hatası oluştu.');
    }
  };

  const openAdminAuth = (
    action: 'cancel' | 'complimentary',
    orderItemId: string,
    maxQty: number
  ) => {
    setAdminAuthModal({ action, orderItemId, maxQty });
    setActionQty(1);
    setAdminPin('');
    setAuthError('');
  };

  const closeAdminAuth = () => {
    setAdminAuthModal(null);
    setAdminPin('');
    setAuthError('');
  };

  // Ara toplamları hesaplama
  const getItemTotalPrice = (item: NewOrderItem) => {
    const modifiersTotal = (item.selectedModifiers || []).reduce((sum, m) => sum + m.price, 0);
    return (item.unitPrice + modifiersTotal) * item.quantity;
  };

  const activeOrderSubtotal = table.activeOrder
    ? table.activeOrder.items
        .filter((item) => item.status === 'ACTIVE')
        .reduce((sum, item) => {
          const modifiers = item.selectedModifiers ? JSON.parse(item.selectedModifiers) : [];
          const modifiersTotal = modifiers.reduce((mSum: number, m: any) => mSum + m.price, 0);
          return sum + (item.unitPrice + modifiersTotal) * item.quantity;
        }, 0)
    : 0;

  const newItemsSubtotal = newItems.reduce(
    (sum, item) => sum + getItemTotalPrice(item),
    0
  );

  const grandTotal = activeOrderSubtotal + newItemsSubtotal;

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden max-w-7xl mx-auto w-full md:p-4 gap-4 min-h-0">
      {/* Sol Panel: Kategoriler ve Ürünler Grid Yapısı */}
      <div className="flex-1 flex flex-col glass-card md:rounded-2xl p-4 overflow-hidden min-h-0">
        {/* Header / Geri Dönüş ve Arama */}
        <div className="flex flex-col space-y-3 pb-3 border-b border-zinc-800 mb-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBackAction}
              className="active-press flex items-center space-x-2 text-zinc-400 hover:text-white transition duration-200 cursor-pointer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="font-heading font-semibold text-sm">Kat Planına Dön</span>
            </button>
            <div>
              <span className="text-xs text-zinc-400">Masa:</span>
              <span className="font-heading font-bold text-white text-base ml-1.5 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-xl">
                {table.name}
              </span>
            </div>
          </div>

          {/* Hızlı Barkod / Live Arama Kutusu */}
          <div className="relative">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-3" />
            <input
              type="text"
              placeholder="Ürün adı ara (Örn: Lat)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 pl-10 pr-4 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30"
            />
            {searchQuery && (
              <button 
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-2.5 text-xs text-zinc-500 hover:text-zinc-300"
              >
                Temizle
              </button>
            )}
          </div>
        </div>

        {/* Kategori ve Ürün Alanı */}
        <div className="flex-1 flex overflow-hidden gap-4 min-h-0">
          {/* Dikey Kategoriler */}
          <div className="w-24 md:w-32 flex flex-col space-y-2 overflow-y-auto pr-1 scrollbar-thin pb-10">
            {categoriesWithFavorites.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setActiveCategoryId(cat.id);
                  setSearchQuery(''); // kategori değişince aramayı temizle
                }}
                className={`active-press py-3.5 px-2 rounded-xl text-[11px] md:text-xs font-bold leading-tight text-center border transition-all duration-200 cursor-pointer flex-shrink-0 ${
                  activeCategoryId === cat.id
                    ? 'gradient-primary text-white border-transparent shadow-lg shadow-amber-500/25'
                    : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border-zinc-800/80'
                }`}
              >
                {cat.id === 'favorites' ? (
                  <span className="flex items-center justify-center space-x-1">
                    <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                    <span>Favoriler</span>
                  </span>
                ) : cat.name}
              </button>
            ))}
          </div>

          {/* Sağ Panel: Ürün Kartları Gridi */}
          <div className="flex-1 overflow-y-auto grid grid-cols-2 lg:grid-cols-3 gap-3 pr-1 content-start scrollbar-thin pb-10 min-h-0">
            {filteredProducts.map((product) => {
              const isOutOfStock = product.isStockControlled && product.stockLevel <= 0;

              return (
                <div
                  key={product.id}
                  onClick={() => !isOutOfStock && handleProductClick(product)}
                  className={`active-press glass-card hover:bg-zinc-800/70 p-3 rounded-xl flex flex-col items-center justify-center text-center min-h-[110px] md:min-h-[130px] border transition cursor-pointer select-none relative overflow-hidden group ${
                    isOutOfStock ? 'opacity-40 cursor-not-allowed' : 'border-zinc-800/60 hover:border-zinc-700'
                  }`}
                >
                  {/* Subtle Background Image Overlay */}
                  {product.image && (
                    <div 
                      className="absolute inset-0 pointer-events-none opacity-[0.06] group-hover:opacity-[0.09] transition-opacity duration-300 select-none bg-cover bg-center"
                      style={{
                        backgroundImage: `url(${product.image})`,
                      }}
                    />
                  )}

                  {/* Stock Level Badge - Absolute Top-Right */}
                  {product.isStockControlled && (
                    <span className={`absolute top-2 right-2 text-[8px] px-1.5 py-0.5 rounded-full font-bold z-20 ${
                      product.stockLevel <= 15 ? 'bg-rose-500/20 text-rose-400' : 'bg-emerald-500/20 text-emerald-400'
                    }`}>
                      {product.stockLevel}
                    </span>
                  )}

                  {/* Product Name - Centered & Highly Prominent */}
                  <div className="relative z-10 font-heading font-bold text-white text-xs md:text-sm tracking-tight leading-snug">
                    {product.name}
                  </div>

                  {/* Product Price - Centered directly under Name */}
                  <div className="relative z-10 font-heading font-extrabold text-amber-300 group-hover:text-amber-200 text-xs md:text-sm mt-1.5">
                    {product.price.toFixed(2)} TL
                  </div>
                </div>
              );
            })}
            {filteredProducts.length === 0 && (
              <div className="col-span-full text-center py-12 text-zinc-500 text-xs italic">
                Aramayla eşleşen ürün bulunamadı.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sağ Panel: Sipariş Sepeti / Aktif Adisyon Kontrolü */}
      <div className="w-full md:w-80 flex flex-col glass-card md:rounded-2xl p-3 md:p-4 overflow-hidden border-t md:border-t-0 md:border-l border-zinc-800 h-[38vh] md:h-full shrink-0 min-h-0">
        <h2 className="font-heading font-bold text-white text-sm mb-3 flex items-center justify-between pb-2 border-b border-zinc-800 shrink-0">
          <span>Adisyon Detayı</span>
          <span className="text-xs text-zinc-400 font-normal">#{table.name}</span>
        </h2>

        {/* Sepet Listesi */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 scrollbar-thin min-h-0">
          {/* KISIM 1: Aktif Kayıtlı Siparişler (Mutfak siparişleri) */}
          {table.activeOrder && table.activeOrder.items.length > 0 && (
            <div>
              <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-1.5 flex items-center space-x-1">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span>Onaylanmış Siparişler</span>
              </div>
              <div className="space-y-1.5">
                {table.activeOrder.items.map((item) => {
                  const modifiers = item.selectedModifiers ? JSON.parse(item.selectedModifiers) : [];
                  const modifiersTotal = modifiers.reduce((mSum: number, m: any) => mSum + m.price, 0);

                  return (
                    <div
                      key={item.id}
                      className={`bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded-xl text-xs relative group transition ${
                        item.status === 'COMPLIMENTARY' ? 'border-l-4 border-l-orange-500 bg-orange-500/5' : ''
                      } ${item.status === 'PAID' ? 'border-l-4 border-l-emerald-500 bg-emerald-500/5' : ''} ${
                        item.status === 'CANCELLED' ? 'opacity-40 line-through border-rose-950 bg-rose-950/5' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start font-medium text-zinc-200">
                        <span className="flex items-center">
                          {item.productName}
                          {item.status === 'PAID' && (
                            <span className="ml-1.5 bg-emerald-500/20 text-emerald-400 font-bold px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide">
                              Ödendi
                            </span>
                          )}
                        </span>
                        <span className="font-semibold text-zinc-100">
                          {item.status === 'COMPLIMENTARY' ? 'İkram' : `${((item.unitPrice + modifiersTotal) * item.quantity).toFixed(2)} TL`}
                        </span>
                      </div>

                      {/* Seçilen Modifierlar */}
                      {modifiers.length > 0 && (
                        <div className="text-[10px] text-zinc-400 italic mt-0.5">
                          + {modifiers.map((m: any) => m.name).join(', ')}
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-2 text-[10px] text-zinc-400">
                        <span>
                          {item.quantity} adet × {item.unitPrice + modifiersTotal} TL
                        </span>
                        {item.note && (
                          <span className="bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 italic flex items-center space-x-1 max-w-[120px] truncate">
                            <MessageSquare className="w-2.5 h-2.5 inline mr-0.5 text-amber-400" />
                            <span>{item.note}</span>
                          </span>
                        )}
                      </div>

                      {/* Aktif Sipariş Yetki Butonları (İkram/İptal) */}
                      {item.status === 'ACTIVE' && (
                        <div className="absolute right-2 top-2 hidden group-hover:flex items-center space-x-1 bg-zinc-900 border border-zinc-800 p-0.5 rounded shadow-lg">
                          <button
                            onClick={() => openAdminAuth('complimentary', item.id, item.quantity)}
                            className="hover:bg-orange-500/20 p-1 text-orange-400 rounded transition cursor-pointer"
                            title="İkram Et"
                          >
                            <Gift className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openAdminAuth('cancel', item.id, item.quantity)}
                            className="hover:bg-rose-500/20 p-1 text-rose-400 rounded transition cursor-pointer"
                            title="Ürünü İptal Et"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* KISIM 2: Yeni Eklenenler (Sepet) */}
          <div>
            <div className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider mb-1.5 mt-3 flex items-center space-x-1">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              <span>Yeni Eklenen Ürünler</span>
            </div>
            {newItems.length === 0 ? (
              <div className="text-center py-6 text-xs text-zinc-500 italic bg-zinc-900/30 border border-dashed border-zinc-800/80 rounded-xl">
                Lütfen soldan ürün ekleyin.
              </div>
            ) : (
              <div className="space-y-1.5">
                {newItems.map((item, index) => {
                  const mTotal = (item.selectedModifiers || []).reduce((s, x) => s + x.price, 0);

                  return (
                    <div
                      key={index}
                      className="bg-amber-950/20 border border-amber-900/40 p-2.5 rounded-xl text-xs relative group hover:border-amber-500/30 transition"
                    >
                      <div className="flex justify-between items-start font-medium text-zinc-200">
                        <span className="truncate pr-16">{item.productName}</span>
                        <span className="font-semibold text-amber-300">
                          {getItemTotalPrice(item).toFixed(2)} TL
                        </span>
                      </div>

                      {/* Seçilen Modifierlar */}
                      {item.selectedModifiers && item.selectedModifiers.length > 0 && (
                        <div className="text-[10px] text-amber-400 font-semibold italic mt-0.5">
                          + {item.selectedModifiers.map((m) => m.name).join(', ')}
                        </div>
                      )}

                      <div className="flex justify-between items-center mt-2">
                        {/* Note Button */}
                        <button
                          onClick={() => setNoteModalItem({ type: 'new', index, text: item.note })}
                          className="text-[10px] text-zinc-400 hover:text-white bg-zinc-800 hover:bg-zinc-700 py-0.5 px-2 rounded flex items-center space-x-1 cursor-pointer"
                        >
                          <MessageSquare className="w-3 h-3 text-amber-400" />
                          <span>{item.note ? 'Notu Düzenle' : 'Not Ekle'}</span>
                        </button>

                        {/* Miktar Kontrolleri */}
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => handleUpdateNewItemQty(index, false)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 w-5 py-0.5 rounded font-bold transition"
                          >
                            -
                          </button>
                          <span className="font-bold text-zinc-100 w-4 text-center">
                            {item.quantity}
                          </span>
                          <button
                            onClick={() => handleUpdateNewItemQty(index, true)}
                            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 w-5 py-0.5 rounded font-bold transition"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Sonuç Mesajları */}
        {successMessage && (
          <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-300 p-2 rounded-xl text-xs mt-2 animate-pulse">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-2 rounded-xl text-xs mt-2">
            {errorMessage}
          </div>
        )}

        {/* Fiyatlar / Özet ve Siparişi Gönder */}
        <div className="border-t border-zinc-800 pt-3 mt-3 space-y-2 bg-zinc-950/20 p-3 rounded-xl">
          <div className="flex justify-between items-center text-xs">
            <span className="text-zinc-400">Genel Toplam:</span>
            <span className="font-heading font-extrabold text-white text-base">
              {grandTotal.toFixed(2)} TL
            </span>
          </div>

          <button
            onClick={handleSendOrder}
            disabled={newItems.length === 0 || isLoading}
            className="active-press w-full gradient-primary hover:bg-amber-500 disabled:opacity-50 text-white font-heading font-bold text-xs py-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>{isLoading ? 'Gönderiliyor...' : 'Siparişi Onayla & Gönder'}</span>
          </button>

          {/* Hesap Yazdır Butonu (sadece aktif sipariş varsa) */}
          {table.activeOrder && table.activeOrder.items.some(i => i.status !== 'CANCELLED') && (
            <button
              onClick={handlePrintReceipt}
              disabled={isPrintingReceipt}
              className="active-press w-full bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 font-heading font-bold text-xs py-3 rounded-xl flex items-center justify-center space-x-2 border border-zinc-700 cursor-pointer transition mt-2"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrintingReceipt ? 'Yazdırılıyor...' : 'Hesap Fişi Yazdır'}</span>
            </button>
          )}
        </div>
      </div>

      {/* NOTE MODAL */}
      {noteModalItem && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in">
            <h3 className="font-heading text-base font-bold text-white mb-2 flex items-center space-x-2">
              <MessageSquare className="w-5 h-5 text-amber-400" />
              <span>Sipariş Mutfak Notu</span>
            </h3>
            <textarea
              value={noteModalItem.text}
              onChange={(e) => setNoteModalItem({ ...noteModalItem, text: e.target.value })}
              placeholder="Örn: Az demli olsun, tost acısız olsun..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500 h-28 resize-none mb-4"
            />
            <div className="flex space-x-3">
              <button
                onClick={() => setNoteModalItem(null)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2 rounded-xl font-medium transition cursor-pointer"
              >
                Vazgeç
              </button>
              <button
                onClick={handleSaveNote}
                className="flex-1 gradient-primary hover:bg-amber-500 text-white text-xs py-2 rounded-xl font-semibold transition cursor-pointer"
              >
                Kaydet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODIFIER & QUICK NOTE SELECTION MODAL */}
      {selectedProductForModal && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl border-amber-500/20 animate-scale-in">
            <div className="pb-3 border-b border-zinc-800 mb-4">
              <h3 className="font-heading font-extrabold text-lg text-white">
                {selectedProductForModal.name}
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Birim Fiyatı: {selectedProductForModal.price.toFixed(2)} TL
              </p>
            </div>

            <div className="space-y-4">
              {/* Modifier options list */}
              {selectedProductForModal.modifiers && selectedProductForModal.modifiers.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-zinc-300 mb-2">Ek Özellikler / Seçenekler</h4>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin">
                    {selectedProductForModal.modifiers
                      .map((mod) => {
                        const isSelected = modalSelectedModifiers.some((m) => m.name === mod.name);
                        return (
                          <button
                            key={mod.id}
                            onClick={() => handleToggleModifier(mod)}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-medium transition duration-150 cursor-pointer ${
                              isSelected
                                ? 'bg-amber-500/20 border-amber-500 text-amber-200'
                                : 'bg-zinc-900/60 border-zinc-800 hover:bg-zinc-800 text-zinc-400'
                            }`}
                          >
                            <span>{mod.name}</span>
                            <span className="font-bold text-amber-400">+{mod.price} TL</span>
                          </button>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Quick note tags */}
              <div>
                <h4 className="text-xs font-semibold text-zinc-300 mb-2">Hızlı Mutfak Notları</h4>
                <div className="flex flex-wrap gap-1.5">
                  {quickNotes.map((note) => (
                    <button
                      key={note}
                      onClick={() => handleAddQuickNote(note)}
                      className="bg-zinc-900 hover:bg-amber-900 border border-zinc-800/80 text-zinc-300 hover:text-white px-2.5 py-1 rounded-lg text-[10px] font-medium transition duration-150 cursor-pointer"
                    >
                      {note}
                    </button>
                  ))}
                </div>
              </div>

              {/* Note textarea */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Mutfak Notu Detayı</label>
                <input
                  type="text"
                  value={modalItemNote}
                  onChange={(e) => setModalItemNote(e.target.value)}
                  placeholder="Seçenekleri girin veya yukarıdan etiketlere tıklayın..."
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              {/* Action buttons */}
              <div className="flex space-x-3 pt-3 border-t border-zinc-800/80">
                <button
                  onClick={() => setSelectedProductForModal(null)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-3 rounded-xl font-medium transition cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleAddProductFromModal}
                  className="flex-1 gradient-primary hover:bg-amber-500 text-white text-xs py-3 rounded-xl font-semibold transition cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  Sepete Ekle ({(selectedProductForModal.price + modalSelectedModifiers.reduce((sum, m) => sum + m.price, 0)).toFixed(2)} TL)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN PIN VERIFICATION MODAL */}
      {adminAuthModal && (
        <div className="fixed inset-0 bg-zinc-950/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl border-amber-500/20 animate-scale-in">
            <div className="flex items-center space-x-2 text-rose-400 mb-3">
              <Lock className="w-5 h-5" />
              <h3 className="font-heading font-bold text-base text-white">Yönetici Onayı Gerekli</h3>
            </div>
            
            <p className="text-xs text-zinc-400 mb-4">
              Bu işlem güvenlik sınırları dahilindedir. Yetkilendirmek için 4 haneli müdür PIN kodunu girin.
            </p>

            <div className="space-y-4">
              {/* If CANCEL action, show Reason & Quantity selector */}
              {adminAuthModal.action === 'cancel' && (
                <div className="space-y-3 p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400">İptal Miktarı:</span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setActionQty(prev => prev > 1 ? prev - 1 : 1)}
                        className="bg-zinc-800 text-white w-5 h-5 rounded flex items-center justify-center font-bold"
                      >
                        -
                      </button>
                      <span className="font-bold text-zinc-200 w-4 text-center">{actionQty}</span>
                      <button
                        onClick={() => setActionQty(prev => prev < (adminAuthModal.maxQty || 1) ? prev + 1 : prev)}
                        className="bg-zinc-800 text-white w-5 h-5 rounded flex items-center justify-center font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] text-zinc-400 mb-1 font-semibold">İptal Nedeni</label>
                    <select
                      value={cancelReason}
                      onChange={(e) => setCancelReason(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-2 py-1.5 text-xs text-zinc-200"
                    >
                      <option value="Müşteri vazgeçti">Müşteri vazgeçti</option>
                      <option value="Yanlış sipariş girildi">Yanlış sipariş girildi</option>
                      <option value="Hatalı fiyat / Değişiklik">Hatalı fiyat / Değişiklik</option>
                      <option value="Ürün kalmadı (Mutfak)">Ürün kalmadı (Mutfak)</option>
                    </select>
                  </div>
                </div>
              )}

              {/* If COMPLIMENTARY action, show Quantity selector */}
              {adminAuthModal.action === 'complimentary' && (
                <div className="flex justify-between items-center text-xs p-3 bg-zinc-900/50 rounded-xl border border-zinc-800">
                  <span className="text-zinc-400">İkram Edilecek Miktar:</span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => setActionQty(prev => prev > 1 ? prev - 1 : 1)}
                      className="bg-zinc-800 text-white w-5 h-5 rounded flex items-center justify-center font-bold"
                    >
                      -
                    </button>
                    <span className="font-bold text-zinc-200 w-4 text-center">{actionQty}</span>
                    <button
                      onClick={() => setActionQty(prev => prev < (adminAuthModal.maxQty || 1) ? prev + 1 : prev)}
                      className="bg-zinc-800 text-white w-5 h-5 rounded flex items-center justify-center font-bold"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              {/* Pin Code Input */}
              <div>
                <label className="block text-xs font-semibold text-zinc-300 mb-1">Müdür PIN Kodu</label>
                <input
                  type="password"
                  maxLength={4}
                  value={adminPin}
                  onChange={(e) => setAdminPin(e.target.value)}
                  placeholder="••••"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2 px-3 text-center text-lg font-bold tracking-widest text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-rose-500"
                />
              </div>

              {authError && (
                <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-2 rounded-xl text-xs">
                  {authError}
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={closeAdminAuth}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal Et
                </button>
                <button
                  onClick={handleAdminVerify}
                  disabled={adminPin.length < 4}
                  className="flex-1 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white text-xs py-2 rounded-xl font-semibold transition cursor-pointer"
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
