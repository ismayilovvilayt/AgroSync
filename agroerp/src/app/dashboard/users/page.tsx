'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Users as UsersIcon, Plus, X, Shield, ShieldCheck, Sprout, Pencil,
  Trash2, UserCheck, UserX, Search, SlidersHorizontal,
} from 'lucide-react';
import { format } from 'date-fns';
import { az } from 'date-fns/locale';
import { useToast } from '@/components/Toast';

interface UserItem {
  id: string; email: string; fullName: string; phone: string | null;
  role: string; isActive: boolean; createdAt: string;
  farm: { id: string; name: string } | null;
}

const ROLE_CFG: Record<string, { label: string; icon: any; color: string; bg: string; badgeClass: string }> = {
  ADMIN:      { label: 'Administrator', icon: ShieldCheck, color: '#EF4444', bg: 'rgba(239,68,68,0.12)',    badgeClass: 'badge-error' },
  MANAGER:    { label: 'Rəhbər',        icon: Shield,      color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',   badgeClass: 'badge-info' },
  AGRONOMIST: { label: 'Aqronom',       icon: Sprout,      color: '#10B981', bg: 'rgba(16,185,129,0.12)',   badgeClass: 'badge-success' },
};

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
}

function getAvatarColor(name: string): string {
  const colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EC4899', '#06B6D4'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function UsersPage() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<UserItem[]>([]);
  const [farms, setFarms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingUser, setEditingUser] = useState<UserItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const [formData, setFormData] = useState({
    email: '', password: '', fullName: '', phone: '', role: 'AGRONOMIST', farmId: '',
  });

  const safeJson = async (r: Response, fb: any = []) => { try { return r.ok ? await r.json() : fb; } catch { return fb; } };

  const fetchData = async () => {
    const [uRes, fRes] = await Promise.all([fetch('/api/users'), fetch('/api/farms')]);
    setUsers(await safeJson(uRes, []));
    setFarms(await safeJson(fRes, []));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openCreateModal = () => {
    setEditingUser(null);
    setFormData({ email: '', password: '', fullName: '', phone: '', role: 'AGRONOMIST', farmId: '' });
    setShowModal(true);
  };

  const openEditModal = (user: UserItem) => {
    setEditingUser(user);
    setFormData({
      email: user.email,
      password: '',
      fullName: user.fullName,
      phone: user.phone || '',
      role: user.role,
      farmId: user.farm?.id || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editingUser) {
      const payload: any = {
        fullName: formData.fullName,
        phone: formData.phone || null,
        role: formData.role,
        farmId: formData.farmId || null,
        isActive: editingUser.isActive,
      };
      if (formData.password) payload.password = formData.password;

      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast('İstifadəçi yeniləndi', 'success');
        setShowModal(false);
        setEditingUser(null);
        fetchData();
      } else {
        showToast('Xəta baş verdi', 'error');
      }
    } else {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        showToast('İstifadəçi yaradıldı', 'success');
        setShowModal(false);
        setFormData({ email: '', password: '', fullName: '', phone: '', role: 'AGRONOMIST', farmId: '' });
        fetchData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Xəta baş verdi', 'error');
      }
    }
    setSaving(false);
  };

  const toggleActive = async (user: UserItem) => {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: user.fullName,
        phone: user.phone,
        role: user.role,
        farmId: user.farm?.id || null,
        isActive: !user.isActive,
      }),
    });
    if (res.ok) {
      showToast(user.isActive ? 'İstifadəçi deaktiv edildi' : 'İstifadəçi aktiv edildi', 'success');
    }
    fetchData();
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    const res = await fetch(`/api/users/${id}`, { method: 'DELETE' });
    if (res.ok) showToast('İstifadəçi silindi', 'success');
    else showToast('Xəta baş verdi', 'error');
    setDeleting(false);
    setDeleteConfirm(null);
    fetchData();
  };

  // ── Filtered users ──────────────────────────────────────────
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (filterRole !== 'ALL' && u.role !== filterRole) return false;
      if (filterStatus === 'ACTIVE' && !u.isActive) return false;
      if (filterStatus === 'INACTIVE' && u.isActive) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          u.fullName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.farm?.name || '').toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [users, filterRole, filterStatus, search]);

  // ── Stats ───────────────────────────────────────────────────
  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter(u => u.isActive).length,
    admins: users.filter(u => u.role === 'ADMIN').length,
    managers: users.filter(u => u.role === 'MANAGER').length,
    agronomists: users.filter(u => u.role === 'AGRONOMIST').length,
  }), [users]);

  if (loading) {
    return <div className="page-content"><div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Yüklənir...</div></div></div>;
  }

  const userToDelete = users.find(u => u.id === deleteConfirm);

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">İstifadəçilər</h1>
          <p className="page-description">Sistem istifadəçiləri — {stats.active} aktiv / {stats.total} ümumi</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={18} /> Yeni istifadəçi
        </button>
      </div>

      {/* ── Mini Stats ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: 'Ümumi', value: stats.total, color: '#6B7280', bg: 'rgba(107,114,128,0.10)' },
          { label: 'Aktiv', value: stats.active, color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
          { label: 'Admin', value: stats.admins, color: '#EF4444', bg: 'rgba(239,68,68,0.10)' },
          { label: 'Rəhbər', value: stats.managers, color: '#3B82F6', bg: 'rgba(59,130,246,0.10)' },
          { label: 'Aqronom', value: stats.agronomists, color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
        ].map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '8px 16px', borderRadius: 10,
            background: s.bg,
          }}>
            <span style={{ fontWeight: 800, fontSize: 18, color: s.color }}>{s.value}</span>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={15} style={{
            position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-tertiary)', pointerEvents: 'none',
          }} />
          <input
            className="form-input"
            placeholder="Ad, email, təsərrüfat axtar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 34, fontSize: 13 }}
          />
        </div>

        {/* Role filter */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <SlidersHorizontal size={14} style={{ color: 'var(--text-tertiary)' }} />
          {['ALL', 'ADMIN', 'MANAGER', 'AGRONOMIST'].map(role => {
            const cfg = role === 'ALL' ? null : ROLE_CFG[role];
            const isActive = filterRole === role;
            return (
              <button key={role}
                onClick={() => setFilterRole(role)}
                style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', transition: 'all 0.2s',
                  border: isActive && cfg ? `2px solid ${cfg.color}` : '2px solid transparent',
                  background: isActive ? (cfg ? cfg.bg : 'var(--color-primary)') : 'var(--bg-tertiary)',
                  color: isActive ? (cfg ? cfg.color : 'white') : 'var(--text-secondary)',
                }}
              >
                {role === 'ALL' ? 'Hamısı' : cfg?.label}
              </button>
            );
          })}
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[['ALL', 'Hamısı'], ['ACTIVE', 'Aktiv'], ['INACTIVE', 'Deaktiv']].map(([val, lbl]) => (
            <button key={val}
              onClick={() => setFilterStatus(val)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                cursor: 'pointer', transition: 'all 0.2s', border: 'none',
                background: filterStatus === val ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                color: filterStatus === val ? 'white' : 'var(--text-secondary)',
              }}
            >
              {lbl}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="table" style={{ tableLayout: 'fixed' }}>
          <thead>
            <tr>
              <th style={{ width: 240 }}>İstifadəçi</th>
              <th style={{ width: 200 }}>Email</th>
              <th style={{ width: 130 }}>Rol</th>
              <th style={{ width: 150 }}>Təsərrüfat</th>
              <th style={{ width: 90 }}>Status</th>
              <th style={{ width: 110 }}>Qeydiyyat</th>
              <th style={{ width: 110, textAlign: 'right' }}>Əməliyyat</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-tertiary)', fontSize: 14 }}>
                  {search || filterRole !== 'ALL' || filterStatus !== 'ALL'
                    ? 'Filtrə uyğun istifadəçi tapılmadı'
                    : 'Hələ istifadəçi yoxdur'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => {
                const roleCfg = ROLE_CFG[user.role] || ROLE_CFG.AGRONOMIST;
                const RoleIcon = roleCfg.icon;
                const avatarColor = getAvatarColor(user.fullName);
                return (
                  <tr key={user.id} style={{ opacity: user.isActive ? 1 : 0.55 }}>
                    {/* User cell with avatar */}
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: 10,
                          background: `${avatarColor}20`,
                          border: `2px solid ${avatarColor}40`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, fontWeight: 800, color: avatarColor, flexShrink: 0,
                        }}>
                          {getInitials(user.fullName)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{user.fullName}</div>
                          {user.phone && (
                            <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{user.phone}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {user.email}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 700, color: roleCfg.color,
                        background: roleCfg.bg, borderRadius: 20, padding: '3px 10px',
                      }}>
                        <RoleIcon size={11} /> {roleCfg.label}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
                      {user.farm?.name || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        fontSize: 11, fontWeight: 700,
                        color: user.isActive ? '#10B981' : '#6B7280',
                        background: user.isActive ? 'rgba(16,185,129,0.12)' : 'rgba(107,114,128,0.12)',
                        borderRadius: 20, padding: '3px 10px',
                      }}>
                        <span style={{
                          width: 6, height: 6, borderRadius: '50%',
                          background: user.isActive ? '#10B981' : '#6B7280',
                          display: 'inline-block',
                        }} />
                        {user.isActive ? 'Aktiv' : 'Deaktiv'}
                      </span>
                    </td>
                    <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>
                      {format(new Date(user.createdAt), 'dd MMM yyyy', { locale: az })}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => openEditModal(user)}
                          title="Redaktə et"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => toggleActive(user)}
                          title={user.isActive ? 'Deaktiv et' : 'Aktiv et'}
                          style={{ color: user.isActive ? 'var(--color-warning)' : 'var(--color-primary)' }}
                        >
                          {user.isActive ? <UserX size={14} /> : <UserCheck size={14} />}
                        </button>
                        <button
                          className="btn btn-ghost btn-icon"
                          onClick={() => setDeleteConfirm(user.id)}
                          title="Sil"
                          style={{ color: 'var(--color-error)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>

        {/* Footer count */}
        {filteredUsers.length > 0 && filteredUsers.length !== users.length && (
          <div style={{ padding: '10px 20px', fontSize: 12, color: 'var(--text-tertiary)', borderTop: '1px solid var(--border-primary)' }}>
            {filteredUsers.length} / {users.length} istifadəçi göstərilir
          </div>
        )}
      </div>

      {/* ── Create/Edit Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingUser ? (
                  <><Pencil size={18} style={{ color: '#3B82F6' }} /> İstifadəçini redaktə et</>
                ) : (
                  <><Plus size={18} style={{ color: '#10B981' }} /> Yeni istifadəçi</>
                )}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>

            {editingUser && (
              <div style={{ padding: '0 var(--space-6) var(--space-3)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: `${getAvatarColor(editingUser.fullName)}20`,
                  border: `2px solid ${getAvatarColor(editingUser.fullName)}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800, color: getAvatarColor(editingUser.fullName),
                }}>
                  {getInitials(editingUser.fullName)}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{editingUser.fullName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{editingUser.email}</div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Ad Soyad *</label>
                <input className="form-input" placeholder="Məs: Əli Həsənov" value={formData.fullName} onChange={(e) => setFormData({ ...formData, fullName: e.target.value })} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" placeholder="email@domain.com" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required disabled={!!editingUser} />
                </div>
                <div className="form-group">
                  <label className="form-label">{editingUser ? 'Yeni şifrə (ixtiyari)' : 'Şifrə *'}</label>
                  <input className="form-input" type="password" placeholder={editingUser ? 'Dəyişmək lazım deyilsə boş buraxın' : 'Minimum 6 simvol'} value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} required={!editingUser} minLength={editingUser ? 0 : 6} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Telefon</label>
                  <input className="form-input" placeholder="+994 50 XXX XX XX" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Rol *</label>
                  <select className="form-select" value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })}>
                    <option value="AGRONOMIST">Aqronom</option>
                    <option value="MANAGER">Rəhbər</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>
              </div>
              {formData.role === 'AGRONOMIST' && (
                <div className="form-group">
                  <label className="form-label">Təsərrüfat</label>
                  <select className="form-select" value={formData.farmId} onChange={(e) => setFormData({ ...formData, farmId: e.target.value })}>
                    <option value="">Seçin (ixtiyari)...</option>
                    {farms.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              )}
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Ləğv et</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> Saxlanılır...</> : (editingUser ? 'Yadda saxla' : 'Yarat')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--color-error)' }}>
                <Trash2 size={18} /> İstifadəçini sil
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(null)}><X size={20} /></button>
            </div>

            {userToDelete && (
              <div style={{ padding: '0 var(--space-6) var(--space-4)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                  background: `${getAvatarColor(userToDelete.fullName)}20`,
                  border: `2px solid ${getAvatarColor(userToDelete.fullName)}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800, color: getAvatarColor(userToDelete.fullName),
                }}>
                  {getInitials(userToDelete.fullName)}
                </div>
                <div>
                  <div style={{ fontWeight: 700 }}>{userToDelete.fullName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{userToDelete.email}</div>
                </div>
              </div>
            )}

            <p style={{ padding: '0 var(--space-6)', fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 'var(--space-4)' }}>
              Bu istifadəçini silmək istədiyinizə əminsiniz? Alternativ olaraq istifadəçini <strong>deaktiv</strong> edə bilərsiniz.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Ləğv et</button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--color-error)' }}
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
              >
                {deleting ? <><span className="spinner" /> Silinir...</> : <><Trash2 size={16} /> Sil</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
