import { useCallback, useEffect, useMemo, useState } from 'react';
import CrudPage from '../../components/CrudPage';
import DataTable from '../../components/DataTable';
import { Alert, Button, Modal, StatusBadge, useToast } from '../../components/ui';
import { adminService } from '../../services/api';
import { duration, fmtDateTime, inr } from '../../utils/format';

const Code = ({ children }) => <span className="rounded-md bg-ink-900 px-1.5 py-0.5 font-mono text-xs font-bold text-white">{children}</span>;
const Header = ({ title, text }) => <div className="mb-6"><p className="eyebrow">Manage</p><h1 className="mt-1 font-display text-3xl font-semibold">{title}</h1>{text && <p className="mt-1 max-w-3xl text-sm text-ink-500">{text}</p>}</div>;
const toLocal = (s) => (s ? s.slice(0, 16).replace(' ', 'T') : '');

export function FlightsAdmin() {
  return (
    <CrudPage resource="flights" idKey="flight_id" title="Flight schedule" singular="Flight" needsLookups
      description="Each new flight gets an 80-seat inventory (8 Business, 72 Economy). A flight with bookings cannot be deleted. The airline comes from the aircraft (3NF)."
      searchKeys={['flight_number', 'airline_name', 'src_code', 'dest_code', 'src_city', 'dest_city']}
      filters={[{ key: 'when', label: 'Status', options: [['upcoming', 'Upcoming'], ['departed', 'Departed']], test: (r, v) => (v === 'departed') === r.departed }]}
      columns={[
        { key: 'flight_number', label: 'Flight', render: (r) => <span className="font-semibold">{r.flight_number}</span> },
        { key: 'airline_name', label: 'Airline / aircraft', render: (r) => <span>{r.airline_name}<span className="block text-xs text-ink-500">{r.model_number}</span></span> },
        { key: 'src_code', label: 'Route', render: (r) => <span className="inline-flex items-center gap-1.5"><Code>{r.src_code}</Code>→<Code>{r.dest_code}</Code></span> },
        { key: 'dep_datetime', label: 'Departure', render: (r) => fmtDateTime(r.dep_datetime) },
        { key: 'duration_min', label: 'Duration', render: (r) => duration(r.duration_min) },
        { key: 'base_fare', label: 'Base fare', render: (r) => inr(r.base_fare) },
        { key: 'eco_available', label: 'Free seats', sortValue: (r) => r.eco_available + r.bus_available, render: (r) => <span className="tabular-nums">{r.eco_available + r.bus_available}<span className="text-xs text-ink-500"> / 80</span></span> },
        { key: 'departed', label: 'Status', render: (r) => <StatusBadge status={r.departed ? 'Departed' : 'Upcoming'} /> },
      ]}
      toForm={(r) => ({ ...r, dep_datetime: toLocal(r.dep_datetime), arr_datetime: toLocal(r.arr_datetime) })}
      fields={[
        { name: 'flight_number', label: 'Flight number', required: true, placeholder: 'AI101' },
        { name: 'aircraft_id', label: 'Aircraft', type: 'select', required: true, options: (l) => l.aircraft.map((a) => [a.aircraft_id, `${a.airline_name} · ${a.model_number} (${a.capacity})`]) },
        { name: 'src_airport_id', label: 'Origin', type: 'select', required: true, options: (l) => l.airports.map((a) => [a.airport_id, `${a.iata_code} · ${a.city_name}`]) },
        { name: 'dest_airport_id', label: 'Destination', type: 'select', required: true, options: (l) => l.airports.map((a) => [a.airport_id, `${a.iata_code} · ${a.city_name}`]), validate: (v, all) => (v && String(v) === String(all.src_airport_id) ? 'Must differ from origin' : null) },
        { name: 'dep_datetime', label: 'Departure', type: 'datetime-local', required: true },
        { name: 'arr_datetime', label: 'Arrival', type: 'datetime-local', required: true, validate: (v, all) => (v && all.dep_datetime && v <= all.dep_datetime ? 'Arrival must be after departure' : null) },
        { name: 'base_fare', label: 'Base economy fare (₹)', type: 'number', min: 1, step: 50, required: true, hint: 'Business fare = 2.5 × base' },
      ]} />
  );
}

export function AirportsAdmin() {
  return (
    <CrudPage resource="airports" idKey="airport_id" title="Airports" singular="Airport"
      description="Locations are stored once in the CITY table; enter a city and country and the matching CITY row is reused or created."
      searchKeys={['iata_code', 'airport_name', 'city_name', 'country']}
      columns={[
        { key: 'iata_code', label: 'Code', render: (r) => <Code>{r.iata_code}</Code> },
        { key: 'airport_name', label: 'Airport', render: (r) => <span className="font-medium">{r.airport_name}</span> },
        { key: 'city_name', label: 'City' }, { key: 'country', label: 'Country' },
        { key: 'flight_count', label: 'Flights', className: 'text-right' },
      ]}
      fields={[
        { name: 'iata_code', label: 'IATA code', required: true, placeholder: 'DEL', validate: (v) => (!/^[A-Za-z]{3}$/.test(v || '') ? '3 letters' : null) },
        { name: 'airport_name', label: 'Airport name', required: true },
        { name: 'city_name', label: 'City', required: true }, { name: 'country', label: 'Country', required: true },
      ]} />
  );
}

export function FleetAdmin() {
  return (
    <div className="space-y-12">
      <Header title="Airlines & aircraft" text="A flight is linked to its airline only through the aircraft that operates it." />
      <CrudPage resource="airlines" idKey="airline_id" title="Airlines" singular="Airline" searchKeys={['airline_name', 'contact_info']}
        columns={[{ key: 'airline_id', label: 'ID' }, { key: 'airline_name', label: 'Airline', render: (r) => <span className="font-medium">{r.airline_name}</span> }, { key: 'contact_info', label: 'Contact' }, { key: 'aircraft_count', label: 'Aircraft', className: 'text-right' }]}
        fields={[{ name: 'airline_name', label: 'Airline name', required: true, span: true }, { name: 'contact_info', label: 'Contact info', span: true }]} />
      <CrudPage resource="aircraft" idKey="aircraft_id" title="Aircraft" singular="Aircraft" needsLookups searchKeys={['model_number', 'airline_name']}
        columns={[{ key: 'aircraft_id', label: 'ID' }, { key: 'model_number', label: 'Model', render: (r) => <span className="font-medium">{r.model_number}</span> }, { key: 'airline_name', label: 'Airline' }, { key: 'capacity', label: 'Capacity', className: 'text-right' }, { key: 'flight_count', label: 'Flights', className: 'text-right' }]}
        fields={[{ name: 'model_number', label: 'Model', required: true, placeholder: 'A320neo' }, { name: 'capacity', label: 'Capacity', type: 'number', min: 80, required: true, hint: 'At least 80 (seat inventory per flight)' },
          { name: 'airline_id', label: 'Airline', type: 'select', required: true, span: true, options: (l) => l.airlines.map((a) => [a.airline_id, a.airline_name]) }]} />
    </div>
  );
}

export function PassengersAdmin() {
  return (
    <CrudPage resource="passengers" idKey="passenger_id" title="Passengers" singular="Passenger"
      description="Email is unique per passenger. Passengers with bookings cannot be deleted (foreign key)."
      searchKeys={['full_name', 'email', 'phone', 'username']}
      filters={[{ key: 'acct', label: 'Account', options: [['yes', 'Registered'], ['no', 'Guest']], test: (r, v) => (v === 'yes') === !!r.username }]}
      columns={[
        { key: 'passenger_id', label: 'ID' }, { key: 'full_name', label: 'Name', render: (r) => <span className="font-medium">{r.full_name}</span> },
        { key: 'email', label: 'Email' }, { key: 'phone', label: 'Phone' },
        { key: 'username', label: 'Account', render: (r) => (r.username ? <span className="font-mono text-xs">{r.username}</span> : <span className="text-ink-400">Guest</span>) },
        { key: 'booking_count', label: 'Bookings', className: 'text-right' },
      ]}
      fields={[{ name: 'full_name', label: 'Full name', required: true, span: true }, { name: 'email', label: 'Email', type: 'email', required: true }, { name: 'phone', label: 'Phone' }, { name: 'address', label: 'Address', span: true }]} />
  );
}

const loadBookings = () => adminService.list('bookings');
const loadPayments = () => adminService.list('payments');

function useList(loader) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const load = useCallback(() => { setLoading(true); setError(null); loader().then(setRows).catch((e) => setError(e.message)).finally(() => setLoading(false)); }, [loader]);
  useEffect(() => { load(); }, [load]);
  return { rows, setRows, loading, error, load };
}

function CancelDialog({ target, onClose, onDone, verb = 'Cancel booking' }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { const b = await adminService.cancelBooking(target.booking_id); toast(`Booking ${b.reference} cancelled · payment ${b.payment_status.toLowerCase()}.`); onDone(); }
    catch (e) { toast(e.message, 'error'); } finally { setBusy(false); onClose(); }
  };
  return (
    <Modal open={!!target} onClose={onClose} title={`${verb}?`} footer={<><Button variant="secondary" onClick={onClose}>Back</Button><Button variant="danger" loading={busy} onClick={run}>{verb}</Button></>}>
      {target && <p className="text-sm text-ink-700">Booking #{target.booking_id} ({target.full_name}, {target.flight_number}, seat {target.seat_number}) will be set to <b>Cancelled</b>. A paid payment becomes <b>Refunded</b> and the seat is released.</p>}
    </Modal>
  );
}

export function BookingsAdmin() {
  const { rows, loading, error, load } = useList(loadBookings);
  const [target, setTarget] = useState(null);
  const data = useMemo(() => rows.map((r) => ({ ...r, id: r.booking_id })), [rows]);
  return (
    <>
      <Header title="Bookings" text="Bookings are never deleted — cancelling keeps the history and frees the seat automatically (no stored seat status)." />
      {error && <Alert tone="error" className="mb-4" onRetry={load}>{error}</Alert>}
      <DataTable rows={data} loading={loading} searchKeys={['reference', 'full_name', 'email', 'flight_number', 'seat_number', 'ticket_number']}
        filters={[{ key: 'status', label: 'Booking', options: ['Confirmed', 'Pending', 'Cancelled'].map((s) => [s, s]), test: (r, v) => r.status === v },
          { key: 'pay', label: 'Payment', options: ['Paid', 'Pending', 'Failed', 'Refunded'].map((s) => [s, s]), test: (r, v) => r.payment_status === v }]}
        columns={[
          { key: 'reference', label: 'Reference', sortValue: (r) => r.booking_id, render: (r) => <span className="font-mono font-semibold">{r.reference}</span> },
          { key: 'full_name', label: 'Passenger', render: (r) => <span>{r.full_name}<span className="block text-xs text-ink-500">{r.email}</span></span> },
          { key: 'flight_number', label: 'Flight', render: (r) => <span>{r.flight_number}<span className="block text-xs text-ink-500">{r.src_code}→{r.dest_code} · {fmtDateTime(r.dep_datetime)}</span></span> },
          { key: 'seat_number', label: 'Seat', render: (r) => `${r.seat_number} · ${r.seat_class}` },
          { key: 'amount', label: 'Amount', render: (r) => inr(r.amount, true) },
          { key: 'status', label: 'Booking', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'payment_status', label: 'Payment', render: (r) => <StatusBadge status={r.payment_status} /> },
        ]}
        actions={(r) => (r.status !== 'Cancelled' && !r.departed ? <Button size="sm" variant="danger-ghost" onClick={() => setTarget(r)}>Cancel</Button> : <span className="text-xs text-ink-400">—</span>)} />
      <CancelDialog target={target} onClose={() => setTarget(null)} onDone={load} />
    </>
  );
}

export function PaymentsAdmin() {
  const { rows, loading, error, load } = useList(loadPayments);
  const [target, setTarget] = useState(null);
  const data = useMemo(() => rows.map((r) => ({ ...r, id: r.payment_id })), [rows]);
  const sum = (s) => data.filter((r) => r.payment_status === s).reduce((a, r) => a + r.amount, 0);
  return (
    <>
      <Header title="Payments" text="One PAYMENT row per booking. Status moves Pending → Paid (or Failed) at checkout, and Paid → Refunded on cancellation." />
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        {['Paid', 'Pending', 'Refunded', 'Failed'].map((s) => (
          <div key={s} className="panel p-4"><StatusBadge status={s} /><p className="mt-2 text-xl font-bold tabular-nums">{inr(sum(s))}</p><p className="text-xs text-ink-500">{data.filter((r) => r.payment_status === s).length} payments</p></div>
        ))}
      </div>
      {error && <Alert tone="error" className="mb-4" onRetry={load}>{error}</Alert>}
      <DataTable rows={data} loading={loading} searchKeys={['payment_id', 'booking_id', 'full_name', 'flight_number', 'payment_method']}
        filters={[{ key: 'st', label: 'Status', options: ['Paid', 'Pending', 'Failed', 'Refunded'].map((s) => [s, s]), test: (r, v) => r.payment_status === v },
          { key: 'm', label: 'Method', options: ['Card', 'UPI', 'NetBanking', 'Wallet'].map((s) => [s, s]), test: (r, v) => r.payment_method === v }]}
        columns={[
          { key: 'payment_id', label: 'Payment #' }, { key: 'booking_id', label: 'Booking #' },
          { key: 'full_name', label: 'Passenger' }, { key: 'flight_number', label: 'Flight', render: (r) => `${r.flight_number} · ${r.seat_number}` },
          { key: 'amount', label: 'Amount', render: (r) => <span className="font-semibold tabular-nums">{inr(r.amount, true)}</span> },
          { key: 'payment_method', label: 'Method', render: (r) => r.payment_method || '—' },
          { key: 'payment_date', label: 'Date', render: (r) => fmtDateTime(r.payment_date) },
          { key: 'payment_status', label: 'Status', render: (r) => <StatusBadge status={r.payment_status} /> },
        ]}
        actions={(r) => (r.payment_status === 'Paid' && r.booking_status === 'Confirmed' && r.dep_datetime > fmtNow() ? <Button size="sm" variant="ghost" onClick={() => setTarget(r)}>Refund</Button> : <span className="text-xs text-ink-400">—</span>)} />
      <CancelDialog target={target} onClose={() => setTarget(null)} onDone={load} verb="Refund & cancel" />
    </>
  );
}

function fmtNow() { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:00`; }
