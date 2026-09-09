'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Plus, X, Sprout, ChevronDown, ChevronUp, Trash2, Pencil,
  Search, Filter, Check, Clock, Leaf, Wheat, MapPin,
} from 'lucide-react';
import { format } from 'date-fns';
import { az } from 'date-fns/locale';

interface SeasonField {
  id: string;
  cropType: string;
  plantedArea: number | null;
  status: string;
  sowingDate: string | null;
  harvestDate: string | null;
  notes: string | null;
  field: { id: string; fieldNumber: string; hectares: number; farm: { name: string } };
}

interface Season {
  id: string;
  name: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  seasonFields: SeasonField[];
  _count: { seasonFields: number };
  totalPlantedHectares?: number;
  cropHectares?: Record<string, number>;
}

interface Field {
  id: string;
  fieldNumber: string;
  hectares: number;
  farm: { name: string };
}

const statusConfig: Record<string, { label: string; class: string; icon: any }> = {
  PLANNED: { label: 'Planlaşdırılıb', class: 'badge-warning', icon: Clock },
  ACTIVE: { label: 'Aktiv', class: 'badge-success', icon: Sprout },
  COMPLETED: { label: 'Tamamlanıb', class: 'badge-info', icon: Check },
};

const fieldStatusConfig: Record<string, { label: string; class: string }> = {
  PLANNED: { label: 'Planlaşdırılıb', class: 'badge-neutral' },
  SOWN: { label: 'Əkilib', class: 'badge-warning' },
  GROWING: { label: 'Böyüyür', class: 'badge-success' },
  HARVESTED: { label: 'Biçilib', class: 'badge-info' },
};

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedSeason, setExpandedSeason] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [newSeasonName, setNewSeasonName] = useState('');
  const [assignSeasonId, setAssignSeasonId] = useState('');
  const [assignData, setAssignData] = useState({
    fieldId: '', cropType: '', plantedArea: '', notes: '',
  });
  const [fieldSearch, setFieldSearch] = useState('');
  const [fieldDropOpen, setFieldDropOpen] = useState(false);

  const safeJson = async (r: Response, fb: any = []) => { try { return r.ok ? await r.json() : fb; } catch { return fb; } };

  const fetchData = async () => {
    const [sRes, fRes] = await Promise.all([fetch('/api/seasons'), fetch('/api/fields')]);
    setSeasons(await safeJson(sRes, []));
    setFields(await safeJson(fRes, []));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    if (!searchTerm) return seasons;
    const term = searchTerm.toLowerCase();
    return seasons.filter((s) =>
      s.name.toLowerCase().includes(term) ||
      s.seasonFields.some((sf) => sf.cropType.toLowerCase().includes(term) || sf.field.fieldNumber.toLowerCase().includes(term))
    );
  }, [seasons, searchTerm]);

  const handleCreateSeason = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch('/api/seasons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newSeasonName }),
    });
    setShowCreateModal(false);
    setNewSeasonName('');
    setSaving(false);
    fetchData();
  };

  const openAssignModal = (seasonId: string) => {
    setAssignSeasonId(seasonId);
    setAssignData({ fieldId: '', cropType: '', plantedArea: '', notes: '' });
    setFieldSearch('');
    setFieldDropOpen(false);
    setShowAssignModal(true);
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/seasons/${assignSeasonId}/fields`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fieldId: assignData.fieldId,
        cropType: assignData.cropType,
        plantedArea: assignData.plantedArea ? parseFloat(assignData.plantedArea) : null,
        notes: assignData.notes || null,
      }),
    });
    setShowAssignModal(false);
    setSaving(false);
    fetchData();
  };

  const updateFieldStatus = async (sfId: string, newStatus: string) => {
    const data: any = { status: newStatus };
    if (newStatus === 'SOWN') data.sowingDate = new Date().toISOString();
    if (newStatus === 'HARVESTED') data.harvestDate = new Date().toISOString();

    await fetch(`/api/seasons/fields/${sfId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    fetchData();
  };

  const removeFieldFromSeason = async (sfId: string) => {
    await fetch(`/api/seasons/fields/${sfId}`, { method: 'DELETE' });
    fetchData();
  };

  const handleDeleteSeason = async (id: string) => {
    await fetch(`/api/seasons/${id}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    fetchData();
  };

  const nextStatus = (current: string): string | null => {
    const flow: Record<string, string> = {
      PLANNED: 'SOWN', SOWN: 'GROWING', GROWING: 'HARVESTED',
    };
    return flow[current] || null;
  };

  // Mövsümə hələ təyin olunmamış sahələr
  const availableFields = (seasonId: string) => {
    const assigned = seasons.find((s) => s.id === seasonId)?.seasonFields.map((sf) => sf.field.id) || [];
    return fields.filter((f) => !assigned.includes(f.id));
  };

  if (loading) {
    return <div className="page-content"><div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Yüklənir...</div></div></div>;
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Mövsümlər</h1>
          <p className="page-description">Növbəli əkin sistemi — {seasons.length} mövsüm</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={18} /> Yeni mövsüm
        </button>
      </div>

      {/* Filtr */}
      {seasons.length > 0 && (
        <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
            <Filter size={18} style={{ color: 'var(--text-tertiary)' }} />
            <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 400 }}>
              <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input className="form-input" placeholder="Mövsüm, bitki və ya sahə axtar..." value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: 36 }} />
            </div>
            {searchTerm && (
              <button className="btn btn-ghost" onClick={() => setSearchTerm('')} style={{ fontSize: 'var(--font-size-sm)' }}>
                <X size={14} /> Təmizlə
              </button>
            )}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="empty-state">
          <Calendar size={64} className="empty-state-icon" />
          <h2 className="empty-state-title">{searchTerm ? 'Filtrə uyğun mövsüm tapılmadı' : 'Mövsüm yoxdur'}</h2>
          <p className="empty-state-description">
            {searchTerm ? 'Axtarışı dəyişin' : 'Yeni mövsüm yaradın və sahələrə bitki təyin edin.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {filtered.map((season) => {
            const isExpanded = expandedSeason === season.id;
            const StatusIcon = statusConfig[season.status]?.icon || Clock;

            return (
              <div key={season.id} className="card">
                {/* Mövsüm başlığı */}
                <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setExpandedSeason(isExpanded ? null : season.id)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flex: 1 }}>
                    <div className="stat-card-icon green" style={{ width: 40, height: 40 }}>
                      <StatusIcon size={20} />
                    </div>
                    <div>
                      <h3 className="card-title">{season.name}</h3>
                      <div className="card-subtitle" style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                        <span className={`badge ${statusConfig[season.status]?.class || 'badge-neutral'}`}>
                          {statusConfig[season.status]?.label || season.status}
                        </span>
                        <span>{season._count.seasonFields} sahə</span>
                        {season.totalPlantedHectares !== undefined && (
                          <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>
                            {season.totalPlantedHectares.toFixed(1)} ha
                          </span>
                        )}
                        {season.cropHectares && Object.entries(season.cropHectares).map(([crop, ha]) => (
                          <span key={crop} style={{ fontSize: '11px', padding: '2px 6px', background: 'var(--bg-card-hover)', borderRadius: 4 }}>
                            {crop}: {ha.toFixed(1)} ha
                          </span>
                        ))}
                        {season.startDate && (
                          <span>{format(new Date(season.startDate), 'dd.MM.yyyy')}</span>
                        )}
                        {season.endDate && (
                          <span>— {format(new Date(season.endDate), 'dd.MM.yyyy')}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-1)', alignItems: 'center' }}>
                    <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); setDeleteConfirm(season.id); }}
                      title="Sil" style={{ color: 'var(--color-error)' }}>
                      <Trash2 size={16} />
                    </button>
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                  </div>
                </div>

                {/* Genişlənmiş panel */}
                {isExpanded && (
                  <div style={{ padding: 'var(--space-4)', borderTop: '1px solid var(--border-primary)' }}>
                    {/* Mövsümün sahələri */}
                    {season.seasonFields.length > 0 ? (
                      <div className="table-container" style={{ marginBottom: 'var(--space-4)' }}>
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Sahə</th>
                              <th>Təsərrüfat</th>
                              <th>Bitki</th>
                              <th>Əkilən sahə</th>
                              <th>Status</th>
                              <th>Tarixlər</th>
                              <th>Əməliyyat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {season.seasonFields.map((sf) => {
                              const ns = nextStatus(sf.status);
                              return (
                                <tr key={sf.id}>
                                  <td style={{ fontWeight: 600 }}>#{sf.field.fieldNumber}</td>
                                  <td>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <MapPin size={12} /> {sf.field.farm.name}
                                    </span>
                                  </td>
                                  <td>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Wheat size={14} style={{ color: 'var(--color-warning)' }} />
                                      {sf.cropType}
                                    </span>
                                  </td>
                                  <td>{sf.plantedArea ? `${sf.plantedArea} ha` : `${sf.field.hectares} ha`}</td>
                                  <td>
                                    <span className={`badge ${fieldStatusConfig[sf.status]?.class || 'badge-neutral'}`}>
                                      {fieldStatusConfig[sf.status]?.label || sf.status}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)' }}>
                                    {sf.sowingDate && <span>Əkin: {format(new Date(sf.sowingDate), 'dd.MM.yy')}</span>}
                                    {sf.sowingDate && sf.harvestDate && <span> · </span>}
                                    {sf.harvestDate && <span>Biçin: {format(new Date(sf.harvestDate), 'dd.MM.yy')}</span>}
                                    {!sf.sowingDate && !sf.harvestDate && '—'}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                                      {ns && (
                                        <button className="btn btn-ghost" onClick={() => updateFieldStatus(sf.id, ns)}
                                          style={{ fontSize: 'var(--font-size-xs)', padding: '4px 8px' }}>
                                          → {fieldStatusConfig[ns]?.label}
                                        </button>
                                      )}
                                      <button className="btn btn-ghost btn-icon" onClick={() => removeFieldFromSeason(sf.id)}
                                        title="Çıxar" style={{ color: 'var(--color-error)' }}>
                                        <X size={14} />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)', marginBottom: 'var(--space-4)' }}>
                        Bu mövsümə hələ sahə təyin edilməyib.
                      </p>
                    )}

                    {/* Sahə əlavə et düyməsi */}
                    {season.status !== 'COMPLETED' && (
                      <button className="btn btn-secondary" onClick={() => openAssignModal(season.id)}>
                        <Leaf size={16} /> Sahə təyin et
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Yeni mövsüm modalı */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title">Yeni mövsüm</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreateModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateSeason}>
              <div className="form-group">
                <label className="form-label">Mövsüm adı *</label>
                <input className="form-input" placeholder="Məs: 2025 Yaz mövsümü" value={newSeasonName}
                  onChange={(e) => setNewSeasonName(e.target.value)} required />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Ləğv et</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> Yaradılır...</> : 'Yarat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sahə təyin et modalı */}
      {showAssignModal && (
        <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="modal-header">
              <h2 className="modal-title">Mövsümə sahə təyin et</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAssignModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleAssign}>
              <div className="form-group" style={{ position: 'relative' }}>
                <label className="form-label">Sahə (Pivot) *</label>
                {/* Seçilmiş sahəni göstər */}
                {assignData.fieldId ? (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px', border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius)', background: 'rgba(16,185,129,0.08)',
                    fontSize: 'var(--font-size-sm)', cursor: 'pointer',
                  }} onClick={() => { setAssignData({ ...assignData, fieldId: '' }); setFieldSearch(''); setFieldDropOpen(true); }}>
                    <Check size={14} color="var(--color-success)" />
                    <span style={{ flex: 1 }}>
                      {(() => {
                        const f = fields.find(x => x.id === assignData.fieldId);
                        return f ? `${f.farm.name} — #${f.fieldNumber} (${f.hectares} ha)` : '';
                      })()}
                    </span>
                    <X size={14} style={{ opacity: 0.5 }} />
                  </div>
                ) : (
                  <div style={{ position: 'relative' }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', pointerEvents: 'none' }} />
                    <input
                      className="form-input"
                      style={{ paddingLeft: 32 }}
                      placeholder="Sahə nömrəsi və ya təsərrüfat axtar..."
                      value={fieldSearch}
                      autoFocus
                      onChange={e => { setFieldSearch(e.target.value); setFieldDropOpen(true); }}
                      onFocus={() => setFieldDropOpen(true)}
                      onBlur={() => setTimeout(() => setFieldDropOpen(false), 150)}
                    />
                  </div>
                )}
                {/* Axtarış dropdown */}
                {fieldDropOpen && !assignData.fieldId && (() => {
                  const term = fieldSearch.toLowerCase();
                  const list = availableFields(assignSeasonId).filter(f =>
                    !term ||
                    f.fieldNumber.toLowerCase().includes(term) ||
                    f.farm.name.toLowerCase().includes(term)
                  );
                  return (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100,
                      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
                      maxHeight: 220, overflowY: 'auto', marginTop: 2,
                    }}>
                      {list.length === 0 ? (
                        <div style={{ padding: '10px 14px', fontSize: 'var(--font-size-sm)', color: 'var(--text-tertiary)' }}>
                          Uyğun sahə tapılmadı
                        </div>
                      ) : list.map(f => (
                        <div
                          key={f.id}
                          onMouseDown={() => {
                            setAssignData({ ...assignData, fieldId: f.id });
                            setFieldSearch('');
                            setFieldDropOpen(false);
                          }}
                          style={{
                            padding: '9px 14px', cursor: 'pointer', fontSize: 'var(--font-size-sm)',
                            display: 'flex', alignItems: 'center', gap: 8,
                            borderBottom: '1px solid var(--border-light)',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}
                        >
                          <MapPin size={13} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
                          <div>
                            <span style={{ fontWeight: 600 }}>#{f.fieldNumber}</span>
                            <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>{f.farm.name}</span>
                            <span style={{ color: 'var(--text-tertiary)', marginLeft: 6 }}>{f.hectares} ha</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Bitki növü *</label>
                  <input className="form-input" placeholder="Məs: Buğda" value={assignData.cropType}
                    onChange={(e) => setAssignData({ ...assignData, cropType: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Əkilən sahə (ha)</label>
                  <input className="form-input" type="number" step="0.1" placeholder="Tam sahə üçün boş buraxın"
                    value={assignData.plantedArea}
                    onChange={(e) => setAssignData({ ...assignData, plantedArea: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Qeydlər</label>
                <textarea className="form-textarea" placeholder="Əlavə qeydlər..."
                  value={assignData.notes} onChange={(e) => setAssignData({ ...assignData, notes: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Ləğv et</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> Təyin edilir...</> : 'Təyin et'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Mövsüm sil */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--color-error)' }}>Mövsümü sil</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(null)}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Bu mövsümü və ona təyin edilmiş bütün sahə məlumatlarını silmək istədiyinizə əminsiniz?
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Ləğv et</button>
              <button className="btn btn-primary" style={{ background: 'var(--color-error)' }} onClick={() => handleDeleteSeason(deleteConfirm)}>
                <Trash2 size={16} /> Sil
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
