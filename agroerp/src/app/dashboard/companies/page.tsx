'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import {
  Building2, MapPin, Phone, Tractor, Users, Warehouse as WarehouseIcon,
  Pencil, X, Save, CheckCircle2, Globe, ChevronRight, Leaf,
} from 'lucide-react';
import { useToast } from '@/components/Toast';

interface CompanyData {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  _count: { farms: number; users: number; warehouses: number };
}

export default function CompaniesPage() {
  const { data: session } = useSession();
  const { showToast } = useToast();
  const userRole = (session?.user as any)?.role;

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ name: '', address: '', phone: '' });

  const fetchCompany = async () => {
    const res = await fetch('/api/companies');
    if (res.ok) {
      const data = await res.json();
      setCompany(data);
    }
    setLoading(false);
  };

  useEffect(() => { fetchCompany(); }, []);

  const startEdit = () => {
    if (company) {
      setFormData({ name: company.name, address: company.address || '', phone: company.phone || '' });
      setEditing(true);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { showToast('Şirkət adı tələb olunur', 'error'); return; }
    setSaving(true);
    const res = await fetch('/api/companies', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (res.ok) {
      showToast('Şirkət məlumatları yeniləndi', 'success');
      setEditing(false);
    } else {
      showToast('Xəta baş verdi', 'error');
    }
    setSaving(false);
    fetchCompany();
  };

  if (loading) {
    return <div className="page-content"><div className="loading-screen"><div className="spinner spinner-lg" /><div className="loading-text">Yüklənir...</div></div></div>;
  }

  if (!company) {
    return <div className="page-content"><p style={{ color: 'var(--text-tertiary)' }}>Şirkət tapılmadı</p></div>;
  }

  // Initials for avatar
  const initials = company.name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

  return (
    <div className="page-content">
      <div className="page-header">
        <div className="page-header-left">
          <h1 className="page-title">Şirkət</h1>
          <p className="page-description">Şirkət məlumatları və statistikası</p>
        </div>
        {userRole === 'ADMIN' && !editing && (
          <button className="btn btn-secondary" onClick={startEdit}>
            <Pencil size={16} /> Redaktə et
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, alignItems: 'start' }}>

        {/* ── Main Info Card ── */}
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Card header with gradient */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(59,130,246,0.08) 100%)',
            padding: '28px 28px 24px',
            borderBottom: '1px solid var(--border-primary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              {/* Company avatar */}
              <div style={{
                width: 72, height: 72, borderRadius: 18,
                background: 'linear-gradient(135deg, #10B981, #059669)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 26, fontWeight: 800, color: 'white',
                boxShadow: '0 8px 20px rgba(16,185,129,0.35)',
                flexShrink: 0,
              }}>
                {initials || <Building2 size={32} />}
              </div>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 4 }}>{company.name}</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    display: 'flex', alignItems: 'center', gap: 4,
                    fontSize: 12, fontWeight: 600, color: '#10B981',
                    background: 'rgba(16,185,129,0.12)', borderRadius: 20,
                    padding: '3px 10px',
                  }}>
                    <CheckCircle2 size={12} /> Aktiv
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>
                    Aqrotexniki idarəetmə sistemi
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Info fields */}
          {editing ? (
            <div style={{ padding: 28 }}>
              <div className="form-group">
                <label className="form-label">Şirkət adı *</label>
                <input
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Ünvan</label>
                <input
                  className="form-input"
                  placeholder="Məs: Bakı, Azərbaycan"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Telefon</label>
                <input
                  className="form-input"
                  placeholder="+994 XX XXX XX XX"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button className="btn btn-secondary" onClick={() => setEditing(false)}>
                  <X size={16} /> Ləğv et
                </button>
                <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? <><span className="spinner" /> Saxlanılır...</> : <><Save size={16} /> Yadda saxla</>}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { icon: <MapPin size={18} style={{ color: '#10B981' }} />, label: 'Ünvan', value: company.address || 'Göstərilməyib' },
                { icon: <Phone size={18} style={{ color: '#3B82F6' }} />, label: 'Telefon', value: company.phone || 'Göstərilməyib' },
              ].map((item, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '12px 16px', background: 'var(--bg-tertiary)', borderRadius: 12,
                  border: '1px solid var(--border-primary)',
                }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10,
                    background: 'var(--bg-card)', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                      {item.label}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: item.value.includes('Göstərilməyib') ? 'var(--text-tertiary)' : 'var(--text-primary)' }}>
                      {item.value}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Stats column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            {
              icon: <Tractor size={22} />, label: 'Təsərrüfatlar', value: company._count.farms,
              color: '#10B981', bg: 'rgba(16,185,129,0.12)', href: '/dashboard/farms',
            },
            {
              icon: <Users size={22} />, label: 'İstifadəçilər', value: company._count.users,
              color: '#3B82F6', bg: 'rgba(59,130,246,0.12)', href: '/dashboard/users',
            },
            {
              icon: <WarehouseIcon size={22} />, label: 'Anbarlar', value: company._count.warehouses,
              color: '#F59E0B', bg: 'rgba(245,158,11,0.12)', href: '/dashboard/warehouse',
            },
            {
              icon: <Leaf size={22} />, label: 'Sistem', value: 'AgroERP',
              color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', href: null,
            },
          ].map((stat, i) => (
            <div
              key={i}
              onClick={() => stat.href && (window.location.href = stat.href)}
              style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '16px 18px', borderRadius: 14,
                background: 'var(--bg-card)', border: '1px solid var(--border-primary)',
                cursor: stat.href ? 'pointer' : 'default',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (stat.href) {
                  e.currentTarget.style.borderColor = stat.color;
                  e.currentTarget.style.background = stat.bg;
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-primary)';
                e.currentTarget.style.background = 'var(--bg-card)';
              }}
            >
              <div style={{
                width: 46, height: 46, borderRadius: 12,
                background: stat.bg, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: stat.color, flexShrink: 0,
              }}>
                {stat.icon}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 22, fontWeight: 800, color: stat.color, lineHeight: 1.2 }}>
                  {stat.value}
                </div>
              </div>
              {stat.href && <ChevronRight size={16} style={{ color: 'var(--text-tertiary)' }} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
