'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Droplets, Plus, X, CloudRain, Calendar, List, ChevronLeft, ChevronRight,
  RotateCcw, Gauge, Wind, AlertTriangle, Check, Trash2, TrendingUp,
  Wrench, Zap, AlertOctagon, Timer, TableProperties, Settings2, Waves, FileDown,
  Wheat, Leaf,
} from 'lucide-react';
import { format, getDaysInMonth, differenceInDays } from 'date-fns';
import { az } from 'date-fns/locale';
import { useToast } from '@/components/Toast';
import { compareFieldNumbers } from '@/lib/naturalSort';

// ─── Types ─────────────────────────────────────────────────────────────────
interface SeasonFieldInfo {
  cropType: string;
  season: { id: string; name: string; status: string };
}

interface Field {
  id: string; fieldNumber: string; hectares: number;
  irrigationIntervalDays: number | null;
  farm: { name: string };
  seasonFields: SeasonFieldInfo[];
}

interface SpeedEntry { speed: number; mm: number; }

interface Irrigation {
  id: string; fieldId: string; irrigationType: string;
  irrigationDate: string; pivotSpeed: number | null;
  waterMm: number | null; duration: number | null; waterVolume: number | null;
  notes: string | null;
  field: { fieldNumber: string; hectares: number; farm: { name: string } };
  user: { fullName: string };
}

interface RainfallField {
  fieldId: string;
  field: { fieldNumber: string; farm: { name: string } };
}

interface Rainfall {
  id: string; rainfallDate: string; amountMm: number;
  notes: string | null; user: any; fields: RainfallField[];
}

interface Stoppage {
  id: string; fieldId: string; startDate: string; endDate: string | null;
  reason: string; title: string; notes: string | null;
  field: { fieldNumber: string; farm: { name: string } };
  user: { fullName: string };
}

// ─── Constants ──────────────────────────────────────────────────────────────
const MONTHS_AZ = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
];

const TYPE_CFG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  PIVOT:     { label: 'Pivot',     icon: <RotateCcw size={12} />, color: '#10B981', bg: 'rgba(16,185,129,0.18)' },
  SPRINKLER: { label: 'Sprinkler', icon: <Wind size={12} />,      color: '#3B82F6', bg: 'rgba(59,130,246,0.18)' },
  DRIP:      { label: 'Damlama',   icon: <Droplets size={12} />,  color: '#F59E0B', bg: 'rgba(245,158,11,0.18)' },
};

const STOP_CFG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  BREAKDOWN:     { label: 'Nasazlıq',       icon: <Wrench size={12} />,       color: '#EF4444' },
  MAINTENANCE:   { label: 'Texniki baxım',  icon: <Settings2 size={12} />,    color: '#8B5CF6' },
  POWER_OUTAGE:  { label: 'Elektrik kəsildi', icon: <Zap size={12} />,        color: '#F59E0B' },
  WATER_SHORTAGE:{ label: 'Su yoxdur',      icon: <AlertOctagon size={12} />, color: '#06B6D4' },
  OTHER:         { label: 'Digər',          icon: <AlertTriangle size={12} />,color: '#6B7280' },
};

// Crop color palette for grouping
const CROP_COLORS: Record<string, { color: string; bg: string }> = {};
const CROP_PALETTE = [
  { color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  { color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  { color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
  { color: '#06B6D4', bg: 'rgba(6,182,212,0.15)' },
  { color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  { color: '#84CC16', bg: 'rgba(132,204,22,0.15)' },
];
function getCropColor(crop: string) {
  if (!CROP_COLORS[crop]) {
    const idx = Object.keys(CROP_COLORS).length % CROP_PALETTE.length;
    CROP_COLORS[crop] = CROP_PALETTE[idx];
  }
  return CROP_COLORS[crop];
}

// ─── Calendar cell intensity helper ─────────────────────────────────────────
function mmToIntensity(mm: number): string {
  if (mm <= 0) return 'transparent';
  if (mm < 10) return 'rgba(16,185,129,0.20)';
  if (mm < 20) return 'rgba(16,185,129,0.38)';
  if (mm < 30) return 'rgba(16,185,129,0.55)';
  return 'rgba(16,185,129,0.72)';
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function IrrigationPage() {
  const { showToast } = useToast();
  const now = new Date();

  // Navigation
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [activeTab, setActiveTab] = useState<'list'>('list');

  // Crop filter
  const [cropFilter, setCropFilter] = useState<string>('ALL');

  // Data
  const [fields, setFields] = useState<Field[]>([]);
  const [irrigations, setIrrigations] = useState<Irrigation[]>([]);
  const [rainfalls, setRainfalls] = useState<Rainfall[]>([]);
  const [stoppages, setStoppages] = useState<Stoppage[]>([]);
  const [loading, setLoading] = useState(true);

  // Pivot chart cache: fieldId → entries
  const [pivotCharts, setPivotCharts] = useState<Record<string, SpeedEntry[]>>({});

  // Modals
  const [showIrrModal, setShowIrrModal] = useState(false);
  const [showRainModal, setShowRainModal] = useState(false);
  const [showStopModal, setShowStopModal] = useState(false);
  const [showPivotModal, setShowPivotModal] = useState(false);
  const [showIntervalModal, setShowIntervalModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Quick-add: click on cell
  const [quickCell, setQuickCell] = useState<{ fieldId: string; day: number } | null>(null);
  const [quickForm, setQuickForm] = useState({ pivotSpeed: '', waterMm: '' });

  // Pivot chart editing
  const [chartField, setChartField] = useState<Field | null>(null);
  const [chartEntries, setChartEntries] = useState<SpeedEntry[]>([]);

  // Interval editing
  const [intervalField, setIntervalField] = useState<Field | null>(null);
  const [intervalDays, setIntervalDays] = useState('');

  // Irrigation form
  const [irrForm, setIrrForm] = useState({
    fieldId: '', irrigationType: 'PIVOT',
    irrigationDate: format(now, 'yyyy-MM-dd'),
    pivotSpeed: '', waterMm: '', duration: '', waterVolume: '', notes: '',
  });

  // Rainfall form
  const [rnForm, setRnForm] = useState({
    rainfallDate: format(now, 'yyyy-MM-dd'),
    amountMm: '', notes: '', allFields: true, selectedFieldIds: [] as string[],
  });

  // Stoppage form
  const [stopForm, setStopForm] = useState({
    fieldId: '', startDate: format(now, 'yyyy-MM-dd'),
    endDate: '', reason: 'BREAKDOWN', title: '', notes: '',
  });

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const safeJson = async (res: Response, fallback: any = []) => {
    try {
      if (!res.ok) { console.error(`API ${res.url} → ${res.status}`); return fallback; }
      return await res.json();
    } catch { return fallback; }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [fRes, iRes, rRes, sRes] = await Promise.all([
        fetch('/api/fields'),
        fetch(`/api/irrigation?year=${viewYear}&month=${viewMonth + 1}`),
        fetch(`/api/rainfall?year=${viewYear}&month=${viewMonth + 1}`),
        fetch(`/api/stoppages?year=${viewYear}&month=${viewMonth + 1}`),
      ]);
      setFields(await safeJson(fRes, []));
      setIrrigations(await safeJson(iRes, []));
      setRainfalls(await safeJson(rRes, []));
      setStoppages(await safeJson(sRes, []));
    } finally {
      setLoading(false);
    }
  }, [viewYear, viewMonth]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const fetchChart = async (fieldId: string) => {
    if (pivotCharts[fieldId]) return pivotCharts[fieldId];
    const res = await fetch(`/api/pivot-chart/${fieldId}`);
    const data = res.ok ? await res.json() : null;
    const entries = data ? data.entries : [];
    setPivotCharts((prev) => ({ ...prev, [fieldId]: entries }));
    return entries;
  };

  // ─── Computed ────────────────────────────────────────────────────────────

  // All unique crop types from fields
  const cropTypes = useMemo(() => {
    const set = new Set<string>();
    for (const f of fields) {
      for (const sf of f.seasonFields) {
        if (sf.season.status === 'ACTIVE' || sf.season.status === 'PLANNED') {
          set.add(sf.cropType);
        }
      }
    }
    return Array.from(set).sort();
  }, [fields]);

  // Helper: get active crop for a field
  const getFieldCrop = (field: Field): string | null => {
    const active = field.seasonFields.find(sf =>
      sf.season.status === 'ACTIVE' || sf.season.status === 'PLANNED'
    );
    return active?.cropType || null;
  };

  // Sorted + filtered fields
  const sortedFields = useMemo(() =>
    [...fields].sort((a, b) => {
      const fc = (a.farm?.name || '').localeCompare(b.farm?.name || '');
      return fc !== 0 ? fc : compareFieldNumbers(a.fieldNumber, b.fieldNumber);
    }), [fields]
  );

  const filteredFields = useMemo(() => {
    if (cropFilter === 'ALL') return sortedFields;
    return sortedFields.filter(f => getFieldCrop(f) === cropFilter);
  }, [sortedFields, cropFilter]);

  // irrigation index: dateKey → fieldId → Irrigation[]
  const irrMap = useMemo(() => {
    const m: Record<string, Record<string, Irrigation[]>> = {};
    for (const i of irrigations) {
      const d = format(new Date(i.irrigationDate), 'yyyy-MM-dd');
      if (!m[d]) m[d] = {};
      if (!m[d][i.fieldId]) m[d][i.fieldId] = [];
      m[d][i.fieldId].push(i);
    }
    return m;
  }, [irrigations]);

  // rainfall index: dateKey → Rainfall[]
  const rainMap = useMemo(() => {
    const m: Record<string, Rainfall[]> = {};
    for (const r of rainfalls) {
      const d = format(new Date(r.rainfallDate), 'yyyy-MM-dd');
      if (!m[d]) m[d] = [];
      m[d].push(r);
    }
    return m;
  }, [rainfalls]);

  // stoppage index: fieldId → stoppages active on a given day
  const isStoppedOnDay = (fieldId: string, day: number): Stoppage | null => {
    const dayDate = new Date(viewYear, viewMonth, day);
    return stoppages.find((s) => {
      if (s.fieldId !== fieldId) return false;
      const start = new Date(s.startDate);
      const end = s.endDate ? new Date(s.endDate) : new Date(viewYear, viewMonth + 1, 0);
      return dayDate >= start && dayDate <= end;
    }) || null;
  };

  const daysInMonth = getDaysInMonth(new Date(viewYear, viewMonth, 1));
  const calendarDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Monthly mm per field
  const fieldMonthlyMm = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of irrigations) {
      if (i.waterMm) m[i.fieldId] = (m[i.fieldId] || 0) + i.waterMm;
    }
    return m;
  }, [irrigations]);

  // Monthly mm + rainfall per field
  const fieldMonthlyCombined = useMemo(() => {
    const m: Record<string, number> = { ...fieldMonthlyMm };
    for (const r of rainfalls) {
      for (const rf of r.fields) {
        m[rf.fieldId] = (m[rf.fieldId] || 0) + r.amountMm;
      }
    }
    return m;
  }, [fieldMonthlyMm, rainfalls]);

  // For each field, find the last irrigation date
  const fieldLastIrr = useMemo(() => {
    const m: Record<string, Date> = {};
    for (const i of irrigations) {
      const d = new Date(i.irrigationDate);
      if (!m[i.fieldId] || d > m[i.fieldId]) m[i.fieldId] = d;
    }
    return m;
  }, [irrigations]);

  // Stats
  const totalMm = useMemo(() => irrigations.reduce((s, i) => s + (i.waterMm || 0), 0), [irrigations]);
  const totalRainMm = useMemo(() => rainfalls.reduce((s, r) => s + r.amountMm, 0), [rainfalls]);

  // List view: group irrigations by crop
  const irrigationsByCrop = useMemo(() => {
    const groups: Record<string, { crop: string; items: Irrigation[] }> = {};
    for (const irr of irrigations) {
      const field = fields.find(f => f.id === irr.fieldId);
      const crop = field ? (getFieldCrop(field) || 'Təyin edilməyib') : 'Təyin edilməyib';
      if (!groups[crop]) groups[crop] = { crop, items: [] };
      groups[crop].items.push(irr);
    }
    // Sort each group by date desc
    for (const g of Object.values(groups)) {
      g.items.sort((a, b) => new Date(b.irrigationDate).getTime() - new Date(a.irrigationDate).getTime());
    }
    return Object.values(groups).sort((a, b) => a.crop.localeCompare(b.crop));
  }, [irrigations, fields]);

  // ─── Pivot speed → mm ────────────────────────────────────────────────────
  const speedToMm = (speed: number, chart: SpeedEntry[]): number | null => {
    if (!chart.length) return null;
    const exact = chart.find((e) => e.speed === speed);
    if (exact) return exact.mm;
    const sorted = [...chart].sort((a, b) => a.speed - b.speed);
    let lo = sorted[0], hi = sorted[sorted.length - 1];
    for (const e of sorted) {
      if (e.speed <= speed) lo = e;
    }
    for (let i = sorted.length - 1; i >= 0; i--) {
      if (sorted[i].speed >= speed) hi = sorted[i];
      else break;
    }
    if (lo.speed === hi.speed) return lo.mm;
    const ratio = (speed - lo.speed) / (hi.speed - lo.speed);
    return Math.round(lo.mm + ratio * (hi.mm - lo.mm));
  };

  const handleSpeedChange = async (speed: string) => {
    setIrrForm((prev) => ({ ...prev, pivotSpeed: speed }));
    if (!speed || !irrForm.fieldId) return;
    let chart = pivotCharts[irrForm.fieldId];
    if (!chart) chart = await fetchChart(irrForm.fieldId);
    const mm = speedToMm(parseFloat(speed), chart);
    if (mm !== null) setIrrForm((prev) => ({ ...prev, waterMm: String(mm) }));
  };

  // Quick-add speed change
  const handleQuickSpeedChange = async (speed: string, fieldId: string) => {
    setQuickForm((prev) => ({ ...prev, pivotSpeed: speed }));
    if (!speed || !fieldId) return;
    let chart = pivotCharts[fieldId];
    if (!chart) chart = await fetchChart(fieldId);
    const mm = speedToMm(parseFloat(speed), chart);
    if (mm !== null) setQuickForm((prev) => ({ ...prev, waterMm: String(mm) }));
  };

  // ─── Handlers ────────────────────────────────────────────────────────────
  const submitIrr = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch('/api/irrigation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(irrForm),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Suvarma qeyd edildi', 'success');
      setShowIrrModal(false);
      setIrrForm({ fieldId: '', irrigationType: 'PIVOT', irrigationDate: format(now, 'yyyy-MM-dd'), pivotSpeed: '', waterMm: '', duration: '', waterVolume: '', notes: '' });
      fetchAll();
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  // Quick submit from calendar cell
  const submitQuick = async () => {
    if (!quickCell || !quickForm.waterMm) return;
    setSaving(true);
    try {
      const dateStr = format(new Date(viewYear, viewMonth, quickCell.day), 'yyyy-MM-dd');
      const res = await fetch('/api/irrigation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId: quickCell.fieldId,
          irrigationType: 'PIVOT',
          irrigationDate: dateStr,
          pivotSpeed: quickForm.pivotSpeed || null,
          waterMm: quickForm.waterMm,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Suvarma qeyd edildi', 'success');
      setQuickCell(null);
      setQuickForm({ pivotSpeed: '', waterMm: '' });
      fetchAll();
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const submitRain = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch('/api/rainfall', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...rnForm, fieldIds: rnForm.allFields ? [] : rnForm.selectedFieldIds }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Yağıntı qeyd edildi', 'success');
      setShowRainModal(false);
      setRnForm({ rainfallDate: format(now, 'yyyy-MM-dd'), amountMm: '', notes: '', allFields: true, selectedFieldIds: [] });
      fetchAll();
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const submitStop = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch('/api/stoppages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(stopForm),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Dayanma qeydi əlavə edildi', 'success');
      setShowStopModal(false);
      setStopForm({ fieldId: '', startDate: format(now, 'yyyy-MM-dd'), endDate: '', reason: 'BREAKDOWN', title: '', notes: '' });
      fetchAll();
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const closeStoppage = async (id: string) => {
    try {
      await fetch(`/api/stoppages/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endDate: format(now, 'yyyy-MM-dd') }),
      });
      showToast('Dayanma bitdi', 'success'); fetchAll();
    } catch { showToast('Xəta', 'error'); }
  };

  const deleteIrr = async (id: string) => {
    await fetch(`/api/irrigation/${id}`, { method: 'DELETE' });
    showToast('Silindi', 'success'); fetchAll();
  };

  const deleteRain = async (id: string) => {
    await fetch(`/api/rainfall/${id}`, { method: 'DELETE' });
    showToast('Silindi', 'success'); fetchAll();
  };

  const saveChart = async () => {
    if (!chartField) return;
    await fetch(`/api/pivot-chart/${chartField.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entries: chartEntries }),
    });
    setPivotCharts((prev) => ({ ...prev, [chartField.id]: chartEntries }));
    showToast('Pivot cədvəli saxlandı', 'success');
    setShowPivotModal(false);
  };

  const saveInterval = async () => {
    if (!intervalField) return;
    try {
      await fetch(`/api/fields/${intervalField.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldNumber: intervalField.fieldNumber,
          hectares: intervalField.hectares,
          irrigationIntervalDays: intervalDays ? parseInt(intervalDays) : null,
        }),
      });
      showToast('Deadline yadda saxlandı', 'success');
      setShowIntervalModal(false);
      fetchAll();
    } catch { showToast('Xəta', 'error'); }
  };

  const navigateMonth = (dir: -1 | 1) => {
    let m = viewMonth + dir, y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m); setViewYear(y);
  };

  if (loading) return (
    <div className="page-content">
      <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Yüklənir...</div></div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="page-content">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Suvarma İzləmə</h1>
          <p className="page-description">
            {MONTHS_AZ[viewMonth]} {viewYear} · {irrigations.length} qeyd · {totalMm.toFixed(0)} mm suvarma · {totalRainMm.toFixed(0)} mm yağıntı
          </p>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
          <button className="btn btn-ghost" onClick={() => setShowIntervalModal(true)} title="Deadline idarəetmə">
            <Timer size={16} /> Deadline
          </button>
          <button className="btn btn-ghost" onClick={() => setShowPivotModal(true)} title="Pivot sürət cədvəli">
            <Gauge size={16} /> Pivot cədvəli
          </button>
          <button className="btn btn-secondary" onClick={() => setShowStopModal(true)}>
            <AlertTriangle size={16} /> Dayanma qeyd
          </button>
          <button className="btn btn-secondary" onClick={() => setShowRainModal(true)}>
            <CloudRain size={16} /> Yağıntı qeyd
          </button>
          <button className="btn btn-primary" onClick={() => setShowIrrModal(true)}>
            <Plus size={16} /> Suvarma qeyd
          </button>
          <a
            href="/api/export/irrigation"
            download
            className="btn btn-outline btn-success btn-sm gap-1"
          >
            <FileDown size={15} /> Excel
          </a>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      <div className="stats-grid" style={{ marginBottom: 'var(--space-5)' }}>
        {[
          { icon: <RotateCcw size={20} />, val: irrigations.filter((i) => i.irrigationType === 'PIVOT').length, label: 'Pivot suvarma', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
          { icon: <Waves size={20} />, val: `${totalMm.toFixed(0)} mm`, label: 'Suvarma (mm)', color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
          { icon: <CloudRain size={20} />, val: `${totalRainMm.toFixed(0)} mm`, label: 'Yağıntı', color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
          { icon: <AlertTriangle size={20} />, val: stoppages.filter((s) => !s.endDate).length, label: 'Aktiv dayanma', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
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

      {/* ── Crop filter + Month nav + Tabs ────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
        {/* Row 1: Crop filter — bitki seçimi */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
          background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
          padding: '8px 12px', border: '1px solid var(--border-primary)',
        }}>
          <Wheat size={14} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-tertiary)', marginRight: 4 }}>Bitki:</span>
          <button
            onClick={() => setCropFilter('ALL')}
            style={{
              padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: cropFilter === 'ALL' ? 'var(--color-primary)' : 'var(--bg-tertiary)',
              color: cropFilter === 'ALL' ? 'white' : 'var(--text-secondary)',
              fontWeight: 600, fontSize: 12, transition: 'all 0.2s',
            }}
          >
            Hamısı ({sortedFields.length})
          </button>
          {cropTypes.map(crop => {
            const count = sortedFields.filter(f => getFieldCrop(f) === crop).length;
            const cc = getCropColor(crop);
            return (
              <button key={crop}
                onClick={() => setCropFilter(crop === cropFilter ? 'ALL' : crop)}
                style={{
                  padding: '4px 12px', borderRadius: 20, cursor: 'pointer',
                  border: `2px solid ${cropFilter === crop ? cc.color : 'transparent'}`,
                  background: cropFilter === crop ? cc.bg : 'var(--bg-tertiary)',
                  color: cropFilter === crop ? cc.color : 'var(--text-secondary)',
                  fontWeight: 600, fontSize: 12, transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: cc.color, display: 'inline-block', flexShrink: 0,
                }} />
                {crop} <span style={{ opacity: 0.7 }}>({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          SUVARMA SİYAHISI
      ══════════════════════════════════════════════════════════════ */}
      {true && (
        <div>
          {irrigationsByCrop.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-tertiary)' }}>
              Bu ay suvarma qeydi yoxdur
            </div>
          ) : (
            irrigationsByCrop
              .filter(g => cropFilter === 'ALL' || g.crop === cropFilter)
              .map(group => {
                const cc = getCropColor(group.crop);
                const groupMm = group.items.reduce((s, i) => s + (i.waterMm || 0), 0);
                return (
                  <div key={group.crop} style={{ marginBottom: 'var(--space-5)' }}>
                    {/* Group header */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-3)',
                      padding: '10px 16px', background: cc.bg, borderRadius: 'var(--radius-md)',
                      border: `1px solid ${cc.color}30`,
                    }}>
                      <Leaf size={18} style={{ color: cc.color }} />
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: 700, fontSize: 'var(--font-size-md)', color: cc.color }}>
                          {group.crop}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)', marginLeft: 10 }}>
                          {group.items.length} suvarma · {groupMm.toFixed(0)} mm
                        </span>
                      </div>
                      <div style={{
                        fontWeight: 800, fontSize: 'var(--font-size-lg)', color: cc.color,
                      }}>
                        {groupMm.toFixed(0)} mm
                      </div>
                    </div>

                    {/* Table */}
                    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                      <div className="table-container">
                        <table className="table">
                          <thead>
                            <tr>
                              <th>Növ</th><th>Sahə</th><th>Tarix</th><th>Sürət</th><th>mm</th>
                              <th>Müddət</th><th>m³</th><th>Qeyd edən</th><th>Qeyd</th><th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((irr) => {
                              const cfg = TYPE_CFG[irr.irrigationType] || TYPE_CFG.DRIP;
                              return (
                                <tr key={irr.id}>
                                  <td>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: cfg.bg, color: cfg.color, borderRadius: 6, padding: '2px 8px', fontWeight: 700, fontSize: 11 }}>
                                      {cfg.icon} {cfg.label}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: 600 }}>
                                    <div>{irr.field.fieldNumber}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{irr.field.farm.name}</div>
                                  </td>
                                  <td style={{ whiteSpace: 'nowrap' }}>{format(new Date(irr.irrigationDate), 'dd MMM yyyy', { locale: az })}</td>
                                  <td>{irr.pivotSpeed ? `${irr.pivotSpeed}%` : '—'}</td>
                                  <td style={{ fontWeight: 800, color: irr.waterMm ? '#10B981' : 'var(--text-tertiary)' }}>
                                    {irr.waterMm ? `${irr.waterMm} mm` : '—'}
                                  </td>
                                  <td>{irr.duration ? `${irr.duration}s` : '—'}</td>
                                  <td>{irr.waterVolume ? `${irr.waterVolume}` : '—'}</td>
                                  <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{irr.user.fullName}</td>
                                  <td style={{ fontSize: 11, color: 'var(--text-tertiary)', maxWidth: 140 }}>{irr.notes || '—'}</td>
                                  <td>
                                    <button className="btn btn-ghost btn-icon" onClick={() => deleteIrr(irr.id)} style={{ color: 'var(--color-error)' }}>
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
                  </div>
                );
              })
          )}

          {/* Dayanmalar */}
          {stoppages.length > 0 && (
            <div style={{ marginTop: 'var(--space-5)' }}>
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} style={{ color: '#EF4444' }} /> Pivot dayanmaları ({stoppages.length})
              </h3>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr><th>Sahə</th><th>Başlıq</th><th>Səbəb</th><th>Başlandı</th><th>Bitdi</th><th>Müddət</th><th>Qeyd</th><th></th></tr>
                    </thead>
                    <tbody>
                      {stoppages.map((s) => {
                        const cfg = STOP_CFG[s.reason] || STOP_CFG.OTHER;
                        const duration = s.endDate
                          ? differenceInDays(new Date(s.endDate), new Date(s.startDate)) + 1
                          : differenceInDays(now, new Date(s.startDate)) + 1;
                        return (
                          <tr key={s.id} style={{ background: !s.endDate ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                            <td style={{ fontWeight: 600 }}>
                              <div>{s.field.fieldNumber}</div>
                              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.field.farm.name}</div>
                            </td>
                            <td style={{ fontWeight: 600 }}>{s.title}</td>
                            <td>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: cfg.color, fontWeight: 600, fontSize: 11 }}>
                                {cfg.icon} {cfg.label}
                              </span>
                            </td>
                            <td style={{ whiteSpace: 'nowrap' }}>{format(new Date(s.startDate), 'dd MMM', { locale: az })}</td>
                            <td style={{ whiteSpace: 'nowrap', color: !s.endDate ? '#EF4444' : 'var(--text-primary)', fontWeight: !s.endDate ? 700 : 400 }}>
                              {s.endDate ? format(new Date(s.endDate), 'dd MMM', { locale: az }) : '⚡ Davam edir'}
                            </td>
                            <td style={{ fontWeight: 600, color: duration > 3 ? '#EF4444' : 'var(--text-primary)' }}>{duration} gün</td>
                            <td style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{s.notes || '—'}</td>
                            <td>
                              {!s.endDate && (
                                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 8px', color: '#10B981' }}
                                  onClick={() => closeStoppage(s.id)}>
                                  <Check size={12} /> Bitdi
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Yağıntılar */}
          {rainfalls.length > 0 && (
            <div style={{ marginTop: 'var(--space-5)' }}>
              <h3 style={{ fontSize: 'var(--font-size-md)', fontWeight: 700, marginBottom: 'var(--space-3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <CloudRain size={18} style={{ color: '#818CF8' }} /> Yağıntı qeydləri ({rainfalls.length})
              </h3>
              <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr><th>Tarix</th><th>Miqdar</th><th>Sahələr</th><th>Qeyd</th><th></th></tr>
                    </thead>
                    <tbody>
                      {rainfalls.map((rn) => (
                        <tr key={rn.id}>
                          <td style={{ whiteSpace: 'nowrap' }}>{format(new Date(rn.rainfallDate), 'dd MMM yyyy', { locale: az })}</td>
                          <td style={{ fontWeight: 800, color: '#818CF8' }}>{rn.amountMm} mm</td>
                          <td style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                            {rn.fields.length > 0 ? rn.fields.map((rf) => rf.field.fieldNumber).join(', ') : 'Hamısı'}
                          </td>
                          <td style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{rn.notes || '—'}</td>
                          <td>
                            <button className="btn btn-ghost btn-icon" onClick={() => deleteRain(rn.id)} style={{ color: 'var(--color-error)' }}>
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          MODAL: Suvarma qeydi
      ══════════════════════════════════════════════════════════════ */}
      {showIrrModal && (
        <div className="modal-overlay" onClick={() => setShowIrrModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2 className="modal-title"><Droplets size={18} style={{ color: '#10B981' }} /> Suvarma Qeydi</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowIrrModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={submitIrr}>
              {/* Növ */}
              <div className="form-group">
                <label className="form-label">Növ *</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {Object.entries(TYPE_CFG).map(([k, v]) => (
                    <button key={k} type="button"
                      onClick={() => setIrrForm({ ...irrForm, irrigationType: k, pivotSpeed: '', waterMm: '' })}
                      style={{
                        flex: 1, padding: '9px 6px', border: `2px solid ${irrForm.irrigationType === k ? v.color : 'var(--border-primary)'}`,
                        borderRadius: 'var(--radius-md)', background: irrForm.irrigationType === k ? v.bg : 'transparent',
                        cursor: 'pointer', color: irrForm.irrigationType === k ? v.color : 'var(--text-secondary)',
                        fontWeight: 700, fontSize: 12, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', gap: 5, transition: 'all 0.2s',
                      }}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Sahə *</label>
                  <select className="form-select" value={irrForm.fieldId} required
                    onChange={async (e) => {
                      const fId = e.target.value;
                      setIrrForm({ ...irrForm, fieldId: fId, pivotSpeed: '', waterMm: '' });
                      if (fId && irrForm.irrigationType === 'PIVOT') await fetchChart(fId);
                    }}>
                    <option value="">Seçin...</option>
                    {sortedFields.map((f) => <option key={f.id} value={f.id}>{f.farm.name} — {f.fieldNumber}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tarix *</label>
                  <input type="date" className="form-input" value={irrForm.irrigationDate} required
                    onChange={(e) => setIrrForm({ ...irrForm, irrigationDate: e.target.value })} />
                </div>
              </div>

              {irrForm.irrigationType === 'PIVOT' && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Sürət (%)</label>
                    {irrForm.fieldId && pivotCharts[irrForm.fieldId]?.length > 0 ? (
                      <select className="form-select" value={irrForm.pivotSpeed}
                        onChange={(e) => handleSpeedChange(e.target.value)}>
                        <option value="">Seçin...</option>
                        {(pivotCharts[irrForm.fieldId] || []).map((e) => (
                          <option key={e.speed} value={e.speed}>{e.speed}% → {e.mm} mm</option>
                        ))}
                      </select>
                    ) : (
                      <input type="number" className="form-input" placeholder="Məs: 20" value={irrForm.pivotSpeed}
                        onChange={(e) => handleSpeedChange(e.target.value)} min={1} max={100} />
                    )}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Düşən mm *</label>
                    <input type="number" className="form-input" placeholder="35" value={irrForm.waterMm} required
                      onChange={(e) => setIrrForm({ ...irrForm, waterMm: e.target.value })} min={0} step={0.1} />
                  </div>
                </div>
              )}
              {irrForm.irrigationType !== 'PIVOT' && (
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Müddət (saat)</label>
                    <input type="number" className="form-input" placeholder="6" value={irrForm.duration}
                      onChange={(e) => setIrrForm({ ...irrForm, duration: e.target.value })} min={0} step={0.5} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Həcm (m³)</label>
                    <input type="number" className="form-input" placeholder="540" value={irrForm.waterVolume}
                      onChange={(e) => setIrrForm({ ...irrForm, waterVolume: e.target.value })} min={0} />
                  </div>
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Qeyd</label>
                <textarea className="form-textarea" style={{ minHeight: 70 }} value={irrForm.notes}
                  onChange={(e) => setIrrForm({ ...irrForm, notes: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowIrrModal(false)}>Ləğv et</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> Saxlanılır...</> : <><Check size={15} /> Qeyd et</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Yağıntı */}
      {showRainModal && (
        <div className="modal-overlay" onClick={() => setShowRainModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2 className="modal-title"><CloudRain size={18} style={{ color: '#818CF8' }} /> Yağıntı Qeydiyyatı</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowRainModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={submitRain}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Tarix *</label>
                  <input type="date" className="form-input" value={rnForm.rainfallDate} required
                    onChange={(e) => setRnForm({ ...rnForm, rainfallDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">mm *</label>
                  <input type="number" className="form-input" placeholder="12" value={rnForm.amountMm} required
                    onChange={(e) => setRnForm({ ...rnForm, amountMm: e.target.value })} min={0} step={0.1} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Hansı sahələrə düşüb?</label>
                <div style={{ border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden', maxHeight: 300, overflowY: 'auto' }}>
                  <div onClick={() => setRnForm({ ...rnForm, allFields: true, selectedFieldIds: [] })}
                    style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-primary)', background: rnForm.allFields ? 'rgba(16,185,129,0.1)' : 'transparent' }}>
                    <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${rnForm.allFields ? '#10B981' : 'var(--border-primary)'}`, background: rnForm.allFields ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {rnForm.allFields && <Check size={11} color="white" />}
                    </div>
                    <span style={{ fontWeight: 700, fontSize: 'var(--font-size-sm)' }}>Bütün aktiv sahələr</span>
                  </div>
                  {sortedFields.map((f) => {
                    const sel = !rnForm.allFields && rnForm.selectedFieldIds.includes(f.id);
                    return (
                      <div key={f.id}
                        onClick={() => {
                          if (rnForm.allFields) {
                            setRnForm({ ...rnForm, allFields: false, selectedFieldIds: [f.id] });
                          } else {
                            const ids = sel ? rnForm.selectedFieldIds.filter((id) => id !== f.id) : [...rnForm.selectedFieldIds, f.id];
                            setRnForm({ ...rnForm, selectedFieldIds: ids });
                          }
                        }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', borderBottom: '1px solid rgba(255,255,255,0.04)', background: sel ? 'rgba(16,185,129,0.07)' : 'transparent' }}>
                        <div style={{ width: 16, height: 16, borderRadius: 4, border: `2px solid ${sel ? '#10B981' : 'var(--border-primary)'}`, background: sel ? '#10B981' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {sel && <Check size={10} color="white" />}
                        </div>
                        <span style={{ fontSize: 13 }}>{f.farm.name} — {f.fieldNumber}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>{f.hectares}ha</span>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Qeyd</label>
                <input className="form-input" placeholder="Gecə yağışı..." value={rnForm.notes}
                  onChange={(e) => setRnForm({ ...rnForm, notes: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowRainModal(false)}>Ləğv et</button>
                <button type="submit" className="btn btn-primary" disabled={saving || (!rnForm.allFields && rnForm.selectedFieldIds.length === 0)}>
                  {saving ? <><span className="spinner" /></> : <><Check size={15} /> Qeyd et</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Dayanma qeydi */}
      {showStopModal && (
        <div className="modal-overlay" onClick={() => setShowStopModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <h2 className="modal-title"><AlertTriangle size={18} style={{ color: '#EF4444' }} /> Dayanma Qeydi</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowStopModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={submitStop}>
              <div className="form-group">
                <label className="form-label">Sahə *</label>
                <select className="form-select" value={stopForm.fieldId} required
                  onChange={(e) => setStopForm({ ...stopForm, fieldId: e.target.value })}>
                  <option value="">Seçin...</option>
                  {sortedFields.map((f) => <option key={f.id} value={f.id}>{f.farm.name} — {f.fieldNumber}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Başlıq *</label>
                <input className="form-input" placeholder="Məs: Motor nasazlığı" value={stopForm.title} required
                  onChange={(e) => setStopForm({ ...stopForm, title: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Səbəb *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(STOP_CFG).map(([k, v]) => (
                    <button key={k} type="button"
                      onClick={() => setStopForm({ ...stopForm, reason: k })}
                      style={{
                        padding: '6px 12px', border: `2px solid ${stopForm.reason === k ? v.color : 'var(--border-primary)'}`,
                        borderRadius: 'var(--radius-md)', background: stopForm.reason === k ? `${v.color}20` : 'transparent',
                        cursor: 'pointer', color: stopForm.reason === k ? v.color : 'var(--text-secondary)',
                        fontWeight: 600, fontSize: 11, display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                      {v.icon} {v.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Başlama tarixi *</label>
                  <input type="date" className="form-input" value={stopForm.startDate} required
                    onChange={(e) => setStopForm({ ...stopForm, startDate: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Bitmə tarixi <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>(boş = davam edir)</span></label>
                  <input type="date" className="form-input" value={stopForm.endDate}
                    onChange={(e) => setStopForm({ ...stopForm, endDate: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Qeyd</label>
                <textarea className="form-textarea" style={{ minHeight: 70 }} value={stopForm.notes}
                  onChange={(e) => setStopForm({ ...stopForm, notes: e.target.value })} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowStopModal(false)}>Ləğv et</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /></> : <><Check size={15} /> Qeyd et</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Pivot sürət cədvəli */}
      {showPivotModal && (
        <div className="modal-overlay" onClick={() => setShowPivotModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680, width: '96vw', padding: 0, overflow: 'hidden' }}>
            <div className="modal-header" style={{ padding: '14px 20px' }}>
              <h2 className="modal-title"><Gauge size={18} style={{ color: '#10B981' }} /> Pivot Sürət Cədvəli</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowPivotModal(false)}><X size={20} /></button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '190px 1fr', minHeight: 420, maxHeight: '75vh' }}>

              {/* LEFT: field list */}
              <div style={{ borderRight: '1px solid var(--border-primary)', overflowY: 'auto', padding: '8px 6px' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 1, padding: '0 6px 6px' }}>Sahə</div>
                {sortedFields.map((f) => {
                  const chart = pivotCharts[f.id] || [];
                  const isActive = chartField?.id === f.id;
                  return (
                    <div
                      key={f.id}
                      onClick={async () => {
                        setChartField(f);
                        const entries = await fetchChart(f.id);
                        setChartEntries([...entries]);
                      }}
                      style={{
                        padding: '8px 10px', borderRadius: 8, cursor: 'pointer', marginBottom: 2,
                        background: isActive ? 'rgba(16,185,129,0.12)' : 'transparent',
                        border: `1px solid ${isActive ? 'rgba(16,185,129,0.4)' : 'transparent'}`,
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: 12, color: isActive ? '#10B981' : 'var(--text-primary)' }}>
                        {f.fieldNumber}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>{f.farm.name}</div>
                      <div style={{ fontSize: 10, marginTop: 2, color: chart.length > 0 ? '#10B981' : 'var(--text-tertiary)' }}>
                        {chart.length > 0 ? `${chart.length} sətir ✓` : 'boş'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* RIGHT: editor */}
              {chartField ? (
                <div style={{ display: 'flex', flexDirection: 'column', padding: '14px 16px', gap: 10, overflowY: 'auto' }}>
                  {/* Field name + add button */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>{chartField.fieldNumber}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{chartField.farm.name}</div>
                    </div>
                    <button
                      type="button" className="btn btn-primary"
                      style={{ fontSize: 11, padding: '5px 12px', height: 32 }}
                      onClick={() => {
                        const maxSpeed = chartEntries.length > 0 ? Math.max(...chartEntries.map(e => e.speed)) : 0;
                        const nextSpeed = Math.min(100, Math.round((maxSpeed + 10) / 10) * 10);
                        setChartEntries(prev => [...prev, { speed: nextSpeed, mm: 0 }]);
                      }}
                    >
                      <Plus size={13} /> Sətir əlavə
                    </button>
                  </div>

                  {/* Preset speed buttons */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginRight: 2 }}>Sürət:</span>
                    {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map(sp => {
                      const has = chartEntries.some(e => e.speed === sp);
                      return (
                        <button key={sp} type="button"
                          onClick={() => { if (!has) setChartEntries(prev => [...prev, { speed: sp, mm: 0 }]); }}
                          style={{
                            padding: '2px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                            border: `1px solid ${has ? '#10B981' : 'var(--border-primary)'}`,
                            background: has ? 'rgba(16,185,129,0.12)' : 'transparent',
                            color: has ? '#10B981' : 'var(--text-secondary)',
                            cursor: has ? 'default' : 'pointer', transition: 'all 0.15s',
                          }}
                        >{sp}%</button>
                      );
                    })}
                  </div>

                  {/* Table */}
                  <div style={{ border: '1px solid var(--border-primary)', borderRadius: 8, overflow: 'hidden', flex: 1 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--bg-tertiary)' }}>
                          <th style={{ padding: '7px 12px', fontSize: 11, fontWeight: 700, textAlign: 'left' }}>Sürət (%)</th>
                          <th style={{ padding: '7px 12px', fontSize: 11, fontWeight: 700, textAlign: 'left' }}>Su norması (mm)</th>
                          <th style={{ width: 36 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...chartEntries]
                          .map((e, origIdx) => ({ ...e, origIdx }))
                          .sort((a, b) => a.speed - b.speed)
                          .map(({ speed, mm, origIdx }) => (
                            <tr key={origIdx} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                              <td style={{ padding: '5px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input type="number" className="form-input"
                                    value={speed} min={1} max={100} step={1}
                                    onChange={(e) => {
                                      const u = [...chartEntries];
                                      u[origIdx] = { ...u[origIdx], speed: parseFloat(e.target.value) || 0 };
                                      setChartEntries(u);
                                    }}
                                    style={{ padding: '4px 8px', height: 34, width: '100%' }}
                                  />
                                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>%</span>
                                </div>
                              </td>
                              <td style={{ padding: '5px 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input type="number" className="form-input"
                                    value={mm} min={0} step={0.1}
                                    onChange={(e) => {
                                      const u = [...chartEntries];
                                      u[origIdx] = { ...u[origIdx], mm: parseFloat(e.target.value) || 0 };
                                      setChartEntries(u);
                                    }}
                                    style={{ padding: '4px 8px', height: 34, width: '100%' }}
                                  />
                                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', flexShrink: 0 }}>mm</span>
                                </div>
                              </td>
                              <td style={{ padding: '5px', textAlign: 'center' }}>
                                <button type="button"
                                  onClick={() => setChartEntries(chartEntries.filter((_, j) => j !== origIdx))}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-error)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        {chartEntries.length === 0 && (
                          <tr>
                            <td colSpan={3} style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
                              ↑ Yuxarıdan sürət sətri əlavə edin
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="modal-footer" style={{ padding: 0, borderTop: 'none' }}>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowPivotModal(false)}>Ləğv et</button>
                    <button type="button" className="btn btn-primary" onClick={saveChart}><Check size={15} /> Saxla</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                  ← Sahəni seçin
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Deadline (interval) */}
      {showIntervalModal && (
        <div className="modal-overlay" onClick={() => setShowIntervalModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title"><Timer size={18} style={{ color: '#10B981' }} /> Suvarma Deadline</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowIntervalModal(false)}><X size={20} /></button>
            </div>
            {!intervalField ? (
              <div className="form-group">
                <label className="form-label">Sahə seçin</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 360, overflowY: 'auto' }}>
                  {sortedFields.map((f) => (
                    <div key={f.id}
                      onClick={() => { setIntervalField(f); setIntervalDays(String(f.irrigationIntervalDays || '')); }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-primary)', cursor: 'pointer', background: 'transparent', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{f.fieldNumber}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{f.farm.name}</div>
                      </div>
                      <span style={{ fontSize: 12, color: f.irrigationIntervalDays ? '#10B981' : 'var(--text-tertiary)', fontWeight: 600 }}>
                        {f.irrigationIntervalDays ? `${f.irrigationIntervalDays} gün` : '+ Əlavə et'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <>
                <div style={{ padding: '10px 0 16px', borderBottom: '1px solid var(--border-primary)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button onClick={() => setIntervalField(null)} className="btn btn-ghost btn-icon" style={{ width: 28, height: 28 }}>
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontWeight: 600 }}>{intervalField.farm.name} — {intervalField.fieldNumber}</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Maksimum suvarma aralığı (gün)</label>
                  <p style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 8 }}>
                    Son suvarmadan bu qədər gün keçsə, aylıq cədvəldə xəbərdarlıq göstərilir.
                  </p>
                  <input type="number" className="form-input" placeholder="Məs: 7" value={intervalDays}
                    onChange={(e) => setIntervalDays(e.target.value)} min={1} max={60} />
                  <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
                    {[3, 5, 7, 10, 14].map((d) => (
                      <button key={d} type="button" className="btn btn-ghost"
                        style={{ fontSize: 12, padding: '4px 12px', border: `1px solid ${intervalDays === String(d) ? '#10B981' : 'var(--border-primary)'}`, color: intervalDays === String(d) ? '#10B981' : 'var(--text-secondary)' }}
                        onClick={() => setIntervalDays(String(d))}>
                        {d} gün
                      </button>
                    ))}
                    <button type="button" className="btn btn-ghost"
                      style={{ fontSize: 12, padding: '4px 12px', color: 'var(--color-error)', border: '1px solid var(--border-primary)' }}
                      onClick={() => setIntervalDays('')}>
                      Sil
                    </button>
                  </div>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-secondary" onClick={() => setShowIntervalModal(false)}>Ləğv et</button>
                  <button type="button" className="btn btn-primary" onClick={saveInterval}><Check size={15} /> Saxla</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
