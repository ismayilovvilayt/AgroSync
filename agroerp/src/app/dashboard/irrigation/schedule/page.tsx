'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Droplets, CloudRain, ChevronLeft, ChevronRight, RotateCcw,
  Wind, AlertTriangle, Check, X, Waves, Wheat,
  Tractor, Calendar, Maximize2, Minimize2, Trash2, Clock,
  Copy, CheckCheck, Send, Plus, ClipboardList,
} from 'lucide-react';
import { format, getDaysInMonth, differenceInDays, addDays } from 'date-fns';
import { useToast } from '@/components/Toast';

// ─── Types ──────────────────────────────────────────────────────
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

interface RainfallField { fieldId: string; }
interface Rainfall {
  id: string; rainfallDate: string; amountMm: number;
  notes: string | null; fields: RainfallField[];
}

interface Stoppage {
  id: string; fieldId: string; startDate: string; endDate: string | null;
  reason: string; title: string; notes: string | null;
}

// ─── Constants ──────────────────────────────────────────────────
const MONTHS_AZ = [
  'Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'İyun',
  'İyul', 'Avqust', 'Sentyabr', 'Oktyabr', 'Noyabr', 'Dekabr',
];

const TYPE_CFG: Record<string, { label: string; color: string }> = {
  PIVOT:     { label: 'Pivot',     color: '#10B981' },
  SPRINKLER: { label: 'Sprinkler', color: '#3B82F6' },
  DRIP:      { label: 'Damlama',   color: '#F59E0B' },
};

const STOP_CFG: Record<string, { label: string; color: string }> = {
  BREAKDOWN:      { label: 'Nasazlıq',        color: '#EF4444' },
  MAINTENANCE:    { label: 'Texniki baxım',   color: '#8B5CF6' },
  POWER_OUTAGE:   { label: 'Elektrik kəsildi', color: '#F59E0B' },
  WATER_SHORTAGE: { label: 'Su yoxdur',       color: '#06B6D4' },
  OTHER:          { label: 'Digər',           color: '#6B7280' },
};

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
const CROP_COLORS: Record<string, { color: string; bg: string }> = {};
function getCropColor(crop: string) {
  if (!CROP_COLORS[crop]) {
    const idx = Object.keys(CROP_COLORS).length % CROP_PALETTE.length;
    CROP_COLORS[crop] = CROP_PALETTE[idx];
  }
  return CROP_COLORS[crop];
}

function mmToIntensity(mm: number): string {
  if (mm <= 0) return 'transparent';
  if (mm < 10) return 'rgba(16,185,129,0.20)';
  if (mm < 20) return 'rgba(16,185,129,0.38)';
  if (mm < 30) return 'rgba(16,185,129,0.55)';
  return 'rgba(16,185,129,0.72)';
}

// ─── Main Component ─────────────────────────────────────────────
export default function IrrigationSchedulePage() {
  const { showToast } = useToast();
  const now = new Date();

  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [filterFarm, setFilterFarm] = useState('ALL');
  const [filterCrop, setFilterCrop] = useState('ALL');
  const [compact, setCompact] = useState(false);

  const [fields, setFields] = useState<Field[]>([]);
  const [irrigations, setIrrigations] = useState<Irrigation[]>([]);
  const [rainfalls, setRainfalls] = useState<Rainfall[]>([]);
  const [stoppages, setStoppages] = useState<Stoppage[]>([]);
  const [loading, setLoading] = useState(true);

  const [pivotCharts, setPivotCharts] = useState<Record<string, SpeedEntry[]>>({});
  const [quickCell, setQuickCell] = useState<{ fieldId: string; day: number } | null>(null);
  const [quickForm, setQuickForm] = useState({ pivotSpeed: '', waterMm: '' });
  const [saving, setSaving] = useState(false);

  // ─── Suvarma Planlaması ─────────────────────────────────────
  interface PlanItem { fieldId: string; fieldNumber: string; farmName: string; irrigationType: string; speed: string; mm: string; notes: string; }
  const [showPlanPanel, setShowPlanPanel] = useState(false);
  const [planDate, setPlanDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'));
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [generatedText, setGeneratedText] = useState('');
  const [copied, setCopied] = useState(false);

  // Detail popover for existing irrigation
  const [detailCell, setDetailCell] = useState<{ fieldId: string; day: number } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // ─── Fetch ──────────────────────────────────────────────────
  const safeJson = async (res: Response, fb: any = []) => {
    try { return res.ok ? await res.json() : fb; } catch { return fb; }
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

  // ─── Delete irrigation ───────────────────────────────────────
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

  // ─── Computed ───────────────────────────────────────────────
  const getFieldCrop = (field: Field): string | null => {
    const active = field.seasonFields.find(sf =>
      sf.season.status === 'ACTIVE' || sf.season.status === 'PLANNED'
    );
    return active?.cropType || null;
  };

  const farmOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of fields) map.set(f.farmId, f.farm.name);
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [fields]);

  const cropTypes = useMemo(() => {
    const set = new Set<string>();
    for (const f of fields) {
      for (const sf of f.seasonFields) {
        if (sf.season.status === 'ACTIVE' || sf.season.status === 'PLANNED') set.add(sf.cropType);
      }
    }
    return Array.from(set).sort();
  }, [fields]);

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
      if (filterFarm !== 'ALL' && f.farmId !== filterFarm) return false;
      if (filterCrop !== 'ALL' && getFieldCrop(f) !== filterCrop) return false;
      return true;
    });
  }, [sortedFields, filterFarm, filterCrop]);

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
      for (const rf of r.fields) {
        m[rf.fieldId] = (m[rf.fieldId] || 0) + r.amountMm;
      }
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

  const totalMm = useMemo(() => irrigations.reduce((s, i) => s + (i.waterMm || 0), 0), [irrigations]);
  const totalRainMm = useMemo(() => rainfalls.reduce((s, r) => s + r.amountMm, 0), [rainfalls]);

  // ─── Interval forecast: days in this month that should be irrigated ──
  const fieldForecastDays = useMemo(() => {
    const result: Record<string, Set<number>> = {};
    for (const field of filteredFields) {
      const interval = field.irrigationIntervalDays;
      if (!interval) continue;
      const lastIrr = fieldLastIrr[field.id];
      if (!lastIrr) continue;
      const forecast = new Set<number>();
      // Calculate next irrigation date from last irrigation
      let nextDate = addDays(lastIrr, interval);
      // Walk through all forecast dates in this month (and nearby months)
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

  // ─── Speed → mm ─────────────────────────────────────────────
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

  const cellW = compact ? 32 : 40;
  const fieldColW = compact ? 130 : 165;
  const totalColW = compact ? 70 : 95;

  // ─── Farm grouping ───────────────────────────────────────────
  // Build list of rows: either a farm-header or a field row
  type RowType = { type: 'farm'; farmName: string } | { type: 'field'; field: Field };
  const rows = useMemo((): RowType[] => {
    const result: RowType[] = [];
    let lastFarm = '';
    for (const f of filteredFields) {
      if (f.farm.name !== lastFarm) {
        result.push({ type: 'farm', farmName: f.farm.name });
        lastFarm = f.farm.name;
      }
      result.push({ type: 'field', field: f });
    }
    return result;
  }, [filteredFields]);

  if (loading) return (
    <div className="page-content">
      <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Yüklənir...</div></div>
    </div>
  );

  // Close popovers on outside click
  const handlePageClick = () => {
    setQuickCell(null);
    setDetailCell(null);
  };

  return (
    <div className="page-content" style={{ padding: compact ? 'var(--space-2)' : undefined }}
      onClick={handlePageClick}>

      {/* ── Header ────────────────────────────────────────── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 'var(--space-3)', flexWrap: 'wrap', marginBottom: 'var(--space-3)',
      }}>
        <div>
          <h1 className="page-title" style={{ fontSize: compact ? 'var(--font-size-lg)' : undefined, marginBottom: 4 }}>
            <Calendar size={20} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
            Suvarma Cədvəli
          </h1>
          <p className="page-description" style={{ margin: 0 }}>
            {MONTHS_AZ[viewMonth]} {viewYear} · {filteredFields.length} sahə · {irrigations.length} qeyd · {totalMm.toFixed(0)} mm suvarma · {totalRainMm.toFixed(0)} mm yağıntı
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={(e) => { e.stopPropagation(); setShowPlanPanel(!showPlanPanel); }}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ClipboardList size={15} /> Suvarma Planı
          </button>
          <button
            className="btn btn-ghost btn-icon"
            onClick={(e) => { e.stopPropagation(); setCompact(!compact); }}
            title={compact ? 'Geniş görünüş' : 'Kompakt görünüş'}
          >
            {compact ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
          </button>
        </div>
      </div>

      {/* ── Mini Stats ────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap',
        marginBottom: 'var(--space-3)',
      }}>
        {[
          { icon: <RotateCcw size={14} />, val: irrigations.filter(i => i.irrigationType === 'PIVOT').length, label: 'Pivot', color: '#10B981' },
          { icon: <Wind size={14} />, val: irrigations.filter(i => i.irrigationType === 'SPRINKLER').length, label: 'Sprinkler', color: '#3B82F6' },
          { icon: <Droplets size={14} />, val: irrigations.filter(i => i.irrigationType === 'DRIP').length, label: 'Damlama', color: '#F59E0B' },
          { icon: <Waves size={14} />, val: `${totalMm.toFixed(0)}`, label: 'mm', color: '#10B981' },
          { icon: <CloudRain size={14} />, val: `${totalRainMm.toFixed(0)}`, label: 'yağıntı', color: '#818CF8' },
          { icon: <AlertTriangle size={14} />, val: stoppages.filter(s => !s.endDate).length, label: 'dayanma', color: '#EF4444' },
        ].map((s, i) => (
          <div key={i} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 12px', borderRadius: 'var(--radius-md)',
            background: 'var(--bg-tertiary)',
          }}>
            <span style={{ color: s.color }}>{s.icon}</span>
            <span style={{ fontWeight: 800, fontSize: 'var(--font-size-base)' }}>{s.val}</span>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 600 }}>{s.label}</span>
          </div>
        ))}
      </div>

      {/* ── Suvarma Planlaması Paneli ──────────────────────── */}
      {showPlanPanel && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-lg)', padding: '20px 22px',
          marginBottom: 'var(--space-4)',
          backdropFilter: 'blur(10px)',
        }} onClick={e => e.stopPropagation()}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClipboardList size={16} style={{ color: '#F59E0B' }} />
              Suvarma Planlaması
            </h3>
            <button className="btn btn-ghost btn-icon" onClick={() => setShowPlanPanel(false)}><X size={16} /></button>
          </div>

          {/* Tarix */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Plan tarixi:</label>
            <input
              type="date"
              className="form-input"
              value={planDate}
              onChange={e => setPlanDate(e.target.value)}
              style={{ maxWidth: 180 }}
            />
            <button
              className="btn btn-ghost"
              style={{ fontSize: 12 }}
              onClick={() => {
                const newItems: typeof planItems = filteredFields
                  .filter(f => {
                    const last = fieldLastIrr[f.id];
                    const interval = f.irrigationIntervalDays;
                    if (!interval) return false;
                    const daysSince = last ? differenceInDays(new Date(), last) : interval + 1;
                    return daysSince >= interval - 1;
                  })
                  .map(f => ({
                    fieldId: f.id,
                    fieldNumber: f.fieldNumber,
                    farmName: f.farm.name,
                    irrigationType: 'PIVOT',
                    speed: '',
                    mm: '',
                    notes: '',
                  }));
                setPlanItems(newItems);
                setGeneratedText('');
              }}
            >
              <AlertTriangle size={13} /> Vaxtı keçənləri əlavə et
            </button>
          </div>

          {/* Sahə seçimi */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-tertiary)', marginBottom: 8 }}>
              Planlanacaq sahələr:
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {filteredFields.map(f => {
                const inPlan = planItems.some(p => p.fieldId === f.id);
                const cc = getFieldCrop(f) ? getCropColor(getFieldCrop(f)!) : null;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      if (inPlan) {
                        setPlanItems(planItems.filter(p => p.fieldId !== f.id));
                      } else {
                        setPlanItems([...planItems, {
                          fieldId: f.id,
                          fieldNumber: f.fieldNumber,
                          farmName: f.farm.name,
                          irrigationType: 'PIVOT',
                          speed: '',
                          mm: '',
                          notes: '',
                        }]);
                      }
                      setGeneratedText('');
                    }}
                    style={{
                      padding: '4px 10px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      border: `2px solid ${inPlan ? (cc?.color || '#10B981') : 'transparent'}`,
                      background: inPlan ? (cc?.bg || 'rgba(16,185,129,0.15)') : 'var(--bg-tertiary)',
                      color: inPlan ? (cc?.color || '#10B981') : 'var(--text-secondary)',
                      transition: 'all 0.15s',
                    }}
                  >
                    {f.fieldNumber}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Plan items */}
          {planItems.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              {planItems.map((item, idx) => (
                <div key={item.fieldId} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px 10px', borderRadius: 8, marginBottom: 6,
                  background: 'var(--bg-tertiary)', flexWrap: 'wrap',
                }}>
                  <span style={{ fontWeight: 700, fontSize: 13, minWidth: 60 }}>Pivot {item.fieldNumber}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{item.farmName}</span>
                  <select
                    className="form-input"
                    style={{ fontSize: 12, padding: '4px 8px', maxWidth: 120 }}
                    value={item.irrigationType}
                    onChange={e => {
                      const updated = [...planItems];
                      updated[idx] = { ...updated[idx], irrigationType: e.target.value };
                      setPlanItems(updated);
                      setGeneratedText('');
                    }}
                  >
                    <option value="PIVOT">Pivot</option>
                    <option value="SPRINKLER">Sprinkler</option>
                    <option value="DRIP">Damlama</option>
                  </select>
                  <input
                    type="number"
                    className="form-input"
                    placeholder="% sürət"
                    style={{ fontSize: 12, padding: '4px 8px', maxWidth: 90 }}
                    value={item.speed}
                    onChange={e => {
                      const updated = [...planItems];
                      updated[idx] = { ...updated[idx], speed: e.target.value };
                      setPlanItems(updated);
                      setGeneratedText('');
                    }}
                  />
                  <input
                    type="number"
                    className="form-input"
                    placeholder="mm"
                    style={{ fontSize: 12, padding: '4px 8px', maxWidth: 80 }}
                    value={item.mm}
                    onChange={e => {
                      const updated = [...planItems];
                      updated[idx] = { ...updated[idx], mm: e.target.value };
                      setPlanItems(updated);
                      setGeneratedText('');
                    }}
                  />
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Qeyd (isteğe bağlı)"
                    style={{ fontSize: 12, padding: '4px 8px', flex: 1, minWidth: 100 }}
                    value={item.notes}
                    onChange={e => {
                      const updated = [...planItems];
                      updated[idx] = { ...updated[idx], notes: e.target.value };
                      setPlanItems(updated);
                      setGeneratedText('');
                    }}
                  />
                  <button className="btn btn-ghost btn-icon" style={{ color: '#EF4444' }}
                    onClick={() => { setPlanItems(planItems.filter((_, i) => i !== idx)); setGeneratedText(''); }}>
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button
              className="btn btn-primary"
              disabled={planItems.length === 0}
              onClick={() => {
                const dateLabel = (() => {
                  const d = new Date(planDate);
                  const days = ['Bazar', 'Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə'];
                  const months = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
                  return `${d.getDate()} ${months[d.getMonth()]} ${days[d.getDay()]}`;
                })();

                const lines = [`📅 ${dateLabel} suvarma planı:\n`];
                planItems.forEach((item, i) => {
                  const typeLabel = item.irrigationType === 'PIVOT' ? 'Pivot' : item.irrigationType === 'SPRINKLER' ? 'Sprinkler' : 'Damlama';
                  let line = `${i + 1}. Pivot ${item.fieldNumber}`;
                  if (item.irrigationType !== 'PIVOT') line += ` (${typeLabel})`;
                  if (item.speed) line += ` — ${item.speed}%`;
                  if (item.mm) line += ` / ${item.mm} mm`;
                  if (item.notes) line += ` (${item.notes})`;
                  lines.push(line);
                });
                lines.push('\n✅ Plan suvarma qrupuna göndərildi.');
                setGeneratedText(lines.join('\n'));
              }}
            >
              <Send size={14} /> Mətn Yarat
            </button>
            {planItems.length > 0 && (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, color: '#EF4444' }}
                onClick={() => { setPlanItems([]); setGeneratedText(''); }}
              >
                <X size={13} /> Sıfırla
              </button>
            )}
          </div>

          {/* Generated text */}
          {generatedText && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>Hazır mətn (kopyala və göndər):</span>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, color: copied ? '#10B981' : 'var(--text-secondary)' }}
                  onClick={() => {
                    navigator.clipboard.writeText(generatedText);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                >
                  {copied ? <CheckCheck size={14} /> : <Copy size={14} />}
                  {copied ? 'Kopyalandı!' : 'Kopyala'}
                </button>
              </div>
              <pre style={{
                background: 'var(--bg-primary)', border: '1px solid var(--border-primary)',
                borderRadius: 10, padding: '14px 16px',
                fontSize: 13, lineHeight: 1.7, color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                fontFamily: 'inherit',
              }}>
                {generatedText}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── Filters + Month Nav ───────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
        {/* Row 1: Farm + Crop */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Tractor size={14} style={{ color: 'var(--text-tertiary)' }} />
            <select
              className="form-select"
              value={filterFarm}
              onChange={(e) => setFilterFarm(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', minWidth: 130 }}
            >
              <option value="ALL">Bütün təsərrüfatlar</option>
              {farmOptions.map(([id, name]) => (
                <option key={id} value={id}>{name}</option>
              ))}
            </select>
          </div>

          <div style={{ width: 1, height: 22, background: 'var(--border-primary)' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1)', flexWrap: 'wrap' }}>
            <Wheat size={14} style={{ color: 'var(--text-tertiary)', marginRight: 2 }} />
            <button
              onClick={() => setFilterCrop('ALL')}
              style={{
                padding: '3px 10px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: filterCrop === 'ALL' ? 'var(--color-primary)' : 'var(--bg-tertiary)',
                color: filterCrop === 'ALL' ? 'white' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: 11, transition: 'all 0.2s',
              }}
            >
              Hamısı
            </button>
            {cropTypes.map(crop => {
              const count = sortedFields.filter(f => getFieldCrop(f) === crop).length;
              const cc = getCropColor(crop);
              return (
                <button key={crop}
                  onClick={() => setFilterCrop(crop)}
                  style={{
                    padding: '3px 10px', borderRadius: 14, cursor: 'pointer',
                    border: filterCrop === crop ? `2px solid ${cc.color}` : '2px solid transparent',
                    background: filterCrop === crop ? cc.bg : 'var(--bg-tertiary)',
                    color: filterCrop === crop ? cc.color : 'var(--text-secondary)',
                    fontWeight: 600, fontSize: 11, transition: 'all 0.2s',
                  }}
                >
                  {crop} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Month nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button className="btn btn-ghost btn-icon" onClick={(e) => { e.stopPropagation(); navigateMonth(-1); }}><ChevronLeft size={18} /></button>
          <span style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)', minWidth: 180, textAlign: 'center' }}>
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

      {/* ══════════════════════════════════════════════════════
          AYLIK CƏDVƏLİ (Matrix)
      ══════════════════════════════════════════════════════ */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 300px)' }}>
          <table style={{
            width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed',
            minWidth: `${fieldColW + daysInMonth * cellW + totalColW}px`,
          }}>
            <colgroup>
              <col style={{ width: fieldColW }} />
              {calendarDays.map((d) => <col key={d} style={{ width: cellW }} />)}
              <col style={{ width: totalColW }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)' }}>
                <th style={{
                  position: 'sticky', left: 0, top: 0, zIndex: 10, background: 'var(--bg-tertiary)',
                  padding: compact ? '6px 8px' : '10px 14px', textAlign: 'left',
                  fontSize: compact ? 10 : 'var(--font-size-xs)',
                  fontWeight: 700, borderBottom: '2px solid var(--border-primary)',
                  borderRight: '2px solid var(--border-primary)',
                }}>
                  Sahə / Gün
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
                      padding: compact ? '3px 1px' : '4px 2px',
                      textAlign: 'center', fontSize: compact ? 10 : 11,
                      fontWeight: isToday ? 800 : 500,
                      borderBottom: '2px solid var(--border-primary)',
                      background: isToday ? 'rgba(16,185,129,0.2)' : isWeekend ? 'rgba(255,255,255,0.02)' : 'var(--bg-tertiary)',
                      color: isToday ? '#10B981' : isWeekend ? 'var(--text-tertiary)' : 'var(--text-secondary)',
                    }}>
                      <div>{day}</div>
                      {hasRain && (
                        <div title={rainMap[dk].map(r => r.amountMm + 'mm').join(' + ')}>
                          <CloudRain size={8} style={{ color: '#818CF8' }} />
                        </div>
                      )}
                    </th>
                  );
                })}
                <th style={{
                  position: 'sticky', right: 0, top: 0, zIndex: 10, background: 'var(--bg-tertiary)',
                  padding: compact ? '6px 6px' : '10px 10px', textAlign: 'right',
                  fontSize: compact ? 10 : 'var(--font-size-xs)',
                  fontWeight: 700, borderBottom: '2px solid var(--border-primary)',
                  borderLeft: '2px solid var(--border-primary)',
                }}>
                  Ay mm
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={daysInMonth + 2} style={{
                    textAlign: 'center', padding: 'var(--space-8)',
                    color: 'var(--text-tertiary)', fontSize: 'var(--font-size-sm)',
                  }}>
                    {filterFarm !== 'ALL' || filterCrop !== 'ALL'
                      ? 'Bu filtrə uyğun sahə tapılmadı'
                      : 'Sahə yoxdur'}
                  </td>
                </tr>
              ) : (
                rows.map((row, rowIdx) => {
                  // ── Farm header row ──
                  if (row.type === 'farm') {
                    return (
                      <tr key={`farm-${row.farmName}`} style={{ background: 'var(--bg-tertiary)' }}>
                        <td
                          colSpan={daysInMonth + 2}
                          style={{
                            position: 'sticky', left: 0, zIndex: 3,
                            padding: compact ? '3px 8px' : '5px 14px',
                            borderBottom: '1px solid var(--border-primary)',
                            borderTop: rowIdx > 0 ? '2px solid var(--border-primary)' : undefined,
                            background: 'var(--bg-tertiary)',
                          }}
                        >
                          <span style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: compact ? 9 : 11, fontWeight: 700,
                            color: 'var(--text-secondary)', textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                          }}>
                            <Tractor size={compact ? 10 : 12} style={{ color: 'var(--text-tertiary)' }} />
                            {row.farmName}
                          </span>
                        </td>
                      </tr>
                    );
                  }

                  // ── Field data row ──
                  const field = row.field;
                  const fIdx = filteredFields.indexOf(field);
                  const monthMm = fieldMonthlyMm[field.id] || 0;
                  const combinedMm = fieldMonthlyCombined[field.id] || 0;
                  const lastDate = fieldLastIrr[field.id];
                  const interval = field.irrigationIntervalDays;
                  const daysSince = lastDate ? differenceInDays(now, lastDate) : null;
                  const isOverdue = interval && daysSince !== null && daysSince > interval;
                  const isWarning = interval && daysSince !== null && daysSince >= interval - 2 && !isOverdue;
                  const crop = getFieldCrop(field);
                  const cc = crop ? getCropColor(crop) : null;
                  const forecastDays = fieldForecastDays[field.id] || new Set<number>();

                  return (
                    <tr key={field.id} style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <td style={{
                        position: 'sticky', left: 0, zIndex: 2,
                        background: fIdx % 2 === 0 ? 'var(--bg-card)' : 'rgba(255,255,255,0.01)',
                        padding: compact ? '4px 8px' : '7px 14px',
                        borderRight: '2px solid var(--border-primary)',
                        borderLeft: cc ? `3px solid ${cc.color}` : '3px solid transparent',
                      }}>
                        <div style={{ fontWeight: 600, fontSize: compact ? 11 : 'var(--font-size-sm)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {isOverdue && <span title="Suvarma gecikmişdir!"><AlertTriangle size={12} style={{ color: '#EF4444' }} /></span>}
                          {isWarning && <span title="Suvarma vaxtı yaxınlaşır!"><AlertTriangle size={12} style={{ color: '#F59E0B' }} /></span>}
                          {field.fieldNumber}
                        </div>
                        <div style={{ fontSize: compact ? 9 : 10, color: 'var(--text-tertiary)', marginTop: 1, display: 'flex', alignItems: 'center', gap: 3 }}>
                          {crop && cc && (
                            <span style={{
                              fontSize: 8, fontWeight: 700, color: cc.color, background: cc.bg,
                              borderRadius: 3, padding: '0px 4px', marginLeft: 1,
                            }}>
                              {crop}
                            </span>
                          )}
                        </div>
                        {interval && !compact && (
                          <div style={{ fontSize: 9, color: isOverdue ? '#EF4444' : isWarning ? '#F59E0B' : 'var(--text-tertiary)', marginTop: 1 }}>
                            ⏱ {interval}g · {daysSince !== null ? `${daysSince}g əvvəl` : '—'}
                          </div>
                        )}
                      </td>

                      {calendarDays.map((day) => {
                        const dk = format(new Date(viewYear, viewMonth, day), 'yyyy-MM-dd');
                        const dayIrrs = irrMap[dk]?.[field.id] || [];
                        const dayRains = rainMap[dk]?.filter(r => r.fields.some(rf => rf.fieldId === field.id)) || [];
                        const stoppage = isStoppedOnDay(field.id, day);
                        const isToday = viewYear === now.getFullYear() && viewMonth === now.getMonth() && day === now.getDate();
                        const isForecast = forecastDays.has(day);
                        const isFuture = new Date(viewYear, viewMonth, day) > now;

                        const cellMm = dayIrrs.reduce((s, i) => s + (i.waterMm || 0), 0) +
                                       dayRains.reduce((s, r) => s + r.amountMm, 0);

                        let cellBg = isToday ? 'rgba(16,185,129,0.07)' : 'transparent';
                        if (stoppage) cellBg = 'rgba(239,68,68,0.10)';
                        else if (cellMm > 0) cellBg = mmToIntensity(cellMm);

                        const isQuickOpen = quickCell?.fieldId === field.id && quickCell?.day === day;
                        const isDetailOpen = detailCell?.fieldId === field.id && detailCell?.day === day;
                        const isEmpty = dayIrrs.length === 0 && dayRains.length === 0 && !stoppage;

                        // Forecast border: yellow outline if this day is a predicted irrigation day
                        const forecastOutline = isForecast && isEmpty
                          ? '2px solid rgba(245,158,11,0.55)'
                          : undefined;

                        return (
                          <td key={day}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (dayIrrs.length > 0) {
                                // Toggle detail popover
                                if (isDetailOpen) setDetailCell(null);
                                else { setDetailCell({ fieldId: field.id, day }); setQuickCell(null); }
                              } else if (!stoppage) {
                                // Toggle quick-add popover
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
                              padding: compact ? '2px 0' : '3px 1px',
                              textAlign: 'center', verticalAlign: 'top',
                              background: cellBg, minHeight: compact ? 28 : 36,
                              position: 'relative',
                              borderLeft: '1px solid rgba(255,255,255,0.04)',
                              cursor: stoppage ? 'default' : 'pointer',
                              outline: forecastOutline,
                              outlineOffset: '-2px',
                              transition: 'background 0.15s',
                            }}
                            onMouseEnter={(e) => {
                              if (!stoppage && !isDetailOpen && !isQuickOpen)
                                e.currentTarget.style.background = dayIrrs.length > 0
                                  ? 'rgba(239,68,68,0.12)'
                                  : isForecast
                                    ? 'rgba(245,158,11,0.12)'
                                    : 'rgba(16,185,129,0.12)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isDetailOpen && !isQuickOpen)
                                e.currentTarget.style.background = cellBg;
                            }}
                          >
                            {/* Stoppage */}
                            {stoppage && dayIrrs.length === 0 && (
                              <div title={`${stoppage.title} — ${STOP_CFG[stoppage.reason]?.label}`}
                                style={{ fontSize: 8, fontWeight: 700, color: STOP_CFG[stoppage.reason]?.color || '#EF4444', lineHeight: 1.2 }}>
                                ⛔
                              </div>
                            )}

                            {/* Irrigations */}
                            {dayIrrs.map((irr, i) => {
                              const cfg = TYPE_CFG[irr.irrigationType] || TYPE_CFG.DRIP;
                              const isPlan = isFuture;
                              return (
                                <div key={i}
                                  title={`${cfg.label}: ${irr.waterMm ? irr.waterMm + ' mm' : ''} ${irr.duration ? irr.duration + ' saat' : ''} ${irr.pivotSpeed ? '(' + irr.pivotSpeed + '%)' : ''} ${irr.notes || ''}`}
                                  style={{ fontSize: compact ? 9 : 10, fontWeight: 800, color: isPlan ? '#6366F1' : cfg.color, lineHeight: 1.3, cursor: 'pointer' }}>
                                  {irr.waterMm ? `${irr.waterMm}` : irr.duration ? `${irr.duration}s` : '✓'}
                                  {irr.pivotSpeed != null && (
                                    <div style={{ fontSize: compact ? 7 : 9, fontWeight: 600, opacity: 0.8 }}>{irr.pivotSpeed}%</div>
                                  )}
                                </div>
                              );
                            })}

                            {/* Rainfall */}
                            {dayRains.map((rn, i) => (
                              <div key={`rn-${i}`}
                                title={`Yağıntı: ${rn.amountMm} mm ${rn.notes || ''}`}
                                style={{ fontSize: compact ? 8 : 9, fontWeight: 700, color: '#818CF8', lineHeight: 1.2 }}>
                                {rn.amountMm}☁
                              </div>
                            ))}

                            {/* Empty + forecast hint */}
                            {isEmpty && !isForecast && (
                              <div style={{ fontSize: compact ? 9 : 11, color: 'var(--text-tertiary)', opacity: 0.20 }}>+</div>
                            )}
                            {isEmpty && isForecast && (
                              <div style={{ fontSize: compact ? 7 : 9, color: '#F59E0B', opacity: 0.60 }}>
                                <Clock size={compact ? 8 : 10} />
                              </div>
                            )}

                            {/* ── Quick-add popover ── */}
                            {isQuickOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                                  zIndex: 100, background: 'var(--bg-card)', border: `1px solid ${isFuture ? '#6366F1' : 'var(--border-primary)'}`,
                                  borderRadius: 'var(--radius-lg)', padding: 12, minWidth: 200,
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                                }}>
                                <div style={{
                                  fontSize: 11, fontWeight: 700, marginBottom: 8, color: 'var(--text-secondary)',
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                }}>
                                  <span>
                                    {field.fieldNumber} · <span style={{ color: isFuture ? '#6366F1' : '#10B981' }}>{day} {MONTHS_AZ[viewMonth]}</span>
                                    {isFuture && <span style={{ fontSize: 9, background: 'rgba(99,102,241,0.15)', color: '#6366F1', borderRadius: 4, padding: '1px 5px', marginLeft: 5 }}>PLAN</span>}
                                  </span>
                                  <button onClick={(e) => { e.stopPropagation(); setQuickCell(null); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 2 }}>
                                    <X size={14} />
                                  </button>
                                </div>
                                {pivotCharts[field.id]?.length > 0 ? (
                                  <select className="form-select" value={quickForm.pivotSpeed}
                                    onChange={(e) => handleQuickSpeedChange(e.target.value, field.id)}
                                    style={{ fontSize: 12, padding: '5px 8px', marginBottom: 6, width: '100%' }}>
                                    <option value="">Sürət seçin...</option>
                                    {(pivotCharts[field.id] || []).map((e) => (
                                      <option key={e.speed} value={e.speed}>{e.speed}% → {e.mm} mm</option>
                                    ))}
                                  </select>
                                ) : (
                                  <input type="number" className="form-input" placeholder="Sürət (%)"
                                    value={quickForm.pivotSpeed}
                                    onChange={(e) => handleQuickSpeedChange(e.target.value, field.id)}
                                    style={{ fontSize: 12, padding: '5px 8px', marginBottom: 6, width: '100%' }}
                                    min={1} max={100} />
                                )}
                                <input type="number" className="form-input" placeholder="mm *"
                                  value={quickForm.waterMm}
                                  onChange={(e) => setQuickForm({ ...quickForm, waterMm: e.target.value })}
                                  style={{ fontSize: 12, padding: '5px 8px', marginBottom: 8, width: '100%' }}
                                  min={0} step={0.1} required />
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={(e) => { e.stopPropagation(); setQuickCell(null); }}
                                    className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px', flex: 1 }}>
                                    Ləğv
                                  </button>
                                  <button onClick={(e) => { e.stopPropagation(); submitQuick(); }}
                                    className="btn btn-primary" style={{ fontSize: 11, padding: '4px 10px', flex: 1 }}
                                    disabled={saving || !quickForm.waterMm}>
                                    {saving ? <span className="spinner" /> : <><Check size={12} /> Qeyd et</>}
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* ── Detail/Delete popover ── */}
                            {isDetailOpen && dayIrrs.length > 0 && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
                                  zIndex: 100, background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                                  borderRadius: 'var(--radius-lg)', padding: 12, minWidth: 210,
                                  boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
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
                                      border: `1px solid rgba(${cfg.color === '#10B981' ? '16,185,129' : cfg.color === '#3B82F6' ? '59,130,246' : '245,158,11'},0.25)`,
                                    }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
                                        <div>
                                          <div style={{ fontSize: 12, fontWeight: 700, color: cfg.color }}>{cfg.label}</div>
                                          {irr.waterMm && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>💧 {irr.waterMm} mm</div>}
                                          {irr.pivotSpeed && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>⚡ {irr.pivotSpeed}%</div>}
                                          {irr.duration && <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>⏱ {irr.duration}s</div>}
                                          {irr.user && <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 2 }}>{irr.user.fullName}</div>}
                                        </div>
                                        <button
                                          onClick={(e) => { e.stopPropagation(); deleteIrrigation(irr.id); }}
                                          disabled={deleting === irr.id}
                                          style={{
                                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
                                            borderRadius: 6, cursor: 'pointer', padding: '4px 6px',
                                            color: '#EF4444', flexShrink: 0, display: 'flex', alignItems: 'center',
                                          }}
                                          title="Sil"
                                        >
                                          {deleting === irr.id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Trash2 size={12} />}
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

                      <td style={{
                        position: 'sticky', right: 0, zIndex: 2,
                        background: fIdx % 2 === 0 ? 'var(--bg-card)' : 'rgba(255,255,255,0.01)',
                        padding: compact ? '4px 6px' : '7px 10px', textAlign: 'right',
                        borderLeft: '2px solid var(--border-primary)',
                      }}>
                        <div style={{ fontWeight: 800, fontSize: compact ? 11 : 'var(--font-size-sm)', color: monthMm > 0 ? '#10B981' : 'var(--text-tertiary)' }}>
                          {monthMm > 0 ? `${monthMm.toFixed(0)}` : '—'}
                        </div>
                        {combinedMm > monthMm && (
                          <div style={{ fontSize: compact ? 8 : 10, color: '#818CF8' }}>+{(combinedMm - monthMm).toFixed(0)}☁</div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}

              {rainfalls.length > 0 && (
                <tr style={{ background: 'rgba(129,140,248,0.06)', borderTop: '2px solid rgba(129,140,248,0.3)' }}>
                  <td style={{
                    position: 'sticky', left: 0, zIndex: 2,
                    background: 'rgba(129,140,248,0.08)', padding: compact ? '4px 8px' : '7px 14px',
                    borderRight: '2px solid var(--border-primary)',
                    fontWeight: 700, fontSize: compact ? 10 : 'var(--font-size-sm)', color: '#818CF8',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <CloudRain size={compact ? 12 : 14} /> Yağıntı
                  </td>
                  {calendarDays.map((day) => {
                    const dk = format(new Date(viewYear, viewMonth, day), 'yyyy-MM-dd');
                    const dayRains = rainMap[dk] || [];
                    return (
                      <td key={day} style={{ textAlign: 'center', padding: '3px 1px', fontSize: compact ? 9 : 10, fontWeight: 700, color: '#818CF8' }}>
                        {dayRains.map((r, i) => <div key={i}>{r.amountMm}</div>)}
                      </td>
                    );
                  })}
                  <td style={{
                    position: 'sticky', right: 0, zIndex: 2,
                    background: 'rgba(129,140,248,0.08)', padding: compact ? '4px 6px' : '7px 10px',
                    textAlign: 'right', borderLeft: '2px solid var(--border-primary)',
                    fontWeight: 800, fontSize: compact ? 11 : 'var(--font-size-sm)', color: '#818CF8',
                  }}>
                    {totalRainMm.toFixed(0)}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap',
        marginTop: 'var(--space-3)', fontSize: 11, color: 'var(--text-tertiary)',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: 'rgba(16,185,129,0.38)', display: 'inline-block' }} />
          Suvarma (mm) — tıkla: sil
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <CloudRain size={11} style={{ color: '#818CF8' }} /> Yağıntı
        </span>
        <span>⛔ Dayanma</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={11} style={{ color: '#EF4444' }} /> Gecikmiş
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <AlertTriangle size={11} style={{ color: '#F59E0B' }} /> Yaxınlaşır
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, border: '2px solid rgba(245,158,11,0.55)', borderRadius: 2, display: 'inline-block' }} />
          Proqnoz günü
        </span>
        <span>Boş xana → sürətli qeyd</span>
      </div>
    </div>
  );
}
