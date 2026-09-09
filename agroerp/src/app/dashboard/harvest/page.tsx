'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  TrendingUp, Plus, X, Trash2, ChevronDown, ChevronRight,
  Wheat, Scale, Droplets, Truck, Award, Calendar, CheckCircle2,
  BarChart3, Filter, Download, Leaf,
} from 'lucide-react';
import { format } from 'date-fns';
import { az } from 'date-fns/locale';
import { useToast } from '@/components/Toast';
import { compareFieldNumbers } from '@/lib/naturalSort';

// ─── Types ───────────────────────────────────────────────────────
interface HarvestRecord {
  id: string;
  harvestDate: string;
  cropType: string;
  yieldTons: number;
  moisturePercent: number | null;
  qualityGrade: string | null;
  truckCount: number | null;
  notes: string | null;
  field: { fieldNumber: string; hectares: number; farm: { name: string } };
  seasonField: { cropType: string; season: { name: string } } | null;
  user: { fullName: string };
}

interface Field {
  id: string;
  fieldNumber: string;
  hectares: number;
  farm: { name: string };
  seasonFields: { cropType: string; season: { status: string } }[];
}

// ─── Constants ───────────────────────────────────────────────────
const CROP_PALETTE = [
  { color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  { color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  { color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
  { color: '#06B6D4', bg: 'rgba(6,182,212,0.15)' },
];
const CROP_COLORS: Record<string, { color: string; bg: string }> = {};
function getCropColor(crop: string) {
  if (!CROP_COLORS[crop]) {
    const idx = Object.keys(CROP_COLORS).length % CROP_PALETTE.length;
    CROP_COLORS[crop] = CROP_PALETTE[idx];
  }
  return CROP_COLORS[crop];
}

const QUALITY_CFG: Record<string, { label: string; color: string }> = {
  A: { label: 'A — Premium',  color: '#10B981' },
  B: { label: 'B — Standart', color: '#F59E0B' },
  C: { label: 'C — Aşağı',    color: '#EF4444' },
};

export default function HarvestPage() {
  const { showToast } = useToast();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [filterCrop, setFilterCrop] = useState('ALL');
  const [records, setRecords] = useState<HarvestRecord[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [expandedCrops, setExpandedCrops] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState({
    fieldId: '',
    harvestDate: format(now, 'yyyy-MM-dd'),
    cropType: '',
    yieldTons: '',
    moisturePercent: '',
    qualityGrade: 'A',
    truckCount: '',
    notes: '',
  });

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [rRes, fRes] = await Promise.all([
        fetch(`/api/harvest?year=${viewYear}`),
        fetch('/api/fields'),
      ]);
      if (rRes.ok) setRecords(await rRes.json());
      if (fRes.ok) setFields(await fRes.json());
    } finally { setLoading(false); }
  }, [viewYear]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-fill cropType from field selection
  const handleFieldChange = (fieldId: string) => {
    const field = fields.find(f => f.id === fieldId);
    const activeCrop = field?.seasonFields.find(sf =>
      sf.season.status === 'ACTIVE' || sf.season.status === 'PLANNED'
    )?.cropType || '';
    setForm(f => ({ ...f, fieldId, cropType: activeCrop }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fieldId || !form.harvestDate || !form.cropType || !form.yieldTons) {
      showToast('Bütün məcburi sahələri doldurun', 'error'); return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/harvest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Yığım qeyd edildi', 'success');
      setShowModal(false);
      setForm({ fieldId: '', harvestDate: format(now, 'yyyy-MM-dd'), cropType: '', yieldTons: '', moisturePercent: '', qualityGrade: 'A', truckCount: '', notes: '' });
      fetchAll();
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const deleteRecord = async (id: string) => {
    await fetch(`/api/harvest/${id}`, { method: 'DELETE' });
    showToast('Silindi', 'success'); fetchAll();
  };

  // ─── Computed ────────────────────────────────────────────────
  const cropTypes = useMemo(() => [...new Set(records.map(r => r.cropType))].sort(), [records]);

  const filtered = useMemo(() =>
    filterCrop === 'ALL' ? records : records.filter(r => r.cropType === filterCrop),
    [records, filterCrop]
  );

  const byField = useMemo(() => {
    const map: Record<string, { fieldNumber: string; farmName: string; hectares: number; items: HarvestRecord[] }> = {};
    for (const r of filtered) {
      if (!map[r.field.fieldNumber]) {
        map[r.field.fieldNumber] = { fieldNumber: r.field.fieldNumber, farmName: r.field.farm.name, hectares: r.field.hectares, items: [] };
      }
      map[r.field.fieldNumber].items.push(r);
    }
    return Object.values(map).sort((a, b) => compareFieldNumbers(a.fieldNumber, b.fieldNumber));
  }, [filtered]);

  const byCrop = useMemo(() => {
    const map: Record<string, { crop: string; totalTons: number; totalHa: number; count: number; items: HarvestRecord[] }> = {};
    for (const r of filtered) {
      if (!map[r.cropType]) map[r.cropType] = { crop: r.cropType, totalTons: 0, totalHa: 0, count: 0, items: [] };
      map[r.cropType].totalTons += r.yieldTons;
      map[r.cropType].totalHa += r.field.hectares;
      map[r.cropType].count++;
      map[r.cropType].items.push(r);
    }
    return Object.values(map).sort((a, b) => b.totalTons - a.totalTons);
  }, [filtered]);

  const totalTons = filtered.reduce((s, r) => s + r.yieldTons, 0);
  const totalHa   = filtered.reduce((s, r) => s + r.field.hectares, 0);
  const avgYield  = totalHa > 0 ? totalTons / totalHa : 0;

  if (loading) return (
    <div className="page-content">
      <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Yüklənir...</div></div>
    </div>
  );

  return (
    <div className="page-content">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <TrendingUp size={22} style={{ marginRight: 10, verticalAlign: 'text-bottom', color: '#10B981' }} />
            Yığım Uçotu
          </h1>
          <p className="page-description">
            {viewYear} · {records.length} qeyd · {totalTons.toFixed(1)} ton · {avgYield.toFixed(2)} t/ha ortalama
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Year nav */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '4px 8px' }}>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewYear(y => y - 1)}>‹</button>
            <span style={{ fontWeight: 700, fontSize: 14, minWidth: 36, textAlign: 'center' }}>{viewYear}</span>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setViewYear(y => y + 1)}>›</button>
          </div>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            <Plus size={16} /> Yığım Qeydi
          </button>
        </div>
      </div>

      {/* ── KPI Stats ───────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-5)' }}>
        {[
          { icon: <Scale size={20} />, val: `${totalTons.toFixed(1)} t`, label: 'Ümumi yığım', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
          { icon: <Leaf size={20} />, val: `${avgYield.toFixed(2)} t/ha`, label: 'Orta məhsuldarlıq', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
          { icon: <Wheat size={20} />, val: cropTypes.length, label: 'Bitki növü', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
          { icon: <CheckCircle2 size={20} />, val: records.length, label: 'Yığım qeydi', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
        ].map((s, i) => (
          <div key={i} className="stat-card">
            <div className="stat-icon" style={{ background: s.bg }}>
              <span style={{ color: s.color }}>{s.icon}</span>
            </div>
            <div className="stat-content">
              <div className="stat-value">{s.val}</div>
              <div className="stat-label">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Crop Filter ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
        padding: '8px 14px', border: '1px solid var(--border-primary)',
        marginBottom: 'var(--space-4)',
      }}>
        <Filter size={14} style={{ color: 'var(--text-tertiary)' }} />
        <button
          onClick={() => setFilterCrop('ALL')}
          style={{
            padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
            background: filterCrop === 'ALL' ? 'var(--color-primary)' : 'var(--bg-tertiary)',
            color: filterCrop === 'ALL' ? 'white' : 'var(--text-secondary)',
            fontWeight: 600, fontSize: 12,
          }}
        >
          Hamısı ({records.length})
        </button>
        {cropTypes.map(crop => {
          const cc = getCropColor(crop);
          const count = records.filter(r => r.cropType === crop).length;
          return (
            <button key={crop}
              onClick={() => setFilterCrop(crop === filterCrop ? 'ALL' : crop)}
              style={{
                padding: '4px 12px', borderRadius: 20, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: `2px solid ${filterCrop === crop ? cc.color : 'transparent'}`,
                background: filterCrop === crop ? cc.bg : 'var(--bg-tertiary)',
                color: filterCrop === crop ? cc.color : 'var(--text-secondary)',
              }}
            >
              {crop} ({count})
            </button>
          );
        })}
      </div>

      {/* ── By Crop Summary (click-to-expand) ───────────────────── */}
      <div style={{ marginBottom: 'var(--space-5)' }}>
        {byCrop.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
            Bu il üçün yığım qeydi yoxdur
          </div>
        ) : byCrop.map(group => {
          const cc = getCropColor(group.crop);
          const isOpen = expandedCrops[group.crop] ?? false;
          const avgGrp = group.totalHa > 0 ? group.totalTons / group.totalHa : 0;

          return (
            <div key={group.crop} style={{ marginBottom: 'var(--space-3)' }}>
              {/* Group header — clickable to expand */}
              <div
                onClick={() => setExpandedCrops(e => ({ ...e, [group.crop]: !e[group.crop] }))}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                  background: cc.bg, borderRadius: isOpen ? 'var(--radius-md) var(--radius-md) 0 0' : 'var(--radius-md)',
                  border: `1px solid ${cc.color}30`, cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ color: cc.color }}>{isOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</span>
                <Wheat size={18} style={{ color: cc.color }} />
                <span style={{ fontWeight: 800, fontSize: 16, color: cc.color, flex: 1 }}>{group.crop}</span>
                <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{group.count} qeyd</span>
                  <span style={{ fontWeight: 700, color: cc.color }}>{group.totalTons.toFixed(1)} ton</span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>{avgGrp.toFixed(2)} t/ha</span>
                </div>
              </div>

              {/* Expanded table */}
              {isOpen && (
                <div className="card" style={{ padding: 0, overflow: 'hidden', borderRadius: '0 0 var(--radius-md) var(--radius-md)', borderTop: 'none' }}>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Sahə</th><th>Tarix</th><th>Yığım (ton)</th>
                          <th>t/ha</th><th>Rütubət</th><th>Keyfiyyət</th>
                          <th>Maşın</th><th>Qeyd</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map(r => {
                          const tonPerHa = r.field.hectares > 0 ? r.yieldTons / r.field.hectares : 0;
                          const qc = r.qualityGrade ? QUALITY_CFG[r.qualityGrade] : null;
                          return (
                            <tr key={r.id}>
                              <td style={{ fontWeight: 700 }}>
                                <div>Pivot {r.field.fieldNumber}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{r.field.farm.name} · {r.field.hectares}ha</div>
                              </td>
                              <td style={{ whiteSpace: 'nowrap' }}>{format(new Date(r.harvestDate), 'dd MMM yyyy', { locale: az })}</td>
                              <td style={{ fontWeight: 800, color: cc.color }}>{r.yieldTons.toFixed(2)} t</td>
                              <td style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{tonPerHa.toFixed(2)}</td>
                              <td>{r.moisturePercent ? `${r.moisturePercent}%` : '—'}</td>
                              <td>
                                {qc ? (
                                  <span style={{ fontWeight: 700, color: qc.color, fontSize: 12 }}>{qc.label}</span>
                                ) : '—'}
                              </td>
                              <td>{r.truckCount ? `${r.truckCount} maşın` : '—'}</td>
                              <td style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 140 }}>{r.notes || '—'}</td>
                              <td>
                                <button className="btn btn-ghost btn-icon" onClick={() => deleteRecord(r.id)} style={{ color: 'var(--color-error)' }}>
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── MODAL: Yeni Yığım ───────────────────────────────────── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2 className="modal-title"><TrendingUp size={18} style={{ color: '#10B981' }} /> Yığım Qeydi</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  {/* Field */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Sahə *</label>
                    <select className="form-input" required value={form.fieldId}
                      onChange={e => handleFieldChange(e.target.value)}>
                      <option value="">Sahə seçin</option>
                      {fields.map(f => (
                        <option key={f.id} value={f.id}>
                          Pivot {f.fieldNumber} — {f.farm.name} ({f.hectares}ha)
                        </option>
                      ))}
                    </select>
                  </div>
                  {/* Date */}
                  <div className="form-group">
                    <label className="form-label">Yığım tarixi *</label>
                    <input type="date" className="form-input" required
                      value={form.harvestDate} onChange={e => setForm(f => ({ ...f, harvestDate: e.target.value }))} />
                  </div>
                  {/* Crop */}
                  <div className="form-group">
                    <label className="form-label">Bitki növü *</label>
                    <input className="form-input" placeholder="Buğda, Arpa..." required
                      value={form.cropType} onChange={e => setForm(f => ({ ...f, cropType: e.target.value }))} />
                  </div>
                  {/* Yield */}
                  <div className="form-group">
                    <label className="form-label">Yığım (ton) *</label>
                    <input type="number" className="form-input" placeholder="0.00" step="0.01" required
                      value={form.yieldTons} onChange={e => setForm(f => ({ ...f, yieldTons: e.target.value }))} />
                  </div>
                  {/* Moisture */}
                  <div className="form-group">
                    <label className="form-label">Rütubət (%)</label>
                    <input type="number" className="form-input" placeholder="13.5" step="0.1"
                      value={form.moisturePercent} onChange={e => setForm(f => ({ ...f, moisturePercent: e.target.value }))} />
                  </div>
                  {/* Quality */}
                  <div className="form-group">
                    <label className="form-label">Keyfiyyət</label>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {(['A', 'B', 'C'] as const).map(g => (
                        <button key={g} type="button"
                          onClick={() => setForm(f => ({ ...f, qualityGrade: g }))}
                          style={{
                            flex: 1, padding: '8px', borderRadius: 8, cursor: 'pointer',
                            background: form.qualityGrade === g ? QUALITY_CFG[g].color + '25' : 'var(--bg-tertiary)',
                            color: form.qualityGrade === g ? QUALITY_CFG[g].color : 'var(--text-secondary)',
                            fontWeight: 700, fontSize: 13,
                            border: `2px solid ${form.qualityGrade === g ? QUALITY_CFG[g].color : 'transparent'}`,
                          }}
                        >
                          {g}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Trucks */}
                  <div className="form-group">
                    <label className="form-label">Maşın sayı</label>
                    <input type="number" className="form-input" placeholder="0" min="0"
                      value={form.truckCount} onChange={e => setForm(f => ({ ...f, truckCount: e.target.value }))} />
                  </div>
                  {/* Notes */}
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Qeyd</label>
                    <textarea className="form-input" rows={2} style={{ resize: 'none' }}
                      value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Ləğv</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner spinner-sm" /> : <TrendingUp size={15} />}
                  Yığımı qeyd et
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
