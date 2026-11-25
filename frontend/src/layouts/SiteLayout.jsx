import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, LogIn, LogOut, Menu, Plane, X } from 'lucide-react';
import { useAuth } from '../context/AppContext';
import { cx } from '../components/ui';

export function Logo({ light }) {
  return (
    <Link to="/" className="flex items-center gap-2.5">
      <span className={cx('grid h-9 w-9 place-items-center rounded-xl', light ? 'bg-white text-ink-900' : 'bg-ink-900 text-white')}><Plane className="h-[18px] w-[18px] -rotate-45" /></span>
      <span className="leading-none">
        <span className={cx('block font-display text-xl font-semibold tracking-tight', light ? 'text-white' : 'text-ink-900')}>Skyroute</span>
        <span className={cx('block text-[10px] font-semibold uppercase tracking-[0.2em]', light ? 'text-white/60' : 'text-ink-400')}>Reservations</span>
      </span>
    </Link>
  );
}

function Navbar() {
  const { user, isAdmin, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const navigate = useNavigate();
  useEffect(() => { setOpen(false); }, [pathname]);
  const link = ({ isActive }) => cx('rounded-lg px-3 py-2 text-sm font-medium transition', isActive ? 'bg-mist-100 text-ink-900' : 'text-ink-700 hover:text-ink-900');
  const links = (
    <>
      <NavLink to="/" end className={link}>Book a flight</NavLink>
      <NavLink to="/my-bookings" className={link}>My bookings</NavLink>
      {isAdmin && <NavLink to="/admin" className={link}><span className="inline-flex items-center gap-1.5"><LayoutDashboard className="h-4 w-4" />Admin</span></NavLink>}
    </>
  );
  return (
    <header className="no-print sticky top-0 z-40 border-b border-mist-200 bg-white/95 backdrop-blur">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex">{links}</nav>
        <div className="hidden items-center gap-3 md:flex">
          {user ? (
            <>
              <span className="text-right leading-tight"><span className="block text-sm font-semibold">{user.name}</span><span className="block text-xs text-ink-500">{user.role}</span></span>
              <button onClick={() => { logout(); navigate('/'); }} className="grid h-9 w-9 place-items-center rounded-lg text-ink-500 hover:bg-mist-100 hover:text-ink-900" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></button>
            </>
          ) : (
            <Link to="/login" className="inline-flex h-9 items-center gap-2 rounded-xl border border-mist-300 px-4 text-sm font-semibold hover:border-ink-400"><LogIn className="h-4 w-4" />Sign in</Link>
          )}
        </div>
        <button className="grid h-10 w-10 place-items-center rounded-lg md:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="border-t border-mist-200 bg-white px-4 py-3 md:hidden">
          <nav className="flex flex-col gap-1">{links}</nav>
          <div className="mt-3 border-t border-mist-200 pt-3">
            {user ? <button onClick={() => { logout(); navigate('/'); }} className="flex items-center gap-2 text-sm font-semibold"><LogOut className="h-4 w-4" />Sign out {user.name}</button>
              : <Link to="/login" className="flex items-center gap-2 text-sm font-semibold"><LogIn className="h-4 w-4" />Sign in</Link>}
          </div>
        </div>
      )}
    </header>
  );
}

function Footer() {
  return (
    <footer className="no-print mt-24 bg-ink-950 text-white/70">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Logo light />
          <p className="mt-4 max-w-xs text-sm leading-relaxed">A flight reservation system built on a normalized 12-table relational schema: live seat availability, safe bookings and consistent payments.</p>
        </div>
        {[
          ['Travel', [['Search flights', '/'], ['My bookings', '/my-bookings'], ['Sign in', '/login']]],
          ['Operations', [['Admin dashboard', '/admin'], ['Manage flights', '/admin/flights'], ['Payments', '/admin/payments']]],
          ['Project', [['DBMS — Flight Reservation System', null], ['React · Vite · Tailwind', null], ['Team 3O21', null]]],
        ].map(([h, items]) => (
          <div key={h}>
            <h4 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-white">{h}</h4>
            <ul className="space-y-2.5 text-sm">{items.map(([t, to]) => <li key={t}>{to ? <Link to={to} className="hover:text-white">{t}</Link> : t}</li>)}</ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col justify-between gap-2 py-5 text-xs sm:flex-row">
          <span>© 2026 Skyroute · University DBMS project. Payments are simulated; no real card data is collected.</span>
          <span>Fares in INR, inclusive of 12% taxes & fees at checkout.</span>
        </div>
      </div>
    </footer>
  );
}

export default function SiteLayout() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1"><Outlet /></main>
      <Footer />
    </div>
  );
}
