'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3, Droplets, Package, Tractor, Leaf,
  RefreshCw, FileDown, Calendar, Filter, CloudRain,
  TrendingUp, Activity, ChevronRight,
} from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────
const MONTH_NAMES: Record<string, string> = {
  '01': 'Yan', '02': 'Fev', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'İyn', '07': 'İyl', '08': 'Avq',
  '09': 'Sen', '10': 'Okt', '11': 'Noy', '12': 'Dek',
};
const fmtMonth = (ym: string) => {
  const [y, m] = ym.split('-');
  return `${MONTH_NAMES[m] || m} ${y}`;
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, bg }: {
  icon: any; label: string; value: string | number;
  sub?: string; color: string; bg: string;
}) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
      borderRadius: 'var(--radius-lg)', padding: '18px 20px',
      display: 'flex', alignItems: 'center', gap: 16,
      transition: 'box-shadow 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 4px 20px ${color}20`)}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
    >
      <div style={{
        width: 48, height: 48, borderRadius: 14,
        background: bg, display: 'flex', alignItems: 'center',
        justifyContent: 'center', color, flexShrink: 0,
      }}>
        <Icon size={22} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginTop: 2 }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{sub}</div>}
      </div>
    </div>
  );
}

// ─── Bar Chart ────────────────────────────────────────────────────────────────
function BarChart({ data, valueKey, labelKey, color = '#10B981', unit = '' }: {
  data: any[]; valueKey: string; labelKey: string; color?: string; unit?: string;
}) {
  if (!data.length) return (
    <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-tertiary)', fontSize: 13 }}>
      Məlumat yoxdur
    </div>
  );
  const max = Math.max(...data.map(d => d[valueKey] || 0));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {data.map((d, i) => {
        const val = d[valueKey] || 0;
        const pct = max > 0 ? (val / max) * 100 : 0;
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 90, textAlign: 'right', flexShrink: 0,
              fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }} title={d[labelKey]}>
              {d[labelKey]}
            </div>
            <div style={{ flex: 1, background: 'var(--bg-tertiary)', borderRadius: 4, height: 22, overflow: 'hidden' }}>
              <div style={{
                width: `${Math.max(pct, 2)}%`, height: '100%',
                background: color, borderRadius: 4,
                display: 'flex', alignItems: 'center', paddingLeft: 6,
                transition: 'width 0.6s ease',
              }}>
                {pct > 25 && (
                  <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>{val}{unit}</span>
                )}
              </div>
            </div>
            {pct <= 25 && (
              <span style={{ fontSize: 11, fontWeight: 700, width: 40, textAlign: 'left', color }}>{val}{unit}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Chart Card ───────────────────────────────────────────────────────────────
function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, color: 'var(--text-secondary)' }}>{title}</h3>
      {children}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [farms, setFarms] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);

  const [farmId, setFarmId] = useState('');
  const [seasonId, setSeasonId] = useState('');
  const currentYear = new Date().getFullYear();
  const [from, setFrom] = useState(`${currentYear}-01-01`);
  const [to, setTo] = useState(`${currentYear}-12-31`);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (farmId) params.set('farmId', farmId);
      if (seasonId) params.set('seasonId', seasonId);
      if (from) params.set('from', from);
      if (to) params.set('to', to);

      const [rRes, fRes, sRes] = await Promise.all([
        fetch(`/api/reports?${params}`),
        fetch('/api/farms'),
        fetch('/api/seasons'),
      ]);
      if (rRes.ok) setData(await rRes.json());
      if (fRes.ok) setFarms(await fRes.json());
      if (sRes.ok) setSeasons(await sRes.json());
    } finally {
      setLoading(false);
    }
  }, [farmId, seasonId, from, to]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const exportUrl = () => {
    const params = new URLSearchParams();
    if (farmId) params.set('farmId', farmId);
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    return `/api/export/processes?${params}`;
  };

  // Quick date presets
  const presets = [
    { label: 'Bu ay', from: new Date(currentYear, new Date().getMonth(), 1).toISOString().split('T')[0], to: new Date(currentYear, new Date().getMonth() + 1, 0).toISOString().split('T')[0] },
    { label: 'Bu il', from: `${currentYear}-01-01`, to: `${currentYear}-12-31` },
    { label: 'Son 90 gün', from: new Date(Date.now() - 90 * 864e5).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] },
    { label: 'Keçən il', from: `${currentYear - 1}-01-01`, to: `${currentYear - 1}-12-31` },
  ];

  return (
    <div className="page-content">
      {/* ── Header ── */}
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">
            <BarChart3 size={22} style={{ marginRight: 8, verticalAlign: 'text-bottom', color: '#8B5CF6' }} />
            Hesabatlar
          </h1>
          <p className="page-description">Sezonluq və aylıq analitika</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            Yenilə
          </button>
        </div>
      </div>

      {/* ── Export Panel ── */}
      <div className="card" style={{ marginBottom: 20, padding: '14px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
          <FileDown size={15} style={{ color: '#10B981' }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Korporativ Hesabat Eksportu</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {/* Per-module exports */}
          {[
            { type: 'processes', label: 'Aqrotexniki işlər', icon: '🚜', color: '#F59E0B' },
            { type: 'irrigations', label: 'Suvarma qeydləri', icon: '💧', color: '#3B82F6' },
            { type: 'monitoring-field', label: 'Sahə monitorinqi', icon: '🔬', color: '#8B5CF6' },
            { type: 'warehouse', label: 'Anbar hərəkəti', icon: '📦', color: '#06B6D4' },
          ].map(exp => {
            const params = new URLSearchParams();
            if (farmId) params.set('farmId', farmId);
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            return (
              <div key={exp.type} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 14px', borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-primary)', background: 'var(--bg-secondary)',
              }}>
                <span style={{ fontSize: 20 }}>{exp.icon}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 12, color: exp.color }}>{exp.label}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <a href={`/api/export/${exp.type}?${params}&format=xlsx`} download
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: 'rgba(16,185,129,0.15)', color: '#10B981',
                      fontWeight: 700, fontSize: 11, textDecoration: 'none',
                    }}>
                    Excel
                  </a>
                  <a href={`/api/export/${exp.type}?${params}&format=docx`} download
                    style={{
                      padding: '4px 10px', borderRadius: 6, border: 'none', cursor: 'pointer',
                      background: 'rgba(59,130,246,0.15)', color: '#3B82F6',
                      fontWeight: 700, fontSize: 11, textDecoration: 'none',
                    }}>
                    Word
                  </a>
                </div>
              </div>
            );
          })}
        </div>

        {/* Template exports */}
        <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, alignSelf: 'center' }}>
            Şablonlar:
          </span>
          {[
            { tpl: 'weekly', label: 'Həftəlik hesabat', color: '#10B981' },
            { tpl: 'monthly', label: 'Aylıq hesabat', color: '#3B82F6' },
            { tpl: 'seasonal', label: 'Sezonluq hesabat', color: '#8B5CF6' },
          ].map(t => {
            const params = new URLSearchParams({ format: 'xlsx', template: t.tpl });
            if (farmId) params.set('farmId', farmId);
            if (from) params.set('from', from);
            if (to) params.set('to', to);
            return (
              <a key={t.tpl} href={`/api/export/processes?${params}`} download
                style={{
                  padding: '6px 14px', borderRadius: 20, border: `1px solid ${t.color}40`,
                  background: `${t.color}15`, color: t.color,
                  fontWeight: 700, fontSize: 12, textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                <FileDown size={12} /> {t.label}
              </a>
            );
          })}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
          <Filter size={15} style={{ color: 'var(--color-primary)' }} />
          <span style={{ fontWeight: 700, fontSize: 13 }}>Filtrlər</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
          <select className="form-select" value={farmId} onChange={e => setFarmId(e.target.value)} style={{ minWidth: 160, fontSize: 13 }}>
            <option value="">Bütün təsərrüfatlar</option>
            {farms.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          <select className="form-select" value={seasonId} onChange={e => setSeasonId(e.target.value)} style={{ minWidth: 160, fontSize: 13 }}>
            <option value="">Bütün mövsümlər</option>
            {seasons.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} style={{ color: 'var(--text-tertiary)' }} />
            <input type="date" className="form-input" value={from} onChange={e => setFrom(e.target.value)} style={{ fontSize: 13, padding: '5px 8px' }} />
            <span style={{ color: 'var(--text-tertiary)' }}>—</span>
            <input type="date" className="form-input" value={to} onChange={e => setTo(e.target.value)} style={{ fontSize: 13, padding: '5px 8px' }} />
          </div>

          {/* Quick presets */}
          <div style={{ display: 'flex', gap: 4 }}>
            {presets.map(p => (
              <button key={p.label} className="btn btn-ghost"
                style={{ fontSize: 12, padding: '4px 10px' }}
                onClick={() => { setFrom(p.from); setTo(p.to); }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Hesabat yüklənir...</div></div>
      ) : data ? (
        <>
          {/* ── Stat Cards ── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 20 }}>
            <StatCard icon={Tractor} label="Aqrotexniki iş" value={data.summary.totalProcesses} color="#8B5CF6" bg="rgba(139,92,246,0.12)" />
            <StatCard icon={Droplets} label="Suvarma qeydi" value={data.summary.totalIrrigations} sub={`${data.summary.totalMm} mm · ${data.summary.totalM3} m³`} color="#06B6D4" bg="rgba(6,182,212,0.12)" />
            <StatCard icon={Package} label="Preparat tətbiqi" value={data.summary.totalMaterials} sub={`${data.summary.uniqueMaterials} növ`} color="#F59E0B" bg="rgba(245,158,11,0.12)" />
            <StatCard icon={Leaf} label="İzlənən sahə" value={data.byField?.length || 0} color="#10B981" bg="rgba(16,185,129,0.12)" />
          </div>

          {/* ── Charts Grid ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
            <ChartCard title="🌱 Əməliyyat növü üzrə">
              <BarChart data={data.byCategory} labelKey="label" valueKey="count" color="#8B5CF6" unit=" əd" />
            </ChartCard>

            <ChartCard title="📅 Aylıq əməliyyat sayı">
              <BarChart
                data={data.byMonth.map((m: any) => ({ ...m, monthLabel: fmtMonth(m.month) }))}
                labelKey="monthLabel" valueKey="count" color="#6366F1"
              />
            </ChartCard>

            <ChartCard title="💧 Aylıq suvarma (mm)">
              <BarChart
                data={data.irrByMonth.map((m: any) => ({ ...m, monthLabel: fmtMonth(m.month) }))}
                labelKey="monthLabel" valueKey="totalMm" color="#06B6D4" unit=" mm"
              />
            </ChartCard>

            <ChartCard title="🧪 Preparat istifadəsi (top 10)">
              <BarChart
                data={data.materialUsage.slice(0, 10).map((m: any) => ({ ...m, qty: Math.round(m.totalQty * 100) / 100 }))}
                labelKey="name" valueKey="qty" color="#F59E0B"
              />
            </ChartCard>
          </div>

          {/* ── Field Activity Table ── */}
          {data.byField?.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-primary)', fontWeight: 700, fontSize: 14 }}>
                🗺️ Sahə fəaliyyəti
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Sahə</th>
                      <th>Təsərrüfat</th>
                      <th>Sahə (ha)</th>
                      <th>Proses</th>
                      <th>Suvarma</th>
                      <th style={{ width: 160 }}>Aktivlik</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.byField.map((f: any, i: number) => {
                      const maxProc = data.byField[0]?.processCount || 1;
                      const pct = Math.round((f.processCount / maxProc) * 100);
                      return (
                        <tr key={i}>
                          <td style={{ fontWeight: 700, fontSize: 14 }}>{f.fieldNumber}</td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{f.farmName}</td>
                          <td style={{ fontSize: 13 }}>{f.totalHa} ha</td>
                          <td>
                            <span style={{
                              fontWeight: 700, color: '#8B5CF6',
                              background: 'rgba(139,92,246,0.12)', borderRadius: 8,
                              padding: '2px 10px', fontSize: 13,
                            }}>{f.processCount}</span>
                          </td>
                          <td>
                            <span style={{
                              fontWeight: 700, color: '#06B6D4',
                              background: 'rgba(6,182,212,0.12)', borderRadius: 8,
                              padding: '2px 10px', fontSize: 13,
                            }}>{f.irrCount}</span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ flex: 1, height: 8, background: 'var(--bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{
                                  width: `${pct}%`, height: '100%',
                                  background: pct > 70 ? '#10B981' : pct > 40 ? '#F59E0B' : '#6B7280',
                                  borderRadius: 4, transition: 'width 0.5s',
                                }} />
                              </div>
                              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', minWidth: 28 }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Warehouse Write-offs ── */}
          {data.writeOffSummary?.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-primary)', fontWeight: 700, fontSize: 14 }}>
                📦 Anbar silinmə xülasəsi
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Preparat</th>
                      <th>Ümumi silinən</th>
                      <th>Vahid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.writeOffSummary.map((w: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 600 }}>{w.name}</td>
                        <td style={{ fontWeight: 800, color: '#EF4444' }}>{Math.round(w.total * 100) / 100}</td>
                        <td style={{ color: 'var(--text-tertiary)', fontSize: 12 }}>{w.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-tertiary)', fontSize: 14 }}>
          Məlumat tapılmadı
        </div>
      )}
    </div>
  );
}
