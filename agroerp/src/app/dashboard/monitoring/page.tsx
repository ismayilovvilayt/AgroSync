'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Eye, Plus, X, Search, Filter, MapPin, Bug, Leaf, Sprout, Droplets,
  Trash2, Camera, XCircle, ChevronDown, Calendar, AlertTriangle, Rat,
  ImagePlus, ScanEye, Pencil, FileDown,
} from 'lucide-react';
import { format } from 'date-fns';
import { az } from 'date-fns/locale';

// ===== SAHƏ MONİTORİNQİ TAB-I =====
function FieldMonitoringTab() {
  const [records, setRecords] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [farms, setFarms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterFarm, setFilterFarm] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const emptyForm = {
    fieldId: '', monitoringDate: new Date().toISOString().split('T')[0],
    plantPhase: '', pest: '', disease: '', weedStatus: '', nutrientDeficiency: '',
    rodentActivity: '', rodentLocation: '', irrigationDepthCm: '', notes: '',
    pestPhotos: '[]', diseasePhotos: '[]', weedPhotos: '[]', nutrientPhotos: '[]',
    fieldPhoto: '',
  };
  const [form, setForm] = useState(emptyForm);
  const [fieldContext, setFieldContext] = useState<any>(null);
  const [loadingContext, setLoadingContext] = useState(false);

  const safeJson = async (r: Response, fb: any = []) => { try { return r.ok ? await r.json() : fb; } catch { return fb; } };

  const fetchFieldContext = useCallback(async (fieldId: string) => {
    if (!fieldId) { setFieldContext(null); return; }
    setLoadingContext(true);
    try {
      const res = await fetch(`/api/monitoring/field/last?fieldId=${fieldId}`);
      if (res.ok) setFieldContext(await res.json());
      else setFieldContext(null);
    } finally { setLoadingContext(false); }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterFarm ? `/api/monitoring/field?farmId=${filterFarm}` : '/api/monitoring/field';
      const [mRes, fRes, faRes] = await Promise.all([fetch(url), fetch('/api/fields'), fetch('/api/farms')]);
      setRecords(await safeJson(mRes));
      setFields(await safeJson(fRes));
      setFarms(await safeJson(faRes));
    } finally { setLoading(false); }
  }, [filterFarm]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = useMemo(() => {
    if (!searchTerm) return records;
    const t = searchTerm.toLowerCase();
    return records.filter((r: any) =>
      r.field?.fieldNumber?.toLowerCase().includes(t) || r.cropType?.toLowerCase().includes(t) ||
      r.pest?.toLowerCase().includes(t) || r.disease?.toLowerCase().includes(t)
    );
  }, [records, searchTerm]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setFieldContext(null); setShowModal(true); };
  const openEdit = (r: any) => {
    setEditingId(r.id);
    fetchFieldContext(r.fieldId);
    setForm({
      fieldId: r.fieldId, monitoringDate: r.monitoringDate?.split('T')[0] || '',
      plantPhase: r.plantPhase || '', pest: r.pest || '', disease: r.disease || '',
      weedStatus: r.weedStatus || '', nutrientDeficiency: r.nutrientDeficiency || '',
      rodentActivity: r.rodentActivity || '', rodentLocation: r.rodentLocation || '',
      irrigationDepthCm: r.irrigationDepthCm?.toString() || '', notes: r.notes || '',
      pestPhotos: r.pestPhotos || '[]', diseasePhotos: r.diseasePhotos || '[]',
      weedPhotos: r.weedPhotos || '[]', nutrientPhotos: r.nutrientPhotos || '[]',
      fieldPhoto: r.fieldPhoto || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        irrigationDepthCm: form.irrigationDepthCm ? parseFloat(form.irrigationDepthCm) : null,
      };
      const url = editingId ? `/api/monitoring/field/${editingId}` : '/api/monitoring/field';
      await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setShowModal(false);
      fetchData();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu monitorinqi silmək istəyirsiniz?')) return;
    await fetch(`/api/monitoring/field/${id}`, { method: 'DELETE' });
    fetchData();
  };

  // Şəkil yükləmə helper
  const uploadPhoto = async (file: File): Promise<string | null> => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) { const data = await res.json(); return data.url; }
    return null;
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await uploadPhoto(file);
    if (!url) return;

    if (field === 'fieldPhoto') {
      setForm(p => ({ ...p, fieldPhoto: url }));
    } else {
      const existing: string[] = JSON.parse(form[field as keyof typeof form] as string || '[]');
      setForm(p => ({ ...p, [field]: JSON.stringify([...existing, url]) }));
    }
  };

  const removePhoto = (field: string, url: string) => {
    if (field === 'fieldPhoto') {
      setForm(p => ({ ...p, fieldPhoto: '' }));
    } else {
      const existing: string[] = JSON.parse(form[field as keyof typeof form] as string || '[]');
      setForm(p => ({ ...p, [field]: JSON.stringify(existing.filter(u => u !== url)) }));
    }
  };

  const parsePhotos = (json: string | null): string[] => {
    if (!json) return [];
    try { return JSON.parse(json); } catch { return []; }
  };

  // Mini photo gallery component
  const PhotoGallery = ({ photos, label }: { photos: string[]; label: string }) => {
    if (!photos.length) return null;
    return (
      <div className="mt-1">
        <span className="text-xs text-base-content/50">{label}:</span>
        <div className="flex gap-1 mt-1 flex-wrap">
          {photos.map((url, i) => (
            <img key={i} src={url} alt="" className="w-10 h-10 rounded object-cover cursor-pointer hover:ring-2 ring-primary transition-all" onClick={() => setLightboxUrl(url)} />
          ))}
        </div>
      </div>
    );
  };

  // Photo upload input component
  const PhotoInput = ({ field, label, isArray = true }: { field: string; label: string; isArray?: boolean }) => {
    const fileRef = useRef<HTMLInputElement>(null);
    const photos = isArray ? parsePhotos(form[field as keyof typeof form] as string) : [];
    const singleUrl = !isArray ? (form[field as keyof typeof form] as string) : '';

    return (
      <div>
        <label className="label label-text text-xs pb-1">{label}</label>
        <div className="flex gap-2 flex-wrap items-center">
          {isArray && photos.map((url, i) => (
            <div key={i} className="relative">
              <img src={url} alt="" className="w-14 h-14 rounded object-cover" />
              <button type="button" className="absolute -top-1 -right-1 btn btn-circle btn-xs btn-error" onClick={() => removePhoto(field, url)}>
                <XCircle className="w-3 h-3" />
              </button>
            </div>
          ))}
          {!isArray && singleUrl && (
            <div className="relative">
              <img src={singleUrl} alt="" className="w-14 h-14 rounded object-cover" />
              <button type="button" className="absolute -top-1 -right-1 btn btn-circle btn-xs btn-error" onClick={() => removePhoto(field, singleUrl)}>
                <XCircle className="w-3 h-3" />
              </button>
            </div>
          )}
          <button type="button" className="btn btn-outline btn-xs gap-1" onClick={() => fileRef.current?.click()}>
            <Camera className="w-3 h-3" /> Şəkil
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => handlePhotoUpload(e, field)} />
        </div>
      </div>
    );
  };

  if (loading) return <div className="flex justify-center py-12"><div className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <select className="select select-bordered select-sm w-44" value={filterFarm} onChange={e => setFilterFarm(e.target.value)}>
          <option value="">Bütün təsərrüfatlar</option>
          {farms.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <input className="input input-bordered input-sm flex-1 min-w-[200px]" placeholder="Axtarış (sahə, bitki, zərərverici)..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        <button className="btn btn-primary btn-sm gap-1" onClick={openCreate}><Plus className="w-4 h-4" /> Yeni Monitorinq</button>
        <a href="/api/export/monitoring-field" download className="btn btn-outline btn-success btn-sm gap-1">
          <FileDown className="w-4 h-4" /> Excel
        </a>
      </div>

      {/* Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="text-xs bg-base-200/50">
                  <th>Tarix</th>
                  <th>Sahə</th>
                  <th>Bitki</th>
                  <th>Son Suvarma</th>
                  <th>Faza</th>
                  <th>Zərərverici</th>
                  <th>Xəstəlik</th>
                  <th>Alaq</th>
                  <th>Qida</th>
                  <th>Gəmirici</th>
                  <th className="text-center">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r: any) => {
                  const pestPhotos = parsePhotos(r.pestPhotos);
                  const diseasePhotos = parsePhotos(r.diseasePhotos);
                  const weedPhotos = parsePhotos(r.weedPhotos);
                  const nutrientPhotos = parsePhotos(r.nutrientPhotos);
                  const isExpanded = expandedId === r.id;

                  return (
                    <>
                      <tr key={r.id} className="hover cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : r.id)}>
                        <td className="text-xs font-medium whitespace-nowrap">{format(new Date(r.monitoringDate), 'dd.MM.yyyy', { locale: az })}</td>
                        <td>
                          <div className="font-medium">Sahə {r.field?.fieldNumber}</div>
                          <div className="text-xs text-base-content/50">{r.field?.farm?.name}</div>
                        </td>
                        <td><span className="badge badge-success badge-sm">{r.cropType || '—'}</span></td>
                        <td className="text-xs">
                          {r.lastIrrigationDate ? (
                            <div>
                              <div>{format(new Date(r.lastIrrigationDate), 'dd.MM', { locale: az })}</div>
                              <div className="text-info font-medium">{r.lastIrrigationMm} mm</div>
                            </div>
                          ) : '—'}
                        </td>
                        <td className="text-xs">{r.plantPhase || '—'}</td>
                        <td>
                          {r.pest ? (
                            <div>
                              <span className="badge badge-error badge-sm">{r.pest}</span>
                              {pestPhotos.length > 0 && <span className="text-xs ml-1">📷{pestPhotos.length}</span>}
                            </div>
                          ) : <span className="text-success text-xs">Yox</span>}
                        </td>
                        <td>
                          {r.disease ? (
                            <div>
                              <span className="badge badge-warning badge-sm">{r.disease}</span>
                              {diseasePhotos.length > 0 && <span className="text-xs ml-1">📷{diseasePhotos.length}</span>}
                            </div>
                          ) : <span className="text-success text-xs">Yox</span>}
                        </td>
                        <td>
                          {r.weedStatus ? (
                            <span className={`badge badge-sm ${r.weedStatus === 'Çox' ? 'badge-error' : r.weedStatus === 'Orta' ? 'badge-warning' : 'badge-info'}`}>{r.weedStatus}</span>
                          ) : '—'}
                        </td>
                        <td className="text-xs">{r.nutrientDeficiency ? <span className="badge badge-warning badge-sm">{r.nutrientDeficiency}</span> : '—'}</td>
                        <td className="text-xs">
                          {r.rodentActivity ? (
                            <div>
                              <span className="badge badge-error badge-sm">Var</span>
                              {r.rodentLocation && <div className="text-xs text-base-content/50 mt-0.5">{r.rodentLocation}</div>}
                            </div>
                          ) : '—'}
                        </td>
                        <td>
                          <div className="flex gap-1 justify-center" onClick={e => e.stopPropagation()}>
                            <button className="btn btn-ghost btn-xs" onClick={() => openEdit(r)}><Pencil className="w-3 h-3" /></button>
                            <button className="btn btn-ghost btn-xs" onClick={() => handleDelete(r.id)}><Trash2 className="w-3 h-3 text-error" /></button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded row — şəkillər + qeyd + əlavə detallar */}
                      {isExpanded && (
                        <tr key={`${r.id}-detail`}>
                          <td colSpan={11} className="bg-base-200/30 p-4">
                            <div className="flex flex-wrap gap-4 mb-2 text-xs">
                              {r.irrigationDepthCm && (
                                <div className="flex items-center gap-1">
                                  <Droplets className="w-3.5 h-3.5 text-info" />
                                  <span className="text-base-content/50">Dərinlik:</span>
                                  <span className="font-semibold">{r.irrigationDepthCm} sm</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5 text-primary" />
                                <span className="text-base-content/50">Monitorçu:</span>
                                <span className="font-semibold">{r.user?.fullName}</span>
                              </div>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                              <PhotoGallery photos={pestPhotos} label="Zərərverici şəkilləri" />
                              <PhotoGallery photos={diseasePhotos} label="Xəstəlik şəkilləri" />
                              <PhotoGallery photos={weedPhotos} label="Alaq otu şəkilləri" />
                              <PhotoGallery photos={nutrientPhotos} label="Qida stres şəkilləri" />
                              {r.fieldPhoto && (
                                <div>
                                  <span className="text-xs text-base-content/50">Sahə vizualı:</span>
                                  <img src={r.fieldPhoto} alt="" className="w-20 h-20 rounded object-cover mt-1 cursor-pointer hover:ring-2 ring-primary" onClick={() => setLightboxUrl(r.fieldPhoto)} />
                                </div>
                              )}
                            </div>
                            {r.notes && <p className="text-sm mt-3 p-2 bg-base-200 rounded">{r.notes}</p>}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                  {filtered.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-12 text-base-content/40">
                    <ScanEye className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Hələ sahə monitorinqi yoxdur</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box max-w-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <ScanEye className="w-5 h-5 text-primary" />
              {editingId ? 'Monitorinqi Redaktə Et' : 'Yeni Sahə Monitorinqi'}
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label label-text text-xs pb-1">Sahə *</label>
                  <select className="select select-bordered select-sm w-full" value={form.fieldId}
                    onChange={e => {
                      const newFieldId = e.target.value;
                      setForm(p => ({ ...p, fieldId: newFieldId }));
                      if (!editingId) fetchFieldContext(newFieldId);
                    }}
                    disabled={!!editingId}>
                    <option value="">Sahə seçin</option>
                    {fields.map((f: any) => <option key={f.id} value={f.id}>{f.farm?.name} — Sahə {f.fieldNumber} ({f.hectares} ha)</option>)}
                  </select>
                </div>
                <div>
                  <label className="label label-text text-xs pb-1">Tarix *</label>
                  <input type="date" className="input input-bordered input-sm w-full" value={form.monitoringDate} onChange={e => setForm(p => ({ ...p, monitoringDate: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label label-text text-xs pb-1"><Leaf className="w-3 h-3 inline mr-1"/>Bitkinin fazası</label>
                  <input className="input input-bordered input-sm w-full" placeholder="məs: Sünbülləmə, Çiçəkləmə" value={form.plantPhase} onChange={e => setForm(p => ({ ...p, plantPhase: e.target.value }))} />
                </div>
                <div>
                  <label className="label label-text text-xs pb-1"><Droplets className="w-3 h-3 inline mr-1"/>Suvarma dərinliyi (sm)</label>
                  <input type="number" className="input input-bordered input-sm w-full" placeholder="sm" value={form.irrigationDepthCm} onChange={e => setForm(p => ({ ...p, irrigationDepthCm: e.target.value }))} />
                </div>
              </div>

              {/* Son Vəziyyət Kartı */}
              {loadingContext && (
                <div className="flex items-center gap-2 text-xs text-base-content/50 py-2">
                  <span className="loading loading-spinner loading-xs" /> Son monitorinq yüklənir...
                </div>
              )}
              {!loadingContext && fieldContext && form.fieldId && (
                <div className="rounded-xl border border-base-300 bg-base-200/40 p-3 space-y-2">
                  <p className="text-xs font-semibold text-base-content/60 uppercase tracking-wide">📋 Son Vəziyyət</p>

                  {/* Aktiv bitki */}
                  {fieldContext.activeCrop && (
                    <div className="flex items-center gap-2 text-xs">
                      <Leaf className="w-3.5 h-3.5 text-success shrink-0" />
                      <span className="text-base-content/60">Aktiv bitki:</span>
                      <span className="font-medium">{fieldContext.activeCrop.cropType}</span>
                    </div>
                  )}

                  {/* Son suvarma */}
                  {fieldContext.lastIrrigation && (
                    <div className="flex items-center gap-2 text-xs">
                      <Droplets className="w-3.5 h-3.5 text-info shrink-0" />
                      <span className="text-base-content/60">Son suvarma:</span>
                      <span className="font-medium">{format(new Date(fieldContext.lastIrrigation.irrigationDate), 'dd.MM.yyyy', { locale: az })}</span>
                      {fieldContext.lastIrrigation.waterMm && <span className="badge badge-info badge-xs">{fieldContext.lastIrrigation.waterMm} mm</span>}
                    </div>
                  )}

                  {/* Son sahə monitorinqi */}
                  {fieldContext.lastFieldMonitoring ? (
                    <div className="space-y-1 border-t border-base-300 pt-2">
                      <div className="flex items-center gap-2 text-xs">
                        <ScanEye className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="text-base-content/60">Son monitorinq:</span>
                        <span className="font-medium">{format(new Date(fieldContext.lastFieldMonitoring.monitoringDate), 'dd.MM.yyyy', { locale: az })}</span>
                        <span className="text-base-content/40">— {fieldContext.lastFieldMonitoring.user?.fullName}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 pl-5">
                        {fieldContext.lastFieldMonitoring.plantPhase && (
                          <span className="badge badge-ghost badge-xs">{fieldContext.lastFieldMonitoring.plantPhase}</span>
                        )}
                        {fieldContext.lastFieldMonitoring.pest && (
                          <span className="badge badge-error badge-xs">🐛 {fieldContext.lastFieldMonitoring.pest}</span>
                        )}
                        {fieldContext.lastFieldMonitoring.disease && (
                          <span className="badge badge-warning badge-xs">🦠 {fieldContext.lastFieldMonitoring.disease}</span>
                        )}
                        {fieldContext.lastFieldMonitoring.weedStatus && fieldContext.lastFieldMonitoring.weedStatus !== 'Yox' && (
                          <span className="badge badge-ghost badge-xs">🌿 Alaq: {fieldContext.lastFieldMonitoring.weedStatus}</span>
                        )}
                        {fieldContext.lastFieldMonitoring.rodentActivity && fieldContext.lastFieldMonitoring.rodentActivity !== 'Yox' && (
                          <span className="badge badge-error badge-xs">🐀 Gəmirici: {fieldContext.lastFieldMonitoring.rodentActivity}</span>
                        )}
                        {!fieldContext.lastFieldMonitoring.pest && !fieldContext.lastFieldMonitoring.disease && (
                          <span className="badge badge-success badge-xs">✓ Problem yoxdur</span>
                        )}
                      </div>
                      {fieldContext.lastFieldMonitoring.notes && (
                        <p className="text-xs text-base-content/50 pl-5 italic">"{fieldContext.lastFieldMonitoring.notes.slice(0, 80)}{fieldContext.lastFieldMonitoring.notes.length > 80 ? '...' : ''}"</p>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-xs text-base-content/40 border-t border-base-300 pt-2">
                      <ScanEye className="w-3.5 h-3.5" />
                      Bu sahə üçün əvvəlki monitorinq tapılmadı
                    </div>
                  )}
                </div>
              )}

              <div className="divider text-xs my-1">Problemlər</div>

              <div>
                <label className="label label-text text-xs pb-1"><Bug className="w-3 h-3 inline mr-1"/>Zərərverici</label>
                <input className="input input-bordered input-sm w-full" placeholder="məs: Sün böcəyi, mənənə" value={form.pest} onChange={e => setForm(p => ({ ...p, pest: e.target.value }))} />
                <PhotoInput field="pestPhotos" label="Zərərverici şəkilləri" />
              </div>

              <div>
                <label className="label label-text text-xs pb-1"><AlertTriangle className="w-3 h-3 inline mr-1"/>Xəstəlik</label>
                <input className="input input-bordered input-sm w-full" placeholder="məs: Sarı pas, vilt" value={form.disease} onChange={e => setForm(p => ({ ...p, disease: e.target.value }))} />
                <PhotoInput field="diseasePhotos" label="Xəstəlik şəkilləri" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label label-text text-xs pb-1">Alaq otları</label>
                  <select className="select select-bordered select-sm w-full" value={form.weedStatus} onChange={e => setForm(p => ({ ...p, weedStatus: e.target.value }))}>
                    <option value="">Seçin</option>
                    <option value="Yox">Yox</option><option value="Az">Az</option><option value="Orta">Orta</option><option value="Çox">Çox</option>
                  </select>
                  <PhotoInput field="weedPhotos" label="Alaq şəkilləri" />
                </div>
                <div>
                  <label className="label label-text text-xs pb-1">Qida çatışmazlığı / stres</label>
                  <input className="input input-bordered input-sm w-full" placeholder="məs: Azot çatışmazlığı" value={form.nutrientDeficiency} onChange={e => setForm(p => ({ ...p, nutrientDeficiency: e.target.value }))} />
                  <PhotoInput field="nutrientPhotos" label="Stres şəkilləri" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label label-text text-xs pb-1"><Rat className="w-3 h-3 inline mr-1"/>Gəmirici aktivliyi</label>
                  <select className="select select-bordered select-sm w-full" value={form.rodentActivity} onChange={e => setForm(p => ({ ...p, rodentActivity: e.target.value }))}>
                    <option value="">Seçin</option><option value="Yox">Yox</option><option value="Var">Var</option><option value="Çox">Çox</option>
                  </select>
                </div>
                <div>
                  <label className="label label-text text-xs pb-1">Gəmirici konumu</label>
                  <input className="input input-bordered input-sm w-full" placeholder="məs: Şimal-qərb küncü" value={form.rodentLocation} onChange={e => setForm(p => ({ ...p, rodentLocation: e.target.value }))} />
                </div>
              </div>

              <PhotoInput field="fieldPhoto" label="Sahənin vizual şəkli" isArray={false} />

              <div>
                <label className="label label-text text-xs pb-1">Qeyd</label>
                <textarea className="textarea textarea-bordered w-full text-sm" rows={2} placeholder="Əlavə qeydlər..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Ləğv et</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.fieldId}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : 'Saxla'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxUrl(null)}>
          <img src={lightboxUrl} alt="" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl" />
          <button className="absolute top-4 right-4 btn btn-circle btn-sm btn-ghost text-white"><X className="w-5 h-5" /></button>
        </div>
      )}
    </div>
  );
}

// ===== ÇIXIŞ MONİTORİNQİ TAB-I =====
function EmergenceMonitoringTab() {
  const [records, setRecords] = useState<any[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [farms, setFarms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterFarm, setFilterFarm] = useState('');

  const emptyForm = {
    fieldId: '', monitoringDate: new Date().toISOString().split('T')[0],
    sowingDate: '', variety: '', plantedCount: '', emergedCount: '', countUnit: 'thousand', notes: '',
  };
  const [form, setForm] = useState(emptyForm);

  const safeJson = async (r: Response, fb: any = []) => { try { return r.ok ? await r.json() : fb; } catch { return fb; } };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterFarm ? `/api/monitoring/emergence?farmId=${filterFarm}` : '/api/monitoring/emergence';
      const [mRes, fRes, faRes] = await Promise.all([fetch(url), fetch('/api/fields'), fetch('/api/farms')]);
      setRecords(await safeJson(mRes));
      setFields(await safeJson(fRes));
      setFarms(await safeJson(faRes));
    } finally { setLoading(false); }
  }, [filterFarm]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => { setEditingId(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (r: any) => {
    setEditingId(r.id);
    setForm({
      fieldId: r.fieldId,
      monitoringDate: r.monitoringDate?.split('T')[0] || '',
      sowingDate: r.sowingDate?.split('T')[0] || '',
      variety: r.variety || '',
      plantedCount: r.plantedCount?.toString() || '',
      emergedCount: r.emergedCount?.toString() || '',
      countUnit: r.countUnit || 'thousand',
      notes: r.notes || '',
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editingId ? `/api/monitoring/emergence/${editingId}` : '/api/monitoring/emergence';
      await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setShowModal(false);
      fetchData();
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu çıxış monitorinqini silmək istəyirsiniz?')) return;
    await fetch(`/api/monitoring/emergence/${id}`, { method: 'DELETE' });
    fetchData();
  };

  // Çıxış faizi live hesabla
  const calcPercent = () => {
    const planted = parseFloat(form.plantedCount);
    const emerged = parseFloat(form.emergedCount);
    if (planted && emerged) return Math.round((emerged / planted) * 1000) / 10;
    return null;
  };

  if (loading) return <div className="flex justify-center py-12"><div className="loading loading-spinner loading-lg" /></div>;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <select className="select select-bordered select-sm w-44" value={filterFarm} onChange={e => setFilterFarm(e.target.value)}>
          <option value="">Bütün təsərrüfatlar</option>
          {farms.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}
        </select>
        <div className="flex-1" />
        <button className="btn btn-primary btn-sm gap-1" onClick={openCreate}><Plus className="w-4 h-4" /> Yeni Çıxış Monitorinqi</button>
        <a href="/api/export/monitoring-emergence" download className="btn btn-outline btn-success btn-sm gap-1">
          <FileDown className="w-4 h-4" /> Excel
        </a>
      </div>

      {/* Table */}
      <div className="card bg-base-100 border border-base-300 shadow-sm">
        <div className="card-body p-0">
          <div className="overflow-x-auto">
            <table className="table table-sm">
              <thead>
                <tr className="text-xs bg-base-200/50">
                  <th>Tarix</th>
                  <th>Sahə</th>
                  <th>Ölçü</th>
                  <th>Səpin Tarixi</th>
                  <th>Bitki</th>
                  <th>Növü</th>
                  <th className="text-right">Əkilən</th>
                  <th className="text-right">Çıxan</th>
                  <th className="text-right">Çıxış %</th>
                  <th>Qeyd</th>
                  <th className="text-center">Əməliyyat</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r: any) => {
                  const pct = r.emergencePercent;
                  const pctColor = pct >= 90 ? 'text-success' : pct >= 75 ? 'text-warning' : 'text-error';
                  const unitLabel = r.countUnit === 'million' ? 'mln' : 'min';

                  return (
                    <tr key={r.id} className="hover">
                      <td className="text-xs font-medium whitespace-nowrap">{format(new Date(r.monitoringDate), 'dd.MM.yyyy', { locale: az })}</td>
                      <td>
                        <div className="font-medium">Sahə {r.field?.fieldNumber}</div>
                        <div className="text-xs text-base-content/50">{r.field?.farm?.name}</div>
                      </td>
                      <td className="text-xs">{r.field?.hectares ? `${r.field.hectares} ha` : '—'}</td>
                      <td className="text-xs">{r.sowingDate ? format(new Date(r.sowingDate), 'dd.MM.yyyy', { locale: az }) : '—'}</td>
                      <td><span className="badge badge-success badge-sm">{r.cropType || '—'}</span></td>
                      <td className="text-xs">{r.variety || '—'}</td>
                      <td className="text-right font-medium">{r.plantedCount?.toLocaleString()} <span className="text-xs text-base-content/50">{unitLabel}</span></td>
                      <td className="text-right font-medium">{r.emergedCount?.toLocaleString()} <span className="text-xs text-base-content/50">{unitLabel}</span></td>
                      <td className={`text-right font-bold ${pctColor}`}>
                        {pct ? `${pct}%` : '—'}
                      </td>
                      <td className="text-xs max-w-[200px] truncate">{r.notes || '—'}</td>
                      <td>
                        <div className="flex gap-1 justify-center">
                          <button className="btn btn-ghost btn-xs" onClick={() => openEdit(r)}><Pencil className="w-3 h-3" /></button>
                          <button className="btn btn-ghost btn-xs" onClick={() => handleDelete(r.id)}><Trash2 className="w-3 h-3 text-error" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <tr><td colSpan={11} className="text-center py-12 text-base-content/40">
                    <Sprout className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Hələ çıxış monitorinqi yoxdur</p>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal modal-open">
          <div className="modal-box">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Sprout className="w-5 h-5 text-success" />
              {editingId ? 'Çıxışı Redaktə Et' : 'Yeni Çıxış Monitorinqi'}
            </h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label label-text text-xs pb-1">Sahə *</label>
                  <select className="select select-bordered select-sm w-full" value={form.fieldId} onChange={e => setForm(p => ({ ...p, fieldId: e.target.value }))} disabled={!!editingId}>
                    <option value="">Sahə seçin</option>
                    {fields.map((f: any) => <option key={f.id} value={f.id}>{f.farm?.name} — Sahə {f.fieldNumber} ({f.hectares} ha)</option>)}
                  </select>
                </div>
                <div>
                  <label className="label label-text text-xs pb-1">Tarix *</label>
                  <input type="date" className="input input-bordered input-sm w-full" value={form.monitoringDate} onChange={e => setForm(p => ({ ...p, monitoringDate: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label label-text text-xs pb-1">Səpin tarixi</label>
                  <input type="date" className="input input-bordered input-sm w-full" value={form.sowingDate} onChange={e => setForm(p => ({ ...p, sowingDate: e.target.value }))} />
                  <span className="text-xs text-base-content/50">Boş buraxsanız avtomatik tapılacaq</span>
                </div>
                <div>
                  <label className="label label-text text-xs pb-1">Toxum növü</label>
                  <input className="input input-bordered input-sm w-full" placeholder="məs: Bezostaya-1, P9903" value={form.variety} onChange={e => setForm(p => ({ ...p, variety: e.target.value }))} />
                </div>
              </div>

              <div className="divider text-xs my-1">Bitki Sayları</div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label label-text text-xs pb-1">Əkilən say</label>
                  <input type="number" step="0.1" className="input input-bordered input-sm w-full" placeholder="məs: 5.5" value={form.plantedCount} onChange={e => setForm(p => ({ ...p, plantedCount: e.target.value }))} />
                </div>
                <div>
                  <label className="label label-text text-xs pb-1">Vahid</label>
                  <select className="select select-bordered select-sm w-full" value={form.countUnit} onChange={e => setForm(p => ({ ...p, countUnit: e.target.value }))}>
                    <option value="million">Milyon (Buğda/Arpa)</option>
                    <option value="thousand">Min (Digər)</option>
                  </select>
                </div>
                <div>
                  <label className="label label-text text-xs pb-1">Çıxan say</label>
                  <input type="number" step="0.1" className="input input-bordered input-sm w-full" placeholder="məs: 4.8" value={form.emergedCount} onChange={e => setForm(p => ({ ...p, emergedCount: e.target.value }))} />
                </div>
              </div>

              {/* Live çıxış faizi */}
              {calcPercent() !== null && (
                <div className="p-3 bg-base-200 rounded-lg text-center">
                  <span className="text-xs text-base-content/60">Çıxış faizi: </span>
                  <span className={`text-2xl font-bold ${(calcPercent()!) >= 90 ? 'text-success' : (calcPercent()!) >= 75 ? 'text-warning' : 'text-error'}`}>
                    {calcPercent()}%
                  </span>
                </div>
              )}

              <div>
                <label className="label label-text text-xs pb-1">Qeyd</label>
                <textarea className="textarea textarea-bordered w-full text-sm" rows={2} placeholder="Əlavə qeydlər..." value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
              </div>
            </div>

            <div className="modal-action">
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Ləğv et</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving || !form.fieldId}>
                {saving ? <span className="loading loading-spinner loading-xs" /> : 'Saxla'}
              </button>
            </div>
          </div>
          <div className="modal-backdrop" onClick={() => setShowModal(false)} />
        </div>
      )}
    </div>
  );
}

// ===== ƏSAS SƏHİFƏ =====
export default function MonitoringPage() {
  const [tab, setTab] = useState<'field' | 'emergence'>('field');

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-base-content flex items-center gap-2">
          <Eye className="w-7 h-7 text-primary" /> Monitorinqlər
        </h1>
        <p className="text-sm text-base-content/60 mt-1">
          Sahə monitorinqləri və çıxış hesabatları
        </p>
      </div>

      {/* Tabs */}
      <div className="tabs tabs-boxed w-fit">
        <button className={`tab gap-2 ${tab === 'field' ? 'tab-active' : ''}`} onClick={() => setTab('field')}>
          <ScanEye className="w-4 h-4" /> Sahə Monitorinqi
        </button>
        <button className={`tab gap-2 ${tab === 'emergence' ? 'tab-active' : ''}`} onClick={() => setTab('emergence')}>
          <Sprout className="w-4 h-4" /> Çıxış Monitorinqi
        </button>
      </div>

      {/* Content */}
      {tab === 'field' ? <FieldMonitoringTab /> : <EmergenceMonitoringTab />}
    </div>
  );
}
