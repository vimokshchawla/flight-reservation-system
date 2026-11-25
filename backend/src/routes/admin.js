import { Router } from 'express';
import { q, tx } from '../db.js';
import { FLIGHT_SELECT, mapFlight, bookingDetails, cancelBooking } from '../queries.js';
import { HttpError, now, requireAdmin, isEmail, SEAT_LAYOUT } from '../utils.js';

const r = Router();
r.use(requireAdmin);

// ---------- Dashboard + SQL reports (Assignment-4, requirements 15 & 16) ----------
r.get('/dashboard', async (_req, res) => {
  const t = now();
  const [totals] = await q(`SELECT
      (SELECT COUNT(*) FROM FLIGHT) AS flights,
      (SELECT COUNT(*) FROM FLIGHT WHERE dep_datetime > ?) AS upcoming_flights,
      (SELECT COUNT(*) FROM PASSENGER) AS passengers,
      (SELECT COUNT(*) FROM BOOKING WHERE status = 'Confirmed') AS confirmed,
      (SELECT COUNT(*) FROM BOOKING WHERE status = 'Pending') AS pending,
      (SELECT COUNT(*) FROM BOOKING WHERE status = 'Cancelled') AS cancelled,
      (SELECT COALESCE(SUM(amount), 0) FROM PAYMENT WHERE payment_status = 'Paid') AS revenue,
      (SELECT COALESCE(SUM(amount), 0) FROM PAYMENT WHERE payment_status = 'Refunded') AS refunded`, [t]);
  const occupancySql = `SELECT f.flight_id, f.flight_number, f.dep_datetime, sa.iata_code AS src_code, da.iata_code AS dest_code,
        COUNT(s.seat_id) AS total_seats, COUNT(b.booking_id) AS booked_seats,
        ROUND(100.0 * COUNT(b.booking_id) / COUNT(s.seat_id), 1) AS occupancy_pct
      FROM FLIGHT f
      JOIN AIRPORT sa ON sa.airport_id = f.src_airport_id JOIN AIRPORT da ON da.airport_id = f.dest_airport_id
      JOIN SEAT s ON s.flight_id = f.flight_id
      LEFT JOIN BOOKING b ON b.seat_id = s.seat_id AND b.status = 'Confirmed'
      WHERE f.dep_datetime > ?
      GROUP BY f.flight_id, f.flight_number, f.dep_datetime, sa.iata_code, da.iata_code`;
  const nextFlights = await q(`${occupancySql} ORDER BY f.dep_datetime LIMIT 8`, [t]);
  const topOccupancy = await q(`${occupancySql} ORDER BY occupancy_pct DESC, f.dep_datetime LIMIT 8`, [t]);
  const byAirline = await q(`SELECT al.airline_name, COUNT(*) AS tickets, SUM(pay.amount) AS revenue
      FROM PAYMENT pay JOIN BOOKING b ON b.booking_id = pay.booking_id JOIN SEAT s ON s.seat_id = b.seat_id
      JOIN FLIGHT f ON f.flight_id = s.flight_id JOIN AIRCRAFT ac ON ac.aircraft_id = f.aircraft_id JOIN AIRLINE al ON al.airline_id = ac.airline_id
      WHERE pay.payment_status = 'Paid' GROUP BY al.airline_id, al.airline_name ORDER BY revenue DESC`);
  const frequent = await q(`SELECT p.passenger_id, p.full_name, COUNT(b.booking_id) AS total_bookings
      FROM PASSENGER p JOIN BOOKING b ON b.passenger_id = p.passenger_id
      WHERE b.status = 'Confirmed' GROUP BY p.passenger_id, p.full_name HAVING COUNT(b.booking_id) > 1
      ORDER BY total_bookings DESC LIMIT 8`);
  const roles = await q(`SELECT u.username, CASE WHEN a.admin_id IS NOT NULL THEN 'Admin' ELSE 'Passenger' END AS role
      FROM USER_ACCOUNT u LEFT JOIN ADMIN a ON a.user_id = u.user_id ORDER BY role, u.username`);
  const recent = await bookingDetails('1 = 1', [], 'b.booking_id DESC LIMIT 6');
  res.json({ totals, nextFlights, topOccupancy, byAirline, frequent, roles, recent });
});

r.get('/lookups', async (_req, res) => {
  const [airlines, aircraft, airports] = await Promise.all([
    q('SELECT airline_id, airline_name FROM AIRLINE ORDER BY airline_name'),
    q('SELECT ac.aircraft_id, ac.model_number, ac.capacity, al.airline_name FROM AIRCRAFT ac JOIN AIRLINE al ON al.airline_id = ac.airline_id ORDER BY al.airline_name, ac.model_number'),
    q('SELECT a.airport_id, a.iata_code, a.airport_name, c.city_name FROM AIRPORT a JOIN CITY c ON c.city_id = a.city_id ORDER BY a.iata_code'),
  ]);
  res.json({ airlines, aircraft, airports });
});

// ---------- Generic CRUD (requirement 17) ----------
const str = (max, optional) => (v, label) => {
  const s = String(v ?? '').trim();
  if (!s) { if (optional) return null; throw new HttpError(400, `${label} is required.`); }
  if (s.length > max) throw new HttpError(400, `${label} must be at most ${max} characters.`);
  return s;
};
const int = (min = 1) => (v, label) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min) throw new HttpError(400, `${label} must be a whole number of at least ${min}.`);
  return n;
};
const money = (v, label) => {
  const n = Number(v);
  if (!(n > 0)) throw new HttpError(400, `${label} must be greater than 0.`);
  return Math.round(n * 100) / 100;
};
const datetime = (v, label) => {
  const m = String(v || '').match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?$/);
  if (!m) throw new HttpError(400, `${label} must be a valid date and time.`);
  return `${m[1]} ${m[2]}:00`;
};
const email = (v, label) => { if (!isEmail(v)) throw new HttpError(400, `${label} must be a valid email.`); return String(v).trim().toLowerCase(); };
const code = (v, label) => { const s = String(v || '').trim().toUpperCase(); if (!/^[A-Z]{3}$/.test(s)) throw new HttpError(400, `${label} must be 3 letters.`); return s; };

const resources = {
  airlines: {
    table: 'AIRLINE', pk: 'airline_id',
    fields: { airline_name: ['Airline name', str(100)], contact_info: ['Contact info', str(150, true)] },
    list: () => q(`SELECT al.*, (SELECT COUNT(*) FROM AIRCRAFT ac WHERE ac.airline_id = al.airline_id) AS aircraft_count
                   FROM AIRLINE al ORDER BY al.airline_name`),
  },
  aircraft: {
    table: 'AIRCRAFT', pk: 'aircraft_id',
    fields: { model_number: ['Model', str(40)], capacity: ['Capacity', int(80)], airline_id: ['Airline', int()] },
    list: () => q(`SELECT ac.*, al.airline_name, (SELECT COUNT(*) FROM FLIGHT f WHERE f.aircraft_id = ac.aircraft_id) AS flight_count
                   FROM AIRCRAFT ac JOIN AIRLINE al ON al.airline_id = ac.airline_id ORDER BY al.airline_name, ac.model_number`),
  },
  airports: {
    table: 'AIRPORT', pk: 'airport_id',
    fields: { iata_code: ['IATA code', code], airport_name: ['Airport name', str(120)], city_id: ['City', int()] },
    // Airport location lives in CITY (3NF). Find or create the city, then store only city_id.
    prepare: async (x, body) => {
      const city = str(80)(body.city_name, 'City');
      const country = str(80)(body.country, 'Country');
      const [c] = await x('SELECT city_id FROM CITY WHERE city_name = ? AND country = ?', [city, country]);
      body.city_id = c ? c.city_id : (await x('INSERT INTO CITY (city_name, country) VALUES (?, ?)', [city, country])).insertId;
    },
    list: () => q(`SELECT a.*, c.city_name, c.country,
                     (SELECT COUNT(*) FROM FLIGHT f WHERE f.src_airport_id = a.airport_id OR f.dest_airport_id = a.airport_id) AS flight_count
                   FROM AIRPORT a JOIN CITY c ON c.city_id = a.city_id ORDER BY a.iata_code`),
  },
  passengers: {
    table: 'PASSENGER', pk: 'passenger_id',
    fields: { full_name: ['Full name', str(100)], email: ['Email', email], phone: ['Phone', str(20, true)], address: ['Address', str(255, true)] },
    list: () => q(`SELECT p.*, u.username, (SELECT COUNT(*) FROM BOOKING b WHERE b.passenger_id = p.passenger_id) AS booking_count
                   FROM PASSENGER p LEFT JOIN USER_ACCOUNT u ON u.user_id = p.user_id ORDER BY p.passenger_id`),
  },
  flights: {
    table: 'FLIGHT', pk: 'flight_id',
    fields: {
      flight_number: ['Flight number', (v, l) => str(10)(v, l).toUpperCase()],
      dep_datetime: ['Departure', datetime], arr_datetime: ['Arrival', datetime], base_fare: ['Base fare', money],
      aircraft_id: ['Aircraft', int()], src_airport_id: ['Origin', int()], dest_airport_id: ['Destination', int()],
    },
    check: (v) => {
      if (v.src_airport_id === v.dest_airport_id) throw new HttpError(400, 'Origin and destination must be different airports.');
      if (v.arr_datetime <= v.dep_datetime) throw new HttpError(400, 'Arrival must be after departure.');
    },
    // Release the standard seat inventory for every new flight
    afterCreate: async (x, id) => {
      await x('INSERT INTO SEAT (flight_id, seat_number, seat_class) VALUES ?', [SEAT_LAYOUT.map(([n, c]) => [id, n, c])]);
    },
    // Assignment-4: a flight may be removed only if nobody has booked it; its unsold seats go with it
    beforeDelete: async (x, id) => {
      const [{ n }] = await x('SELECT COUNT(*) AS n FROM BOOKING b JOIN SEAT s ON s.seat_id = b.seat_id WHERE s.flight_id = ?', [id]);
      if (n > 0) throw new HttpError(409, `This flight has ${n} booking(s) and cannot be deleted. Cancel or keep it instead.`);
      await x('DELETE FROM SEAT WHERE flight_id = ?', [id]);
    },
    list: async () => (await q(`${FLIGHT_SELECT} ORDER BY f.dep_datetime`)).map(mapFlight),
  },
};

const resource = (name) => {
  const res = resources[name];
  if (!res) throw new HttpError(404, 'Unknown resource.');
  return res;
};
async function values(res, x, body) {
  if (res.prepare) await res.prepare(x, body);
  const v = {};
  for (const [col, [label, fn]] of Object.entries(res.fields)) v[col] = fn(body[col], label);
  res.check?.(v);
  return v;
}

r.get('/bookings', async (_req, res) => res.json(await bookingDetails('1 = 1', [], 'b.booking_id DESC')));
r.post('/bookings/:id/cancel', async (req, res) => res.json(await cancelBooking(Number(req.params.id))));
r.get('/payments', async (_req, res) => {
  res.json(await q(`SELECT pay.*, b.status AS booking_status, p.full_name, p.email, f.flight_number, f.dep_datetime, s.seat_number, s.seat_class
                    FROM PAYMENT pay JOIN BOOKING b ON b.booking_id = pay.booking_id JOIN PASSENGER p ON p.passenger_id = b.passenger_id
                    JOIN SEAT s ON s.seat_id = b.seat_id JOIN FLIGHT f ON f.flight_id = s.flight_id ORDER BY pay.payment_id DESC`));
});

r.get('/:res', async (req, res) => res.json(await resource(req.params.res).list()));

r.post('/:res', async (req, res) => {
  const rs = resource(req.params.res);
  const id = await tx(async (x) => {
    const v = await values(rs, x, { ...req.body });
    const cols = Object.keys(v);
    const { insertId } = await x(`INSERT INTO ${rs.table} (${cols.join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`, Object.values(v));
    await rs.afterCreate?.(x, insertId);
    return insertId;
  });
  res.status(201).json({ id });
});

r.put('/:res/:id', async (req, res) => {
  const rs = resource(req.params.res);
  await tx(async (x) => {
    const v = await values(rs, x, { ...req.body });
    const { affectedRows } = await x(`UPDATE ${rs.table} SET ${Object.keys(v).map((c) => `${c} = ?`).join(', ')} WHERE ${rs.pk} = ?`, [...Object.values(v), req.params.id]);
    if (!affectedRows) throw new HttpError(404, 'Record not found.');
  });
  res.json({ id: Number(req.params.id) });
});

r.delete('/:res/:id', async (req, res) => {
  const rs = resource(req.params.res);
  await tx(async (x) => {
    await rs.beforeDelete?.(x, req.params.id);
    const { affectedRows } = await x(`DELETE FROM ${rs.table} WHERE ${rs.pk} = ?`, [req.params.id]);
    if (!affectedRows) throw new HttpError(404, 'Record not found.');
  });
  res.status(204).end();
});

export default r;
