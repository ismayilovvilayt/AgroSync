'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Bell, AlertTriangle, AlertCircle, Info, Droplets, Package,
  Trash2, ScanEye, RefreshCw, CheckCircle2, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

type AlertSeverity = 'error' | 'warning' | 'info';
type AlertType = 'IRRIGATION_OVERDUE' | 'LOW_STOCK' | 'PENDING_WRITEOFF' | 'NO_MONITORING';

interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  fieldId?: string;
  fieldNumber?: string;
  farmName?: string;
}

interface AlertData {
  total: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  alerts: Alert[];
}

const severityConfig = {
  error: {
    icon: AlertCircle,
    bg: 'bg-error/10 border-error/30',
    iconColor: 'text-error',
    badge: 'badge-error',
    label: 'Kritik',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-warning/10 border-warning/30',
    iconColor: 'text-warning',
    badge: 'badge-warning',
    label: 'Xəbərdarlıq',
  },
  info: {
    icon: Info,
    bg: 'bg-info/10 border-info/30',
    iconColor: 'text-info',
    badge: 'badge-info',
    label: 'Məlumat',
  },
};

const typeConfig: Record<AlertType, { icon: any; link?: string; linkLabel?: string }> = {
  IRRIGATION_OVERDUE: { icon: Droplets, link: '/dashboard/irrigation', linkLabel: 'Suvarma' },
  LOW_STOCK: { icon: Package, link: '/dashboard/warehouse', linkLabel: 'Anbar' },
  PENDING_WRITEOFF: { icon: Trash2, link: '/dashboard/warehouse/write-offs', linkLabel: 'Silinmə' },
  NO_MONITORING: { icon: ScanEye, link: '/dashboard/monitoring', linkLabel: 'Monitorinq' },
};

export default function AlertsPage() {
  const [data, setData] = useState<AlertData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<AlertSeverity | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<AlertType | 'all'>('all');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        setData(await res.json());
        setLastRefresh(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  const filtered = data?.alerts.filter(a => {
    if (filter !== 'all' && a.severity !== filter) return false;
    if (typeFilter !== 'all' && a.type !== typeFilter) return false;
    return true;
  }) ?? [];

  const typeLabels: Record<AlertType, string> = {
    IRRIGATION_OVERDUE: 'Suvarma',
    LOW_STOCK: 'Az stok',
    PENDING_WRITEOFF: 'Silinmə',
    NO_MONITORING: 'Monitorinq',
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="w-7 h-7 text-warning" /> Xəbərdarlıqlar
          </h1>
          <p className="text-sm text-base-content/50 mt-1">
            Son yenilənmə: {lastRefresh.toLocaleTimeString('az-AZ')}
          </p>
        </div>
        <button className="btn btn-outline btn-sm gap-1" onClick={fetchAlerts} disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Yenilə
        </button>
      </div>

      {/* Stats */}
      {data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Cəmi', count: data.total, color: 'text-base-content', bg: 'bg-base-200' },
            { label: 'Kritik', count: data.errorCount, color: 'text-error', bg: 'bg-error/10' },
            { label: 'Xəbərdarlıq', count: data.warningCount, color: 'text-warning', bg: 'bg-warning/10' },
            { label: 'Məlumat', count: data.infoCount, color: 'text-info', bg: 'bg-info/10' },
          ].map(stat => (
            <div key={stat.label} className={`rounded-xl p-3 ${stat.bg}`}>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.count}</p>
              <p className="text-xs text-base-content/60">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1">
          {(['all', 'error', 'warning', 'info'] as const).map(s => (
            <button
              key={s}
              className={`btn btn-xs ${filter === s ? (s === 'all' ? 'btn-neutral' : `btn-${s}`) : 'btn-ghost'}`}
              onClick={() => setFilter(s)}
            >
              {s === 'all' ? 'Hamısı' : severityConfig[s].label}
            </button>
          ))}
        </div>
        <div className="divider divider-horizontal mx-0" />
        <div className="flex gap-1 flex-wrap">
          <button className={`btn btn-xs ${typeFilter === 'all' ? 'btn-neutral' : 'btn-ghost'}`} onClick={() => setTypeFilter('all')}>
            Bütün növlər
          </button>
          {(Object.keys(typeLabels) as AlertType[]).map(t => (
            <button key={t} className={`btn btn-xs ${typeFilter === t ? 'btn-neutral' : 'btn-ghost'}`} onClick={() => setTypeFilter(t)}>
              {typeLabels[t]}
            </button>
          ))}
        </div>
      </div>

      {/* Alert List */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="loading loading-spinner loading-lg" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-base-content/40">
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4 opacity-30 text-success" />
          <p className="text-lg font-medium">Xəbərdarlıq yoxdur!</p>
          <p className="text-sm mt-1">Bütün sistemlər normal işləyir</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((alert) => {
            const sc = severityConfig[alert.severity];
            const tc = typeConfig[alert.type];
            const SeverityIcon = sc.icon;
            const TypeIcon = tc.icon;

            return (
              <div
                key={alert.id}
                className={`rounded-xl border p-4 ${sc.bg} flex items-start gap-3`}
              >
                <SeverityIcon className={`w-5 h-5 mt-0.5 shrink-0 ${sc.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`badge badge-sm ${sc.badge}`}>{sc.label}</span>
                    <TypeIcon className="w-3.5 h-3.5 text-base-content/40" />
                    <span className="text-xs text-base-content/40">{typeLabels[alert.type]}</span>
                  </div>
                  <p className="font-medium text-sm mt-1">{alert.title}</p>
                  <p className="text-xs text-base-content/60 mt-0.5">{alert.message}</p>
                </div>
                {tc.link && (
                  <Link
                    href={tc.link}
                    className="btn btn-ghost btn-xs gap-1 shrink-0"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {tc.linkLabel}
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
