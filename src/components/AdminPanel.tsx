'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  TrendingUp, 
  ShoppingBag, 
  Percent, 
  AlertTriangle, 
  History, 
  FileSpreadsheet, 
  Activity, 
  Calendar,
  Layers,
  ArrowRight,
  Database,
  Edit3,
  Plus,
  Trash2,
  Package,
  FolderOpen,
  UserCheck,
  Star,
  Users,
  ArrowUp,
  ArrowDown,
  CreditCard,
  DollarSign,
  X,
  FileText
} from 'lucide-react';
import { 
  fetchAdminReports, 
  fetchAuditLogs, 
  fetchCategories, 
  saveProduct, 
  deleteProduct, 
  saveCategory, 
  deleteCategory,
  fetchCustomers,
  saveCustomer,
  deleteCustomer,
  collectCustomerBalance,
  fetchModifiers,
  saveModifier,
  deleteModifier,
  fetchAdminTables,
  saveAdminTable,
  deleteAdminTable,
  sortAdminTable,
  fetchCustomerStatement
} from '@/lib/api';

interface AdminPanelProps {
  onClose: () => void;
}

interface ReportSummary {
  totalRevenue: number;
  totalOrders: number;
  totalDiscounts: number;
}

interface PaymentMethods {
  cash: number;
  creditCard: number;
  mealCard: number;
  cari: number;
}

interface TopProduct {
  name: string;
  quantity: number;
  total: number;
}

interface CategorySale {
  name: string;
  value: number;
}

interface HourlySale {
  hour: string;
  total: number;
}

interface StockWarning {
  id: string;
  name: string;
  categoryName: string;
  stockLevel: number;
}

interface PersonnelStat {
  name: string;
  role: string;
  actionsCount: number;
}

interface WaiterSalesPerformance {
  name: string;
  role: string;
  ordersCount: number;
  totalSales: number;
  items: Array<{name: string, quantity: number, total: number}>;
}

interface AdisyonHistoryItem {
  id: string;
  tableName: string;
  createdAt: string;
  updatedAt: string;
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  waiterName: string;
  customerName: string | null;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    selectedModifiers?: string | null;
  }>;
}

interface AuditLog {
  id: string;
  actionType: string;
  description: string;
  createdAt: string;
  actorUser: { name: string; role: string };
  approverUser: { name: string; role: string } | null;
}

export default function AdminPanel({ onClose }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'MENU' | 'MODIFIERS' | 'TABLES' | 'CARI' | 'LOGS' | 'DAILY_OPS' | 'USERS'>('REPORTS');
  const [reportsData, setReportsData] = useState<{
    summary: ReportSummary;
    paymentMethods: PaymentMethods;
    topProducts: TopProduct[];
    productSalesSummary: TopProduct[];
    categorySales: CategorySale[];
    hourlySales: HourlySale[];
    stockWarnings: StockWarning[];
    personnelPerformance: PersonnelStat[];
    waiterSalesPerformance: WaiterSalesPerformance[];
    adisyonHistory: AdisyonHistoryItem[];
  } | null>(null);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  
  // Raporlar için Tarih Filtresi
  const [dateRange, setDateRange] = useState<{ startDate: string; endDate: string }>({ startDate: '', endDate: '' });

  // Grafik İnteraktif State'leri
  const [hoveredHourIndex, setHoveredHourIndex] = useState<number | null>(null);
  const [hoveredCategoryIndex, setHoveredCategoryIndex] = useState<number | null>(null);

  // Gün İşlemleri State'leri
  const [workDays, setWorkDays] = useState<any[]>([]);
  const [activeWorkDay, setActiveWorkDay] = useState<any>(null);

  // Personel State'leri
  const [users, setUsers] = useState<any[]>([]);
  const [userModal, setUserModal] = useState<{ id?: string; name: string; pinHash: string; role: string; isActive: boolean } | null>(null);
  const [expandedWaiterIndex, setExpandedWaiterIndex] = useState<number | null>(null);
  
  // Menü Yönetimi State'leri
  const [menuCategories, setMenuCategories] = useState<any[]>([]);
  const [selectedMenuCategoryId, setSelectedMenuCategoryId] = useState<string>('');
  const [categoryModal, setCategoryModal] = useState<{ id?: string; name: string; sortOrder: number } | null>(null);
  const [productModal, setProductModal] = useState<{
    id?: string;
    name: string;
    price: number;
    categoryId: string;
    isStockControlled: boolean;
    stockLevel: number;
    image?: string;
    modifierIds?: string[];
    newModifiers?: Array<{ name: string; price: number }>;
  } | null>(null);

  const [newModName, setNewModName] = useState<string>('');
  const [newModPrice, setNewModPrice] = useState<string>('0');

  // Modifier Yönetimi State'leri
  const [modifiers, setModifiers] = useState<any[]>([]);
  const [modifierModal, setModifierModal] = useState<{ id?: string; name: string; price: number; productIds?: string[] } | null>(null);

  // Masa Yönetimi State'leri
  const [tables, setTables] = useState<any[]>([]);
  const [tableModal, setTableModal] = useState<{ id?: string; name: string; area: string } | null>(null);

  // Cari (Müşteri) Yönetimi State'leri
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerModal, setCustomerModal] = useState<{ id?: string; name: string; phone: string; balance?: number } | null>(null);
  const [collectionModal, setCollectionModal] = useState<{ id: string; name: string; amount: string; paymentMethod: 'CASH' | 'CREDIT_CARD' } | null>(null);
  
  // Cari Ekstre Modalı State'leri
  const [selectedCariStatement, setSelectedCariStatement] = useState<{
    customer: any;
    orders: any[];
    collections: any[];
  } | null>(null);
  const [cariDetailLoading, setCariDetailLoading] = useState<boolean>(false);

  // Adisyon Detay Modalı State (Analizler altındaki liste için)
  const [selectedAdisyon, setSelectedAdisyon] = useState<AdisyonHistoryItem | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string>('');

  // Verileri yükle
  const loadData = async () => {
    setIsLoading(true);
    setActionError('');
    try {
      if (activeTab === 'REPORTS') {
        let url = '/api/admin/reports';
        if (dateRange.startDate || dateRange.endDate) {
          const params = new URLSearchParams();
          if (dateRange.startDate) params.append('startDate', dateRange.startDate);
          if (dateRange.endDate) params.append('endDate', dateRange.endDate);
          url += `?${params.toString()}`;
        }
        const res = await fetch(url);
        const rep = await res.json();
        setReportsData(rep);
      } else if (activeTab === 'LOGS') {
        const audit = await fetchAuditLogs();
        setLogs(audit);
      } else if (activeTab === 'DAILY_OPS') {
        const res = await fetch('/api/admin/workday');
        const data = await res.json();
        setWorkDays(data);
        const activeRes = await fetch('/api/admin/workday?limit=current');
        const activeData = await activeRes.json();
        setActiveWorkDay(activeData.activeWorkDay);
      } else if (activeTab === 'USERS') {
        const res = await fetch('/api/admin/users');
        const data = await res.json();
        setUsers(data);
      } else if (activeTab === 'MENU') {
        const data = await fetchCategories();
        setMenuCategories(data);
        try {
          const mods = await fetchModifiers();
          setModifiers(mods);
        } catch (err) {
          console.error("Modifiers failed to load in Menu tab", err);
        }
        if (data.length > 0) {
          if (!selectedMenuCategoryId || !data.find((c: any) => c.id === selectedMenuCategoryId)) {
            setSelectedMenuCategoryId(data[0].id);
          }
        } else {
          setSelectedMenuCategoryId('');
        }
      } else if (activeTab === 'MODIFIERS') {
        const mods = await fetchModifiers();
        setModifiers(mods);
        const cats = await fetchCategories();
        setMenuCategories(cats); // seçeneklerde kategori bağlamak için
      } else if (activeTab === 'TABLES') {
        const tbls = await fetchAdminTables();
        setTables(tbls);
      } else if (activeTab === 'CARI') {
        const custs = await fetchCustomers();
        setCustomers(custs);
      }
    } catch (err) {
      console.error('Yönetim paneli verileri yüklenemedi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, dateRange]);

  // Cari Ekstre Detaylarını Getir
  const handleViewCariDetails = async (customerId: string) => {
    setCariDetailLoading(true);
    try {
      const statement = await fetchCustomerStatement(customerId);
      setSelectedCariStatement(statement);
    } catch (err: any) {
      alert(err.message || 'Cari hesap ekstre dökümü yüklenemedi.');
    } finally {
      setCariDetailLoading(false);
    }
  };

  // Kategori Kaydetme
  const handleSaveCategory = async () => {
    if (!categoryModal || !categoryModal.name.trim()) {
      setActionError('Kategori adı boş bırakılamaz.');
      return;
    }
    setActionError('');
    setActionSuccess('');
    try {
      await saveCategory(categoryModal);
      setActionSuccess(categoryModal.id ? 'Kategori başarıyla güncellendi!' : 'Yeni kategori başarıyla eklendi!');
      setCategoryModal(null);
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Kategori kaydedilirken hata oluştu.');
    }
  };

  // Kategori Silme (Pasife Alma)
  const handleDeleteCategory = async (catId: string, name: string) => {
    if (!confirm(`"${name}" kategorisini silmek istediğinize emin misiniz?`)) return;
    setActionError('');
    setActionSuccess('');
    try {
      await deleteCategory(catId);
      setActionSuccess('Kategori başarıyla kaldırıldı.');
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Kategori silinirken hata oluştu.');
    }
  };

  // Ürün Kaydetme
  const handleSaveProduct = async () => {
    if (!productModal || !productModal.name.trim() || !productModal.categoryId) {
      setActionError('Ürün adı ve kategori alanları zorunludur.');
      return;
    }
    if (productModal.price === undefined || isNaN(productModal.price) || productModal.price < 0) {
      setActionError('Geçerli bir birim fiyat giriniz.');
      return;
    }
    setActionError('');
    setActionSuccess('');
    try {
      await saveProduct(productModal);
      setActionSuccess(productModal.id ? 'Ürün başarıyla güncellendi!' : 'Yeni ürün başarıyla eklendi!');
      setProductModal(null);
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Ürün kaydedilirken hata oluştu.');
    }
  };

  const handleAddNewModInline = () => {
    if (!productModal) return;
    if (!newModName.trim()) {
      alert("Seçenek adı boş olamaz!");
      return;
    }
    const priceVal = parseFloat(newModPrice || '0');
    if (isNaN(priceVal) || priceVal < 0) {
      alert("Lütfen geçerli bir fiyat girin!");
      return;
    }
    
    const currentNewMods = productModal.newModifiers || [];
    setProductModal({
      ...productModal,
      newModifiers: [
        ...currentNewMods,
        { name: newModName.trim(), price: priceVal }
      ]
    });
    setNewModName('');
    setNewModPrice('0');
  };

  const handleToggleModifierInProduct = (id: string) => {
    if (!productModal) return;
    const currentIds = productModal.modifierIds || [];
    if (currentIds.includes(id)) {
      setProductModal({
        ...productModal,
        modifierIds: currentIds.filter(x => x !== id)
      });
    } else {
      setProductModal({
        ...productModal,
        modifierIds: [...currentIds, id]
      });
    }
  };

  const handleRemoveNewModInline = (index: number) => {
    if (!productModal) return;
    const currentNewMods = productModal.newModifiers || [];
    setProductModal({
      ...productModal,
      newModifiers: currentNewMods.filter((_, i) => i !== index)
    });
  };

  // Ürün Silme
  const handleDeleteProduct = async (prodId: string, name: string) => {
    if (!confirm(`"${name}" ürününü menüden kaldırmak istediğinize emin misiniz?`)) return;
    setActionError('');
    setActionSuccess('');
    try {
      await deleteProduct(prodId);
      setActionSuccess('Ürün başarıyla menüden kaldırıldı.');
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Ürün silinirken hata oluştu.');
    }
  };

  // Modifier Kaydetme
  const handleSaveModifier = async () => {
    if (!modifierModal || !modifierModal.name.trim() || modifierModal.price === undefined) {
      setActionError('Seçenek adı ve fiyat alanları zorunludur.');
      return;
    }
    setActionError('');
    try {
      await saveModifier(modifierModal);
      setActionSuccess(modifierModal.id ? 'Seçenek başarıyla güncellendi!' : 'Yeni seçenek başarıyla eklendi!');
      setModifierModal(null);
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Seçenek kaydedilemedi.');
    }
  };

  // Modifier Silme
  const handleDeleteModifier = async (id: string, name: string) => {
    if (!confirm(`"${name}" seçeneğini kaldırmak istediğinize emin misiniz?`)) return;
    try {
      await deleteModifier(id);
      setActionSuccess('Seçenek başarıyla kaldırıldı.');
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Seçenek silinemedi.');
    }
  };

  // Masa Kaydetme
  const handleSaveTable = async () => {
    if (!tableModal || !tableModal.name.trim() || !tableModal.area.trim()) {
      setActionError('Masa adı ve bölge zorunludur.');
      return;
    }
    setActionError('');
    try {
      await saveAdminTable(tableModal);
      setActionSuccess(tableModal.id ? 'Masa başarıyla güncellendi!' : 'Yeni masa başarıyla eklendi!');
      setTableModal(null);
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Masa kaydedilemedi.');
    }
  };

  // Masa Silme
  const handleDeleteTable = async (id: string, name: string) => {
    if (!confirm(`"${name}" masasını tamamen silmek istediğinize emin misiniz?`)) return;
    try {
      await deleteAdminTable(id);
      setActionSuccess('Masa başarıyla silindi.');
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Masa silinemedi.');
    }
  };

  // Masa Sıralama
  const handleSortTable = async (id: string, direction: 'up' | 'down') => {
    try {
      await sortAdminTable(id, direction);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Sıralama değiştirilemedi.');
    }
  };

  // Cari Müşteri Kaydetme
  const handleSaveCustomer = async () => {
    if (!customerModal || !customerModal.name.trim() || !customerModal.phone.trim()) {
      setActionError('Ad ve telefon alanları zorunludur.');
      return;
    }
    setActionError('');
    try {
      await saveCustomer(customerModal);
      setActionSuccess(customerModal.id ? 'Cari müşteri güncellendi!' : 'Yeni cari müşteri eklendi!');
      setCustomerModal(null);
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Müşteri kaydedilemedi.');
    }
  };

  // Cari Müşteri Silme
  const handleDeleteCustomer = async (id: string, name: string) => {
    if (!confirm(`"${name}" cari hesabını pasif yapmak istediğinize emin misiniz?`)) return;
    try {
      await deleteCustomer(id);
      setActionSuccess('Cari müşteri hesabı pasifleştirildi.');
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Müşteri silinemedi.');
    }
  };

  // Cari Müşteriden Tahsilat Al
  const handleCollectSubmit = async () => {
    if (!collectionModal) return;
    const amountVal = parseFloat(collectionModal.amount);
    if (isNaN(amountVal) || amountVal <= 0) {
      setActionError('Lütfen geçerli bir tahsilat miktarı girin.');
      return;
    }
    setActionError('');
    try {
      await collectCustomerBalance(collectionModal.id, amountVal, collectionModal.paymentMethod);
      setActionSuccess(`${amountVal.toFixed(2)} TL tahsilat başarıyla kaydedildi!`);
      setCollectionModal(null);
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Tahsilat işlemi kaydedilemedi.');
    }
  };

  const maxHourRevenue = reportsData
    ? Math.max(...reportsData.hourlySales.map(h => h.total), 1)
    : 1;

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 glass-card p-4 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-3 flex-wrap">
          <button
            onClick={onClose}
            className="active-press p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition duration-200 cursor-pointer"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-heading text-2xl font-black tracking-tight text-white flex items-center space-x-2">
              <span>Müdür Yönetim Paneli</span>
              <span className="text-xs font-semibold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded-full uppercase tracking-widest font-sans">
                Admin
              </span>
            </h1>
            <p className="text-xs text-slate-400">Restoran ayarları, menü modları, cari hesap defteri ve personel ciroları</p>
          </div>
        </div>

        {/* Tab Seçiciler */}
        <div className="flex bg-slate-950/80 border border-slate-800 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-thin">
          <button
            onClick={() => setActiveTab('REPORTS')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
              activeTab === 'REPORTS' ? 'gradient-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Analiz Raporları</span>
          </button>

          <button
            onClick={() => setActiveTab('MENU')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
              activeTab === 'MENU' ? 'gradient-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ürün/Kategori</span>
          </button>

          <button
            onClick={() => setActiveTab('MODIFIERS')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
              activeTab === 'MODIFIERS' ? 'gradient-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Ek Seçenekler</span>
          </button>

          <button
            onClick={() => setActiveTab('TABLES')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
              activeTab === 'TABLES' ? 'gradient-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Masa Yönetimi</span>
          </button>

          <button
            onClick={() => setActiveTab('CARI')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
              activeTab === 'CARI' ? 'gradient-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cari Hesap Defteri</span>
          </button>

          <button
            onClick={() => setActiveTab('DAILY_OPS')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
              activeTab === 'DAILY_OPS' ? 'gradient-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Gün İşlemleri</span>
          </button>

          <button
            onClick={() => setActiveTab('USERS')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
              activeTab === 'USERS' ? 'gradient-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-400" />
            <span>Personel Yönetimi</span>
          </button>

          <button
            onClick={() => setActiveTab('LOGS')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${
              activeTab === 'LOGS' ? 'gradient-primary text-white shadow' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Log Defteri</span>
          </button>
        </div>
      </div>

      {actionSuccess && activeTab !== 'MENU' && (
        <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-300 p-3 rounded-xl text-sm shadow-md animate-fade-in">
          {actionSuccess}
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-400">Veriler hazırlanıyor...</p>
        </div>
      ) : activeTab === 'REPORTS' && reportsData ? (
        <div className="space-y-6 animate-fade-in">
          
          {/* Tarih Filtresi */}
          <div className="glass-card p-4 rounded-2xl shadow-md flex items-end space-x-4">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Başlangıç Tarihi</label>
              <input 
                type="date" 
                value={dateRange.startDate} 
                onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Bitiş Tarihi</label>
              <input 
                type="date" 
                value={dateRange.endDate} 
                onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                className="bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <button
              onClick={() => setDateRange({ startDate: '', endDate: '' })}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs px-4 py-2.5 rounded-xl font-medium transition h-[38px]"
            >
              Filtreyi Temizle
            </button>
          </div>

          {/* Z Raporu Özeti */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="glass-card p-5 rounded-2xl relative overflow-hidden shadow-lg border-l-4 border-l-emerald-500">
              <div className="absolute right-4 top-4 text-emerald-500 bg-emerald-500/10 p-2.5 rounded-xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Net Günlük Ciro</p>
              <h2 className="text-2xl font-heading font-black text-white mt-2">
                {reportsData.summary.totalRevenue.toFixed(2)} TL
              </h2>
            </div>

            <div className="glass-card p-5 rounded-2xl relative overflow-hidden shadow-lg border-l-4 border-l-indigo-500">
              <div className="absolute right-4 top-4 text-indigo-500 bg-indigo-500/10 p-2.5 rounded-xl">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Kapatılan Adisyon</p>
              <h2 className="text-2xl font-heading font-black text-white mt-2">
                {reportsData.summary.totalOrders} adet
              </h2>
            </div>

            <div className="glass-card p-5 rounded-2xl relative overflow-hidden shadow-lg border-l-4 border-l-amber-500">
              <div className="absolute right-4 top-4 text-amber-500 bg-amber-500/10 p-2.5 rounded-xl">
                <Percent className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Yapılan İndirim</p>
              <h2 className="text-2xl font-heading font-black text-white mt-2">
                {reportsData.summary.totalDiscounts.toFixed(2)} TL
              </h2>
            </div>

            {/* Veresiye Cari Satış Toplamı */}
            <div className="glass-card p-5 rounded-2xl relative overflow-hidden shadow-lg border-l-4 border-l-cyan-500">
              <div className="absolute right-4 top-4 text-cyan-500 bg-cyan-500/10 p-2.5 rounded-xl">
                <UserCheck className="w-6 h-6" />
              </div>
              <p className="text-xs text-slate-400 uppercase font-bold tracking-wider">Cari (Veresiye) Satış</p>
              <h2 className="text-2xl font-heading font-black text-white mt-2">
                {(reportsData.paymentMethods.cari || 0).toFixed(2)} TL
              </h2>
            </div>
          </div>

          {/* İNTERAKTİF PREMİUM GRAFİKLER */}
          {(() => {
            const hourlySales = reportsData.hourlySales || [];
            const categorySales = reportsData.categorySales || [];
            
            // 1. Saatlik Yoğunluk Grafiği Hesaplamaları
            const maxHour = Math.max(...hourlySales.map(h => h.total), 1);
            const hourWidth = 500;
            const hourHeight = 220;
            const paddingL = 50;
            const paddingR = 20;
            const paddingT = 25;
            const paddingB = 35;
            
            const cWidth = hourWidth - paddingL - paddingR;
            const cHeight = hourHeight - paddingT - paddingB;
            
            const hourPoints = hourlySales.map((h, i) => {
              const x = paddingL + (i / 23) * cWidth;
              const y = paddingT + cHeight - (h.total / maxHour) * cHeight;
              return { x, y, hour: h.hour, total: h.total };
            });
            
            const areaPath = hourPoints.length > 0 
              ? `M ${hourPoints[0].x} ${paddingT + cHeight} ` + 
                hourPoints.map(p => `L ${p.x} ${p.y}`).join(' ') + 
                ` L ${hourPoints[hourPoints.length - 1].x} ${paddingT + cHeight} Z`
              : '';
              
            const linePath = hourPoints.length > 0
              ? `M ${hourPoints[0].x} ${hourPoints[0].y} ` + hourPoints.map(p => `L ${p.x} ${p.y}`).join(' ')
              : '';

            // 2. Kategori Grafiği Hesaplamaları
            const totalCatSales = categorySales.reduce((sum, c) => sum + c.value, 0);
            const donutR = 55;
            const donutCx = 110;
            const donutCy = 110;
            const donutC = 2 * Math.PI * donutR; // ~345.575
            
            let cumulativePercent = 0;
            
            const catColors = [
              '#6366f1', // Indigo
              '#06b6d4', // Cyan
              '#10b981', // Emerald
              '#f59e0b', // Amber
              '#d946ef', // Fuchsia
              '#8b5cf6', // Violet
              '#f43f5e', // Rose
              '#3b82f6', // Blue
            ];
            const catTextColors = [
              'text-indigo-400',
              'text-cyan-400',
              'text-emerald-400',
              'text-amber-400',
              'text-fuchsia-400',
              'text-violet-400',
              'text-rose-400',
              'text-blue-400',
            ];
            const catBgColors = [
              'bg-indigo-500/10',
              'bg-cyan-500/10',
              'bg-emerald-500/10',
              'bg-amber-500/10',
              'bg-fuchsia-500/10',
              'bg-violet-500/10',
              'bg-rose-500/10',
              'bg-blue-500/10',
            ];

            return (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
                {/* Saatlik Yoğunluk Grafiği */}
                <div className="glass-card p-5 rounded-2xl shadow-md flex flex-col relative overflow-hidden">
                  <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span>Saatlik Ciro Yoğunluğu (Peak Hours)</span>
                  </h3>
                  
                  <div className="relative flex-1 min-h-[220px] flex items-center justify-center bg-slate-950/45 rounded-xl border border-slate-900 p-2">
                    <svg viewBox={`0 0 ${hourWidth} ${hourHeight}`} className="w-full h-full overflow-visible">
                      <defs>
                        <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6366f1" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                        </linearGradient>
                        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#6366f1" floodOpacity="0.4" />
                        </filter>
                      </defs>

                      {/* Yatay Izgara Çizgileri ve Y Eksen Değerleri */}
                      {[0, 0.25, 0.5, 0.75, 1].map((pct, idx) => {
                        const y = paddingT + cHeight * (1 - pct);
                        const labelValue = (maxHour * pct).toFixed(0);
                        return (
                          <g key={idx} className="opacity-70">
                            <line 
                              x1={paddingL} 
                              y1={y} 
                              x2={hourWidth - paddingR} 
                              y2={y} 
                              stroke="#1e293b" 
                              strokeWidth="1" 
                              strokeDasharray="3 3" 
                            />
                            <text 
                              x={paddingL - 8} 
                              y={y + 3} 
                              fill="#94a3b8" 
                              fontSize="8" 
                              fontWeight="600" 
                              textAnchor="end"
                            >
                              {labelValue} TL
                            </text>
                          </g>
                        );
                      })}

                      {/* Area Fill */}
                      {areaPath && (
                        <path 
                          d={areaPath} 
                          fill="url(#areaGrad)" 
                          className="chart-fade-in"
                        />
                      )}

                      {/* Line Stroke */}
                      {linePath && (
                        <path 
                          d={linePath} 
                          fill="none" 
                          stroke="#6366f1" 
                          strokeWidth="2.5" 
                          filter="url(#glow)"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="chart-draw-path"
                        />
                      )}

                      {/* X Ekseni Çizgisi */}
                      <line 
                        x1={paddingL} 
                        y1={paddingT + cHeight} 
                        x2={hourWidth - paddingR} 
                        y2={paddingT + cHeight} 
                        stroke="#334155" 
                        strokeWidth="1.5" 
                      />

                      {/* X Ekseni Etiketleri */}
                      {hourPoints.filter((_, idx) => idx % 4 === 0 || idx === 23).map((p, idx) => (
                        <text 
                          key={idx} 
                          x={p.x} 
                          y={hourHeight - 12} 
                          fill="#64748b" 
                          fontSize="9" 
                          fontWeight="bold" 
                          textAnchor="middle"
                        >
                          {p.hour}
                        </text>
                      ))}

                      {/* Dikey Kılavuz Çizgisi ve Nokta (Hover Durumunda) */}
                      {hoveredHourIndex !== null && hourPoints[hoveredHourIndex] && (
                        <g>
                          <line 
                            x1={hourPoints[hoveredHourIndex].x} 
                            y1={paddingT} 
                            x2={hourPoints[hoveredHourIndex].x} 
                            y2={paddingT + cHeight} 
                            stroke="rgba(99, 102, 241, 0.4)" 
                            strokeWidth="1.5" 
                            strokeDasharray="2 2" 
                          />
                          <circle 
                            cx={hourPoints[hoveredHourIndex].x} 
                            cy={hourPoints[hoveredHourIndex].y} 
                            r="5.5" 
                            fill="#6366f1" 
                            stroke="#ffffff" 
                            strokeWidth="2" 
                            filter="url(#glow)" 
                          />
                        </g>
                      )}

                      {/* İnteraktif Hover Tetikleyicileri (Görünmez Dikdörtgenler) */}
                      {hourPoints.map((p, idx) => {
                        const rectW = cWidth / 24;
                        const rectX = p.x - rectW / 2;
                        return (
                          <rect
                            key={idx}
                            x={rectX}
                            y={paddingT}
                            width={rectW}
                            height={cHeight}
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredHourIndex(idx)}
                            onMouseLeave={() => setHoveredHourIndex(null)}
                          />
                        );
                      })}
                    </svg>

                    {/* Tooltip HTML */}
                    {hoveredHourIndex !== null && hourPoints[hoveredHourIndex] && (
                      <div 
                        className="absolute bg-slate-950/95 border border-indigo-500/30 text-white p-2.5 rounded-xl shadow-xl backdrop-blur-md text-[10px] pointer-events-none z-10 transition-all duration-150 animate-scale-in"
                        style={{
                          left: `${(hourPoints[hoveredHourIndex].x / hourWidth) * 100}%`,
                          top: `${(hourPoints[hoveredHourIndex].y / hourHeight) * 100 - 32}%`,
                          transform: 'translateX(-50%)',
                        }}
                      >
                        <div className="font-bold text-slate-400">{hourPoints[hoveredHourIndex].hour} Dilimi</div>
                        <div className="font-extrabold text-indigo-300 text-xs mt-0.5">
                          {hourPoints[hoveredHourIndex].total.toFixed(2)} TL
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Kategori Bazlı Dağılım */}
                <div className="glass-card p-5 rounded-2xl shadow-md flex flex-col">
                  <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
                    <Layers className="w-4 h-4 text-purple-400" />
                    <span>Kategori Bazlı Ciro Dağılımı</span>
                  </h3>
                  
                  <div className="flex-1 flex flex-col sm:flex-row items-center justify-around gap-6 bg-slate-950/45 rounded-xl border border-slate-900 p-4">
                    {/* Donut Chart SVG */}
                    <div className="relative w-[170px] h-[170px] shrink-0 flex items-center justify-center">
                      <svg viewBox="0 0 220 220" className="w-full h-full transform -rotate-90">
                        {totalCatSales === 0 ? (
                          // Satış Yoksa Boş Halka Çiz
                          <circle
                            cx={donutCx}
                            cy={donutCy}
                            r={donutR}
                            stroke="#1e293b"
                            strokeWidth="10"
                            fill="transparent"
                          />
                        ) : (
                          categorySales.map((cat, idx) => {
                            const pct = cat.value / totalCatSales;
                            const dashSize = pct * donutC;
                            const offset = -cumulativePercent * donutC;
                            cumulativePercent += pct;
                            
                            const isHovered = hoveredCategoryIndex === idx;
                            
                            return (
                              <circle
                                key={idx}
                                cx={donutCx}
                                cy={donutCy}
                                r={donutR}
                                stroke={catColors[idx % catColors.length]}
                                strokeWidth={isHovered ? 15 : 10}
                                fill="transparent"
                                strokeDasharray={`${dashSize} ${donutC - dashSize}`}
                                strokeDashoffset={offset}
                                className="transition-all duration-200 cursor-pointer"
                                strokeLinecap={pct > 0.03 ? 'round' : 'butt'}
                                onMouseEnter={() => setHoveredCategoryIndex(idx)}
                                onMouseLeave={() => setHoveredCategoryIndex(null)}
                              />
                            );
                          })
                        )}
                      </svg>

                      {/* Donut Center Text */}
                      <div className="absolute flex flex-col items-center text-center justify-center bg-slate-950/70 w-[94px] h-[94px] rounded-full border border-slate-800/60 backdrop-blur-sm pointer-events-none select-none">
                        {hoveredCategoryIndex !== null && categorySales[hoveredCategoryIndex] ? (
                          <>
                            <span className="text-[9px] font-bold text-slate-400 uppercase truncate max-w-[80px]">
                              {categorySales[hoveredCategoryIndex].name}
                            </span>
                            <span className="text-xs font-black text-white mt-0.5">
                              {((categorySales[hoveredCategoryIndex].value / totalCatSales) * 100).toFixed(0)}%
                            </span>
                            <span className="text-[9px] font-bold text-indigo-300 mt-0.5">
                              {categorySales[hoveredCategoryIndex].value.toFixed(0)} TL
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider">
                              Toplam
                            </span>
                            <span className="text-[11px] font-black text-white mt-0.5 leading-tight">
                              {totalCatSales.toFixed(0)} TL
                            </span>
                            <span className="text-[8px] font-bold text-slate-500 mt-0.5">
                              {categorySales.length} Kategori
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Legend List */}
                    <div className="flex-1 w-full space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                      {categorySales.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 italic text-[10px]">Satış kaydı bulunamadı.</div>
                      ) : (
                        categorySales.map((cat, idx) => {
                          const pct = totalCatSales > 0 ? (cat.value / totalCatSales) * 100 : 0;
                          const isHovered = hoveredCategoryIndex === idx;
                          return (
                            <div 
                              key={idx}
                              className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${
                                isHovered ? 'bg-slate-900 text-white' : 'hover:bg-slate-900/40 text-slate-300'
                              }`}
                              onMouseEnter={() => setHoveredCategoryIndex(idx)}
                              onMouseLeave={() => setHoveredCategoryIndex(null)}
                            >
                              <div className="flex items-center space-x-2 truncate">
                                <span 
                                  className="w-2.5 h-2.5 rounded shrink-0"
                                  style={{ backgroundColor: catColors[idx % catColors.length] }}
                                />
                                <span className="text-[10px] font-bold truncate max-w-[100px]">{cat.name}</span>
                              </div>
                              <div className="text-right shrink-0 font-mono text-[9px] font-bold">
                                <span className="text-slate-400 mr-2">{pct.toFixed(0)}%</span>
                                <span className={catTextColors[idx % catTextColors.length]}>{cat.value.toFixed(1)} TL</span>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-6">
              {/* Ödeme Tipleri */}
              <div className="glass-card p-5 rounded-2xl shadow-md">
                <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>Ödeme Yöntemi Dağılımı</span>
                </h3>
                <div className="space-y-3.5">
                  {[
                    { label: 'Nakit (Cash)', val: reportsData.paymentMethods.cash, color: 'bg-emerald-500' },
                    { label: 'Kredi Kartı', val: reportsData.paymentMethods.creditCard, color: 'bg-indigo-500' },
                    { label: 'Yemek Kartı', val: reportsData.paymentMethods.mealCard, color: 'bg-cyan-500' },
                    { label: 'Cari (Veresiye)', val: reportsData.paymentMethods.cari || 0, color: 'bg-amber-500' }
                  ].map((pay, i) => {
                    const pct = reportsData.summary.totalRevenue > 0
                      ? (pay.val / reportsData.summary.totalRevenue) * 100
                      : 0;
                    return (
                      <div key={i} className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-300">{pay.label}</span>
                          <span className="text-slate-100">{pay.val.toFixed(2)} TL ({pct.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-slate-900 rounded-full h-2">
                          <div className={`h-2 rounded-full ${pay.color}`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Garson Satış Raporu */}
              <div className="glass-card p-5 rounded-2xl shadow-md">
                <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Garson Satış & Ciro Performansı</span>
                </h3>
                <div className="divide-y divide-slate-850 text-xs">
                  {reportsData.waiterSalesPerformance.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 italic">Kayıtlı garson satışı bulunamadı.</div>
                  ) : (
                    reportsData.waiterSalesPerformance.map((waiter, i) => (
                      <div key={i} className="flex flex-col py-2">
                        <div 
                          className="flex justify-between items-center cursor-pointer hover:bg-slate-900/40 p-2 rounded-xl transition"
                          onClick={() => setExpandedWaiterIndex(expandedWaiterIndex === i ? null : i)}
                        >
                          <div>
                            <div className="font-bold text-slate-200">{waiter.name}</div>
                            <div className="text-[10px] text-slate-500">Kapatılan Adisyon: {waiter.ordersCount} adet</div>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="bg-emerald-500/10 text-emerald-400 font-extrabold px-3 py-1 rounded-full text-xs">
                              {waiter.totalSales.toFixed(2)} TL Satış
                            </span>
                            {expandedWaiterIndex === i ? <ArrowUp className="w-4 h-4 text-slate-400" /> : <ArrowDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>
                        {expandedWaiterIndex === i && (
                          <div className="mt-2 px-2 animate-scale-in">
                            <div className="bg-slate-900/50 border border-slate-800/50 rounded-xl p-3 space-y-2">
                              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-800 pb-2 mb-2">Sattığı Ürünler</h4>
                              {waiter.items && waiter.items.length > 0 ? (
                                <div className="max-h-[150px] overflow-y-auto pr-1 scrollbar-thin space-y-1.5">
                                  {waiter.items.map((item, idx) => (
                                    <div key={idx} className="flex justify-between items-center text-[11px]">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-slate-500 font-mono w-5">{item.quantity}x</span>
                                        <span className="text-slate-300 font-medium">{item.name}</span>
                                      </div>
                                      <span className="text-emerald-400/80 font-semibold">{item.total.toFixed(2)} TL</span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="text-[10px] text-slate-500 italic">Ürün detayı bulunamadı.</div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* En Çok Satan Ürünler */}
              <div className="glass-card p-5 rounded-2xl shadow-md">
                <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
                  <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                  <span>En Çok Satan 5 Ürün</span>
                </h3>
                <div className="divide-y divide-slate-850">
                  {reportsData.topProducts.map((p, i) => (
                    <div key={i} className="flex justify-between items-center py-2.5 text-xs">
                      <div className="flex items-center space-x-2.5">
                        <span className="w-5 h-5 rounded bg-indigo-500/10 text-indigo-400 font-bold flex items-center justify-center text-[10px]">
                          {i + 1}
                        </span>
                        <span className="font-semibold text-slate-200">{p.name}</span>
                      </div>
                      <div className="text-right">
                        <span className="bg-slate-900 px-2 py-0.5 rounded text-[10px] font-bold text-slate-400 mr-2">{p.quantity} Adet</span>
                        <span className="font-bold text-slate-100">{p.total.toFixed(2)} TL</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Kapatılan Toplam Adisyonlar (Z Günlüğü) */}
          <div className="glass-card p-5 rounded-2xl shadow-md text-xs">
            <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
              <span>Günlük Kapatılan Adisyon Defteri (Z Günlüğü)</span>
            </h3>
            <div className="overflow-x-auto max-h-[300px] scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/35 text-slate-400 font-semibold">
                    <th className="p-3">Kapatılma Zamanı</th>
                    <th className="p-3">Masa</th>
                    <th className="p-3">Siparişi Kapatan Garson</th>
                    <th className="p-3">Cari İsim (Cari ise)</th>
                    <th className="p-3 text-right">Net Tutar</th>
                    <th className="p-3 text-center">Detay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {reportsData.adisyonHistory.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                        Kapatılmış adisyon bulunmamaktadır.
                      </td>
                    </tr>
                  ) : (
                    reportsData.adisyonHistory.map((o) => (
                      <tr key={o.id} className="hover:bg-slate-900/20 transition text-slate-300">
                        <td className="p-3 font-mono text-slate-500">
                          {new Date(o.updatedAt).toLocaleTimeString('tr-TR')}
                        </td>
                        <td className="p-3 font-bold text-slate-200">{o.tableName}</td>
                        <td className="p-3 text-slate-300 font-semibold">{o.waiterName}</td>
                        <td className="p-3">
                          {o.customerName ? (
                            <span className="text-cyan-400 font-semibold">{o.customerName}</span>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-extrabold text-indigo-300">
                          {o.paidAmount.toFixed(2)} TL
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setSelectedAdisyon(o)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-1 px-2.5 rounded-lg font-bold"
                          >
                            İncele
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Günlük Toplam Satılan Ürün Özeti */}
          <div className="glass-card p-5 rounded-2xl shadow-md text-xs">
            <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
              <Package className="w-4 h-4 text-cyan-400" />
              <span>Günlük Satılan Toplam Ürün Raporu</span>
            </h3>
            <div className="overflow-x-auto max-h-[300px] scrollbar-thin">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/35 text-slate-400 font-semibold">
                    <th className="p-3">Ürün Adı</th>
                    <th className="p-3 text-center">Toplam Adet</th>
                    <th className="p-3 text-right">Toplam Ciro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-850">
                  {!reportsData.productSalesSummary || reportsData.productSalesSummary.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="p-6 text-center text-slate-500 italic">
                        Satılan ürün kaydı bulunmamaktadır.
                      </td>
                    </tr>
                  ) : (
                    reportsData.productSalesSummary.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-900/20 transition text-slate-300">
                        <td className="p-3 font-semibold text-slate-200">{p.name}</td>
                        <td className="p-3 text-center font-extrabold text-cyan-400">{p.quantity} Adet</td>
                        <td className="p-3 text-right font-extrabold text-emerald-400">{p.total.toFixed(2)} TL</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : activeTab === 'LOGS' ? (
        /* Garson Log Defteri */
        <div className="glass-card rounded-2xl overflow-hidden shadow-lg animate-fade-in text-xs">
          <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/20">
            <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
              <Database className="w-4 h-4 text-rose-400" />
              <span>Denetim & Mutfak İptal Günlüğü</span>
            </h3>
            <span className="text-xs bg-rose-500/20 text-rose-400 font-bold px-2 py-0.5 rounded-full text-[10px]">
              {logs.length} Log Kaydı
            </span>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/35 text-slate-400 font-semibold">
                  <th className="p-4">Tarih / Saat</th>
                  <th className="p-4">İşlem Tipi</th>
                  <th className="p-4">Talep Eden (Garson)</th>
                  <th className="p-4">Onaylayan (Müdür)</th>
                  <th className="p-4">Açıklama / Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-900/30 transition text-slate-300">
                    <td className="p-4 whitespace-nowrap text-slate-500 font-mono">
                      {new Date(log.createdAt).toLocaleString('tr-TR')}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                        log.actionType === 'ITEM_CANCEL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                        log.actionType === 'TABLE_MERGE' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                        log.actionType === 'DISCOUNT_APPLIED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-slate-800 text-slate-300'
                      }`}>
                        {log.actionType}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-slate-200">
                      {log.actorUser.name}
                      <span className="text-[10px] text-slate-500 block">
                        {log.actorUser.role === 'ADMIN' ? 'Müdür' : 'Garson'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">
                      {log.approverUser ? (
                        <span className="text-emerald-400 font-medium">
                          {log.approverUser.name}
                        </span>
                      ) : (
                        <span className="text-slate-500">-</span>
                      )}
                    </td>
                    <td className="p-4 font-medium text-slate-200">{log.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'MENU' ? (
        /* Menü & Ürün Yönetimi */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-xs">
          <div className="glass-card p-5 rounded-2xl shadow-md flex flex-col min-h-[350px]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
              <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
                <FolderOpen className="w-4 h-4 text-indigo-400" />
                <span>Menü Kategorileri</span>
              </h3>
              <button
                onClick={() => setCategoryModal({ name: '', sortOrder: menuCategories.length + 1 })}
                className="bg-indigo-650 hover:bg-indigo-500 text-white font-bold p-1.5 px-2 rounded-lg transition text-[10px] flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ekle</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px] pr-1 scrollbar-thin">
              {menuCategories.map((cat) => (
                <div
                  key={cat.id}
                  onClick={() => setSelectedMenuCategoryId(cat.id)}
                  className={`p-3 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                    selectedMenuCategoryId === cat.id
                      ? 'bg-indigo-500/10 border-indigo-500/80 text-white font-semibold'
                      : 'bg-slate-900/40 border-slate-850 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="truncate pr-4">
                    {cat.name} <span className="text-[10px] text-slate-500 ml-1">({cat.products.length} ürün)</span>
                  </span>
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCategoryModal({ id: cat.id, name: cat.name, sortOrder: cat.sortOrder });
                      }}
                      className="hover:bg-indigo-500/20 p-1 text-indigo-400 rounded transition"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCategory(cat.id, cat.name);
                      }}
                      className="hover:bg-rose-500/20 p-1 text-rose-400 rounded transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 glass-card p-5 rounded-2xl shadow-md flex flex-col min-h-[350px]">
            {(() => {
              const selectedCat = menuCategories.find((c) => c.id === selectedMenuCategoryId);
              const productsList = selectedCat ? selectedCat.products : [];

              return (
                <>
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
                    <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
                      <Package className="w-4 h-4 text-cyan-400" />
                      <span>{selectedCat ? `"${selectedCat.name}" Ürünleri` : 'Ürünler'}</span>
                    </h3>
                    <button
                      disabled={!selectedMenuCategoryId}
                      onClick={() => {
                        setProductModal({
                          name: '',
                          price: 0,
                          categoryId: selectedMenuCategoryId,
                          isStockControlled: false,
                          stockLevel: 0,
                          image: '',
                          modifierIds: [],
                          newModifiers: [],
                        });
                        setNewModName('');
                        setNewModPrice('0');
                      }}
                      className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-bold p-1.5 px-2 rounded-lg transition text-[10px] flex items-center space-x-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Ürün Ekle</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-x-auto scrollbar-thin">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 bg-slate-900/30 text-slate-400 font-semibold">
                          <th className="p-3">Ürün Adı</th>
                          <th className="p-3 text-right">Fiyat</th>
                          <th className="p-3 text-center">Stok T.</th>
                          <th className="p-3 text-center">Mevcut Stok</th>
                          <th className="p-3 text-center">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {productsList.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-6 text-center text-slate-500 italic">
                              Seçili kategoriye ait ürün bulunmuyor.
                            </td>
                          </tr>
                        ) : (
                          productsList.map((prod: any) => (
                            <tr key={prod.id} className="hover:bg-slate-900/20 text-slate-300">
                              <td className="p-3 font-semibold text-slate-200">
                                <div className="flex items-center space-x-2">
                                  {prod.image && (
                                    <img 
                                      src={prod.image} 
                                      alt={prod.name} 
                                      className="w-7 h-7 rounded-lg object-cover border border-slate-800 shrink-0" 
                                    />
                                  )}
                                  <span>{prod.name}</span>
                                </div>
                              </td>
                              <td className="p-3 text-right font-bold text-cyan-300">{prod.price.toFixed(2)} TL</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                                  prod.isStockControlled ? 'bg-indigo-500/20 text-indigo-400' : 'bg-slate-800 text-slate-500'
                                }`}>
                                  {prod.isStockControlled ? 'Aktif' : 'Pasif'}
                                </span>
                              </td>
                              <td className="p-3 text-center font-semibold text-slate-300">
                                {prod.isStockControlled ? `${prod.stockLevel} adet` : '-'}
                              </td>
                              <td className="p-3 text-center">
                                <div className="flex items-center justify-center space-x-2">
                                  <button
                                    onClick={() => {
                                      setProductModal({
                                        id: prod.id,
                                        name: prod.name,
                                        price: prod.price,
                                        categoryId: prod.categoryId,
                                        isStockControlled: prod.isStockControlled,
                                        stockLevel: prod.stockLevel,
                                        image: prod.image || '',
                                        modifierIds: prod.modifiers?.map((m: any) => m.id) || [],
                                        newModifiers: [],
                                      });
                                      setNewModName('');
                                      setNewModPrice('0');
                                    }}
                                    className="hover:bg-indigo-500/20 p-1 text-indigo-400 rounded transition"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteProduct(prod.id, prod.name)}
                                    className="hover:bg-rose-500/20 p-1 text-rose-400 rounded transition"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : activeTab === 'MODIFIERS' ? (
        /* Ek Seçenek (Modifier) Yönetimi */
        <div className="glass-card p-5 rounded-2xl shadow-md flex flex-col text-xs animate-fade-in">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
            <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Ürün Ek Seçenekleri (Modifiers)</span>
            </h3>
            <button
              onClick={() => setModifierModal({ name: '', price: 0, productIds: [] })}
              className="bg-indigo-650 hover:bg-indigo-500 text-white font-bold p-1.5 px-3 rounded-lg transition text-[10px] flex items-center space-x-1 cursor-pointer shadow-md shadow-indigo-600/10"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Seçenek Ekle</span>
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/30 text-slate-400 font-semibold">
                  <th className="p-3">Seçenek Adı</th>
                  <th className="p-3">Bağlı Ürünler</th>
                  <th className="p-3 text-right">Ekstra Fiyatı</th>
                  <th className="p-3 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {modifiers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500 italic">
                      Seçenek tanımlanmamıştır. Sol üstten seçenek ekleyin.
                    </td>
                  </tr>
                ) : (
                  modifiers.map((mod) => (
                    <tr key={mod.id} className="hover:bg-slate-900/20 text-slate-300">
                      <td className="p-3 font-semibold text-slate-200">{mod.name}</td>
                      <td className="p-3">
                        {mod.products && mod.products.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {mod.products.map((p: any) => (
                              <span key={p.id} className="bg-indigo-900/50 text-indigo-300 font-semibold px-2 py-0.5 rounded text-[9px]">
                                {p.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Global / Hiçbir Ürün</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-indigo-300">+{mod.price.toFixed(2)} TL</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => setModifierModal({ id: mod.id, name: mod.name, price: mod.price, productIds: mod.products?.map((p: any) => p.id) || [] })}
                            className="hover:bg-indigo-500/20 p-1 text-indigo-400 rounded transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteModifier(mod.id, mod.name)}
                            className="hover:bg-rose-500/20 p-1 text-rose-400 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'TABLES' ? (
        /* Masa Yönetimi & Sıralayıcısı */
        <div className="glass-card p-5 rounded-2xl shadow-md flex flex-col text-xs animate-fade-in">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
            <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Masa & Bölge Yönetim Sistemi</span>
            </h3>
            <button
              onClick={() => setTableModal({ name: '', area: 'Bahçe' })}
              className="bg-indigo-650 hover:bg-indigo-500 text-white font-bold p-1.5 px-3 rounded-lg transition text-[10px] flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Masa Ekle</span>
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/30 text-slate-400 font-semibold">
                  <th className="p-3">Masa Adı</th>
                  <th className="p-3">Hizmet Bölgesi</th>
                  <th className="p-3 text-center">Durum</th>
                  <th className="p-3 text-center">Sıralama Önceliği</th>
                  <th className="p-3 text-center">Düzenle / Taşı</th>
                  <th className="p-3 text-center font-bold">Sil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {tables.map((tbl) => (
                  <tr key={tbl.id} className="hover:bg-slate-900/20 text-slate-300">
                    <td className="p-3 font-semibold text-slate-200">{tbl.name}</td>
                    <td className="p-3 text-slate-400 font-semibold">{tbl.area}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                        tbl.status === 'EMPTY' ? 'bg-slate-800 text-slate-400' : 'bg-rose-500/20 text-rose-400'
                      }`}>
                        {tbl.status === 'EMPTY' ? 'Boş' : 'Dolu'}
                      </span>
                    </td>
                    <td className="p-3 text-center font-semibold text-slate-400">{tbl.sortOrder}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleSortTable(tbl.id, 'up')}
                          className="hover:bg-slate-800 p-1 text-indigo-400 rounded transition"
                          title="Yukarı Taşı"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSortTable(tbl.id, 'down')}
                          className="hover:bg-slate-800 p-1 text-indigo-400 rounded transition"
                          title="Aşağı Taşı"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTableModal({ id: tbl.id, name: tbl.name, area: tbl.area })}
                          className="hover:bg-slate-800 p-1 text-slate-300 hover:text-white rounded transition ml-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleDeleteTable(tbl.id, tbl.name)}
                        className="hover:bg-rose-500/20 p-1 text-rose-400 rounded transition"
                        title="Masayı Sil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'CARI' ? (
        /* Cari Hesap Defteri (CARI) */
        <div className="glass-card p-5 rounded-2xl shadow-md flex flex-col text-xs animate-fade-in">
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-800">
            <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Veresiye Hesap Defteri (Cari Müşteriler)</span>
            </h3>
            <button
              onClick={() => setCustomerModal({ name: '', phone: '', balance: 0 })}
              className="bg-indigo-650 hover:bg-indigo-500 text-white font-bold p-1.5 px-3 rounded-lg transition text-[10px] flex items-center space-x-1 cursor-pointer shadow-md shadow-indigo-600/10"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Müşteri Tanımla</span>
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/30 text-slate-400 font-semibold">
                  <th className="p-3">Cari İsim / Unvan</th>
                  <th className="p-3">Telefon</th>
                  <th className="p-3 text-right">Borç Bakiyesi</th>
                  <th className="p-3 text-center">Tahsilat Al</th>
                  <th className="p-3 text-center">Detay / Ekstre</th>
                  <th className="p-3 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-850">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500 italic">
                      Cari bakiye kaydı bulunmamaktadır.
                    </td>
                  </tr>
                ) : (
                  customers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-slate-900/20 text-slate-300">
                      <td className="p-3 font-semibold text-slate-200">{cust.name}</td>
                      <td className="p-3 text-slate-400 font-mono">{cust.phone}</td>
                      <td className="p-3 text-right font-bold text-rose-400">{cust.balance.toFixed(2)} TL</td>
                      <td className="p-3 text-center">
                        <button
                          disabled={cust.balance <= 0}
                          onClick={() => setCollectionModal({ id: cust.id, name: cust.name, amount: '', paymentMethod: 'CASH' })}
                          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 text-white font-bold py-1 px-3 rounded-lg text-[10px] transition cursor-pointer"
                        >
                          Tahsil Et
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => handleViewCariDetails(cust.id)}
                          className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold py-1 px-2.5 rounded-lg text-[10px]"
                        >
                          Ekstre Dökümü
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => setCustomerModal({ id: cust.id, name: cust.name, phone: cust.phone, balance: cust.balance })}
                            className="hover:bg-indigo-500/20 p-1 text-indigo-400 rounded transition"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCustomer(cust.id, cust.name)}
                            className="hover:bg-rose-500/20 p-1 text-rose-400 rounded transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* ADİSYON DETAY MODALI */}
      {selectedAdisyon && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <div className="flex justify-between items-start pb-3 border-b border-slate-800 mb-4">
              <div>
                <h3 className="font-heading font-black text-sm text-white flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-indigo-400" />
                  <span>Adisyon Detayı</span>
                  <span className="text-[10px] bg-slate-800 text-slate-300 font-semibold px-2 py-0.5 rounded ml-2">
                    {selectedAdisyon.tableName}
                  </span>
                </h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  Kapatılma: {new Date(selectedAdisyon.updatedAt).toLocaleString('tr-TR')}
                </p>
              </div>
              <button
                onClick={() => setSelectedAdisyon(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="border border-slate-800 rounded-xl bg-slate-900/30 p-3 divide-y divide-slate-850 max-h-56 overflow-y-auto scrollbar-thin">
                {selectedAdisyon.items.map((item, idx) => {
                  const mods = item.selectedModifiers ? JSON.parse(item.selectedModifiers) : [];
                  const modTotal = mods.reduce((sum: number, m: any) => sum + m.price, 0);
                  return (
                    <div key={idx} className="py-2 first:pt-0 last:pb-0 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-slate-200">{item.productName}</div>
                        {mods.length > 0 && (
                          <div className="text-[10px] text-indigo-400 italic mt-0.5">
                            + {mods.map((m: any) => m.name).join(', ')}
                          </div>
                        )}
                        <div className="text-[9px] text-slate-500">
                          {item.quantity} adet × {item.unitPrice + modTotal} TL
                        </div>
                      </div>
                      <span className="font-bold text-slate-100">
                        {((item.unitPrice + modTotal) * item.quantity).toFixed(2)} TL
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2">
                <div className="flex justify-between text-slate-400">
                  <span>Toplam Adisyon Tutarı</span>
                  <span className="font-bold text-slate-200">{selectedAdisyon.totalAmount.toFixed(2)} TL</span>
                </div>
                {selectedAdisyon.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>Uygulanan İndirim</span>
                    <span>-{selectedAdisyon.discountAmount.toFixed(2)} TL</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-400 border-t border-slate-900 pt-2 font-bold">
                  <span>Ödenen Net Tutar</span>
                  <span>{selectedAdisyon.paidAmount.toFixed(2)} TL</span>
                </div>
                <div className="flex justify-between text-slate-500 text-[10px] pt-1">
                  <span>Siparişi Kapatan Garson:</span>
                  <span className="font-semibold">{selectedAdisyon.waiterName}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedAdisyon(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl font-bold cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARI DETAY / EKSTRE MODALI */}
      {selectedCariStatement && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 shadow-2xl border-emerald-500/20 animate-scale-in text-xs flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-start pb-3 border-b border-slate-800 mb-4 shrink-0">
              <div>
                <h3 className="font-heading font-black text-base text-white flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  <span>Cari Hesap Ekstre Detayı</span>
                </h3>
                <p className="text-[11px] text-slate-400 mt-1">
                  Müşteri: <strong className="text-slate-200">{selectedCariStatement.customer.name}</strong> • Tel: {selectedCariStatement.customer.phone}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Toplam Cari Borç</div>
                  <div className="text-lg font-heading font-black text-rose-400">{selectedCariStatement.customer.balance.toFixed(2)} TL</div>
                </div>
                <button
                  onClick={() => setSelectedCariStatement(null)}
                  className="text-slate-400 hover:text-white p-1 bg-slate-900 rounded-lg border border-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin">
              {/* Timeline list of Cari Orders and Cash Collections */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">Cari Hesap Hareketleri</h4>
                
                {selectedCariStatement.orders.length === 0 && selectedCariStatement.collections.length === 0 ? (
                  <div className="text-center py-10 text-slate-500 italic border border-dashed border-slate-800 rounded-2xl">
                    Hesaba ait cari hareket bulunmuyor.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Combine orders (debits) and collections (credits) in date order */}
                    {(() => {
                      const debits = selectedCariStatement.orders.map(o => ({
                        type: 'DEBIT',
                        date: new Date(o.createdAt),
                        data: o
                      }));
                      const credits = selectedCariStatement.collections.map(c => ({
                        type: 'CREDIT',
                        date: new Date(c.createdAt),
                        data: c
                      }));
                      
                      const allMoves = [...debits, ...credits].sort((a, b) => b.date.getTime() - a.date.getTime());

                      return allMoves.map((move, idx) => {
                        if (move.type === 'DEBIT') {
                          const o = move.data;
                          return (
                            <div key={`d-${idx}`} className="bg-slate-900/60 border border-slate-850 p-4 rounded-xl space-y-2">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-mono text-slate-500">
                                  {new Date(o.createdAt).toLocaleString('tr-TR')}
                                </span>
                                <span className="bg-rose-500/10 border border-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded">
                                  Veresiye Adisyon (Borç)
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <div>
                                  Masa: <strong className="text-slate-200">{o.tableName}</strong> • 
                                  Garson: <span className="text-slate-400 font-semibold ml-1">{o.waiterName}</span>
                                </div>
                                <span className="font-black text-rose-400 text-sm">+{o.totalAmount.toFixed(2)} TL</span>
                              </div>
                              {/* Items list */}
                              <div className="bg-slate-950/60 p-2 rounded-lg text-[10px] text-slate-400 border border-slate-900 divide-y divide-slate-900 space-y-1">
                                {o.items.map((item: any, i: number) => {
                                  const mods = item.selectedModifiers ? JSON.parse(item.selectedModifiers) : [];
                                  return (
                                    <div key={i} className="flex justify-between pt-1 first:pt-0">
                                      <span>
                                        {item.quantity}x {item.productName} 
                                        {mods.length > 0 && <span className="text-indigo-400 ml-1">({mods.map((m: any) => m.name).join(', ')})</span>}
                                      </span>
                                      <span className="font-bold text-slate-300">
                                        {((item.unitPrice + mods.reduce((s: number, m: any) => s + m.price, 0)) * item.quantity).toFixed(2)} TL
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        } else {
                          const c = move.data;
                          // Extract amount and payment method from string description if needed,
                          // but description already has the info. Let's just highlight it!
                          return (
                            <div key={`c-${idx}`} className="bg-emerald-950/10 border border-emerald-900/30 p-3 rounded-xl flex justify-between items-center">
                              <div>
                                <span className="font-mono text-slate-500 text-[10px] block mb-1">
                                  {new Date(c.createdAt).toLocaleString('tr-TR')}
                                </span>
                                <div className="text-emerald-300 font-semibold flex items-center space-x-1.5">
                                  <DollarSign className="w-3.5 h-3.5" />
                                  <span>{c.description}</span>
                                </div>
                              </div>
                              <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 font-black px-2.5 py-1 rounded-lg text-xs">
                                Aktif Tahsilat
                              </span>
                            </div>
                          );
                        }
                      });
                    })()}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-800 shrink-0">
              <button
                onClick={() => setSelectedCariStatement(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3 rounded-xl font-bold cursor-pointer text-center"
              >
                Döküm Pencerisini Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODIFIER MODAL */}
      {modifierModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <Star className="w-5 h-5 text-indigo-400" />
              <span>{modifierModal.id ? 'Seçeneği Düzenle' : 'Yeni Seçenek Ekle'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Seçenek Adı</label>
                <input
                  type="text"
                  value={modifierModal.name}
                  onChange={(e) => setModifierModal({ ...modifierModal, name: e.target.value })}
                  placeholder="Örn: Double Shot, Ekstra Peynir"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1.5">Bağlanacağı Ürünler</label>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 max-h-40 overflow-y-auto space-y-1.5 scrollbar-thin">
                  {menuCategories.flatMap((cat: any) => cat.products || []).map((prod: any) => {
                    const isChecked = modifierModal.productIds?.includes(prod.id) || false;
                    return (
                      <label key={prod.id} className="flex items-center space-x-2 text-slate-300 hover:text-white cursor-pointer select-none py-0.5">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            const currentIds = modifierModal.productIds || [];
                            if (e.target.checked) {
                              setModifierModal({
                                ...modifierModal,
                                productIds: [...currentIds, prod.id]
                              });
                            } else {
                              setModifierModal({
                                ...modifierModal,
                                productIds: currentIds.filter((pid) => pid !== prod.id)
                              });
                            }
                          }}
                          className="w-3.5 h-3.5 accent-indigo-500 rounded border-slate-800 cursor-pointer"
                        />
                        <span className="text-[11px]">{prod.name}</span>
                        <span className="text-[9px] text-slate-500 font-semibold">({menuCategories.find(c => c.products.some((p: any) => p.id === prod.id))?.name || ''})</span>
                      </label>
                    );
                  })}
                  {menuCategories.flatMap((cat: any) => cat.products || []).length === 0 && (
                    <div className="text-[10px] text-slate-500 italic p-2 text-center">Menüde ürün bulunmamaktadır.</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Fiyat Farkı (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={modifierModal.price === 0 ? '' : modifierModal.price}
                  onChange={(e) => setModifierModal({ ...modifierModal, price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              {actionError && (
                <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-2 rounded-xl text-[10px]">
                  {actionError}
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    setModifierModal(null);
                    setActionError('');
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveModifier}
                  className="flex-1 gradient-primary hover:bg-indigo-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MASA MODAL */}
      {tableModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>{tableModal.id ? 'Masayı Düzenle' : 'Yeni Masa Ekle'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Masa Adı</label>
                <input
                  type="text"
                  value={tableModal.name}
                  onChange={(e) => setTableModal({ ...tableModal, name: e.target.value })}
                  placeholder="Örn: Masa 12, B-4"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Bölge (Area)</label>
                <select
                  value={tableModal.area}
                  onChange={(e) => setTableModal({ ...tableModal, area: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                >
                  <option value="Açık">Açık</option>
                  <option value="Bahçe">Bahçe</option>
                  <option value="Üst Kat">Üst Kat</option>
                  <option value="Loca">Loca</option>
                  <option value="Teras">Teras</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>

              {actionError && (
                <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-2 rounded-xl text-[10px]">
                  {actionError}
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    setTableModal(null);
                    setActionError('');
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveTable}
                  className="flex-1 gradient-primary hover:bg-indigo-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CARI MUSTERI MODAL */}
      {customerModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-indigo-400" />
              <span>{customerModal.id ? 'Müşteri Bilgilerini Düzenle' : 'Yeni Cari Hesap Oluştur'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Müşteri / Cari Adı</label>
                <input
                  type="text"
                  value={customerModal.name}
                  onChange={(e) => setCustomerModal({ ...customerModal, name: e.target.value })}
                  placeholder="Örn: Ahmet Bey, Google Türkiye"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Telefon Numarası</label>
                <input
                  type="text"
                  value={customerModal.phone}
                  onChange={(e) => setCustomerModal({ ...customerModal, phone: e.target.value })}
                  placeholder="Örn: 0532 555 4433"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              {!customerModal.id && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Başlangıç Bakiyesi (Borç)</label>
                  <input
                    type="number"
                    value={customerModal.balance === 0 ? '' : customerModal.balance}
                    onChange={(e) => setCustomerModal({ ...customerModal, balance: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00 TL"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  />
                </div>
              )}

              {actionError && (
                <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-2 rounded-xl text-[10px]">
                  {actionError}
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    setCustomerModal(null);
                    setActionError('');
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveCustomer}
                  className="flex-1 gradient-primary hover:bg-indigo-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAHSILAT AL MODAL */}
      {collectionModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-2 flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span>Cari Hesap Tahsilat Al</span>
            </h3>
            <p className="text-[11px] text-slate-400 mb-4">
              <strong>{collectionModal.name}</strong> müşterisinden alınan tahsilat miktarını ve ödeme tipini belirleyin.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Tahsil Edilen Tutar (TL)</label>
                <input
                  type="number"
                  value={collectionModal.amount}
                  onChange={(e) => setCollectionModal({ ...collectionModal, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              {/* Payment Method Select */}
              <div className="flex bg-slate-950 border border-slate-800 p-1 rounded-xl">
                <button
                  onClick={() => setCollectionModal({ ...collectionModal, paymentMethod: 'CASH' })}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    collectionModal.paymentMethod === 'CASH' ? 'gradient-primary text-white' : 'text-slate-400'
                  }`}
                >
                  Nakit
                </button>
                <button
                  onClick={() => setCollectionModal({ ...collectionModal, paymentMethod: 'CREDIT_CARD' })}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    collectionModal.paymentMethod === 'CREDIT_CARD' ? 'gradient-primary text-white' : 'text-slate-400'
                  }`}
                >
                  Kredi Kartı
                </button>
              </div>

              {actionError && (
                <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-2 rounded-xl text-[10px]">
                  {actionError}
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    setCollectionModal(null);
                    setActionError('');
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleCollectSubmit}
                  className="flex-1 bg-emerald-650 hover:bg-emerald-550 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  Tahsilatı Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KATEGORİ MODAL */}
      {categoryModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <FolderOpen className="w-5 h-5 text-indigo-400" />
              <span>{categoryModal.id ? 'Kategoriyi Düzenle' : 'Yeni Kategori Ekle'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Kategori Adı</label>
                <input
                  type="text"
                  value={categoryModal.name}
                  onChange={(e) => setCategoryModal({ ...categoryModal, name: e.target.value })}
                  placeholder="Örn: Tatlılar, Güne Başlarken"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Sıralama Önceliği</label>
                <input
                  type="number"
                  value={categoryModal.sortOrder}
                  onChange={(e) => setCategoryModal({ ...categoryModal, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              {actionError && (
                <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-2 rounded-xl text-[10px]">
                  {actionError}
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    setCategoryModal(null);
                    setActionError('');
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveCategory}
                  className="flex-1 gradient-primary hover:bg-indigo-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ÜRÜN MODAL */}
      {productModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <Package className="w-5 h-5 text-cyan-400" />
              <span>{productModal.id ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Ürün Adı</label>
                <input
                  type="text"
                  value={productModal.name}
                  onChange={(e) => setProductModal({ ...productModal, name: e.target.value })}
                  placeholder="Örn: Penne Arabiata, Latte"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Birim Satış Fiyatı (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={productModal.price === 0 ? '' : productModal.price}
                  onChange={(e) => setProductModal({ ...productModal, price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Kategori</label>
                <select
                  value={productModal.categoryId}
                  onChange={(e) => setProductModal({ ...productModal, categoryId: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                >
                  {menuCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Ürün Görsel URL'si (Opsiyonel)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={productModal.image || ''}
                    onChange={(e) => setProductModal({ ...productModal, image: e.target.value })}
                    placeholder="https://images.unsplash.com/... veya /resim.png"
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500/80"
                  />
                  {productModal.image && (
                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-slate-800">
                      <img 
                        src={productModal.image} 
                        alt="Önizleme" 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="%23f43f5e" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="17" x2="15" y2="12"/><line x1="9" y1="12" x2="15" y2="17"/></svg>';
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-3 p-3 bg-slate-900/40 border border-slate-855 rounded-xl">
                <input
                  type="checkbox"
                  id="stockControl"
                  checked={productModal.isStockControlled}
                  onChange={(e) => setProductModal({ ...productModal, isStockControlled: e.target.checked })}
                  className="w-4 h-4 accent-indigo-500"
                />
                <label htmlFor="stockControl" className="font-semibold text-slate-300 cursor-pointer">
                  Basit Stok Takibi Aktif
                </label>
              </div>

              {productModal.isStockControlled && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Mevcut Stok Miktarı</label>
                  <input
                    type="number"
                    value={productModal.stockLevel}
                    onChange={(e) => setProductModal({ ...productModal, stockLevel: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                  />
                </div>
              )}

              {/* Ek Seçenekler (Modifiers) Bölümü */}
              <div className="border-t border-slate-800/80 pt-3">
                <label className="block text-[11px] font-bold text-indigo-400 uppercase tracking-wider mb-2">
                  Ürün Ek Seçenekleri (Modifiers)
                </label>

                {/* Mevcut Seçenekler Checklist */}
                {modifiers.length > 0 && (
                  <div className="mb-3">
                    <span className="block text-[10px] text-slate-400 mb-1">Mevcut Seçeneklerden Bağla:</span>
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-2.5 max-h-[110px] overflow-y-auto grid grid-cols-2 gap-2 scrollbar-thin">
                      {modifiers.map((mod) => {
                        const isChecked = (productModal.modifierIds || []).includes(mod.id);
                        return (
                          <label key={mod.id} className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-slate-800/50 cursor-pointer text-[10px] font-medium text-slate-300">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleModifierInProduct(mod.id)}
                              className="accent-indigo-500 rounded"
                            />
                            <span className="truncate">{mod.name} (+{mod.price} TL)</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Inline Yeni Eklenen Geçici Seçenekler Listesi */}
                {(productModal.newModifiers || []).length > 0 && (
                  <div className="mb-3">
                    <span className="block text-[10px] text-slate-400 mb-1">Yeni Eklenecek Seçenekler:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(productModal.newModifiers || []).map((m, idx) => (
                        <span key={idx} className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 px-2 py-0.5 rounded-lg flex items-center text-[10px] font-semibold">
                          <span>{m.name} (+{m.price} TL)</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveNewModInline(idx)}
                            className="ml-1.5 text-rose-400 hover:text-rose-300 font-black cursor-pointer"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hızlı Yeni Seçenek Tanımlama Girişleri */}
                <div className="bg-slate-950/40 border border-slate-850 p-2.5 rounded-xl">
                  <span className="block text-[10px] font-semibold text-slate-400 mb-1.5">Yeni Seçenek Oluştur & Ekle:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newModName}
                      onChange={(e) => setNewModName(e.target.value)}
                      placeholder="Seçenek adı (örn: Muzlu)"
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500/80"
                    />
                    <input
                      type="number"
                      value={newModPrice === '0' ? '' : newModPrice}
                      onChange={(e) => setNewModPrice(e.target.value)}
                      placeholder="+0 TL"
                      className="w-16 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-slate-200 focus:outline-none focus:border-indigo-500/80"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewModInline}
                      className="bg-indigo-650 hover:bg-indigo-500 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px] cursor-pointer"
                    >
                      Ekle
                    </button>
                  </div>
                </div>
              </div>

              {actionError && (
                <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-2 rounded-xl text-[10px]">
                  {actionError}
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    setProductModal(null);
                    setActionError('');
                  }}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveProduct}
                  className="flex-1 gradient-primary hover:bg-indigo-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADİSYON DETAY MODALI */}
      {selectedAdisyon && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-3">
              <h3 className="font-heading font-bold text-lg text-white flex items-center space-x-2">
                <FileText className="w-5 h-5 text-indigo-400" />
                <span>Adisyon Detayı</span>
              </h3>
              <button 
                onClick={() => setSelectedAdisyon(null)}
                className="text-slate-400 hover:text-white transition bg-slate-800 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-between text-xs text-slate-300 mb-4 bg-slate-900/50 p-3 rounded-xl border border-slate-800">
              <div className="space-y-1">
                <div><span className="font-semibold text-slate-500">Masa:</span> <span className="font-bold text-white">{selectedAdisyon.tableName}</span></div>
                <div><span className="font-semibold text-slate-500">Garson:</span> {selectedAdisyon.waiterName}</div>
                {selectedAdisyon.customerName && <div><span className="font-semibold text-slate-500">Cari:</span> <span className="text-cyan-400 font-semibold">{selectedAdisyon.customerName}</span></div>}
              </div>
              <div className="space-y-1 text-right">
                <div><span className="font-semibold text-slate-500">Tarih:</span> {new Date(selectedAdisyon.updatedAt).toLocaleString('tr-TR')}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin pr-2 space-y-2 mb-4">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Sipariş İçeriği</h4>
              {selectedAdisyon.items && selectedAdisyon.items.length > 0 ? (
                selectedAdisyon.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start bg-slate-900/40 p-2.5 rounded-xl text-xs border border-slate-800/50">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-indigo-400 font-bold">{item.quantity}x</span>
                        <span className="font-semibold text-slate-200">{item.productName}</span>
                      </div>
                      {item.selectedModifiers && (
                        <div className="text-[10px] text-slate-500 mt-1 pl-6">
                          {(() => {
                            try {
                              const mods = JSON.parse(item.selectedModifiers);
                              return mods.map((m: any) => m.name).join(', ');
                            } catch (e) {
                              return item.selectedModifiers;
                            }
                          })()}
                        </div>
                      )}
                    </div>
                    <span className="font-bold text-emerald-400">{(item.unitPrice * item.quantity).toFixed(2)} TL</span>
                  </div>
                ))
              ) : (
                <div className="text-center p-4 text-slate-500 text-xs italic bg-slate-900/30 rounded-xl">Ürün detayı bulunamadı.</div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-sm space-y-2 shrink-0">
              <div className="flex justify-between text-slate-400">
                <span>Ara Toplam:</span>
                <span>{selectedAdisyon.totalAmount.toFixed(2)} TL</span>
              </div>
              {selectedAdisyon.discountAmount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>İndirim:</span>
                  <span>-{selectedAdisyon.discountAmount.toFixed(2)} TL</span>
                </div>
              )}
              <div className="flex justify-between text-white font-black text-base pt-2 border-t border-slate-800">
                <span>Net Ödenen:</span>
                <span className="text-emerald-400">{selectedAdisyon.paidAmount.toFixed(2)} TL</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DAILY OPS TAB */}
      {activeTab === 'DAILY_OPS' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center bg-slate-900 p-5 rounded-2xl shadow-lg border border-slate-800">
            <div>
              <h2 className="text-xl font-heading font-black text-white flex items-center space-x-2">
                <Activity className="w-6 h-6 text-amber-400" />
                <span>Gün İşlemleri (Gün Başı & Sonu)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Restoran operasyonunu başlatmak için gün başı, kapatmak için gün sonu yapmalısınız.
              </p>
            </div>
            
            {activeWorkDay ? (
              <button 
                onClick={async () => {
                  if(!confirm('Gün sonu yapmak istediğinize emin misiniz?')) return;
                  try {
                    const res = await fetch('/api/admin/workday', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ action: 'END' })
                    });
                    if (!res.ok) {
                      const err = await res.json();
                      alert(err.error || 'Gün sonu yapılamadı.');
                    } else {
                      alert('Gün sonu başarıyla yapıldı!');
                      loadData();
                    }
                  } catch (e) {
                    alert('Hata oluştu.');
                  }
                }}
                className="bg-rose-500 hover:bg-rose-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition flex items-center space-x-2"
              >
                <Database className="w-5 h-5" />
                <span>Gün Sonu Yap (Kapat)</span>
              </button>
            ) : (
              <button 
                onClick={async () => {
                  try {
                    const res = await fetch('/api/admin/workday', {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ action: 'START', userId: null }) // TODO: active admin id could be passed
                    });
                    if (!res.ok) {
                      const err = await res.json();
                      alert(err.error || 'Gün başı yapılamadı.');
                    } else {
                      alert('Gün başı başarıyla yapıldı! Artık sipariş alabilirsiniz.');
                      loadData();
                    }
                  } catch (e) {
                    alert('Hata oluştu.');
                  }
                }}
                className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 px-6 rounded-xl shadow-lg transition flex items-center space-x-2"
              >
                <Activity className="w-5 h-5" />
                <span>Gün Başı Yap (Başlat)</span>
              </button>
            )}
          </div>

          <div className="glass-card p-5 rounded-2xl shadow-md">
            <h3 className="font-heading font-bold text-white text-sm mb-4">Geçmiş Z Raporları (Günlük Kayıtlar)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-3 font-semibold">Tarih</th>
                    <th className="pb-3 font-semibold">Başlangıç</th>
                    <th className="pb-3 font-semibold">Bitiş</th>
                    <th className="pb-3 font-semibold">Durum</th>
                    <th className="pb-3 font-semibold text-center">İşlem Gören Adisyon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {workDays.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 italic">Henüz hiç gün kaydı yok.</td>
                    </tr>
                  ) : (
                    workDays.map((wd) => (
                      <tr key={wd.id} className="hover:bg-slate-800/20 transition">
                        <td className="py-3 text-slate-300 font-medium">{new Date(wd.startTime).toLocaleDateString('tr-TR')}</td>
                        <td className="py-3 text-slate-400">{new Date(wd.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="py-3 text-slate-400">{wd.endTime ? new Date(wd.endTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="py-3">
                          {wd.status === 'OPEN' ? (
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded font-bold">AKTİF</span>
                          ) : (
                            <span className="bg-slate-800 text-slate-400 px-2 py-1 rounded font-semibold">KAPALI</span>
                          )}
                        </td>
                        <td className="py-3 text-center text-slate-300 font-bold">{wd._count?.orders || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'USERS' && (
        <div className="space-y-6 animate-fade-in">
          <div className="flex justify-between items-center bg-slate-900 p-5 rounded-2xl shadow-lg border border-slate-800">
            <div>
              <h2 className="text-xl font-heading font-black text-white flex items-center space-x-2">
                <Users className="w-6 h-6 text-indigo-400" />
                <span>Personel Yönetimi</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">Garson ve Yöneticileri ekleyin, şifrelerini güncelleyin.</p>
            </div>
            
            <button 
              onClick={() => setUserModal({ name: '', pinHash: '', role: 'WAITER', isActive: true })}
              className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg transition flex items-center space-x-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Personel Ekle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u) => (
              <div key={u.id} className="glass-card p-4 rounded-2xl shadow-md border border-slate-800 relative">
                <div className="absolute top-4 right-4 flex space-x-2">
                  <button 
                    onClick={() => setUserModal({ id: u.id, name: u.name, pinHash: u.pinHash, role: u.role, isActive: u.isActive })}
                    className="p-1.5 bg-slate-800 hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-400 rounded-lg transition"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={async () => {
                      if(!confirm(u.name + ' adlı personeli silmek istediğinize emin misiniz?')) return;
                      const res = await fetch(`/api/admin/users?id=${u.id}`, { method: 'DELETE' });
                      if(res.ok) loadData();
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${u.role === 'ADMIN' ? 'bg-rose-500' : 'bg-indigo-500'}`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200">{u.name}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${u.role === 'ADMIN' ? 'bg-rose-500/10 text-rose-400' : 'bg-indigo-500/10 text-indigo-400'}`}>
                      {u.role === 'ADMIN' ? 'Yönetici' : 'Garson'}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 border-t border-slate-800 pt-3">
                  <span className="block mb-1">Giriş Şifresi (PIN): <strong className="text-slate-300 font-mono tracking-widest">{u.pinHash}</strong></span>
                  <span className="block">Durum: {u.isActive ? <span className="text-emerald-400 font-semibold">Aktif</span> : <span className="text-rose-400">Pasif</span>}</span>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="col-span-full text-center p-8 text-slate-500 italic glass-card rounded-2xl">
                Kayıtlı personel bulunamadı.
              </div>
            )}
          </div>
        </div>
      )}

      {/* USER MODAL */}
      {userModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <Users className="w-5 h-5 text-indigo-400" />
              <span>{userModal.id ? 'Personel Düzenle' : 'Yeni Personel Ekle'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  value={userModal.name}
                  onChange={(e) => setUserModal({ ...userModal, name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                />
              </div>
              
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Giriş Şifresi (4 Haneli PIN)</label>
                <input
                  type="text"
                  maxLength={4}
                  value={userModal.pinHash}
                  onChange={(e) => setUserModal({ ...userModal, pinHash: e.target.value.replace(/[^0-9]/g, '') })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none font-mono tracking-widest"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Yetki Rolü</label>
                <select
                  value={userModal.role}
                  onChange={(e) => setUserModal({ ...userModal, role: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none"
                >
                  <option value="WAITER">Garson</option>
                  <option value="ADMIN">Yönetici (Admin)</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input 
                  type="checkbox" 
                  id="userActive"
                  checked={userModal.isActive}
                  onChange={(e) => setUserModal({ ...userModal, isActive: e.target.checked })}
                  className="w-4 h-4 accent-indigo-500"
                />
                <label htmlFor="userActive" className="font-semibold text-slate-300 cursor-pointer">Sisteme Giriş Yapabilir</label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setUserModal(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl font-medium transition"
                >
                  İptal
                </button>
                <button
                  onClick={async () => {
                    try {
                      if (!userModal.name || !userModal.pinHash || userModal.pinHash.length < 4) {
                        alert('Lütfen ad ve 4 haneli şifreyi eksiksiz girin.');
                        return;
                      }
                      const res = await fetch('/api/admin/users', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify(userModal)
                      });
                      if(res.ok) {
                        setUserModal(null);
                        loadData();
                      } else {
                        const err = await res.json();
                        alert(err.error);
                      }
                    } catch(e) {
                      alert('Hata');
                    }
                  }}
                  className="flex-1 gradient-primary hover:bg-indigo-500 text-white text-xs py-2.5 rounded-xl font-semibold transition"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
