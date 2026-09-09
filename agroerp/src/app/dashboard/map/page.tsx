'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect, useRef } from 'react';
import {
  MapPin, Layers, RefreshCw, X, Leaf, Droplets, Cog,
  Clock, Info, ChevronRight, Edit3, Save, AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { az } from 'date-fns/locale';

// Leaflet SSR-i dəstəkləmir — dynamic import lazımdır
const MapView = dynamic(() => import('./MapView'), { ssr: false, loading: () => (
  <div className="flex items-center justify-center h-full bg-base-200 rounded-xl">
    <div className="loading loading-spinner loading-lg" />
  </div>
) });

// ── Types ────────────────────────────────────────────────────────────
export interface MapField {
  id: string;
  fieldNumber: string;
  hectares: number;
  status: string;
  latitude: number | null;
  longitude: number | null;
  polygon: string | null;
  farm: { id: string; name: string };
  seasonFields: Array<{ id: string; cropType: string; status: string; plantedArea: number | null }>;
  irrigations: Array<{ irrigationDate: string; irrigationType: string }>;
  processes: Array<{ processDate: string; processType: string; status: string }>;
}

const CROP_COLORS: Record<string, string> = {
  'Şəkər çuğunduru': '#10B981',
  'Buğda':           '#F59E0B',
  'Arpa':            '#D97706',
  'Qarğıdalı':       '#84CC16',
  'Günəbaxan':       '#FBBF24',
  'Pambıq':          '#E5E7EB',
  'Soya':            '#6EE7B7',
};

function getCropColor(cropType: string): string {
  return CROP_COLORS[cropType] || '#6366F1';
}

function getFieldStatus(field: MapField) {
  const crop = field.seasonFields[0];
  if (!crop) return { label: 'Boş', color: '#9CA3AF', bg: 'bg-gray-100' };
  const color = getCropColor(crop.cropType);
  const labels: Record<string, string> = {
    PLANNED: 'Planlaşdırılıb', SOWN: 'Əkilib', GROWING: 'Böyüyür', HARVESTING: 'Biçilir',
  };
  return { label: labels[crop.status] || crop.status, color, bg: 'bg-green-100', crop };
}

// ── Info Panel ───────────────────────────────────────────────────────
function FieldInfoPanel({
  field, onClose, onEditCoords,
}: {
  field: MapField;
  onClose: () => void;
  onEditCoords: (field: MapField) => void;
}) {
  const st = getFieldStatus(field);
  const lastIrrig = field.irrigations[0];
  const lastProc  = field.processes[0];

  return (
    <div className="absolute top-4 right-4 z-[1000] w-72 card bg-base-100 shadow-xl border border-base-300">
      <div className="card-body p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-bold text-base">Sahə #{field.fieldNumber}</h3>
            <p className="text-xs text-base-content/50">{field.farm.name}</p>
          </div>
          <button className="btn btn-ghost btn-xs btn-circle" onClick={onClose}>
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-base-200 rounded-lg p-2">
            <div className="text-base-content/50">Sahə</div>
            <div className="font-bold text-sm">{field.hectares} ha</div>
          </div>
          <div className="bg-base-200 rounded-lg p-2">
            <div className="text-base-content/50">Status</div>
            <div className="font-bold text-sm" style={{ color: st.color }}>{st.label}</div>
          </div>
        </div>

        {/* Crop */}
        {field.seasonFields[0] && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: st.color + '20' }}>
            <Leaf className="w-4 h-4" style={{ color: st.color }} />
            <div>
              <div className="font-medium text-sm">{field.seasonFields[0].cropType}</div>
              <div className="text-xs text-base-content/50">
                {field.seasonFields[0].plantedArea ?? field.hectares} ha əkilib
              </div>
            </div>
          </div>
        )}

        {/* Last activity */}
        <div className="space-y-1.5 text-xs">
          {lastIrrig && (
            <div className="flex items-center gap-2 text-base-content/60">
              <Droplets className="w-3.5 h-3.5 text-info shrink-0" />
              <span>Son suvarma: {format(new Date(lastIrrig.irrigationDate), 'dd MMM yyyy', { locale: az })}</span>
            </div>
          )}
          {lastProc && (
            <div className="flex items-center gap-2 text-base-content/60">
              <Cog className="w-3.5 h-3.5 text-warning shrink-0" />
              <span>Son proses: {format(new Date(lastProc.processDate), 'dd MMM yyyy', { locale: az })}</span>
            </div>
          )}
          <div className="flex items-center gap-2 text-base-content/40">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span>
              {field.latitude
                ? `${field.latitude.toFixed(4)}, ${field.longitude?.toFixed(4)}`
                : 'Koordinat yoxdur'}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <a
            href={`/dashboard/fields/${field.id}`}
            className="btn btn-outline btn-xs flex-1 gap-1"
          >
            <Info className="w-3 h-3" /> Detallar
          </a>
          <button
            className="btn btn-primary btn-xs flex-1 gap-1"
            onClick={() => onEditCoords(field)}
          >
            <Edit3 className="w-3 h-3" /> Koordinat
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Coord Edit Modal ─────────────────────────────────────────────────
function CoordModal({
  field, onClose, onSave,
}: {
  field: MapField;
  onClose: () => void;
  onSave: (id: string, lat: number, lng: number) => void;
}) {
  const [lat, setLat] = useState(field.latitude?.toString() || '');
  const [lng, setLng] = useState(field.longitude?.toString() || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const latN = parseFloat(lat);
    const lngN = parseFloat(lng);
    if (isNaN(latN) || isNaN(lngN)) return;
    setSaving(true);
    await onSave(field.id, latN, lngN);
    setSaving(false);
    onClose();
  };

  return (
    <div className="modal modal-open z-[2000]">
      <div className="modal-box max-w-sm">
        <h3 className="font-bold mb-1">Sahə #{field.fieldNumber} koordinatı</h3>
        <p className="text-xs text-base-content/50 mb-4">
          Google Maps-dan: sağ klik → koordinatları kopyala
        </p>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="label py-0 mb-1"><span className="label-text text-xs">Enlik (latitude)</span></label>
            <input
              className="input input-bordered input-sm w-full font-mono"
              placeholder="40.4093"
              value={lat}
              onChange={e => setLat(e.target.value)}
            />
          </div>
          <div>
            <label className="label py-0 mb-1"><span className="label-text text-xs">Uzunluq (longitude)</span></label>
            <input
              className="input input-bordered input-sm w-full font-mono"
              placeholder="49.8671"
              value={lng}
              onChange={e => setLng(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-action">
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Ləğv</button>
          <button className="btn btn-primary btn-sm gap-1" onClick={handleSave} disabled={saving}>
            {saving ? <span className="loading loading-spinner loading-xs" /> : <Save className="w-3.5 h-3.5" />}
            Yadda saxla
          </button>
        </div>
      </div>
      <div className="modal-backdrop" onClick={onClose} />
    </div>
  );
}

// ── Legend ───────────────────────────────────────────────────────────
function Legend({ crops }: { crops: string[] }) {
  return (
    <div className="absolute bottom-4 left-4 z-[1000] card bg-base-100/90 backdrop-blur shadow border border-base-200">
      <div className="card-body p-3 space-y-1.5">
        <div className="text-xs font-semibold text-base-content/60 mb-1">Məhsul növü</div>
        {crops.map(crop => (
          <div key={crop} className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded-full shrink-0" style={{ background: getCropColor(crop) }} />
            <span>{crop}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs">
          <div className="w-3 h-3 rounded-full shrink-0 bg-gray-400" />
          <span>Boş sahə</span>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────
export default function MapPage() {
  const [fields, setFields]           = useState<MapField[]>([]);
  const [loading, setLoading]         = useState(true);
  const [selected, setSelected]       = useState<MapField | null>(null);
  const [editCoord, setEditCoord]     = useState<MapField | null>(null);
  const [farmFilter, setFarmFilter]   = useState('');
  const [cropFilter, setCropFilter]   = useState('');

  const fetchFields = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/map/fields');
      if (res.ok) setFields(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFields(); }, []);

  const handleSaveCoords = async (id: string, lat: number, lng: number) => {
    await fetch(`/api/fields/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: lat, longitude: lng }),
    });
    setFields(prev => prev.map(f => f.id === id ? { ...f, latitude: lat, longitude: lng } : f));
    setSelected(prev => prev?.id === id ? { ...prev, latitude: lat, longitude: lng } : prev);
  };

  // Filter
  const farms = [...new Map(fields.map(f => [f.farm.id, f.farm])).values()];
  const allCrops = [...new Set(fields.flatMap(f => f.seasonFields.map(s => s.cropType)))];

  const filteredFields = fields.filter(f => {
    if (farmFilter && f.farm.id !== farmFilter) return false;
    if (cropFilter) {
      const hasCrop = f.seasonFields.some(s => s.cropType === cropFilter);
      if (!hasCrop) return false;
    }
    return true;
  });

  const mappedCount   = filteredFields.filter(f => f.latitude).length;
  const totalHa       = filteredFields.reduce((s, f) => s + f.hectares, 0);
  const noCoordFields = filteredFields.filter(f => !f.latitude);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-base-200 bg-base-100 flex-wrap">
        <div className="flex items-center gap-2 font-semibold">
          <MapPin className="w-5 h-5 text-primary" />
          <span>Sahə Xəritəsi</span>
        </div>

        <div className="flex gap-2 flex-1 flex-wrap">
          <select
            className="select select-bordered select-xs"
            value={farmFilter}
            onChange={e => setFarmFilter(e.target.value)}
          >
            <option value="">Bütün təsərrüfatlar</option>
            {farms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>

          <select
            className="select select-bordered select-xs"
            value={cropFilter}
            onChange={e => setCropFilter(e.target.value)}
          >
            <option value="">Bütün bitkilər</option>
            {allCrops.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Stats */}
        <div className="flex gap-3 text-xs text-base-content/60">
          <span><strong className="text-base-content">{mappedCount}</strong>/{filteredFields.length} sahə xəritədə</span>
          <span><strong className="text-base-content">{totalHa.toFixed(0)}</strong> ha cəmi</span>
        </div>

        <button className="btn btn-ghost btn-xs btn-circle" onClick={fetchFields} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Main area ── */}
      <div className="flex flex-1 min-h-0">

        {/* Left sidebar — field list */}
        <div className="w-56 border-r border-base-200 bg-base-50 overflow-y-auto shrink-0 hidden md:block">
          <div className="p-2 space-y-0.5">
            {filteredFields.length === 0 ? (
              <p className="text-xs text-base-content/40 p-3 text-center">Sahə yoxdur</p>
            ) : (
              filteredFields.map(field => {
                const st = getFieldStatus(field);
                return (
                  <button
                    key={field.id}
                    className={`w-full text-left px-2.5 py-2 rounded-lg text-xs transition-colors flex items-center gap-2 ${
                      selected?.id === field.id ? 'bg-primary/10 text-primary' : 'hover:bg-base-200'
                    }`}
                    onClick={() => setSelected(field)}
                  >
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: st.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">#{field.fieldNumber}</div>
                      <div className="text-base-content/50 truncate">{field.farm.name}</div>
                    </div>
                    {!field.latitude && <AlertCircle className="w-3 h-3 text-warning shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Map */}
        <div className="flex-1 relative min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full bg-base-200">
              <div className="loading loading-spinner loading-lg" />
            </div>
          ) : (
            <MapView
              fields={filteredFields}
              selected={selected}
              onSelect={setSelected}
              getCropColor={getCropColor}
            />
          )}

          {/* Info panel */}
          {selected && (
            <FieldInfoPanel
              field={selected}
              onClose={() => setSelected(null)}
              onEditCoords={setEditCoord}
            />
          )}

          {/* Legend */}
          {allCrops.length > 0 && <Legend crops={allCrops} />}

          {/* No coord warning */}
          {noCoordFields.length > 0 && !selected && (
            <div className="absolute top-4 left-4 z-[1000] flex items-center gap-2 px-3 py-2 rounded-lg bg-warning/20 text-warning text-xs border border-warning/30">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span><strong>{noCoordFields.length}</strong> sahənin koordinatı yoxdur</span>
            </div>
          )}
        </div>
      </div>

      {/* Coord edit modal */}
      {editCoord && (
        <CoordModal
          field={editCoord}
          onClose={() => setEditCoord(null)}
          onSave={handleSaveCoords}
        />
      )}
    </div>
  );
}
