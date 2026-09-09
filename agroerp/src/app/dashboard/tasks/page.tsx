'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare, Plus, X, Trash2, Clock, Calendar,
  ChevronDown, ChevronUp, CheckCircle2, Circle,
  AlertCircle, AlarmClock, RefreshCw, Wheat, Archive,
} from 'lucide-react';
import { format, differenceInDays, isPast, isToday, isTomorrow } from 'date-fns';
import { az } from 'date-fns/locale';

// ── Types ──────────────────────────────────────────────────────────
interface TaskItem {
  id: string;
  fieldId: string;
  seasonFieldId: string | null;
  completed: boolean;
  completedAt: string | null;
  field: {
    id: string;
    fieldNumber: string;
    hectares: number;
    farmId: string;
    farm: { name: string };
  };
  seasonField: { id: string; cropType: string; plantedArea: number | null } | null;
}

interface Task {
  id: string;
  cropType: string;
  title: string;
  category: string | null;
  description: string | null;
  dueDate: string;
  status: string;
  farm: { id: string; name: string } | null;
  createdBy: { fullName: string };
  items: TaskItem[];
}

// ── Helpers ────────────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'fungisid',   label: 'Fungisid',   emoji: '🍄', color: 'badge-warning' },
  { value: 'insektisid', label: 'İnsektisid',  emoji: '🪲', color: 'badge-error' },
  { value: 'herbisid',   label: 'Herbisid',   emoji: '🌿', color: 'badge-success' },
  { value: 'suvarma',    label: 'Suvarma',    emoji: '💧', color: 'badge-info' },
  { value: 'gubre',      label: 'Gübrə',      emoji: '⚗️', color: 'badge-secondary' },
  { value: 'diger',      label: 'Digər',      emoji: '📋', color: 'badge-ghost' },
];

function getCat(val: string | null) {
  return CATEGORIES.find(c => c.value === val) || { label: val || 'Digər', emoji: '📋', color: 'badge-ghost' };
}

function getDeadlineInfo(dueDate: string) {
  const due = new Date(dueDate);
  if (isToday(due))    return { label: 'Bu gün!',          cls: 'text-orange-500 font-bold', icon: 'alarm' };
  if (isTomorrow(due)) return { label: 'Sabah',            cls: 'text-yellow-500',           icon: 'clock' };
  const diff = differenceInDays(due, new Date());
  if (diff < 0)        return { label: `${Math.abs(diff)} gün keçib`, cls: 'text-red-500 font-bold',   icon: 'overdue' };
  if (diff <= 3)       return { label: `${diff} gün qaldı`, cls: 'text-yellow-500',         icon: 'clock' };
  return               { label: `${diff} gün qaldı`,        cls: 'text-base-content/50',    icon: 'cal' };
}

function getHa(item: TaskItem): number {
  return item.seasonField?.plantedArea ?? item.field.hectares;
}

// ── Task Card ──────────────────────────────────────────────────────
function TaskCard({
  task,
  onToggleItem,
  onArchive,
  onDelete,
}: {
  task: Task;
  onToggleItem: (itemId: string, completed: boolean) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const dl = getDeadlineInfo(task.dueDate);
  const cat = getCat(task.category);

  const totalHa = task.items.reduce((s, i) => s + getHa(i), 0);
  const doneHa  = task.items.filter(i => i.completed).reduce((s, i) => s + getHa(i), 0);
  const leftHa  = totalHa - doneHa;
  const pct     = totalHa > 0 ? Math.round((doneHa / totalHa) * 100) : 0;
  const doneCount = task.items.filter(i => i.completed).length;
  const isArchived = task.status === 'ARCHIVED';

  const deadlineBorder = (() => {
    const due = new Date(task.dueDate);
    const diff = differenceInDays(due, new Date());
    if (diff < 0) return { borderLeft: '4px solid #EF4444', boxShadow: '0 0 12px rgba(239,68,68,0.15)' };
    if (diff === 0) return { borderLeft: '4px solid #F97316' };
    if (diff <= 3) return { borderLeft: '4px solid #F59E0B' };
    return { borderLeft: '4px solid transparent' };
  })();

  return (
    <div
      className={`card bg-base-100 border shadow-sm overflow-hidden transition-opacity ${isArchived ? 'opacity-60' : 'border-base-300'}`}
      style={deadlineBorder}
    >

      {/* ── Task header ── */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer select-none hover:bg-base-50 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {/* Icon */}
        <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-lg shrink-0">
          {cat.emoji}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm">{task.title}</span>
            <span className={`badge badge-xs ${cat.color}`}>{cat.label}</span>
            <span className="badge badge-xs badge-ghost">
              <Wheat className="w-2.5 h-2.5 mr-0.5" />{task.cropType}
            </span>
            {task.farm && (
              <span className="badge badge-xs badge-outline">{task.farm.name}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs flex-wrap">
            {/* Deadline */}
            <span className={`flex items-center gap-1 ${dl.cls}`}>
              {dl.icon === 'alarm'   && <AlarmClock className="w-3 h-3" />}
              {dl.icon === 'overdue' && <AlertCircle className="w-3 h-3" />}
              {dl.icon === 'clock'   && <Clock className="w-3 h-3" />}
              {dl.icon === 'cal'     && <Calendar className="w-3 h-3" />}
              {format(new Date(task.dueDate), 'dd MMM yyyy', { locale: az })} · {dl.label}
            </span>
            {/* Progress */}
            <span className="text-base-content/50">{doneCount}/{task.items.length} pivot tamamlandı</span>
          </div>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Progress circle */}
          <div className="radial-progress text-primary text-[10px] font-bold"
            style={{ '--value': pct, '--size': '2.5rem', '--thickness': '3px' } as any}
          >
            {pct}%
          </div>

          {/* Actions */}
          <div className="flex gap-1" onClick={e => e.stopPropagation()}>
            {!isArchived && (
              <button
                className="btn btn-ghost btn-xs btn-circle tooltip tooltip-left"
                data-tip="Arxivlə"
                onClick={() => onArchive(task.id)}
              >
                <Archive className="w-3.5 h-3.5 opacity-50" />
              </button>
            )}
            <button
              className="btn btn-ghost btn-xs btn-circle text-error tooltip tooltip-left"
              data-tip="Sil"
              onClick={() => onDelete(task.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {open ? <ChevronUp className="w-4 h-4 opacity-30" /> : <ChevronDown className="w-4 h-4 opacity-30" />}
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '6px 16px', borderTop: '1px solid var(--fallback-b3,oklch(var(--b3)/1))',
        background: pct === 100 ? 'rgba(16,185,129,0.06)' : 'transparent',
      }}>
        <div style={{
          flex: 1, height: 6, borderRadius: 3,
          background: 'var(--fallback-b3,oklch(var(--b3)/1))',
          overflow: 'hidden',
        }}>
          <div style={{
            width: `${pct}%`, height: '100%', borderRadius: 3,
            background: pct === 100 ? '#10B981' : pct > 50 ? '#3B82F6' : '#F59E0B',
            transition: 'width 0.5s ease',
          }} />
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? '#10B981' : 'inherit', whiteSpace: 'nowrap' }}>
          {doneHa.toFixed(0)}/{totalHa.toFixed(0)} ha · {leftHa.toFixed(0)} ha qaldı
        </span>
      </div>

      {/* ── Pivot rows ── */}
      {open && (
        <>
          {/* Table header */}
          <div className="grid grid-cols-[1fr_auto_auto_auto] gap-0 border-t border-base-200 bg-base-200/40 px-4 py-1.5 text-xs text-base-content/50 font-medium">
            <span>Pivot / Sahə</span>
            <span className="w-16 text-right">Sahə (ha)</span>
            <span className="w-28 text-center">Tarix</span>
            <span className="w-10 text-center">✓</span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-base-100">
            {task.items.map(item => (
              <div
                key={item.id}
                className={`grid grid-cols-[1fr_auto_auto_auto] gap-0 items-center px-4 py-2.5 transition-colors ${
                  item.completed ? 'bg-success/5' : 'hover:bg-base-50'
                }`}
              >
                {/* Pivot name */}
                <div className="min-w-0">
                  <span className={`text-sm font-medium ${item.completed ? 'line-through text-base-content/40' : ''}`}>
                    {item.field.fieldNumber}
                  </span>
                  <span className="text-xs text-base-content/40 ml-2">{item.field.farm.name}</span>
                </div>

                {/* Ha */}
                <div className="w-16 text-right text-sm font-mono text-base-content/70">
                  {getHa(item).toFixed(1)}
                </div>

                {/* Completed date */}
                <div className="w-28 text-center text-xs text-base-content/40">
                  {item.completedAt
                    ? format(new Date(item.completedAt), 'dd.MM.yyyy', { locale: az })
                    : '—'}
                </div>

                {/* Checkbox */}
                <div className="w-10 flex justify-center">
                  <button
                    onClick={() => onToggleItem(item.id, !item.completed)}
                    className={`transition-all active:scale-90 ${
                      item.completed
                        ? 'text-success hover:text-success/70'
                        : 'text-base-content/20 hover:text-primary'
                    }`}
                  >
                    {item.completed
                      ? <CheckCircle2 className="w-5 h-5" />
                      : <Circle className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Ha Summary ── */}
          <div className="border-t border-base-200 bg-base-200/30 px-4 py-2.5">
            {/* Progress bar */}
            <div className="w-full h-2 bg-base-300 rounded-full mb-2 overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="grid grid-cols-3 text-center text-xs">
              <div>
                <span className="text-success font-bold text-sm">{doneHa.toFixed(1)} ha</span>
                <br /><span className="text-base-content/50">Tamamlandı</span>
              </div>
              <div>
                <span className="text-base-content/70 font-bold text-sm">{leftHa.toFixed(1)} ha</span>
                <br /><span className="text-base-content/50">Qalıb</span>
              </div>
              <div>
                <span className="font-bold text-sm">{totalHa.toFixed(1)} ha</span>
                <br /><span className="text-base-content/50">Cəmi</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────
export default function TasksPage() {
  const [tasks, setTasks]             = useState<Task[]>([]);
  const [loading, setLoading]         = useState(true);
  const [farms, setFarms]             = useState<any[]>([]);
  const [farmFilter, setFarmFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState<'ACTIVE' | 'ARCHIVED' | 'all'>('ACTIVE');
  const [cropFilter, setCropFilter]   = useState('');
  const [showArchived, setShowArchived] = useState(false);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving]       = useState(false);
  const [cropTypes, setCropTypes] = useState<string[]>([]);
  const [form, setForm] = useState({
    cropType: '', title: '', category: 'fungisid',
    description: '', dueDate: '', farmId: '',
    firstApplicationDate: '', waitDays: '',
  });
  const [previewCount, setPreviewCount] = useState<number | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (farmFilter) params.set('farmId', farmFilter);
      if (cropFilter) params.set('cropType', cropFilter);
      params.set('status', statusFilter === 'all' ? 'all' : statusFilter);

      const [tRes, fRes, cRes] = await Promise.all([
        fetch(`/api/tasks?${params}`),
        fetch('/api/farms'),
        fetch('/api/seasons/active-crops'),
      ]);
      if (tRes.ok) setTasks(await tRes.json());
      if (fRes.ok) setFarms(await fRes.json());
      if (cRes.ok) {
        const cData = await cRes.json();
        setCropTypes(cData.uniqueCropTypes || []);
      }
    } finally {
      setLoading(false);
    }
  }, [farmFilter, statusFilter, cropFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  // Bitki növlərini modal açılanda gətir
  const openModal = async () => {
    const params = form.farmId ? `?farmId=${form.farmId}` : '';
    const res = await fetch(`/api/seasons/active-crops${params}`);
    if (res.ok) {
      const data = await res.json();
      setCropTypes(data.uniqueCropTypes || []);
    }
    setPreviewCount(null);
    setShowModal(true);
  };

  // Seçilmiş bitkinin neçə pivotda olduğunu göstər
  const loadPreview = async (cropType: string, farmId: string) => {
    if (!cropType) { setPreviewCount(null); return; }
    const params = new URLSearchParams();
    if (farmId) params.set('farmId', farmId);
    const res = await fetch(`/api/seasons/active-crops?${params}`);
    if (res.ok) {
      const data = await res.json();
      const count = (data.crops || []).filter((c: any) => c.cropType === cropType).length;
      setPreviewCount(count);
    }
  };

  const handleToggleItem = async (itemId: string, completed: boolean) => {
    // Optimistic
    setTasks(prev => prev.map(task => ({
      ...task,
      items: task.items.map(item =>
        item.id === itemId
          ? { ...item, completed, completedAt: completed ? new Date().toISOString() : null }
          : item
      ),
    })));

    await fetch(`/api/tasks/items/${itemId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed }),
    });
  };

  const handleArchive = async (id: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ARCHIVED' }),
    });
    fetchTasks();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu tapşırığı silmək istəyirsiniz? Bütün pivot qeydləri silinəcək.')) return;
    setTasks(prev => prev.filter(t => t.id !== id));
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
  };

  const handleCreate = async () => {
    if (!form.cropType || !form.title || !form.dueDate) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || 'Xəta baş verdi');
        return;
      }
      setShowModal(false);
      fetchTasks();
    } finally {
      setSaving(false);
    }
  };

  // Stats
  const activeTasks  = tasks.filter(t => t.status === 'ACTIVE').length;
  const overdueCount = tasks.filter(t => t.status === 'ACTIVE' && isPast(new Date(t.dueDate)) && !isToday(new Date(t.dueDate))).length;
  const totalItems   = tasks.reduce((s, t) => s + t.items.length, 0);
  const doneItems    = tasks.reduce((s, t) => s + t.items.filter(i => i.completed).length, 0);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckSquare className="w-7 h-7 text-primary" /> İş Planı
          </h1>
          <p className="text-sm text-base-content/50 mt-0.5">Bitkiyə görə aqrotexniki tapşırıqlar</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-outline btn-sm btn-circle" onClick={fetchTasks} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button className="btn btn-primary btn-sm gap-1" onClick={openModal}>
            <Plus className="w-4 h-4" /> Yeni tapşırıq
          </button>
        </div>
      </div>

      {/* ── Stats ── */}
      {tasks.length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-base-200">
            <CheckSquare className="w-4 h-4 text-primary" />
            <strong>{activeTasks}</strong> aktiv tapşırıq
          </span>
          {overdueCount > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-error/10 text-error">
              <AlertCircle className="w-4 h-4" />
              <strong>{overdueCount}</strong> gecikib
            </span>
          )}
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-success/10 text-success">
            <CheckCircle2 className="w-4 h-4" />
            <strong>{doneItems}/{totalItems}</strong> pivot tamamlandı
          </span>
        </div>
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-2">
          {farms.length > 1 && (
            <select
              className="select select-bordered select-sm min-w-32"
              value={farmFilter}
              onChange={e => setFarmFilter(e.target.value)}
            >
              <option value="">Bütün təsərrüfatlar</option>
              {farms.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          )}

          <select
            className="select select-bordered select-sm min-w-32"
            value={cropFilter}
            onChange={e => setCropFilter(e.target.value)}
          >
            <option value="">Bütün bitkilər</option>
            {cropTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
          </select>
        </div>

        <div className="flex gap-1">
          {(['ACTIVE', 'ARCHIVED', 'all'] as const).map(s => (
            <button
              key={s}
              className={`btn btn-xs ${statusFilter === s ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'ACTIVE' ? 'Aktiv' : s === 'ARCHIVED' ? '📦 Arxiv' : 'Hamısı'}
            </button>
          ))}
        </div>
      </div>

      {/* ── Task list ── */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="loading loading-spinner loading-lg" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-20 text-base-content/40">
          <CheckSquare className="w-16 h-16 mx-auto mb-4 opacity-15" />
          <p className="text-lg font-semibold">Tapşırıq yoxdur</p>
          <p className="text-sm mt-1">Yeni tapşırıq yaradın — sistem avtomatik pivotları tapacaq</p>
          <button className="btn btn-primary btn-sm mt-4 gap-1" onClick={openModal}>
            <Plus className="w-4 h-4" /> Yeni tapşırıq
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onToggleItem={handleToggleItem}
              onArchive={handleArchive}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* ── Modal ── */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-md">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-lg">Yeni tapşırıq</h3>
              <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowModal(false)}>
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">

              {/* Təsərrüfat (optional) */}
              <div>
                <label className="label py-0 mb-1"><span className="label-text text-xs">Təsərrüfat (boş = hamısı)</span></label>
                <select
                  className="select select-bordered select-sm w-full"
                  value={form.farmId}
                  onChange={e => {
                    setForm(f => ({ ...f, farmId: e.target.value, cropType: '' }));
                    setPreviewCount(null);
                  }}
                >
                  <option value="">Bütün təsərrüfatlar</option>
                  {farms.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>

              {/* Bitki növü */}
              <div>
                <label className="label py-0 mb-1"><span className="label-text text-xs">Bitki növü *</span></label>
                <select
                  className="select select-bordered select-sm w-full"
                  value={form.cropType}
                  onChange={e => {
                    setForm(f => ({ ...f, cropType: e.target.value }));
                    loadPreview(e.target.value, form.farmId);
                  }}
                >
                  <option value="">Bitki seçin</option>
                  {cropTypes.map(ct => <option key={ct} value={ct}>{ct}</option>)}
                </select>
                {previewCount !== null && (
                  <div className={`mt-1 text-xs flex items-center gap-1 ${previewCount > 0 ? 'text-success' : 'text-error'}`}>
                    <Wheat className="w-3 h-3" />
                    {previewCount > 0
                      ? `${previewCount} aktiv pivot tapıldı — hamısına avtomatik tətbiq olunacaq`
                      : 'Bu bitkiyə uyğun aktiv pivot tapılmadı'}
                  </div>
                )}
              </div>

              {/* Tapşırıq adı */}
              <div>
                <label className="label py-0 mb-1"><span className="label-text text-xs">Tapşırıq adı *</span></label>
                <input
                  className="input input-bordered input-sm w-full"
                  placeholder="məs. 2-ci Fungisid tətbiqi"
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                />
              </div>

              {/* Kateqoriya + Tarix */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label py-0 mb-1"><span className="label-text text-xs">Kateqoriya</span></label>
                  <select
                    className="select select-bordered select-sm w-full"
                    value={form.category}
                    onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  >
                    {CATEGORIES.map(c => (
                      <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label py-0 mb-1"><span className="label-text text-xs">Son İcra Tarixi *</span></label>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={form.dueDate}
                    onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Dinamik Deadline */}
              <div className="grid grid-cols-2 gap-2 bg-base-200/50 p-2 rounded-lg border border-base-200">
                <div>
                  <label className="label py-0 mb-1"><span className="label-text text-xs">1-ci Tətbiq Tarixi</span></label>
                  <input
                    type="date"
                    className="input input-bordered input-sm w-full"
                    value={form.firstApplicationDate}
                    onChange={e => setForm(f => ({ ...f, firstApplicationDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="label py-0 mb-1"><span className="label-text text-xs">Gözləmə günləri</span></label>
                  <input
                    type="number"
                    className="input input-bordered input-sm w-full"
                    placeholder="məs. 14"
                    value={form.waitDays}
                    onChange={e => setForm(f => ({ ...f, waitDays: e.target.value }))}
                  />
                </div>
                {(form.firstApplicationDate && form.waitDays) ? (
                  <div className="col-span-2 text-xs text-info flex items-center gap-1 mt-1">
                    <Clock className="w-3 h-3" />
                    Avtomatik 2-ci deadline: 
                    <span className="font-bold ml-1">
                      {format(new Date(new Date(form.firstApplicationDate).getTime() + parseInt(form.waitDays) * 24 * 60 * 60 * 1000), 'dd MMM yyyy', { locale: az })}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* Qeyd */}
              <div>
                <label className="label py-0 mb-1"><span className="label-text text-xs">Qeyd (optional)</span></label>
                <textarea
                  className="textarea textarea-bordered textarea-sm w-full"
                  rows={2}
                  placeholder="Əlavə məlumat..."
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}>Ləğv</button>
              <button
                className="btn btn-primary btn-sm gap-1"
                onClick={handleCreate}
                disabled={saving || !form.cropType || !form.title || !form.dueDate || previewCount === 0}
              >
                {saving
                  ? <span className="loading loading-spinner loading-xs" />
                  : <Plus className="w-4 h-4" />}
                Tapşırıq yarat
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
        </div>
      )}
    </div>
  );
}
