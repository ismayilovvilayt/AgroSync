'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Tractor, MapPin, LandPlot, Cog, Droplets, Leaf,
  Clock, ArrowRight, AlertTriangle, Bell,
  CloudSun, BarChart3, Eye, Wheat,
  CalendarDays, TrendingUp, Activity, Package,
  Zap, CheckCircle2, Timer, ArrowUpRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { az } from 'date-fns/locale';
import Link from 'next/link';

// ─── Animated Counter ────────────────────────────────────────────────────────
function AnimatedCounter({ target, suffix = '', duration = 1200 }: { target: number; suffix?: string; duration?: number }) {
  const [current, setCurrent] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(target * ease));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return <>{current.toLocaleString('az')}{suffix}</>;
}

const cropStatusLabels: Record<string, { label: string; color: string; bg: string }> = {
  PLANNED:    { label: 'Planlanıb',  color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  SOWN:       { label: 'Əkilib',     color: '#3B82F6', bg: 'rgba(59,130,246,0.15)' },
  GROWING:    { label: 'Böyüyür',   color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
  HARVESTING: { label: 'Biçilir',   color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  HARVESTED:  { label: 'Biçilib',   color: '#6B7280', bg: 'rgba(107,114,128,0.15)' },
};

const processTypeLabels: Record<string, { label: string; color: string }> = {
  PLOWING:     { label: 'Şumlama',    color: '#A78BFA' },
  SOWING:      { label: 'Əkin',       color: '#34D399' },
  FERTILIZING: { label: 'Gübrə',      color: '#60A5FA' },
  SPRAYING:    { label: 'Dərman',     color: '#F87171' },
  HARVESTING:  { label: 'Biçin',      color: '#FBBF24' },
  CULTIVATION: { label: 'Becərmə',   color: '#FB923C' },
  OTHER:       { label: 'Digər',      color: '#94A3B8' },
};

const irrigationTypeLabels: Record<string, string> = {
  DRIP: 'Damcı', SPRINKLER: 'Yağmurlama', FLOOD: 'Süzgəc',
  FURROW: 'Şırım', PIVOT: 'Pivot',
};

interface DashboardData {
  stats: {
    farms: number; fields: number; totalHectares: number;
    processes: number; irrigations: number; warehouseItems: number;
    pendingWriteoffs: number; lowStockCount: number; overdueIrrigations: number;
  };
  charts: {
    monthlyActivity: any[];
    processTypeChart: any[];
    warehouseChart: any[];
  };
  activeCrops: Array<{
    id: string; cropType: string; status: string;
    sowingDate: string | null; fieldNumber: string;
    farmName: string; hectares: number; plantedArea: number | null;
  }>;
  recentProcesses: Array<{
    id: string; type: string; fieldNumber: string; farmName: string;
    date: string; status: string; user: string;
  }>;
  recentIrrigations: Array<{
    id: string; type: string; fieldNumber: string; farmName: string;
    date: string; user: string;
  }>;
  recentNotes: any[];
}

export default function DashboardClient({ data }: { data: DashboardData }) {
  const { stats, recentProcesses, recentIrrigations, activeCrops } = data;
  const today = format(new Date(), 'dd MMMM yyyy, EEEE', { locale: az });
  const alertCount = stats.pendingWriteoffs + stats.lowStockCount + stats.overdueIrrigations;

  // KPI cards config
  const kpiCards = [
    {
      icon: Tractor,
      label: 'Təsərrüfatlar',
      value: stats.farms,
      sub: `${stats.fields} sahə`,
      color: '#10B981',
      gradient: 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(16,185,129,0.05) 100%)',
      glow: 'rgba(16,185,129,0.25)',
      href: '/dashboard/farms',
    },
    {
      icon: LandPlot,
      label: 'Ümumi sahə',
      value: Math.round(stats.totalHectares),
      suffix: ' ha',
      sub: 'hektar',
      color: '#8B5CF6',
      gradient: 'linear-gradient(135deg, rgba(139,92,246,0.18) 0%, rgba(139,92,246,0.05) 100%)',
      glow: 'rgba(139,92,246,0.25)',
      href: '/dashboard/fields',
    },
    {
      icon: Cog,
      label: 'Proseslər',
      value: stats.processes,
      sub: 'cəmi qeyd',
      color: '#F59E0B',
      gradient: 'linear-gradient(135deg, rgba(245,158,11,0.18) 0%, rgba(245,158,11,0.05) 100%)',
      glow: 'rgba(245,158,11,0.25)',
      href: '/dashboard/processes',
    },
    {
      icon: Droplets,
      label: 'Suvarmalar',
      value: stats.irrigations,
      sub: 'cəmi qeyd',
      color: '#06B6D4',
      gradient: 'linear-gradient(135deg, rgba(6,182,212,0.18) 0%, rgba(6,182,212,0.05) 100%)',
      glow: 'rgba(6,182,212,0.25)',
      href: '/dashboard/irrigation',
    },
  ];

  // Quick nav links
  const quickLinks = [
    { href: '/dashboard/monitoring', icon: Eye,      label: 'Monitorinqlər', color: '#A78BFA', desc: 'Sahə müşahidəsi' },
    { href: '/dashboard/weather',    icon: CloudSun,  label: 'Hava Proqnozu', color: '#38BDF8', desc: 'Cari hava' },
    { href: '/dashboard/reports',    icon: BarChart3, label: 'Hesabatlar',    color: '#818CF8', desc: 'Analitika' },
    { href: '/dashboard/warehouse',  icon: Package,   label: 'Anbar',         color: '#FB923C', desc: 'Stok idarəsi' },
    { href: '/dashboard/tasks',      icon: CheckCircle2, label: 'Tapşırıqlar', color: '#34D399', desc: 'Aktiv tapşırıqlar' },
  ];

  return (
    <div style={{ padding: '20px 24px', maxWidth: 1440, margin: '0 auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>
            İdarə Paneli
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-tertiary)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
            <CalendarDays size={13} />
            {today}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href="/dashboard/reports" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.25)',
            color: '#A78BFA', fontSize: 13, fontWeight: 600, textDecoration: 'none',
            transition: 'all 0.2s',
          }}>
            <BarChart3 size={14} /> Hesabatlar
          </Link>
          <Link href="/dashboard/alerts" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 10,
            background: alertCount > 0 ? 'rgba(239,68,68,0.12)' : 'rgba(51,65,85,0.4)',
            border: `1px solid ${alertCount > 0 ? 'rgba(239,68,68,0.3)' : 'rgba(51,65,85,0.5)'}`,
            color: alertCount > 0 ? '#FCA5A5' : 'var(--text-secondary)',
            fontSize: 13, fontWeight: 600, textDecoration: 'none', position: 'relative',
          }}>
            <Bell size={14} />
            Xəbərdarlıqlar
            {alertCount > 0 && (
              <span style={{
                background: '#EF4444', color: 'white',
                borderRadius: '50%', width: 18, height: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, fontWeight: 700,
              }}>{alertCount}</span>
            )}
          </Link>
        </div>
      </div>

      {/* ── Alert Strip ────────────────────────────────────────────────────── */}
      {alertCount > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
          {stats.pendingWriteoffs > 0 && (
            <Link href="/dashboard/warehouse/write-offs" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 10,
              background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
              color: '#FCD34D', fontSize: 13, textDecoration: 'none',
            }}>
              <AlertTriangle size={14} />
              <span><strong>{stats.pendingWriteoffs}</strong> silinmə gözləyir</span>
              <ArrowRight size={13} style={{ opacity: 0.6 }} />
            </Link>
          )}
          {stats.lowStockCount > 0 && (
            <Link href="/dashboard/warehouse" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 10,
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)',
              color: '#FCA5A5', fontSize: 13, textDecoration: 'none',
            }}>
              <AlertTriangle size={14} />
              <span><strong>{stats.lowStockCount}</strong> məhsul az stokda</span>
              <ArrowRight size={13} style={{ opacity: 0.6 }} />
            </Link>
          )}
          {stats.overdueIrrigations > 0 && (
            <Link href="/dashboard/irrigation/calendar" style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '8px 14px', borderRadius: 10,
              background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.25)',
              color: '#67E8F9', fontSize: 13, textDecoration: 'none',
            }}>
              <Droplets size={14} />
              <span><strong>{stats.overdueIrrigations}</strong> sahədə suvarma gecikir</span>
              <ArrowRight size={13} style={{ opacity: 0.6 }} />
            </Link>
          )}
        </div>
      )}

      {/* ── KPI Cards ──────────────────────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        marginBottom: 20,
      }}>
        {kpiCards.map((card) => (
          <Link key={card.label} href={card.href} style={{ textDecoration: 'none' }}>
            <div
              className="kpi-card"
              style={{
                background: card.gradient,
                border: `1px solid ${card.glow}`,
                borderRadius: 16,
                padding: '18px 20px',
                position: 'relative',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = `0 12px 30px ${card.glow}`;
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
                (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
              }}
            >
              {/* Glow orb */}
              <div style={{
                position: 'absolute', top: -20, right: -20,
                width: 80, height: 80, borderRadius: '50%',
                background: card.glow, filter: 'blur(25px)', opacity: 0.6,
              }} />

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 12,
                  background: `${card.color}22`,
                  border: `1px solid ${card.color}44`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <card.icon size={18} style={{ color: card.color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 26, fontWeight: 800, color: 'var(--text-primary)',
                    lineHeight: 1, letterSpacing: '-0.5px',
                  }}>
                    <AnimatedCounter target={card.value} suffix={card.suffix || ''} />
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
                    {card.label}
                  </div>
                  <div style={{
                    fontSize: 11, color: card.color, marginTop: 6,
                    display: 'flex', alignItems: 'center', gap: 3,
                  }}>
                    <Activity size={10} />
                    {card.sub}
                  </div>
                </div>
              </div>
              <div style={{ position: 'absolute', bottom: 14, right: 14 }}>
                <ArrowUpRight size={14} style={{ color: card.color, opacity: 0.5 }} />
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Main Layout ────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 14, alignItems: 'start' }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Son Proseslər */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: 16, overflow: 'hidden',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid var(--border-secondary)',
            }}>
              <h2 style={{
                fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 7, margin: 0,
              }}>
                <Cog size={15} style={{ color: '#F59E0B' }} />
                Son Aqrotexniki Proseslər
              </h2>
              <Link href="/dashboard/processes" style={{
                fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 3,
                fontWeight: 600,
              }}>
                Hamısı <ArrowRight size={12} />
              </Link>
            </div>
            {recentProcesses.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                Hələ proses qeyd olunmayıb
              </div>
            ) : (
              <div>
                {recentProcesses.map((p, idx) => {
                  const pt = processTypeLabels[p.type] || { label: p.type, color: '#94A3B8' };
                  return (
                    <div key={p.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '11px 18px',
                      borderBottom: idx < recentProcesses.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                      transition: 'background 0.15s',
                    }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                    >
                      <div style={{
                        width: 8, height: 8, borderRadius: '50%',
                        background: pt.color, flexShrink: 0,
                        boxShadow: `0 0 6px ${pt.color}`,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                          {pt.label}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                          <MapPin size={10} />
                          {p.farmName} · Pivot {p.fieldNumber}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 6,
                          background: `${pt.color}18`, color: pt.color,
                        }}>
                          {pt.label}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Clock size={10} />
                          {format(new Date(p.date), 'dd MMM', { locale: az })}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Son Suvarmalar */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: 16, overflow: 'hidden',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid var(--border-secondary)',
            }}>
              <h2 style={{
                fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 7, margin: 0,
              }}>
                <Droplets size={15} style={{ color: '#06B6D4' }} />
                Son Suvarmalar
              </h2>
              <Link href="/dashboard/irrigation" style={{
                fontSize: 12, color: 'var(--color-primary)', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 3, fontWeight: 600,
              }}>
                Hamısı <ArrowRight size={12} />
              </Link>
            </div>
            {recentIrrigations.length === 0 ? (
              <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                Hələ suvarma qeyd olunmayıb
              </div>
            ) : (
              <div>
                {recentIrrigations.map((irr, idx) => (
                  <div key={irr.id} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '11px 18px',
                    borderBottom: idx < recentIrrigations.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                    transition: 'background 0.15s',
                  }}
                    onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'rgba(255,255,255,0.03)'}
                    onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                  >
                    <div style={{
                      width: 34, height: 34, borderRadius: 10,
                      background: 'rgba(6,182,212,0.12)',
                      border: '1px solid rgba(6,182,212,0.2)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                      <Droplets size={14} style={{ color: '#06B6D4' }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                        {irrigationTypeLabels[irr.type] || irr.type} suvarma
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {irr.farmName} · Pivot {irr.fieldNumber}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: '#06B6D4', fontWeight: 600 }}>
                        {irrigationTypeLabels[irr.type] || irr.type}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                        {format(new Date(irr.date), 'dd MMM', { locale: az })}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* RIGHT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Aktiv Bitkilər */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: 16, overflow: 'hidden',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', borderBottom: '1px solid var(--border-secondary)',
            }}>
              <h2 style={{
                fontSize: 14, fontWeight: 600, color: 'var(--text-primary)',
                display: 'flex', alignItems: 'center', gap: 7, margin: 0,
              }}>
                <Leaf size={15} style={{ color: '#10B981' }} />
                Aktiv Bitkilər
              </h2>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                background: 'rgba(16,185,129,0.15)', color: '#10B981',
              }}>
                {activeCrops.length}
              </span>
            </div>
            {activeCrops.length === 0 ? (
              <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 13 }}>
                Aktiv bitki yoxdur
              </div>
            ) : (
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {activeCrops.map((crop, idx) => {
                  const cs = cropStatusLabels[crop.status] || { label: crop.status, color: '#94A3B8', bg: 'rgba(148,163,184,0.1)' };
                  const ha = crop.plantedArea ?? crop.hectares;
                  return (
                    <div key={crop.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 18px',
                      borderBottom: idx < activeCrops.length - 1 ? '1px solid var(--border-secondary)' : 'none',
                    }}>
                      <div style={{
                        width: 32, height: 32, borderRadius: 9,
                        background: 'rgba(16,185,129,0.1)',
                        border: '1px solid rgba(16,185,129,0.2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                      }}>
                        <Wheat size={14} style={{ color: '#10B981' }} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {crop.cropType}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                          Pivot {crop.fieldNumber} · {crop.farmName}
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3, flexShrink: 0 }}>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 6,
                          background: cs.bg, color: cs.color,
                        }}>
                          {cs.label}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                          {ha} ha
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sürətli Keçidlər */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: 16, overflow: 'hidden',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-secondary)' }}>
              <h2 style={{
                fontSize: 13, fontWeight: 600, color: 'var(--text-tertiary)',
                display: 'flex', alignItems: 'center', gap: 6, margin: 0,
                textTransform: 'uppercase', letterSpacing: '0.05em',
              }}>
                <Zap size={13} />
                Sürətli Keçidlər
              </h2>
            </div>
            <div style={{ padding: '8px 10px' }}>
              {quickLinks.map(link => (
                <Link key={link.href} href={link.href} style={{
                  display: 'flex', alignItems: 'center', gap: 11,
                  padding: '10px 10px', borderRadius: 10,
                  textDecoration: 'none',
                  transition: 'background 0.15s',
                  position: 'relative',
                }}
                  onMouseEnter={e => (e.currentTarget as HTMLAnchorElement).style.background = 'rgba(255,255,255,0.04)'}
                  onMouseLeave={e => (e.currentTarget as HTMLAnchorElement).style.background = 'transparent'}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: `${link.color}15`,
                    border: `1px solid ${link.color}25`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <link.icon size={15} style={{ color: link.color }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{link.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{link.desc}</div>
                  </div>
                  <ArrowRight size={14} style={{ color: 'var(--text-tertiary)', opacity: 0.4 }} />
                </Link>
              ))}
            </div>
          </div>

          {/* Anbar Xülasəsi */}
          {(stats.pendingWriteoffs > 0 || stats.lowStockCount > 0) && (
            <div style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(239,68,68,0.06) 100%)',
              border: '1px solid rgba(245,158,11,0.2)',
              borderRadius: 16, padding: '16px 18px',
              backdropFilter: 'blur(10px)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#FCD34D', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <AlertTriangle size={14} /> Anbar Xəbərdarlıqları
              </div>
              {stats.pendingWriteoffs > 0 && (
                <Link href="/dashboard/warehouse/write-offs" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 9,
                  background: 'rgba(245,158,11,0.1)', marginBottom: 6,
                  textDecoration: 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Timer size={13} style={{ color: '#F59E0B' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Silinmə gözləyir</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#FBBF24' }}>{stats.pendingWriteoffs}</span>
                </Link>
              )}
              {stats.lowStockCount > 0 && (
                <Link href="/dashboard/warehouse" style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', borderRadius: 9,
                  background: 'rgba(239,68,68,0.1)',
                  textDecoration: 'none',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Package size={13} style={{ color: '#EF4444' }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Az stok</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#FCA5A5' }}>{stats.lowStockCount}</span>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
