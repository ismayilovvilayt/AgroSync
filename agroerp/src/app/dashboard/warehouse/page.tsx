'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Warehouse as WarehouseIcon, Plus, X, AlertTriangle, ArrowDownCircle, ArrowUpCircle,
  Package, Pencil, Trash2, ArrowRightLeft, Search,
  Building2, BarChart3, List, RefreshCw, CheckCircle, ChevronDown, ChevronUp,
  MoveRight, TrendingUp, TrendingDown, Sprout, Droplets, Bug, Fuel, Wrench, Box,
  Layers, Calendar,
} from 'lucide-react';
import { format } from 'date-fns';
import { az } from 'date-fns/locale';
import { useSession } from 'next-auth/react';

/* ── Category config ── */
const categoryConfig: Record<string, { label: string; color: string; icon: any }> = {
  SEED:       { label: 'Toxum',     color: '#10B981', icon: Sprout },
  FERTILIZER: { label: 'Gübrə',     color: '#3B82F6', icon: Droplets },
  PESTICIDE:  { label: 'Pestisid',  color: '#EF4444', icon: Bug },
  HERBICIDE:  { label: 'Herbisid',  color: '#F59E0B', icon: Layers },
  FUEL:       { label: 'Yanacaq',   color: '#8B5CF6', icon: Fuel },
  EQUIPMENT:  { label: 'Avadanlıq', color: '#06B6D4', icon: Wrench },
  OTHER:      { label: 'Digər',     color: '#64748B', icon: Box },
};

type Tab = 'stock' | 'movements' | 'analytics';

export default function WarehousePage() {
  const { data: session } = useSession();
  const userRole   = (session?.user as any)?.role as string;
  const canWrite   = ['ADMIN', 'HEAD_AGRONOMIST', 'AGRONOMIST'].includes(userRole);
  const canAdmin   = ['ADMIN'].includes(userRole);

  const [tab, setTab] = useState<Tab>('stock');
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [farms, setFarms]           = useState<any[]>([]);
  const [fields, setFields]         = useState<any[]>([]);
  const [movements, setMovements]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving,  setSaving]        = useState(false);

  // Filters
  const [filterFarmId,   setFilterFarmId]   = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [searchTerm,     setSearchTerm]     = useState('');
  const [movFilterType,  setMovFilterType]  = useState('');

  // Collapse state for warehouse groups
  const [collapsedWarehouses, setCollapsedWarehouses] = useState<Record<string, boolean>>({});

  // Modals
  const [showItemModal,     setShowItemModal]     = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [editingItem,       setEditingItem]       = useState<any>(null);

  // Forms
  const [itemForm, setItemForm] = useState({
    warehouseId: '', name: '', code1C: '', orderNumber: '',
    category: 'SEED', currentStock: '', unit: 'kq', minStock: '',
  });
  const [movForm, setMovForm] = useState({
    warehouseItemId: '', movementType: 'IN', quantity: '', reason: '',
    supplier: '', unitPrice: '', movementDate: new Date().toISOString().split('T')[0],
    notes: '', fieldId: '',
  });
  const [transferForm, setTransferForm] = useState({
    fromWarehouseId: '', toWarehouseId: '', warehouseItemId: '',
    quantity: '', reason: '', movementDate: new Date().toISOString().split('T')[0], notes: '',
  });

  const safeJson = async (r: Response, fb: any = []) => {
    try { return r.ok ? await r.json() : fb; } catch { return fb; }
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterFarmId) params.set('farmId', filterFarmId);

      const [wRes, fRes, farmsRes, movRes] = await Promise.all([
        fetch(`/api/warehouse?${params}`),
        fetch('/api/fields'),
        fetch('/api/farms'),
        fetch('/api/warehouse/movements'),
      ]);
      setWarehouses(await safeJson(wRes, []));
      setFields(await safeJson(fRes, []));
      setFarms(await safeJson(farmsRes, []));
      setMovements(await safeJson(movRes, []));
    } finally {
      setLoading(false);
    }
  }, [filterFarmId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // All items flat
  const allItems = useMemo(() =>
    warehouses.flatMap((wh: any) =>
      wh.items.map((item: any) => ({
        ...item,
        warehouseId: wh.id,
        warehouseName: wh.name,
        farmName: wh.farm?.name || '—',
      }))
    ),
  [warehouses]);

  // Filtered items
  const filteredItems = useMemo(() =>
    allItems.filter(item => {
      if (filterCategory && item.category !== filterCategory) return false;
      if (searchTerm) {
        const t = searchTerm.toLowerCase();
        if (!item.name.toLowerCase().includes(t) && !(item.code1C || '').toLowerCase().includes(t)) return false;
      }
      return true;
    }),
  [allItems, filterCategory, searchTerm]);

  // Filtered movements
  const filteredMovements = useMemo(() =>
    movements.filter((m: any) => {
      if (movFilterType && m.movementType !== movFilterType) return false;
      return true;
    }),
  [movements, movFilterType]);

  // Stock status
  const stockStatus = (item: any) => {
    const stock = item.currentStock;
    const min   = item.minStock;
    if (stock <= 0) return { label: 'Tükənib', color: '#EF4444', bg: 'rgba(239,68,68,0.08)' };
    if (stock <= min) return { label: 'Azalıb', color: '#F59E0B', bg: 'rgba(245,158,11,0.08)' };
    return { label: 'Normal', color: '#10B981', bg: 'rgba(16,185,129,0.08)' };
  };

  // Totals
  const lowStockCount  = allItems.filter(i => i.currentStock <= i.minStock && i.currentStock > 0).length;
  const zeroStockCount = allItems.filter(i => i.currentStock <= 0).length;
  const normalCount    = allItems.filter(i => i.currentStock > i.minStock).length;

  // Farm crops for selected warehouse (for SEED category auto-suggest)
  const selectedWarehouseCrops = useMemo(() => {
    if (!itemForm.warehouseId) return [];
    const wh = warehouses.find((w: any) => w.id === itemForm.warehouseId);
    return wh?.farmCrops || [];
  }, [itemForm.warehouseId, warehouses]);

  // Toggle warehouse collapse
  const toggleCollapse = (whId: string) => {
    setCollapsedWarehouses(prev => ({ ...prev, [whId]: !prev[whId] }));
  };

  // Item CRUD
  const openCreateItem = (warehouseId?: string) => {
    setEditingItem(null);
    setItemForm({
      warehouseId: warehouseId || (warehouses[0]?.id || ''),
      name: '', code1C: '', orderNumber: '',
      category: 'SEED', currentStock: '', unit: 'kq', minStock: '',
    });
    setShowItemModal(true);
  };

  const openEditItem = (item: any) => {
    setEditingItem(item);
    setItemForm({
      warehouseId: item.warehouseId,
      name:        item.name,
      code1C:      item.code1C || '',
      orderNumber: item.orderNumber || '',
      category:    item.category,
      currentStock: String(item.currentStock),
      unit:         item.unit,
      minStock:     String(item.minStock),
    });
    setShowItemModal(true);
  };

  const handleSaveItem = async () => {
    if (!itemForm.name || !itemForm.warehouseId) return;
    setSaving(true);
    try {
      const url    = editingItem ? `/api/warehouse/items/${editingItem.id}` : '/api/warehouse/items';
      const method = editingItem ? 'PUT' : 'POST';
      await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...itemForm,
          currentStock: parseFloat(itemForm.currentStock) || 0,
          minStock:     parseFloat(itemForm.minStock) || 0,
        }),
      });
      setShowItemModal(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!confirm('Bu məhsulu silmək istəyirsiniz?')) return;
    await fetch(`/api/warehouse/items/${id}`, { method: 'DELETE' });
    fetchAll();
  };

  // Movement
  const openMovementModal = (item?: any) => {
    setMovForm({
      warehouseItemId: item?.id || '',
      movementType: 'IN', quantity: '', reason: '',
      supplier: '', unitPrice: '',
      movementDate: new Date().toISOString().split('T')[0],
      notes: '', fieldId: '',
    });
    setShowMovementModal(true);
  };

  const handleSaveMovement = async () => {
    if (!movForm.warehouseItemId || !movForm.quantity) return;
    setSaving(true);
    try {
      await fetch('/api/warehouse/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...movForm,
          quantity:  parseFloat(movForm.quantity),
          unitPrice: movForm.unitPrice ? parseFloat(movForm.unitPrice) : null,
        }),
      });
      setShowMovementModal(false);
      fetchAll();
    } finally {
      setSaving(false);
    }
  };

  // Transfer
  const handleSaveTransfer = async () => {
    const qty = parseFloat(transferForm.quantity);
    if (!transferForm.fromWarehouseId || !transferForm.toWarehouseId || !transferForm.warehouseItemId || !qty || qty <= 0) return;
    if (transferForm.fromWarehouseId === transferForm.toWarehouseId) {
      alert('Eyni anbardan eyni anbara köçürmə olmaz'); return;
    }
    setSaving(true);
    try {
      const srcItem = allItems.find((i: any) => i.id === transferForm.warehouseItemId);
      const tgtWarehouse = warehouses.find((w: any) => w.id === transferForm.toWarehouseId);
      if (!srcItem || !tgtWarehouse) return;
      let toItemId = tgtWarehouse.items.find((i: any) => i.name === srcItem.name)?.id || null;
      // OUT from source
      await fetch('/api/warehouse/movements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseItemId: transferForm.warehouseItemId,
          movementType: 'OUT', quantity: qty,
          reason: `Transfer → ${tgtWarehouse.name}`,
          movementDate: transferForm.movementDate, notes: transferForm.notes,
        }),
      });
      // IN to target
      if (!toItemId) {
        const newItemRes = await fetch('/api/warehouse/items', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            warehouseId: transferForm.toWarehouseId,
            name: srcItem.name, code1C: srcItem.code1C || '',
            category: srcItem.category, currentStock: 0, unit: srcItem.unit, minStock: 0,
          }),
        });
        const newItem = await newItemRes.json();
        toItemId = newItem.id;
      }
      await fetch('/api/warehouse/movements', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          warehouseItemId: toItemId,
          movementType: 'IN', quantity: qty,
          reason: `Transfer ← ${warehouses.find((w:any) => w.id === transferForm.fromWarehouseId)?.name}`,
          movementDate: transferForm.movementDate, notes: transferForm.notes,
        }),
      });
      setShowTransferModal(false);
      setTransferForm({ fromWarehouseId: '', toWarehouseId: '', warehouseItemId: '', quantity: '', reason: '', movementDate: new Date().toISOString().split('T')[0], notes: '' });
      fetchAll();
    } finally { setSaving(false); }
  };

  // Analytics data
  const analyticsByCategory = useMemo(() => {
    const grouped: Record<string, { key: string; name: string; count: number; totalStock: number; color: string }> = {};
    for (const item of allItems) {
      const cat = item.category;
      const cfg = categoryConfig[cat] || categoryConfig.OTHER;
      if (!grouped[cat]) {
        grouped[cat] = { key: cat, name: cfg.label, count: 0, totalStock: 0, color: cfg.color };
      }
      grouped[cat].count++;
      grouped[cat].totalStock += item.currentStock;
    }
    return Object.values(grouped).sort((a, b) => b.totalStock - a.totalStock);
  }, [allItems]);

  /* ── Styles ── */
  const glass = {
    background: 'rgba(255,255,255,0.03)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255,255,255,0.08)',
  } as React.CSSProperties;

  const cardHover = 'transition-all duration-300 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5';

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 animate-pulse flex items-center justify-center">
            <WarehouseIcon className="w-8 h-8 text-primary animate-bounce" />
          </div>
        </div>
        <span className="text-sm text-base-content/50 animate-pulse">Anbar yüklənir...</span>
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto space-y-5">

      {/* ━━━ HEADER ━━━ */}
      <div className="relative overflow-hidden rounded-2xl p-6" style={{
        background: 'linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(139,92,246,0.08) 50%, rgba(16,185,129,0.06) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.08),transparent_70%)]" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
                <WarehouseIcon className="w-5 h-5 text-white" />
              </div>
              Anbar İdarəetməsi
            </h1>
            <p className="text-sm text-base-content/50 mt-1.5 ml-[52px]">
              Təsərrüfat materiallarının qəbulu, çıxışı və izlənməsi
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button className="btn btn-ghost btn-sm btn-circle" onClick={fetchAll}
              title="Yenilə">
              <RefreshCw className="w-4 h-4" />
            </button>
            {canWrite && (
              <button className="btn btn-sm gap-1.5 border-0 text-white shadow-lg shadow-primary/25"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
                onClick={() => openCreateItem()}>
                <Plus className="w-4 h-4" /> Yeni Məhsul
              </button>
            )}
            {canWrite && (
              <button className="btn btn-sm gap-1.5 border-0 text-white shadow-lg shadow-emerald-500/25"
                style={{ background: 'linear-gradient(135deg, #10B981, #06B6D4)' }}
                onClick={() => openMovementModal()}>
                <ArrowRightLeft className="w-4 h-4" /> Hərəkət
              </button>
            )}
            {canWrite && warehouses.length >= 2 && (
              <button className="btn btn-sm gap-1.5 border-0 text-white shadow-lg shadow-amber-500/25"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
                onClick={() => setShowTransferModal(true)}>
                <MoveRight className="w-4 h-4" /> Transfer
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ━━━ STAT CARDS ━━━ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Cəmi Məhsul', value: allItems.length, color: '#3B82F6', gradient: 'from-blue-500/10 to-blue-600/5', icon: Package },
          { label: 'Normal Stok', value: normalCount, color: '#10B981', gradient: 'from-emerald-500/10 to-emerald-600/5', icon: TrendingUp },
          { label: 'Azalan Stok', value: lowStockCount, color: '#F59E0B', gradient: 'from-amber-500/10 to-amber-600/5', icon: TrendingDown },
          { label: 'Tükənən', value: zeroStockCount, color: '#EF4444', gradient: 'from-red-500/10 to-red-600/5', icon: AlertTriangle },
        ].map((stat, i) => (
          <div key={i} className={`rounded-xl p-4 ${cardHover}`} style={glass}>
            <div className="flex items-center justify-between mb-2">
              <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${stat.gradient} flex items-center justify-center`}>
                <stat.icon className="w-4 h-4" style={{ color: stat.color }} />
              </div>
              <span className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</span>
            </div>
            <div className="text-xs text-base-content/50 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ━━━ FARM FILTER — always visible ━━━ */}
      {farms.length > 0 && (
        <div className="rounded-xl p-3" style={glass}>
          <div className="flex gap-2 flex-wrap items-center">
            <Building2 className="w-4 h-4 text-base-content/40 mr-1" />
            <button
              className={`btn btn-sm rounded-lg ${!filterFarmId
                ? 'border-0 text-white shadow-md'
                : 'btn-ghost'}`}
              style={!filterFarmId ? { background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' } : {}}
              onClick={() => setFilterFarmId('')}
            >
              Hamısı
            </button>
            {farms.map((f: any) => (
              <button
                key={f.id}
                className={`btn btn-sm rounded-lg ${filterFarmId === f.id
                  ? 'border-0 text-white shadow-md'
                  : 'btn-ghost'}`}
                style={filterFarmId === f.id ? { background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' } : {}}
                onClick={() => setFilterFarmId(f.id)}
              >
                <Building2 className="w-3.5 h-3.5" />
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ━━━ TABS ━━━ */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={glass}>
        {([
          { key: 'stock', label: 'Stok', icon: Package },
          { key: 'movements', label: 'Hərəkətlər', icon: List },
          { key: 'analytics', label: 'Analitika', icon: BarChart3 },
        ] as { key: Tab; label: string; icon: any }[]).map(t => (
          <button key={t.key}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === t.key
                ? 'bg-gradient-to-r from-primary/15 to-primary/5 text-primary shadow-sm'
                : 'text-base-content/50 hover:text-base-content/80 hover:bg-base-content/5'
            }`}
            onClick={() => setTab(t.key)}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ━━━ STOCK TAB ━━━ */}
      {tab === 'stock' && (
        <div className="space-y-4">
          {/* Search + Category Filter */}
          <div className="rounded-xl p-3" style={glass}>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-48">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/30" />
                <input
                  type="text"
                  className="input input-bordered input-sm w-full pl-9 bg-transparent border-base-content/10 focus:border-primary/30 rounded-lg"
                  placeholder="Ad və ya 1C kodu ilə axtar..."
                  value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="flex gap-1 flex-wrap">
                <button
                  className={`btn btn-xs rounded-md ${!filterCategory ? 'btn-primary btn-outline' : 'btn-ghost'}`}
                  onClick={() => setFilterCategory('')}
                >
                  Hamısı
                </button>
                {Object.entries(categoryConfig).map(([k, cfg]) => {
                  const isActive = filterCategory === k;
                  return (
                    <button key={k}
                      className="btn btn-xs rounded-md"
                      style={{
                        background: isActive ? `${cfg.color}20` : 'transparent',
                        color: isActive ? cfg.color : undefined,
                        border: isActive ? `1px solid ${cfg.color}40` : '1px solid transparent',
                      }}
                      onClick={() => setFilterCategory(isActive ? '' : k)}
                    >
                      {cfg.label}
                    </button>
                  );
                })}
              </div>
              {(searchTerm || filterCategory) && (
                <button className="btn btn-ghost btn-xs" onClick={() => { setSearchTerm(''); setFilterCategory(''); }}>
                  <X className="w-3 h-3" /> Sıfırla
                </button>
              )}
            </div>
          </div>

          {/* Warehouse groups */}
          {warehouses.map((wh: any) => {
            const whItems = filteredItems.filter((i: any) => i.warehouseId === wh.id);
            if (whItems.length === 0 && (filterCategory || searchTerm)) return null;
            const isCollapsed = collapsedWarehouses[wh.id];

            return (
              <div key={wh.id} className={`rounded-xl overflow-hidden ${cardHover}`} style={glass}>
                {/* Warehouse header */}
                <div className="flex items-center justify-between px-5 py-3.5 cursor-pointer"
                  onClick={() => toggleCollapse(wh.id)}
                  style={{ borderBottom: isCollapsed ? 'none' : '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center">
                      <WarehouseIcon className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-semibold text-sm flex items-center gap-2">
                        {wh.name}
                        <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-base-content/5 text-base-content/40">
                          {wh.items.length} məhsul
                        </span>
                      </div>
                      <div className="text-xs text-base-content/40 flex items-center gap-1.5">
                        <Building2 className="w-3 h-3" />
                        {wh.farm?.name || 'Ümumi'}
                        {wh.farmCrops?.length > 0 && (
                          <span className="ml-1">
                            · <Sprout className="w-3 h-3 inline" /> {wh.farmCrops.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {canWrite && (
                      <button className="btn btn-ghost btn-xs gap-1 rounded-lg"
                        onClick={(e) => { e.stopPropagation(); openCreateItem(wh.id); }}>
                        <Plus className="w-3 h-3" /> Əlavə et
                      </button>
                    )}
                    {isCollapsed
                      ? <ChevronDown className="w-4 h-4 text-base-content/30" />
                      : <ChevronUp className="w-4 h-4 text-base-content/30" />}
                  </div>
                </div>

                {/* Items table */}
                {!isCollapsed && (
                  <div className="overflow-x-auto">
                    <table className="table table-sm">
                      <thead>
                        <tr className="text-xs text-base-content/40 border-b border-base-content/5">
                          <th className="font-medium">Məhsul</th>
                          <th className="font-medium">Kateqoriya</th>
                          <th className="font-medium">1C Kodu</th>
                          <th className="font-medium">Vahid</th>
                          <th className="font-medium text-right">Qalıq</th>
                          <th className="font-medium text-right">Min.</th>
                          <th className="font-medium">Status</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {whItems.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="text-center py-8 text-base-content/30 text-sm">
                              <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                              Bu anbarda hələ məhsul yoxdur
                            </td>
                          </tr>
                        ) : whItems.map((item: any) => {
                          const st  = stockStatus(item);
                          const cfg = categoryConfig[item.category] || categoryConfig.OTHER;
                          const CatIcon = cfg.icon;
                          return (
                            <tr key={item.id} className="hover:bg-base-content/3 transition-colors">
                              <td>
                                <div className="flex items-center gap-2.5">
                                  <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                                    style={{ background: `${cfg.color}10` }}>
                                    <CatIcon className="w-4 h-4" style={{ color: cfg.color }} />
                                  </div>
                                  <div>
                                    <div className="font-semibold text-sm">{item.name}</div>
                                    {item.orderNumber && (
                                      <div className="text-[10px] text-base-content/30">Sif. #{item.orderNumber}</div>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-md"
                                  style={{ background: `${cfg.color}12`, color: cfg.color }}>
                                  {cfg.label}
                                </span>
                              </td>
                              <td className="text-xs text-base-content/40 font-mono">{item.code1C || '—'}</td>
                              <td className="text-xs text-base-content/50">{item.unit}</td>
                              <td className="text-right font-bold text-sm tabular-nums">
                                {item.currentStock.toFixed(2)}
                              </td>
                              <td className="text-right text-xs text-base-content/35 tabular-nums">
                                {item.minStock.toFixed(2)}
                              </td>
                              <td>
                                <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex items-center gap-1"
                                  style={{ background: st.bg, color: st.color }}>
                                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: st.color }} />
                                  {st.label}
                                </span>
                              </td>
                              <td>
                                <div className="flex gap-0.5 justify-end">
                                  {canWrite && (
                                    <button className="btn btn-ghost btn-xs rounded-lg"
                                      onClick={() => openMovementModal(item)}
                                      title="Hərəkət əlavə et">
                                      <ArrowRightLeft className="w-3 h-3" />
                                    </button>
                                  )}
                                  {canWrite && (
                                    <button className="btn btn-ghost btn-xs rounded-lg"
                                      onClick={() => openEditItem(item)} title="Redaktə et">
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  )}
                                  {canAdmin && (
                                    <button className="btn btn-ghost btn-xs rounded-lg text-error/60 hover:text-error"
                                      onClick={() => handleDeleteItem(item.id)} title="Sil">
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {warehouses.length === 0 && (
            <div className="rounded-xl p-12 text-center" style={glass}>
              <WarehouseIcon className="w-12 h-12 mx-auto mb-3 text-base-content/15" />
              <p className="text-base-content/40 font-medium">Hələ anbar yaradılmayıb</p>
              <p className="text-xs text-base-content/25 mt-1">Əvvəlcə təsərrüfat üçün anbar yaradın</p>
            </div>
          )}
        </div>
      )}

      {/* ━━━ MOVEMENTS TAB ━━━ */}
      {tab === 'movements' && (
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap items-center">
            {[
              { key: '', label: 'Hamısı', activeClass: 'from-primary/15 to-primary/5 text-primary' },
              { key: 'IN', label: 'Giriş', icon: ArrowDownCircle, activeClass: 'from-emerald-500/15 to-emerald-500/5 text-emerald-500' },
              { key: 'OUT', label: 'Çıxış', icon: ArrowUpCircle, activeClass: 'from-red-500/15 to-red-500/5 text-red-500' },
            ].map(f => (
              <button key={f.key}
                className={`btn btn-sm rounded-lg gap-1 ${movFilterType === f.key
                  ? `bg-gradient-to-r ${f.activeClass} border-0 shadow-sm`
                  : 'btn-ghost'
                }`}
                onClick={() => setMovFilterType(f.key)}
              >
                {f.icon && <f.icon className="w-3.5 h-3.5" />}
                {f.label}
              </button>
            ))}
          </div>

          <div className="rounded-xl overflow-hidden" style={glass}>
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr className="text-xs text-base-content/40 border-b border-base-content/5">
                    <th className="font-medium">Tarix</th>
                    <th className="font-medium">Tip</th>
                    <th className="font-medium">Məhsul</th>
                    <th className="font-medium text-right">Miqdar</th>
                    <th className="font-medium">Səbəb</th>
                    <th className="font-medium">Sahə</th>
                    <th className="font-medium">Təchizatçı</th>
                    <th className="font-medium">İstifadəçi</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-base-content/30">
                        <ArrowRightLeft className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <div className="text-sm">Hərəkət qeydi yoxdur</div>
                      </td>
                    </tr>
                  ) : filteredMovements.slice(0, 200).map((m: any) => (
                    <tr key={m.id} className="hover:bg-base-content/3 transition-colors">
                      <td className="text-xs font-medium whitespace-nowrap flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-base-content/25" />
                        {format(new Date(m.movementDate), 'dd.MM.yyyy', { locale: az })}
                      </td>
                      <td>
                        {m.movementType === 'IN' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(16,185,129,0.1)', color: '#10B981' }}>
                            <ArrowDownCircle className="w-3 h-3" /> Giriş
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                            <ArrowUpCircle className="w-3 h-3" /> Çıxış
                          </span>
                        )}
                      </td>
                      <td className="font-medium text-sm">{m.warehouseItem?.name || '—'}</td>
                      <td className="text-right font-bold tabular-nums">{m.quantity.toFixed(2)}</td>
                      <td className="text-xs text-base-content/50">{m.reason || '—'}</td>
                      <td className="text-xs text-base-content/50">{m.field ? `#${m.field.fieldNumber}` : '—'}</td>
                      <td className="text-xs text-base-content/50">{m.supplier || '—'}</td>
                      <td className="text-xs text-base-content/50">{m.user?.fullName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ━━━ ANALYTICS TAB ━━━ */}
      {tab === 'analytics' && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Cəmi məhsul', value: allItems.length, color: '#3B82F6' },
              { label: 'Normal stok', value: normalCount, color: '#10B981' },
              { label: 'Az stok', value: lowStockCount, color: '#F59E0B' },
              { label: 'Sıfır stok', value: zeroStockCount, color: '#EF4444' },
            ].map((s, i) => (
              <div key={i} className={`rounded-xl p-4 ${cardHover}`} style={glass}>
                <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                <div className="text-xs text-base-content/40 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Category breakdown */}
          <div className={`rounded-xl p-5 ${cardHover}`} style={glass}>
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Kateqoriya üzrə bölgü
            </h3>
            <div className="space-y-3">
              {analyticsByCategory.map(cat => {
                const maxStock = Math.max(...analyticsByCategory.map(c => c.totalStock), 1);
                const pct = (cat.totalStock / maxStock) * 100;
                const CatIcon = categoryConfig[cat.key]?.icon || Box;
                return (
                  <div key={cat.name}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium flex items-center gap-2">
                        <CatIcon className="w-3.5 h-3.5" style={{ color: cat.color }} />
                        {cat.name}
                      </span>
                      <span className="text-base-content/40 text-xs tabular-nums">
                        {cat.count} növ · {cat.totalStock.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-base-content/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${cat.color}, ${cat.color}80)` }} />
                    </div>
                  </div>
                );
              })}
              {analyticsByCategory.length === 0 && (
                <p className="text-center text-base-content/30 py-4 text-sm">Məlumat yoxdur</p>
              )}
            </div>
          </div>

          {/* Low stock alerts */}
          {(lowStockCount > 0 || zeroStockCount > 0) && (
            <div className={`rounded-xl p-5 ${cardHover}`}
              style={{ ...glass, borderColor: 'rgba(245,158,11,0.15)' }}>
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" /> Xəbərdarlıqlar
              </h3>
              <div className="space-y-2">
                {allItems.filter(i => i.currentStock <= i.minStock).map(item => {
                  const st = stockStatus(item);
                  return (
                    <div key={item.id} className="flex items-center justify-between p-2.5 rounded-lg"
                      style={{ background: st.bg }}>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full" style={{ background: st.color }} />
                        <span className="text-sm font-medium">{item.name}</span>
                        <span className="text-[10px] text-base-content/30">{item.farmName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span style={{ color: st.color }} className="font-bold tabular-nums">
                          {item.currentStock.toFixed(2)} {item.unit}
                        </span>
                        <span className="text-base-content/25">/ min {item.minStock.toFixed(2)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ━━━ ITEM MODAL ━━━ */}
      {showItemModal && (
        <div className="modal modal-open" style={{ backdropFilter: 'blur(8px)' }}>
          <div className="modal-box max-w-lg rounded-2xl" style={glass}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Package className="w-4 h-4 text-primary" />
                </div>
                {editingItem ? 'Məhsulu Redaktə Et' : 'Yeni Məhsul Əlavə Et'}
              </h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowItemModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Warehouse */}
              <div>
                <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Anbar *</label>
                <select className="select select-bordered select-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                  value={itemForm.warehouseId}
                  onChange={e => setItemForm({ ...itemForm, warehouseId: e.target.value, name: '' })}>
                  <option value="">Anbar seçin</option>
                  {warehouses.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.farm?.name || 'Ümumi'})</option>
                  ))}
                </select>
              </div>

              {/* Category */}
              <div>
                <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Kateqoriya *</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {Object.entries(categoryConfig).map(([k, cfg]) => {
                    const isSelected = itemForm.category === k;
                    const CatIcon = cfg.icon;
                    return (
                      <button key={k} type="button"
                        onClick={() => setItemForm({ ...itemForm, category: k, name: '' })}
                        className="flex flex-col items-center gap-1 py-2 px-1 rounded-lg text-[11px] font-medium transition-all duration-200"
                        style={{
                          border: isSelected ? `2px solid ${cfg.color}` : '2px solid transparent',
                          background: isSelected ? `${cfg.color}15` : 'rgba(255,255,255,0.02)',
                          color: isSelected ? cfg.color : undefined,
                        }}
                      >
                        <CatIcon className="w-4 h-4" style={{ color: isSelected ? cfg.color : undefined }} />
                        {cfg.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Name — with crop dropdown for SEED category */}
              <div>
                <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">
                  Məhsul adı *
                  {itemForm.category === 'SEED' && selectedWarehouseCrops.length > 0 && (
                    <span className="text-primary/60 font-normal ml-1">(Əkin bitkilərindən seçin)</span>
                  )}
                </label>
                {itemForm.category === 'SEED' && selectedWarehouseCrops.length > 0 ? (
                  <div className="space-y-2">
                    <select
                      className="select select-bordered select-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                      value={selectedWarehouseCrops.includes(itemForm.name) ? itemForm.name : '__custom__'}
                      onChange={e => {
                        if (e.target.value === '__custom__') {
                          setItemForm({ ...itemForm, name: '' });
                        } else {
                          setItemForm({ ...itemForm, name: e.target.value });
                        }
                      }}
                    >
                      <option value="">Bitki seçin</option>
                      {selectedWarehouseCrops.map((crop: string) => (
                        <option key={crop} value={crop}>🌾 {crop}</option>
                      ))}
                      <option value="__custom__">✏️ Digər (manual daxil et)</option>
                    </select>
                    {(!selectedWarehouseCrops.includes(itemForm.name) && itemForm.name !== '') && (
                      <input
                        className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                        placeholder="Toxum adını daxil edin"
                        value={itemForm.name}
                        onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                      />
                    )}
                    {!selectedWarehouseCrops.includes(itemForm.name) && itemForm.name === '' && (
                      <input
                        className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                        placeholder="Toxum adını daxil edin"
                        value={itemForm.name}
                        onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                      />
                    )}
                  </div>
                ) : (
                  <input
                    className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                    placeholder="Preparat / Toxum / Gübrə adı"
                    value={itemForm.name}
                    onChange={e => setItemForm({ ...itemForm, name: e.target.value })}
                  />
                )}
              </div>

              {/* Codes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">1C Kodu</label>
                  <input className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                    placeholder="TOX-001"
                    value={itemForm.code1C}
                    onChange={e => setItemForm({ ...itemForm, code1C: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Sifariş №</label>
                  <input className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                    placeholder="SIF-2024-001"
                    value={itemForm.orderNumber}
                    onChange={e => setItemForm({ ...itemForm, orderNumber: e.target.value })} />
                </div>
              </div>

              {/* Stock + unit */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">İlkin stok</label>
                  <input type="number" className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                    placeholder="0.00" step="0.01"
                    value={itemForm.currentStock}
                    onChange={e => setItemForm({ ...itemForm, currentStock: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Vahid</label>
                  <select className="select select-bordered select-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                    value={itemForm.unit}
                    onChange={e => setItemForm({ ...itemForm, unit: e.target.value })}>
                    <option value="kq">kq</option>
                    <option value="litr">litr</option>
                    <option value="ton">ton</option>
                    <option value="ədəd">ədəd</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Min. stok</label>
                  <input type="number" className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                    placeholder="0.00" step="0.01"
                    value={itemForm.minStock}
                    onChange={e => setItemForm({ ...itemForm, minStock: e.target.value })} />
                </div>
              </div>
            </div>

            <div className="modal-action mt-5">
              <button className="btn btn-ghost btn-sm rounded-lg" onClick={() => setShowItemModal(false)}>Ləğv</button>
              <button className="btn btn-sm rounded-lg gap-1 border-0 text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)' }}
                onClick={handleSaveItem}
                disabled={saving || !itemForm.name || !itemForm.warehouseId}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : <CheckCircle className="w-4 h-4" />}
                {editingItem ? 'Yadda Saxla' : 'Əlavə Et'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/40" onClick={() => setShowItemModal(false)} />
        </div>
      )}

      {/* ━━━ MOVEMENT MODAL ━━━ */}
      {showMovementModal && (
        <div className="modal modal-open" style={{ backdropFilter: 'blur(8px)' }}>
          <div className="modal-box max-w-md rounded-2xl" style={glass}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
                  <ArrowRightLeft className="w-4 h-4 text-emerald-500" />
                </div>
                Anbar Hərəkəti
              </h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowMovementModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Type */}
              <div className="grid grid-cols-2 gap-2">
                {(['IN', 'OUT'] as const).map(t => {
                  const isActive = movForm.movementType === t;
                  const color = t === 'IN' ? '#10B981' : '#EF4444';
                  return (
                    <button key={t} type="button"
                      className="btn btn-sm rounded-lg gap-1.5 border-0 transition-all duration-200"
                      style={{
                        background: isActive ? `${color}15` : 'transparent',
                        color: isActive ? color : undefined,
                        border: isActive ? `2px solid ${color}40` : '2px solid transparent',
                      }}
                      onClick={() => setMovForm({ ...movForm, movementType: t })}>
                      {t === 'IN' ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />}
                      {t === 'IN' ? 'Giriş (Qəbul)' : 'Çıxış (İstifadə)'}
                    </button>
                  );
                })}
              </div>

              {/* Product */}
              <div>
                <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Məhsul *</label>
                <select className="select select-bordered select-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                  value={movForm.warehouseItemId}
                  onChange={e => setMovForm({ ...movForm, warehouseItemId: e.target.value })}>
                  <option value="">Məhsul seçin</option>
                  {warehouses.flatMap((wh: any) => [
                    <option key={`h-${wh.id}`} disabled value="">── {wh.name} ──</option>,
                    ...wh.items.map((i: any) => (
                      <option key={i.id} value={i.id}>
                        {i.name} ({i.currentStock.toFixed(2)} {i.unit})
                      </option>
                    )),
                  ])}
                </select>
              </div>

              {/* Quantity + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Miqdar *</label>
                  <input type="number" className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                    placeholder="0.00" step="0.01"
                    value={movForm.quantity}
                    onChange={e => setMovForm({ ...movForm, quantity: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Tarix *</label>
                  <input type="date" className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                    value={movForm.movementDate}
                    onChange={e => setMovForm({ ...movForm, movementDate: e.target.value })} />
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Səbəb</label>
                <input className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                  placeholder="Qəbul / Tətbiq / Digər"
                  value={movForm.reason}
                  onChange={e => setMovForm({ ...movForm, reason: e.target.value })} />
              </div>

              {movForm.movementType === 'IN' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Təchizatçı</label>
                    <input className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                      value={movForm.supplier}
                      onChange={e => setMovForm({ ...movForm, supplier: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Vahid Qiymət</label>
                    <input type="number" className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                      step="0.01"
                      value={movForm.unitPrice}
                      onChange={e => setMovForm({ ...movForm, unitPrice: e.target.value })} />
                  </div>
                </div>
              )}

              {movForm.movementType === 'OUT' && (
                <div>
                  <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Sahə (ixtiyari)</label>
                  <select className="select select-bordered select-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                    value={movForm.fieldId}
                    onChange={e => setMovForm({ ...movForm, fieldId: e.target.value })}>
                    <option value="">Sahə seçin</option>
                    {fields.map((f: any) => (
                      <option key={f.id} value={f.id}>
                        {f.farm?.name} — Pivot {f.fieldNumber}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="modal-action mt-5">
              <button className="btn btn-ghost btn-sm rounded-lg" onClick={() => setShowMovementModal(false)}>Ləğv</button>
              <button
                className="btn btn-sm rounded-lg gap-1 border-0 text-white shadow-lg"
                style={{
                  background: movForm.movementType === 'IN'
                    ? 'linear-gradient(135deg, #10B981, #06B6D4)'
                    : 'linear-gradient(135deg, #EF4444, #F59E0B)',
                }}
                onClick={handleSaveMovement}
                disabled={saving || !movForm.warehouseItemId || !movForm.quantity}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : (
                  movForm.movementType === 'IN' ? <ArrowDownCircle className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />
                )}
                {movForm.movementType === 'IN' ? 'Qəbul Et' : 'Çıxış Et'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/40" onClick={() => setShowMovementModal(false)} />
        </div>
      )}

      {/* ━━━ TRANSFER MODAL ━━━ */}
      {showTransferModal && (
        <div className="modal modal-open" style={{ backdropFilter: 'blur(8px)' }}>
          <div className="modal-box max-w-md rounded-2xl" style={glass}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                  <MoveRight className="w-4 h-4 text-amber-500" />
                </div>
                Daxili Transfer
              </h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowTransferModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-4">
              {/* From warehouse */}
              <div>
                <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Göndərən Anbar *</label>
                <select className="select select-bordered select-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                  value={transferForm.fromWarehouseId}
                  onChange={e => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value, warehouseItemId: '' })}>
                  <option value="">Anbar seçin</option>
                  {warehouses.map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.farm?.name || 'Ümumi'})</option>
                  ))}
                </select>
              </div>

              {/* To warehouse */}
              <div>
                <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Qəbul Edən Anbar *</label>
                <select className="select select-bordered select-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                  value={transferForm.toWarehouseId}
                  onChange={e => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}>
                  <option value="">Anbar seçin</option>
                  {warehouses.filter((w: any) => w.id !== transferForm.fromWarehouseId).map((w: any) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.farm?.name || 'Ümumi'})</option>
                  ))}
                </select>
              </div>

              {/* Arrow indicator */}
              {transferForm.fromWarehouseId && transferForm.toWarehouseId && (
                <div className="flex items-center justify-center gap-3 py-2 rounded-lg" style={{ background: 'rgba(245,158,11,0.06)' }}>
                  <span className="text-xs font-semibold text-base-content/50">
                    {warehouses.find((w: any) => w.id === transferForm.fromWarehouseId)?.name}
                  </span>
                  <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center">
                    <MoveRight className="w-4 h-4 text-amber-500" />
                  </div>
                  <span className="text-xs font-semibold text-amber-500">
                    {warehouses.find((w: any) => w.id === transferForm.toWarehouseId)?.name}
                  </span>
                </div>
              )}

              {/* Product from source warehouse */}
              <div>
                <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Məhsul *</label>
                <select className="select select-bordered select-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                  value={transferForm.warehouseItemId}
                  onChange={e => setTransferForm({ ...transferForm, warehouseItemId: e.target.value })}
                  disabled={!transferForm.fromWarehouseId}>
                  <option value="">Məhsul seçin</option>
                  {warehouses.find((w: any) => w.id === transferForm.fromWarehouseId)?.items
                    .filter((i: any) => i.currentStock > 0)
                    .map((i: any) => (
                      <option key={i.id} value={i.id}>
                        {i.name} — {i.currentStock.toFixed(2)} {i.unit} mövcud
                      </option>
                    ))}
                </select>
              </div>

              {/* Quantity + Date */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Miqdar *</label>
                  <input type="number" className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                    placeholder="0.00" step="0.01" min="0.01"
                    value={transferForm.quantity}
                    onChange={e => setTransferForm({ ...transferForm, quantity: e.target.value })} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Tarix *</label>
                  <input type="date" className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                    value={transferForm.movementDate}
                    onChange={e => setTransferForm({ ...transferForm, movementDate: e.target.value })} />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-base-content/50 mb-1.5 block">Qeyd</label>
                <input className="input input-bordered input-sm w-full rounded-lg bg-base-content/5 border-base-content/10"
                  placeholder="Transfer səbəbi (isteğe bağlı)"
                  value={transferForm.notes}
                  onChange={e => setTransferForm({ ...transferForm, notes: e.target.value })} />
              </div>

              <div className="rounded-lg p-3 text-xs flex items-center gap-2"
                style={{ background: 'rgba(245,158,11,0.06)', color: '#F59E0B' }}>
                <MoveRight className="w-4 h-4 shrink-0" />
                Transfer zamanı hər iki anbarın balansı avtomatik yenilənir.
              </div>
            </div>

            <div className="modal-action mt-5">
              <button className="btn btn-ghost btn-sm rounded-lg" onClick={() => setShowTransferModal(false)}>Ləğv</button>
              <button
                className="btn btn-sm rounded-lg gap-1 border-0 text-white shadow-lg"
                style={{ background: 'linear-gradient(135deg, #F59E0B, #EF4444)' }}
                onClick={handleSaveTransfer}
                disabled={saving || !transferForm.fromWarehouseId || !transferForm.toWarehouseId || !transferForm.warehouseItemId || !transferForm.quantity}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : <MoveRight className="w-4 h-4" />}
                Transfer Et
              </button>
            </div>
          </div>
          <div className="modal-backdrop bg-black/40" onClick={() => setShowTransferModal(false)} />
        </div>
      )}
    </div>
  );
}
