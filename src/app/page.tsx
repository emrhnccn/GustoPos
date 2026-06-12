'use client';

import React, { useState, useEffect } from 'react';
import PinLogin from '@/components/PinLogin';
import FloorPlan from '@/components/FloorPlan';
import POSInterface from '@/components/POSInterface';
import CheckoutModal from '@/components/CheckoutModal';
import AdminPanel from '@/components/AdminPanel';
import { UserSession, fetchTables } from '@/lib/api';

type ViewMode = 'LOGIN' | 'FLOOR_PLAN' | 'POS_ORDER' | 'CHECKOUT' | 'ADMIN';

export default function POSApplication() {
  const [viewMode, setViewMode] = useState<ViewMode>('LOGIN');
  const [user, setUser] = useState<UserSession | null>(null);
  const [tables, setTables] = useState<any[]>([]);
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [dataError, setDataError] = useState<string>('');

  // Masaları yükleme fonksiyonu
  const loadTables = async () => {
    try {
      const data = await fetchTables();
      setTables(data);
      
      // Eğer şu an bir masa seçiliyse, seçili masanın güncel verisini de güncelle
      if (selectedTable) {
        const updated = data.find((t: any) => t.id === selectedTable.id);
        if (updated) {
          setSelectedTable(updated);
        }
      }
    } catch (err: any) {
      setDataError(err.message || 'Masalar güncellenirken hata oluştu.');
    }
  };

  // Kullanıcı başarıyla PIN girdiğinde çalışır
  const handleLoginSuccess = async (loggedInUser: UserSession) => {
    setUser(loggedInUser);
    setIsLoading(true);
    setViewMode('FLOOR_PLAN');
    try {
      await loadTables();
    } finally {
      setIsLoading(false);
    }
  };

  // Oturumu Kapat
  const handleLogout = () => {
    setUser(null);
    setViewMode('LOGIN');
    setSelectedTable(null);
  };

  // Masa Seçildiğinde çalışır
  const handleSelectTable = (table: any, mode: 'order' | 'checkout') => {
    setSelectedTable(table);
    setViewMode(mode === 'order' ? 'POS_ORDER' : 'CHECKOUT');
  };

  // Ana ekrana geri dön ve veriyi tazele
  const handleBackToFloorPlan = async () => {
    setViewMode('FLOOR_PLAN');
    setSelectedTable(null);
    setIsLoading(true);
    try {
      await loadTables();
    } finally {
      setIsLoading(false);
    }
  };

  // İlk yüklemede ve viewMode geçişlerinde veriyi tazele
  useEffect(() => {
    if (user && viewMode === 'FLOOR_PLAN') {
      loadTables();
    }
  }, [viewMode, user]);

  return (
    <main className="flex-1 flex flex-col w-full h-[100dvh] min-h-[100dvh] relative overflow-hidden">
      {viewMode === 'LOGIN' && (
        <PinLogin onLoginSuccessAction={handleLoginSuccess} />
      )}

      {viewMode === 'FLOOR_PLAN' && user && (
        <>
          {isLoading && tables.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center space-y-3">
              <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-sm text-slate-400">Kat planı yükleniyor...</p>
            </div>
          ) : (
            <FloorPlan
              user={user}
              tables={tables}
              onLogoutAction={handleLogout}
              onSelectTableAction={handleSelectTable}
              onOpenAdminAction={() => setViewMode('ADMIN')}
              refreshDataAction={loadTables}
            />
          )}
        </>
      )}

      {viewMode === 'POS_ORDER' && user && selectedTable && (
        <POSInterface
          user={user}
          table={selectedTable}
          onBackAction={handleBackToFloorPlan}
          refreshDataAction={loadTables}
        />
      )}

      {viewMode === 'CHECKOUT' && user && selectedTable && (
        <CheckoutModal
          user={user}
          table={selectedTable}
          onCloseAction={handleBackToFloorPlan}
          refreshDataAction={loadTables}
        />
      )}

      {viewMode === 'ADMIN' && user && (user.role === 'ADMIN' || user.role === 'MANAGER') && (
        <AdminPanel user={user} onCloseAction={handleBackToFloorPlan} />
      )}
    </main>
  );
}
