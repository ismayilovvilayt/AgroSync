'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { NotebookPen, Plus, X, MapPin, Cloud, Thermometer, User, Pencil, Trash2, Search, Filter, ImagePlus, Camera, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { az } from 'date-fns/locale';

interface Note {
  id: string; title: string; content: string; noteDate: string;
  photos: string | null;
  weatherCondition: string | null; temperature: number | null; fieldId: string;
  field: { fieldNumber: string; farm: { name: string } };
  user: { fullName: string };
}

export default function NotesPage() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [fields, setFields] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    fieldId: '', title: '', content: '', noteDate: new Date().toISOString().split('T')[0],
    weatherCondition: '', temperature: '',
  });

  const safeJson = async (r: Response, fb: any = []) => { try { return r.ok ? await r.json() : fb; } catch { return fb; } };

  const fetchData = async () => {
    const [nRes, fRes] = await Promise.all([fetch('/api/notes'), fetch('/api/fields')]);
    setNotes(await safeJson(nRes, []));
    setFields(await safeJson(fRes, []));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = useMemo(() => {
    if (!searchTerm) return notes;
    const term = searchTerm.toLowerCase();
    return notes.filter((n) =>
      n.title.toLowerCase().includes(term) ||
      n.content.toLowerCase().includes(term) ||
      n.field.farm.name.toLowerCase().includes(term) ||
      n.field.fieldNumber.toLowerCase().includes(term) ||
      n.user.fullName.toLowerCase().includes(term) ||
      (n.weatherCondition?.toLowerCase().includes(term))
    );
  }, [notes, searchTerm]);

  const openCreateModal = () => {
    setEditingNote(null);
    setPhotos([]);
    setFormData({ fieldId: '', title: '', content: '', noteDate: new Date().toISOString().split('T')[0], weatherCondition: '', temperature: '' });
    setShowModal(true);
  };

  const openEditModal = (note: Note) => {
    setEditingNote(note);
    setPhotos(note.photos ? JSON.parse(note.photos) : []);
    setFormData({
      fieldId: note.fieldId,
      title: note.title,
      content: note.content,
      noteDate: note.noteDate.split('T')[0],
      weatherCondition: note.weatherCondition || '',
      temperature: note.temperature !== null ? String(note.temperature) : '',
    });
    setShowModal(true);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingPhoto(true);
    const newPhotos: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.size > 5 * 1024 * 1024) {
        alert(`"${file.name}" faylı 5MB-dan böyükdür`);
        continue;
      }

      const fd = new FormData();
      fd.append('file', file);

      try {
        const res = await fetch('/api/upload', { method: 'POST', body: fd });
        if (res.ok) {
          const data = await res.json();
          newPhotos.push(data.url);
        } else {
          const err = await res.json();
          alert(err.error || 'Yükləmə xətası');
        }
      } catch {
        alert('Yükləmə xətası baş verdi');
      }
    }

    setPhotos((prev) => [...prev, ...newPhotos]);
    setUploadingPhoto(false);
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const payload = {
      ...formData,
      temperature: formData.temperature ? parseFloat(formData.temperature) : null,
      photos: photos.length > 0 ? JSON.stringify(photos) : null,
    };

    if (editingNote) {
      await fetch(`/api/notes/${editingNote.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    }

    setShowModal(false);
    setEditingNote(null);
    setPhotos([]);
    setSaving(false);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/notes/${id}`, { method: 'DELETE' });
    setDeleteConfirm(null);
    fetchData();
  };

  const getPhotos = (note: Note): string[] => {
    if (!note.photos) return [];
    try { return JSON.parse(note.photos); } catch { return []; }
  };

  if (loading) {
    return <div className="page-content"><div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Yüklənir...</div></div></div>;
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Sahə qeydləri</h1>
          <p className="page-description">Aqronom gündəliyi — {filtered.length} / {notes.length} qeyd</p>
        </div>
        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={18} /> Yeni qeyd
        </button>
      </div>

      {/* Filtr */}
      <div className="card" style={{ marginBottom: 'var(--space-4)', padding: 'var(--space-4)' }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <Filter size={18} style={{ color: 'var(--text-tertiary)' }} />
          <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 400 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input className="form-input" placeholder="Başlıq, məzmun, sahə axtar..." value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)} style={{ paddingLeft: 36 }} />
          </div>
          {searchTerm && (
            <button className="btn btn-ghost" onClick={() => setSearchTerm('')} style={{ fontSize: 'var(--font-size-sm)' }}>
              <X size={14} /> Təmizlə
            </button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <NotebookPen size={64} className="empty-state-icon" />
          <h2 className="empty-state-title">{searchTerm ? 'Filtrə uyğun nəticə tapılmadı' : 'Qeyd yoxdur'}</h2>
          <p className="empty-state-description">{searchTerm ? 'Axtarış meyarlarını dəyişin' : 'Hələ heç bir sahə qeydi yazılmayıb.'}</p>
        </div>
      ) : (
        <div className="grid-2">
          {filtered.map((note) => {
            const notePhotos = getPhotos(note);
            return (
              <div key={note.id} className="card" style={{ position: 'relative' }}>
                <div className="card-header">
                  <div style={{ flex: 1 }}>
                    <h3 className="card-title">{note.title}</h3>
                    <div className="card-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <MapPin size={12} /> {note.field.farm.name} — #{note.field.fieldNumber}
                      </span>
                      <span>·</span>
                      <span>{format(new Date(note.noteDate), 'dd MMMM yyyy', { locale: az })}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-1)' }}>
                    <button className="btn btn-ghost btn-icon" onClick={() => openEditModal(note)} title="Redaktə et"><Pencil size={15} /></button>
                    <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(note.id)} title="Sil" style={{ color: 'var(--color-error)' }}><Trash2 size={15} /></button>
                  </div>
                </div>
                <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, marginTop: 'var(--space-3)' }}>
                  {note.content}
                </p>

                {/* Şəkillər */}
                {notePhotos.length > 0 && (
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)', flexWrap: 'wrap' }}>
                    {notePhotos.map((url, i) => (
                      <div key={i} onClick={() => setLightboxUrl(url)} style={{
                        width: 72, height: 72, borderRadius: 'var(--radius-md)', overflow: 'hidden',
                        cursor: 'pointer', border: '2px solid var(--border-primary)',
                        transition: 'border-color 0.2s, transform 0.2s',
                      }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--color-primary)'; e.currentTarget.style.transform = 'scale(1.05)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-primary)'; e.currentTarget.style.transform = 'scale(1)'; }}>
                        <img src={url} alt={`Şəkil ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    ))}
                    <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Camera size={12} /> {notePhotos.length} şəkil
                    </span>
                  </div>
                )}

                <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 'var(--space-4)', flexWrap: 'wrap' }}>
                  {note.weatherCondition && (
                    <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Cloud size={12} /> {note.weatherCondition}
                    </span>
                  )}
                  {note.temperature !== null && (
                    <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <Thermometer size={12} /> {note.temperature}°C
                    </span>
                  )}
                  <span className="badge badge-neutral" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <User size={12} /> {note.user.fullName}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
            <div className="modal-header">
              <h2 className="modal-title">{editingNote ? 'Qeydi redaktə et' : 'Yeni sahə qeydi'}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Sahə *</label>
                  <select className="form-select" value={formData.fieldId} onChange={(e) => setFormData({ ...formData, fieldId: e.target.value })} required disabled={!!editingNote}>
                    <option value="">Seçin...</option>
                    {fields.map((f: any) => <option key={f.id} value={f.id}>{f.farm.name} — Sahə #{f.fieldNumber}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Tarix *</label>
                  <input className="form-input" type="date" value={formData.noteDate} onChange={(e) => setFormData({ ...formData, noteDate: e.target.value })} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Başlıq *</label>
                <input className="form-input" placeholder="Müşahidə haqqında qısa başlıq" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
              </div>
              <div className="form-group">
                <label className="form-label">Məzmun *</label>
                <textarea className="form-textarea" style={{ minHeight: 120 }} placeholder="Sahədə müşahidə etdiklərinizi ətraflı yazın..." value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} required />
              </div>

              {/* Şəkil yükləmə */}
              <div className="form-group">
                <label className="form-label">Şəkillər</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: photos.length > 0 ? 'var(--space-3)' : 0 }}>
                  {photos.map((url, i) => (
                    <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--border-primary)' }}>
                      <img src={url} alt={`Şəkil ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" onClick={() => removePhoto(i)}
                        style={{
                          position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)',
                          border: 'none', borderRadius: '50%', width: 22, height: 22,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', color: 'white', padding: 0,
                        }}>
                        <XCircle size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handlePhotoUpload}
                    style={{ display: 'none' }}
                    id="photo-upload"
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    style={{ fontSize: 'var(--font-size-sm)' }}
                  >
                    {uploadingPhoto ? (
                      <><span className="spinner" /> Yüklənir...</>
                    ) : (
                      <><ImagePlus size={16} /> Şəkil əlavə et</>
                    )}
                  </button>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-tertiary)' }}>
                    Maks 5MB · JPEG, PNG, WebP
                  </span>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Hava vəziyyəti</label>
                  <select className="form-select" value={formData.weatherCondition} onChange={(e) => setFormData({ ...formData, weatherCondition: e.target.value })}>
                    <option value="">Seçin...</option>
                    <option value="Günəşli">Günəşli</option>
                    <option value="Buludlu">Buludlu</option>
                    <option value="Yağışlı">Yağışlı</option>
                    <option value="Küləkli">Küləkli</option>
                    <option value="Dumanlı">Dumanlı</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Temperatur (°C)</label>
                  <input className="form-input" type="number" step="0.5" placeholder="Məs: 28" value={formData.temperature} onChange={(e) => setFormData({ ...formData, temperature: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Ləğv et</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? <><span className="spinner" /> Saxlanılır...</> : (editingNote ? 'Yadda saxla' : 'Qeyd et')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 420 }}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ color: 'var(--color-error)' }}>Qeydi sil</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setDeleteConfirm(null)}><X size={20} /></button>
            </div>
            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Bu qeydi silmək istədiyinizə əminsiniz?
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Ləğv et</button>
              <button className="btn btn-primary" style={{ background: 'var(--color-error)' }} onClick={() => handleDelete(deleteConfirm)}>
                <Trash2 size={16} /> Sil
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxUrl && (
        <div className="modal-overlay" onClick={() => setLightboxUrl(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ position: 'relative', maxWidth: '90vw', maxHeight: '90vh' }}>
            <button onClick={() => setLightboxUrl(null)} style={{
              position: 'absolute', top: -12, right: -12, background: 'var(--bg-card)',
              border: '2px solid var(--border-primary)', borderRadius: '50%',
              width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', color: 'var(--text-primary)', zIndex: 10,
            }}>
              <X size={20} />
            </button>
            <img src={lightboxUrl} alt="Tam görünüş" style={{
              maxWidth: '90vw', maxHeight: '85vh', borderRadius: 'var(--radius-lg)',
              boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
