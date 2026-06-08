'use client';

import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ChevronRight, 
  Clock, 
  ArrowRightLeft, 
  Trash2, 
  Plus, 
  DollarSign, 
  LogOut, 
  Settings, 
  Activity,
  Layers,
  FileText,
  Maximize,
  Minimize,
  AlertTriangle,
  Coffee
} from 'lucide-react';
import { UserSession, requestTableBillApi, transferOrMergeTables } from '@/lib/api';
import Image from 'next/image';

interface TableOrder {
  id: string;
  totalAmount: number;
  discountAmount: number;
  paidAmount: number;
  createdAt: string;
  updatedAt: string;
  note: string | null;
  items: Array<{
    id: string;
    productId: string;
    productName: string;
    unitPrice: number;
    quantity: number;
    note: string | null;
    status: string;
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

interface FloorPlanProps {
  user: UserSession;
  onLogoutAction: () => void;
  onSelectTableAction: (table: TableData, mode: 'order' | 'checkout') => void;
  onOpenAdminAction: () => void;
  tables: TableData[];
  refreshDataAction: () => Promise<void>;
}

export default function FloorPlan({
  user,
  onLogoutAction,
  onSelectTableAction,
  onOpenAdminAction,
  tables,
  refreshDataAction,
}: FloorPlanProps) {
  const [activeArea, setActiveArea] = useState<string>('Tümü');
  const [selectedOpTable, setSelectedOpTable] = useState<TableData | null>(null);
  const [opModalType, setOpModalType] = useState<'NONE' | 'MOVE_MERGE' | 'PARTIAL_TRANSFER'>('NONE');
  
  // Masa Taşıma / Birleştirme State'leri
  const [targetTableId, setTargetTableId] = useState<string>('');
  
  // Kısmi Ürün Aktarma State'leri
  const [transferQuantities, setTransferQuantities] = useState<Record<string, number>>({});
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Kiosk / Fullscreen State'i
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Sürükle Bırak State'leri
  const [draggedOverTableId, setDraggedOverTableId] = useState<string | null>(null);

  // Masaların ait olduğu benzersiz bölgeler
  const areas = ['Tümü', 'Açık', 'Bahçe', 'Üst Kat', 'Loca', 'Teras', 'Diğer'];

  // Aktif filtreye göre masaları süz
  const filteredTables = activeArea === 'Tümü'
    ? tables
    : tables.filter((t) => t.area === activeArea);

  // Otomatik yenileme (15 saniyede bir)
  useEffect(() => {
    const interval = setInterval(() => {
      refreshDataAction();
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  // Kiosk Modu Toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch((err) => {
        console.error(`Tam ekran hatası: ${err.message}`);
      });
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      });
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Sürükle Bırak Event Handlers
  const handleDragStart = (e: React.DragEvent, table: TableData) => {
    e.dataTransfer.setData('text/plain', table.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, table: TableData) => {
    e.preventDefault();
    if (draggedOverTableId !== table.id) {
      setDraggedOverTableId(table.id);
    }
  };

  const handleDragLeave = () => {
    setDraggedOverTableId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetTable: TableData) => {
    e.preventDefault();
    setDraggedOverTableId(null);
    const sourceTableId = e.dataTransfer.getData('text/plain');
    if (!sourceTableId || sourceTableId === targetTable.id) return;
    
    const sourceTable = tables.find(t => t.id === sourceTableId);
    if (!sourceTable) return;

    if (targetTable.status === 'EMPTY') {
      // Boş masaya taşıma
      try {
        const itemsToMove = sourceTable.activeOrder?.items.map(item => ({
          orderItemId: item.id,
          quantityToMove: item.quantity
        })) || [];

        if (itemsToMove.length === 0) {
          throw new Error('Aktarılacak aktif ürün bulunmamaktadır.');
        }

        await transferOrMergeTables('transfer', sourceTableId, targetTable.id, user.id, itemsToMove);
        await refreshDataAction();
        setSuccessMsg(`${sourceTable.name} başarıyla ${targetTable.name} masasına taşındı!`);
        setTimeout(() => setSuccessMsg(''), 3000);
      } catch (err: any) {
        setErrorMsg(err.message || 'Masa taşıma işlemi başarısız oldu.');
        setTimeout(() => setErrorMsg(''), 4000);
      }
    } else {
      // Dolu masaya birleştirme - Onay modalı aç
      setSelectedOpTable(sourceTable);
      setTargetTableId(targetTable.id);
      setOpModalType('MOVE_MERGE');
    }
  };

  // Masa süre takibi
  const getElapsedTimeMins = (createdAtStr?: string) => {
    if (!createdAtStr) return 0;
    const created = new Date(createdAtStr).getTime();
    const now = new Date().getTime();
    return Math.floor((now - created) / 60000);
  };

  const getElapsedTime = (createdAtStr?: string) => {
    if (!createdAtStr) return '';
    const diffMins = getElapsedTimeMins(createdAtStr);
    if (diffMins < 60) {
      return `${diffMins} dk`;
    }
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return `${hours} sa ${mins} dk`;
  };

  const getElapsedTimeStyle = (createdAtStr?: string) => {
    const mins = getElapsedTimeMins(createdAtStr);
    if (mins >= 180) {
      return 'text-rose-400 font-bold bg-rose-950/60 border border-rose-500/50 animate-pulse px-2 py-0.5 rounded-lg';
    }
    if (mins >= 120) {
      return 'text-amber-400 font-semibold bg-amber-950/60 border border-amber-500/30 px-2 py-0.5 rounded-lg';
    }
    return 'text-slate-300 bg-slate-950/30 px-2 py-1 rounded-lg';
  };

  const getMinutesSinceLastUpdate = (updatedAtStr?: string) => {
    if (!updatedAtStr) return 0;
    const updated = new Date(updatedAtStr).getTime();
    const now = new Date().getTime();
    return Math.floor((now - updated) / 60000);
  };

  // Hesap talep et
  const handleRequestBill = async (table: TableData) => {
    try {
      await requestTableBillApi(table.id);
      await refreshDataAction();
      setSuccessMsg(`${table.name} hesabı istendi olarak işaretlendi.`);
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Hesap talebi gönderilemedi.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // Masa Taşıma veya Birleştirme İşlemini Gönder
  const handleMoveMergeSubmit = async () => {
    if (!selectedOpTable || !targetTableId) return;
    const targetTable = tables.find(t => t.id === targetTableId);
    if (!targetTable) return;

    const action = targetTable.status === 'EMPTY' ? 'transfer' : 'merge';

    try {
      if (action === 'merge') {
        // Birleştirme için admin yetkisi teyidi
        if (user.role !== 'ADMIN') {
          setErrorMsg('Masa birleştirme işlemi için yönetici (ADMIN) yetkisi gereklidir!');
          setTimeout(() => setErrorMsg(''), 4000);
          return;
        }
        await transferOrMergeTables('merge', selectedOpTable.id, targetTableId, user.id);
      } else {
        // Boş masaya komple taşıma
        const itemsToMove = selectedOpTable.activeOrder?.items.map(item => ({
          orderItemId: item.id,
          quantityToMove: item.quantity
        })) || [];

        if (itemsToMove.length === 0) {
          throw new Error('Aktarılacak aktif ürün bulunmamaktadır.');
        }

        await transferOrMergeTables('transfer', selectedOpTable.id, targetTableId, user.id, itemsToMove);
      }

      await refreshDataAction();
      setSuccessMsg(action === 'merge' ? 'Masalar başarıyla birleştirildi!' : 'Masa başarıyla taşındı!');
      setTimeout(() => setSuccessMsg(''), 3000);
      closeOpModal();
    } catch (err: any) {
      setErrorMsg(err.message || 'Masa işlemi gerçekleştirilemedi.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  // Kısmi Ürün Aktarma İşlemini Gönder
  const handlePartialTransferSubmit = async () => {
    if (!selectedOpTable || !targetTableId) return;

    const itemsToMove = Object.entries(transferQuantities)
      .filter(([_, qty]) => qty > 0)
      .map(([itemId, qty]) => ({
        orderItemId: itemId,
        quantityToMove: qty
      }));

    if (itemsToMove.length === 0) {
      setErrorMsg('Lütfen aktarmak için en az 1 ürün miktarı seçin.');
      setTimeout(() => setErrorMsg(''), 4000);
      return;
    }

    try {
      await transferOrMergeTables('transfer', selectedOpTable.id, targetTableId, user.id, itemsToMove);
      await refreshDataAction();
      setSuccessMsg('Seçilen ürünler başarıyla aktarıldı!');
      setTimeout(() => setSuccessMsg(''), 3000);
      closeOpModal();
    } catch (err: any) {
      setErrorMsg(err.message || 'Ürün aktarımı gerçekleştirilemedi.');
      setTimeout(() => setErrorMsg(''), 4000);
    }
  };

  const closeOpModal = () => {
    setSelectedOpTable(null);
    setOpModalType('NONE');
    setTargetTableId('');
    setTransferQuantities({});
  };

  const initPartialTransfer = (table: TableData) => {
    setSelectedOpTable(table);
    setOpModalType('PARTIAL_TRANSFER');
    const initialQtys: Record<string, number> = {};
    table.activeOrder?.items.forEach((item) => {
      initialQtys[item.id] = 0;
    });
    setTransferQuantities(initialQtys);
  };

  const handleQtyChange = (itemId: string, maxQty: number, increment: boolean) => {
    setTransferQuantities((prev) => {
      const current = prev[itemId] || 0;
      let next = increment ? current + 1 : current - 1;
      if (next < 0) next = 0;
      if (next > maxQty) next = maxQty;
      return { ...prev, [itemId]: next };
    });
  };

  return (
    <div className="flex-1 flex flex-col p-4 md:p-6 space-y-6 max-w-7xl mx-auto w-full">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 glass-card p-4 rounded-2xl shadow-xl">
        <div className="flex items-center space-x-3">
          <Image 
            src="/logo.png" 
            alt="GustoPOS Logo" 
            width={300} 
            height={100} 
            className="w-[180px] md:w-[220px] h-auto object-contain drop-shadow-md"
            priority
          />
          <div className="hidden sm:block border-l border-slate-700 pl-3 ml-1">
            <p className="text-xs text-slate-400">Cafe & Restoran Masa Planı</p>
          </div>
        </div>

        {/* User Info & Quick Actions */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="bg-slate-800/80 border border-slate-700/60 px-3 py-1.5 rounded-xl flex items-center space-x-2 text-xs">
            <Users className="w-4 h-4 text-indigo-400" />
            <span className="text-slate-300">Giriş yapan:</span>
            <span className="font-semibold text-slate-100">{user.name}</span>
            <span className="bg-indigo-500/20 text-indigo-400 font-bold px-2 py-0.5 rounded-full text-[10px]">
              {user.role === 'ADMIN' ? 'Müdür' : 'Garson'}
            </span>
          </div>

          <button
            onClick={toggleFullscreen}
            className="active-press flex items-center space-x-1.5 bg-slate-800 hover:bg-indigo-700 hover:text-white text-slate-200 font-medium text-xs px-3 py-2 rounded-xl border border-slate-700/80 transition duration-200 cursor-pointer"
            title="Kiosk Modu (Tam Ekran)"
          >
            {isFullscreen ? <Minimize className="w-4 h-4 text-rose-400" /> : <Maximize className="w-4 h-4 text-indigo-400" />}
            <span>{isFullscreen ? 'Kiosk Kapat' : 'Kiosk Modu'}</span>
          </button>

          {user.role === 'ADMIN' && (
            <button
              onClick={onOpenAdminAction}
              className="active-press flex items-center space-x-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-medium text-xs px-3 py-2 rounded-xl transition duration-200 cursor-pointer shadow-md shadow-cyan-600/20"
            >
              <Settings className="w-4 h-4" />
              <span>Yönetici Paneli</span>
            </button>
          )}

          <button
            onClick={onLogoutAction}
            className="active-press flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs px-3 py-2 rounded-xl border border-slate-700/80 transition duration-200 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-rose-400" />
            <span>Çıkış</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500 text-emerald-300 p-3 rounded-xl text-sm shadow-md animate-fade-in">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-500/10 border border-rose-500 text-rose-300 p-3 rounded-xl text-sm shadow-md animate-fade-in">
          {errorMsg}
        </div>
      )}

      {/* Stats Quickbar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-3 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Tüm Masalar</p>
            <p className="text-xl font-bold font-heading mt-0.5 text-white">{tables.length}</p>
          </div>
          <Layers className="w-5 h-5 text-slate-400" />
        </div>
        <div className="glass-card p-3 rounded-xl flex items-center justify-between border-l-4 border-l-rose-500">
          <div>
            <p className="text-[11px] text-rose-400 uppercase font-semibold">Dolu Masalar</p>
            <p className="text-xl font-bold font-heading mt-0.5 text-rose-300">
              {tables.filter((t) => t.status === 'OCCUPIED').length}
            </p>
          </div>
          <Coffee className="w-5 h-5 text-rose-400" />
        </div>
        <div className="glass-card p-3 rounded-xl flex items-center justify-between border-l-4 border-l-amber-500">
          <div>
            <p className="text-[11px] text-amber-400 uppercase font-semibold">Hesap İstendi</p>
            <p className="text-xl font-bold font-heading mt-0.5 text-amber-300">
              {tables.filter((t) => t.status === 'BILL_REQUESTED').length}
            </p>
          </div>
          <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
        </div>
        <div className="glass-card p-3 rounded-xl flex items-center justify-between border-l-4 border-l-slate-600">
          <div>
            <p className="text-[11px] text-slate-400 uppercase font-semibold">Boş Masalar</p>
            <p className="text-xl font-bold font-heading mt-0.5 text-slate-300">
              {tables.filter((t) => t.status === 'EMPTY').length}
            </p>
          </div>
          <Activity className="w-5 h-5 text-slate-500" />
        </div>
      </div>

      {/* Area Navigation Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-thin">
        {areas.map((area) => (
          <button
            key={area}
            onClick={() => setActiveArea(area)}
            className={`active-press px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
              activeArea === area
                ? 'gradient-primary text-white shadow-md shadow-indigo-500/20'
                : 'bg-slate-900/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800/80'
            }`}
          >
            {area}
          </button>
        ))}
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {filteredTables.map((table) => {
          const isOccupied = table.status === 'OCCUPIED';
          const isBillRequested = table.status === 'BILL_REQUESTED';
          const isEmpty = table.status === 'EMPTY';

          let statusClass = 'table-empty';
          if (isOccupied) statusClass = 'table-occupied';
          if (isBillRequested) statusClass = 'table-bill-requested';

          const order = table.activeOrder;
          const remainingAmount = order ? order.totalAmount - order.paidAmount : 0;

          return (
            <div
              key={table.id}
              draggable={!isEmpty}
              onDragStart={(e) => handleDragStart(e, table)}
              onDragOver={(e) => handleDragOver(e, table)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, table)}
              className={`rounded-2xl p-4 flex flex-col justify-between min-h-[140px] relative cursor-pointer group transition-all duration-200 ${statusClass} ${
                draggedOverTableId === table.id 
                  ? 'ring-4 ring-indigo-500/80 scale-[1.03] shadow-indigo-500/40 bg-indigo-950/40' 
                  : ''
              }`}
              onClick={() => {
                onSelectTableAction(table, 'order');
              }}
            >
              {/* Table Name and Area Badge */}
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-heading text-lg font-bold text-white group-hover:scale-105 transition-transform duration-200">
                    {table.name}
                  </h3>
                  <span className="text-[10px] text-slate-400 bg-slate-950/40 px-2 py-0.5 rounded-md font-semibold">
                    {table.area}
                  </span>
                </div>

                {/* Elapsed Time Badge */}
                {order && (
                  <span className={`flex items-center space-x-1 text-[10px] ${getElapsedTimeStyle(order.createdAt)}`}>
                    <Clock className="w-3 h-3 text-indigo-400" />
                    <span>{getElapsedTime(order.createdAt)}</span>
                  </span>
                )}
              </div>

              {/* Alert Badges */}
              {order && (
                <div className="flex flex-col gap-1.5 mt-2">
                  {/* Ödeme Gecikti Badge */}
                  {isBillRequested && (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-rose-300 bg-rose-950/70 border border-rose-500/50 px-2 py-0.5 rounded-lg animate-pulse w-fit">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                      <span>Ödeme Gecikti</span>
                    </span>
                  )}
                  {/* 20dk+ Sipariş Yok Badge */}
                  {isOccupied && getMinutesSinceLastUpdate(order.updatedAt) >= 20 && (
                    <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-amber-300 bg-amber-950/70 border border-amber-500/50 px-2 py-0.5 rounded-lg w-fit">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>20dk+ Sipariş Yok</span>
                    </span>
                  )}
                </div>
              )}

              {/* Central Information */}
              <div className="my-2">
                {!isEmpty && order && (
                  <div>
                    <div className="text-[10px] text-slate-400">Kalan Tutar</div>
                    <div className="text-lg font-bold font-heading text-white">
                      {remainingAmount.toFixed(2)} TL
                    </div>
                  </div>
                )}
                {isEmpty && (
                  <div className="text-xs text-slate-500 italic mt-2">Boş Masa</div>
                )}
              </div>

              {/* Bottom Quick-Action Panel for Occupied Tables */}
              {!isEmpty && (
                <div className="flex items-center justify-between border-t border-white/10 pt-2 mt-2 space-x-1 opacity-90 group-hover:opacity-100 transition-opacity">
                  {/* Sipariş Butonu */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTableAction(table, 'order');
                    }}
                    className="flex-1 bg-white/10 hover:bg-white/20 text-white text-[10px] py-1 rounded-md transition font-semibold"
                  >
                    Sipariş
                  </button>

                  {/* Ödeme Butonu */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTableAction(table, 'checkout');
                    }}
                    className="flex-1 bg-emerald-500/25 hover:bg-emerald-500/45 text-emerald-200 text-[10px] py-1 rounded-md transition font-semibold"
                  >
                    Ödeme
                  </button>

                  {/* Operasyonlar Butonu */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedOpTable(table);
                      setOpModalType('MOVE_MERGE');
                    }}
                    className="bg-white/10 hover:bg-indigo-500/30 p-1 rounded-md transition text-slate-300 hover:text-white"
                    title="Masa Taşı / Birleştir"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                  </button>
                  
                  {/* Kısmi Aktar Butonu */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      initPartialTransfer(table);
                    }}
                    className="bg-white/10 hover:bg-cyan-500/30 p-1 rounded-md transition text-slate-300 hover:text-white"
                    title="Kısmi Ürün Aktar"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>

                  {/* Hesap İste */}
                  {isOccupied && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRequestBill(table);
                      }}
                      className="bg-white/10 hover:bg-amber-500/30 p-1 rounded-md transition text-slate-300 hover:text-white"
                      title="Hesap İste"
                    >
                      <FileText className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* MOVE & MERGE OPERATIONAL MODAL */}
      {opModalType === 'MOVE_MERGE' && selectedOpTable && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-md rounded-2xl p-6 shadow-2xl animate-scale-in">
            <h2 className="font-heading text-lg font-bold text-white mb-2 flex items-center space-x-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
              <span>Masa Taşıma & Birleştirme</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              <span className="font-semibold text-indigo-300">{selectedOpTable.name}</span> masasındaki siparişi taşımak veya başka bir adisyon ile birleştirmek için hedef masayı seçin.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Hedef Masa Seçin</label>
                <select
                  value={targetTableId}
                  onChange={(e) => setTargetTableId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="">-- Masa Seçin --</option>
                  {tables
                    .filter((t) => t.id !== selectedOpTable.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.area}) - {t.status === 'EMPTY' ? 'Boş (Taşıma Yapılır)' : `Dolu (${t.status === 'BILL_REQUESTED' ? 'Hesap İstendi' : 'Aktif'} - Birleştirme Yapılır)`}
                      </option>
                    ))}
                </select>
              </div>

              {targetTableId && (() => {
                const target = tables.find((t) => t.id === targetTableId);
                if (target && target.status !== 'EMPTY') {
                  return (
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 text-xs text-amber-200">
                      <strong>Uyarı:</strong> Hedef masa dolu olduğundan adisyonlar birleştirilecektir. Bu işlem veri güvenliği için <strong>Yönetici (Admin) yetkisi</strong> gerektirir.
                    </div>
                  );
                }
                return null;
              })()}

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={closeOpModal}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handleMoveMergeSubmit}
                  disabled={!targetTableId}
                  className="flex-1 gradient-primary hover:bg-indigo-500 disabled:opacity-50 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer shadow-lg shadow-indigo-500/20"
                >
                  Onayla ve Uygula
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PARTIAL ITEM TRANSFER MODAL */}
      {opModalType === 'PARTIAL_TRANSFER' && selectedOpTable && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-scale-in">
            <h2 className="font-heading text-lg font-bold text-white mb-1 flex items-center space-x-2">
              <Plus className="w-5 h-5 text-cyan-400" />
              <span>Parça Ürün Aktarma</span>
            </h2>
            <p className="text-xs text-slate-400 mb-4">
              <span className="font-semibold text-cyan-300">{selectedOpTable.name}</span> masasından başka bir masaya sadece seçilen ürünleri aktarın.
            </p>

            <div className="space-y-4">
              {/* Target Table */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Hedef Masa Seçin</label>
                <select
                  value={targetTableId}
                  onChange={(e) => setTargetTableId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Masa Seçin --</option>
                  {tables
                    .filter((t) => t.id !== selectedOpTable.id)
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.area}) - {t.status === 'EMPTY' ? 'Boş' : 'Dolu'}
                      </option>
                    ))}
                </select>
              </div>

              {/* Items List */}
              <div className="border border-slate-800/80 rounded-xl max-h-[220px] overflow-y-auto divide-y divide-slate-800/50 bg-slate-900/50">
                {selectedOpTable.activeOrder?.items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 text-xs">
                    <div>
                      <div className="font-semibold text-slate-200">{item.productName}</div>
                      <div className="text-[10px] text-slate-400">
                        {item.unitPrice} TL × {item.quantity} adet
                      </div>
                    </div>
                    {/* Quantity selectors */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleQtyChange(item.id, item.quantity, false)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 w-6 py-0.5 rounded font-bold transition"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-bold text-slate-100 text-sm">
                        {transferQuantities[item.id] || 0}
                      </span>
                      <button
                        onClick={() => handleQtyChange(item.id, item.quantity, true)}
                        className="bg-slate-800 hover:bg-slate-700 text-slate-200 w-6 py-0.5 rounded font-bold transition"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  onClick={closeOpModal}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs py-2.5 rounded-xl font-medium transition cursor-pointer"
                >
                  Vazgeç
                </button>
                <button
                  onClick={handlePartialTransferSubmit}
                  disabled={!targetTableId}
                  className="flex-1 gradient-accent hover:bg-cyan-500 disabled:opacity-50 text-white text-xs py-2.5 rounded-xl font-semibold transition cursor-pointer shadow-lg shadow-cyan-500/20"
                >
                  Aktarımı Gerçekleştir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
