'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import {
  MapPin, Plus, X, Tractor, Cog, Droplets, Pencil, Trash2,
  Search, GitBranch, Sprout, ChevronDown, ChevronUp, Layers,
  Activity, AlertCircle,
} from 'lucide-react';

interface Farm { id: string; name: string; }
interface SeasonFieldInfo {
  cropType: string; status: string;
  season: { name: string; status: string };
}
interface Field {
  id: string;
  farmId: string;
  parentId: string | null;
  fieldNumber: string;
  hectares: number;
  soilType: string | null;
  status: string;
  irrigationIntervalDays: number | null;
  farm: { name: string };
  parent: { id: string; fieldNumber: string } | null;
  children: { id: string; fieldNumber: string; hectares: number }[];
  seasonFields: SeasonFieldInfo[];
  _count: { processes: number; irrigations: number; notes: number; children: number };
}

const statusLabels: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE:  { label: 'Aktiv',           color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  FALLOW:  { label: 'Dincə qoyulub',   color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
};

const cropStatusColors: Record<string, string> = {
  GROWING:   '#10B981',
  SOWN:      '#3B82F6',
  PLANNED:   '#6B7280',
  HARVESTED: '#8B5CF6',
};

// Natural sort: handles "1.1", "Pivot 1.1", "Pivot 10" etc.
function naturalSort(a: string, b: string): number {
  // Extract numeric part after any prefix like "Pivot "
  const extractNums = (s: string) => s.replace(/[^0-9.]/g, ' ').trim().split('.').map(Number);
  const pa = extractNums(a);
  const pb = extractNums(b);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = isNaN(pa[i]) ? -1 : pa[i];
    const nb = isNaN(pb[i]) ? -1 : pb[i];
    if (na !== nb) return na - nb;
  }
  return a.localeCompare(b);
}

const CAN_WRITE = ['ADMIN', 'HEAD_AGRONOMIST', 'AGRONOMIST'];
const CAN_EDIT  = ['ADMIN', 'HEAD_AGRONOMIST'];
const CAN_DELETE = ['ADMIN'];

export default function FieldsPage() {
  const { data: session } = useSession();
  const userRole   = (session?.user as any)?.role as string;
  const userFarmId = (session?.user as any)?.farmId as string | null;

  const [fields,  setFields]  = useState<Field[]>([]);
  const [farms,   setFarms]   = useState<Farm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal,    setShowModal]    = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [editingField, setEditingField] = useState<Field | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchTerm,   setSearchTerm]   = useState('');
  const [filterFarm,   setFilterFarm]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expanded,     setExpanded]     = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    farmId: '', fieldNumber: '', hectares: '', soilType: '',
    status: 'ACTIVE', parentId: '', irrigationIntervalDays: '',
  });

  const safeJson = async (r: Response, fb: any = []) => {
    try { return r.ok ? await r.json() : fb; } catch { return fb; }
  };

  const fetchData = async () => {
    setLoading(true);
    const [fr, farmsRes] = await Promise.all([
      fetch('/api/fields'),
      fetch('/api/farms'),
    ]);
    setFields(await safeJson(fr, []));
    setFarms(await safeJson(farmsRes, []));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const isReadOnly  = !CAN_WRITE.includes(userRole);
  const canEdit     = CAN_EDIT.includes(userRole);
  const canDelete   = CAN_DELETE.includes(userRole);
  const isAgronomist = userRole === 'AGRONOMIST' || userRole === 'HEAD_AGRONOMIST';

  // Natural-sorted + filtered fields
  const filtered = useMemo(() => {
    return [...fields]
      .filter(f => {
        if (filterFarm   && f.farmId !== filterFarm) return false;
        if (filterStatus && f.status !== filterStatus) return false;
        if (searchTerm) {
          const t = searchTerm.toLowerCase();
          if (
            !f.fieldNumber.toLowerCase().includes(t) &&
            !f.farm.name.toLowerCase().includes(t) &&
            !f.soilType?.toLowerCase().includes(t)
          ) return false;
        }
        return true;
      })
      .sort((a, b) => naturalSort(a.fieldNumber, b.fieldNumber));
  }, [fields, filterFarm, filterStatus, searchTerm]);

  const rootFields   = useMemo(() => filtered.filter(f => !f.parentId), [filtered]);
  const childrenOf   = (parentId: string) => filtered.filter(f => f.parentId === parentId);

  const openCreateModal = (parent?: Field) => {
    setEditingField(null);
    setFormData({
      farmId:    parent?.farmId || (isAgronomist && userFarmId ? userFarmId : ''),
      fieldNumber: parent ? `${parent.fieldNumber}.` : '',
      hectares: '',
      soilType: '',
      status: 'ACTIVE',
      parentId: parent?.id || '',
      irrigationIntervalDays: '',
    });
    setShowModal(true);
  };

  const openEditModal = (field: Field) => {
    setEditingField(field);
    setFormData({
      farmId:    field.farmId,
      fieldNumber: field.fieldNumber,
      hectares:  String(field.hectares),
      soilType:  field.soilType || '',
      status:    field.status,
      parentId:  field.parentId || '',
      irrigationIntervalDays: field.irrigationIntervalDays ? String(field.irrigationIntervalDays) : '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Format fieldNumber to 0.00 if numeric
      let fn = formData.fieldNumber.trim();
      const num = parseFloat(fn);
      if (!isNaN(num)) fn = num.toFixed(2);

      const payload = {
        ...formData,
        fieldNumber: fn,
        hectares:    parseFloat(formData.hectares),
        irrigationIntervalDays: formData.irrigationIntervalDays
          ? parseInt(formData.irrigationIntervalDays)
          : null,
        parentId: formData.parentId || null,
      };

      const url = editingField ? `/api/fields/${editingField.id}` : '/api/fields';
      const method = editingField ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      setShowModal(false);
      setEditingField(null);
      fetchData();
    } catch (err: any) {
      alert(`Xəta: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/fields/${id}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    fetchData();
  };

  if (loading) return (
    <div className="page-content">
      <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Yüklənir...</div></div>
    </div>
  );

  // Group fields by farm for display
  const farmGroups: Record<string, { farm: Farm; fields: Field[] }> = {};
  for (const f of rootFields) {
    if (!farmGroups[f.farmId]) {
      const farm = farms.find(fm => fm.id === f.farmId);
      if (farm) farmGroups[f.farmId] = { farm, fields: [] };
    }
    if (farmGroups[f.farmId]) farmGroups[f.farmId].fields.push(f);
  }

  const FieldCard = ({ field, indent = 0 }: { field: Field; indent?: number }) => {
    const season = field.seasonFields?.[0];
    const st = statusLabels[field.status] || { label: field.status, color: '#6B7280', bg: 'rgba(107,114,128,0.1)' };
    const cropColor = season ? (cropStatusColors[season.status] || '#6B7280') : null;
    const children  = childrenOf(field.id);
    const isExp     = expanded[field.id];

    return (
      <div style={{ marginLeft: indent > 0 ? 24 : 0 }}>
        {/* Card */}
        <div style={{
          background: 'var(--bg-card)',
          border: indent > 0 ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border-default)',
          borderRadius: 12,
          marginBottom: 8,
          overflow: 'hidden',
          transition: 'box-shadow 0.15s',
        }}
          onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
        >
          {/* Top row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
            {/* Field number badge */}
            <div style={{
              minWidth: 52, height: 52,
              background: indent > 0 ? 'rgba(16,185,129,0.08)' : 'rgba(59,130,246,0.08)',
              borderRadius: 10,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
            }}>
              {indent > 0
                ? <GitBranch size={14} style={{ color: '#10B981', marginBottom: 2 }} />
                : <Layers size={14} style={{ color: '#3B82F6', marginBottom: 2 }} />
              }
              <span style={{
                fontSize: 11, fontWeight: 800, letterSpacing: '0.02em',
                color: indent > 0 ? '#10B981' : '#3B82F6',
              }}>
                {field.fieldNumber}
              </span>
            </div>

            {/* Main info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <a
                  href={`/dashboard/fields/${field.id}`}
                  style={{ fontWeight: 700, fontSize: 15, color: 'var(--color-primary)', textDecoration: 'none' }}
                  onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                  onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                >
                  {field.fieldNumber}
                </a>
                <span style={{
                  fontSize: 12, fontWeight: 700,
                  background: st.bg, color: st.color,
                  padding: '2px 8px', borderRadius: 6,
                }}>
                  {st.label}
                </span>
                {season && (
                  <span style={{
                    fontSize: 11, fontWeight: 600,
                    background: `${cropColor}18`, color: cropColor ?? undefined,
                    padding: '2px 8px', borderRadius: 6,
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <Sprout size={10} /> {season.cropType}
                  </span>
                )}
                {children.length > 0 && (
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {children.length} alt-sahə
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4, fontSize: 12, color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Tractor size={11} /> {field.farm.name}
                </span>
                <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                  {field.hectares.toFixed(2)} ha
                </span>
                {field.soilType && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <MapPin size={10} /> {field.soilType}
                  </span>
                )}
                {season && (
                  <span style={{ color: 'var(--text-tertiary)' }}>{season.season.name}</span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-tertiary)' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Proseslər">
                <Cog size={12} /> {field._count.processes}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 3 }} title="Suvarmalar">
                <Droplets size={12} /> {field._count.irrigations}
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {!isReadOnly && !field.parentId && (
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => openCreateModal(field)}
                  title="Alt-sahə əlavə et"
                  style={{ color: '#10B981' }}
                >
                  <GitBranch size={14} />
                </button>
              )}
              {canEdit && (
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => openEditModal(field)}
                  title="Redaktə et"
                >
                  <Pencil size={14} />
                </button>
              )}
              {canDelete && (
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setDeleteConfirm(field.id)}
                  title="Sil"
                  style={{ color: 'var(--color-error)' }}
                >
                  <Trash2 size={14} />
                </button>
              )}
              {children.length > 0 && (
                <button
                  className="btn btn-ghost btn-icon"
                  onClick={() => setExpanded(p => ({ ...p, [field.id]: !isExp }))}
                  title={isExp ? 'Gizlət' : 'Alt-sahələri göstər'}
                >
                  {isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
              )}
            </div>
          </div>

          {/* Irrigation interval bar */}
          {field.irrigationIntervalDays && (
            <div style={{
              padding: '6px 16px 8px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 11,
              color: 'var(--text-tertiary)',
            }}>
              <Droplets size={10} style={{ color: '#3B82F6' }} />
              Suvarma intervalı: <strong>{field.irrigationIntervalDays} gün</strong>
            </div>
          )}
        </div>

        {/* Children */}
        {isExp && children.map(child => (
          <FieldCard key={child.id} field={child} indent={indent + 1} />
        ))}
      </div>
    );
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Sahələr (Pivotlar)</h1>
          <p className="page-description">
            {filtered.length} pivot · {fields.reduce((s, f) => s + f.hectares, 0).toFixed(2)} ha
          </p>
        </div>
        {!isReadOnly && (
          <button className="btn btn-primary" onClick={() => openCreateModal()}>
            <Plus size={18} /> Yeni sahə
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input className="form-input" placeholder="Axtar (nömrə, torpaq...)..." value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
          {farms.length > 1 && (
            <select className="form-select" style={{ flex: '0 1 200px' }}
              value={filterFarm} onChange={e => setFilterFarm(e.target.value)}>
              <option value="">Bütün təsərrüfatlar</option>
              {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}
          <select className="form-select" style={{ flex: '0 1 180px' }}
            value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">Bütün statuslar</option>
            <option value="ACTIVE">Aktiv</option>
            <option value="FALLOW">Dincə qoyulub</option>
          </select>
          {(searchTerm || filterFarm || filterStatus) && (
            <button className="btn btn-ghost" onClick={() => {
              setSearchTerm(''); setFilterFarm(''); setFilterStatus('');
            }} style={{ fontSize: 'var(--font-size-sm)' }}>
              <X size={14} /> Təmizlə
            </button>
          )}
        </div>
      </div>

      {/* Summary stats */}
      {fields.length > 0 && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
          {farms.map(farm => {
            const farmFields = filtered.filter(f => f.farmId === farm.id);
            if (farmFields.length === 0) return null;
            const totalHa = farmFields.reduce((s, f) => s + f.hectares, 0);
            return (
              <div key={farm.id} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                borderRadius: 10, padding: '10px 16px',
                display: 'flex', gap: 12, alignItems: 'center',
              }}>
                <Tractor size={16} style={{ color: 'var(--color-primary)' }} />
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{farm.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                    {farmFields.length} pivot · {totalHa.toFixed(2)} ha
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Field cards grouped by farm */}
      {rootFields.length === 0 ? (
        <div className="empty-state">
          <Activity size={48} className="empty-state-icon" />
          <h2 className="empty-state-title">
            {searchTerm || filterFarm || filterStatus ? 'Filtrə uyğun pivot tapılmadı' : 'Hələ pivot yoxdur'}
          </h2>
          {!isReadOnly && (
            <button className="btn btn-primary" onClick={() => openCreateModal()} style={{ marginTop: 12 }}>
              <Plus size={16} /> Yeni sahə
            </button>
          )}
        </div>
      ) : (
        Object.values(farmGroups).map(({ farm, fields: farmFields }) => (
          <div key={farm.id} style={{ marginBottom: 'var(--space-5)' }}>
            {/* Farm header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              marginBottom: 12, paddingBottom: 8,
              borderBottom: '2px solid var(--border-default)',
            }}>
              <Tractor size={18} style={{ color: 'var(--color-primary)' }} />
              <span style={{ fontWeight: 700, fontSize: 16 }}>{farm.name}</span>
              <span style={{ fontSize: 12, color: 'var(--text-tertiary)', marginLeft: 4 }}>
                {farmFields.length} pivot · {farmFields.reduce((s, f) => s + f.hectares, 0).toFixed(2)} ha
              </span>
            </div>
            {/* Cards grid */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {farmFields.map(field => (
                <FieldCard key={field.id} field={field} />
              ))}
            </div>
          </div>
        ))
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingField ? 'Sahəni redaktə et' : (formData.parentId ? 'Alt-sahə yarat' : 'Yeni sahə')}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              {formData.parentId && (
                <div style={{
                  background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)',
                  borderRadius: 8, padding: '10px 14px', marginBottom: 16,
                  display: 'flex', gap: 8, alignItems: 'center', fontSize: 13,
                }}>
                  <GitBranch size={14} style={{ color: '#10B981' }} />
                  Ana sahənin alt-sahəsi yaradılır
                </div>
              )}

              {/* Farm */}
              <div className="form-group">
                <label className="form-label">Təsərrüfat *</label>
                <select className="form-select" value={formData.farmId}
                  onChange={e => setFormData({ ...formData, farmId: e.target.value })}
                  required disabled={!!editingField || isAgronomist || !!formData.parentId}>
                  {isAgronomist ? (
                    farms.filter(f => f.id === userFarmId).map(f => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))
                  ) : (
                    <>
                      <option value="">Seçin...</option>
                      {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                    </>
                  )}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Sahə nömrəsi * (0.00 format)</label>
                  <input className="form-input"
                    placeholder={formData.parentId ? 'Məs: 1.1 → 1.10' : 'Məs: 1 → 1.00'}
                    value={formData.fieldNumber}
                    onChange={e => setFormData({ ...formData, fieldNumber: e.target.value })}
                    required />
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 3, display: 'block' }}>
                    Rəqəm formatı avtomatik 0.00-a çevrilir
                  </span>
                </div>
                <div className="form-group">
                  <label className="form-label">Hektar *</label>
                  <input className="form-input" type="number" step="0.01" placeholder="0.00"
                    value={formData.hectares}
                    onChange={e => setFormData({ ...formData, hectares: e.target.value })}
                    required />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Torpaq növü</label>
                  <input className="form-input" placeholder="Məs: Gillicəli"
                    value={formData.soilType}
                    onChange={e => setFormData({ ...formData, soilType: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Suvarma intervalı (gün)</label>
                  <input className="form-input" type="number" min="1" placeholder="Məs: 7"
                    value={formData.irrigationIntervalDays}
                    onChange={e => setFormData({ ...formData, irrigationIntervalDays: e.target.value })} />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Status</label>
                <select className="form-select" value={formData.status}
                  onChange={e => setFormData({ ...formData, status: e.target.value })}>
                  <option value="ACTIVE">Aktiv</option>
                  <option value="FALLOW">Dincə qoyulub</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Ləğv et</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> Saxlanılır...</> : (editingField ? 'Yadda saxla' : 'Yarat')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--color-error)' }}>
                <AlertCircle size={20} /> Sahəni sil
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(null)}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6, padding: '8px 0' }}>
              Bu sahəni silmək istəyirsinizmi? Bütün proseslər, suvarmalar və qeydlər silinəcək.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Ləğv et</button>
              <button className="btn btn-primary" style={{ background: 'var(--color-error)' }}
                onClick={() => handleDelete(deleteConfirm)}>
                <Trash2 size={16} /> Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
