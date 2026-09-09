'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { BarChart3, ArrowLeft, Filter, Package, Sprout, MapPin, Search } from 'lucide-react';

export default function WarehouseAnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [farms, setFarms] = useState<any[]>([]);
  const [filterFarm, setFilterFarm] = useState('');
  const [filterCrop, setFilterCrop] = useState('');
  const [filterItem, setFilterItem] = useState('');
  const [view, setView] = useState<'crop' | 'field' | 'item'>('crop');

  const safeJson = async (r: Response, fb: any = null) => { try { return r.ok ? await r.json() : fb; } catch { return fb; } };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterFarm) params.set('farmId', filterFarm);
      if (filterCrop) params.set('cropType', filterCrop);
      if (filterItem) params.set('warehouseItemId', filterItem);

      const [aRes, fRes] = await Promise.all([
        fetch(`/api/warehouse/analytics?${params}`),
        fetch('/api/farms'),
      ]);
      setData(await safeJson(aRes));
      setFarms(await safeJson(fRes, []));
    } finally {
      setLoading(false);
    }
  }, [filterFarm, filterCrop, filterItem]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Unique crops & items from data
  const crops = useMemo(() => data?.byCrop?.map((c: any) => c.cropType) || [], [data]);
  const items = useMemo(() => data?.byItem || [], [data]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
    </div>
  );

  const summary = data?.summary || { totalMaterials: 0, uniqueItems: 0, totalQuantity: 0, pendingWriteOffs: 0 };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div>
        <a href="/dashboard/warehouse" className="btn btn-ghost btn-sm gap-1 mb-2"><ArrowLeft className="w-4 h-4" /> Anbara Qayıt</a>
        <h1 className="text-2xl font-bold text-base-content flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-accent" /> Anbar Analitikası
        </h1>
        <p className="text-sm text-base-content/60 mt-1">Bitki, sahə və preparat üzrə sərfiyyat analizi</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-4 text-center">
            <p className="text-xs text-base-content/60 mb-1">Ümumi Tətbiq</p>
            <p className="text-2xl font-bold text-primary">{summary.totalMaterials}</p>
            <p className="text-xs text-base-content/50">material qeydi</p>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-4 text-center">
            <p className="text-xs text-base-content/60 mb-1">Unikal Preparat</p>
            <p className="text-2xl font-bold text-info">{summary.uniqueItems}</p>
            <p className="text-xs text-base-content/50">fərqli məhsul</p>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-4 text-center">
            <p className="text-xs text-base-content/60 mb-1">Ümumi Miqdar</p>
            <p className="text-2xl font-bold text-success">{summary.totalQuantity.toLocaleString()}</p>
            <p className="text-xs text-base-content/50">vahid</p>
          </div>
        </div>
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-4 text-center">
            <p className="text-xs text-base-content/60 mb-1">Gözləmədə Silinmə</p>
            <p className="text-2xl font-bold text-warning">{summary.pendingWriteOffs}</p>
            <p className="text-xs text-base-content/50">qeyd</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="card bg-base-200/50 border border-base-300">
        <div className="card-body p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="form-control">
              <label className="label label-text text-xs pb-1">Təsərrüfat</label>
              <select className="select select-bordered select-sm w-44" value={filterFarm} onChange={e => setFilterFarm(e.target.value)}>
                <option value="">Hamısı</option>
                {farms.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label label-text text-xs pb-1">Bitki</label>
              <select className="select select-bordered select-sm w-44" value={filterCrop} onChange={e => setFilterCrop(e.target.value)}>
                <option value="">Hamısı</option>
                {crops.map((c: string) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-control">
              <label className="label label-text text-xs pb-1">Preparat</label>
              <select className="select select-bordered select-sm w-52" value={filterItem} onChange={e => setFilterItem(e.target.value)}>
                <option value="">Hamısı</option>
                {items.map((i: any) => <option key={i.name} value={i.name}>{i.name}</option>)}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* View Tabs */}
      <div className="tabs tabs-boxed w-fit">
        <button className={`tab gap-1 ${view === 'crop' ? 'tab-active' : ''}`} onClick={() => setView('crop')}>
          <Sprout className="w-4 h-4" /> Bitkiyə görə
        </button>
        <button className={`tab gap-1 ${view === 'field' ? 'tab-active' : ''}`} onClick={() => setView('field')}>
          <MapPin className="w-4 h-4" /> Pivota görə
        </button>
        <button className={`tab gap-1 ${view === 'item' ? 'tab-active' : ''}`} onClick={() => setView('item')}>
          <Package className="w-4 h-4" /> Preparata görə
        </button>
      </div>

      {/* By Crop */}
      {view === 'crop' && (
        <div className="space-y-4">
          {(data?.byCrop || []).map((crop: any) => (
            <div key={crop.cropType} className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                    <Sprout className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">{crop.cropType}</h3>
                    <p className="text-xs text-base-content/60">Cəmi: {crop.totalQty.toLocaleString()} vahid · {crop.items.length} preparat</p>
                  </div>
                </div>
                <table className="table table-sm table-zebra">
                  <thead><tr className="text-xs"><th>Preparat</th><th>Vahid</th><th className="text-right">Miqdar</th><th className="text-right">Pay</th></tr></thead>
                  <tbody>
                    {crop.items.sort((a: any, b: any) => b.qty - a.qty).map((item: any) => (
                      <tr key={item.name}>
                        <td className="font-medium">{item.name}</td>
                        <td className="text-xs">{item.unit}</td>
                        <td className="text-right font-bold">{item.qty.toLocaleString()}</td>
                        <td className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <progress className="progress progress-success w-16" value={item.qty} max={crop.totalQty} />
                            <span className="text-xs">{((item.qty / crop.totalQty) * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {(!data?.byCrop || data.byCrop.length === 0) && (
            <div className="text-center py-12 text-base-content/40">
              <Sprout className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Bitki üzrə data yoxdur</p>
            </div>
          )}
        </div>
      )}

      {/* By Field */}
      {view === 'field' && (
        <div className="card bg-base-100 border border-base-300 shadow-sm">
          <div className="card-body p-4">
            <table className="table table-sm table-zebra">
              <thead>
                <tr className="text-xs">
                  <th>Sahə</th>
                  <th>Təsərrüfat</th>
                  <th className="text-right">Cəmi Miqdar</th>
                  <th>Preparatlar</th>
                </tr>
              </thead>
              <tbody>
                {(data?.byField || []).sort((a: any, b: any) => b.totalQty - a.totalQty).map((f: any, i: number) => (
                  <tr key={i}>
                    <td className="font-bold">Sahə {f.fieldNumber}</td>
                    <td className="text-xs">{f.farmName}</td>
                    <td className="text-right font-bold text-primary">{f.totalQty.toLocaleString()}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {f.items.map((item: any) => (
                          <span key={item.name} className="badge badge-sm badge-outline">{item.name}: {item.qty.toLocaleString()} {item.unit}</span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {(!data?.byField || data.byField.length === 0) && (
              <div className="text-center py-12 text-base-content/40">
                <MapPin className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>Sahə üzrə data yoxdur</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* By Item */}
      {view === 'item' && (
        <div className="space-y-4">
          {(data?.byItem || []).sort((a: any, b: any) => b.totalQty - a.totalQty).map((item: any) => (
            <div key={item.name} className="card bg-base-100 border border-base-300 shadow-sm">
              <div className="card-body p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                    <Package className="w-5 h-5 text-info" />
                  </div>
                  <div>
                    <h3 className="font-semibold">{item.name}</h3>
                    <p className="text-xs text-base-content/60">
                      {item.code1C && <span className="font-mono mr-2">{item.code1C}</span>}
                      Cəmi: {item.totalQty.toLocaleString()} {item.unit} · {item.fields.length} sahə
                    </p>
                  </div>
                </div>
                <table className="table table-sm table-zebra">
                  <thead><tr className="text-xs"><th>Sahə</th><th className="text-right">Miqdar</th><th className="text-right">Pay</th></tr></thead>
                  <tbody>
                    {item.fields.sort((a: any, b: any) => b.qty - a.qty).map((f: any) => (
                      <tr key={f.fieldNumber}>
                        <td className="font-medium">Sahə {f.fieldNumber}</td>
                        <td className="text-right font-bold">{f.qty.toLocaleString()} {item.unit}</td>
                        <td className="text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <progress className="progress progress-info w-16" value={f.qty} max={item.totalQty} />
                            <span className="text-xs">{((f.qty / item.totalQty) * 100).toFixed(0)}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
          {(!data?.byItem || data.byItem.length === 0) && (
            <div className="text-center py-12 text-base-content/40">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Preparat üzrə data yoxdur</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
