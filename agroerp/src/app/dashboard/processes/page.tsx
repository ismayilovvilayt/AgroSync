'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Cog, Plus, X, Search, Pencil, Trash2, Check, ChevronDown, ChevronRight,
  Tractor, Sprout, Droplets, Bug, Wheat, Package, Wrench, Settings2,
  Calendar, Filter, AlertTriangle, Layers, Hash, ClipboardList, FileDown, MapPin,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { az } from 'date-fns/locale';
import { useToast } from '@/components/Toast';
import { compareFieldNumbers } from '@/lib/naturalSort';

// ─── Types ─────────────────────────────────────────────────────────────
interface Farm { id: string; name: string; }
interface Field {
  id: string; fieldNumber: string; hectares: number;
  farm: Farm; farmId: string;
  seasonFields?: SeasonFieldBrief[];
}
interface SeasonFieldBrief {
  id: string; cropType: string; status: string;
  season: { id: string; name: string; status: string };
}
interface OperationCategory {
  id: string; name: string; sortOrder: number;
  processes: OperationProcess[];
  _count?: { agroProcesses: number };
}
interface OperationProcess {
  id: string; name: string; categoryId: string; sortOrder: number;
}
interface Aggregate {
  id: string; name: string; type: string | null; plateNumber?: string | null;
}
interface WarehouseItem {
  id: string; name: string; unit: string; currentStock: number; category: string;
}
interface AgroProcessMaterial {
  id: string; warehouseItemId: string; quantity: number; ratePerHa: number | null;
  warehouseItem: WarehouseItem;
}
interface AgroProcess {
  id: string; fieldId: string; processDate: string;
  areaProcessed: number | null; processType: string;
  description: string | null; notes: string | null; status: string;
  field: { fieldNumber: string; hectares: number; farm: Farm };
  user: { fullName: string };
  category: { id: string; name: string } | null;
  process: { id: string; name: string } | null;
  aggregate: { id: string; name: string; type: string | null } | null;
  tractor: { id: string; name: string; type: string | null; plateNumber: string | null } | null;
  seasonField: { id: string; cropType: string; status: string; season: { id: string; name: string } } | null;
  materials: AgroProcessMaterial[];
  operationSeqNumber?: number | null;
}

// ─── Constants ──────────────────────────────────────────────────────────
const CAT_ICONS: Record<string, React.ReactNode> = {
  'Torpaq hazırlığı': <Tractor size={14} />,
  'Toxum səpini': <Sprout size={14} />,
  'Kimyəvi mübarizə': <Bug size={14} />,
  'Gübrələmə': <Droplets size={14} />,
  'Biçin': <Wheat size={14} />,
};
const CAT_COLORS: Record<string, string> = {
  'Torpaq hazırlığı': '#F59E0B',
  'Toxum səpini': '#10B981',
  'Kimyəvi mübarizə': '#EF4444',
  'Gübrələmə': '#3B82F6',
  'Biçin': '#8B5CF6',
};
const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  PLANNED: { label: 'Plan', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  IN_PROGRESS: { label: 'Davam edir', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  COMPLETED: { label: 'Tamamlanıb', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
};

// ─── MaterialRow component ─────────────────────────────────────────────
interface MaterialRowInput {
  warehouseItemId: string; quantity: string; ratePerHa: string;
}

// ─── Main Page ──────────────────────────────────────────────────────────
export default function ProcessesPage() {
  const { showToast } = useToast();
  const now = new Date();

  // Data
  const [processes, setProcesses] = useState<AgroProcess[]>([]);
  const [fields, setFields] = useState<Field[]>([]);
  const [categories, setCategories] = useState<OperationCategory[]>([]);
  const [aggregates, setAggregates] = useState<Aggregate[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [showModal, setShowModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAggModal, setShowAggModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form
  const [form, setForm] = useState({
    fieldId: '', categoryId: '', processId: '', aggregateId: '', tractorId: '',
    seasonFieldId: '', processDate: format(now, 'yyyy-MM-dd'),
    areaProcessed: '', description: '', notes: '', status: 'COMPLETED',
  });
  const [formMaterials, setFormMaterials] = useState<MaterialRowInput[]>([]);
  const [fieldSearch, setFieldSearch] = useState('');
  const [fieldDropOpen, setFieldDropOpen] = useState(false);

  // Config form
  const [newCatName, setNewCatName] = useState('');
  const [newProcNames, setNewProcNames] = useState<Record<string, string>>({});
  const [newAggName, setNewAggName] = useState('');
  const [newAggType, setNewAggType] = useState('');
  const [newAggPlate, setNewAggPlate] = useState('');

  // ─── Fetch ────────────────────────────────────────────────────────────
  const safeJson = async (res: Response, fallback: any = []) => {
    try {
      if (!res.ok) { console.error(`API ${res.url} → ${res.status}`); return fallback; }
      return await res.json();
    } catch { return fallback; }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, fRes, cRes, aRes, wRes] = await Promise.all([
        fetch('/api/processes'),
        fetch('/api/fields'),
        fetch('/api/operation-categories'),
        fetch('/api/aggregates'),
        fetch('/api/warehouse'),
      ]);
      setProcesses(await safeJson(pRes, []));
      const fieldsData = await safeJson(fRes, []);
      setFields(fieldsData);
      setCategories(await safeJson(cRes, []));
      setAggregates(await safeJson(aRes, []));
      // warehouse endpoint returns warehouses[] with nested items
      const wData = await safeJson(wRes, []);
      const allItems: WarehouseItem[] = [];
      if (Array.isArray(wData)) {
        for (const wh of wData) {
          if (wh.items) allItems.push(...wh.items);
        }
      }
      setWarehouseItems(allItems);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ─── Computed ─────────────────────────────────────────────────────────
  const sortedFields = useMemo(() =>
    [...fields].sort((a, b) => {
      const fc = (a.farm?.name || '').localeCompare(b.farm?.name || '');
      return fc !== 0 ? fc : compareFieldNumbers(a.fieldNumber, b.fieldNumber);
    }),
    [fields]
  );

  // Aktiv season field: sahə seçildikdə avtomatik tap
  const getActiveSeasonField = (fieldId: string): SeasonFieldBrief | null => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field?.seasonFields?.length) return null;
    // HARVESTED olmayan, aktiv sezonda olan
    const active = field.seasonFields.find((sf) =>
      sf.status !== 'HARVESTED' && (sf.season.status === 'ACTIVE' || sf.season.status === 'PLANNED')
    );
    return active || field.seasonFields[0] || null;
  };

  // Eyni sahə+kateqoriya neçə dəfə?
  const getOperationCount = (fieldId: string, categoryId: string): number => {
    return processes.filter((p) => p.fieldId === fieldId && p.category?.id === categoryId).length;
  };

  // Seçilmiş kateqoriyaya bağlı proseslər
  const selectedCatProcesses = useMemo(() => {
    if (!form.categoryId) return [];
    const cat = categories.find((c) => c.id === form.categoryId);
    return cat?.processes || [];
  }, [form.categoryId, categories]);

  // Filter
  const filtered = useMemo(() => {
    return processes.filter((p) => {
      if (filterCategory && p.category?.id !== filterCategory) return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        return (
          p.field.fieldNumber.toLowerCase().includes(t) ||
          p.field.farm.name.toLowerCase().includes(t) ||
          p.description?.toLowerCase().includes(t) ||
          p.category?.name.toLowerCase().includes(t) ||
          p.process?.name.toLowerCase().includes(t) ||
          p.aggregate?.name.toLowerCase().includes(t) ||
          p.tractor?.name.toLowerCase().includes(t) ||
          p.user.fullName.toLowerCase().includes(t) ||
          p.materials.some((m) => m.warehouseItem.name.toLowerCase().includes(t))
        );
      }
      return true;
    });
  }, [processes, filterCategory, filterStatus, searchTerm]);

  // ─── Handlers ─────────────────────────────────────────────────────────
  const onFieldChange = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    const sf = getActiveSeasonField(fieldId);
    setForm((prev) => ({
      ...prev,
      fieldId,
      areaProcessed: field ? String(field.hectares) : '',
      seasonFieldId: sf?.id || '',
    }));
  };

  const addMaterialRow = () => {
    setFormMaterials((prev) => [...prev, { warehouseItemId: '', quantity: '', ratePerHa: '' }]);
  };

  const removeMaterialRow = (idx: number) => {
    setFormMaterials((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateMaterial = (idx: number, key: keyof MaterialRowInput, val: string) => {
    setFormMaterials((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [key]: val };
      // Auto-calc ratePerHa when quantity changes and areaProcessed is set
      if (key === 'quantity' && form.areaProcessed) {
        const q = parseFloat(val);
        const a = parseFloat(form.areaProcessed);
        if (q > 0 && a > 0) {
          updated[idx].ratePerHa = (q / a).toFixed(2);
        }
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const materials = formMaterials
        .filter((m) => m.warehouseItemId && m.quantity)
        .map((m) => ({
          warehouseItemId: m.warehouseItemId,
          quantity: parseFloat(m.quantity),
          ratePerHa: m.ratePerHa ? parseFloat(m.ratePerHa) : undefined,
        }));

      const res = await fetch('/api/processes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, materials }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Proses qeyd edildi', 'success');
      setShowModal(false);
      setForm({
        fieldId: '', categoryId: '', processId: '', aggregateId: '', tractorId: '',
        seasonFieldId: '', processDate: format(now, 'yyyy-MM-dd'),
        areaProcessed: '', description: '', notes: '', status: 'COMPLETED',
      });
      setFormMaterials([]);
      setFieldSearch('');
      setFieldDropOpen(false);
      fetchAll();
    } catch (err: any) {
      showToast(err.message || 'Xəta', 'error');
    } finally {
      setSaving(false);
    }
  };

  const deleteProcess = async (id: string) => {
    try {
      await fetch(`/api/processes/${id}`, { method: 'DELETE' });
      showToast('Proses silindi (anbar stoku geri qaytarıldı)', 'success');
      setDeleteConfirm(null);
      fetchAll();
    } catch {
      showToast('Silmə xətası', 'error');
    }
  };

  // Config handlers
  const addCategory = async () => {
    if (!newCatName.trim()) return;
    await fetch('/api/operation-categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newCatName }),
    });
    setNewCatName('');
    const res = await fetch('/api/operation-categories');
    setCategories(await res.json());
    showToast('Əməliyyat əlavə edildi', 'success');
  };

  const deleteCategory = async (id: string) => {
    await fetch(`/api/operation-categories/${id}`, { method: 'DELETE' });
    const res = await fetch('/api/operation-categories');
    setCategories(await res.json());
    showToast('Silindi', 'success');
  };

  const addProcess = async (catId: string) => {
    const name = newProcNames[catId]?.trim();
    if (!name) return;
    await fetch(`/api/operation-categories/${catId}/processes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    setNewProcNames((prev) => ({ ...prev, [catId]: '' }));
    const res = await fetch('/api/operation-categories');
    setCategories(await res.json());
    showToast('Proses əlavə edildi', 'success');
  };

  const deleteProcessDef = async (catId: string, procId: string) => {
    await fetch(`/api/operation-categories/${catId}/processes?processId=${procId}`, { method: 'DELETE' });
    const res = await fetch('/api/operation-categories');
    setCategories(await res.json());
    showToast('Silindi', 'success');
  };

  const addAggregate = async () => {
    if (!newAggName.trim()) return;
    await fetch('/api/aggregates', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newAggName, type: newAggType || null, plateNumber: newAggPlate || null }),
    });
    setNewAggName(''); setNewAggType(''); setNewAggPlate('');
    const res = await fetch('/api/aggregates');
    setAggregates(await res.json());
    showToast('Texnika əlavə edildi', 'success');
  };

  const deleteAggregate = async (id: string) => {
    await fetch(`/api/aggregates/${id}`, { method: 'DELETE' });
    const res = await fetch('/api/aggregates');
    setAggregates(await res.json());
    showToast('Silindi', 'success');
  };

  // ─── Loading ──────────────────────────────────────────────────────────
  if (loading) return (
    <div className="page-content">
      <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Yüklənir...</div></div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="page-content">

      {/* ── Header ──────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 16, marginBottom: 24,
        padding: '20px 24px', borderRadius: 'var(--radius-lg)',
        background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(139,92,246,0.06) 50%, rgba(16,185,129,0.04) 100%)',
        border: '1px solid var(--border-primary)',
      }}>
        <div>
          <h1 style={{
            fontSize: 22, fontWeight: 800, color: 'var(--text-primary)',
            margin: 0, display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
            }}>
              <Cog size={20} style={{ color: 'white' }} />
            </div>
            Aqrotexniki İşlər
          </h1>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 6, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <ClipboardList size={12} /> <strong>{filtered.length}</strong> qeyd
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Layers size={12} /> <strong>{categories.length}</strong> əməliyyat
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tractor size={12} /> <strong>{aggregates.filter(a => a.type === 'Traktor').length}</strong> traktor
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Settings2 size={12} /> <strong>{aggregates.filter(a => a.type !== 'Traktor').length}</strong> aqreqat
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => setShowAggModal(true)}
            style={{ borderRadius: 10, fontSize: 12, padding: '7px 14px' }}>
            <Wrench size={14} /> Texnika
          </button>
          <button className="btn btn-ghost" onClick={() => setShowConfigModal(true)}
            style={{ borderRadius: 10, fontSize: 12, padding: '7px 14px' }}>
            <Settings2 size={14} /> Əməliyyatlar
          </button>
          <a href="/api/export/processes" download
            className="btn btn-ghost" style={{ borderRadius: 10, fontSize: 12, padding: '7px 14px', textDecoration: 'none' }}>
            <FileDown size={14} /> Excel
          </a>
          <button className="btn btn-primary" onClick={() => setShowModal(true)}
            style={{ borderRadius: 10, fontSize: 13, fontWeight: 700, padding: '8px 18px',
              background: 'linear-gradient(135deg, #F59E0B, #D97706)',
              boxShadow: '0 4px 12px rgba(245,158,11,0.3)',
            }}>
            <Plus size={16} /> Yeni qeyd
          </button>
        </div>
      </div>

      {/* ── Stats ───────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-5)' }}>
        {categories.slice(0, 5).map((cat) => {
          const count = processes.filter((p) => p.category?.id === cat.id).length;
          const color = CAT_COLORS[cat.name] || '#6B7280';
          return (
            <div key={cat.id} className="stat-card">
              <div className="stat-icon" style={{ background: `${color}22` }}>
                <span style={{ color }}>{CAT_ICONS[cat.name] || <Cog size={20} />}</span>
              </div>
              <div className="stat-content">
                <div className="stat-value">{count}</div>
                <div className="stat-label">{cat.name}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Filters ─────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input className="form-input" placeholder="Axtar..." value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: 38 }} />
        </div>
        <select className="form-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ width: 'auto', minWidth: 170 }}>
          <option value="">Bütün əməliyyatlar</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="form-select" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: 'auto', minWidth: 140 }}>
          <option value="">Bütün status</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* ── Table ───────────────────────────────────────── */}
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Tarix</th>
              <th>Sahə (ha)</th>
              <th>Sezon / Bitki</th>
              <th>Əməliyyat</th>
              <th>Proses</th>
              <th style={{ textAlign: 'center' }}>№</th>
              <th>Texnika</th>
              <th>Preparatlar</th>
              <th>Sərfiyyat</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
                  Qeyd tapılmadı
                </td>
              </tr>
            ) : filtered.map((p) => {
              const catColor = p.category ? (CAT_COLORS[p.category.name] || '#6B7280') : '#6B7280';
              const st = STATUS_MAP[p.status] || STATUS_MAP.COMPLETED;
              const opSeq = p.operationSeqNumber;

              return (
                <tr key={p.id}>
                  {/* Tarix */}
                  <td style={{ whiteSpace: 'nowrap', fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                    {format(new Date(p.processDate), 'dd MMM yyyy', { locale: az })}
                  </td>

                  {/* Sahə (ha) */}
                  <td>
                    <div style={{ fontWeight: 700 }}>{p.field.fieldNumber}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                      {p.field.farm.name} · {p.areaProcessed || p.field.hectares} ha
                      {p.areaProcessed && p.areaProcessed < p.field.hectares && (
                        <span style={{ color: '#F59E0B', marginLeft: 4 }}>({p.field.hectares} ha-dan)</span>
                      )}
                    </div>
                  </td>

                  {/* Sezon / Bitki */}
                  <td>
                    {p.seasonField ? (
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{p.seasonField.cropType}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{p.seasonField.season.name}</div>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>

                  {/* Əməliyyat */}
                  <td>
                    {p.category ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        background: `${catColor}20`, color: catColor,
                        borderRadius: 6, padding: '3px 9px', fontWeight: 700, fontSize: 11,
                      }}>
                        {CAT_ICONS[p.category.name] || <Cog size={12} />} {p.category.name}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>{p.processType}</span>
                    )}
                  </td>

                  {/* Proses */}
                  <td style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>
                    {p.process?.name || <span style={{ color: 'var(--text-tertiary)' }}>—</span>}
                  </td>

                  {/* Əməliyyat sayı */}
                  <td style={{ textAlign: 'center' }}>
                    {opSeq ? (
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 24, height: 24, borderRadius: '50%',
                        background: `${catColor}15`, color: catColor,
                        fontWeight: 800, fontSize: 11,
                      }} title={`${p.category?.name} üzrə ${opSeq}-ci əməliyyat`}>
                        {opSeq}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>

                  {/* Texnika (Traktor + Aqreqat) */}
                  <td style={{ fontSize: 'var(--font-size-sm)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {p.tractor && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#F59E0B' }}>
                          <Tractor size={11} /> {p.tractor.name}
                          {p.tractor.plateNumber && (
                            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', fontWeight: 500 }}>[{p.tractor.plateNumber}]</span>
                          )}
                        </span>
                      )}
                      {p.aggregate && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#8B5CF6' }}>
                          <Settings2 size={11} /> {p.aggregate.name}
                        </span>
                      )}
                      {!p.tractor && !p.aggregate && (
                        <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                      )}
                    </div>
                  </td>

                  {/* Preparatlar */}
                  <td>
                    {p.materials.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {p.materials.map((m, i) => (
                          <span key={i} style={{
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            fontSize: 11, fontWeight: 600,
                            background: 'rgba(59,130,246,0.08)', borderRadius: 4, padding: '2px 6px',
                          }}>
                            <Package size={10} style={{ color: '#3B82F6' }} /> {m.warehouseItem.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>

                  {/* Sərfiyyat */}
                  <td>
                    {p.materials.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {p.materials.map((m, i) => (
                          <div key={i} style={{ fontSize: 11, fontWeight: 600 }}>
                            {m.quantity} {m.warehouseItem.unit}
                            {m.ratePerHa && (
                              <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, marginLeft: 4 }}>
                                ({m.ratePerHa}/{m.warehouseItem.unit === 'kq' ? 'ha' : 'ha'})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                    )}
                  </td>

                  {/* Status */}
                  <td>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: st.bg, color: st.color,
                      borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700,
                    }}>
                      {st.label}
                    </span>
                  </td>

                  {/* Actions */}
                  <td>
                    {deleteConfirm === p.id ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-ghost btn-icon" onClick={() => deleteProcess(p.id)}
                          style={{ color: 'var(--color-error)', width: 28, height: 28 }}>
                          <Check size={13} />
                        </button>
                        <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(null)}
                          style={{ width: 28, height: 28 }}>
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(p.id)}
                        style={{ color: 'var(--color-error)', width: 28, height: 28 }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Yeni proses qeyd
      ══════════════════════════════════════════════════════════════ */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 className="modal-title"><ClipboardList size={18} style={{ color: '#10B981' }} /> Aqrotexniki İş Qeydi</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} style={{ maxHeight: '70vh', overflowY: 'auto', padding: '0 2px' }}>

              {/* Sahə + Tarix */}
              <div className="form-row">
                <div className="form-group" style={{ position: 'relative' }}>
                  <label className="form-label">Sahə *</label>
                  {/* Seçilmiş sahə göstəricəsi */}
                  {form.fieldId ? (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 12px', border: '1px solid var(--border-color)',
                      borderRadius: 'var(--radius)', background: 'rgba(16,185,129,0.08)',
                      fontSize: 'var(--font-size-sm)', cursor: 'pointer',
                    }} onClick={() => { onFieldChange(''); setFieldSearch(''); setFieldDropOpen(true); }}>
                      <Check size={14} color="var(--color-success)" />
                      <span style={{ flex: 1 }}>
                        {(() => {
                          const f = fields.find(x => x.id === form.fieldId);
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
                  {/* Dropdown */}
                  {fieldDropOpen && !form.fieldId && (() => {
                    const term = fieldSearch.toLowerCase();
                    const list = sortedFields.filter(f =>
                      !term ||
                      f.fieldNumber.toLowerCase().includes(term) ||
                      f.farm.name.toLowerCase().includes(term)
                    );
                    return (
                      <div style={{
                        position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
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
                              onFieldChange(f.id);
                              setFieldSearch('');
                              setFieldDropOpen(false);
                            }}
                            style={{
                              padding: '9px 14px', cursor: 'pointer',
                              fontSize: 'var(--font-size-sm)',
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
                <div className="form-group">
                  <label className="form-label">Tarix *</label>
                  <input type="date" className="form-input" value={form.processDate} required
                    onChange={(e) => setForm({ ...form, processDate: e.target.value })} />
                </div>
              </div>

              {/* Sahə ölçüsü + Sezon */}
              {form.fieldId && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      İşlənən sahə (ha)
                      {(() => {
                        const f = fields.find((x) => x.id === form.fieldId);
                        return f ? <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}> — sahə: {f.hectares} ha</span> : '';
                      })()}
                    </label>
                    <input type="number" className="form-input" value={form.areaProcessed}
                      onChange={(e) => setForm({ ...form, areaProcessed: e.target.value })}
                      placeholder={fields.find((f) => f.id === form.fieldId)?.hectares.toString() || ''} min={0} step={0.1} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Sezon / Bitki</label>
                    {(() => {
                      const sf = getActiveSeasonField(form.fieldId);
                      if (sf) {
                        return (
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            padding: '8px 12px', background: 'rgba(16,185,129,0.08)',
                            borderRadius: 'var(--radius-md)', border: '1px solid rgba(16,185,129,0.2)',
                          }}>
                            <Sprout size={14} style={{ color: '#10B981' }} />
                            <div>
                              <div style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>{sf.cropType}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{sf.season.name}</div>
                            </div>
                          </div>
                        );
                      }
                      return <div style={{ padding: '10px 12px', color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)' }}>Aktiv sezon yoxdur</div>;
                    })()}
                  </div>
                </div>
              )}

              {/* Əməliyyat + Proses */}
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Əməliyyat *</label>
                  <select className="form-select" value={form.categoryId} required
                    onChange={(e) => setForm({ ...form, categoryId: e.target.value, processId: '' })}>
                    <option value="">Seçin...</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Proses</label>
                  <select className="form-select" value={form.processId}
                    onChange={(e) => setForm({ ...form, processId: e.target.value })}>
                    <option value="">Seçin...</option>
                    {selectedCatProcesses.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  {form.categoryId && selectedCatProcesses.length === 0 && (
                    <div style={{ fontSize: 11, color: '#F59E0B', marginTop: 4 }}>
                      Bu əməliyyata proses əlavə olunmayıb. <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '0 4px', textDecoration: 'underline', color: '#F59E0B' }}
                        onClick={() => setShowConfigModal(true)}>Əlavə et</button>
                    </div>
                  )}
                </div>
              </div>

              {/* Əməliyyat sayı göstəricisi */}
              {form.fieldId && form.categoryId && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 12px', marginBottom: 'var(--space-3)',
                  background: 'rgba(139,92,246,0.08)', borderRadius: 'var(--radius-md)',
                  fontSize: 12, color: '#8B5CF6', fontWeight: 600,
                }}>
                  <Hash size={13} />
                  Bu sahəyə bu əməliyyatdan əvvəl {getOperationCount(form.fieldId, form.categoryId)} dəfə edilib
                  → bu {getOperationCount(form.fieldId, form.categoryId) + 1}-ci olacaq
                </div>
              )}

              {/* ── Texnika Seçimi: Traktor + Aqreqat ── */}
              <div style={{
                padding: '14px 16px', borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(139,92,246,0.06) 100%)',
                border: '1px solid var(--border-primary)',
                marginBottom: 'var(--space-3)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <Tractor size={15} style={{ color: '#F59E0B' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>Texnika</span>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Tractor size={11} style={{ color: '#F59E0B' }} /> Traktor
                    </label>
                    <select className="form-select" value={form.tractorId}
                      onChange={(e) => setForm({ ...form, tractorId: e.target.value })}
                      style={{ borderColor: form.tractorId ? '#F59E0B' : undefined }}>
                      <option value="">Seçin...</option>
                      {aggregates.filter(a => a.type === 'Traktor').map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}{a.plateNumber ? ` [${a.plateNumber}]` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Settings2 size={11} style={{ color: '#8B5CF6' }} /> Aqreqat / Avadanlıq
                    </label>
                    <select className="form-select" value={form.aggregateId}
                      onChange={(e) => setForm({ ...form, aggregateId: e.target.value })}
                      style={{ borderColor: form.aggregateId ? '#8B5CF6' : undefined }}>
                      <option value="">Seçin...</option>
                      {aggregates.filter(a => a.type !== 'Traktor').map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}{a.type ? ` (${a.type})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Preparatlar / Materiallar */}
              <div className="form-group">
                <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Preparat / Toxum / Gübrə</span>
                  <button type="button" className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px' }}
                    onClick={addMaterialRow}>
                    <Plus size={12} /> Material əlavə et
                  </button>
                </label>

                {formMaterials.length > 0 && (
                  <div style={{
                    border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)',
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      display: 'grid', gridTemplateColumns: '1fr 100px 90px 32px',
                      gap: 0, padding: '6px 10px', background: 'var(--bg-tertiary)',
                      fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)',
                    }}>
                      <span>Material (anbardan)</span>
                      <span>Miqdar</span>
                      <span>Norma/ha</span>
                      <span></span>
                    </div>
                    {formMaterials.map((mat, idx) => {
                      const selectedItem = warehouseItems.find((w) => w.id === mat.warehouseItemId);
                      return (
                        <div key={idx} style={{
                          display: 'grid', gridTemplateColumns: '1fr 100px 90px 32px',
                          gap: 6, padding: '6px 10px', alignItems: 'center',
                          borderTop: '1px solid var(--border-primary)',
                        }}>
                          <select className="form-select" style={{ height: 34, fontSize: 12 }}
                            value={mat.warehouseItemId}
                            onChange={(e) => updateMaterial(idx, 'warehouseItemId', e.target.value)}>
                            <option value="">Seçin...</option>
                            {warehouseItems.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name} ({w.currentStock} {w.unit})
                              </option>
                            ))}
                          </select>
                          <div style={{ position: 'relative' }}>
                            <input type="number" className="form-input"
                              style={{ height: 34, fontSize: 12, paddingRight: selectedItem ? 28 : 8 }}
                              value={mat.quantity}
                              onChange={(e) => updateMaterial(idx, 'quantity', e.target.value)}
                              min={0} step={0.1} />
                            {selectedItem && (
                              <span style={{
                                position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                                fontSize: 10, color: 'var(--text-tertiary)',
                              }}>
                                {selectedItem.unit}
                              </span>
                            )}
                          </div>
                          <input type="number" className="form-input"
                            style={{ height: 34, fontSize: 12 }}
                            value={mat.ratePerHa} placeholder="auto"
                            onChange={(e) => updateMaterial(idx, 'ratePerHa', e.target.value)}
                            min={0} step={0.01} />
                          <button type="button" className="btn btn-ghost btn-icon"
                            onClick={() => removeMaterialRow(idx)}
                            style={{ color: 'var(--color-error)', width: 28, height: 28 }}>
                            <X size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {formMaterials.length === 0 && (
                  <div style={{
                    padding: 'var(--space-3)', textAlign: 'center',
                    border: '1px dashed var(--border-primary)', borderRadius: 'var(--radius-md)',
                    color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)',
                  }}>
                    Material istifadə olunmadı. Yuxarıdakı + düyməsini basın.
                  </div>
                )}
              </div>

              {/* Açıqlama + Qeyd */}
              <div className="form-group">
                <label className="form-label">Açıqlama</label>
                <input className="form-input" placeholder="Məs: Payız buğdası əkildi" value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select className="form-select" value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Qeyd</label>
                  <input className="form-input" value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>


              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Ləğv et</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> Saxlanılır...</> : <><Check size={15} /> Qeyd et</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Əməliyyat & Proseslər Konfiqurasiyası
      ══════════════════════════════════════════════════════════════ */}
      {showConfigModal && (
        <div className="modal-overlay" onClick={() => setShowConfigModal(false)}>
          <div className="modal modal-flex" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560, maxHeight: '85vh' }}>
            <div className="modal-header">
              <h2 className="modal-title"><Settings2 size={18} style={{ color: '#8B5CF6' }} /> Əməliyyat & Proseslər</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowConfigModal(false)}><X size={20} /></button>
            </div>

            {/* Yeni kateqoriya əlavə */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 'var(--space-4)' }}>
              <input className="form-input" placeholder="Yeni əməliyyat adı..." value={newCatName}
                onChange={(e) => setNewCatName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCategory()} style={{ flex: 1 }} />
              <button className="btn btn-primary" onClick={addCategory} disabled={!newCatName.trim()}>
                <Plus size={14} /> Əlavə et
              </button>
            </div>

            {/* Kateqoriya siyahısı — scroll */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', paddingBottom: 8 }}>
              {categories.map((cat) => {
                const color = CAT_COLORS[cat.name] || '#6B7280';
                return (
                  <div key={cat.id} style={{
                    border: `1px solid ${color}30`,
                    borderRadius: 'var(--radius-md)',
                  }}>
                    {/* Kateqoriya başlığı */}
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', background: `${color}10`,
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: 'var(--font-size-sm)', color }}>
                        {CAT_ICONS[cat.name] || <Cog size={14} />} {cat.name}
                        <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-tertiary)' }}>({cat.processes.length} proses)</span>
                      </span>
                      <button className="btn btn-ghost btn-icon" onClick={() => deleteCategory(cat.id)}
                        style={{ color: 'var(--color-error)', width: 26, height: 26 }}>
                        <Trash2 size={12} />
                      </button>
                    </div>

                    {/* Proseslər */}
                    <div style={{ padding: '8px 14px' }}>
                      {cat.processes.map((proc) => (
                        <div key={proc.id} style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
                        }}>
                          <span style={{ fontSize: 'var(--font-size-sm)', paddingLeft: 10 }}>• {proc.name}</span>
                          <button className="btn btn-ghost btn-icon" onClick={() => deleteProcessDef(cat.id, proc.id)}
                            style={{ color: 'var(--text-tertiary)', width: 24, height: 24 }}>
                            <X size={11} />
                          </button>
                        </div>
                      ))}

                      {/* Yeni proses əlavə */}
                      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                        <input className="form-input" placeholder="Yeni proses adı..."
                          value={newProcNames[cat.id] || ''}
                          onChange={(e) => setNewProcNames((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                          onKeyDown={(e) => e.key === 'Enter' && addProcess(cat.id)}
                          style={{ flex: 1, height: 32, fontSize: 12 }} />
                        <button className="btn btn-secondary" onClick={() => addProcess(cat.id)}
                          disabled={!newProcNames[cat.id]?.trim()}
                          style={{ fontSize: 11, padding: '4px 10px' }}>
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Texnika İdarəetmə (Traktor + Aqreqat)
      ══════════════════════════════════════════════════════════════ */}
      {showAggModal && (
        <div className="modal-overlay" onClick={() => setShowAggModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2 className="modal-title"><Wrench size={18} style={{ color: '#F59E0B' }} /> Texnika İdarəetmə</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAggModal(false)}><X size={20} /></button>
            </div>

            {/* Yeni texnika əlavə */}
            <div style={{
              padding: '14px 16px', borderRadius: 'var(--radius-lg)',
              background: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(139,92,246,0.06) 100%)',
              border: '1px solid var(--border-primary)',
              marginBottom: 'var(--space-4)',
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
                + Yeni Texnika Əlavə Et
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', gap: 8, marginBottom: 8 }}>
                <input className="form-input" placeholder="Ad (məs: MTZ-80, Diskli mala)" value={newAggName}
                  onChange={(e) => setNewAggName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addAggregate()} />
                <select className="form-select" value={newAggType}
                  onChange={(e) => setNewAggType(e.target.value)}>
                  <option value="">Növ...</option>
                  <option value="Traktor">🚜 Traktor</option>
                  <option value="Kombayn">🌾 Kombayn</option>
                  <option value="Aqreqat">⚙️ Aqreqat</option>
                  <option value="Digər">📦 Digər</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8 }}>
                <input className="form-input" placeholder="Nömrə / Dövlət nişanı (məcburi deyil)"
                  value={newAggPlate}
                  onChange={(e) => setNewAggPlate(e.target.value)} />
                <button className="btn btn-primary" onClick={addAggregate} disabled={!newAggName.trim()}>
                  <Plus size={14} /> Əlavə et
                </button>
              </div>
            </div>

            {/* Traktorlar */}
            {aggregates.filter(a => a.type === 'Traktor').length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#F59E0B', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Tractor size={13} /> Traktorlar
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {aggregates.filter(a => a.type === 'Traktor').map((agg) => (
                    <div key={agg.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 'var(--radius-md)',
                      border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.04)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Tractor size={16} style={{ color: '#F59E0B' }} />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{agg.name}</div>
                          {agg.plateNumber && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Nömrə: {agg.plateNumber}</div>}
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-icon" onClick={() => deleteAggregate(agg.id)}
                        style={{ color: 'var(--color-error)', width: 28, height: 28 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Aqreqatlar + Digər */}
            {aggregates.filter(a => a.type !== 'Traktor').length > 0 && (
              <div style={{ marginBottom: 'var(--space-4)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#8B5CF6', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Settings2 size={13} /> Aqreqatlar / Avadanlıq
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '30vh', overflowY: 'auto' }}>
                  {aggregates.filter(a => a.type !== 'Traktor').map((agg) => (
                    <div key={agg.id} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-primary)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Settings2 size={16} style={{ color: '#8B5CF6' }} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{agg.name}</div>
                          {agg.type && <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{agg.type}</div>}
                        </div>
                      </div>
                      <button className="btn btn-ghost btn-icon" onClick={() => deleteAggregate(agg.id)}
                        style={{ color: 'var(--color-error)', width: 28, height: 28 }}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aggregates.length === 0 && (
              <div style={{ textAlign: 'center', padding: 'var(--space-6)', color: 'var(--text-tertiary)' }}>
                Texnika yoxdur. Yuxarıdan əlavə edin.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
