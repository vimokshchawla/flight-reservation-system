import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Armchair, ArrowRight, Shuffle, User } from 'lucide-react';
import { Alert, Button, EmptyState, Field, Input, PageLoader, Stepper, cx } from '../components/ui';
import SeatMap from '../components/SeatMap';
import { FareBreakdown, LegCard } from '../components/TripSummary';
import { bookingService, flightService } from '../services/api';
import { useAuth, useTrip } from '../context/AppContext';

const blank = { full_name: '', email: '', phone: '', address: '' };
function validate(list) {
  const errs = list.map((p) => {
    const e = {};
    if (!/^[A-Za-z][A-Za-z .'-]{1,99}$/.test(p.full_name.trim())) e.full_name = 'Enter the full name as on ID (letters only)';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(p.email.trim())) e.email = 'Enter a valid email address';
    if (!/^\+?[0-9\s-]{10,15}$/.test(p.phone.trim())) e.phone = 'Enter a 10–15 digit phone number';
    return e;
  });
  const seen = {};
  list.forEach((p, i) => {
    const k = p.email.trim().toLowerCase();
    if (k && seen[k] !== undefined && !errs[i].email) errs[i].email = `Already used for passenger ${seen[k] + 1} — each traveller needs their own email`;
    seen[k] ??= i;
  });
  return errs;
}

export default function Booking() {
  const { trip, setTrip } = useTrip();
  const { user } = useAuth();
  const navigate = useNavigate();
  const search = trip.search || {};
  const pax = Number(search.pax) || 1;
  const cabin = search.cabin || 'Economy';
  const legIds = [trip.outbound?.flight_id, trip.inbound?.flight_id].filter(Boolean);

  const [legs, setLegs] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [passengers, setPassengers] = useState(() => Array.from({ length: pax }, (_, i) =>
    i === 0 && user?.email ? { full_name: user.name || '', email: user.email, phone: user.phone || '', address: user.address || '' } : { ...blank }));
  const [errors, setErrors] = useState([]);
  const [seatSel, setSeatSel] = useState(() => legIds.map(() => Array(pax).fill(null)));
  const [activeLeg, setActiveLeg] = useState(0);
  const [activePax, setActivePax] = useState(0);
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadLegs = () => {
    setLoadError(null);
    return Promise.all(legIds.map((id) => flightService.get(id))).then(setLegs).catch((e) => setLoadError(e.message));
  };
  useEffect(() => { if (legIds.length) loadLegs(); }, []); // eslint-disable-line

  if (!legIds.length) return <div className="container-x py-16"><EmptyState title="No flight selected" text="Search for a flight and select it to start a booking." action={<Link to="/"><Button>Search flights</Button></Link>} /></div>;
  if (loadError) return <div className="container-x py-16"><Alert tone="error" title="Could not load flight details" onRetry={loadLegs}>{loadError}</Alert></div>;
  if (!legs) return <PageLoader label="Loading seat availability…" />;

  const setP = (i, k, v) => {
    setPassengers((list) => list.map((p, j) => (j === i ? { ...p, [k]: v } : p)));
    setErrors((e) => e.map((x, j) => (j === i ? { ...x, [k]: undefined } : x)));
    setSubmitError(null);
  };
  const pick = (seat) => {
    setSubmitError(null);
    setSeatSel((sel) => sel.map((arr, li) => {
      if (li !== activeLeg) return arr;
      const next = [...arr];
      const owner = next.indexOf(seat.seat_id);
      if (owner >= 0) { next[owner] = null; return next; }
      next[activePax] = seat.seat_id;
      return next;
    }));
    const cur = seatSel[activeLeg];
    if (cur.indexOf(seat.seat_id) < 0) {
      const nextEmpty = cur.findIndex((s, i) => i !== activePax && s == null);
      if (nextEmpty >= 0) setActivePax(nextEmpty);
    }
  };
  const autoAssign = () => {
    setSeatSel((sel) => sel.map((arr, li) => {
      const free = legs[li].seats.filter((s) => s.available && s.seat_class === cabin && !arr.includes(s.seat_id));
      return arr.map((s) => s ?? free.shift()?.seat_id ?? null);
    }));
  };
  const seatLabel = (li, id) => legs[li].seats.find((s) => s.seat_id === id)?.seat_number;
  const missingSeats = seatSel.some((arr) => arr.some((s) => s == null));

  const submit = async () => {
    const errs = validate(passengers);
    setErrors(errs);
    setSubmitError(null);
    if (errs.some((e) => Object.keys(e).length)) { setSubmitError('Please fix the highlighted passenger details.'); return; }
    if (missingSeats) { setSubmitError('Choose a seat for every passenger on every flight (or use Auto-assign).'); return; }
    setSubmitting(true);
    try {
      const res = await bookingService.create({
        cabin,
        passengers: passengers.map((p) => ({ ...p, full_name: p.full_name.trim(), email: p.email.trim(), phone: p.phone.trim() })),
        legs: legs.map((f, li) => ({ flight_id: f.flight_id, seat_ids: seatSel[li] })),
      });
      setTrip({ bookingIds: res.booking_ids, confirmed: null });
      navigate('/payment');
    } catch (e) {
      setSubmitError(e.message);
      if (e.status === 409) { await loadLegs(); setSeatSel(legIds.map(() => Array(pax).fill(null))); }
    } finally { setSubmitting(false); }
  };

  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="eyebrow">Passenger details</p><h1 className="mt-1.5 font-display text-3xl font-semibold">Who's flying?</h1></div>
        <Stepper step={1} />
      </div>

      {trip.bookingIds?.length > 0 && (
        <Alert tone="warning" className="mt-6" title="You already have seats on hold">
          A pending booking from this trip is awaiting payment. <Link to="/payment" className="font-semibold underline">Continue to payment</Link> or submit this form to create a new one.
        </Alert>
      )}

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {passengers.map((p, i) => (
            <section key={i} className="panel p-5 sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-mist-100 text-ink-700"><User className="h-4 w-4" /></span>
                <div><h2 className="font-semibold">Passenger {i + 1}{i === 0 && <span className="ml-2 text-xs font-medium text-ink-500">Primary contact</span>}</h2><p className="text-xs text-ink-500">Adult · {cabin}</p></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" error={errors[i]?.full_name} className="sm:col-span-2"><Input value={p.full_name} onChange={(e) => setP(i, 'full_name', e.target.value)} placeholder="As shown on government ID" error={errors[i]?.full_name} autoComplete="name" /></Field>
                <Field label="Email" error={errors[i]?.email}><Input type="email" value={p.email} onChange={(e) => setP(i, 'email', e.target.value)} placeholder="name@example.com" error={errors[i]?.email} autoComplete="email" /></Field>
                <Field label="Phone" error={errors[i]?.phone}><Input type="tel" value={p.phone} onChange={(e) => setP(i, 'phone', e.target.value)} placeholder="98765 43210" error={errors[i]?.phone} autoComplete="tel" /></Field>
                {i === 0 && <Field label="Address (optional)" className="sm:col-span-2"><Input value={p.address} onChange={(e) => setP(i, 'address', e.target.value)} placeholder="Street, city" autoComplete="street-address" /></Field>}
              </div>
            </section>
          ))}

          <section className="panel p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-mist-100 text-ink-700"><Armchair className="h-4 w-4" /></span>
                <div><h2 className="font-semibold">Choose seats</h2><p className="text-xs text-ink-500">{cabin} seats only · tap a seat to assign it</p></div>
              </div>
              <Button variant="secondary" size="sm" onClick={autoAssign}><Shuffle className="h-4 w-4" />Auto-assign</Button>
            </div>
            {legs.length > 1 && (
              <div className="mb-4 inline-flex rounded-xl bg-mist-100 p-1">
                {legs.map((f, li) => <button key={li} onClick={() => setActiveLeg(li)} className={cx('rounded-lg px-4 py-2 text-sm font-semibold', activeLeg === li ? 'bg-white shadow-sm' : 'text-ink-500')}>{f.src_code} → {f.dest_code}</button>)}
              </div>
            )}
            <div className="mb-5 flex flex-wrap gap-2">
              {passengers.map((p, i) => (
                <button key={i} onClick={() => setActivePax(i)}
                  className={cx('flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition', activePax === i ? 'border-brand-500 bg-brand-50' : 'border-mist-300 hover:border-ink-400')}>
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-600 text-[11px] font-bold text-white">P{i + 1}</span>
                  <span className="max-w-32 truncate font-medium">{p.full_name.trim() || `Passenger ${i + 1}`}</span>
                  <span className={cx('font-semibold', seatSel[activeLeg][i] ? 'text-brand-700' : 'text-ink-400')}>{seatLabel(activeLeg, seatSel[activeLeg][i]) || '—'}</span>
                </button>
              ))}
            </div>
            <SeatMap seats={legs[activeLeg].seats} cabin={cabin} selected={seatSel[activeLeg]} activePax={activePax} onPick={pick} />
          </section>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="panel p-5">
            <h3 className="mb-4 font-semibold">Your trip</h3>
            <div className="space-y-3">{legs.map((f, i) => <LegCard key={f.flight_id} f={f} label={i === 0 ? 'Outbound' : 'Return'} />)}</div>
            <Link to={`/flights?${new URLSearchParams(search)}`} className="mt-3 inline-block text-xs font-semibold text-brand-600 hover:underline">Change flights</Link>
          </div>
          <div className="panel p-5">
            <h3 className="mb-4 font-semibold">Fare breakdown</h3>
            <FareBreakdown legs={legs} pax={pax} cabin={cabin} />
            {submitError && <Alert tone="error" className="mt-4">{submitError}</Alert>}
            <Button variant="brand" size="lg" className="mt-5 w-full" loading={submitting} onClick={submit}>Continue to payment <ArrowRight className="h-4 w-4" /></Button>
            <p className="mt-3 text-center text-xs text-ink-500">Seats are held as <b>Pending</b> until payment succeeds.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
