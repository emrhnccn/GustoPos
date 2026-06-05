export interface UserSession {
  id: string;
  name: string;
  role: 'WAITER' | 'ADMIN' | 'MANAGER' | 'CASHIER';
}

export async function fetchTables() {
  const res = await fetch('/api/tables');
  if (!res.ok) throw new Error('Masalar alınamadı.');
  return await res.json();
}

export async function fetchCategories() {
  const res = await fetch('/api/categories');
  if (!res.ok) throw new Error('Kategoriler alınamadı.');
  return await res.json();
}

export async function loginWithPin(pin: string): Promise<UserSession> {
  const res = await fetch('/api/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Giriş başarısız.');
  }
  return await res.json();
}

export async function addSiparis(tableId: string, items: any[], waiterUserId: string) {
  const res = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableId, items, waiterUserId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Sipariş eklenemedi.');
  }
  return await res.json();
}

export async function processPayment(
  tableId: string,
  amount: number,
  paymentMethod: string,
  customerId?: string,
  itemsToPay?: Array<{ orderItemId: string; quantityToPay: number }>
) {
  const res = await fetch('/api/orders/pay', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableId, amount, paymentMethod, customerId, itemsToPay }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Ödeme alınamadı.');
  }
  return await res.json();
}

export async function applyDiscountApi(
  orderId: string,
  discountType: 'percentage' | 'amount',
  value: number,
  adminUserId: string,
  waiterUserId: string
) {
  const res = await fetch('/api/orders/discount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId, discountType, value, adminUserId, waiterUserId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'İndirim uygulanamadı.');
  }
  return await res.json();
}

export async function applyItemAction(
  action: 'cancel' | 'complimentary',
  orderItemId: string,
  quantity: number,
  adminUserId: string,
  waiterUserId: string,
  cancelReason?: string
) {
  const res = await fetch('/api/orders/item-action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      orderItemId,
      quantity,
      cancelReason,
      adminUserId,
      waiterUserId,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'İşlem gerçekleştirilemedi.');
  }
  return await res.json();
}

export async function requestTableBillApi(tableId: string) {
  const res = await fetch('/api/tables/bill-request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tableId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Hesap talebi gönderilemedi.');
  }
  return await res.json();
}

export async function transferOrMergeTables(
  action: 'merge' | 'transfer',
  sourceTableId: string,
  targetTableId: string,
  userId: string,
  itemsToTransfer?: Array<{ orderItemId: string; quantityToMove: number }>
) {
  const res = await fetch('/api/tables/transfer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      sourceTableId,
      targetTableId,
      userId,
      itemsToTransfer,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Masa işlemi başarısız.');
  }
  return await res.json();
}

export async function fetchAdminReports() {
  const res = await fetch('/api/admin/reports');
  if (!res.ok) throw new Error('Yönetim raporları yüklenemedi.');
  return await res.json();
}

export async function fetchAuditLogs() {
  const res = await fetch('/api/admin/logs');
  if (!res.ok) throw new Error('Denetim logları yüklenemedi.');
  return await res.json();
}

export async function saveProduct(productData: any) {
  const method = productData.id ? 'PUT' : 'POST';
  const res = await fetch('/api/admin/products', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(productData),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Ürün kaydedilemedi.');
  }
  return await res.json();
}

export async function deleteProduct(productId: string) {
  const res = await fetch(`/api/admin/products?id=${productId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Ürün silinemedi.');
  }
  return await res.json();
}

export async function saveCategory(categoryData: any) {
  const method = categoryData.id ? 'PUT' : 'POST';
  const res = await fetch('/api/admin/categories', {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(categoryData),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Kategori kaydedilemedi.');
  }
  return await res.json();
}

export async function deleteCategory(categoryId: string) {
  const res = await fetch(`/api/admin/categories?id=${categoryId}`, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Kategori silinemedi.');
  }
  return await res.json();
}

// === CARI / MUSTERI API HAREKETLERI ===
export async function fetchCustomers() {
  const res = await fetch('/api/admin/customers');
  if (!res.ok) throw new Error('Müşteri listesi alınamadı.');
  return await res.json();
}

export async function saveCustomer(customerData: any) {
  const action = customerData.id ? 'update' : 'create';
  const res = await fetch('/api/admin/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...customerData }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Müşteri kaydedilemedi.');
  }
  return await res.json();
}

export async function deleteCustomer(id: string) {
  const res = await fetch('/api/admin/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Müşteri silinemedi.');
  }
  return await res.json();
}

export async function collectCustomerBalance(id: string, amount: number, paymentMethod: string) {
  const res = await fetch('/api/admin/customers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'collect', id, amount, paymentMethod }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Tahsilat gerçekleştirilemedi.');
  }
  return await res.json();
}

// === MODIFIER (EK SEÇENEKLER) API HAREKETLERI ===
export async function fetchModifiers() {
  const res = await fetch('/api/admin/modifiers');
  if (!res.ok) throw new Error('Ek seçenekler alınamadı.');
  return await res.json();
}

export async function saveModifier(modifierData: any) {
  const action = modifierData.id ? 'update' : 'create';
  const res = await fetch('/api/admin/modifiers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...modifierData }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Seçenek kaydedilemedi.');
  }
  return await res.json();
}

export async function deleteModifier(id: string) {
  const res = await fetch('/api/admin/modifiers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Seçenek silinemedi.');
  }
  return await res.json();
}

// === MASA ADMIN API HAREKETLERI ===
export async function fetchAdminTables() {
  const res = await fetch('/api/admin/tables');
  if (!res.ok) throw new Error('Masalar alınamadı.');
  return await res.json();
}

export async function saveAdminTable(tableData: any) {
  const action = tableData.id ? 'update' : 'create';
  const res = await fetch('/api/admin/tables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...tableData }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Masa kaydedilemedi.');
  }
  return await res.json();
}

export async function deleteAdminTable(id: string) {
  const res = await fetch('/api/admin/tables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'delete', id }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Masa silinemedi.');
  }
  return await res.json();
}

export async function sortAdminTable(id: string, direction: 'up' | 'down') {
  const res = await fetch('/api/admin/tables', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'sort', id, direction }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Sıralama değiştirilemedi.');
  }
  return await res.json();
}

export async function fetchCustomerStatement(id: string) {
  const res = await fetch(`/api/admin/customers?id=${id}`);
  if (!res.ok) throw new Error('Cari hesap ekstre detayları alınamadı.');
  return await res.json();
}
