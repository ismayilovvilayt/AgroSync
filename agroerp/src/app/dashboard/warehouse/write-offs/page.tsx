'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Clock, CheckCircle2, AlertCircle, ArrowLeft, Check, Filter, Search } from 'lucide-react';
import { format } from 'date-fns';
import { az } from 'date-fns/locale';

export default function WriteOffsPage() {
  const [writeOffs, setWriteOffs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'PENDING' | 'COMPLETED'>('PENDING');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  const safeJson = async (r: Response, fb: any = []) => { try { return r.ok ? await r.json() : fb; } catch { return fb; } };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/warehouse/write-offs');
      setWriteOffs(await safeJson(res, []));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pending = useMemo(() => writeOffs.filter(w => w.status === 'PENDING'), [writeOffs]);
  const completed = useMemo(() => writeOffs.filter(w => w.status === 'COMPLETED'), [writeOffs]);
  const currentList = tab === 'PENDING' ? pending : completed;

  const filtered = useMemo(() => {
    if (!searchTerm) return currentList;
    const term = searchTerm.toLowerCase();
    return currentList.filter(w =>
      w.warehouseItem?.name?.toLowerCase().includes(term) ||
      w.field?.fieldNumber?.toLowerCase().includes(term) ||
      w.agroProcessMaterial?.agroProcess?.category?.name?.toLowerCase().includes(term)
    );
  }, [currentList, searchTerm]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === pending.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pending.map(w => w.id)));
    }
  };

  const handleBatchComplete = async () => {
    if (!selectedIds.size) return;
    setSaving(true);
    try {
      const res = await fetch('/api/warehouse/write-offs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      if (res.ok) {
        setSelectedIds(new Set());
        fetchData();
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
    </div>
  );

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <a href="/dashboard/warehouse" className="btn btn-ghost btn-sm gap-1 mb-2"><ArrowLeft className="w-4 h-4" /> Anbara Qayıt</a>
          <h1 className="text-2xl font-bold text-base-content flex items-center gap-2">
            <Clock className="w-7 h-7 text-warning" /> Silinmə İzləmə
          </h1>
          <p className="text-sm text-base-content/60 mt-1">
            Aqrotexniki işlərdən gələn material istifadələri. Silinməni təsdiqləyin.
          </p>
        </div>
        {tab === 'PENDING' && selectedIds.size > 0 && (
          <button className="btn btn-success btn-sm gap-1" onClick={handleBatchComplete} disabled={saving}>
            <CheckCircle2 className="w-4 h-4" />
            {selectedIds.size} ədəd silinməni təsdiqlə
          </button>
        )}
      </div>

      {/* Tabs + Stats */}
      <div className="flex flex-wrap gap-4 items-center">
        <div className="tabs tabs-boxed">
          <button className={`tab ${tab === 'PENDING' ? 'tab-active' : ''}`} onClick={() => { setTab('PENDING'); setSelectedIds(new Set()); }}>
            🔴 Gözləmədə
            {pending.length > 0 && <span className="badge badge-error badge-sm ml-2">{pending.length}</span>}
          </button>
          <button className={`tab ${tab === 'COMPLETED' ? 'tab-active' : ''}`} onClick={() => { setTab('COMPLETED'); setSelectedIds(new Set()); }}>
            ✅ Silinib
            <span className="badge badge-success badge-sm ml-2">{completed.length}</span>
          </button>
        </div>
        <div className="flex-1 min-w-[200px]">
          <input type="text" className="input input-bordered input-sm w-full max-w-xs" placeholder="Axtarış..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {/* Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="text-xs bg-base-200/50">
                  {tab === 'PENDING' && (
                    <th className="w-10">
                      <input type="checkbox" className="checkbox checkbox-xs" checked={selectedIds.size === pending.length && pending.length > 0} onChange={selectAll} />
                    </th>
                  )}
                  <th>Proses Tarixi</th>
                  <th>Sahə</th>
                  <th>Preparat</th>
                  <th>Miqdar</th>
                  <th>Əməliyyat</th>
                  <th>Bitki</th>
                  <th>Status</th>
                  {tab === 'COMPLETED' && <th>Silinmə Tarixi</th>}
                  {tab === 'PENDING' && <th className="text-center">Əməliyyat</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(w => {
                  const proc = w.agroProcessMaterial?.agroProcess;
                  return (
                    <tr key={w.id} className={`hover ${tab === 'PENDING' ? 'bg-warning/5' : ''}`}>
                      {tab === 'PENDING' && (
                        <td>
                          <input type="checkbox" className="checkbox checkbox-xs checkbox-warning" checked={selectedIds.has(w.id)} onChange={() => toggleSelect(w.id)} />
                        </td>
                      )}
                      <td className="text-xs font-medium">
                        {format(new Date(w.processDate), 'dd.MM.yyyy', { locale: az })}
                      </td>
                      <td>
                        <div className="font-medium">Sahə {w.field?.fieldNumber}</div>
                        <div className="text-xs text-base-content/50">{w.field?.farm?.name}</div>
                      </td>
                      <td>
                        <div className="font-medium">{w.warehouseItem?.name}</div>
                        <div className="text-xs font-mono text-base-content/50">{w.warehouseItem?.code1C || ''}</div>
                      </td>
                      <td className="font-bold">{w.quantity.toLocaleString()} <span className="text-xs font-normal text-base-content/60">{w.warehouseItem?.unit}</span></td>
                      <td className="text-xs">
                        {proc?.category?.name || '—'}
                        {proc?.process?.name && <span className="text-base-content/50"> / {proc.process.name}</span>}
                      </td>
                      <td className="text-xs">{proc?.seasonField?.cropType || '—'}</td>
                      <td>
                        {w.status === 'PENDING' ? (
                          <span className="badge badge-warning badge-sm gap-1"><AlertCircle className="w-3 h-3" />Gözləmədə</span>
                        ) : (
                          <span className="badge badge-success badge-sm gap-1"><CheckCircle2 className="w-3 h-3" />Silindi</span>
                        )}
                      </td>
                      {tab === 'COMPLETED' && (
                        <td className="text-xs">
                          {w.completedAt ? format(new Date(w.completedAt), 'dd.MM.yyyy', { locale: az }) : '—'}
                        </td>
                      )}
                      {tab === 'PENDING' && (
                        <td className="text-center">
                          <button className="btn btn-success btn-xs gap-1" onClick={async () => {
                            await fetch('/api/warehouse/write-offs', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ ids: [w.id] }),
                            });
                            fetchData();
                          }}>
                            <Check className="w-3 h-3" /> Sil
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-base-content/40">
                      {tab === 'PENDING' ? (
                        <div>
                          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-success/30" />
                          <p>Gözləmədə silinmə yoxdur 🎉</p>
                        </div>
                      ) : (
                        <div>
                          <Clock className="w-12 h-12 mx-auto mb-3 text-base-content/20" />
                          <p>Hələ silinmə qeydi yoxdur</p>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
