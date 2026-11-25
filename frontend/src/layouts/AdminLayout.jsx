import { useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router-dom';
import { Building2, ClipboardList, LayoutDashboard, LogOut, Menu, Plane, Receipt, Users, Warehouse, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AppContext';
import { Logo } from './SiteLayout';
import { cx } from '../components/ui';

const NAV = [
  ['/admin', 'Dashboard', LayoutDashboard, true], ['/admin/flights', 'Flights', Plane], ['/admin/airports', 'Airports', Building2],
  ['/admin/fleet', 'Airlines & aircraft', Warehouse], ['/admin/passengers', 'Passengers', Users], ['/admin/bookings', 'Bookings', ClipboardList], ['/admin/payments', 'Payments', Receipt],
];

export default function AdminLayout() {
  const { user, isAdmin, logout } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  if (!isAdmin) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(([to, label, Icon, end]) => (
        <NavLink key={to} to={to} end={end} onClick={() => setOpen(false)}
          className={({ isActive }) => cx('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition', isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white')}>
          <Icon className="h-4 w-4" />{label}
        </NavLink>
      ))}
    </nav>
  );
  const sidebar = (
    <div className="flex h-full flex-col bg-ink-950 p-5">
      <Logo light />
      <p className="mb-3 mt-8 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">Administration</p>
      {nav}
      <div className="mt-auto space-y-1 border-t border-white/10 pt-4">
        <NavLink to="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/60 hover:text-white"><ExternalLink className="h-4 w-4" />Customer site</NavLink>
        <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-white/60 hover:text-white"><LogOut className="h-4 w-4" />Sign out</button>
        <p className="px-3 pt-2 text-xs text-white/40">Signed in as {user.name}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">{sidebar}</aside>
      {open && <div className="fixed inset-0 z-50 flex lg:hidden"><div className="w-64">{sidebar}</div><button className="flex-1 bg-ink-950/50" onClick={() => setOpen(false)} aria-label="Close menu" /></div>}
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-mist-200 bg-white px-4 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></button>
        <span className="font-semibold">Admin</span>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8"><Outlet /></main>
    </div>
  );
}
