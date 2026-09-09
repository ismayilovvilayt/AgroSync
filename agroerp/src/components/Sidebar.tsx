'use client';

import { useState, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Building2,
  Tractor,
  MapPin,
  Cog,
  Droplets,
  Warehouse,
  NotebookPen,
  Users,
  LogOut,
  Menu,
  X,
  Sprout,
  ChevronRight,
  Calendar,
  Clock,
  BarChart3,
  Eye,
  Bell,
  PieChart,
  CloudSun,
  ListChecks,
  Map,
  CalendarDays,
  TrendingUp,
} from 'lucide-react';

const menuItems = [
  {
    section: 'Əsas',
    items: [
      { href: '/dashboard', label: 'İdarə paneli', icon: LayoutDashboard },
    ],
  },
  {
    section: 'Strukturlar',
    items: [
      { href: '/dashboard/companies', label: 'Şirkətlər', icon: Building2, roles: ['ADMIN'] },
      { href: '/dashboard/farms', label: 'Təsərrüfatlar', icon: Tractor },
      { href: '/dashboard/fields', label: 'Sahələr', icon: MapPin },
      { href: '/dashboard/seasons', label: 'Mövsümlər', icon: Calendar },
    ],
  },
  {
    section: 'Əməliyyatlar',
    items: [
      { href: '/dashboard/processes', label: 'Aqrotexniki proseslər', icon: Cog },
      { href: '/dashboard/irrigation', label: 'Suvarma', icon: Droplets },
      { href: '/dashboard/irrigation/schedule', label: 'Suvarma Cədvəli', icon: CalendarDays },
      { href: '/dashboard/warehouse', label: 'Anbar', icon: Warehouse },
      { href: '/dashboard/warehouse/write-offs', label: 'Silinmə İzləmə', icon: Clock },
      { href: '/dashboard/warehouse/analytics', label: 'Anbar Analitikası', icon: BarChart3 },
      { href: '/dashboard/monitoring', label: 'Monitorinqlər', icon: Eye },
      { href: '/dashboard/weather', label: 'Hava Proqnozu', icon: CloudSun },
      { href: '/dashboard/tasks', label: 'Tapşırıqlar', icon: ListChecks },
      { href: '/dashboard/harvest', label: 'Yığım Uçotu', icon: TrendingUp },
      { href: '/dashboard/map', label: 'Xəritə', icon: Map },
    ],
  },
  {
    section: 'İdarəetmə',
    items: [
      { href: '/dashboard/reports', label: 'Hesabatlar', icon: PieChart },
      { href: '/dashboard/users', label: 'İstifadəçilər', icon: Users, roles: ['ADMIN', 'OFFICE_MANAGER'] },
    ],
  },
];

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrator',
  OFFICE_MANAGER: 'Baş Ofis Meneceri',
  FARM_MANAGER: 'Farm Meneceri',
  HEAD_AGRONOMIST: 'Baş Aqronom',
  AGRONOMIST: 'Aqronom',
};

export default function Sidebar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  const userRole = (session?.user as any)?.role || 'AGRONOMIST';
  const userName = session?.user?.name || 'İstifadəçi';
  const userInitials = userName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Alert sayını gətir (hər 5 dəqiqədən bir)
  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch('/api/alerts');
        if (res.ok) {
          const data = await res.json();
          setAlertCount(data.total || 0);
          setErrorCount(data.errorCount || 0);
        }
      } catch {}
    };
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const filteredMenuItems = menuItems.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.roles || item.roles.includes(userRole)
    ),
  })).filter((section) => section.items.length > 0);

  const isAlertsActive = pathname === '/dashboard/alerts';

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{ position: 'fixed', top: 16, left: 16, zIndex: 101 }}
        aria-label="Menyunu aç/bağla"
      >
        {mobileOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'visible' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <Sprout size={22} color="white" />
          </div>
          <div>
            <div className="sidebar-title">AgroSync</div>
            <div className="sidebar-subtitle">İdarəetmə sistemi</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {filteredMenuItems.map((section) => (
            <div key={section.section} className="sidebar-section">
              <div className="sidebar-section-title">{section.section}</div>
              {section.items.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={() => setMobileOpen(false)}
                  >
                    <Icon size={20} className="sidebar-link-icon" />
                    <span>{item.label}</span>
                    {isActive && <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />}
                  </Link>
                );
              })}
            </div>
          ))}

          {/* Bildirişlər */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">Bildirişlər</div>
            <Link
              href="/dashboard/alerts"
              className={`sidebar-link ${isAlertsActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <Bell size={20} className="sidebar-link-icon" />
              <span>Xəbərdarlıqlar</span>
              {alertCount > 0 && (
                <span
                  className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full ${
                    errorCount > 0
                      ? 'bg-red-500 text-white'
                      : 'bg-yellow-400 text-yellow-900'
                  }`}
                  style={{ minWidth: '20px', textAlign: 'center' }}
                >
                  {alertCount}
                </span>
              )}
              {isAlertsActive && alertCount === 0 && (
                <ChevronRight size={16} style={{ marginLeft: 'auto', opacity: 0.5 }} />
              )}
            </Link>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{userInitials}</div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">{userName}</div>
              <div className="sidebar-user-role">{roleLabels[userRole]}</div>
            </div>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => signOut({ callbackUrl: '/login' })}
              title="Çıxış"
              aria-label="Çıxış"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
