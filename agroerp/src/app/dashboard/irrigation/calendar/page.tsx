'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Droplets, Plus, X, CloudRain, ChevronLeft, ChevronRight,
  RotateCcw, Wind, AlertTriangle, Check,
  Wrench, Zap, AlertOctagon, Settings2, Waves, Wheat,
  Send, Copy, CheckCheck, CalendarPlus, Trash2,
  Tractor, Maximize2, Minimize2, Clock,
} from 'lucide-react';
import { format, getDaysInMonth, differenceInDays, addDays } from 'date-fns';
import { useToast } from '@/components/Toast';

// ─── Types ─────────────────────────────────────────────────────────────────
interface SeasonFieldInfo {
  cropType: string;
  season: { id: string; name: string; status: string };
}

interface Field {
  id: string; fieldNumber: string; hectares: number;
  irrigationIntervalDays: number | null;
  farmId: string;
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

const WEEKDAYS_AZ = ['B.', 'B.e', 'Ç.a', 'Ç.', 'C.a', 'C.', 'Ş.'];

const TYPE_CFG: Record<string, { label: string; color: string; bg: string }> = {
  PIVOT:     { label: 'Pivot',     color: '#10B981', bg: 'rgba(16,185,129,0.18)' },
  SPRINKLER: { label: 'Sprinkler', color: '#3B82F6', bg: 'rgba(59,130,246,0.18)' },
  DRIP:      { label: 'Damlama',   color: '#F59E0B', bg: 'rgba(245,158,11,0.18)' },
};

const STOP_CFG: Record<string, { label: string; color: string }> = {
  BREAKDOWN:      { label: 'Nasazlıq',        color: '#EF4444' },
  MAINTENANCE:    { label: 'Texniki baxım',   color: '#8B5CF6' },
  POWER_OUTAGE:   { label: 'Elektrik kəsildi', color: '#F59E0B' },
  WATER_SHORTAGE: { label: 'Su yoxdur',       color: '#06B6D4' },
  OTHER:          { label: 'Digər',           color: '#6B7280' },
};

// Crop color palette
const CROP_COLORS: Record<string, { color: string; bg: string }> = {};
const CROP_PALETTE = [
  { color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  { color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  { color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  { color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)' },
  { color: '#EC4899', bg: 'rgba(236,72,153,0.15)' },
  { color: '#06B6D4', bg: 'rgba(6,182,212,0.15)' },
];
function getCropColor(crop: string) {
  if (!CROP_COLORS[crop]) {
    const idx = Object.keys(CROP_COLORS).length % CROP_PALETTE.length;
    CROP_COLORS[crop] = CROP_PALETTE[idx];
  }
  return CROP_COLORS[crop];
}

function mmToIntensity(mm: number): string {
  if (mm <= 0) return 'transparent';
  if (mm < 10) return 'rgba(16,185,129,0.18)';
  if (mm < 20) return 'rgba(16,185,129,0.35)';
  if (mm < 30) return 'rgba(16,185,129,0.50)';
  return 'rgba(16,185,129,0.68)';
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export default function IrrigationCalendarPage() {
  const { showToast } = useToast();
  const now = new Date();

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [cropFilter, setCropFilter] = useState<string>('ALL');
  const [farmFilter, setFarmFilter] = useState<string>('ALL');
  const [compact, setCompact] = useState(false);

  const [fields, setFields] = useState<Field[]>([]);
  const [irrigations, setIrrigations] = useState<Irrigation[]>([]);
  const [rainfalls, setRainfalls] = useState<Rainfall[]>([]);
  const [stoppages, setStoppages] = useState<Stoppage[]>([]);
  const [loading, setLoading] = useState(true);
  const [pivotCharts, setPivotCharts] = useState<Record<string, SpeedEntry[]>>({});

  // Quick-add
  const [quickCell, setQuickCell] = useState<{ fieldId: string; day: number } | null>(null);
  const [quickForm, setQuickForm] = useState({ pivotSpeed: '', waterMm: '' });
  const [saving, setSaving] = useState(false);

  // Detail/delete popover
  const [detailCell, setDetailCell] = useState<{ fieldId: string; day: number } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ─── Mesaj modal
  const [showMsgModal, setShowMsgModal] = useState(false);
  const [msgDate, setMsgDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [msgShift, setMsgShift] = useState<'day' | 'night' | 'general'>('day');
  const [copied, setCopied] = useState(false);

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const safeJson = async (res: Response, fallback: any = []) => {
    try {
      if (!res.ok) return fallback;
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
    } finally { setLoading(false); }
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

  // ─── Delete irrigation ───────────────────────────────────────────────────
  const deleteIrrigation = async (irrId: string) => {
    setDeleting(irrId);
    try {
      const res = await fetch(`/api/irrigation/${irrId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Suvarma silindi', 'success');
      setDetailCell(null);
      fetchAll();
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setDeleting(null); }
  };

  // ─── Computed ────────────────────────────────────────────────────────────
  const cropTypes = useMemo(() => {
    const set = new Set<string>();
    for (const f of fields) {
      for (const sf of f.seasonFields) {
        if (sf.season.status === 'ACTIVE' || sf.season.status === 'PLANNED') set.add(sf.cropType);
      }
    }
    return Array.from(set).sort();
  }, [fields]);

  const farmOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of fields) map.set(f.farmId, f.farm.name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [fields]);

  const getFieldCrop = (field: Field): string | null => {
    const active = field.seasonFields.find(sf => sf.season.status === 'ACTIVE' || sf.season.status === 'PLANNED');
    return active?.cropType || null;
  };

  function naturalSort(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] ?? -1;
      const nb = pb[i] ?? -1;
      if (na !== nb) return na - nb;
    }
    return 0;
  }

  const sortedFields = useMemo(() =>
    [...fields].sort((a, b) => {
      const farmCmp = a.farm.name.localeCompare(b.farm.name);
      if (farmCmp !== 0) return farmCmp;
      return naturalSort(a.fieldNumber, b.fieldNumber);
    }), [fields]
  );

  const filteredFields = useMemo(() => {
    return sortedFields.filter(f => {
      if (farmFilter !== 'ALL' && f.farmId !== farmFilter) return false;
      if (cropFilter !== 'ALL' && getFieldCrop(f) !== cropFilter) return false;
      return true;
    });
  }, [sortedFields, farmFilter, cropFilter]);

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

  const rainMap = useMemo(() => {
    const m: Record<string, Rainfall[]> = {};
    for (const r of rainfalls) {
      const d = format(new Date(r.rainfallDate), 'yyyy-MM-dd');
      if (!m[d]) m[d] = [];
      m[d].push(r);
    }
    return m;
  }, [rainfalls]);

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

  const fieldMonthlyMm = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of irrigations) {
      if (i.waterMm) m[i.fieldId] = (m[i.fieldId] || 0) + i.waterMm;
    }
    return m;
  }, [irrigations]);

  const fieldMonthlyCombined = useMemo(() => {
    const m: Record<string, number> = { ...fieldMonthlyMm };
    for (const r of rainfalls) {
      for (const rf of r.fields) m[rf.fieldId] = (m[rf.fieldId] || 0) + r.amountMm;
    }
    return m;
  }, [fieldMonthlyMm, rainfalls]);

  const fieldLastIrr = useMemo(() => {
    const m: Record<string, Date> = {};
    for (const i of irrigations) {
      const d = new Date(i.irrigationDate);
      if (!m[i.fieldId] || d > m[i.fieldId]) m[i.fieldId] = d;
    }
    return m;
  }, [irrigations]);

  const fieldMonthlyCount = useMemo(() => {
    const m: Record<string, number> = {};
    for (const i of irrigations) m[i.fieldId] = (m[i.fieldId] || 0) + 1;
    return m;
  }, [irrigations]);

  const totalMm = useMemo(() => irrigations.reduce((s, i) => s + (i.waterMm || 0), 0), [irrigations]);
  const totalRainMm = useMemo(() => rainfalls.reduce((s, r) => s + r.amountMm, 0), [rainfalls]);

  // ─── Interval forecast ───────────────────────────────────────────────────
  const fieldForecastDays = useMemo(() => {
    const result: Record<string, Set<number>> = {};
    for (const field of filteredFields) {
      const interval = field.irrigationIntervalDays;
      if (!interval) continue;
      const lastIrr = fieldLastIrr[field.id];
      if (!lastIrr) continue;
      const forecast = new Set<number>();
      let nextDate = addDays(lastIrr, interval);
      for (let i = 0; i < 10; i++) {
        if (nextDate.getFullYear() === viewYear && nextDate.getMonth() === viewMonth) {
          forecast.add(nextDate.getDate());
        }
        nextDate = addDays(nextDate, interval);
        if (nextDate.getFullYear() > viewYear || (nextDate.getFullYear() === viewYear && nextDate.getMonth() > viewMonth)) break;
      }
      if (forecast.size > 0) result[field.id] = forecast;
    }
    return result;
  }, [filteredFields, fieldLastIrr, viewYear, viewMonth]);

  // ─── Pivot speed → mm ────────────────────────────────────────────────────
  const speedToMm = (speed: number, chart: SpeedEntry[]): number | null => {
    if (!chart.length) return null;
    const exact = chart.find((e) => e.speed === speed);
    if (exact) return exact.mm;
    const sorted = [...chart].sort((a, b) => a.speed - b.speed);
    let lo = sorted[0], hi = sorted[sorted.length - 1];
    for (const e of sorted) { if (e.speed <= speed) lo = e; }
    for (let i = sorted.length - 1; i >= 0; i--) { if (sorted[i].speed >= speed) hi = sorted[i]; else break; }
    if (lo.speed === hi.speed) return lo.mm;
    const ratio = (speed - lo.speed) / (hi.speed - lo.speed);
    return Math.round(lo.mm + ratio * (hi.mm - lo.mm));
  };

  const handleQuickSpeedChange = async (speed: string, fieldId: string) => {
    setQuickForm((prev) => ({ ...prev, pivotSpeed: speed }));
    if (!speed || !fieldId) return;
    let chart = pivotCharts[fieldId];
    if (!chart) chart = await fetchChart(fieldId);
    const mm = speedToMm(parseFloat(speed), chart);
    if (mm !== null) setQuickForm((prev) => ({ ...prev, waterMm: String(mm) }));
  };

  const submitQuick = async () => {
    if (!quickCell || !quickForm.waterMm) return;
    setSaving(true);
    try {
      const dateStr = format(new Date(viewYear, viewMonth, quickCell.day), 'yyyy-MM-dd');
      const res = await fetch('/api/irrigation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fieldId: quickCell.fieldId, irrigationType: 'PIVOT',
          irrigationDate: dateStr,
          pivotSpeed: quickForm.pivotSpeed || null,
          waterMm: quickForm.waterMm,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error);
      showToast('Suvarma qeyd edildi', 'success');
      setQuickCell(null); setQuickForm({ pivotSpeed: '', waterMm: '' });
      fetchAll();
    } catch (err: any) { showToast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const navigateMonth = (dir: -1 | 1) => {
    let m = viewMonth + dir, y = viewYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setViewMonth(m); setViewYear(y);
  };

  // ─── Mesaj generatoru ────────────────────────────────────────────────────
  const generateMessage = (dateStr: string, shift: 'day' | 'night' | 'general'): string => {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return '(Tarix seçilməyib)';
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    const dateFormatted = format(d, 'dd.MM.yyyy');
    const dayIrrsForDate = irrMap[dateStr] || {};

    const shiftLine =
      shift === 'day' ? ' | 🌤 Gündüz növbəsi' :
      shift === 'night' ? ' | 🌙 Gecə növbəsi' : '';

    const entries: string[] = [];
    let idx = 1;

    for (const field of filteredFields) {
      const fieldIrrs = dayIrrsForDate[field.id] || [];
      if (fieldIrrs.length === 0) continue;
      const crop = getFieldCrop(field) || '';
      for (const irr of fieldIrrs) {
        const speedPart = irr.pivotSpeed != null ? ` Sürət: ${irr.pivotSpeed}%` : '';
        const mmPart = irr.waterMm != null ? ` (${irr.waterMm} mm)` : '';
        const farmPart = field.farm.name;
        const haPart = `${field.hectares}ha`;
        entries.push(
          `${idx}. 🌱 ${field.fieldNumber}${crop ? ` [${crop}]` : ''}\n   📍 ${farmPart} · ${haPart}${speedPart ? '\n   ⚡' + speedPart : ''}${mmPart ? '\n   💧' + mmPart : ''}`
        );
        idx++;
      }
    }

    const header = `📅 Tarix: ${dateFormatted}${shiftLine}\n🚜 Suvarma planı:\n${'─'.repeat(22)}`;

    if (entries.length === 0) {
      return `${header}\n\n(Bu tarix üçün plan qeyd edilməyib)`;
    }

    return `${header}\n\n${entries.join('\n\n')}`;
  };

  const copyMessage = () => {
    const text = generateMessage(msgDate, msgShift);
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const cellW = compact ? 38 : 52;

  if (loading) return (
    <div className="page-content">
      <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Yüklənir...</div></div>
    </div>
  );

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="page-content" onClick={() => { setQuickCell(null); setDetailCell(null); }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-left">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <a
              href="/dashboard/irrigation"
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                fontSize: 12, color: 'var(--text-tertiary)', textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}
            >
              <ChevronLeft size={14} /> Suvarma
            </a>
          </div>
          <h1 className="page-title">Suvarma Cədvəli</h1>
          <p className="page-description">
            {MONTHS_AZ[viewMonth]} {viewYear} · {filteredFields.length} sahə · {totalMm.toFixed(0)} mm suvarma · {totalRainMm.toFixed(0)} mm yağıntı
          </p>
        </div>
        {/* Header right actions */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setCompact(!compact); }}
            className="btn btn-ghost btn-icon"
            title={compact ? 'Geniş görünüş' : 'Kompakt görünüş'}
          >
            {compact ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setShowMsgModal(true); }}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700 }}
          >
            <Send size={15} /> Plan Paylaş
          </button>
        </div>
      </div>

      {/* ── Mini Stats ─────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap',
      }}>
        {[
          { val: `${totalMm.toFixed(0)} mm`, label: 'Suvarma', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
          { val: `${totalRainMm.toFixed(0)} mm`, label: 'Yağıntı', color: '#818CF8', bg: 'rgba(129,140,248,0.12)' },
          { val: irrigations.length, label: 'Qeyd sayı', color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
          { val: stoppages.filter(s => !s.endDate).length, label: 'Aktiv dayanma', color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
        ].map((s, i) => (
          <div key={i} style={{
            padding: '10px 18px', borderRadius: 'var(--radius-lg)', background: s.bg,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <span style={{ fontWeight: 800, fontSize: 'var(--font-size-lg)', color: s.color }}>{s.val}</span>
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', fontWeight: 500 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Filters ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 'var(--space-3)' }}>
        {/* Row 1: Farm + Crop filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          {/* Farm filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tractor size={14} style={{ color: 'var(--text-tertiary)' }} />
            <select
              className="form-select"
              value={farmFilter}
              onChange={(e) => setFarmFilter(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', minWidth: 130 }}
            >
              <option value="ALL">Bütün təsərrüfatlar</option>
              {farmOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          <div style={{ width: 1, height: 22, background: 'var(--border-primary)' }} />

          {/* Crop filter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
            <Wheat size={15} style={{ color: 'var(--text-tertiary)' }} />
            <button onClick={() => setCropFilter('ALL')}
              style={{
                padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
                background: cropFilter === 'ALL' ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                color: cropFilter === 'ALL' ? 'white' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: 12, transition: 'all 0.2s',
              }}>
              Hamısı ({sortedFields.length})
            </button>
            {cropTypes.map(crop => {
              const count = sortedFields.filter(f => getFieldCrop(f) === crop).length;
              const cc = getCropColor(crop);
              return (
                <button key={crop} onClick={() => setCropFilter(crop)}
                  style={{
                    padding: '5px 14px', borderRadius: 20, cursor: 'pointer',
                    border: cropFilter === crop ? `2px solid ${cc.color}` : '2px solid transparent',
                    background: cropFilter === crop ? cc.bg : 'var(--bg-tertiary)',
                    color: cropFilter === crop ? cc.color : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: 12, transition: 'all 0.2s',
                  }}>
                  {crop} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Month Navigator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); navigateMonth(-1); }}><ChevronLeft size={18} /></button>
          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', minWidth: 190, textAlign: 'center' }}>
            {MONTHS_AZ[viewMonth]} {viewYear}
          </span>
          <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); navigateMonth(1); }}><ChevronRight size={18} /></button>
          {(viewYear !== now.getFullYear() || viewMonth !== now.getMonth()) && (
            <button className="btn btn-ghost" style={{ fontSize: 'var(--font-size-sm)' }}
              onClick={(e) => { e.stopPropagation(); setViewYear(now.getFullYear()); setViewMonth(now.getMonth()); }}>
              Bu ay
            </button>
          )}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          CALENDAR MATRIX
      ══════════════════════════════════════════════════════════════ */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed',
            minWidth: `${210 + daysInMonth * cellW + 120}px`,
          }}>
            <colgroup>
              <col style={{ width: 210 }} />
              {calendarDays.map(d => <col key={d} style={{ width: cellW }} />)}
              <col style={{ width: 120 }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)' }}>
                <th style={{
                  position: 'sticky', left: 0, top: 0, zIndex: 10, background: 'var(--bg-tertiary)',
                  padding: compact ? '8px 12px' : '12px 18px', textAlign: 'left', fontSize: 12,
                  fontWeight: 700, borderBottom: '2px solid var(--border-primary)',
                  borderRight: '2px solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}>
                  Sahə
                </th>
                {calendarDays.map((day) => {
                  const dk = format(new Date(viewYear, viewMonth, day), 'yyyy-MM-dd');
                  const hasRain = !!rainMap[dk];
                  const isToday = viewYear === now.getFullYear() && viewMonth === now.getMonth() && day === now.getDate();
                  const dow = new Date(viewYear, viewMonth, day).getDay();
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <th key={day} style={{
                      position: 'sticky', top: 0, zIndex: 5,
                      padding: compact ? '5px 2px' : '7px 3px', textAlign: 'center',
                      borderBottom: '2px solid var(--border-primary)',
                      background: isToday ? 'rgba(16,185,129,0.22)' : isWeekend ? 'rgba(255,255,255,0.015)' : 'var(--bg-tertiary)',
                    }}>
                      {!compact && (
                        <div style={{
                          fontSize: 9, fontWeight: 500, color: 'var(--text-tertiary)',
                          marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.3px',
                        }}>
                          {WEEKDAYS_AZ[dow]}
                        </div>
                      )}
                      <div style={{
                        fontSize: compact ? 10 : 14, fontWeight: isToday ? 800 : 600,
                        color: isToday ? '#10B981' : isWeekend ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                      }}>
                        {day}
                      </div>
                      {hasRain && (
                        <div title={rainMap[dk].map(r => r.amountMm + 'mm').join(' + ')}>
                          <CloudRain size={compact ? 9 : 13} style={{ color: '#818CF8' }} />
                        </div>
                      )}
                    </th>
                  );
                })}
                <th style={{
                  position: 'sticky', right: 0, top: 0, zIndex: 10, background: 'var(--bg-tertiary)',
                  padding: compact ? '8px 10px' : '12px 14px', textAlign: 'right', fontSize: 13,
                  fontWeight: 700, borderBottom: '2px solid var(--border-primary)',
                  borderLeft: '2px solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}>
                  Cəmi
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredFields.map((field, fIdx) => {
                const monthMm = fieldMonthlyMm[field.id] || 0;
                const combinedMm = fieldMonthlyCombined[field.id] || 0;
                const monthCount = fieldMonthlyCount[field.id] || 0;
                const lastDate = fieldLastIrr[field.id];
                const interval = field.irrigationIntervalDays;
                const daysSince = lastDate ? differenceInDays(now, lastDate) : null;
                const isOverdue = interval && daysSince !== null && daysSince > interval;
                const isWarning = interval && daysSince !== null && daysSince >= interval - 2 && !isOverdue;
                const crop = getFieldCrop(field);
                const cc = crop ? getCropColor(crop) : null;
                const rowBg = fIdx % 2 === 0 ? 'var(--bg-card)' : 'rgba(255,255,255,0.008)';
                const forecastDays = fieldForecastDays[field.id] || new Set<number>();

                return (
                  <tr key={field.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                    {/* ── Sahə info ── */}
                    <td style={{
                      position: 'sticky', left: 0, zIndex: 2, background: rowBg,
                      padding: compact ? '6px 12px' : '10px 18px',
                      borderRight: '2px solid var(--border-primary)',
                      borderLeft: cc ? `4px solid ${cc.color}` : '4px solid transparent',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        {isOverdue && <AlertTriangle size={14} style={{ color: '#EF4444', flexShrink: 0 }} />}
                        {isWarning && !isOverdue && <AlertTriangle size={14} style={{ color: '#F59E0B', flexShrink: 0 }} />}
                        <span style={{ fontWeight: 800, fontSize: compact ? 13 : 15 }}>{field.fieldNumber}</span>
                        {crop && cc && (
                          <span style={{
                            fontSize: 9, fontWeight: 700, color: cc.color, background: cc.bg,
                            borderRadius: 4, padding: '1px 5px',
                          }}>
                            {crop}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2, display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span>{field.farm.name}</span>
                        <span>·</span>
                        <span>{field.hectares}ha</span>
                      </div>
                      {!compact && (
                        <div style={{
                          fontSize: 9, marginTop: 2, fontWeight: 600,
                          color: isOverdue ? '#EF4444' : isWarning ? '#F59E0B' : 'var(--text-tertiary)',
                          display: 'flex', alignItems: 'center', gap: 3,
                        }}>
                          <Clock size={9} />
                          {interval ? (
                            <span
                              title="Klikləyin intervalı dəyişmək üçün"
                              style={{ cursor: 'pointer', borderBottom: '1px dashed currentColor' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const newVal = prompt(`${field.fieldNumber} üçün suvarma intervalı (gün):`, String(interval || ''));
                                if (newVal !== null) {
                                  const days = parseInt(newVal, 10);
                                  fetch(`/api/fields/${field.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ irrigationIntervalDays: isNaN(days) ? null : days }),
                                  }).then(() => fetchAll());
                                }
                              }}
                            >
                              hər {interval}g
                            </span>
                          ) : (
                            <span
                              style={{ cursor: 'pointer', borderBottom: '1px dashed currentColor', opacity: 0.6 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                const newVal = prompt(`${field.fieldNumber} üçün suvarma intervalı (gün):`, '');
                                if (newVal !== null) {
                                  const days = parseInt(newVal, 10);
                                  if (!isNaN(days) && days > 0) {
                                    fetch(`/api/fields/${field.id}`, {
                                      method: 'PATCH',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ irrigationIntervalDays: days }),
                                    }).then(() => fetchAll());
                                  }
                                }
                              }}
                            >
                              interval yox
                            </span>
                          )}
                          {daysSince !== null && <span>· son {daysSince}g əvvəl</span>}
                        </div>
                      )}
                    </td>

                    {/* ── Day cells ── */}
                    {calendarDays.map((day) => {
                      const dk = format(new Date(viewYear, viewMonth, day), 'yyyy-MM-dd');
                      const dayIrrs = irrMap[dk]?.[field.id] || [];
                      const dayRains = rainMap[dk]?.filter(r => r.fields.some(rf => rf.fieldId === field.id)) || [];
                      const stoppage = isStoppedOnDay(field.id, day);
                      const isToday = viewYear === now.getFullYear() && viewMonth === now.getMonth() && day === now.getDate();
                      const isForecast = forecastDays.has(day);
                      const cellMm = dayIrrs.reduce((s, i) => s + (i.waterMm || 0), 0) +
                                     dayRains.reduce((s, r) => s + r.amountMm, 0);

                      let cellBg = 'transparent';
                      if (isToday) cellBg = 'rgba(16,185,129,0.06)';
                      if (stoppage) cellBg = 'rgba(239,68,68,0.08)';
                      else if (cellMm > 0) cellBg = mmToIntensity(cellMm);

                      const isQuickOpen = quickCell?.fieldId === field.id && quickCell?.day === day;
                      const isDetailOpen = detailCell?.fieldId === field.id && detailCell?.day === day;
                      const isEmpty = dayIrrs.length === 0 && dayRains.length === 0 && !stoppage;
                      const isFuture = new Date(viewYear, viewMonth, day) > now;

                      if (isFuture && isEmpty && !isForecast) cellBg = 'transparent';

                      const forecastOutline = isForecast && isEmpty
                        ? '2px solid rgba(245,158,11,0.55)'
                        : undefined;

                      return (
                        <td key={day}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (dayIrrs.length > 0) {
                              if (isDetailOpen) setDetailCell(null);
                              else { setDetailCell({ fieldId: field.id, day }); setQuickCell(null); }
                            } else if (!stoppage) {
                              if (isQuickOpen) setQuickCell(null);
                              else {
                                setQuickCell({ fieldId: field.id, day });
                                setDetailCell(null);
                                setQuickForm({ pivotSpeed: '', waterMm: '' });
                                fetchChart(field.id);
                              }
                            }
                          }}
                          style={{
                            padding: compact ? '3px 2px' : '5px 3px', textAlign: 'center',
                            verticalAlign: 'middle',
                            background: cellBg, position: 'relative',
                            height: compact ? 44 : 60,
                            borderLeft: isFuture ? '1px solid rgba(99,102,241,0.12)' : '1px solid rgba(255,255,255,0.04)',
                            cursor: stoppage && dayIrrs.length === 0 ? 'default' : 'pointer',
                            transition: 'background 0.15s',
                            outline: forecastOutline,
                            outlineOffset: '-2px',
                          }}
                          onMouseEnter={(e) => {
                            if (!(stoppage && dayIrrs.length === 0) && !isDetailOpen && !isQuickOpen)
                              e.currentTarget.style.background =
                                dayIrrs.length > 0
                                  ? 'rgba(239,68,68,0.10)'
                                  : isForecast
                                    ? 'rgba(245,158,11,0.10)'
                                    : isFuture
                                      ? 'rgba(99,102,241,0.07)'
                                      : 'rgba(16,185,129,0.10)';
                          }}
                          onMouseLeave={(e) => {
                            if (!isDetailOpen && !isQuickOpen)
                              e.currentTarget.style.background = cellBg;
                          }}
                        >
                          {/* Stoppage */}
                          {stoppage && dayIrrs.length === 0 && (
                            <div title={`${stoppage.title} — ${STOP_CFG[stoppage.reason]?.label}`}
                              style={{ fontSize: compact ? 12 : 14, color: STOP_CFG[stoppage.reason]?.color || '#EF4444' }}>
                              ⛔
                            </div>
                          )}
                          {/* Irrigations */}
                          {dayIrrs.map((irr, i) => {
                            const cfg = TYPE_CFG[irr.irrigationType] || TYPE_CFG.DRIP;
                            const isPlan = isFuture;
                            return (
                              <div key={i}
                                title={`${cfg.label}: ${irr.waterMm || '?'} mm ${irr.pivotSpeed ? '(' + irr.pivotSpeed + '%)' : ''}${isPlan ? ' — PLAN' : ''}`}
                                style={{
                                  fontSize: compact ? 11 : 13, fontWeight: 800,
                                  color: isPlan ? '#6366F1' : cfg.color,
                                  lineHeight: 1.5, opacity: isPlan ? 0.9 : 1,
                                }}>
                                {irr.waterMm != null ? `${irr.waterMm}` : '✓'}
                                {irr.pivotSpeed != null && (
                                  <div style={{ fontSize: compact ? 8 : 10, fontWeight: 600, opacity: 0.75 }}>{irr.pivotSpeed}%</div>
                                )}
                                {isPlan && <div style={{ fontSize: compact ? 7 : 9, color: '#6366F1', fontWeight: 700 }}>PLAN</div>}
                              </div>
                            );
                          })}
                          {/* Rainfall */}
                          {dayRains.map((rn, i) => (
                            <div key={`rn-${i}`}
                              title={`Yağıntı: ${rn.amountMm} mm`}
                              style={{ fontSize: compact ? 9 : 11, fontWeight: 700, color: '#818CF8' }}>
                              {rn.amountMm}☁
                            </div>
                          ))}
                          {/* Empty hints */}
                          {isEmpty && !isFuture && !isForecast && (
                            <div style={{ fontSize: 16, color: 'var(--text-tertiary)', opacity: 0.15, lineHeight: compact ? '38px' : '50px' }}>+</div>
                          )}
                          {isEmpty && isFuture && !isForecast && (
                            <div style={{ fontSize: 16, color: '#6366F1', opacity: 0.12, lineHeight: compact ? '38px' : '50px' }}>
                              <CalendarPlus size={compact ? 10 : 13} />
                            </div>
                          )}
                          {isEmpty && isForecast && (
                            <div style={{ color: '#F59E0B', opacity: 0.55, lineHeight: compact ? '38px' : '50px' }}>
                              <Clock size={compact ? 9 : 12} />
                            </div>
                          )}

                          {/* ── Quick-add popover ── */}
                          {isQuickOpen && (
                            <div onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                                zIndex: 100, background: 'var(--bg-card)', border: `1px solid ${isFuture ? '#6366F1' : 'var(--border-primary)'}`,
                                borderRadius: 'var(--radius-lg)', padding: 14, minWidth: 210,
                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                              }}>
                              <div style={{
                                fontSize: 12, fontWeight: 700, marginBottom: 10,
                                color: 'var(--text-primary)',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              }}>
                                <span>
                                  {field.fieldNumber} · <span style={{ color: isFuture ? '#6366F1' : '#10B981' }}>{day} {MONTHS_AZ[viewMonth]}</span>
                                  {isFuture && <span style={{ fontSize: 10, background: 'rgba(99,102,241,0.15)', color: '#6366F1', borderRadius: 4, padding: '1px 5px', marginLeft: 5 }}>PLAN</span>}
                                </span>
                                <button onClick={(e) => { e.stopPropagation(); setQuickCell(null); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}>
                                  <X size={14} />
                                </button>
                              </div>
                              {pivotCharts[field.id]?.length > 0 ? (
                                <select className="form-select" value={quickForm.pivotSpeed}
                                  onChange={(e) => handleQuickSpeedChange(e.target.value, field.id)}
                                  style={{ fontSize: 12, padding: '6px 8px', marginBottom: 8, width: '100%' }}>
                                  <option value="">Sürət seçin...</option>
                                  {(pivotCharts[field.id] || []).map((e) => (
                                    <option key={e.speed} value={e.speed}>{e.speed}% → {e.mm} mm</option>
                                  ))}
                                </select>
                              ) : (
                                <input type="number" className="form-input" placeholder="Sürət (%)"
                                  value={quickForm.pivotSpeed}
                                  onChange={(e) => handleQuickSpeedChange(e.target.value, field.id)}
                                  style={{ fontSize: 12, padding: '6px 8px', marginBottom: 8, width: '100%' }}
                                  min={1} max={100} />
                              )}
                              <input type="number" className="form-input" placeholder="mm *"
                                value={quickForm.waterMm}
                                onChange={(e) => setQuickForm({ ...quickForm, waterMm: e.target.value })}
                                style={{ fontSize: 12, padding: '6px 8px', marginBottom: 10, width: '100%' }}
                                min={0} step={0.1} required />
                              <div style={{ display: 'flex', gap: 6 }}>
                                <button onClick={(e) => { e.stopPropagation(); setQuickCell(null); }}
                                  className="btn btn-ghost" style={{ fontSize: 11, padding: '5px 12px', flex: 1 }}>
                                  Ləğv
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); submitQuick(); }}
                                  className="btn btn-primary" style={{ fontSize: 11, padding: '5px 12px', flex: 1 }}
                                  disabled={saving || !quickForm.waterMm}>
                                  {saving ? <span className="spinner" /> : <><Check size={12} /> Əlavə et</>}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* ── Detail/Delete popover ── */}
                          {isDetailOpen && dayIrrs.length > 0 && (
                            <div onClick={(e) => e.stopPropagation()}
                              style={{
                                position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                                zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                                borderRadius: 'var(--radius-lg)', padding: 12, minWidth: 220,
                                boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                              }}>
                              <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ color: 'var(--text-primary)' }}>{field.fieldNumber} · {day} {MONTHS_AZ[viewMonth]}</span>
                                <button onClick={(e) => { e.stopPropagation(); setDetailCell(null); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}>
                                  <X size={14} />
                                </button>
                              </div>
                              {dayIrrs.map((irr) => {
                                const cfg = TYPE_CFG[irr.irrigationType] || TYPE_CFG.DRIP;
                                return (
                                  <div key={irr.id} style={{
                                    background: 'var(--bg-tertiary)', borderRadius: 8,
                                    padding: '7px 10px', marginBottom: 6,
                                    border: `1px solid ${cfg.bg}`,
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                                      <div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
                                        {irr.waterMm != null && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>💧 {irr.waterMm} mm</div>}
                                        {irr.pivotSpeed != null && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>⚡ {irr.pivotSpeed}%</div>}
                                        {irr.duration != null && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>⏱ {irr.duration}s</div>}
                                        <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{irr.user?.fullName}</div>
                                      </div>
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteIrrigation(irr.id); }}
                                        disabled={deleting === irr.id}
                                        title="Sil"
                                        style={{
                                          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                                          borderRadius: 6, cursor: 'pointer', padding: '4px 7px',
                                          color: '#EF4444', flexShrink: 0, display: 'flex', alignItems: 'center',
                                        }}
                                      >
                                        {deleting === irr.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Trash2 size={13} />}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </td>
                      );
                    })}

                    {/* ── Summary column ── */}
                    <td style={{
                      position: 'sticky', right: 0, zIndex: 2, background: rowBg,
                      padding: compact ? '6px 10px' : '10px 14px', textAlign: 'right',
                      borderLeft: '2px solid var(--border-primary)',
                    }}>
                      <div style={{ fontWeight: 800, fontSize: compact ? 13 : 16, color: monthMm > 0 ? '#10B981' : 'var(--text-tertiary)' }}>
                        {monthMm > 0 ? `${monthMm.toFixed(0)}` : '—'}
                      </div>
                      {monthMm > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 500 }}>mm</div>
                      )}
                      {combinedMm > monthMm && (
                        <div style={{ fontSize: 11, color: '#818CF8', marginTop: 2 }}>+{(combinedMm - monthMm).toFixed(0)}☁</div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {monthCount > 0 ? `${monthCount} dəfə` : ''}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {/* ── Rainfall summary row ── */}
              {rainfalls.length > 0 && (
                <tr style={{ background: 'rgba(129,140,248,0.05)', borderTop: '2px solid rgba(129,140,248,0.25)' }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 2,
                    background: 'rgba(129,140,248,0.06)', padding: compact ? '6px 12px' : '8px 16px',
                    borderRight: '2px solid var(--border-primary)',
                    fontWeight: 700, fontSize: 12, color: '#818CF8',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <CloudRain size={14} /> Yağıntı
                  </td>
                  {calendarDays.map((day) => {
                    const dk = format(new Date(viewYear, viewMonth, day), 'yyyy-MM-dd');
                    const dayRains = rainMap[dk] || [];
                    return (
                      <td key={day} style={{ textAlign: 'center', padding: '4px 2px', fontSize: 10, fontWeight: 700, color: '#818CF8' }}>
                        {dayRains.map((r, i) => <div key={i}>{r.amountMm}</div>)}
                      </td>
                    );
                  })}
                  <td style={{
                    position: 'sticky', right: 0, zIndex: 2,
                    background: 'rgba(129,140,248,0.06)', padding: compact ? '6px 10px' : '8px 12px',
                    textAlign: 'right', fontWeight: 800, fontSize: 13, color: '#818CF8',
                    borderLeft: '2px solid var(--border-primary)',
                  }}>
                    {totalRainMm > 0 ? `${totalRainMm.toFixed(0)} mm` : '—'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Legend ── */}
        <div style={{
          display: 'flex', gap: 'var(--space-4)', padding: '10px 16px',
          borderTop: '1px solid var(--border-primary)', flexWrap: 'wrap',
          background: 'var(--bg-tertiary)',
        }}>
          {Object.entries(TYPE_CFG).map(([k, v]) => (
            <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <span style={{ background: v.bg, color: v.color, borderRadius: 4, padding: '1px 5px', fontWeight: 800, fontSize: 10 }}>35</span>
              <span style={{ color: 'var(--text-secondary)' }}>{v.label}</span>
            </span>
          ))}
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ background: 'rgba(129,140,248,0.2)', color: '#818CF8', borderRadius: 4, padding: '1px 5px', fontWeight: 800, fontSize: 10 }}>8☁</span>
            <span style={{ color: 'var(--text-secondary)' }}>Yağıntı</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span>⛔</span>
            <span style={{ color: 'var(--text-secondary)' }}>Dayanma</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <AlertTriangle size={11} style={{ color: '#EF4444' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Gecikmiş</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ width: 10, height: 10, border: '2px solid rgba(245,158,11,0.55)', borderRadius: 2, display: 'inline-block' }} />
            <span style={{ color: 'var(--text-secondary)' }}>Proqnoz</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ color: 'var(--text-tertiary)', fontSize: 13, fontWeight: 700 }}>+</span>
            <span style={{ color: 'var(--text-secondary)' }}>Klik → əlavə et</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ fontSize: 10, color: '#10B981', fontWeight: 700, background: 'rgba(16,185,129,0.12)', borderRadius: 4, padding: '1px 5px' }}>35</span>
            <span style={{ color: 'var(--text-secondary)' }}>Klik → sil</span>
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
            <span style={{ fontSize: 10, color: '#6366F1', fontWeight: 700, background: 'rgba(99,102,241,0.12)', borderRadius: 4, padding: '1px 5px' }}>PLAN</span>
            <span style={{ color: 'var(--text-secondary)' }}>Gələcək plan</span>
          </span>
        </div>

        {/* ── Active stoppages ── */}
        {stoppages.some(s => !s.endDate) && (
          <div style={{ padding: '12px 16px', borderTop: '2px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.03)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#EF4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={14} /> Aktiv dayanmalar
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {stoppages.filter(s => !s.endDate).map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'var(--bg-card)', borderRadius: 'var(--radius-md)',
                  padding: '6px 12px', border: '1px solid rgba(239,68,68,0.15)', fontSize: 12,
                }}>
                  <span style={{ fontWeight: 700 }}>{s.field.fieldNumber}</span>
                  <span style={{ color: 'var(--text-tertiary)' }}>{s.title}</span>
                  <span style={{ color: STOP_CFG[s.reason]?.color, fontWeight: 600, fontSize: 11 }}>
                    {STOP_CFG[s.reason]?.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════
          MESAJ MODAL
      ══════════════════════════════════════════════════════════════ */}
      {showMsgModal && (
        <div
          onClick={() => setShowMsgModal(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border-primary)', width: '100%', maxWidth: 540,
              boxShadow: '0 24px 60px rgba(0,0,0,0.6)', overflow: 'hidden',
            }}
          >
            {/* Modal header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '16px 20px', borderBottom: '1px solid var(--border-primary)',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(16,185,129,0.08))',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: 'rgba(99,102,241,0.2)', borderRadius: 10, padding: 8 }}>
                  <Send size={18} style={{ color: '#6366F1' }} />
                </div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 15 }}>Suvarma Planını Paylaş</div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>WhatsApp qrupa göndərmək üçün</div>
                </div>
              </div>
              <button onClick={() => setShowMsgModal(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}>
                <X size={20} />
              </button>
            </div>

            {/* Modal body */}
            <div style={{ padding: '20px 20px 16px' }}>
              {/* Date + Shift selectors */}
              <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>TARİX</label>
                  <input
                    type="date"
                    className="form-input"
                    value={msgDate}
                    onChange={(e) => setMsgDate(e.target.value)}
                    style={{ fontSize: 13, padding: '8px 10px', width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>NÖVBƏ</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['day', 'night', 'general'] as const).map((s) => {
                      const labels: Record<string, string> = { day: '🌤 Gündüz', night: '🌙 Gecə', general: '📋 Ümumi' };
                      return (
                        <button key={s} onClick={() => setMsgShift(s)}
                          style={{
                            flex: 1, padding: '8px 4px', borderRadius: 8, border: 'none', cursor: 'pointer',
                            fontSize: 11, fontWeight: 700, transition: 'all 0.2s',
                            background: msgShift === s ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                            color: msgShift === s ? 'white' : 'var(--text-secondary)',
                          }}>
                          {labels[s]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Message preview */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', display: 'block', marginBottom: 6 }}>MESAJ ÖN BAXIŞ</label>
                <div style={{
                  background: 'var(--bg-tertiary)', borderRadius: 10, padding: '12px 14px',
                  border: '1px solid var(--border-primary)',
                  fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7,
                  whiteSpace: 'pre-wrap', maxHeight: 300, overflowY: 'auto',
                  color: 'var(--text-primary)',
                }}>
                  {generateMessage(msgDate, msgShift)}
                </div>
              </div>

              {/* Planned entries info */}
              {(() => {
                const dayIrrsForMsg = irrMap[msgDate] || {};
                const count = Object.values(dayIrrsForMsg).reduce((s, arr) => s + arr.length, 0);
                return count > 0 ? (
                  <div style={{
                    fontSize: 12, color: '#10B981', fontWeight: 600,
                    background: 'rgba(16,185,129,0.08)', borderRadius: 8,
                    padding: '8px 12px', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <Check size={14} /> {count} sahə planı tapıldı
                  </div>
                ) : (
                  <div style={{
                    fontSize: 12, color: '#F59E0B', fontWeight: 600,
                    background: 'rgba(245,158,11,0.08)', borderRadius: 8,
                    padding: '8px 12px', marginBottom: 14,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <AlertTriangle size={14} /> Bu tarix üçün plan qeyd edilməyib
                  </div>
                );
              })()}

              {/* Copy button */}
              <button
                onClick={copyMessage}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  background: copied ? 'rgba(16,185,129,0.85)' : 'var(--color-primary)',
                  color: 'white', fontWeight: 800, fontSize: 14,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  transition: 'all 0.3s',
                }}
              >
                {copied ? (
                  <><CheckCheck size={16} /> Kopyalandı! ✅</>
                ) : (
                  <><Copy size={16} /> Mesajı Kopya Et</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
