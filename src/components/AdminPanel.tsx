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
  FileText,
  Printer,
  Check,
  RefreshCw,
  Eye,
  Settings,
  Download
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
  fetchCustomerStatement,
  fetchPrinters,
  savePrinter,
  deletePrinter,
  savePrinterAssignments,
  fetchReceiptSettings,
  saveReceiptSettings,
  UserSession,
  reorderCategories,
  reorderProducts
} from '@/lib/api';
import { checkPrintServerStatus, getWindowsPrinters, generateReceiptText } from '@/lib/printService';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableCategoryItem, SortableProductItem } from './SortableMenuHelpers';

interface AdminPanelProps {
  onCloseAction: () => void;
  user: UserSession;
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

interface TopTable {
  name: string;
  orderCount: number;
  totalRevenue: number;
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
  items: Array<{ name: string, quantity: number, total: number }>;
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

export default function AdminPanel({ onCloseAction, user }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<'REPORTS' | 'MENU' | 'MODIFIERS' | 'TABLES' | 'CARI' | 'LOGS' | 'DAILY_OPS' | 'USERS' | 'INVENTORY' | 'SUPPLIERS' | 'PRINTERS'>('REPORTS');
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
    topTables?: TopTable[];
    costAnalysis?: any[];
    cancellationLogs?: any[];
    discountLogs?: any[];
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

  // Stok & Reçete (INVENTORY) State'leri
  const [ingredients, setIngredients] = useState<any[]>([]);
  const [recipes, setRecipes] = useState<any[]>([]); // products with recipes
  const [selectedProductIdForRecipe, setSelectedProductIdForRecipe] = useState<string>('');
  const [editingRecipeItems, setEditingRecipeItems] = useState<Array<{ ingredientId: string; quantityRequired: number; wastePercentage: number }>>([]);
  const [ingredientModal, setIngredientModal] = useState<{ id?: string; name: string; unit: string; stockLevel: number; costPerUnit: number; minStockLevel: number } | null>(null);
  const [stockAdjustmentModal, setStockAdjustmentModal] = useState<{ id: string; name: string; unit: string; adjustmentQty: string; adjustmentNotes: string } | null>(null);
  const [reportsSubTab, setReportsSubTab] = useState<'OVERVIEW' | 'COST' | 'CANCELLATIONS' | 'DISCOUNTS'>('OVERVIEW');

  // Tedarikçi (SUPPLIERS) State'leri
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<any[]>([]);
  const [selectedSupplierIdForDetails, setSelectedSupplierIdForDetails] = useState<string>('');
  const [supplierModal, setSupplierModal] = useState<{ id?: string; name: string; phone: string } | null>(null);
  const [supplierInvoiceModal, setSupplierInvoiceModal] = useState<{ supplierId: string; supplierName: string; amount: string; ingredientId?: string; quantity?: string; note?: string } | null>(null);
  const [supplierPaymentModal, setSupplierPaymentModal] = useState<{ supplierId: string; supplierName: string; amount: string; paymentMethod: 'CASH' | 'CREDIT_CARD' | 'BANK_TRANSFER'; note?: string } | null>(null);

  // Adisyon Detay Modalı State (Analizler altındaki liste için)
  const [selectedAdisyon, setSelectedAdisyon] = useState<AdisyonHistoryItem | null>(null);

  // Geçmiş Rapor İnceleme State'i
  const [viewingWorkDay, setViewingWorkDay] = useState<any | null>(null);

  // Yazıcı Yönetimi State'leri
  const [printers, setPrinters] = useState<any[]>([]);
  const [printerModal, setPrinterModal] = useState<{ id?: string; name: string; windowsName: string; type: string; paperWidth: number } | null>(null);
  const [windowsPrinters, setWindowsPrinters] = useState<Array<{ name: string; driverName: string; portName: string; status: string }>>([]);
  const [printServerOnline, setPrintServerOnline] = useState<boolean>(false);
  const [printerAssignments, setPrinterAssignments] = useState<Array<{ printerId: string; productId: string }>>([]);
  const [receiptSettings, setReceiptSettings] = useState<any | null>(null);
  const [printerSubTab, setPrinterSubTab] = useState<'LIST' | 'ASSIGNMENTS' | 'RECEIPT'>('LIST');
  const [showReceiptPreview, setShowReceiptPreview] = useState<boolean>(false);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [actionError, setActionError] = useState<string>('');
  const [actionSuccess, setActionSuccess] = useState<string>('');

  // DnD Sensörleri
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEndCategory = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      const oldIndex = menuCategories.findIndex((c) => c.id === active.id);
      const newIndex = menuCategories.findIndex((c) => c.id === over?.id);
      
      const newCategories = arrayMove(menuCategories, oldIndex, newIndex);
      // Update sortOrders immediately in local state
      const updatedCategories = newCategories.map((c, idx) => ({ ...c, sortOrder: idx + 1 }));
      setMenuCategories(updatedCategories);

      // Call API
      try {
        await reorderCategories(updatedCategories.map(c => ({ id: c.id, sortOrder: c.sortOrder })));
      } catch (err: any) {
        setActionError('Sıralama kaydedilemedi: ' + err.message);
        loadData(); // Revert on failure
      }
    }
  };

  const handleDragEndProduct = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      // Bulunan kategorinin ürünlerini sırala
      const catIndex = menuCategories.findIndex(c => c.id === selectedMenuCategoryId);
      if (catIndex === -1) return;

      const cat = menuCategories[catIndex];
      const oldIndex = cat.products.findIndex((p: any) => p.id === active.id);
      const newIndex = cat.products.findIndex((p: any) => p.id === over?.id);

      const newProducts = arrayMove(cat.products, oldIndex, newIndex);
      const updatedProducts = newProducts.map((p: any, idx) => ({ ...p, sortOrder: idx + 1 }));

      const newCategories = [...menuCategories];
      newCategories[catIndex] = { ...cat, products: updatedProducts };
      setMenuCategories(newCategories);

      try {
        await reorderProducts(updatedProducts.map((p: any) => ({ id: p.id, sortOrder: p.sortOrder, categoryId: p.categoryId })));
      } catch (err: any) {
        setActionError('Sıralama kaydedilemedi: ' + err.message);
        loadData();
      }
    }
  };

  const handleToggleFavorite = async (prod: any) => {
    try {
      const updatedIsFavorite = !prod.isFavorite;
      await saveProduct({ ...prod, isFavorite: updatedIsFavorite });
      // update local state
      const catIndex = menuCategories.findIndex(c => c.id === prod.categoryId);
      if (catIndex > -1) {
        const newCats = [...menuCategories];
        const prodIndex = newCats[catIndex].products.findIndex((p: any) => p.id === prod.id);
        if (prodIndex > -1) {
          newCats[catIndex].products[prodIndex].isFavorite = updatedIsFavorite;
          setMenuCategories(newCats);
        }
      }
    } catch (err: any) {
      setActionError('Favori durumu güncellenemedi.');
    }
  };

  // Verileri yükle
  const loadData = async () => {
    setIsLoading(true);
    setActionError('');
    try {
      if (activeTab === 'REPORTS') {
        let url = '/api/admin/reports';
        const params = new URLSearchParams();
        if (viewingWorkDay) {
          params.append('workDayId', viewingWorkDay.id);
        } else {
          if (dateRange.startDate) params.append('startDate', dateRange.startDate);
          if (dateRange.endDate) params.append('endDate', dateRange.endDate);
        }
        if (params.toString()) {
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
      } else if (activeTab === 'INVENTORY') {
        const ingRes = await fetch('/api/admin/ingredients');
        const ingData = await ingRes.json();
        setIngredients(ingData);

        const recRes = await fetch('/api/admin/recipes');
        const recData = await recRes.json();
        setRecipes(recData);
      } else if (activeTab === 'SUPPLIERS') {
        const supRes = await fetch('/api/admin/suppliers');
        const supData = await supRes.json();
        setSuppliers(supData);

        const payRes = await fetch('/api/admin/supplier-payments');
        const payData = await payRes.json();
        setSupplierPayments(payData);
      } else if (activeTab === 'PRINTERS') {
        const printersData = await fetchPrinters();
        setPrinters(printersData);

        // Kategori listesini de çek (eşleşme matrisi için)
        const cats = await fetchCategories();
        setMenuCategories(cats);

        // Mevcut atamaları ayarla
        const allAssignments: Array<{ printerId: string; productId: string }> = [];
        printersData.forEach((p: any) => {
          (p.productAssignments || []).forEach((a: any) => {
            allAssignments.push({ printerId: a.printerId, productId: a.productId });
          });
        });
        setPrinterAssignments(allAssignments);

        // Fiş ayarlarını çek
        const settings = await fetchReceiptSettings();
        setReceiptSettings(settings);

        // Print server durumu
        const online = await checkPrintServerStatus();
        setPrintServerOnline(online);

        // Windows yazıcılarını çek
        if (online) {
          const winPrinters = await getWindowsPrinters();
          setWindowsPrinters(winPrinters);
        }
      }
    } catch (err) {
      console.error('Yönetim paneli verileri yüklenemedi:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab, dateRange, viewingWorkDay]);

  useEffect(() => {
    if (selectedProductIdForRecipe) {
      const prod = recipes.find(r => r.id === selectedProductIdForRecipe);
      if (prod) {
        setEditingRecipeItems(
          (prod.recipeItems || []).map((ri: any) => ({
            ingredientId: ri.ingredientId,
            quantityRequired: ri.quantityRequired,
            wastePercentage: ri.wastePercentage,
          }))
        );
      } else {
        setEditingRecipeItems([]);
      }
    } else {
      setEditingRecipeItems([]);
    }
  }, [selectedProductIdForRecipe, recipes]);

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

  // Malzeme (Ingredient) Kaydetme
  const handleSaveIngredient = async () => {
    if (!ingredientModal || !ingredientModal.name.trim() || !ingredientModal.unit.trim()) {
      setActionError('Malzeme adı ve birim zorunludur.');
      return;
    }
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch('/api/admin/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: ingredientModal.id,
          name: ingredientModal.name,
          unit: ingredientModal.unit,
          stockLevel: Number(ingredientModal.stockLevel) || 0,
          costPerUnit: Number(ingredientModal.costPerUnit) || 0,
          minStockLevel: Number(ingredientModal.minStockLevel) || 0,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Malzeme kaydedilemedi.');
      }
      setActionSuccess(ingredientModal.id ? 'Malzeme başarıyla güncellendi!' : 'Yeni malzeme başarıyla eklendi!');
      setIngredientModal(null);
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Hata oluştu.');
    }
  };

  // Malzeme (Ingredient) Silme
  const handleDeleteIngredient = async (id: string, name: string) => {
    if (!confirm(`"${name}" malzemesini silmek istediğinize emin misiniz?`)) return;
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch(`/api/admin/ingredients?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Malzeme silinemedi.');
      }
      setActionSuccess('Malzeme başarıyla silindi.');
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Hata oluştu.');
    }
  };

  // Stok Düzeltme (Stock Adjustment)
  const handleStockAdjustment = async () => {
    if (!stockAdjustmentModal) return;
    const qtyVal = parseFloat(stockAdjustmentModal.adjustmentQty);
    if (isNaN(qtyVal) || qtyVal === 0) {
      setActionError('Lütfen geçerli bir miktar girin (Sıfır olamaz).');
      return;
    }
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch('/api/admin/ingredients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: stockAdjustmentModal.id,
          isAdjustment: true,
          adjustmentQty: qtyVal,
          adjustmentNotes: stockAdjustmentModal.adjustmentNotes || 'Manuel stok düzeltmesi.',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Stok düzeltilemedi.');
      }
      setActionSuccess('Stok seviyesi başarıyla güncellendi!');
      setStockAdjustmentModal(null);
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Hata oluştu.');
    }
  };

  // Reçete Kaydetme
  const handleSaveRecipe = async (productId: string, items: Array<{ ingredientId: string; quantityRequired: number; wastePercentage: number }>) => {
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch('/api/admin/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          items,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Reçete kaydedilemedi.');
      }
      setActionSuccess('Ürün reçetesi başarıyla kaydedildi!');
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Reçete kaydedilirken hata oluştu.');
    }
  };

  // Tedarikçi (Supplier) Kaydetme
  const handleSaveSupplier = async () => {
    if (!supplierModal || !supplierModal.name.trim()) {
      setActionError('Tedarikçi adı zorunludur.');
      return;
    }
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch('/api/admin/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: supplierModal.id,
          name: supplierModal.name,
          phone: supplierModal.phone,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Tedarikçi kaydedilemedi.');
      }
      setActionSuccess(supplierModal.id ? 'Tedarikçi güncellendi!' : 'Yeni tedarikçi başarıyla eklendi!');
      setSupplierModal(null);
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Hata oluştu.');
    }
  };

  // Tedarikçi (Supplier) Silme
  const handleDeleteSupplier = async (id: string, name: string) => {
    if (!confirm(`"${name}" tedarikçisini silmek istediğinize emin misiniz?`)) return;
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch(`/api/admin/suppliers?id=${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Tedarikçi silinemedi.');
      }
      setActionSuccess('Tedarikçi başarıyla silindi.');
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Hata oluştu.');
    }
  };

  // Tedarikçi Fatura Girişi (Invoice - borç artırır)
  const handleSaveSupplierInvoice = async () => {
    if (!supplierInvoiceModal || !supplierInvoiceModal.amount) {
      setActionError('Fatura tutarı zorunludur.');
      return;
    }
    const amt = parseFloat(supplierInvoiceModal.amount);
    if (isNaN(amt) || amt <= 0) {
      setActionError('Lütfen geçerli bir fatura tutarı girin.');
      return;
    }
    let qty = undefined;
    if (supplierInvoiceModal.ingredientId) {
      qty = parseFloat(supplierInvoiceModal.quantity || '0');
      if (isNaN(qty) || qty <= 0) {
        setActionError('Malzeme alımı için geçerli bir miktar girilmelidir.');
        return;
      }
    }
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch('/api/admin/supplier-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierInvoiceModal.supplierId,
          amount: amt,
          type: 'INVOICE',
          ingredientId: supplierInvoiceModal.ingredientId || null,
          quantity: qty,
          note: supplierInvoiceModal.note || '',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Fatura kaydedilemedi.');
      }
      setActionSuccess('Alış faturası başarıyla kaydedildi!');
      setSupplierInvoiceModal(null);
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Hata oluştu.');
    }
  };

  // Tedarikçi Ödeme Girişi (Payment - borç azaltır)
  const handleSaveSupplierPayment = async () => {
    if (!supplierPaymentModal || !supplierPaymentModal.amount) {
      setActionError('Ödeme tutarı zorunludur.');
      return;
    }
    const amt = parseFloat(supplierPaymentModal.amount);
    if (isNaN(amt) || amt <= 0) {
      setActionError('Lütfen geçerli bir ödeme tutarı girin.');
      return;
    }
    setActionError('');
    setActionSuccess('');
    try {
      const res = await fetch('/api/admin/supplier-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId: supplierPaymentModal.supplierId,
          amount: amt,
          type: 'PAYMENT',
          paymentMethod: supplierPaymentModal.paymentMethod,
          note: supplierPaymentModal.note || '',
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ödeme kaydedilemedi.');
      }
      setActionSuccess('Tedarikçi ödemesi başarıyla kaydedildi!');
      setSupplierPaymentModal(null);
      await loadData();
      setTimeout(() => setActionSuccess(''), 3000);
    } catch (err: any) {
      setActionError(err.message || 'Hata oluştu.');
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
            onClick={onCloseAction}
            className="active-press p-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition duration-200 cursor-pointer"
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
            <p className="text-xs text-zinc-400">Restoran ayarları, menü modları, cari hesap defteri ve personel ciroları</p>
          </div>
        </div>

        {/* Tab Seçiciler */}
        <div className="flex bg-zinc-950/80 border border-zinc-800 p-1 rounded-xl overflow-x-auto max-w-full scrollbar-thin">
          <button
            onClick={() => {
              setViewingWorkDay(null);
              setActiveTab('REPORTS');
            }}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${activeTab === 'REPORTS' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Analiz Raporları</span>
          </button>

          <button
            onClick={() => setActiveTab('MENU')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${activeTab === 'MENU' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Ürün/Kategori</span>
          </button>

          <button
            onClick={() => setActiveTab('MODIFIERS')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${activeTab === 'MODIFIERS' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Star className="w-3.5 h-3.5" />
            <span>Ek Seçenekler</span>
          </button>

          <button
            onClick={() => setActiveTab('TABLES')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${activeTab === 'TABLES' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Masa Yönetimi</span>
          </button>

          <button
            onClick={() => setActiveTab('CARI')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${activeTab === 'CARI' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cari Hesap Defteri</span>
          </button>

          <button
            onClick={() => setActiveTab('DAILY_OPS')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${activeTab === 'DAILY_OPS' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            <span>Gün İşlemleri</span>
          </button>

          <button
            onClick={() => setActiveTab('INVENTORY')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${activeTab === 'INVENTORY' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Package className="w-3.5 h-3.5 text-cyan-400" />
            <span>Stok & Reçete</span>
          </button>

          <button
            onClick={() => setActiveTab('SUPPLIERS')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${activeTab === 'SUPPLIERS' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <DollarSign className="w-3.5 h-3.5 text-rose-400" />
            <span>Tedarikçi & Ödeme</span>
          </button>

          <button
            onClick={() => setActiveTab('PRINTERS')}
            className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${activeTab === 'PRINTERS' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
          >
            <Printer className="w-3.5 h-3.5 text-teal-400" />
            <span>Yazıcı Yönetimi</span>
          </button>

          {user.role === 'ADMIN' && (
            <>
              <button
                onClick={() => setActiveTab('USERS')}
                className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${activeTab === 'USERS' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                <Users className="w-3.5 h-3.5 text-amber-400" />
                <span>Personel Yönetimi</span>
              </button>

              <button
                onClick={() => setActiveTab('LOGS')}
                className={`active-press px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center space-x-1 ${activeTab === 'LOGS' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Log Defteri</span>
              </button>
            </>
          )}
        </div>
      </div>

      {actionSuccess && activeTab !== 'MENU' && (
        <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-300 p-3 rounded-xl text-sm shadow-md animate-fade-in">
          {actionSuccess}
        </div>
      )}

      {isLoading ? (
        <div className="flex-1 flex flex-col items-center justify-center py-20 space-y-3">
          <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-zinc-400">Veriler hazırlanıyor...</p>
        </div>
      ) : activeTab === 'REPORTS' && reportsData ? (
        <div className="space-y-6 animate-fade-in">

          {/* Geçmiş Rapor İnceleme Uyarısı */}
          {viewingWorkDay && (
            <div className="bg-amber-950/40 border border-amber-500/30 p-4 rounded-2xl flex items-center justify-between shadow-md">
              <div className="flex items-center space-x-3">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse"></span>
                <span className="text-xs text-zinc-200">
                  Şu anda <strong>{new Date(viewingWorkDay.startTime).toLocaleDateString('tr-TR')}</strong> tarihli geçmiş günün Z raporunu inceliyorsunuz.
                </span>
              </div>
              <button
                onClick={() => {
                  setViewingWorkDay(null);
                  setDateRange({ startDate: '', endDate: '' });
                }}
                className="bg-amber-650 hover:bg-amber-500 text-white text-xs px-3.5 py-1.5 rounded-xl font-bold transition shadow-md"
              >
                Aktif Güne Geri Dön
              </button>
            </div>
          )}

          {/* Rapor Alt Sekme Seçiciler */}
          <div className="flex bg-zinc-950/40 border border-zinc-850 p-1 rounded-xl w-fit space-x-1">
            <button
              onClick={() => setReportsSubTab('OVERVIEW')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${reportsSubTab === 'OVERVIEW' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              Genel Raporlar
            </button>
            <button
              onClick={() => setReportsSubTab('COST')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${reportsSubTab === 'COST' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              Maliyet Analizi
            </button>
            <button
              onClick={() => setReportsSubTab('CANCELLATIONS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${reportsSubTab === 'CANCELLATIONS' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              İptal Raporu
            </button>
            <button
              onClick={() => setReportsSubTab('DISCOUNTS')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${reportsSubTab === 'DISCOUNTS' ? 'bg-amber-600 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
            >
              İndirim Raporu
            </button>
          </div>

          {reportsSubTab === 'OVERVIEW' && (
            <>
              {/* Tarih Filtresi */}
              <div className="glass-card p-4 rounded-2xl shadow-md flex items-end space-x-4">
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Başlangıç Tarihi</label>
                  <input
                    type="date"
                    value={dateRange.startDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, startDate: e.target.value }))}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-400 mb-1">Bitiş Tarihi</label>
                  <input
                    type="date"
                    value={dateRange.endDate}
                    onChange={(e) => setDateRange(prev => ({ ...prev, endDate: e.target.value }))}
                    className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <button
                  onClick={() => setDateRange({ startDate: '', endDate: '' })}
                  className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-4 py-2.5 rounded-xl font-medium transition h-[38px]"
                >
                  Filtreyi Temizle
                </button>
              </div>

              {/* Z Raporu Özeti */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-4">
                <div className="glass-card p-4 rounded-2xl relative overflow-hidden shadow-lg border-l-4 border-l-emerald-500">
                  <div className="absolute right-3 top-3 text-emerald-500 bg-emerald-500/10 p-2 rounded-xl">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Net Günlük Ciro</p>
                  <h2 className="text-xl font-heading font-black text-white mt-2">
                    {reportsData.summary.totalRevenue.toFixed(2)} TL
                  </h2>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden shadow-lg border-l-4 border-l-amber-500">
                  <div className="absolute right-3 top-3 text-amber-500 bg-amber-500/10 p-2 rounded-xl">
                    <ShoppingBag className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Kapatılan Adisyon</p>
                  <h2 className="text-xl font-heading font-black text-white mt-2">
                    {reportsData.summary.totalOrders} adet
                  </h2>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden shadow-lg border-l-4 border-l-amber-500">
                  <div className="absolute right-3 top-3 text-amber-500 bg-amber-500/10 p-2 rounded-xl">
                    <Percent className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Yapılan İndirim</p>
                  <h2 className="text-xl font-heading font-black text-white mt-2">
                    {reportsData.summary.totalDiscounts.toFixed(2)} TL
                  </h2>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden shadow-lg border-l-4 border-l-cyan-500">
                  <div className="absolute right-3 top-3 text-cyan-500 bg-cyan-500/10 p-2 rounded-xl">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Cari Satış</p>
                  <h2 className="text-xl font-heading font-black text-white mt-2">
                    {(reportsData.paymentMethods.cari || 0).toFixed(2)} TL
                  </h2>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden shadow-lg border-l-4 border-l-rose-500">
                  <div className="absolute right-3 top-3 text-rose-500 bg-rose-500/10 p-2 rounded-xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Ürün Maliyeti (COGS)</p>
                  <h2 className="text-xl font-heading font-black text-white mt-2">
                    {((reportsData.summary as any).totalCogs || 0).toFixed(2)} TL
                  </h2>
                </div>

                <div className="glass-card p-4 rounded-2xl relative overflow-hidden shadow-lg border-l-4 border-l-orange-500">
                  <div className="absolute right-3 top-3 text-orange-500 bg-orange-500/10 p-2 rounded-xl">
                    <Star className="w-5 h-5" />
                  </div>
                  <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-wider">Net Kâr</p>
                  <h2 className="text-xl font-heading font-black text-white mt-2">
                    {((reportsData.summary as any).netProfit || 0).toFixed(2)} TL
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
                  'text-amber-400',
                  'text-cyan-400',
                  'text-emerald-400',
                  'text-amber-400',
                  'text-fuchsia-400',
                  'text-violet-400',
                  'text-rose-400',
                  'text-amber-400',
                ];
                const catBgColors = [
                  'bg-amber-500/10',
                  'bg-cyan-500/10',
                  'bg-emerald-500/10',
                  'bg-amber-500/10',
                  'bg-fuchsia-500/10',
                  'bg-violet-500/10',
                  'bg-rose-500/10',
                  'bg-amber-500/10',
                ];

                return (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 my-6">
                    {/* Saatlik Yoğunluk Grafiği */}
                    <div className="glass-card p-5 rounded-2xl shadow-md flex flex-col relative overflow-hidden">
                      <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
                        <Activity className="w-4 h-4 text-cyan-400" />
                        <span>Saatlik Ciro Yoğunluğu (Peak Hours)</span>
                      </h3>

                      <div className="relative flex-1 min-h-[220px] flex items-center justify-center bg-zinc-950/45 rounded-xl border border-zinc-900 p-2">
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
                            className="absolute bg-zinc-950/95 border border-amber-500/30 text-white p-2.5 rounded-xl shadow-xl backdrop-blur-md text-[10px] pointer-events-none z-10 transition-all duration-150 animate-scale-in"
                            style={{
                              left: `${(hourPoints[hoveredHourIndex].x / hourWidth) * 100}%`,
                              top: `${(hourPoints[hoveredHourIndex].y / hourHeight) * 100 - 32}%`,
                              transform: 'translateX(-50%)',
                            }}
                          >
                            <div className="font-bold text-zinc-400">{hourPoints[hoveredHourIndex].hour} Dilimi</div>
                            <div className="font-extrabold text-amber-300 text-xs mt-0.5">
                              {hourPoints[hoveredHourIndex].total.toFixed(2)} TL
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Kategori Bazlı Dağılım */}
                    <div className="glass-card p-5 rounded-2xl shadow-md flex flex-col">
                      <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
                        <Layers className="w-4 h-4 text-orange-400" />
                        <span>Kategori Bazlı Ciro Dağılımı</span>
                      </h3>

                      <div className="flex-1 flex flex-col sm:flex-row items-center justify-around gap-6 bg-zinc-950/45 rounded-xl border border-zinc-900 p-4">
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
                          <div className="absolute flex flex-col items-center text-center justify-center bg-zinc-950/70 w-[94px] h-[94px] rounded-full border border-zinc-800/60 backdrop-blur-sm pointer-events-none select-none">
                            {hoveredCategoryIndex !== null && categorySales[hoveredCategoryIndex] ? (
                              <>
                                <span className="text-[9px] font-bold text-zinc-400 uppercase truncate max-w-[80px]">
                                  {categorySales[hoveredCategoryIndex].name}
                                </span>
                                <span className="text-xs font-black text-white mt-0.5">
                                  {((categorySales[hoveredCategoryIndex].value / totalCatSales) * 100).toFixed(0)}%
                                </span>
                                <span className="text-[9px] font-bold text-amber-300 mt-0.5">
                                  {categorySales[hoveredCategoryIndex].value.toFixed(0)} TL
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="text-[9px] font-extrabold text-zinc-400 uppercase tracking-wider">
                                  Toplam
                                </span>
                                <span className="text-[11px] font-black text-white mt-0.5 leading-tight">
                                  {totalCatSales.toFixed(0)} TL
                                </span>
                                <span className="text-[8px] font-bold text-zinc-500 mt-0.5">
                                  {categorySales.length} Kategori
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Legend List */}
                        <div className="flex-1 w-full space-y-1.5 max-h-[160px] overflow-y-auto pr-1 scrollbar-thin">
                          {categorySales.length === 0 ? (
                            <div className="text-center py-6 text-zinc-500 italic text-[10px]">Satış kaydı bulunamadı.</div>
                          ) : (
                            categorySales.map((cat, idx) => {
                              const pct = totalCatSales > 0 ? (cat.value / totalCatSales) * 100 : 0;
                              const isHovered = hoveredCategoryIndex === idx;
                              return (
                                <div
                                  key={idx}
                                  className={`flex items-center justify-between p-1.5 rounded-lg transition-colors cursor-pointer ${isHovered ? 'bg-zinc-900 text-white' : 'hover:bg-zinc-900/40 text-zinc-300'
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
                                    <span className="text-zinc-400 mr-2">{pct.toFixed(0)}%</span>
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
                        { label: 'Kredi Kartı', val: reportsData.paymentMethods.creditCard, color: 'bg-amber-500' },
                        { label: 'Yemek Kartı', val: reportsData.paymentMethods.mealCard, color: 'bg-cyan-500' },
                        { label: 'Cari (Veresiye)', val: reportsData.paymentMethods.cari || 0, color: 'bg-amber-500' }
                      ].map((pay, i) => {
                        const pct = reportsData.summary.totalRevenue > 0
                          ? (pay.val / reportsData.summary.totalRevenue) * 100
                          : 0;
                        return (
                          <div key={i} className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-zinc-300">{pay.label}</span>
                              <span className="text-zinc-100">{pay.val.toFixed(2)} TL ({pct.toFixed(1)}%)</span>
                            </div>
                            <div className="w-full bg-zinc-900 rounded-full h-2">
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
                    <div className="divide-y divide-zinc-850 text-xs">
                      {reportsData.waiterSalesPerformance.length === 0 ? (
                        <div className="text-center py-6 text-zinc-500 italic">Kayıtlı garson satışı bulunamadı.</div>
                      ) : (
                        reportsData.waiterSalesPerformance.map((waiter, i) => (
                          <div key={i} className="flex flex-col py-2">
                            <div
                              className="flex justify-between items-center cursor-pointer hover:bg-zinc-900/40 p-2 rounded-xl transition"
                              onClick={() => setExpandedWaiterIndex(expandedWaiterIndex === i ? null : i)}
                            >
                              <div>
                                <div className="font-bold text-zinc-200">{waiter.name}</div>
                                <div className="text-[10px] text-zinc-500">Kapatılan Adisyon: {waiter.ordersCount} adet</div>
                              </div>
                              <div className="flex items-center space-x-2">
                                <span className="bg-emerald-500/10 text-emerald-400 font-extrabold px-3 py-1 rounded-full text-xs">
                                  {waiter.totalSales.toFixed(2)} TL Satış
                                </span>
                                {expandedWaiterIndex === i ? <ArrowUp className="w-4 h-4 text-zinc-400" /> : <ArrowDown className="w-4 h-4 text-zinc-400" />}
                              </div>
                            </div>
                            {expandedWaiterIndex === i && (
                              <div className="mt-2 px-2 animate-scale-in">
                                <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-xl p-3 space-y-2">
                                  <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-800 pb-2 mb-2">Sattığı Ürünler</h4>
                                  {waiter.items && waiter.items.length > 0 ? (
                                    <div className="max-h-[150px] overflow-y-auto pr-1 scrollbar-thin space-y-1.5">
                                      {waiter.items.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center text-[11px]">
                                          <div className="flex items-center space-x-2">
                                            <span className="text-zinc-500 font-mono w-5">{item.quantity}x</span>
                                            <span className="text-zinc-300 font-medium">{item.name}</span>
                                          </div>
                                          <span className="text-emerald-400/80 font-semibold">{item.total.toFixed(2)} TL</span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="text-[10px] text-zinc-500 italic">Ürün detayı bulunamadı.</div>
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
                      <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                      <span>En Çok Satan 5 Ürün</span>
                    </h3>
                    <div className="divide-y divide-zinc-850">
                      {reportsData.topProducts.map((p, i) => (
                        <div key={i} className="flex justify-between items-center py-2.5 text-xs">
                          <div className="flex items-center space-x-2.5">
                            <span className="w-5 h-5 rounded bg-amber-500/10 text-amber-400 font-bold flex items-center justify-center text-[10px]">
                              {i + 1}
                            </span>
                            <span className="font-semibold text-zinc-200">{p.name}</span>
                          </div>
                          <div className="text-right">
                            <span className="bg-zinc-900 px-2 py-0.5 rounded text-[10px] font-bold text-zinc-400 mr-2">{p.quantity} Adet</span>
                            <span className="font-bold text-zinc-100">{p.total.toFixed(2)} TL</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* En Çok Tercih Edilen 5 Masa */}
                  <div className="glass-card p-5 rounded-2xl shadow-md">
                    <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                      <span>En Çok Tercih Edilen 5 Masa</span>
                    </h3>
                    <div className="divide-y divide-zinc-850">
                      {(!reportsData.topTables || reportsData.topTables.length === 0) ? (
                        <div className="text-center py-6 text-zinc-500 italic">Masa kullanım verisi bulunamadı.</div>
                      ) : (
                        reportsData.topTables.map((t, i) => (
                          <div key={i} className="flex justify-between items-center py-2.5 text-xs">
                            <div className="flex items-center space-x-2.5">
                              <span className="w-5 h-5 rounded bg-cyan-500/10 text-cyan-400 font-bold flex items-center justify-center text-[10px]">
                                {i + 1}
                              </span>
                              <span className="font-semibold text-zinc-200">{t.name} Masası</span>
                            </div>
                            <div className="text-right">
                              <span className="bg-zinc-900 px-2 py-0.5 rounded text-[10px] font-bold text-zinc-400 mr-2">{t.orderCount} Kere</span>
                              <span className="font-bold text-zinc-100">{t.totalRevenue.toFixed(2)} TL Ciro</span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {/* Kapatılan Toplam Adisyonlar (Z Günlüğü) */}
              <div className="glass-card p-5 rounded-2xl shadow-md text-xs">
                <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
                  <FileSpreadsheet className="w-4 h-4 text-amber-400" />
                  <span>Günlük Kapatılan Adisyon Defteri (Z Günlüğü)</span>
                </h3>
                <div className="overflow-x-auto max-h-[300px] scrollbar-thin">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/35 text-zinc-400 font-semibold">
                        <th className="p-3">Kapatılma Zamanı</th>
                        <th className="p-3">Masa</th>
                        <th className="p-3">Siparişi Kapatan Garson</th>
                        <th className="p-3">Cari İsim (Cari ise)</th>
                        <th className="p-3 text-right">Net Tutar</th>
                        <th className="p-3 text-center">Detay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {reportsData.adisyonHistory.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-zinc-500 italic">
                            Kapatılmış adisyon bulunmamaktadır.
                          </td>
                        </tr>
                      ) : (
                        reportsData.adisyonHistory.map((o) => (
                          <tr key={o.id} className="hover:bg-zinc-900/20 transition text-zinc-300">
                            <td className="p-3 font-mono text-zinc-500">
                              {new Date(o.updatedAt).toLocaleTimeString('tr-TR')}
                            </td>
                            <td className="p-3 font-bold text-zinc-200">{o.tableName}</td>
                            <td className="p-3 text-zinc-300 font-semibold">{o.waiterName}</td>
                            <td className="p-3">
                              {o.customerName ? (
                                <span className="text-cyan-400 font-semibold">{o.customerName}</span>
                              ) : (
                                <span className="text-zinc-500">-</span>
                              )}
                            </td>
                            <td className="p-3 text-right font-extrabold text-amber-300">
                              {o.paidAmount.toFixed(2)} TL
                            </td>
                            <td className="p-3 text-center">
                              <button
                                onClick={() => setSelectedAdisyon(o)}
                                className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-1 px-2.5 rounded-lg font-bold"
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
                      <tr className="border-b border-zinc-800 bg-zinc-900/35 text-zinc-400 font-semibold">
                        <th className="p-3">Ürün Adı</th>
                        <th className="p-3 text-center">Toplam Adet</th>
                        <th className="p-3 text-right">Toplam Ciro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {!reportsData.productSalesSummary || reportsData.productSalesSummary.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="p-6 text-center text-zinc-500 italic">
                            Satılan ürün kaydı bulunmamaktadır.
                          </td>
                        </tr>
                      ) : (
                        reportsData.productSalesSummary.map((p, idx) => (
                          <tr key={idx} className="hover:bg-zinc-900/20 transition text-zinc-300">
                            <td className="p-3 font-semibold text-zinc-200">{p.name}</td>
                            <td className="p-3 text-center font-extrabold text-cyan-400">{p.quantity} Adet</td>
                            <td className="p-3 text-right font-extrabold text-emerald-400">{p.total.toFixed(2)} TL</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {reportsSubTab === 'COST' && (
            <div className="space-y-6 animate-fade-in">
              <div className="glass-card p-5 rounded-2xl shadow-md text-xs">
                <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-cyan-400" />
                  <span>Ürün Reçete Maliyet & Marj Analizi</span>
                </h3>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/35 text-zinc-400 font-semibold">
                        <th className="p-3">Ürün Adı</th>
                        <th className="p-3 text-right">Satış Fiyatı</th>
                        <th className="p-3 text-right">Reçete Maliyeti</th>
                        <th className="p-3 text-right">Birim Kâr</th>
                        <th className="p-3 text-center">Kâr Marjı (%)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {(!reportsData.costAnalysis || reportsData.costAnalysis.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-zinc-500 italic">
                            Ürün reçete verisi bulunmamaktadır. Reçete sekmesinden ürünlere reçete bağlayın.
                          </td>
                        </tr>
                      ) : (
                        reportsData.costAnalysis.map((c: any) => {
                          const isLowMargin = c.marginPercentage < 25;
                          const isHighMargin = c.marginPercentage >= 50;
                          return (
                            <tr key={c.id} className="hover:bg-zinc-900/20 transition text-zinc-300">
                              <td className="p-3 font-semibold text-zinc-200">{c.name}</td>
                              <td className="p-3 text-right font-bold text-zinc-100">{c.price.toFixed(2)} TL</td>
                              <td className="p-3 text-right font-bold text-rose-300">{c.cost.toFixed(2)} TL</td>
                              <td className="p-3 text-right font-bold text-emerald-400">{c.margin.toFixed(2)} TL</td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${isHighMargin ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                                    isLowMargin ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                      'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                  }`}>
                                  {c.marginPercentage}%
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {reportsSubTab === 'CANCELLATIONS' && (
            <div className="space-y-6 animate-fade-in">
              <div className="glass-card p-5 rounded-2xl shadow-md text-xs">
                <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>Sipariş / Ürün İptal Günlüğü (Audited)</span>
                </h3>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/35 text-zinc-400 font-semibold">
                        <th className="p-3">Zaman</th>
                        <th className="p-3">İşlem Tipi</th>
                        <th className="p-3">Talep Eden (Garson)</th>
                        <th className="p-3">Onaylayan (Müdür)</th>
                        <th className="p-3">Detaylar / İptal Nedeni</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {(!reportsData.cancellationLogs || reportsData.cancellationLogs.length === 0) ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-zinc-500 italic">
                            İptal kaydı bulunmamaktadır.
                          </td>
                        </tr>
                      ) : (
                        reportsData.cancellationLogs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-zinc-900/20 transition text-zinc-300">
                            <td className="p-3 font-mono text-zinc-500">
                              {new Date(log.createdAt).toLocaleString('tr-TR')}
                            </td>
                            <td className="p-3">
                              <span className="bg-rose-500/10 border border-rose-500/20 text-rose-400 font-bold px-2 py-0.5 rounded text-[9px]">
                                {log.actionType}
                              </span>
                            </td>
                            <td className="p-3 font-medium text-zinc-200">{log.actorUser.name}</td>
                            <td className="p-3 text-emerald-400 font-semibold">{log.approverUser?.name || '-'}</td>
                            <td className="p-3 font-medium text-zinc-300">{log.description}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {reportsSubTab === 'DISCOUNTS' && (
            <div className="space-y-6 animate-fade-in">
              <div className="glass-card p-5 rounded-2xl shadow-md text-xs">
                <h3 className="font-heading font-bold text-white text-sm mb-4 flex items-center space-x-2">
                  <Percent className="w-4 h-4 text-amber-400" />
                  <span>Uygulanan İndirimler Günlüğü</span>
                </h3>
                <div className="overflow-x-auto scrollbar-thin">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-zinc-800 bg-zinc-900/35 text-zinc-400 font-semibold">
                        <th className="p-3">Zaman</th>
                        <th className="p-3">Uygulayan</th>
                        <th className="p-3">Onaylayan</th>
                        <th className="p-3">Detaylar / Tutar</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850">
                      {(!reportsData.discountLogs || reportsData.discountLogs.length === 0) ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-zinc-500 italic">
                            İndirim kaydı bulunmamaktadır.
                          </td>
                        </tr>
                      ) : (
                        reportsData.discountLogs.map((log: any) => (
                          <tr key={log.id} className="hover:bg-zinc-900/20 transition text-zinc-300">
                            <td className="p-3 font-mono text-zinc-500">
                              {new Date(log.createdAt).toLocaleString('tr-TR')}
                            </td>
                            <td className="p-3 font-medium text-zinc-200">{log.actorUser.name}</td>
                            <td className="p-3 text-emerald-400 font-semibold">{log.approverUser?.name || '-'}</td>
                            <td className="p-3 font-medium text-zinc-300">{log.description}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

        </div>
      ) : activeTab === 'LOGS' ? (
        /* Garson Log Defteri */
        <div className="glass-card rounded-2xl overflow-hidden shadow-lg animate-fade-in text-xs">
          <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/20">
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
                <tr className="border-b border-zinc-800 bg-zinc-900/35 text-zinc-400 font-semibold">
                  <th className="p-4">Tarih / Saat</th>
                  <th className="p-4">İşlem Tipi</th>
                  <th className="p-4">Talep Eden (Garson)</th>
                  <th className="p-4">Onaylayan (Müdür)</th>
                  <th className="p-4">Açıklama / Detay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-900/30 transition text-zinc-300">
                    <td className="p-4 whitespace-nowrap text-zinc-500 font-mono">
                      {new Date(log.createdAt).toLocaleString('tr-TR')}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${log.actionType === 'ITEM_CANCEL' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                          log.actionType === 'TABLE_MERGE' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            log.actionType === 'DISCOUNT_APPLIED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                              'bg-zinc-800 text-zinc-300'
                        }`}>
                        {log.actionType}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-zinc-200">
                      {log.actorUser.name}
                      <span className="text-[10px] text-zinc-500 block">
                        {log.actorUser.role === 'ADMIN' ? 'Müdür' : 'Garson'}
                      </span>
                    </td>
                    <td className="p-4 text-zinc-400">
                      {log.approverUser ? (
                        <span className="text-emerald-400 font-medium">
                          {log.approverUser.name}
                        </span>
                      ) : (
                        <span className="text-zinc-500">-</span>
                      )}
                    </td>
                    <td className="p-4 font-medium text-zinc-200">{log.description}</td>
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
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
                <FolderOpen className="w-4 h-4 text-amber-400" />
                <span>Menü Kategorileri</span>
              </h3>
              <button
                onClick={() => setCategoryModal({ name: '', sortOrder: menuCategories.length + 1 })}
                className="bg-amber-650 hover:bg-amber-500 text-white font-bold p-1.5 px-2 rounded-lg transition text-[10px] flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ekle</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 max-h-[400px] pr-1 scrollbar-thin">
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndCategory}>
                <SortableContext items={menuCategories.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                  {menuCategories.map((cat) => (
                    <SortableCategoryItem
                      key={cat.id}
                      cat={cat}
                      isSelected={selectedMenuCategoryId === cat.id}
                      onSelect={() => setSelectedMenuCategoryId(cat.id)}
                      onEdit={(c: any) => setCategoryModal({ id: c.id, name: c.name, sortOrder: c.sortOrder })}
                      onDelete={(c: any) => handleDeleteCategory(c.id, c.name)}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          </div>

          <div className="lg:col-span-2 glass-card p-5 rounded-2xl shadow-md flex flex-col min-h-[350px]">
            {(() => {
              const selectedCat = menuCategories.find((c) => c.id === selectedMenuCategoryId);
              const productsList = selectedCat ? selectedCat.products : [];

              return (
                <>
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
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
                        <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400 font-semibold">
                          <th className="p-3">Ürün Adı</th>
                          <th className="p-3 text-right">Fiyat</th>
                          <th className="p-3 text-center">Favori</th>
                          <th className="p-3 text-center">Stok T.</th>
                          <th className="p-3 text-center">Mevcut Stok</th>
                          <th className="p-3 text-center">İşlemler</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-850">
                        {productsList.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-6 text-center text-zinc-500 italic">
                              Seçili kategoriye ait ürün bulunmuyor.
                            </td>
                          </tr>
                        ) : (
                          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEndProduct}>
                            <SortableContext items={productsList.map((p: any) => p.id)} strategy={verticalListSortingStrategy}>
                              {productsList.map((prod: any) => (
                                <SortableProductItem
                                  key={prod.id}
                                  prod={prod}
                                  onToggleFavorite={handleToggleFavorite}
                                  onEdit={(p: any) => {
                                    setProductModal({
                                      id: p.id,
                                      name: p.name,
                                      price: p.price,
                                      categoryId: p.categoryId,
                                      isStockControlled: p.isStockControlled,
                                      stockLevel: p.stockLevel,
                                      image: p.image || '',
                                      modifierIds: p.modifiers?.map((m: any) => m.id) || [],
                                      newModifiers: [],
                                    });
                                    setNewModName('');
                                    setNewModPrice('0');
                                  }}
                                  onDelete={(p: any) => handleDeleteProduct(p.id, p.name)}
                                />
                              ))}
                            </SortableContext>
                          </DndContext>
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
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
            <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span>Ürün Ek Seçenekleri (Modifiers)</span>
            </h3>
            <button
              onClick={() => setModifierModal({ name: '', price: 0, productIds: [] })}
              className="bg-amber-650 hover:bg-amber-500 text-white font-bold p-1.5 px-3 rounded-lg transition text-[10px] flex items-center space-x-1 cursor-pointer shadow-md shadow-amber-600/10"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Yeni Seçenek Ekle</span>
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400 font-semibold">
                  <th className="p-3">Seçenek Adı</th>
                  <th className="p-3">Bağlı Ürünler</th>
                  <th className="p-3 text-right">Ekstra Fiyatı</th>
                  <th className="p-3 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {modifiers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-zinc-500 italic">
                      Seçenek tanımlanmamıştır. Sol üstten seçenek ekleyin.
                    </td>
                  </tr>
                ) : (
                  modifiers.map((mod) => (
                    <tr key={mod.id} className="hover:bg-zinc-900/20 text-zinc-300">
                      <td className="p-3 font-semibold text-zinc-200">{mod.name}</td>
                      <td className="p-3">
                        {mod.products && mod.products.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {mod.products.map((p: any) => (
                              <span key={p.id} className="bg-amber-900/50 text-amber-300 font-semibold px-2 py-0.5 rounded text-[9px]">
                                {p.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-zinc-500 italic">Global / Hiçbir Ürün</span>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-amber-300">+{mod.price.toFixed(2)} TL</td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => setModifierModal({ id: mod.id, name: mod.name, price: mod.price, productIds: mod.products?.map((p: any) => p.id) || [] })}
                            className="hover:bg-amber-500/20 p-1 text-amber-400 rounded transition"
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
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
            <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Masa & Bölge Yönetim Sistemi</span>
            </h3>
            <button
              onClick={() => setTableModal({ name: '', area: 'Bahçe' })}
              className="bg-amber-650 hover:bg-amber-500 text-white font-bold p-1.5 px-3 rounded-lg transition text-[10px] flex items-center space-x-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Masa Ekle</span>
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400 font-semibold">
                  <th className="p-3">Masa Adı</th>
                  <th className="p-3">Hizmet Bölgesi</th>
                  <th className="p-3 text-center">Durum</th>
                  <th className="p-3 text-center">Sıralama Önceliği</th>
                  <th className="p-3 text-center">Düzenle / Taşı</th>
                  <th className="p-3 text-center font-bold">Sil</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {tables.map((tbl) => (
                  <tr key={tbl.id} className="hover:bg-zinc-900/20 text-zinc-300">
                    <td className="p-3 font-semibold text-zinc-200">{tbl.name}</td>
                    <td className="p-3 text-zinc-400 font-semibold">{tbl.area}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${tbl.status === 'EMPTY' ? 'bg-zinc-800 text-zinc-400' : 'bg-rose-500/20 text-rose-400'
                        }`}>
                        {tbl.status === 'EMPTY' ? 'Boş' : 'Dolu'}
                      </span>
                    </td>
                    <td className="p-3 text-center font-semibold text-zinc-400">{tbl.sortOrder}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        <button
                          onClick={() => handleSortTable(tbl.id, 'up')}
                          className="hover:bg-zinc-800 p-1 text-amber-400 rounded transition"
                          title="Yukarı Taşı"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleSortTable(tbl.id, 'down')}
                          className="hover:bg-zinc-800 p-1 text-amber-400 rounded transition"
                          title="Aşağı Taşı"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setTableModal({ id: tbl.id, name: tbl.name, area: tbl.area })}
                          className="hover:bg-zinc-800 p-1 text-zinc-300 hover:text-white rounded transition ml-1"
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
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
            <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-emerald-400" />
              <span>Veresiye Hesap Defteri (Cari Müşteriler)</span>
            </h3>
            <button
              onClick={() => setCustomerModal({ name: '', phone: '', balance: 0 })}
              className="bg-amber-650 hover:bg-amber-500 text-white font-bold p-1.5 px-3 rounded-lg transition text-[10px] flex items-center space-x-1 cursor-pointer shadow-md shadow-amber-600/10"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Müşteri Tanımla</span>
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400 font-semibold">
                  <th className="p-3">Cari İsim / Unvan</th>
                  <th className="p-3">Telefon</th>
                  <th className="p-3 text-right">Borç Bakiyesi</th>
                  <th className="p-3 text-center">Tahsilat Al</th>
                  <th className="p-3 text-center">Detay / Ekstre</th>
                  <th className="p-3 text-center">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {customers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-zinc-500 italic">
                      Cari bakiye kaydı bulunmamaktadır.
                    </td>
                  </tr>
                ) : (
                  customers.map((cust) => (
                    <tr key={cust.id} className="hover:bg-zinc-900/20 text-zinc-300">
                      <td className="p-3 font-semibold text-zinc-200">{cust.name}</td>
                      <td className="p-3 text-zinc-400 font-mono">{cust.phone}</td>
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
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold py-1 px-2.5 rounded-lg text-[10px]"
                        >
                          Ekstre Dökümü
                        </button>
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button
                            onClick={() => setCustomerModal({ id: cust.id, name: cust.name, phone: cust.phone, balance: cust.balance })}
                            className="hover:bg-amber-500/20 p-1 text-amber-400 rounded transition"
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
      ) : activeTab === 'INVENTORY' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-xs font-sans">
          {/* Malzeme Tanımları ve Stok Seviyeleri */}
          <div className="lg:col-span-2 glass-card p-5 rounded-2xl shadow-md flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
                <Package className="w-4 h-4 text-cyan-400" />
                <span>Stok Malzemeleri Seviyeleri</span>
              </h3>
              <button
                onClick={() => setIngredientModal({ name: '', unit: 'kg', stockLevel: 0, costPerUnit: 0, minStockLevel: 0 })}
                className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold p-1.5 px-3 rounded-lg transition text-[10px] flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Malzeme Ekle</span>
              </button>
            </div>

            <div className="flex-1 overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400 font-semibold">
                    <th className="p-3">Malzeme Adı</th>
                    <th className="p-3">Birim</th>
                    <th className="p-3 text-right">Birim Maliyeti</th>
                    <th className="p-3 text-center">Mevcut Stok</th>
                    <th className="p-3 text-center">Min. Stok Uyarısı</th>
                    <th className="p-3 text-center">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {ingredients.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-6 text-center text-zinc-500 italic">
                        Kayıtlı stok malzemesi bulunmuyor. Yeni malzeme ekleyin.
                      </td>
                    </tr>
                  ) : (
                    ingredients.map((ing) => {
                      const isLowStock = ing.stockLevel <= ing.minStockLevel;
                      return (
                        <tr key={ing.id} className="hover:bg-zinc-900/20 text-zinc-300">
                          <td className="p-3 font-semibold text-zinc-200">{ing.name}</td>
                          <td className="p-3 text-zinc-400">{ing.unit}</td>
                          <td className="p-3 text-right font-bold text-rose-300">{ing.costPerUnit.toFixed(2)} TL</td>
                          <td className={`p-3 text-center font-extrabold ${isLowStock ? 'text-rose-400 animate-pulse' : 'text-emerald-400'}`}>
                            {ing.stockLevel.toFixed(3)}
                          </td>
                          <td className="p-3 text-center font-semibold text-zinc-400">{ing.minStockLevel.toFixed(3)}</td>
                          <td className="p-3 text-center">
                            <div className="flex items-center justify-center space-x-2">
                              <button
                                onClick={() => setStockAdjustmentModal({ id: ing.id, name: ing.name, unit: ing.unit, adjustmentQty: '', adjustmentNotes: '' })}
                                className="bg-zinc-800 hover:bg-zinc-700 text-cyan-400 font-bold py-1 px-2 rounded text-[10px]"
                                title="Stok Seviyesi Düzelt"
                              >
                                Düzelt
                              </button>
                              <button
                                onClick={() => setIngredientModal({ id: ing.id, name: ing.name, unit: ing.unit, stockLevel: ing.stockLevel, costPerUnit: ing.costPerUnit, minStockLevel: ing.minStockLevel })}
                                className="hover:bg-amber-500/20 p-1 text-amber-400 rounded transition"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteIngredient(ing.id, ing.name)}
                                className="hover:bg-rose-500/20 p-1 text-rose-400 rounded transition"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ürün Reçete Eşleştirme */}
          <div className="glass-card p-5 rounded-2xl shadow-md flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
                <Layers className="w-4 h-4 text-amber-400" />
                <span>Ürün Reçete Eşleştirme</span>
              </h3>
            </div>

            <div className="space-y-4 flex-1 flex flex-col">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Eşleştirilecek Ürün Seçin:</label>
                <select
                  value={selectedProductIdForRecipe}
                  onChange={(e) => setSelectedProductIdForRecipe(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="">-- Ürün Seçin --</option>
                  {recipes.map((prod) => (
                    <option key={prod.id} value={prod.id}>
                      {prod.name} ({prod.category?.name || ''})
                    </option>
                  ))}
                </select>
              </div>

              {selectedProductIdForRecipe ? (
                <div className="flex-1 flex flex-col justify-between space-y-4">
                  <div className="space-y-3 flex-1 overflow-y-auto max-h-[300px] scrollbar-thin pr-1">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-zinc-400">Reçete Kalemleri:</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (ingredients.length === 0) return;
                          setEditingRecipeItems([...editingRecipeItems, { ingredientId: ingredients[0].id, quantityRequired: 0, wastePercentage: 0 }]);
                        }}
                        className="text-amber-400 hover:text-amber-300 font-bold text-[10px] flex items-center space-x-0.5"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Satır Ekle</span>
                      </button>
                    </div>

                    {editingRecipeItems.length === 0 ? (
                      <div className="text-center py-6 text-zinc-500 italic bg-zinc-900/30 rounded-xl">Reçete tanımlanmamış. Satır ekleyip kaydedin.</div>
                    ) : (
                      editingRecipeItems.map((item, idx) => (
                        <div key={idx} className="bg-zinc-950 border border-zinc-900 p-2.5 rounded-xl space-y-2 relative">
                          <button
                            type="button"
                            onClick={() => setEditingRecipeItems(editingRecipeItems.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-2 text-rose-400 hover:text-rose-300 font-extrabold text-[12px]"
                          >
                            ×
                          </button>

                          <div className="grid grid-cols-1 gap-2">
                            <div>
                              <label className="block text-[9px] text-zinc-500 mb-0.5">Malzeme</label>
                              <select
                                value={item.ingredientId}
                                onChange={(e) => {
                                  const list = [...editingRecipeItems];
                                  list[idx].ingredientId = e.target.value;
                                  setEditingRecipeItems(list);
                                }}
                                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-zinc-200"
                              >
                                {ingredients.map(ing => (
                                  <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[9px] text-zinc-500 mb-0.5">Gerekli Mik. ({ingredients.find(i => i.id === item.ingredientId)?.unit || ''})</label>
                                <input
                                  type="number"
                                  step="0.0001"
                                  value={item.quantityRequired === 0 ? '' : item.quantityRequired}
                                  onChange={(e) => {
                                    const list = [...editingRecipeItems];
                                    list[idx].quantityRequired = parseFloat(e.target.value) || 0;
                                    setEditingRecipeItems(list);
                                  }}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-zinc-200"
                                />
                              </div>
                              <div>
                                <label className="block text-[9px] text-zinc-500 mb-0.5">Fire (%)</label>
                                <input
                                  type="number"
                                  step="0.1"
                                  value={item.wastePercentage === 0 ? '' : item.wastePercentage}
                                  onChange={(e) => {
                                    const list = [...editingRecipeItems];
                                    list[idx].wastePercentage = parseFloat(e.target.value) || 0;
                                    setEditingRecipeItems(list);
                                  }}
                                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-[10px] text-zinc-200"
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Dinamik Reçete Maliyeti Gösterimi */}
                  <div className="bg-zinc-950/60 p-3 rounded-xl border border-zinc-900 space-y-1.5 font-sans mb-3 text-left">
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Ürün Satış Fiyatı:</span>
                      <span className="font-bold text-white">
                        {(recipes.find(r => r.id === selectedProductIdForRecipe)?.price || 0).toFixed(2)} TL
                      </span>
                    </div>
                    <div className="flex justify-between text-[11px] text-zinc-400">
                      <span>Hesaplanan Reçete Maliyeti:</span>
                      <span className="font-bold text-rose-400">
                        {(() => {
                          let totalCost = 0;
                          editingRecipeItems.forEach((item) => {
                            const ing = ingredients.find((i) => i.id === item.ingredientId);
                            if (ing) {
                              const wasteCoeff = 1 + (Number(item.wastePercentage) || 0) / 100;
                              totalCost += (Number(item.quantityRequired) || 0) * ing.costPerUnit * wasteCoeff;
                            }
                          });
                          return totalCost;
                        })().toFixed(2)} TL
                      </span>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-emerald-400 border-t border-zinc-900 pt-1.5">
                      <span>Tahmini Brüt Kâr:</span>
                      <span>
                        {(() => {
                          const price = recipes.find(r => r.id === selectedProductIdForRecipe)?.price || 0;
                          let totalCost = 0;
                          editingRecipeItems.forEach((item) => {
                            const ing = ingredients.find((i) => i.id === item.ingredientId);
                            if (ing) {
                              const wasteCoeff = 1 + (Number(item.wastePercentage) || 0) / 100;
                              totalCost += (Number(item.quantityRequired) || 0) * ing.costPerUnit * wasteCoeff;
                            }
                          });
                          return (price - totalCost);
                        })().toFixed(2)} TL
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSaveRecipe(selectedProductIdForRecipe, editingRecipeItems)}
                    className="w-full gradient-primary hover:bg-amber-500 text-white font-bold py-2.5 rounded-xl transition cursor-pointer text-center text-xs"
                  >
                    Reçeteyi Kaydet
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center border border-dashed border-zinc-850 rounded-2xl p-6 text-zinc-500 italic text-center">
                  Reçetesini düzenlemek istediğiniz ürünü yukarıdaki listeden seçin.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : activeTab === 'SUPPLIERS' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in text-xs font-sans">
          {/* Tedarikçi Listesi ve Borç Bakiyeleri */}
          <div className="lg:col-span-2 glass-card p-5 rounded-2xl shadow-md flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
                <Users className="w-4 h-4 text-rose-400" />
                <span>Tedarikçi Cari Bakiyeleri</span>
              </h3>
              <button
                onClick={() => setSupplierModal({ name: '', phone: '' })}
                className="bg-amber-650 hover:bg-amber-550 text-white font-bold p-1.5 px-3 rounded-lg transition text-[10px] flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tedarikçi Ekle</span>
              </button>
            </div>

            <div className="flex-1 overflow-x-auto scrollbar-thin">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/30 text-zinc-400 font-semibold">
                    <th className="p-3">Tedarikçi Adı</th>
                    <th className="p-3">Telefon</th>
                    <th className="p-3 text-right">Borç Bakiyemiz</th>
                    <th className="p-3 text-center">İşlem Yap</th>
                    <th className="p-3 text-center">İşlemler</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {suppliers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-zinc-500 italic">
                        Kayıtlı tedarikçi bulunmuyor. Yeni tedarikçi ekleyin.
                      </td>
                    </tr>
                  ) : (
                    suppliers.map((sup) => (
                      <tr key={sup.id} className={`hover:bg-zinc-900/20 text-zinc-300 transition ${selectedSupplierIdForDetails === sup.id ? 'bg-zinc-900/40' : ''}`} onClick={() => setSelectedSupplierIdForDetails(sup.id)}>
                        <td className="p-3 font-semibold text-zinc-200 cursor-pointer">{sup.name}</td>
                        <td className="p-3 text-zinc-400 font-mono">{sup.phone || '-'}</td>
                        <td className="p-3 text-right font-extrabold text-rose-400">{sup.balance.toFixed(2)} TL</td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => setSupplierInvoiceModal({ supplierId: sup.id, supplierName: sup.name, amount: '', ingredientId: '', quantity: '', note: '' })}
                              className="bg-amber-600/30 hover:bg-amber-650 text-amber-300 font-bold py-1 px-2 rounded-lg text-[9px] transition"
                            >
                              + Fatura Girişi
                            </button>
                            <button
                              onClick={() => setSupplierPaymentModal({ supplierId: sup.id, supplierName: sup.name, amount: '', paymentMethod: 'CASH', note: '' })}
                              className="bg-emerald-600/30 hover:bg-emerald-650 text-emerald-300 font-bold py-1 px-2 rounded-lg text-[9px] transition"
                            >
                              $ Ödeme Yap
                            </button>
                          </div>
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() => setSupplierModal({ id: sup.id, name: sup.name, phone: sup.phone || '' })}
                              className="hover:bg-amber-500/20 p-1 text-amber-400 rounded transition"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteSupplier(sup.id, sup.name)}
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

          {/* Tedarikçi Ekstresi / Geçmiş İşlemler */}
          <div className="glass-card p-5 rounded-2xl shadow-md flex flex-col min-h-[400px]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-zinc-800">
              <h3 className="font-heading font-bold text-white text-sm flex items-center space-x-2">
                <DollarSign className="w-4 h-4 text-emerald-400" />
                <span>Tedarikçi Cari Ekstresi</span>
              </h3>
            </div>

            <div className="space-y-4 flex-1 flex flex-col">
              {selectedSupplierIdForDetails ? (
                <div className="flex-1 flex flex-col justify-between space-y-4">
                  <div className="text-xs font-bold text-zinc-300">
                    {suppliers.find(s => s.id === selectedSupplierIdForDetails)?.name || ''} - Cari Hesap Hareketleri:
                  </div>

                  <div className="flex-1 overflow-y-auto max-h-[300px] scrollbar-thin pr-1 space-y-2">
                    {supplierPayments.filter(sp => sp.supplierId === selectedSupplierIdForDetails).length === 0 ? (
                      <div className="text-center py-8 text-zinc-500 italic bg-zinc-900/30 rounded-xl">Cari hareket bulunmuyor.</div>
                    ) : (
                      supplierPayments
                        .filter(sp => sp.supplierId === selectedSupplierIdForDetails)
                        .map((sp) => {
                          const isInvoice = sp.type === 'INVOICE';
                          return (
                            <div key={sp.id} className="bg-zinc-950/40 border border-zinc-900 p-2.5 rounded-xl space-y-1 relative">
                              <div className="flex justify-between text-[9px] text-zinc-500">
                                <span>{new Date(sp.createdAt).toLocaleString('tr-TR')}</span>
                                <span className={isInvoice ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                                  {isInvoice ? 'Alış Faturası' : 'Yapılan Ödeme'}
                                </span>
                              </div>
                              <div className="flex justify-between text-xs font-bold">
                                <span className="text-zinc-300">{sp.note || (isInvoice ? 'Malzeme Alımı' : 'Cari Ödeme')}</span>
                                <span className={isInvoice ? 'text-rose-400' : 'text-emerald-400'}>
                                  {isInvoice ? '+' : '-'}{sp.amount.toFixed(2)} TL
                                </span>
                              </div>
                              {sp.ingredient && (
                                <div className="text-[9px] text-zinc-400 mt-1">
                                  Alınan: {sp.ingredient.name}
                                </div>
                              )}
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center border border-dashed border-zinc-850 rounded-2xl p-6 text-zinc-500 italic text-center">
                  Cari hareketlerini izlemek istediğiniz tedarikçinin satırına tıklayın.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ADİSYON DETAY MODALI */}
      {selectedAdisyon && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <div className="flex justify-between items-start pb-3 border-b border-zinc-800 mb-4">
              <div>
                <h3 className="font-heading font-black text-sm text-white flex items-center space-x-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  <span>Adisyon Detayı</span>
                  <span className="text-[10px] bg-zinc-800 text-zinc-300 font-semibold px-2 py-0.5 rounded ml-2">
                    {selectedAdisyon.tableName}
                  </span>
                </h3>
                <p className="text-[10px] text-zinc-500 mt-1">
                  Kapatılma: {new Date(selectedAdisyon.updatedAt).toLocaleString('tr-TR')}
                </p>
              </div>
              <button
                onClick={() => setSelectedAdisyon(null)}
                className="text-zinc-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="border border-zinc-800 rounded-xl bg-zinc-900/30 p-3 divide-y divide-zinc-850 max-h-56 overflow-y-auto scrollbar-thin">
                {selectedAdisyon.items.map((item, idx) => {
                  const mods = item.selectedModifiers ? JSON.parse(item.selectedModifiers) : [];
                  const modTotal = mods.reduce((sum: number, m: any) => sum + m.price, 0);
                  return (
                    <div key={idx} className="py-2 first:pt-0 last:pb-0 flex justify-between items-center text-xs">
                      <div>
                        <div className="font-semibold text-zinc-200">{item.productName}</div>
                        {mods.length > 0 && (
                          <div className="text-[10px] text-amber-400 italic mt-0.5">
                            + {mods.map((m: any) => m.name).join(', ')}
                          </div>
                        )}
                        <div className="text-[9px] text-zinc-500">
                          {item.quantity} adet × {item.unitPrice + modTotal} TL
                        </div>
                      </div>
                      <span className="font-bold text-zinc-100">
                        {((item.unitPrice + modTotal) * item.quantity).toFixed(2)} TL
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-850 space-y-2">
                <div className="flex justify-between text-zinc-400">
                  <span>Toplam Adisyon Tutarı</span>
                  <span className="font-bold text-zinc-200">{selectedAdisyon.totalAmount.toFixed(2)} TL</span>
                </div>
                {selectedAdisyon.discountAmount > 0 && (
                  <div className="flex justify-between text-rose-400">
                    <span>Uygulanan İndirim</span>
                    <span>-{selectedAdisyon.discountAmount.toFixed(2)} TL</span>
                  </div>
                )}
                <div className="flex justify-between text-emerald-400 border-t border-zinc-900 pt-2 font-bold">
                  <span>Ödenen Net Tutar</span>
                  <span>{selectedAdisyon.paidAmount.toFixed(2)} TL</span>
                </div>
                <div className="flex justify-between text-zinc-500 text-[10px] pt-1">
                  <span>Siparişi Kapatan Garson:</span>
                  <span className="font-semibold">{selectedAdisyon.waiterName}</span>
                </div>
              </div>

              <button
                onClick={() => setSelectedAdisyon(null)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-xl font-bold cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CARI DETAY / EKSTRE MODALI */}
      {selectedCariStatement && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-2xl rounded-2xl p-6 shadow-2xl border-emerald-500/20 animate-scale-in text-xs flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-start pb-3 border-b border-zinc-800 mb-4 shrink-0">
              <div>
                <h3 className="font-heading font-black text-base text-white flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-emerald-400" />
                  <span>Cari Hesap Ekstre Detayı</span>
                </h3>
                <p className="text-[11px] text-zinc-400 mt-1">
                  Müşteri: <strong className="text-zinc-200">{selectedCariStatement.customer.name}</strong> • Tel: {selectedCariStatement.customer.phone}
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Toplam Cari Borç</div>
                  <div className="text-lg font-heading font-black text-rose-400">{selectedCariStatement.customer.balance.toFixed(2)} TL</div>
                </div>
                <button
                  onClick={() => setSelectedCariStatement(null)}
                  className="text-zinc-400 hover:text-white p-1 bg-zinc-900 rounded-lg border border-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-1 space-y-4 scrollbar-thin">
              {/* Timeline list of Cari Orders and Cash Collections */}
              <div>
                <h4 className="text-xs font-bold text-zinc-300 uppercase tracking-wider mb-2">Cari Hesap Hareketleri</h4>

                {selectedCariStatement.orders.length === 0 && selectedCariStatement.collections.length === 0 ? (
                  <div className="text-center py-10 text-zinc-500 italic border border-dashed border-zinc-800 rounded-2xl">
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
                            <div key={`d-${idx}`} className="bg-zinc-900/60 border border-zinc-850 p-4 rounded-xl space-y-2">
                              <div className="flex justify-between items-center text-[10px]">
                                <span className="font-mono text-zinc-500">
                                  {new Date(o.createdAt).toLocaleString('tr-TR')}
                                </span>
                                <span className="bg-rose-500/10 border border-rose-500/20 text-rose-300 font-bold px-2 py-0.5 rounded">
                                  Veresiye Adisyon (Borç)
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-xs">
                                <div>
                                  Masa: <strong className="text-zinc-200">{o.tableName}</strong> •
                                  Garson: <span className="text-zinc-400 font-semibold ml-1">{o.waiterName}</span>
                                </div>
                                <span className="font-black text-rose-400 text-sm">+{o.totalAmount.toFixed(2)} TL</span>
                              </div>
                              {/* Items list */}
                              <div className="bg-zinc-950/60 p-2 rounded-lg text-[10px] text-zinc-400 border border-zinc-900 divide-y divide-zinc-900 space-y-1">
                                {o.items.map((item: any, i: number) => {
                                  const mods = item.selectedModifiers ? JSON.parse(item.selectedModifiers) : [];
                                  return (
                                    <div key={i} className="flex justify-between pt-1 first:pt-0">
                                      <span>
                                        {item.quantity}x {item.productName}
                                        {mods.length > 0 && <span className="text-amber-400 ml-1">({mods.map((m: any) => m.name).join(', ')})</span>}
                                      </span>
                                      <span className="font-bold text-zinc-300">
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
                                <span className="font-mono text-zinc-500 text-[10px] block mb-1">
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

            <div className="pt-4 border-t border-zinc-800 shrink-0">
              <button
                onClick={() => setSelectedCariStatement(null)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-3 rounded-xl font-bold cursor-pointer text-center"
              >
                Döküm Pencerisini Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODIFIER MODAL */}
      {modifierModal && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <Star className="w-5 h-5 text-amber-400" />
              <span>{modifierModal.id ? 'Seçeneği Düzenle' : 'Yeni Seçenek Ekle'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Seçenek Adı</label>
                <input
                  type="text"
                  value={modifierModal.name}
                  onChange={(e) => setModifierModal({ ...modifierModal, name: e.target.value })}
                  placeholder="Örn: Double Shot, Ekstra Peynir"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1.5">Bağlanacağı Ürünler</label>
                <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 max-h-40 overflow-y-auto space-y-1.5 scrollbar-thin">
                  {menuCategories.flatMap((cat: any) => cat.products || []).map((prod: any) => {
                    const isChecked = modifierModal.productIds?.includes(prod.id) || false;
                    return (
                      <label key={prod.id} className="flex items-center space-x-2 text-zinc-300 hover:text-white cursor-pointer select-none py-0.5">
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
                          className="w-3.5 h-3.5 accent-amber-500 rounded border-zinc-800 cursor-pointer"
                        />
                        <span className="text-[11px]">{prod.name}</span>
                        <span className="text-[9px] text-zinc-500 font-semibold">({menuCategories.find(c => c.products.some((p: any) => p.id === prod.id))?.name || ''})</span>
                      </label>
                    );
                  })}
                  {menuCategories.flatMap((cat: any) => cat.products || []).length === 0 && (
                    <div className="text-[10px] text-zinc-500 italic p-2 text-center">Menüde ürün bulunmamaktadır.</div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Fiyat Farkı (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={modifierModal.price === 0 ? '' : modifierModal.price}
                  onChange={(e) => setModifierModal({ ...modifierModal, price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
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
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveModifier}
                  className="flex-1 gradient-primary hover:bg-amber-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
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
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <Layers className="w-5 h-5 text-amber-400" />
              <span>{tableModal.id ? 'Masayı Düzenle' : 'Yeni Masa Ekle'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Masa Adı</label>
                <input
                  type="text"
                  value={tableModal.name}
                  onChange={(e) => setTableModal({ ...tableModal, name: e.target.value })}
                  placeholder="Örn: Masa 12, B-4"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Bölge (Area)</label>
                <select
                  value={tableModal.area}
                  onChange={(e) => setTableModal({ ...tableModal, area: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
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
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveTable}
                  className="flex-1 gradient-primary hover:bg-amber-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
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
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <UserCheck className="w-5 h-5 text-amber-400" />
              <span>{customerModal.id ? 'Müşteri Bilgilerini Düzenle' : 'Yeni Cari Hesap Oluştur'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Müşteri / Cari Adı</label>
                <input
                  type="text"
                  value={customerModal.name}
                  onChange={(e) => setCustomerModal({ ...customerModal, name: e.target.value })}
                  placeholder="Örn: Ahmet Bey, Google Türkiye"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Telefon Numarası</label>
                <input
                  type="text"
                  value={customerModal.phone}
                  onChange={(e) => setCustomerModal({ ...customerModal, phone: e.target.value })}
                  placeholder="Örn: 0532 555 4433"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              {!customerModal.id && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Başlangıç Bakiyesi (Borç)</label>
                  <input
                    type="number"
                    value={customerModal.balance === 0 ? '' : customerModal.balance}
                    onChange={(e) => setCustomerModal({ ...customerModal, balance: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00 TL"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
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
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveCustomer}
                  className="flex-1 gradient-primary hover:bg-amber-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
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
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-2 flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span>Cari Hesap Tahsilat Al</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mb-4">
              <strong>{collectionModal.name}</strong> müşterisinden alınan tahsilat miktarını ve ödeme tipini belirleyin.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Tahsil Edilen Tutar (TL)</label>
                <input
                  type="number"
                  value={collectionModal.amount}
                  onChange={(e) => setCollectionModal({ ...collectionModal, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              {/* Payment Method Select */}
              <div className="flex bg-zinc-950 border border-zinc-800 p-1 rounded-xl">
                <button
                  onClick={() => setCollectionModal({ ...collectionModal, paymentMethod: 'CASH' })}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${collectionModal.paymentMethod === 'CASH' ? 'gradient-primary text-white' : 'text-zinc-400'
                    }`}
                >
                  Nakit
                </button>
                <button
                  onClick={() => setCollectionModal({ ...collectionModal, paymentMethod: 'CREDIT_CARD' })}
                  className={`flex-1 text-center py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${collectionModal.paymentMethod === 'CREDIT_CARD' ? 'gradient-primary text-white' : 'text-zinc-400'
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
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
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
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <FolderOpen className="w-5 h-5 text-amber-400" />
              <span>{categoryModal.id ? 'Kategoriyi Düzenle' : 'Yeni Kategori Ekle'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Kategori Adı</label>
                <input
                  type="text"
                  value={categoryModal.name}
                  onChange={(e) => setCategoryModal({ ...categoryModal, name: e.target.value })}
                  placeholder="Örn: Tatlılar, Güne Başlarken"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Sıralama Önceliği</label>
                <input
                  type="number"
                  value={categoryModal.sortOrder}
                  onChange={(e) => setCategoryModal({ ...categoryModal, sortOrder: parseInt(e.target.value) || 0 })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
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
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveCategory}
                  className="flex-1 gradient-primary hover:bg-amber-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
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
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <Package className="w-5 h-5 text-cyan-400" />
              <span>{productModal.id ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Ürün Adı</label>
                <input
                  type="text"
                  value={productModal.name}
                  onChange={(e) => setProductModal({ ...productModal, name: e.target.value })}
                  placeholder="Örn: Penne Arabiata, Latte"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Birim Satış Fiyatı (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={productModal.price === 0 ? '' : productModal.price}
                  onChange={(e) => setProductModal({ ...productModal, price: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Kategori</label>
                <select
                  value={productModal.categoryId}
                  onChange={(e) => setProductModal({ ...productModal, categoryId: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                >
                  {menuCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Ürün Görsel URL'si (Opsiyonel)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={productModal.image || ''}
                    onChange={(e) => setProductModal({ ...productModal, image: e.target.value })}
                    placeholder="https://images.unsplash.com/... veya /resim.png"
                    className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500/80"
                  />
                  {productModal.image && (
                    <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 border border-zinc-800">
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

              <div className="flex items-center space-x-3 p-3 bg-zinc-900/40 border border-zinc-855 rounded-xl">
                <input
                  type="checkbox"
                  id="stockControl"
                  checked={productModal.isStockControlled}
                  onChange={(e) => setProductModal({ ...productModal, isStockControlled: e.target.checked })}
                  className="w-4 h-4 accent-amber-500"
                />
                <label htmlFor="stockControl" className="font-semibold text-zinc-300 cursor-pointer">
                  Basit Stok Takibi Aktif
                </label>
              </div>

              {productModal.isStockControlled && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Mevcut Stok Miktarı</label>
                  <input
                    type="number"
                    value={productModal.stockLevel}
                    onChange={(e) => setProductModal({ ...productModal, stockLevel: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                  />
                </div>
              )}

              {/* Ek Seçenekler (Modifiers) Bölümü */}
              <div className="border-t border-zinc-800/80 pt-3">
                <label className="block text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-2">
                  Ürün Ek Seçenekleri (Modifiers)
                </label>

                {/* Mevcut Seçenekler Checklist */}
                {modifiers.length > 0 && (
                  <div className="mb-3">
                    <span className="block text-[10px] text-zinc-400 mb-1">Mevcut Seçeneklerden Bağla:</span>
                    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-2.5 max-h-[110px] overflow-y-auto grid grid-cols-2 gap-2 scrollbar-thin">
                      {modifiers.map((mod) => {
                        const isChecked = (productModal.modifierIds || []).includes(mod.id);
                        return (
                          <label key={mod.id} className="flex items-center space-x-2 p-1.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer text-[10px] font-medium text-zinc-300">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => handleToggleModifierInProduct(mod.id)}
                              className="accent-amber-500 rounded"
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
                    <span className="block text-[10px] text-zinc-400 mb-1">Yeni Eklenecek Seçenekler:</span>
                    <div className="flex flex-wrap gap-1.5">
                      {(productModal.newModifiers || []).map((m, idx) => (
                        <span key={idx} className="bg-amber-500/10 border border-amber-500/30 text-amber-300 px-2 py-0.5 rounded-lg flex items-center text-[10px] font-semibold">
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
                <div className="bg-zinc-950/40 border border-zinc-850 p-2.5 rounded-xl">
                  <span className="block text-[10px] font-semibold text-zinc-400 mb-1.5">Yeni Seçenek Oluştur & Ekle:</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newModName}
                      onChange={(e) => setNewModName(e.target.value)}
                      placeholder="Seçenek adı (örn: Muzlu)"
                      className="flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-[10px] text-zinc-200 focus:outline-none focus:border-amber-500/80"
                    />
                    <input
                      type="number"
                      value={newModPrice === '0' ? '' : newModPrice}
                      onChange={(e) => setNewModPrice(e.target.value)}
                      placeholder="+0 TL"
                      className="w-16 bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1.5 text-[10px] text-zinc-200 focus:outline-none focus:border-amber-500/80"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewModInline}
                      className="bg-amber-650 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg transition text-[10px] cursor-pointer"
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
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveProduct}
                  className="flex-1 gradient-primary hover:bg-amber-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
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
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-scale-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-3">
              <h3 className="font-heading font-bold text-lg text-white flex items-center space-x-2">
                <FileText className="w-5 h-5 text-amber-400" />
                <span>Adisyon Detayı</span>
              </h3>
              <button
                onClick={() => setSelectedAdisyon(null)}
                className="text-zinc-400 hover:text-white transition bg-zinc-800 p-1.5 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-between text-xs text-zinc-300 mb-4 bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
              <div className="space-y-1">
                <div><span className="font-semibold text-zinc-500">Masa:</span> <span className="font-bold text-white">{selectedAdisyon.tableName}</span></div>
                <div><span className="font-semibold text-zinc-500">Garson:</span> {selectedAdisyon.waiterName}</div>
                {selectedAdisyon.customerName && <div><span className="font-semibold text-zinc-500">Cari:</span> <span className="text-cyan-400 font-semibold">{selectedAdisyon.customerName}</span></div>}
              </div>
              <div className="space-y-1 text-right">
                <div><span className="font-semibold text-zinc-500">Tarih:</span> {new Date(selectedAdisyon.updatedAt).toLocaleString('tr-TR')}</div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-thin pr-2 space-y-2 mb-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Sipariş İçeriği</h4>
              {selectedAdisyon.items && selectedAdisyon.items.length > 0 ? (
                selectedAdisyon.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-start bg-zinc-900/40 p-2.5 rounded-xl text-xs border border-zinc-800/50">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-amber-400 font-bold">{item.quantity}x</span>
                        <span className="font-semibold text-zinc-200">{item.productName}</span>
                      </div>
                      {item.selectedModifiers && (
                        <div className="text-[10px] text-zinc-500 mt-1 pl-6">
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
                <div className="text-center p-4 text-zinc-500 text-xs italic bg-zinc-900/30 rounded-xl">Ürün detayı bulunamadı.</div>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm space-y-2 shrink-0">
              <div className="flex justify-between text-zinc-400">
                <span>Ara Toplam:</span>
                <span>{selectedAdisyon.totalAmount.toFixed(2)} TL</span>
              </div>
              {selectedAdisyon.discountAmount > 0 && (
                <div className="flex justify-between text-amber-400">
                  <span>İndirim:</span>
                  <span>-{selectedAdisyon.discountAmount.toFixed(2)} TL</span>
                </div>
              )}
              <div className="flex justify-between text-white font-black text-base pt-2 border-t border-zinc-800">
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
          <div className="flex justify-between items-center bg-zinc-900 p-5 rounded-2xl shadow-lg border border-zinc-800">
            <div>
              <h2 className="text-xl font-heading font-black text-white flex items-center space-x-2">
                <Activity className="w-6 h-6 text-amber-400" />
                <span>Gün İşlemleri (Gün Başı & Sonu)</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">
                Restoran operasyonunu başlatmak için gün başı, kapatmak için gün sonu yapmalısınız.
              </p>
              {activeWorkDay && (
                <div className="mt-3 flex items-center space-x-4 bg-zinc-950/40 border border-zinc-800 p-3 rounded-xl max-w-md">
                  <div className="text-xs">
                    <span className="text-zinc-400">Açılış Zamanı: </span>
                    <span className="text-white font-semibold">{new Date(activeWorkDay.startTime).toLocaleString('tr-TR')}</span>
                  </div>
                  <div className="h-4 w-[1px] bg-zinc-800"></div>
                  <div className="text-xs">
                    <span className="text-zinc-400">Aktif Gün Cirosu: </span>
                    <span className="text-emerald-400 font-extrabold text-sm ml-1">{activeWorkDay.revenue?.toFixed(2) || '0.00'} TL</span>
                  </div>
                </div>
              )}
            </div>

            {activeWorkDay ? (
              <button
                onClick={async () => {
                  if (!confirm('Gün sonu yapmak istediğinize emin misiniz?')) return;
                  try {
                    const res = await fetch('/api/admin/workday', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
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
                      headers: { 'Content-Type': 'application/json' },
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
                  <tr className="border-b border-zinc-800 text-zinc-400">
                    <th className="pb-3 font-semibold">Tarih</th>
                    <th className="pb-3 font-semibold">Başlangıç</th>
                    <th className="pb-3 font-semibold">Bitiş</th>
                    <th className="pb-3 font-semibold">Durum</th>
                    <th className="pb-3 font-semibold text-center">İşlem Gören Adisyon</th>
                    <th className="pb-3 font-semibold text-right">Günlük Ciro</th>
                    <th className="pb-3 font-semibold text-center">Rapor Detayı</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/50">
                  {workDays.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500 italic">Henüz hiç gün kaydı yok.</td>
                    </tr>
                  ) : (
                    workDays.map((wd) => (
                      <tr key={wd.id} className="hover:bg-zinc-900/15 transition text-zinc-300">
                        <td className="py-3 font-medium text-zinc-200">{new Date(wd.startTime).toLocaleDateString('tr-TR')}</td>
                        <td className="py-3 text-zinc-400">{new Date(wd.startTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</td>
                        <td className="py-3 text-zinc-400">{wd.endTime ? new Date(wd.endTime).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                        <td className="py-3">
                          {wd.status === 'OPEN' ? (
                            <span className="bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded font-bold">AKTİF</span>
                          ) : (
                            <span className="bg-zinc-800 text-zinc-400 px-2 py-1 rounded font-semibold">KAPALI</span>
                          )}
                        </td>
                        <td className="py-3 text-center font-bold text-zinc-300">{wd._count?.orders || 0}</td>
                        <td className="py-3 text-right text-emerald-400 font-extrabold">{wd.revenue?.toFixed(2) || '0.00'} TL</td>
                        <td className="py-3 text-center">
                          <button
                            onClick={() => {
                              setViewingWorkDay(wd);
                              setActiveTab('REPORTS');
                            }}
                            className="bg-amber-600/20 hover:bg-amber-650 text-amber-300 hover:text-white text-[10px] font-bold px-3 py-1 rounded-xl transition cursor-pointer"
                          >
                            Raporu İncele
                          </button>
                        </td>
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
          <div className="flex justify-between items-center bg-zinc-900 p-5 rounded-2xl shadow-lg border border-zinc-800">
            <div>
              <h2 className="text-xl font-heading font-black text-white flex items-center space-x-2">
                <Users className="w-6 h-6 text-amber-400" />
                <span>Personel Yönetimi</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-1">Garson ve Yöneticileri ekleyin, şifrelerini güncelleyin.</p>
            </div>

            <button
              onClick={() => setUserModal({ name: '', pinHash: '', role: 'WAITER', isActive: true })}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 px-4 rounded-xl shadow-lg transition flex items-center space-x-2 text-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Yeni Personel Ekle</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map((u) => (
              <div key={u.id} className="glass-card p-4 rounded-2xl shadow-md border border-zinc-800 relative">
                <div className="absolute top-4 right-4 flex space-x-2">
                  <button
                    onClick={() => setUserModal({ id: u.id, name: u.name, pinHash: u.pinHash, role: u.role, isActive: u.isActive })}
                    className="p-1.5 bg-zinc-800 hover:bg-amber-500/20 text-zinc-400 hover:text-amber-400 rounded-lg transition"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={async () => {
                      if (!confirm(u.name + ' adlı personeli silmek istediğinize emin misiniz?')) return;
                      const res = await fetch(`/api/admin/users?id=${u.id}`, { method: 'DELETE' });
                      if (res.ok) loadData();
                    }}
                    className="p-1.5 bg-zinc-800 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${u.role === 'ADMIN' ? 'bg-rose-500' : u.role === 'MANAGER' ? 'bg-amber-500' : u.role === 'CASHIER' ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-200">{u.name}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-semibold ${u.role === 'ADMIN' ? 'bg-rose-500/10 text-rose-400' :
                        u.role === 'MANAGER' ? 'bg-amber-500/10 text-amber-400' :
                          u.role === 'CASHIER' ? 'bg-emerald-500/10 text-emerald-400' :
                            'bg-amber-500/10 text-amber-400'
                      }`}>
                      {u.role === 'ADMIN' ? 'Yönetici (Admin)' :
                        u.role === 'MANAGER' ? 'Müdür (Manager)' :
                          u.role === 'CASHIER' ? 'Kasiyer' :
                            'Garson'}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-zinc-400 border-t border-zinc-800 pt-3">
                  <span className="block mb-1">Giriş Şifresi (PIN): <strong className="text-zinc-300 font-mono tracking-widest">{u.pinHash}</strong></span>
                  <span className="block">Durum: {u.isActive ? <span className="text-emerald-400 font-semibold">Aktif</span> : <span className="text-rose-400">Pasif</span>}</span>
                </div>
              </div>
            ))}
            {users.length === 0 && (
              <div className="col-span-full text-center p-8 text-zinc-500 italic glass-card rounded-2xl">
                Kayıtlı personel bulunamadı.
              </div>
            )}
          </div>
        </div>
      )}

      {/* USER MODAL */}
      {userModal && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <Users className="w-5 h-5 text-amber-400" />
              <span>{userModal.id ? 'Personel Düzenle' : 'Yeni Personel Ekle'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  value={userModal.name}
                  onChange={(e) => setUserModal({ ...userModal, name: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Giriş Şifresi (4 Haneli PIN)</label>
                <input
                  type="text"
                  maxLength={4}
                  value={userModal.pinHash}
                  onChange={(e) => setUserModal({ ...userModal, pinHash: e.target.value.replace(/[^0-9]/g, '') })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none font-mono tracking-widest"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Yetki Rolü</label>
                <select
                  value={userModal.role}
                  onChange={(e) => setUserModal({ ...userModal, role: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                >
                  <option value="WAITER">Garson</option>
                  <option value="CASHIER">Kasiyer</option>
                  <option value="MANAGER">Müdür (Manager)</option>
                  <option value="ADMIN">Yönetici (Admin)</option>
                </select>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="userActive"
                  checked={userModal.isActive}
                  onChange={(e) => setUserModal({ ...userModal, isActive: e.target.checked })}
                  className="w-4 h-4 accent-amber-500"
                />
                <label htmlFor="userActive" className="font-semibold text-zinc-300 cursor-pointer">Sisteme Giriş Yapabilir</label>
              </div>

              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setUserModal(null)}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition"
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
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(userModal)
                      });
                      if (res.ok) {
                        setUserModal(null);
                        loadData();
                      } else {
                        const err = await res.json();
                        alert(err.error);
                      }
                    } catch (e) {
                      alert('Hata');
                    }
                  }}
                  className="flex-1 gradient-primary hover:bg-amber-500 text-white text-xs py-2.5 rounded-xl font-semibold transition"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INGREDIENT MODAL */}
      {ingredientModal && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <Package className="w-5 h-5 text-amber-400" />
              <span>{ingredientModal.id ? 'Malzemeyi Düzenle' : 'Yeni Malzeme Ekle'}</span>
            </h3>

            <div className="space-y-4 font-sans">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Malzeme Adı</label>
                <input
                  type="text"
                  value={ingredientModal.name}
                  onChange={(e) => setIngredientModal({ ...ingredientModal, name: e.target.value })}
                  placeholder="Örn: Süt, Kahve Çekirdeği, Un"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Birim (Örn: kg, lt, adet)</label>
                <input
                  type="text"
                  value={ingredientModal.unit}
                  onChange={(e) => setIngredientModal({ ...ingredientModal, unit: e.target.value })}
                  placeholder="Örn: kg, lt, adet"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              {!ingredientModal.id && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Başlangıç Stok Miktarı</label>
                  <input
                    type="number"
                    value={ingredientModal.stockLevel === 0 ? '' : ingredientModal.stockLevel}
                    onChange={(e) => setIngredientModal({ ...ingredientModal, stockLevel: parseFloat(e.target.value) || 0 })}
                    placeholder="0.00"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Birim Maliyeti (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={ingredientModal.costPerUnit === 0 ? '' : ingredientModal.costPerUnit}
                  onChange={(e) => setIngredientModal({ ...ingredientModal, costPerUnit: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00 TL"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Minimum Stok Uyarısı Limiti</label>
                <input
                  type="number"
                  value={ingredientModal.minStockLevel === 0 ? '' : ingredientModal.minStockLevel}
                  onChange={(e) => setIngredientModal({ ...ingredientModal, minStockLevel: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
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
                    setIngredientModal(null);
                    setActionError('');
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveIngredient}
                  className="flex-1 gradient-primary hover:bg-amber-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STOCK ADJUSTMENT MODAL */}
      {stockAdjustmentModal && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-2 flex items-center space-x-2">
              <Package className="w-5 h-5 text-cyan-400" />
              <span>Stok Seviyesi Düzelt</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mb-4">
              <strong>{stockAdjustmentModal.name}</strong> malzemesinin stok seviyesini artı veya eksi yönde değiştirin.
            </p>

            <div className="space-y-4 font-sans">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                  Miktar Değişimi ({stockAdjustmentModal.unit})
                </label>
                <input
                  type="number"
                  step="0.001"
                  value={stockAdjustmentModal.adjustmentQty}
                  onChange={(e) => setStockAdjustmentModal({ ...stockAdjustmentModal, adjustmentQty: e.target.value })}
                  placeholder="Örn: +5 veya -2.5"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Açıklama / Not</label>
                <input
                  type="text"
                  value={stockAdjustmentModal.adjustmentNotes}
                  onChange={(e) => setStockAdjustmentModal({ ...stockAdjustmentModal, adjustmentNotes: e.target.value })}
                  placeholder="Örn: Fire tespiti, Sayım eksiği"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
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
                    setStockAdjustmentModal(null);
                    setActionError('');
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleStockAdjustment}
                  className="flex-1 bg-cyan-650 hover:bg-cyan-555 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER MODAL */}
      {supplierModal && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-4 flex items-center space-x-2">
              <Users className="w-5 h-5 text-amber-400" />
              <span>{supplierModal.id ? 'Tedarikçi Bilgilerini Düzenle' : 'Yeni Tedarikçi Ekle'}</span>
            </h3>

            <div className="space-y-4 font-sans">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Tedarikçi Adı / Ünvanı</label>
                <input
                  type="text"
                  value={supplierModal.name}
                  onChange={(e) => setSupplierModal({ ...supplierModal, name: e.target.value })}
                  placeholder="Örn: Öz Karadeniz Gıda, Metro Toptancı"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Telefon (Opsiyonel)</label>
                <input
                  type="text"
                  value={supplierModal.phone}
                  onChange={(e) => setSupplierModal({ ...supplierModal, phone: e.target.value })}
                  placeholder="Örn: 0212 555 4433"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
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
                    setSupplierModal(null);
                    setActionError('');
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveSupplier}
                  className="flex-1 gradient-primary hover:bg-amber-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER INVOICE MODAL */}
      {supplierInvoiceModal && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-2 flex items-center space-x-2">
              <Plus className="w-5 h-5 text-amber-400" />
              <span>Yeni Fatura / Borç Girişi</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mb-4">
              <strong>{supplierInvoiceModal.supplierName}</strong> tedarikçisine olan borç bakiyemizi artırır.
            </p>

            <div className="space-y-4 font-sans">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Fatura / Alış Tutarı (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={supplierInvoiceModal.amount}
                  onChange={(e) => setSupplierInvoiceModal({ ...supplierInvoiceModal, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Malzeme Alımıyla İlişkilendir (Opsiyonel)</label>
                <select
                  value={supplierInvoiceModal.ingredientId || ''}
                  onChange={(e) => setSupplierInvoiceModal({ ...supplierInvoiceModal, ingredientId: e.target.value })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="">-- Malzeme Seçin --</option>
                  {ingredients.map(ing => (
                    <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                  ))}
                </select>
              </div>

              {supplierInvoiceModal.ingredientId && (
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">
                    Satın Alınan Miktar ({ingredients.find(i => i.id === supplierInvoiceModal.ingredientId)?.unit || ''})
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    value={supplierInvoiceModal.quantity || ''}
                    onChange={(e) => setSupplierInvoiceModal({ ...supplierInvoiceModal, quantity: e.target.value })}
                    placeholder="0.00"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Fatura Notu / Açıklama</label>
                <input
                  type="text"
                  value={supplierInvoiceModal.note || ''}
                  onChange={(e) => setSupplierInvoiceModal({ ...supplierInvoiceModal, note: e.target.value })}
                  placeholder="Örn: Haftalık süt tedariği"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
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
                    setSupplierInvoiceModal(null);
                    setActionError('');
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveSupplierInvoice}
                  className="flex-1 bg-amber-650 hover:bg-amber-555 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUPPLIER PAYMENT MODAL */}
      {supplierPaymentModal && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-sm rounded-2xl p-6 shadow-2xl animate-scale-in text-xs">
            <h3 className="font-heading font-bold text-sm text-white mb-2 flex items-center space-x-2">
              <DollarSign className="w-5 h-5 text-emerald-400" />
              <span>Tedarikçi Cari Borç Ödemesi</span>
            </h3>
            <p className="text-[11px] text-zinc-400 mb-4">
              <strong>{supplierPaymentModal.supplierName}</strong> firmasına yapılan ödemeyi kaydeder, borcumuzu düşürür.
            </p>

            <div className="space-y-4 font-sans">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Ödenen Tutar (TL)</label>
                <input
                  type="number"
                  step="0.01"
                  value={supplierPaymentModal.amount}
                  onChange={(e) => setSupplierPaymentModal({ ...supplierPaymentModal, amount: e.target.value })}
                  placeholder="0.00"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Ödeme Yöntemi</label>
                <select
                  value={supplierPaymentModal.paymentMethod}
                  onChange={(e) => setSupplierPaymentModal({ ...supplierPaymentModal, paymentMethod: e.target.value as any })}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none"
                >
                  <option value="CASH">Nakit</option>
                  <option value="CREDIT_CARD">Kredi Kartı</option>
                  <option value="BANK_TRANSFER">Banka Havalesi / EFT</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Açıklama / Not</label>
                <input
                  type="text"
                  value={supplierPaymentModal.note || ''}
                  onChange={(e) => setSupplierPaymentModal({ ...supplierPaymentModal, note: e.target.value })}
                  placeholder="Örn: Garanti Bankasından havale yapıldı"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none"
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
                    setSupplierPaymentModal(null);
                    setActionError('');
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  İptal
                </button>
                <button
                  onClick={handleSaveSupplierPayment}
                  className="flex-1 bg-emerald-650 hover:bg-emerald-555 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* ==================== YAZICI YÖNETİMİ SEKMESİ ==================== */}
      {activeTab === 'PRINTERS' && (
        <div className="space-y-6 animate-fade-in">
          {/* Print Server Durumu */}
          <div className={`flex items-center justify-between p-3 rounded-xl border text-xs font-medium ${
            printServerOnline 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
              : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
          }`}>
            <div className="flex items-center space-x-2">
              <span className={`w-2.5 h-2.5 rounded-full ${printServerOnline ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}`}></span>
              <span>
                {printServerOnline 
                  ? 'Yazdırma Sunucusu Çalışıyor (localhost:9100)' 
                  : 'Yazdırma Sunucusu Kapalı. Uygulamayı indirip çalıştırın.'}
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <a
                href="/GustoPOS-PrintServer.exe"
                download="GustoPOS-PrintServer.exe"
                className="active-press bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer transition"
              >
                <Download className="w-3 h-3" />
                <span>Uygulamayı İndir (.exe)</span>
              </a>
              <button
                onClick={async () => {
                  const online = await checkPrintServerStatus();
                  setPrintServerOnline(online);
                  if (online) {
                    const wp = await getWindowsPrinters();
                    setWindowsPrinters(wp);
                  }
                }}
                className="active-press bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded-lg flex items-center space-x-1 cursor-pointer transition"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Yenile</span>
              </button>
            </div>
          </div>

          {/* Alt Sekme Seçici */}
          <div className="flex bg-zinc-950/80 border border-zinc-800 p-1 rounded-xl">
            <button
              onClick={() => setPrinterSubTab('LIST')}
              className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                printerSubTab === 'LIST' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Yazıcılar</span>
            </button>
            <button
              onClick={() => setPrinterSubTab('ASSIGNMENTS')}
              className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                printerSubTab === 'ASSIGNMENTS' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Kategori Eşleştirme</span>
            </button>
            <button
              onClick={() => setPrinterSubTab('RECEIPT')}
              className={`flex-1 text-center py-2 rounded-lg text-xs font-semibold transition cursor-pointer flex items-center justify-center space-x-1.5 ${
                printerSubTab === 'RECEIPT' ? 'gradient-primary text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Hesap Fişi Ayarları</span>
            </button>
          </div>

          {/* ===== ALT SEKME: YAZICI LİSTESİ ===== */}
          {printerSubTab === 'LIST' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-heading text-sm font-bold text-white">Tanımlı Yazıcılar</h3>
                <button
                  onClick={() => setPrinterModal({ name: '', windowsName: '', type: 'KITCHEN', paperWidth: 80 })}
                  className="active-press gradient-primary hover:bg-amber-500 text-white text-xs px-4 py-2 rounded-xl font-semibold flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-amber-500/20"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Yeni Yazıcı Ekle</span>
                </button>
              </div>

              {printers.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs italic bg-zinc-900/30 border border-dashed border-zinc-800/80 rounded-xl">
                  Henüz tanımlı bir yazıcı bulunmuyor. Yukarıdan yeni yazıcı ekleyin.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {printers.map((p: any) => (
                    <div key={p.id} className="glass-card rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            p.type === 'KITCHEN' ? 'bg-amber-500/15 text-amber-400' : 'bg-teal-500/15 text-teal-400'
                          }`}>
                            <Printer className="w-4.5 h-4.5" />
                          </div>
                          <div>
                            <h4 className="font-heading font-bold text-white text-sm">{p.name}</h4>
                            <p className="text-[10px] text-zinc-400">{p.windowsName}</p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={() => setPrinterModal({
                              id: p.id,
                              name: p.name,
                              windowsName: p.windowsName,
                              type: p.type,
                              paperWidth: p.paperWidth,
                            })}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={async () => {
                              if (!confirm(`"${p.name}" yazıcısını kaldırmak istediğinize emin misiniz?`)) return;
                              try {
                                await deletePrinter(p.id);
                                setActionSuccess('Yazıcı başarıyla kaldırıldı.');
                                await loadData();
                                setTimeout(() => setActionSuccess(''), 3000);
                              } catch (err: any) {
                                alert(err.message || 'Yazıcı silinemedi.');
                              }
                            }}
                            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-rose-900/50 text-zinc-400 hover:text-rose-400 transition cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 text-[10px]">
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                          p.type === 'KITCHEN' 
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' 
                            : 'bg-teal-500/15 text-teal-400 border border-teal-500/30'
                        }`}>
                          {p.type === 'KITCHEN' ? 'Mutfak/Sipariş' : 'Hesap Fişi'}
                        </span>
                        <span className="text-zinc-500">|</span>
                        <span className="text-zinc-400">{p.paperWidth}mm</span>
                        <span className="text-zinc-500">|</span>
                        <span className="text-zinc-400">{(p.productAssignments || []).length} ürün atanmış</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ===== ALT SEKME: KATEGORİ EŞLEŞTİRME ===== */}
          {printerSubTab === 'ASSIGNMENTS' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-heading text-sm font-bold text-white">Ürün – Yazıcı Eşleştirme Matrisi</h3>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Hangi ürünün hangi mutfak/bar yazıcısından çıkacağını belirleyin.</p>
                </div>
                <button
                  onClick={async () => {
                    try {
                      await savePrinterAssignments(printerAssignments);
                      setActionSuccess('Kategori eşleşmeleri başarıyla kaydedildi!');
                      await loadData();
                      setTimeout(() => setActionSuccess(''), 3000);
                    } catch (err: any) {
                      setActionError(err.message || 'Eşleşmeler kaydedilemedi.');
                    }
                  }}
                  className="active-press gradient-success text-white text-xs px-4 py-2 rounded-xl font-semibold flex items-center space-x-1.5 cursor-pointer shadow-lg shadow-emerald-500/20"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Eşleşmeleri Kaydet</span>
                </button>
              </div>

              {printers.length === 0 || menuCategories.length === 0 ? (
                <div className="text-center py-12 text-zinc-500 text-xs italic bg-zinc-900/30 border border-dashed border-zinc-800/80 rounded-xl">
                  Eşleştirme yapabilmek için en az bir yazıcı ve bir kategori tanımlanmış olmalıdır.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="text-left py-3 px-4 bg-zinc-900/80 border border-zinc-800 rounded-tl-xl font-semibold text-zinc-300 sticky left-0 z-10 min-w-[160px]">
                          Kategori
                        </th>
                        {printers.filter((p: any) => p.type === 'KITCHEN').map((p: any) => (
                          <th key={p.id} className="text-center py-3 px-4 bg-zinc-900/80 border border-zinc-800 font-semibold text-zinc-300 min-w-[120px]">
                            <div className="flex flex-col items-center space-y-1">
                              <Printer className="w-4 h-4 text-amber-400" />
                              <span>{p.name}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {menuCategories.map((cat: any) => (
                        <React.Fragment key={cat.id}>
                          <tr className="bg-zinc-800/40">
                            <td colSpan={1 + printers.filter((p: any) => p.type === 'KITCHEN').length} className="py-2 px-4 border border-zinc-800/60 font-bold text-zinc-400 text-[10px] uppercase tracking-wider sticky left-0 bg-zinc-900/90 z-10">
                              KATEGORİ: {cat.name}
                            </td>
                          </tr>
                          {(cat.products || []).map((prod: any) => (
                            <tr key={prod.id} className="hover:bg-zinc-900/40 transition">
                              <td className="py-2 px-4 border border-zinc-800/60 font-medium text-zinc-200 sticky left-0 bg-zinc-950/90 z-10 pl-8">
                                • {prod.name}
                              </td>
                              {printers.filter((p: any) => p.type === 'KITCHEN').map((p: any) => {
                                const isAssigned = printerAssignments.some(
                                  a => a.printerId === p.id && a.productId === prod.id
                                );
                                return (
                                  <td key={p.id} className="text-center py-2 px-4 border border-zinc-800/60">
                                    <button
                                      onClick={() => {
                                        setPrinterAssignments(prev => {
                                          if (isAssigned) {
                                            return prev.filter(a => !(a.printerId === p.id && a.productId === prod.id));
                                          } else {
                                            return [...prev, { printerId: p.id, productId: prod.id }];
                                          }
                                        });
                                      }}
                                      className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all duration-200 cursor-pointer mx-auto ${
                                        isAssigned
                                          ? 'bg-amber-500 border-amber-400 text-white shadow-lg shadow-amber-500/30'
                                          : 'bg-zinc-900 border-zinc-700 text-zinc-600 hover:border-zinc-500'
                                      }`}
                                    >
                                      {isAssigned && <Check className="w-3 h-3" />}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ===== ALT SEKME: HESAP FİŞİ AYARLARI ===== */}
          {printerSubTab === 'RECEIPT' && receiptSettings && (
            <div className="flex flex-col lg:flex-row gap-6">
              {/* Sol: Form Alanları */}
              <div className="flex-1 space-y-4">
                <h3 className="font-heading text-sm font-bold text-white">Hesap Fişi Görünüm Ayarları</h3>

                <div className="glass-card rounded-xl p-4 space-y-4">
                  {/* İşletme Bilgileri */}
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-300 mb-1">İşletme Adı</label>
                    <input
                      type="text"
                      value={receiptSettings.businessName || ''}
                      onChange={(e) => setReceiptSettings({ ...receiptSettings, businessName: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Adres Satır 1</label>
                      <input
                        type="text"
                        value={receiptSettings.addressLine1 || ''}
                        onChange={(e) => setReceiptSettings({ ...receiptSettings, addressLine1: e.target.value })}
                        placeholder="Örn: CADDE NO: 12"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Adres Satır 2</label>
                      <input
                        type="text"
                        value={receiptSettings.addressLine2 || ''}
                        onChange={(e) => setReceiptSettings({ ...receiptSettings, addressLine2: e.target.value })}
                        placeholder="Örn: ATAŞEHİR / İSTANBUL"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Telefon</label>
                      <input
                        type="text"
                        value={receiptSettings.phone || ''}
                        onChange={(e) => setReceiptSettings({ ...receiptSettings, phone: e.target.value })}
                        placeholder="0216 555 4433"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Vergi No (VKN)</label>
                      <input
                        type="text"
                        value={receiptSettings.taxNo || ''}
                        onChange={(e) => setReceiptSettings({ ...receiptSettings, taxNo: e.target.value })}
                        placeholder="1234567890"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="border-t border-zinc-800/60 pt-4">
                    <h4 className="text-xs font-bold text-zinc-300 mb-3">Alt Bilgi Metinleri</h4>
                    <div className="space-y-2">
                      <input
                        type="text"
                        value={receiptSettings.footerLine1 || ''}
                        onChange={(e) => setReceiptSettings({ ...receiptSettings, footerLine1: e.target.value })}
                        placeholder="Alt satır 1"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        value={receiptSettings.footerLine2 || ''}
                        onChange={(e) => setReceiptSettings({ ...receiptSettings, footerLine2: e.target.value })}
                        placeholder="Alt satır 2"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                      <input
                        type="text"
                        value={receiptSettings.footerLine3 || ''}
                        onChange={(e) => setReceiptSettings({ ...receiptSettings, footerLine3: e.target.value })}
                        placeholder="Alt satır 3"
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  </div>

                  <div className="border-t border-zinc-800/60 pt-4">
                    <h4 className="text-xs font-bold text-zinc-300 mb-3">Görünüm Seçenekleri</h4>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-xs text-zinc-300 group-hover:text-white transition">Garson Adını Göster</span>
                        <div
                          onClick={() => setReceiptSettings({ ...receiptSettings, showWaiterName: !receiptSettings.showWaiterName })}
                          className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                            receiptSettings.showWaiterName ? 'bg-amber-500' : 'bg-zinc-700'
                          }`}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                            receiptSettings.showWaiterName ? 'tranzinc-x-5' : ''
                          }`} />
                        </div>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-xs text-zinc-300 group-hover:text-white transition">Tarih / Saat Göster</span>
                        <div
                          onClick={() => setReceiptSettings({ ...receiptSettings, showDateTime: !receiptSettings.showDateTime })}
                          className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                            receiptSettings.showDateTime ? 'bg-amber-500' : 'bg-zinc-700'
                          }`}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                            receiptSettings.showDateTime ? 'tranzinc-x-5' : ''
                          }`} />
                        </div>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-xs text-zinc-300 group-hover:text-white transition">Sipariş Notunu Göster</span>
                        <div
                          onClick={() => setReceiptSettings({ ...receiptSettings, showOrderNote: !receiptSettings.showOrderNote })}
                          className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                            receiptSettings.showOrderNote ? 'bg-amber-500' : 'bg-zinc-700'
                          }`}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                            receiptSettings.showOrderNote ? 'tranzinc-x-5' : ''
                          }`} />
                        </div>
                      </label>
                      <label className="flex items-center justify-between cursor-pointer group">
                        <span className="text-xs text-zinc-300 group-hover:text-white transition">Sipariş Onayında Mutfak Fişi Otomatik Yazdır</span>
                        <div
                          onClick={() => setReceiptSettings({ ...receiptSettings, autoPrintKitchen: !receiptSettings.autoPrintKitchen })}
                          className={`relative w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${
                            receiptSettings.autoPrintKitchen ? 'bg-amber-500' : 'bg-zinc-700'
                          }`}
                        >
                          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform duration-200 ${
                            receiptSettings.autoPrintKitchen ? 'tranzinc-x-5' : ''
                          }`} />
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800/60 pt-4">
                    <h4 className="text-xs font-bold text-zinc-300 mb-2">Hesap Fişi Yazıcısı</h4>
                    <select
                      value={receiptSettings.receiptPrinterId || ''}
                      onChange={(e) => setReceiptSettings({ ...receiptSettings, receiptPrinterId: e.target.value || null })}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                    >
                      <option value="">-- Yazıcı Seçin --</option>
                      {printers.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.windowsName})</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        await saveReceiptSettings(receiptSettings);
                        setActionSuccess('Hesap fişi ayarları başarıyla kaydedildi!');
                        setTimeout(() => setActionSuccess(''), 3000);
                      } catch (err: any) {
                        setActionError(err.message || 'Ayarlar kaydedilemedi.');
                      }
                    }}
                    className="active-press w-full gradient-primary text-white font-semibold text-xs py-3 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-amber-500/20 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Ayarları Kaydet</span>
                  </button>
                </div>
              </div>

              {/* Sağ: Canlı Fiş Önizleme */}
              <div className="w-full lg:w-80">
                <h3 className="font-heading text-sm font-bold text-white mb-3 flex items-center space-x-2">
                  <Eye className="w-4 h-4 text-teal-400" />
                  <span>Canlı Fiş Önizleme</span>
                </h3>
                <div className="bg-white text-zinc-950 rounded-lg p-5 shadow-2xl font-mono text-xs max-h-[70vh] overflow-y-auto scrollbar-thin">
                  <div className="text-center space-y-0.5">
                    {receiptSettings.businessName && <h2 className="text-sm font-bold uppercase tracking-wider">{receiptSettings.businessName}</h2>}
                    {receiptSettings.addressLine1 && <p className="text-[10px] text-zinc-600">{receiptSettings.addressLine1}</p>}
                    {receiptSettings.addressLine2 && <p className="text-[10px] text-zinc-600">{receiptSettings.addressLine2}</p>}
                    {receiptSettings.phone && <p className="text-[10px] text-zinc-600">TEL: {receiptSettings.phone}</p>}
                    {receiptSettings.taxNo && <p className="text-[10px] text-zinc-600">VKN: {receiptSettings.taxNo}</p>}
                    <p className="text-zinc-400">---------------------------------</p>
                    <p className="text-[10px] font-bold">ADİSYON DETAYI</p>
                    <p className="text-zinc-400">---------------------------------</p>
                  </div>

                  <div className="space-y-1 mt-2">
                    <div className="flex justify-between"><span>Masa:</span><span className="font-bold">Masa 1</span></div>
                    {receiptSettings.showDateTime && (
                      <>
                        <div className="flex justify-between"><span>Tarih:</span><span>{new Date().toLocaleDateString('tr-TR')}</span></div>
                        <div className="flex justify-between"><span>Saat:</span><span>{new Date().toLocaleTimeString('tr-TR')}</span></div>
                      </>
                    )}
                    {receiptSettings.showWaiterName && (
                      <div className="flex justify-between"><span>Garson:</span><span>Ahmet</span></div>
                    )}
                  </div>

                  <div className="mt-2">
                    <p className="text-zinc-400">---------------------------------</p>
                    <div className="space-y-1">
                      <div className="flex justify-between"><span>2x Türk Kahvesi</span><span>120.00</span></div>
                      <div className="flex justify-between"><span>1x Latte</span><span>85.00</span></div>
                      <div className="flex justify-between"><span>1x Serpme Kahvaltı</span><span>350.00</span></div>
                    </div>
                    <p className="text-zinc-400">---------------------------------</p>
                  </div>

                  <div className="space-y-1 mt-1">
                    <div className="flex justify-between"><span>Ara Toplam:</span><span>555.00 TL</span></div>
                    <div className="flex justify-between font-bold text-sm border-t border-dashed border-zinc-400 pt-1 mt-1">
                      <span>TOPLAM:</span><span>555.00 TL</span>
                    </div>
                  </div>

                  <div className="text-center pt-4 space-y-0.5">
                    {receiptSettings.footerLine1 && <p className="text-[10px] text-zinc-500">{receiptSettings.footerLine1}</p>}
                    {receiptSettings.footerLine2 && <p className="text-[10px] text-zinc-500">{receiptSettings.footerLine2}</p>}
                    {receiptSettings.footerLine3 && <p className="text-[10px] text-zinc-500">{receiptSettings.footerLine3}</p>}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* YAZICI EKLEME/DÜZENLEME MODALI */}
      {printerModal && (
        <div className="fixed inset-0 bg-zinc-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in">
            <h3 className="font-heading font-bold text-base text-white mb-4 flex items-center space-x-2">
              <Printer className="w-5 h-5 text-teal-400" />
              <span>{printerModal.id ? 'Yazıcıyı Düzenle' : 'Yeni Yazıcı Ekle'}</span>
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Yazıcı Adı</label>
                <input
                  type="text"
                  value={printerModal.name}
                  onChange={(e) => setPrinterModal({ ...printerModal, name: e.target.value })}
                  placeholder="Örn: Mutfak Yazıcısı"
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Windows Yazıcı Adı</label>
                {printServerOnline && windowsPrinters.length > 0 ? (
                  <select
                    value={printerModal.windowsName}
                    onChange={(e) => setPrinterModal({ ...printerModal, windowsName: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="">-- Yazıcı Seçin --</option>
                    {windowsPrinters.map((wp) => (
                      <option key={wp.name} value={wp.name}>
                        {wp.name} ({wp.driverName})
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <input
                      type="text"
                      value={printerModal.windowsName}
                      onChange={(e) => setPrinterModal({ ...printerModal, windowsName: e.target.value })}
                      placeholder="Örn: EPSON TM-T20II"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-amber-500"
                    />
                    <p className="text-[9px] text-amber-400 mt-1">
                      ⚠ Print server kapalı. Windows yazıcı adını elle girin veya print server'ı başlatın.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Yazıcı Tipi</label>
                  <select
                    value={printerModal.type}
                    onChange={(e) => setPrinterModal({ ...printerModal, type: e.target.value })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value="KITCHEN">Mutfak / Sipariş Fişi</option>
                    <option value="RECEIPT">Hesap Fişi</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-300 mb-1">Kağıt Genişliği</label>
                  <select
                    value={printerModal.paperWidth}
                    onChange={(e) => setPrinterModal({ ...printerModal, paperWidth: parseInt(e.target.value) })}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                  >
                    <option value={80}>80mm (Standart)</option>
                    <option value={58}>58mm (Dar)</option>
                  </select>
                </div>
              </div>

              {actionError && (
                <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-2 rounded-xl text-xs">
                  {actionError}
                </div>
              )}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={() => {
                    setPrinterModal(null);
                    setActionError('');
                  }}
                  className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  onClick={async () => {
                    if (!printerModal.name.trim() || !printerModal.windowsName.trim()) {
                      setActionError('Yazıcı adı ve Windows yazıcı adı zorunludur.');
                      return;
                    }
                    setActionError('');
                    try {
                      await savePrinter(printerModal);
                      setActionSuccess(printerModal.id ? 'Yazıcı başarıyla güncellendi!' : 'Yeni yazıcı başarıyla eklendi!');
                      setPrinterModal(null);
                      await loadData();
                      setTimeout(() => setActionSuccess(''), 3000);
                    } catch (err: any) {
                      setActionError(err.message || 'Yazıcı kaydedilemedi.');
                    }
                  }}
                  className="flex-1 gradient-primary hover:bg-amber-500 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer"
                >
                  {printerModal.id ? 'Güncelle' : 'Ekle'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
