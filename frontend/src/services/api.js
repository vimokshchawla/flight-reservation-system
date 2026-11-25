// Service layer. This build runs entirely in the browser: the sample database (same 12-table schema and data as
// database/sqlite) ships in data-seed.json and every change is saved in localStorage. The function names and the
// shapes they return are the same as the Express API, so a real backend can be plugged back in here later.
import SEED from '../data-seed.json';

export const SESSION_KEY = 'frs_session';
const DB_KEY = 'frs_db_v3';
const TAX_RATE = 0.12, BUSINESS = 2.5, METHODS = ['Card', 'UPI', 'NetBanking', 'Wallet'];

// ---------- tiny table store ----------
const COLS = {
  airlines: ['airline_id', 'airline_name', 'contact_info'], cities: ['city_id', 'city_name', 'country'],
  airports: ['airport_id', 'iata_code', 'airport_name', 'city_id'], aircraft: ['aircraft_id', 'model_number', 'capacity', 'airline_id'],
  flights: ['flight_id', 'flight_number', 'dep_datetime', 'arr_datetime', 'base_fare', 'aircraft_id', 'src_airport_id', 'dest_airport_id'],
  users: ['user_id', 'username', 'password_hash'], passengers: ['passenger_id', 'user_id', 'full_name', 'email', 'phone', 'address'],
  admins: ['admin_id', 'user_id', 'admin_name'], bookings: ['booking_id', 'booking_date', 'status', 'passenger_id', 'seat_id'],
  tickets: ['ticket_id', 'ticket_number', 'issue_date', 'booking_id'], payments: ['payment_id', 'amount', 'payment_date', 'payment_method', 'payment_status', 'booking_id'],
};
// Stored compactly as arrays (same layout as data-seed.json) to stay well inside the browser's ~5 MB limit
const fromRows = (data) => Object.fromEntries(Object.entries(COLS).map(([t, cols]) => [t, data[t].map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])))]));
const toRows = () => Object.fromEntries(Object.entries(COLS).map(([t, cols]) => [t, db[t].map((r) => cols.map((c) => r[c]))]));
function load() {
  try { const s = JSON.parse(localStorage.getItem(DB_KEY)); if (s?.flights) return fromRows(s); } catch { /* fresh */ }
  return fromRows(SEED);
}
let db = load();
const save = () => { try { localStorage.setItem(DB_KEY, JSON.stringify(toRows())); } catch { /* storage full: keep in memory */ } };
const nextId = (t, k) => db[t].reduce((m, r) => Math.max(m, r[k]), 0) + 1;
export const resetDatabase = () => { localStorage.removeItem(DB_KEY); db = load(); };

// ---------- helpers ----------
const fail = (status, message) => { throw Object.assign(new Error(message), { status }); };
const pad = (n) => String(n).padStart(2, '0');
const now = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const mins = (a, b) => Math.round((Date.parse(b.replace(' ', 'T')) - Date.parse(a.replace(' ', 'T'))) / 60000);
const r2 = (n) => Math.round(n * 100) / 100;
const fare = (base, cls) => r2(base * (cls === 'Business' ? BUSINESS : 1));
const amount = (base, cls) => r2(fare(base, cls) * (1 + TAX_RATE));
const toRef = (id) => `FRS${String(id).padStart(6, '0')}`;
const fromRef = (ref) => { const m = String(ref || '').trim().toUpperCase().match(/^(?:FRS)?0*(\d{1,9})$/); return m ? Number(m[1]) : null; };
const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || ''));
const isPhone = (s) => /^\+?[0-9\s-]{10,15}$/.test(String(s || ''));
const delay = (v) => new Promise((res) => setTimeout(() => res(structuredClone(v)), 120));
async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Seat inventory: rows 1-2 Business (A C D F), rows 3-14 Economy (A-F). seat_id = (flight_id-1)*80 + position.
const LAYOUT = [];
for (let r = 1; r <= 14; r++) for (const c of 'ABCDEF') if (r > 2 || 'ACDF'.includes(c)) LAYOUT.push([`${r}${c}`, r <= 2 ? 'Business' : 'Economy']);
const seatsOf = (fid) => LAYOUT.map(([n, c], i) => ({ seat_id: (fid - 1) * 80 + i + 1, flight_id: fid, seat_number: n, seat_class: c }));
const seatById = (id) => { const fid = Math.floor((id - 1) / 80) + 1, i = (id - 1) % 80; return db.flights.some((f) => f.flight_id === fid) ? seatsOf(fid)[i] : null; };
const activeSeats = () => new Set(db.bookings.filter((b) => b.status !== 'Cancelled').map((b) => b.seat_id));
const BUS_SLOTS = 8; // positions 1-8 in the layout are Business
function takenCounts(set) {
  const m = new Map();
  for (const id of set) {
    const fid = Math.floor((id - 1) / 80) + 1, cls = (id - 1) % 80 < BUS_SLOTS ? 'b' : 'e';
    const r = m.get(fid) || { e: 0, b: 0 }; r[cls]++; m.set(fid, r);
  }
  return m;
}
let countCache = { set: null, map: null };
const countsFor = (set) => (countCache.set === set ? countCache.map : (countCache = { set, map: takenCounts(set) }).map);

const by = (t, k, v) => db[t].find((r) => r[k] === v);
const airportFull = (id) => { const a = by('airports', 'airport_id', id); const c = by('cities', 'city_id', a.city_id); return { ...a, city_name: c.city_name, country: c.country }; };
function flightFull(f, taken = activeSeats()) {
  const ac = by('aircraft', 'aircraft_id', f.aircraft_id), al = by('airlines', 'airline_id', ac.airline_id);
  const s = airportFull(f.src_airport_id), d = airportFull(f.dest_airport_id);
  const c = countsFor(taken).get(f.flight_id) || { e: 0, b: 0 };
  return { ...f, airline_id: al.airline_id, airline_name: al.airline_name, model_number: ac.model_number,
    src_code: s.iata_code, src_name: s.airport_name, src_city: s.city_name, dest_code: d.iata_code, dest_name: d.airport_name, dest_city: d.city_name,
    eco_available: 72 - c.e, bus_available: BUS_SLOTS - c.b, duration_min: mins(f.dep_datetime, f.arr_datetime),
    economy_fare: fare(f.base_fare, 'Economy'), business_fare: fare(f.base_fare, 'Business'), departed: f.dep_datetime <= now() };
}
function bookingFull(b) {
  const s = seatById(b.seat_id), p = by('passengers', 'passenger_id', b.passenger_id), f = flightFull(by('flights', 'flight_id', s.flight_id), new Set());
  const t = by('tickets', 'booking_id', b.booking_id), pay = by('payments', 'booking_id', b.booking_id);
  return { ...b, reference: toRef(b.booking_id), passenger_id: p.passenger_id, full_name: p.full_name, email: p.email, phone: p.phone,
    seat_number: s.seat_number, seat_class: s.seat_class, flight_id: f.flight_id, flight_number: f.flight_number, dep_datetime: f.dep_datetime,
    arr_datetime: f.arr_datetime, airline_id: f.airline_id, airline_name: f.airline_name, model_number: f.model_number,
    src_code: f.src_code, src_name: f.src_name, src_city: f.src_city, dest_code: f.dest_code, dest_name: f.dest_name, dest_city: f.dest_city,
    ticket_number: t?.ticket_number ?? null, issue_date: t?.issue_date ?? null, payment_id: pay?.payment_id ?? null, amount: pay?.amount ?? null,
    payment_method: pay?.payment_method ?? null, payment_status: pay?.payment_status ?? null, payment_date: pay?.payment_date ?? null,
    duration_min: f.duration_min, departed: f.departed };
}
const details = (list) => list.map(bookingFull).sort((a, b) => (a.dep_datetime < b.dep_datetime ? 1 : -1) || a.booking_id - b.booking_id);
const cityOf = (code) => by('airports', 'iata_code', code)?.city_id;
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const session = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY))?.user || null; } catch { return null; } };

function cancel(id) {
  const b = by('bookings', 'booking_id', id);
  if (!b) fail(404, 'Booking not found.');
  if (b.status === 'Cancelled') fail(409, 'This booking is already cancelled.');
  if (bookingFull(b).departed) fail(400, 'This flight has already departed and cannot be cancelled.');
  b.status = 'Cancelled';
  const pay = by('payments', 'booking_id', id);
  if (pay && ['Paid', 'Pending'].includes(pay.payment_status)) pay.payment_status = pay.payment_status === 'Paid' ? 'Refunded' : 'Failed';
  save();
  return bookingFull(b);
}

// ---------- services ----------
export const flightService = {
  config: () => delay({ tax_rate: TAX_RATE, business_multiplier: BUSINESS, payment_methods: METHODS }),
  airports: () => delay(db.airports.map((a) => airportFull(a.airport_id)).sort((x, y) => (x.country !== 'India') - (y.country !== 'India') || x.city_name.localeCompare(y.city_name))),
  popular: () => {
    const t = now(), m = new Map();
    db.flights.filter((f) => f.dep_datetime > t).forEach((f) => {
      const s = airportFull(f.src_airport_id), d = airportFull(f.dest_airport_id), k = `${s.iata_code}-${d.iata_code}`;
      const r = m.get(k) || { src_code: s.iata_code, src_city: s.city_name, dest_code: d.iata_code, dest_city: d.city_name, dest_country: d.country, flights: 0, min_fare: Infinity };
      r.flights++; r.min_fare = Math.min(r.min_fare, f.base_fare); m.set(k, r);
    });
    return delay([...m.values()].sort((a, b) => b.flights - a.flights || a.min_fare - b.min_fare).slice(0, 24));
  },
  search: ({ from, to, date }) => {
    if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return Promise.reject(Object.assign(new Error('from, to and date are required.'), { status: 400 }));
    const sc = cityOf(from), dc = cityOf(to), t = now(), taken = activeSeats();
    const route = db.flights.filter((f) => by('airports', 'airport_id', f.src_airport_id).city_id === sc && by('airports', 'airport_id', f.dest_airport_id).city_id === dc && f.dep_datetime > t);
    const flights = route.filter((f) => f.dep_datetime.slice(0, 10) === date).sort((a, b) => (a.dep_datetime < b.dep_datetime ? -1 : 1)).map((f) => flightFull(f, taken));
    const lo = addDays(date, -3), hi = addDays(date, 3), m = new Map();
    route.filter((f) => f.dep_datetime.slice(0, 10) >= lo && f.dep_datetime.slice(0, 10) <= hi).forEach((f) => {
      const d = f.dep_datetime.slice(0, 10), r = m.get(d) || { date: d, flights: 0, min_fare: Infinity }; r.flights++; r.min_fare = Math.min(r.min_fare, f.base_fare); m.set(d, r);
    });
    return delay({ flights, nearby: [...m.values()].sort((a, b) => (a.date < b.date ? -1 : 1)) });
  },
  get: async (id) => {
    const f = by('flights', 'flight_id', Number(id));
    if (!f) fail(404, 'Flight not found.');
    const taken = activeSeats();
    return delay({ ...flightFull(f, taken), seats: seatsOf(f.flight_id).map((s) => ({ ...s, available: !taken.has(s.seat_id) })) });
  },
};

export const bookingService = {
  create: async ({ cabin = 'Economy', passengers = [], legs = [] }) => {
    if (passengers.length < 1 || passengers.length > 6) fail(400, 'Between 1 and 6 passengers are allowed.');
    const emails = new Set();
    passengers.forEach((p, i) => {
      if (String(p.full_name || '').trim().length < 2) fail(400, `Passenger ${i + 1}: full name is required.`);
      if (!isEmail(p.email)) fail(400, `Passenger ${i + 1}: a valid email is required.`);
      if (!isPhone(p.phone)) fail(400, `Passenger ${i + 1}: a valid phone number is required.`);
      const e = p.email.trim().toLowerCase(); if (emails.has(e)) fail(400, 'Each passenger needs a different email address.'); emails.add(e);
    });
    const t = now(), taken = activeSeats();
    const checked = legs.map((leg) => {
      const f = by('flights', 'flight_id', leg.flight_id);
      if (!f) fail(404, 'Selected flight does not exist.');
      if (f.dep_datetime <= t) fail(400, `Flight ${f.flight_number} has already departed.`);
      const ids = leg.seat_ids.map(Number);
      if (ids.length !== passengers.length || new Set(ids).size !== ids.length) fail(400, `Choose one different seat per passenger on ${f.flight_number}.`);
      ids.forEach((id) => {
        const s = seatById(id);
        if (!s || s.flight_id !== f.flight_id) fail(400, 'One or more seats do not belong to this flight.');
        if (s.seat_class !== cabin) fail(400, `All seats must be in ${cabin} class.`);
        if (taken.has(id)) fail(409, `A seat you selected on ${f.flight_number} was just taken. Please choose another seat.`);
      });
      return { f, ids };
    });
    const created = [];
    passengers.forEach((p, i) => {
      const email = p.email.trim().toLowerCase();
      let pas = by('passengers', 'email', email);
      if (pas) Object.assign(pas, { full_name: p.full_name.trim(), phone: p.phone.trim(), address: p.address?.trim() || pas.address });
      else db.passengers.push(pas = { passenger_id: nextId('passengers', 'passenger_id'), user_id: null, full_name: p.full_name.trim(), email, phone: p.phone.trim(), address: p.address?.trim() || null });
      checked.forEach(({ f, ids }) => {
        const bid = nextId('bookings', 'booking_id');
        db.bookings.push({ booking_id: bid, booking_date: t, status: 'Pending', passenger_id: pas.passenger_id, seat_id: ids[i] });
        db.payments.push({ payment_id: nextId('payments', 'payment_id'), amount: amount(f.base_fare, cabin), payment_date: t, payment_method: null, payment_status: 'Pending', booking_id: bid });
        created.push(bid);
      });
    });
    save();
    return delay({ booking_ids: created, bookings: created.map((id) => bookingFull(by('bookings', 'booking_id', id))) });
  },
  pending: (ids) => delay(ids.map((id) => by('bookings', 'booking_id', Number(id))).filter((b) => b?.status === 'Pending').map(bookingFull)),
  lookup: async (ref, email) => {
    const id = fromRef(ref);
    if (!id || !isEmail(email)) fail(400, 'Enter your booking reference and email.');
    const b = by('bookings', 'booking_id', id);
    if (!b || by('passengers', 'passenger_id', b.passenger_id).email.toLowerCase() !== email.trim().toLowerCase()) fail(404, 'No booking matches that reference and email.');
    return delay([bookingFull(b)]);
  },
  mine: async () => {
    const u = session(); if (!u) fail(401, 'Please sign in to continue.');
    const p = by('passengers', 'user_id', u.user_id);
    return delay(p ? details(db.bookings.filter((b) => b.passenger_id === p.passenger_id)) : []);
  },
  cancel: async (id, email) => {
    const b = by('bookings', 'booking_id', Number(id)); if (!b) fail(404, 'Booking not found.');
    const p = by('passengers', 'passenger_id', b.passenger_id), u = session();
    const ok = u?.role === 'Admin' || (u && p.user_id === u.user_id) || String(email || '').trim().toLowerCase() === p.email.toLowerCase();
    if (!ok) fail(403, 'You are not allowed to cancel this booking.');
    return delay(cancel(b.booking_id));
  },
};

export const paymentService = {
  pay: async ({ booking_ids, method, simulate_failure }) => {
    const list = booking_ids.map((id) => by('bookings', 'booking_id', Number(id)));
    if (!list.length || list.some((b) => !b)) fail(404, 'One or more bookings were not found.');
    if (!METHODS.includes(method)) fail(400, 'Choose a valid payment method.');
    if (list.some((b) => b.status !== 'Pending')) fail(409, 'These bookings are no longer awaiting payment.');
    const t = now();
    if (!simulate_failure) list.forEach((b) => Object.assign(by('payments', 'booking_id', b.booking_id), { payment_method: method, payment_date: t, payment_status: 'Paid' }));
    if (simulate_failure) {
      // Rollback (Error 2): remove the half-finished bookings and their payment rows; the seats become free again
      const ids = new Set(list.map((b) => b.booking_id));
      db.bookings = db.bookings.filter((b) => !ids.has(b.booking_id));
      db.payments = db.payments.filter((p) => !ids.has(p.booking_id));
      save();
      fail(402, 'Payment declined (simulated). The transaction was rolled back: no booking or payment was saved and the seats are free again.');
    }
    list.forEach((b) => {
      b.status = 'Confirmed';
      const f = by('flights', 'flight_id', seatById(b.seat_id).flight_id);
      db.tickets.push({ ticket_id: nextId('tickets', 'ticket_id'), ticket_number: `TKT-${f.flight_number}-${String(b.booking_id).padStart(5, '0')}`, issue_date: t, booking_id: b.booking_id });
    });
    save();
    return delay({ status: 'Paid', bookings: list.map(bookingFull) });
  },
};

function sessionFor(u) {
  const a = by('admins', 'user_id', u.user_id), p = by('passengers', 'user_id', u.user_id);
  const role = a ? 'Admin' : 'Passenger';
  return { token: `local-${u.user_id}`, user: { user_id: u.user_id, username: u.username, role, name: a?.admin_name || p?.full_name || u.username,
    passenger_id: p?.passenger_id, email: p?.email, phone: p?.phone, address: p?.address } };
}
export const authService = {
  login: async (username, password) => {
    const u = by('users', 'username', String(username || '').trim());
    if (!u || u.password_hash !== await sha256(password || '')) fail(401, 'Incorrect username or password.');
    return delay(sessionFor(u));
  },
  register: async ({ username, password, full_name, email, phone }) => {
    if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username || '')) fail(400, 'Username must be 3-30 letters, numbers, dots or underscores.');
    if (String(password || '').length < 6) fail(400, 'Password must be at least 6 characters.');
    if (!isEmail(email)) fail(400, 'A valid email is required.');
    if (by('users', 'username', username)) fail(409, 'That username is already taken.');
    const mail = email.trim().toLowerCase(), p = by('passengers', 'email', mail);
    if (p?.user_id) fail(409, 'An account already exists for this email.');
    const u = { user_id: nextId('users', 'user_id'), username, password_hash: await sha256(password) };
    db.users.push(u);
    if (p) Object.assign(p, { user_id: u.user_id, full_name: full_name.trim(), phone: phone || p.phone });
    else db.passengers.push({ passenger_id: nextId('passengers', 'passenger_id'), user_id: u.user_id, full_name: full_name.trim(), email: mail, phone: phone || null, address: null });
    save();
    return delay(sessionFor(u));
  },
};

// ---------- admin ----------
const requireAdmin = () => { if (session()?.role !== 'Admin') fail(403, 'Administrator access required.'); };
const str = (v, label, max, opt) => { const s = String(v ?? '').trim(); if (!s) { if (opt) return null; fail(400, `${label} is required.`); } if (s.length > max) fail(400, `${label} is too long.`); return s; };
const int = (v, label, min = 1) => { const n = Number(v); if (!Number.isInteger(n) || n < min) fail(400, `${label} must be a whole number of at least ${min}.`); return n; };
const dt = (v, label) => { const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/); if (!m) fail(400, `${label} must be a valid date and time.`); return `${m[1]} ${m[2]}:00`; };
const used = (pred) => db.bookings.some(pred);

const RES = {
  airlines: { t: 'airlines', pk: 'airline_id',
    list: () => db.airlines.map((a) => ({ ...a, aircraft_count: db.aircraft.filter((x) => x.airline_id === a.airline_id).length })),
    values: (b, id) => { const name = str(b.airline_name, 'Airline name', 100); if (db.airlines.some((a) => a.airline_name.toLowerCase() === name.toLowerCase() && a.airline_id !== id)) fail(409, 'An airline with that name already exists.'); return { airline_name: name, contact_info: str(b.contact_info, 'Contact', 150, true) }; },
    canDelete: (id) => db.aircraft.some((x) => x.airline_id === id) && fail(409, 'This airline owns aircraft and cannot be deleted.') },
  aircraft: { t: 'aircraft', pk: 'aircraft_id',
    list: () => db.aircraft.map((a) => ({ ...a, airline_name: by('airlines', 'airline_id', a.airline_id)?.airline_name, flight_count: db.flights.filter((f) => f.aircraft_id === a.aircraft_id).length })),
    values: (b) => { const v = { model_number: str(b.model_number, 'Model', 40), capacity: int(b.capacity, 'Capacity', 80), airline_id: int(b.airline_id, 'Airline') }; if (!by('airlines', 'airline_id', v.airline_id)) fail(400, 'Airline does not exist.'); return v; },
    canDelete: (id) => db.flights.some((f) => f.aircraft_id === id) && fail(409, 'This aircraft operates flights and cannot be deleted.') },
  airports: { t: 'airports', pk: 'airport_id',
    list: () => db.airports.map((a) => ({ ...airportFull(a.airport_id), flight_count: db.flights.filter((f) => f.src_airport_id === a.airport_id || f.dest_airport_id === a.airport_id).length })).sort((x, y) => x.iata_code.localeCompare(y.iata_code)),
    values: (b, id) => {
      const code = String(b.iata_code || '').trim().toUpperCase(); if (!/^[A-Z]{3}$/.test(code)) fail(400, 'IATA code must be 3 letters.');
      if (db.airports.some((a) => a.iata_code === code && a.airport_id !== id)) fail(409, 'That IATA code is already used.');
      const city = str(b.city_name, 'City', 80), country = str(b.country, 'Country', 80);
      let c = db.cities.find((x) => x.city_name.toLowerCase() === city.toLowerCase() && x.country.toLowerCase() === country.toLowerCase());
      if (!c) db.cities.push(c = { city_id: nextId('cities', 'city_id'), city_name: city, country });
      return { iata_code: code, airport_name: str(b.airport_name, 'Airport name', 120), city_id: c.city_id };
    },
    canDelete: (id) => db.flights.some((f) => f.src_airport_id === id || f.dest_airport_id === id) && fail(409, 'Flights use this airport, so it cannot be deleted.') },
  passengers: { t: 'passengers', pk: 'passenger_id',
    list: () => db.passengers.map((p) => ({ ...p, username: by('users', 'user_id', p.user_id)?.username ?? null, booking_count: db.bookings.filter((b) => b.passenger_id === p.passenger_id).length })),
    values: (b, id) => { if (!isEmail(b.email)) fail(400, 'Email must be valid.'); const email = b.email.trim().toLowerCase(); if (db.passengers.some((p) => p.email === email && p.passenger_id !== id)) fail(409, 'Another passenger already uses that email.'); return { full_name: str(b.full_name, 'Full name', 100), email, phone: str(b.phone, 'Phone', 20, true), address: str(b.address, 'Address', 255, true) }; },
    canDelete: (id) => used((b) => b.passenger_id === id) && fail(409, 'This passenger has bookings and cannot be deleted.') },
  flights: { t: 'flights', pk: 'flight_id',
    list: () => { const taken = activeSeats(); return db.flights.map((f) => flightFull(f, taken)).sort((a, b) => (a.dep_datetime < b.dep_datetime ? -1 : 1)); },
    values: (b, id) => {
      const v = { flight_number: str(b.flight_number, 'Flight number', 10).toUpperCase(), dep_datetime: dt(b.dep_datetime, 'Departure'), arr_datetime: dt(b.arr_datetime, 'Arrival'),
        base_fare: r2(Number(b.base_fare)), aircraft_id: int(b.aircraft_id, 'Aircraft'), src_airport_id: int(b.src_airport_id, 'Origin'), dest_airport_id: int(b.dest_airport_id, 'Destination') };
      if (!(v.base_fare > 0)) fail(400, 'Base fare must be greater than 0.');
      if (v.src_airport_id === v.dest_airport_id) fail(400, 'Origin and destination must be different airports.');
      if (v.arr_datetime <= v.dep_datetime) fail(400, 'Arrival must be after departure.');
      if (db.flights.some((f) => f.flight_number === v.flight_number && f.dep_datetime === v.dep_datetime && f.flight_id !== id)) fail(409, 'That flight number already departs at this time.');
      return v;
    },
    canDelete: (id) => { const n = db.bookings.filter((b) => seatById(b.seat_id)?.flight_id === id).length; if (n) fail(409, `This flight has ${n} booking(s) and cannot be deleted. Cancel or keep it instead.`); } },
};
const resource = (n) => RES[n] || fail(404, 'Unknown resource.');

export const adminService = {
  dashboard: async () => {
    requireAdmin();
    const t = now(), sum = (s) => r2(db.payments.filter((p) => p.payment_status === s).reduce((a, p) => a + p.amount, 0));
    const count = (s) => db.bookings.filter((b) => b.status === s).length;
    const conf = takenCounts(new Set(db.bookings.filter((b) => b.status === 'Confirmed').map((b) => b.seat_id)));
    const occ = db.flights.filter((f) => f.dep_datetime > t).map((f) => {
      const c = conf.get(f.flight_id) || { e: 0, b: 0 }, booked = c.e + c.b;
      return { flight_id: f.flight_id, flight_number: f.flight_number, dep_datetime: f.dep_datetime, src_code: airportFull(f.src_airport_id).iata_code, dest_code: airportFull(f.dest_airport_id).iata_code, total_seats: 80, booked_seats: booked, occupancy_pct: r2(booked * 100 / 80) };
    });
    const airline = new Map();
    db.payments.filter((p) => p.payment_status === 'Paid').forEach((p) => {
      const b = by('bookings', 'booking_id', p.booking_id), f = by('flights', 'flight_id', seatById(b.seat_id).flight_id);
      const name = by('airlines', 'airline_id', by('aircraft', 'aircraft_id', f.aircraft_id).airline_id).airline_name;
      const r = airline.get(name) || { airline_name: name, tickets: 0, revenue: 0 }; r.tickets++; r.revenue = r2(r.revenue + p.amount); airline.set(name, r);
    });
    const freq = new Map();
    db.bookings.filter((b) => b.status === 'Confirmed').forEach((b) => freq.set(b.passenger_id, (freq.get(b.passenger_id) || 0) + 1));
    return delay({
      totals: { flights: db.flights.length, upcoming_flights: occ.length, passengers: db.passengers.length, confirmed: count('Confirmed'), pending: count('Pending'), cancelled: count('Cancelled'), revenue: sum('Paid'), refunded: sum('Refunded') },
      nextFlights: occ.slice().sort((a, b) => (a.dep_datetime < b.dep_datetime ? -1 : 1)).slice(0, 8),
      topOccupancy: occ.slice().sort((a, b) => b.occupancy_pct - a.occupancy_pct || (a.dep_datetime < b.dep_datetime ? -1 : 1)).slice(0, 8),
      byAirline: [...airline.values()].sort((a, b) => b.revenue - a.revenue),
      frequent: [...freq.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([id, n]) => ({ passenger_id: id, full_name: by('passengers', 'passenger_id', id).full_name, total_bookings: n })),
      roles: db.users.map((u) => ({ username: u.username, role: by('admins', 'user_id', u.user_id) ? 'Admin' : 'Passenger' })).sort((a, b) => a.role.localeCompare(b.role) || a.username.localeCompare(b.username)),
      recent: db.bookings.slice().sort((a, b) => b.booking_id - a.booking_id).slice(0, 6).map(bookingFull),
    });
  },
  lookups: async () => {
    requireAdmin();
    return delay({
      airlines: db.airlines.map(({ airline_id, airline_name }) => ({ airline_id, airline_name })),
      aircraft: db.aircraft.map((a) => ({ ...a, airline_name: by('airlines', 'airline_id', a.airline_id).airline_name })),
      airports: db.airports.map((a) => airportFull(a.airport_id)).sort((x, y) => x.iata_code.localeCompare(y.iata_code)),
    });
  },
  list: async (name) => {
    requireAdmin();
    if (name === 'bookings') return delay(db.bookings.slice().sort((a, b) => b.booking_id - a.booking_id).map(bookingFull));
    if (name === 'payments') {
      return delay(db.payments.slice().sort((a, b) => b.payment_id - a.payment_id).map((p) => {
        const b = bookingFull(by('bookings', 'booking_id', p.booking_id));
        return { ...p, booking_status: b.status, full_name: b.full_name, email: b.email, flight_number: b.flight_number, dep_datetime: b.dep_datetime, seat_number: b.seat_number, seat_class: b.seat_class };
      }));
    }
    return delay(resource(name).list());
  },
  create: async (name, data) => {
    requireAdmin();
    const r = resource(name), v = r.values(data, null), id = nextId(r.t, r.pk);
    db[r.t].push({ [r.pk]: id, ...(name === 'passengers' ? { user_id: null } : {}), ...v });
    save();
    return delay({ id });
  },
  update: async (name, id, data) => {
    requireAdmin();
    const r = resource(name), row = by(r.t, r.pk, Number(id));
    if (!row) fail(404, 'Record not found.');
    Object.assign(row, r.values(data, Number(id)));
    save();
    return delay({ id: Number(id) });
  },
  remove: async (name, id) => {
    requireAdmin();
    const r = resource(name), n = Number(id);
    if (!by(r.t, r.pk, n)) fail(404, 'Record not found.');
    r.canDelete(n);
    db[r.t] = db[r.t].filter((x) => x[r.pk] !== n);
    save();
    return delay(null);
  },
  cancelBooking: async (id) => { requireAdmin(); return delay(cancel(Number(id))); },
};
