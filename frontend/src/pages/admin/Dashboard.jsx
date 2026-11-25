import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Database } from 'lucide-react';
import { Alert, PageLoader, StatusBadge } from '../../components/ui';
import { adminService } from '../../services/api';
import { fmtDateTime, inr } from '../../utils/format';

const Tile = ({ label, value, sub }) => (
  <div className="panel p-5">
    <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</p>
    <p className="mt-2 text-3xl font-bold tabular-nums">{value}</p>
    {sub && <p className="mt-1 text-xs text-ink-500">{sub}</p>}
  </div>
);

const SqlTag = ({ children }) => <span className="inline-flex items-center gap-1 rounded-md bg-mist-100 px-2 py-0.5 font-mono text-[11px] text-ink-700"><Database className="h-3 w-3" />{children}</span>;

function Bars({ rows, label, value, format = (v) => v, max }) {
  const top = max ?? Math.max(1, ...rows.map(value));
  return (
    <ul className="space-y-3">
      {rows.map((r, i) => (
        <li key={i} title={`${label(r)}: ${format(value(r))}`}>
          <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate text-ink-700">{label(r)}</span><span className="font-semibold tabular-nums">{format(value(r))}</span></div>
          <div className="h-2 rounded bg-mist-100"><div className="h-2 rounded bg-brand-500" style={{ width: `${Math.max(2, (value(r) / top) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const [d, setD] = useState(null);
  const [error, setError] = useState(null);
  const load = () => { setError(null); adminService.dashboard().then(setD).catch((e) => setError(e.message)); };
  useEffect(() => { load(); }, []); // eslint-disable-line
  if (error) return <Alert tone="error" title="Could not load dashboard" onRetry={load}>{error}</Alert>;
  if (!d) return <PageLoader />;
  const t = d.totals;
  const totalBookings = t.confirmed + t.pending + t.cancelled;

  return (
    <div className="space-y-8">
      <div><p className="eyebrow">Overview</p><h1 className="mt-1 font-display text-3xl font-semibold">Operations dashboard</h1><p className="mt-1 text-sm text-ink-500">Live figures computed from the flight_reservation_system MySQL database.</p></div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Revenue collected" value={inr(t.revenue)} sub={`${inr(t.refunded)} refunded`} />
        <Tile label="Confirmed bookings" value={t.confirmed.toLocaleString('en-IN')} sub={`${t.pending} pending · ${t.cancelled} cancelled`} />
        <Tile label="Upcoming flights" value={t.upcoming_flights} sub={`${t.flights} flights in schedule`} />
        <Tile label="Passengers" value={t.passengers} sub={`${(totalBookings / Math.max(1, t.passengers)).toFixed(1)} bookings per passenger`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="panel p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Next departures · occupancy</h2><SqlTag>LEFT JOIN · GROUP BY</SqlTag></div>
          <Bars rows={d.nextFlights} max={100} label={(r) => `${r.flight_number} ${r.src_code}→${r.dest_code} · ${fmtDateTime(r.dep_datetime)}`} value={(r) => r.occupancy_pct} format={(v) => `${v}%`} />
        </section>
        <section className="panel p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Revenue by airline</h2><SqlTag>JOIN via AIRCRAFT · SUM</SqlTag></div>
          <Bars rows={d.byAirline} label={(r) => `${r.airline_name} · ${r.tickets} tickets`} value={(r) => r.revenue} format={(v) => inr(v)} />
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-mist-200 px-6 py-4"><h2 className="font-semibold">Recent bookings</h2><Link to="/admin/bookings" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:underline">All bookings <ArrowRight className="h-4 w-4" /></Link></div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-mist-50 text-left text-xs uppercase tracking-wider text-ink-500"><tr>{['Reference', 'Passenger', 'Flight', 'Seat', 'Amount', 'Booking', 'Payment'].map((h) => <th key={h} className="px-6 py-3 font-semibold">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-mist-200">
              {d.recent.map((b) => (
                <tr key={b.booking_id}>
                  <td className="px-6 py-3 font-mono font-semibold">{b.reference}</td><td className="px-6 py-3">{b.full_name}</td>
                  <td className="px-6 py-3">{b.flight_number} <span className="text-ink-500">{b.src_code}→{b.dest_code}</span></td><td className="px-6 py-3">{b.seat_number}</td>
                  <td className="px-6 py-3 tabular-nums">{inr(b.amount, true)}</td><td className="px-6 py-3"><StatusBadge status={b.status} /></td><td className="px-6 py-3"><StatusBadge status={b.payment_status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <section className="panel p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Fullest upcoming flights</h2><SqlTag>ORDER BY occupancy</SqlTag></div>
          <Bars rows={d.topOccupancy} max={100} label={(r) => `${r.flight_number} ${r.src_code}→${r.dest_code}`} value={(r) => r.occupancy_pct} format={(v) => `${v}%`} />
        </section>
        <section className="panel p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Frequent passengers</h2><SqlTag>HAVING COUNT &gt; 1</SqlTag></div>
          <ol className="divide-y divide-mist-200 text-sm">{d.frequent.map((p, i) => <li key={p.passenger_id} className="flex justify-between py-2"><span><span className="mr-2 text-ink-400">{i + 1}.</span>{p.full_name}</span><span className="font-semibold">{p.total_bookings}</span></li>)}</ol>
        </section>
        <section className="panel p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">User roles</h2><SqlTag>LEFT JOIN ADMIN · CASE</SqlTag></div>
          <ul className="divide-y divide-mist-200 text-sm">{d.roles.map((r) => <li key={r.username} className="flex justify-between py-2"><span className="font-mono">{r.username}</span><span className={r.role === 'Admin' ? 'font-semibold text-gold-600' : 'text-ink-500'}>{r.role}</span></li>)}</ul>
        </section>
      </div>
    </div>
  );
}
