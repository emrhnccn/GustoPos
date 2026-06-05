const fs = require('fs');

const adminPanelPath = 'C:/Users/Cucen_Home/.gemini/antigravity-ide/scratch/pos-system/src/components/AdminPanel.tsx';
let content = fs.readFileSync(adminPanelPath, 'utf8');

const dailyOpsHTML = `
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
                      const res = await fetch(\`/api/admin/users?id=\${u.id}\`, { method: 'DELETE' });
                      if(res.ok) loadData();
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center space-x-3 mb-3">
                  <div className={\`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white \${u.role === 'ADMIN' ? 'bg-rose-500' : 'bg-indigo-500'}\`}>
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-200">{u.name}</h4>
                    <span className={\`text-[10px] px-2 py-0.5 rounded font-semibold \${u.role === 'ADMIN' ? 'bg-rose-500/10 text-rose-400' : 'bg-indigo-500/10 text-indigo-400'}\`}>
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
`;

const insertMarker = '    </div>\n  );\n}';
content = content.replace(insertMarker, dailyOpsHTML + '\n' + insertMarker);

fs.writeFileSync(adminPanelPath, content, 'utf8');
console.log('Tabs injected successfully.');
