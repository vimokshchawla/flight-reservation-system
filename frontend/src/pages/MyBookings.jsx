import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, CreditCard, Search, Ticket, TicketX } from 'lucide-react';
import { Alert, Button, EmptyState, Field, Input, Modal, StatusBadge, AirlineMark, cx, useToast } from '../components/ui';
import { bookingService } from '../services/api';
import { useAuth, useTrip } from '../context/AppContext';
import { duration, fmtDate, fmtTime, inr } from '../utils/format';

const TABS = [['all', 'All'], ['upcoming', 'Upcoming'], ['past', 'Past'], ['pending', 'Pending'], ['cancelled', 'Cancelled']];
const inTab = (b, t) => t === 'all' || (t === 'upcoming' && b.status === 'Confirmed' && !b.departed) || (t === 'past' && b.departed && b.status !== 'Cancelled')
  || (t === 'pending' && b.status === 'Pending') || (t === 'cancelled' && b.status === 'Cancelled');

function BookingRow({ b, onCancel, onPay, onView }) {
  return (
    <div className="panel p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <AirlineMark name={b.airline_name} id={b.airline_id} size="sm" />
          <div>
            <p className="font-semibold">{b.src_city} <ArrowRight className="inline h-3.5 w-3.5 text-ink-400" /> {b.dest_city}</p>
            <p className="text-xs text-ink-500">{b.airline_name} {b.flight_number} · {fmtDate(b.dep_datetime)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {b.departed && b.status !== 'Cancelled' && <StatusBadge status="Departed" />}
          <StatusBadge status={b.status} />
          <StatusBadge status={b.payment_status} prefix="Payment:" />
        </div>
      </div>
      <div className="mt-4 grid gap-4 border-t border-mist-200 pt-4 text-sm sm:grid-cols-[1fr_auto] sm:items-end">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-5">
          {[['Reference', b.reference], ['Passenger', b.full_name], ['Time', `${fmtTime(b.dep_datetime)} – ${fmtTime(b.arr_datetime)} · ${duration(b.duration_min)}`], ['Seat', `${b.seat_number} · ${b.seat_class}`], ['Amount', inr(b.amount, true)]].map(([k, v]) => (
            <div key={k} className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{k}</dt><dd className={cx('truncate font-medium', k === 'Reference' && 'font-mono')}>{v}</dd></div>
          ))}
        </dl>
        <div className="flex flex-wrap gap-2">
          {b.status === 'Pending' && !b.departed && <Button size="sm" variant="brand" onClick={() => onPay(b)}><CreditCard className="h-4 w-4" />Pay now</Button>}
          {b.status === 'Confirmed' && <Button size="sm" variant="secondary" onClick={() => onView(b)}><Ticket className="h-4 w-4" />View ticket</Button>}
          {b.status !== 'Cancelled' && !b.departed && <Button size="sm" variant="danger-ghost" onClick={() => onCancel(b)}>Cancel</Button>}
        </div>
      </div>
    </div>
  );
}

export default function MyBookings() {
  const { user } = useAuth();
  const { setTrip } = useTrip();
  const navigate = useNavigate();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [query, setQuery] = useState('');
  const [lookup, setLookup] = useState({ ref: '', email: '' });
  const [lookupErr, setLookupErr] = useState({});
  const [busy, setBusy] = useState(false);
  const [toCancel, setToCancel] = useState(null);

  const loadMine = () => { setError(null); bookingService.mine().then(setList).catch((e) => { setError(e.message); setList([]); }); };
  useEffect(() => { if (user) loadMine(); else setList(null); }, [user]); // eslint-disable-line

  const doLookup = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!/^(FRS)?\d{1,9}$/i.test(lookup.ref.trim())) errs.ref = 'Reference looks like FRS000123';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(lookup.email.trim())) errs.email = 'Enter the passenger email';
    setLookupErr(errs);
    if (Object.keys(errs).length) return;
    setBusy(true); setError(null);
    try {
      const rows = await bookingService.lookup(lookup.ref.trim(), lookup.email.trim());
      setList((cur) => [...rows, ...(cur || []).filter((x) => !rows.some((r) => r.booking_id === x.booking_id))]);
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      const updated = await bookingService.cancel(toCancel.booking_id, toCancel.email);
      setList((l) => l.map((x) => (x.booking_id === updated.booking_id ? updated : x)));
      toast(`Booking ${updated.reference} cancelled${updated.payment_status === 'Refunded' ? ' — refund initiated' : ''}.`);
      setToCancel(null);
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  const shown = useMemo(() => (list || []).filter((b) => inTab(b, tab) && (!query.trim() || `${b.reference} ${b.flight_number} ${b.full_name} ${b.dest_city} ${b.src_city}`.toLowerCase().includes(query.trim().toLowerCase()))), [list, tab, query]);

  return (
    <div className="container-x max-w-5xl py-10">
      <p className="eyebrow">Manage</p>
      <h1 className="mt-1.5 font-display text-3xl font-semibold">My bookings</h1>
      <p className="mt-2 text-ink-500">{user ? `Signed in as ${user.name}. Bookings made with ${user.email || 'your email'} appear here.` : 'Find a booking with its reference and the passenger’s email, or sign in to see all your trips.'}</p>

      {!user && (
        <form onSubmit={doLookup} noValidate className="panel mt-6 grid gap-4 p-5 sm:grid-cols-[1fr_1.3fr_auto] sm:items-start">
          <Field label="Booking reference" error={lookupErr.ref}><Input value={lookup.ref} error={lookupErr.ref} onChange={(e) => setLookup({ ...lookup, ref: e.target.value })} placeholder="FRS000001" /></Field>
          <Field label="Passenger email" error={lookupErr.email}><Input type="email" value={lookup.email} error={lookupErr.email} onChange={(e) => setLookup({ ...lookup, email: e.target.value })} placeholder="rahul.sharma@example.com" /></Field>
          <Button type="submit" loading={busy} className="sm:mt-[22px]"><Search className="h-4 w-4" />Find booking</Button>
          <p className="text-xs text-ink-500 sm:col-span-3">Demo: try <b>FRS000001</b> with <b>rahul.sharma@example.com</b>, or <Link to="/login" className="font-semibold text-brand-600 hover:underline">sign in</Link> as rahul01 / rahul123.</p>
        </form>
      )}

      {error && <Alert tone="error" className="mt-6" onRetry={user ? loadMine : undefined}>{error}</Alert>}

      {list && list.length > 0 && (
        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1 rounded-xl bg-mist-100 p-1">
            {TABS.map(([v, l]) => (
              <button key={v} onClick={() => setTab(v)} className={cx('rounded-lg px-3 py-1.5 text-sm font-semibold', tab === v ? 'bg-white shadow-sm' : 'text-ink-500 hover:text-ink-900')}>
                {l} <span className="text-xs font-medium text-ink-400">{list.filter((b) => inTab(b, v)).length}</span>
              </button>
            ))}
          </div>
          <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-400" /><Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search reference, flight…" className="h-10 pl-9" /></div>
        </div>
      )}

      <div className="mt-5 space-y-3">
        {user && list === null && Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-mist-200/70" />)}
        {shown.map((b) => <BookingRow key={b.booking_id} b={b} onCancel={setToCancel}
          onPay={(x) => { setTrip({ bookingIds: [x.booking_id] }); navigate('/payment'); }}
          onView={(x) => navigate('/confirmation', { state: { bookings: [x] } })} />)}
        {list && list.length > 0 && shown.length === 0 && <div className="panel"><EmptyState title="Nothing in this view" text="Try another tab or clear the search." /></div>}
        {list && list.length === 0 && !error && <div className="panel"><EmptyState icon={TicketX} title="No bookings yet" text="When you book a flight it will show up here." action={<Link to="/"><Button>Search flights</Button></Link>} /></div>}
      </div>

      <Modal open={!!toCancel} onClose={() => setToCancel(null)} title="Cancel this booking?"
        footer={<><Button variant="secondary" onClick={() => setToCancel(null)}>Keep booking</Button><Button variant="danger" loading={busy} onClick={cancel}>Yes, cancel</Button></>}>
        {toCancel && <p className="text-sm leading-relaxed text-ink-700">Booking <b className="font-mono">{toCancel.reference}</b> for {toCancel.full_name} on {toCancel.flight_number} ({fmtDate(toCancel.dep_datetime)}) will be marked <b>Cancelled</b> and seat {toCancel.seat_number} released.{toCancel.payment_status === 'Paid' && ` ${inr(toCancel.amount, true)} will be refunded.`}</p>}
      </Modal>
    </div>
  );
}
