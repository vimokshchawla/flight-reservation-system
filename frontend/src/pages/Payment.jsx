import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CreditCard, Landmark, Lock, ShieldCheck, Smartphone, Wallet } from 'lucide-react';
import { Alert, Button, EmptyState, Field, Input, Modal, PageLoader, Select, Spinner, Stepper, cx } from '../components/ui';
import { bookingService, paymentService } from '../services/api';
import { useTrip } from '../context/AppContext';
import { fmtDate, fmtTime, inr, round2 } from '../utils/format';

const METHODS = [['Card', 'Card', CreditCard], ['UPI', 'UPI', Smartphone], ['NetBanking', 'Net banking', Landmark], ['Wallet', 'Wallet', Wallet]];
const FAIL_CARD = '4000000000000002';

function validate(method, d) {
  const e = {};
  if (method === 'Card') {
    const num = d.number.replace(/\s/g, '');
    if (!/^\d{16}$/.test(num)) e.number = 'Card number must be 16 digits';
    if (d.name.trim().length < 2) e.name = 'Name on card is required';
    const m = d.expiry.match(/^(\d{2})\/(\d{2})$/);
    const now = new Date();
    if (!m || +m[1] < 1 || +m[1] > 12) e.expiry = 'Use MM/YY';
    else if (new Date(2000 + +m[2], +m[1], 1) <= now) e.expiry = 'Card has expired';
    if (!/^\d{3}$/.test(d.cvv)) e.cvv = '3 digits';
  }
  if (method === 'UPI' && !/^[\w.-]{2,}@[a-z]{2,}$/i.test(d.upi.trim())) e.upi = 'Enter a UPI ID like name@okbank';
  if (method === 'NetBanking' && !d.bank) e.bank = 'Choose your bank';
  if (method === 'Wallet' && !d.wallet) e.wallet = 'Choose a wallet';
  return e;
}

export default function Payment() {
  const { trip, setTrip } = useTrip();
  const navigate = useNavigate();
  const ids = trip.bookingIds || [];
  const [bookings, setBookings] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [method, setMethod] = useState('Card');
  const [d, setD] = useState({ number: '', name: '', expiry: '', cvv: '', upi: '', bank: '', wallet: '' });
  const [errors, setErrors] = useState({});
  const [phase, setPhase] = useState('idle'); // idle | processing | failed
  const [failure, setFailure] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = () => { setLoadError(null); bookingService.pending(ids).then(setBookings).catch((e) => setLoadError(e.message)); };
  useEffect(() => { if (ids.length) load(); }, []); // eslint-disable-line

  const total = useMemo(() => round2((bookings || []).reduce((s, b) => s + b.amount, 0)), [bookings]);
  const legs = useMemo(() => [...new Map((bookings || []).map((b) => [b.flight_id, b])).values()], [bookings]);

  if (phase === 'failed' && !trip.bookingIds) {
    return <div className="container-x py-16"><EmptyState title="Payment failed — booking rolled back" text={failure} action={<Link to="/booking"><Button>Choose seats again</Button></Link>} /></div>;
  }
  if (!ids.length) return <div className="container-x py-16"><EmptyState title="Nothing to pay for" text="Start by searching for a flight." action={<Link to="/"><Button>Search flights</Button></Link>} /></div>;
  if (loadError) return <div className="container-x py-16"><Alert tone="error" title="Could not load your booking" onRetry={load}>{loadError}</Alert></div>;
  if (!bookings) return <PageLoader label="Loading booking summary…" />;
  if (bookings.length !== ids.length) {
    return <div className="container-x py-16"><EmptyState title="This booking is no longer awaiting payment" text="It may already be paid or cancelled. Check My bookings for its current status." action={<Link to="/my-bookings"><Button>Go to My bookings</Button></Link>} /></div>;
  }

  const set = (k, v) => { setD((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const pay = async () => {
    const e = validate(method, d);
    setErrors(e);
    if (Object.keys(e).length) return;
    setPhase('processing'); setFailure(null);
    // Demo: card details never leave the browser. Only the method and the simulated outcome are sent.
    const simulate_failure = (method === 'Card' && d.number.replace(/\s/g, '') === FAIL_CARD) || (method === 'UPI' && d.upi.trim().toLowerCase() === 'fail@upi');
    await new Promise((r) => setTimeout(r, 1400));
    try {
      const res = await paymentService.pay({ booking_ids: ids, method, simulate_failure });
      setTrip({ bookingIds: null, confirmed: res.bookings });
      navigate('/confirmation', { replace: true });
    } catch (err) {
      setPhase('failed'); setFailure(err.message);
      if (err.status === 402) setTrip({ bookingIds: null }); // rolled back
      if (err.status === 409) load();
    }
  };
  const releaseSeats = async () => {
    setCancelling(true);
    try {
      for (const b of bookings) await bookingService.cancel(b.booking_id, b.email);
      setTrip({ bookingIds: null });
      navigate('/', { replace: true });
    } catch (err) { setFailure(err.message); setPhase('failed'); setConfirmCancel(false); } finally { setCancelling(false); }
  };

  return (
    <div className="container-x py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><p className="eyebrow">Secure checkout</p><h1 className="mt-1.5 font-display text-3xl font-semibold">Payment</h1></div>
        <Stepper step={2} />
      </div>

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_380px]">
        <section className="panel p-5 sm:p-7">
          <Alert tone="info" className="mb-6" title="Demo payment mode">
            No real payment is taken and card details are never sent to the server. Use card <b>4000 0000 0000 0002</b> or UPI <b>fail@upi</b> to simulate a declined payment (the booking is rolled back).
          </Alert>
          <h2 className="label">Payment method</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {METHODS.map(([v, l, Icon]) => (
              <button key={v} type="button" onClick={() => { setMethod(v); setErrors({}); }} aria-pressed={method === v}
                className={cx('flex items-center justify-center gap-2 rounded-xl border px-3 py-3.5 text-sm font-semibold transition', method === v ? 'border-ink-900 bg-ink-900 text-white' : 'border-mist-300 hover:border-ink-400')}>
                <Icon className="h-4 w-4" />{l}
              </button>
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {method === 'Card' && (<>
              <Field label="Card number" error={errors.number} className="sm:col-span-2">
                <Input inputMode="numeric" autoComplete="off" placeholder="4111 1111 1111 1111" value={d.number} error={errors.number}
                  onChange={(e) => set('number', e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(\d{4})(?=\d)/g, '$1 '))} />
              </Field>
              <Field label="Name on card" error={errors.name} className="sm:col-span-2"><Input autoComplete="off" value={d.name} error={errors.name} onChange={(e) => set('name', e.target.value)} placeholder="RAHUL SHARMA" /></Field>
              <Field label="Expiry" error={errors.expiry}>
                <Input inputMode="numeric" autoComplete="off" placeholder="MM/YY" value={d.expiry} error={errors.expiry}
                  onChange={(e) => set('expiry', e.target.value.replace(/\D/g, '').slice(0, 4).replace(/^(\d{2})(\d)/, '$1/$2'))} />
              </Field>
              <Field label="CVV" error={errors.cvv}><Input type="password" inputMode="numeric" autoComplete="off" placeholder="•••" value={d.cvv} error={errors.cvv} onChange={(e) => set('cvv', e.target.value.replace(/\D/g, '').slice(0, 3))} /></Field>
            </>)}
            {method === 'UPI' && <Field label="UPI ID" error={errors.upi} hint="You'll approve the request in your UPI app (simulated)." className="sm:col-span-2"><Input value={d.upi} error={errors.upi} onChange={(e) => set('upi', e.target.value)} placeholder="name@okbank" /></Field>}
            {method === 'NetBanking' && (
              <Field label="Bank" error={errors.bank} className="sm:col-span-2">
                <Select value={d.bank} error={errors.bank} onChange={(e) => set('bank', e.target.value)}>
                  <option value="">Select your bank</option>{['State Bank of India', 'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank'].map((b) => <option key={b}>{b}</option>)}
                </Select>
              </Field>
            )}
            {method === 'Wallet' && (
              <Field label="Wallet" error={errors.wallet} className="sm:col-span-2">
                <Select value={d.wallet} error={errors.wallet} onChange={(e) => set('wallet', e.target.value)}>
                  <option value="">Select a wallet</option>{['Paytm', 'PhonePe', 'Amazon Pay', 'MobiKwik'].map((b) => <option key={b}>{b}</option>)}
                </Select>
              </Field>
            )}
          </div>

          {phase === 'failed' && <Alert tone="error" className="mt-6" title="Payment failed">{failure}</Alert>}

          <div className="mt-7 flex flex-col-reverse gap-3 border-t border-mist-200 pt-6 sm:flex-row sm:items-center sm:justify-between">
            <button className="text-sm font-semibold text-ink-500 hover:text-red-600" onClick={() => setConfirmCancel(true)}>Cancel and release seats</button>
            <Button variant="brand" size="lg" onClick={pay} loading={phase === 'processing'} className="sm:min-w-64">
              {phase !== 'processing' && <Lock className="h-4 w-4" />}{phase === 'failed' ? 'Try again' : 'Confirm payment'} · {inr(total, true)}
            </Button>
          </div>
        </section>

        <aside className="panel p-5 lg:sticky lg:top-24">
          <h3 className="font-semibold">Booking summary</h3>
          <div className="mt-4 space-y-3">
            {legs.map((l) => (
              <div key={l.flight_id} className="rounded-xl bg-mist-50 p-3.5 text-sm">
                <p className="font-semibold">{l.src_city} → {l.dest_city}</p>
                <p className="text-xs text-ink-500">{l.flight_number} · {fmtDate(l.dep_datetime)} · {fmtTime(l.dep_datetime)}–{fmtTime(l.arr_datetime)}</p>
              </div>
            ))}
          </div>
          <ul className="mt-4 divide-y divide-mist-200 text-sm">
            {bookings.map((b) => (
              <li key={b.booking_id} className="flex justify-between gap-3 py-2.5">
                <span className="min-w-0"><span className="block truncate font-medium">{b.full_name}</span><span className="text-xs text-ink-500">{b.flight_number} · Seat {b.seat_number} · {b.seat_class}</span></span>
                <span className="font-medium tabular-nums">{inr(b.amount, true)}</span>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex items-baseline justify-between border-t border-mist-200 pt-4">
            <span className="font-semibold">Total (incl. taxes)</span><span className="text-2xl font-bold tabular-nums">{inr(total, true)}</span>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-ink-500"><ShieldCheck className="h-4 w-4 text-emerald-600" />Booking status: Pending until payment succeeds</p>
        </aside>
      </div>

      {phase === 'processing' && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink-950/50 p-4" role="status">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
            <Spinner className="mx-auto h-10 w-10" />
            <h3 className="mt-5 text-lg font-semibold">Processing payment…</h3>
            <p className="mt-1 text-sm text-ink-500">Contacting your bank. Please don't close this page.</p>
          </div>
        </div>
      )}
      <Modal open={confirmCancel} onClose={() => setConfirmCancel(false)} title="Release your seats?"
        footer={<><Button variant="secondary" onClick={() => setConfirmCancel(false)}>Keep booking</Button><Button variant="danger" loading={cancelling} onClick={releaseSeats}>Cancel booking</Button></>}>
        <p className="text-sm text-ink-700">Your pending booking will be cancelled and the seats returned to inventory. No payment has been taken.</p>
      </Modal>
    </div>
  );
}
