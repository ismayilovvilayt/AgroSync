'use client';

import { useState, useEffect, use } from 'react';
import {
  MapPin, Droplets, ChevronLeft, Wheat, Tractor, Clock,
  Activity, GitBranch, Layers, AlertTriangle, CheckCircle2,
  Calendar, Trash2, RotateCcw, Leaf, TrendingUp,
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────
interface FieldDetail {
  id: string; fieldNumber: string; hectares: number;
  soilType: string | null; status: string;
  irrigationIntervalDays: number | null;
  latitude: number | null; longitude: number | null;
  farmId: string;
  farm: { name: string };
  parent: { id: string; fieldNumber: string } | null;
  children: { id: string; fieldNumber: string; hectares: number; status: string }[];
  seasonFields: {
    cropType: string; status: string;
    season: { id: string; name: string; status: string };
  }[];
  _count: { processes: number; irrigations: number; notes: number; children: number };
}

interface Irrigation {
  id: string; irrigationType: string; irrigationDate: string;
  pivotSpeed: number | null; waterMm: number | null;
  duration: number | null; waterVolume: number | null;
  notes: string | null;
  user: { fullName: string };
}

// ─── Constants ───────────────────────────────────────────────────────────────
const STATUS_CFG: Record<string, { label: string; color: string; bg: string }> = {
  ACTIVE: { label: 'Aktiv', color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  FALLOW: { label: 'Dincə qoyulub', color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
};

const TYPE_CFG: Record<string, { label: string; color: string }> = {
  PIVOT:     { label: 'Pivot',     color: '#10B981' },
  SPRINKLER: { label: 'Sprinkler', color: '#3B82F6' },
  DRIP:      { label: 'Damlama',   color: '#F59E0B' },
};

const CROP_STATUS_CFG: Record<string, { label: string; color: string }> = {
  PLANNED:   { label: 'Planlanıb', color: '#6B7280' },
  SOWN:      { label: 'Əkilib',    color: '#3B82F6' },
  GROWING:   { label: 'Böyüyür',   color: '#10B981' },
  HARVESTED: { label: 'Yığılıb',   color: '#8B5CF6' },
};

// ─── Page ────────────────────────────────────────────────────────────────────
export default function FieldDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const [field, setField] = useState<FieldDetail | null>(null);
  const [irrigations, setIrrigations] = useState<Irrigation[]>([]);
  const [loading, setLoading] = useState(true);
  const [irrLoading, setIrrLoading] = useState(true);

  const now = new Date();
  const currentYear = now.getFullYear();
  const [irrYear, setIrrYear] = useState(currentYear);

  useEffect(() => {
    fetch(`/api/fields/${id}`)
      .then(r => r.json())
      .then(d => { setField(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    setIrrLoading(true);
    fetch(`/api/irrigation?fieldId=${id}&year=${irrYear}`)
      .then(r => r.json())
      .then(d => { setIrrigations(Array.isArray(d) ? d : []); setIrrLoading(false); })
      .catch(() => setIrrLoading(false));
  }, [id, irrYear]);

  if (loading) return (
    <div className="page-content">
      <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Yüklənir...</div></div>
    </div>
  );

  if (!field) return (
    <div className="page-content">
      <p style={{ color: 'var(--text-tertiary)' }}>Sahə tapılmadı</p>
    </div>
  );

  const statusCfg = STATUS_CFG[field.status] || { label: field.status, color: '#6B7280', bg: 'rgba(107,114,128,0.12)' };
  const activeSeason = field.seasonFields.find(sf => sf.season.status === 'ACTIVE' || sf.season.status === 'PLANNED');

  // Last irrigation
  const lastIrr = irrigations.length > 0 ? irrigations[0] : null;
  const daysSinceIrr = lastIrr ? differenceInDays(now, new Date(lastIrr.irrigationDate)) : null;
  const interval = field.irrigationIntervalDays;
  const isOverdue = interval && daysSinceIrr !== null && daysSinceIrr > interval;
  const isWarning = interval && daysSinceIrr !== null && daysSinceIrr >= interval - 2 && !isOverdue;

  // Monthly mm for the year
  const monthlyMm = Array.from({ length: 12 }, (_, i) => {
    const m = i;
    const mm = irrigations
      .filter(irr => new Date(irr.irrigationDate).getMonth() === m)
      .reduce((s, irr) => s + (irr.waterMm || 0), 0);
    return { month: i, mm };
  });
  const maxMm = Math.max(...monthlyMm.map(m => m.mm), 1);
  const totalYearMm = irrigations.reduce((s, irr) => s + (irr.waterMm || 0), 0);
  const MONTHS_SHORT = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'İyn', 'İyl', 'Avq', 'Sen', 'Okt', 'Noy', 'Dek'];

  return (
    <div className="page-content">
      {/* ── Breadcrumb ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 13 }}>
        <a href="/dashboard/fields" style={{
          display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-tertiary)',
          textDecoration: 'none', transition: 'color 0.2s',
        }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--color-primary)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-tertiary)')}>
          <ChevronLeft size={15} /> Sahələr
        </a>
        <span style={{ color: 'var(--text-tertiary)' }}>/</span>
        <span style={{ fontWeight: 700 }}>{field.fieldNumber}</span>
        {field.parent && (
          <>
            <span style={{ color: 'var(--text-tertiary)' }}>(</span>
            <a href={`/dashboard/fields/${field.parent.id}`}
              style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
              {field.parent.fieldNumber}
            </a>
            <span style={{ color: 'var(--text-tertiary)' }}>)</span>
          </>
        )}
      </div>

      {/* ── Page Title ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 12 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 4 }}>
            {field.parent ? <GitBranch size={20} style={{ marginRight: 8, verticalAlign: 'text-bottom', color: '#10B981' }} /> : <Layers size={20} style={{ marginRight: 8, verticalAlign: 'text-bottom', color: '#3B82F6' }} />}
            Sahə {field.fieldNumber}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              fontSize: 12, fontWeight: 700, color: statusCfg.color,
              background: statusCfg.bg, borderRadius: 20, padding: '3px 12px',
            }}>
              {statusCfg.label}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-tertiary)' }}>
              <Tractor size={13} style={{ verticalAlign: 'middle', marginRight: 3 }} />
              {field.farm.name}
            </span>
            {activeSeason && (
              <span style={{ fontSize: 12, color: '#10B981', fontWeight: 700 }}>
                <Leaf size={12} style={{ verticalAlign: 'middle', marginRight: 3 }} />
                {activeSeason.cropType}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href={`/dashboard/irrigation/schedule`} className="btn btn-secondary" style={{ fontSize: 13 }}>
            <Droplets size={15} /> Suvarma cədvəli
          </a>
        </div>
      </div>

      {/* ── Info Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>

        {/* Left: Field info */}
        <div className="card">
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 14, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Sahə məlumatları
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { label: 'Sahə nömrəsi', value: field.fieldNumber, bold: true },
              { label: 'Sahə (ha)', value: `${field.hectares} ha`, bold: true },
              { label: 'Torpaq növü', value: field.soilType || '—' },
              { label: 'Suvarma intervalı', value: interval ? `${interval} gün` : '—', highlight: isOverdue ? '#EF4444' : isWarning ? '#F59E0B' : undefined },
              { label: 'Son suvarma', value: lastIrr ? format(new Date(lastIrr.irrigationDate), 'dd.MM.yyyy') : '—' },
              { label: 'Əvvəlki suvarma', value: daysSinceIrr !== null ? `${daysSinceIrr} gün əvvəl` : '—', highlight: isOverdue ? '#EF4444' : isWarning ? '#F59E0B' : undefined },
            ].map((row, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: 'space-between',
                padding: '7px 0', borderBottom: i < 5 ? '1px solid var(--border-primary)' : 'none',
              }}>
                <span style={{ fontSize: 12, color: 'var(--text-tertiary)', fontWeight: 500 }}>{row.label}</span>
                <span style={{
                  fontSize: 13, fontWeight: row.bold ? 700 : 500,
                  color: row.highlight || 'var(--text-primary)',
                }}>{row.value}</span>
              </div>
            ))}
          </div>

          {/* Interval warning */}
          {(isOverdue || isWarning) && (
            <div style={{
              marginTop: 12, padding: '8px 12px', borderRadius: 8,
              background: isOverdue ? 'rgba(239,68,68,0.1)' : 'rgba(245,158,11,0.1)',
              border: `1px solid ${isOverdue ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
              color: isOverdue ? '#EF4444' : '#F59E0B',
            }}>
              <AlertTriangle size={14} />
              {isOverdue ? 'Suvarma gecikmişdir!' : 'Suvarma vaxtı yaxınlaşır!'}
            </div>
          )}
        </div>

        {/* Right: Stats + season */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Count stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { icon: <Activity size={18} />, label: 'Proses', value: field._count.processes, color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)' },
              { icon: <Droplets size={18} />, label: 'Suvarma', value: field._count.irrigations, color: '#06B6D4', bg: 'rgba(6,182,212,0.12)' },
            ].map((s, i) => (
              <div key={i} style={{
                background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                borderRadius: 12, padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', color: s.color }}>
                  {s.icon}
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Active season/crop */}
          {field.seasonFields.length > 0 && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Mövsüm / Məhsul
              </div>
              {field.seasonFields.map((sf, i) => {
                const cropSt = CROP_STATUS_CFG[sf.status] || { label: sf.status, color: '#6B7280' };
                return (
                  <div key={i} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 0', borderBottom: i < field.seasonFields.length - 1 ? '1px solid var(--border-primary)' : 'none',
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 13 }}>{sf.cropType}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 8 }}>{sf.season.name}</span>
                    </div>
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: cropSt.color,
                      background: `${cropSt.color}18`, borderRadius: 12, padding: '2px 8px',
                    }}>
                      {cropSt.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Sub-fields */}
          {field.children.length > 0 && (
            <div className="card" style={{ padding: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-tertiary)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                Alt sahələr ({field.children.length})
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {field.children.map(ch => (
                  <a key={ch.id} href={`/dashboard/fields/${ch.id}`}
                    style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                      background: 'rgba(16,185,129,0.10)', color: '#10B981',
                      textDecoration: 'none', border: '1px solid rgba(16,185,129,0.25)',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.10)'; }}
                  >
                    {ch.fieldNumber} · {ch.hectares}ha
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Irrigation History ── */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-primary)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <h3 style={{ fontWeight: 700, fontSize: 15 }}>
            <Droplets size={16} style={{ verticalAlign: 'middle', marginRight: 6, color: '#06B6D4' }} />
            Suvarma tarixi · {totalYearMm.toFixed(0)} mm
          </h3>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button onClick={() => setIrrYear(y => y - 1)} className="btn btn-ghost btn-icon" style={{ fontSize: 12 }}>‹</button>
            <span style={{ fontWeight: 700, minWidth: 40, textAlign: 'center' }}>{irrYear}</span>
            <button onClick={() => setIrrYear(y => y + 1)} className="btn btn-ghost btn-icon" style={{ fontSize: 12 }} disabled={irrYear >= currentYear}>›</button>
          </div>
        </div>

        {/* Monthly bar chart */}
        {!irrLoading && (
          <div style={{ padding: '16px 20px 8px', borderBottom: '1px solid var(--border-primary)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 70 }}>
              {monthlyMm.map(({ month, mm }) => {
                const h = maxMm > 0 ? Math.round((mm / maxMm) * 60) : 0;
                const isCurrentMonth = month === now.getMonth() && irrYear === currentYear;
                return (
                  <div key={month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    <div style={{ fontSize: 9, color: '#06B6D4', fontWeight: 700, minHeight: 14 }}>
                      {mm > 0 ? mm.toFixed(0) : ''}
                    </div>
                    <div style={{ width: '100%', position: 'relative', height: 50, display: 'flex', alignItems: 'flex-end' }}>
                      <div style={{
                        width: '100%', height: h || 2, background: mm > 0 ? '#06B6D4' : 'var(--bg-tertiary)',
                        borderRadius: 3, opacity: isCurrentMonth ? 1 : 0.7,
                        border: isCurrentMonth ? '1px solid #06B6D4' : 'none',
                        transition: 'height 0.5s',
                      }} />
                    </div>
                    <div style={{ fontSize: 8, color: isCurrentMonth ? '#06B6D4' : 'var(--text-tertiary)', fontWeight: isCurrentMonth ? 700 : 500 }}>
                      {MONTHS_SHORT[month]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Irrigation list */}
        {irrLoading ? (
          <div style={{ padding: 32, textAlign: 'center' }}><div className="spinner" /></div>
        ) : irrigations.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 14 }}>
            {irrYear} ilü üçün suvarma qeydi yoxdur
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Tarix</th>
                  <th>Növ</th>
                  <th>Sürət</th>
                  <th>mm</th>
                  <th>Müddət</th>
                  <th>Həcm</th>
                  <th>Qeydiyyatçı</th>
                  <th>Qeyd</th>
                </tr>
              </thead>
              <tbody>
                {irrigations.map((irr) => {
                  const cfg = TYPE_CFG[irr.irrigationType] || { label: irr.irrigationType, color: '#6B7280' };
                  return (
                    <tr key={irr.id}>
                      <td style={{ fontWeight: 600, fontSize: 13, whiteSpace: 'nowrap' }}>
                        {format(new Date(irr.irrigationDate), 'dd.MM.yyyy')}
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700, color: cfg.color,
                          background: `${cfg.color}18`, borderRadius: 8, padding: '2px 8px',
                        }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{irr.pivotSpeed != null ? `${irr.pivotSpeed}%` : '—'}</td>
                      <td style={{ fontWeight: 700, color: '#06B6D4' }}>{irr.waterMm != null ? `${irr.waterMm}` : '—'}</td>
                      <td style={{ fontSize: 13 }}>{irr.duration != null ? `${irr.duration}s` : '—'}</td>
                      <td style={{ fontSize: 13 }}>{irr.waterVolume != null ? `${irr.waterVolume}m³` : '—'}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{irr.user.fullName}</td>
                      <td style={{ fontSize: 12, color: 'var(--text-tertiary)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {irr.notes || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
