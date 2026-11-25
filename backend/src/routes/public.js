import { Router } from 'express';
import { q, tx } from '../db.js';
import { FLIGHT_SELECT, mapFlight, bookingDetails, cancelBooking } from '../queries.js';
import {
  HttpError, now, amountFor, fromRef, ticketNumber, sha256, signToken, requireAuth,
  isEmail, isPhone, ids, PAYMENT_METHODS, TAX_RATE, BUSINESS_MULTIPLIER,
} from '../utils.js';

const r = Router();
const CITY_OF = '(SELECT city_id FROM AIRPORT WHERE iata_code = ?)';
const addDays = (d, n) => { const x = new Date(`${d}T00:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

r.get('/config', (_req, res) => res.json({ tax_rate: TAX_RATE, business_multiplier: BUSINESS_MULTIPLIER, payment_methods: PAYMENT_METHODS }));

r.get('/airports', async (_req, res) => {
  res.json(await q(`SELECT a.airport_id, a.iata_code, a.airport_name, c.city_name, c.country
                    FROM AIRPORT a JOIN CITY c ON c.city_id = a.city_id ORDER BY c.country <> 'India', c.city_name, a.iata_code`));
});

// Popular routes for the home page: upcoming flight count and lowest fare per route
r.get('/flights/popular', async (_req, res) => {
  res.json(await q(`SELECT sa.iata_code AS src_code, sc.city_name AS src_city, da.iata_code AS dest_code, dc.city_name AS dest_city,
                           dc.country AS dest_country, COUNT(*) AS flights, MIN(f.base_fare) AS min_fare
                    FROM FLIGHT f JOIN AIRPORT sa ON sa.airport_id = f.src_airport_id JOIN CITY sc ON sc.city_id = sa.city_id
                    JOIN AIRPORT da ON da.airport_id = f.dest_airport_id JOIN CITY dc ON dc.city_id = da.city_id
                    WHERE f.dep_datetime > ?
                    GROUP BY sa.iata_code, sc.city_name, da.iata_code, dc.city_name, dc.country
                    ORDER BY flights DESC, min_fare LIMIT 24`, [now()]));
});

// Requirement 4 & 7: search by source, destination (any airport in the city) and date, with seat availability
r.get('/flights/search', async (req, res) => {
  const { from, to, date } = req.query;
  if (!from || !to || !/^\d{4}-\d{2}-\d{2}$/.test(date || '')) throw new HttpError(400, 'from, to and date (YYYY-MM-DD) are required.');
  const t = now();
  const flights = await q(`${FLIGHT_SELECT}
      WHERE sa.city_id = ${CITY_OF} AND da.city_id = ${CITY_OF}
        AND f.dep_datetime >= ? AND f.dep_datetime < ? AND f.dep_datetime > ?
      ORDER BY f.dep_datetime`, [from, to, date, addDays(date, 1), t]);
  const nearby = await q(`SELECT DATE(f.dep_datetime) AS date, COUNT(*) AS flights, MIN(f.base_fare) AS min_fare
      FROM FLIGHT f JOIN AIRPORT sa ON sa.airport_id = f.src_airport_id JOIN AIRPORT da ON da.airport_id = f.dest_airport_id
      WHERE sa.city_id = ${CITY_OF} AND da.city_id = ${CITY_OF}
        AND f.dep_datetime >= ? AND f.dep_datetime < ? AND f.dep_datetime > ?
      GROUP BY DATE(f.dep_datetime) ORDER BY date`, [from, to, addDays(date, -3), addDays(date, 4), t]);
  res.json({ flights: flights.map(mapFlight), nearby });
});

r.get('/flights/:id', async (req, res) => {
  const [flight] = await q(`${FLIGHT_SELECT} WHERE f.flight_id = ?`, [req.params.id]);
  if (!flight) throw new HttpError(404, 'Flight not found.');
  const seats = await q(`SELECT s.seat_id, s.seat_number, s.seat_class,
        CASE WHEN EXISTS (SELECT 1 FROM BOOKING b WHERE b.seat_id = s.seat_id AND b.status IN ('Confirmed','Pending')) THEN 0 ELSE 1 END AS available
      FROM SEAT s WHERE s.flight_id = ? ORDER BY s.seat_id`, [req.params.id]);
  res.json({ ...mapFlight(flight), seats: seats.map((s) => ({ ...s, available: !!s.available })) });
});

// Requirements 5, 8, 9, 10: create Pending bookings (one per passenger per flight) + Pending payment rows
r.post('/bookings', async (req, res) => {
  const { cabin = 'Economy', passengers = [], legs = [] } = req.body || {};
  if (!['Economy', 'Business'].includes(cabin)) throw new HttpError(400, 'Invalid cabin class.');
  if (!Array.isArray(passengers) || passengers.length < 1 || passengers.length > 6) throw new HttpError(400, 'Between 1 and 6 passengers are allowed.');
  if (!Array.isArray(legs) || legs.length < 1 || legs.length > 2) throw new HttpError(400, 'A booking must contain one or two flights.');
  const emails = new Set();
  passengers.forEach((p, i) => {
    if (!p || String(p.full_name || '').trim().length < 2) throw new HttpError(400, `Passenger ${i + 1}: full name is required.`);
    if (!isEmail(p.email)) throw new HttpError(400, `Passenger ${i + 1}: a valid email is required.`);
    if (!isPhone(p.phone)) throw new HttpError(400, `Passenger ${i + 1}: a valid phone number is required.`);
    const e = p.email.trim().toLowerCase();
    if (emails.has(e)) throw new HttpError(400, 'Each passenger needs a different email address.');
    emails.add(e);
  });

  const bookingIds = await tx(async (x) => {
    const t = now();
    const legSeats = [];
    for (const leg of legs) {
      const seatIds = ids(leg.seat_ids);
      const [f] = await x('SELECT flight_id, flight_number, dep_datetime, base_fare FROM FLIGHT WHERE flight_id = ?', [leg.flight_id]);
      if (!f) throw new HttpError(404, 'Selected flight does not exist.');
      if (f.dep_datetime <= t) throw new HttpError(400, `Flight ${f.flight_number} has already departed.`);
      if (seatIds.length !== passengers.length || new Set(seatIds).size !== seatIds.length)
        throw new HttpError(400, `Choose one different seat per passenger on ${f.flight_number}.`);
      const seats = await x('SELECT seat_id, seat_class FROM SEAT WHERE flight_id = ? AND seat_id IN (?)', [f.flight_id, seatIds]);
      if (seats.length !== seatIds.length) throw new HttpError(400, 'One or more seats do not belong to this flight.');
      if (seats.some((s) => s.seat_class !== cabin)) throw new HttpError(400, `All seats must be in ${cabin} class.`);
      legSeats.push({ f, seatIds });
    }
    const created = [];
    for (const [i, p] of passengers.entries()) {
      const email = p.email.trim().toLowerCase();
      const [existing] = await x('SELECT passenger_id FROM PASSENGER WHERE email = ?', [email]);
      let pid = existing?.passenger_id;
      if (pid) await x('UPDATE PASSENGER SET full_name = ?, phone = ?, address = COALESCE(?, address) WHERE passenger_id = ?', [p.full_name.trim(), p.phone.trim(), p.address?.trim() || null, pid]);
      else pid = (await x('INSERT INTO PASSENGER (full_name, email, phone, address) VALUES (?, ?, ?, ?)', [p.full_name.trim(), email, p.phone.trim(), p.address?.trim() || null])).insertId;
      for (const { f, seatIds } of legSeats) {
        let bid;
        try {
          bid = (await x(`INSERT INTO BOOKING (booking_date, status, passenger_id, seat_id) VALUES (?, 'Pending', ?, ?)`, [t, pid, seatIds[i]])).insertId;
        } catch (e) {
          if (e.code === 'ER_DUP_ENTRY') throw new HttpError(409, `A seat you selected on ${f.flight_number} was just taken. Please choose another seat.`);
          throw e;
        }
        await x(`INSERT INTO PAYMENT (amount, payment_date, payment_method, payment_status, booking_id) VALUES (?, ?, NULL, 'Pending', ?)`, [amountFor(f.base_fare, cabin), t, bid]);
        created.push(bid);
      }
    }
    return created;
  });
  res.status(201).json({ booking_ids: bookingIds, bookings: await bookingDetails('b.booking_id IN (?)', [bookingIds], 'b.booking_id') });
});

// Pending bookings awaiting payment (used by the payment page after a refresh)
r.get('/bookings/pending', async (req, res) => {
  const list = ids(String(req.query.ids || '').split(','));
  if (!list.length) throw new HttpError(400, 'ids are required.');
  res.json(await bookingDetails(`b.booking_id IN (?) AND b.status = 'Pending'`, [list], 'b.booking_id'));
});

// Simulated payment. Booking becomes Confirmed and a TICKET is issued only after payment succeeds.
r.post('/payments', async (req, res) => {
  const { booking_ids, method, simulate_failure } = req.body || {};
  const list = ids(booking_ids);
  if (!list.length) throw new HttpError(400, 'No bookings to pay for.');
  if (!PAYMENT_METHODS.includes(method)) throw new HttpError(400, 'Choose a valid payment method.');
  const outcome = await tx(async (x) => {
    const rows = await x(`SELECT b.booking_id, b.status, f.flight_number, f.dep_datetime FROM BOOKING b
                          JOIN SEAT s ON s.seat_id = b.seat_id JOIN FLIGHT f ON f.flight_id = s.flight_id WHERE b.booking_id IN (?)`, [list]);
    if (rows.length !== list.length) throw new HttpError(404, 'One or more bookings were not found.');
    if (rows.some((b) => b.status !== 'Pending')) throw new HttpError(409, 'These bookings are no longer awaiting payment.');
    const t = now();
    if (rows.some((b) => b.dep_datetime <= t)) throw new HttpError(400, 'The flight has already departed.');
    if (simulate_failure) {
      await x(`UPDATE PAYMENT SET payment_status = 'Failed', payment_method = ?, payment_date = ? WHERE booking_id IN (?)`, [method, t, list]);
      return 'failed';
    }
    await x(`UPDATE PAYMENT SET payment_status = 'Paid', payment_method = ?, payment_date = ? WHERE booking_id IN (?)`, [method, t, list]);
    await x(`UPDATE BOOKING SET status = 'Confirmed' WHERE booking_id IN (?)`, [list]);
    for (const b of rows) await x('INSERT INTO TICKET (ticket_number, issue_date, booking_id) VALUES (?, ?, ?)', [ticketNumber(b.flight_number, b.booking_id), t, b.booking_id]);
    return 'paid';
  });
  if (outcome === 'failed') throw new HttpError(402, 'Payment was declined by the bank (simulated). Your seats are still held - you can try again.');
  res.json({ status: 'Paid', bookings: await bookingDetails('b.booking_id IN (?)', [list], 'b.booking_id') });
});

// Requirement 11: guest lookup needs booking reference + passenger email
r.get('/bookings/lookup', async (req, res) => {
  const id = fromRef(req.query.ref);
  if (!id || !isEmail(req.query.email)) throw new HttpError(400, 'Enter your booking reference and email.');
  const rows = await bookingDetails('b.booking_id = ? AND LOWER(p.email) = LOWER(?)', [id, req.query.email.trim()]);
  if (!rows.length) throw new HttpError(404, 'No booking matches that reference and email.');
  res.json(rows);
});

r.get('/bookings/mine', requireAuth, async (req, res) => {
  res.json(await bookingDetails('p.user_id = ?', [req.user.user_id]));
});

r.post('/bookings/:id/cancel', async (req, res) => {
  const id = Number(req.params.id);
  const [owner] = await q('SELECT p.email, p.user_id FROM BOOKING b JOIN PASSENGER p ON p.passenger_id = b.passenger_id WHERE b.booking_id = ?', [id]);
  if (!owner) throw new HttpError(404, 'Booking not found.');
  const u = req.user;
  const allowed = u?.role === 'Admin' || (u && owner.user_id === u.user_id) || String(req.body?.email || '').trim().toLowerCase() === owner.email.toLowerCase();
  if (!allowed) throw new HttpError(403, 'You are not allowed to cancel this booking.');
  res.json(await cancelBooking(id));
});

// Requirement 16: login; role is derived (Admin if a row exists in ADMIN)
const USER_SQL = `SELECT u.user_id, u.username, u.password_hash, a.admin_id, a.admin_name,
                         p.passenger_id, p.full_name, p.email, p.phone, p.address,
                         CASE WHEN a.admin_id IS NOT NULL THEN 'Admin' ELSE 'Passenger' END AS role
                  FROM USER_ACCOUNT u LEFT JOIN ADMIN a ON a.user_id = u.user_id LEFT JOIN PASSENGER p ON p.user_id = u.user_id`;
const session = (u) => {
  const user = { user_id: u.user_id, username: u.username, role: u.role, name: u.admin_name || u.full_name || u.username,
    passenger_id: u.passenger_id, email: u.email, phone: u.phone, address: u.address };
  return { token: signToken({ user_id: u.user_id, role: u.role }), user };
};

r.post('/auth/login', async (req, res) => {
  const { username, password } = req.body || {};
  const [u] = await q(`${USER_SQL} WHERE u.username = ?`, [String(username || '').trim()]);
  if (!u || u.password_hash !== sha256(password || '')) throw new HttpError(401, 'Incorrect username or password.');
  res.json(session(u));
});

r.post('/auth/register', async (req, res) => {
  const { username, password, full_name, email, phone } = req.body || {};
  if (!/^[a-zA-Z0-9_.]{3,30}$/.test(username || '')) throw new HttpError(400, 'Username must be 3-30 letters, numbers, dots or underscores.');
  if (String(password || '').length < 6) throw new HttpError(400, 'Password must be at least 6 characters.');
  if (String(full_name || '').trim().length < 2) throw new HttpError(400, 'Full name is required.');
  if (!isEmail(email)) throw new HttpError(400, 'A valid email is required.');
  if (phone && !isPhone(phone)) throw new HttpError(400, 'Phone number is not valid.');
  const userId = await tx(async (x) => {
    if ((await x('SELECT 1 FROM USER_ACCOUNT WHERE username = ?', [username])).length) throw new HttpError(409, 'That username is already taken.');
    const mail = email.trim().toLowerCase();
    const [p] = await x('SELECT passenger_id, user_id FROM PASSENGER WHERE email = ?', [mail]);
    if (p?.user_id) throw new HttpError(409, 'An account already exists for this email.');
    const uid = (await x('INSERT INTO USER_ACCOUNT (username, password_hash) VALUES (?, ?)', [username, sha256(password)])).insertId;
    if (p) await x('UPDATE PASSENGER SET user_id = ?, full_name = ?, phone = COALESCE(?, phone) WHERE passenger_id = ?', [uid, full_name.trim(), phone || null, p.passenger_id]);
    else await x('INSERT INTO PASSENGER (user_id, full_name, email, phone) VALUES (?, ?, ?, ?)', [uid, full_name.trim(), mail, phone || null]);
    return uid;
  });
  const [u] = await q(`${USER_SQL} WHERE u.user_id = ?`, [userId]);
  res.status(201).json(session(u));
});

export default r;
