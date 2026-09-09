'use client';

import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/components/Toast';
import {
  Tractor,
  Plus,
  MapPin,
  Users,
  LandPlot,
  X,
  Pencil,
  Trash2,
  Search,
  Filter,
} from 'lucide-react';

interface Farm {
  id: string;
  name: string;
  location: string | null;
  totalHectares: number;
  _count: { fields: number; users: number };
}

export default function FarmsPage() {
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingFarm, setEditingFarm] = useState<Farm | null>(null);
  const [formData, setFormData] = useState({ name: '', location: '', totalHectares: '' });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { showToast } = useToast();

  const fetchFarms = async () => {
    const res = await fetch('/api/farms');
    const data = await res.json();
    setFarms(data);
    setLoading(false);
  };

  useEffect(() => { fetchFarms(); }, []);

  const filtered = useMemo(() => {
    if (!searchTerm) return farms;
    const term = searchTerm.toLowerCase();
    return farms.filter((f) =>
      f.name.toLowerCase().includes(term) ||
      (f.location?.toLowerCase().includes(term))
    );
  }, [farms, searchTerm]);

  const openCreateModal = () => {
    setEditingFarm(null);
    setFormData({ name: '', location: '', totalHectares: '' });
    setShowModal(true);
  };

  const openEditModal = (farm: Farm) => {
    setEditingFarm(farm);
    setFormData({
      name: farm.name,
      location: farm.location || '',
      totalHectares: String(farm.totalHectares || ''),
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        name: formData.name,
        location: formData.location || null,
        totalHectares: parseFloat(formData.totalHectares) || 0,
      };

      let res;
      if (editingFarm) {
        res = await fetch(`/api/farms/${editingFarm.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch('/api/farms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Xəta baş verdi');
      }

      setShowModal(false);
      setEditingFarm(null);
      setFormData({ name: '', location: '', totalHectares: '' });
      showToast(editingFarm ? 'Təsərrüfat yeniləndi' : 'Yeni təsərrüfat yaradıldı', 'success');
      fetchFarms();
    } catch (err: any) {
      showToast(err.message || 'Xəta baş verdi', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/farms/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Silmə uğursuz oldu');
      }
      showToast('Təsərrüfat silindi', 'success');
      fetchFarms();
    } catch (err: any) {
      showToast(err.message || 'Silmə uğursuz oldu', 'error');
    } finally {
      setDeleteConfirm(null);
    }
  };

  if (loading) {
    return (
      <div className="page-content">
        <div className="loading-screen">
          <div className="spinner spinner-lg" />
          <div className="loading-text">Yüklənir...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Təsərrüfatlar</h1>
          <p className="page-description">Şirkətə aid bütün təsərrüfatlar — {filtered.length} / {farms.length}</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={18} />
          Yeni təsərrüfat
        </button>
      </div>

      {/* Filtr */}
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={18} style={{ color: 'var(--text-tertiary)' }} />
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 400 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input className="form-input" placeholder="Təsərrüfat adı və ya ünvan axtar..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
          {searchTerm && (
            <button className="btn btn-ghost" onClick={() => setSearchTerm('')} style={{ fontSize: 'var(--font-size-sm)' }}>
              <X size={14} /> Təmizlə
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Tractor size={64} className="empty-state-icon" />
          <h2 className="empty-state-title">{searchTerm ? 'Filtrə uyğun nəticə tapılmadı' : 'Təsərrüfat yoxdur'}</h2>
          <p className="empty-state-description">
            {searchTerm ? 'Axtarış meyarlarını dəyişin' : 'Hələ heç bir təsərrüfat əlavə edilməyib. Yeni təsərrüfat əlavə etmək üçün yuxarıdakı düyməyə basın.'}
          </p>
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map((farm) => (
            <div key={farm.id} className="card" style={{ position: 'relative' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
                  <div className="stat-card-icon green" style={{ width: 40, height: 40 }}>
                    <Tractor size={20} />
                  </div>
                  <div>
                    <h3 className="card-title">{farm.name}</h3>
                    {farm.location && (
                      <div className="card-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} /> {farm.location}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                  <button className="btn btn-ghost btn-icon" onClick={() => openEditModal(farm)} title="Redaktə et">
                    <Pencil size={16} />
                  </button>
                  <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(farm.id)} title="Sil" style={{ color: 'var(--color-error)' }}>
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-6)', marginTop: 'var(--space-4)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <LandPlot size={16} style={{ color: 'var(--color-primary)' }} />
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                    {farm._count.fields} sahə
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
                  <Users size={16} style={{ color: 'var(--color-info)' }} />
                  <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                    {farm._count.users} istifadəçi
                  </span>
                </div>
                <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                  {farm.totalHectares} ha
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{editingFarm ? 'Təsərrüfatı redaktə et' : 'Yeni təsərrüfat'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Təsərrüfat adı *</label>
                <input
                  className="form-input"
                  placeholder="Məs: Sabirabad Təsərrüfatı"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ünvan</label>
                <input
                  className="form-input"
                  placeholder="Məs: Sabirabad rayonu"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ümumi sahə (ha)</label>
                <input
                  className="form-input"
                  type="number"
                  step="0.1"
                  placeholder="0"
                  value={formData.totalHectares}
                  onChange={(e) => setFormData({ ...formData, totalHectares: e.target.value })}
                />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Ləğv et
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> Saxlanılır...</> : (editingFarm ? 'Yadda saxla' : 'Yarat')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--color-error)' }}>Təsərrüfatı sil</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(null)}>
                <X size={20} />
              </button>
            </div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Bu təsərrüfatı silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.
              Təsərrüfata aid bütün sahələr, proseslər və qeydlər silinəcək.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Ləğv et</button>
              <button className="btn btn-primary" style={{ background: 'var(--color-error)' }} onClick={() => handleDelete(deleteConfirm)}>
                <Trash2 size={16} /> Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
