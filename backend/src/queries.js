import { q, tx } from './db.js';
import { HttpError, fareFor, now, toMinutes, toRef } from './utils.js';

// A seat is available when it has no Confirmed or Pending booking (Assignment-3 availability rule).
const AVAILABLE = (cls) => `(SELECT COUNT(*) FROM SEAT s WHERE s.flight_id = f.flight_id AND s.seat_class = '${cls}'
    AND NOT EXISTS (SELECT 1 FROM BOOKING b WHERE b.seat_id = s.seat_id AND b.status IN ('Confirmed','Pending')))`;

// FLIGHT reaches its airline only through AIRCRAFT (3NF), so airline is joined via aircraft.
export const FLIGHT_SELECT = `
  SELECT f.flight_id, f.flight_number, f.dep_datetime, f.arr_datetime, f.base_fare,
         f.aircraft_id, f.src_airport_id, f.dest_airport_id,
         al.airline_id, al.airline_name, ac.model_number,
         sa.iata_code AS src_code, sa.airport_name AS src_name, sc.city_name AS src_city,
         da.iata_code AS dest_code, da.airport_name AS dest_name, dc.city_name AS dest_city,
         ${AVAILABLE('Economy')} AS eco_available,
         ${AVAILABLE('Business')} AS bus_available
  FROM FLIGHT f
  JOIN AIRCRAFT ac ON ac.aircraft_id = f.aircraft_id
  JOIN AIRLINE al ON al.airline_id = ac.airline_id
  JOIN AIRPORT sa ON sa.airport_id = f.src_airport_id
  JOIN CITY sc ON sc.city_id = sa.city_id
  JOIN AIRPORT da ON da.airport_id = f.dest_airport_id
  JOIN CITY dc ON dc.city_id = da.city_id`;

export const mapFlight = (f) => ({
  ...f,
  duration_min: toMinutes(f.dep_datetime, f.arr_datetime),
  economy_fare: fareFor(f.base_fare, 'Economy'),
  business_fare: fareFor(f.base_fare, 'Business'),
  departed: f.dep_datetime <= now(),
});

const BOOKING_SELECT = `
  SELECT b.booking_id, b.booking_date, b.status,
         p.passenger_id, p.full_name, p.email, p.phone,
         s.seat_id, s.seat_number, s.seat_class,
         f.flight_id, f.flight_number, f.dep_datetime, f.arr_datetime,
         al.airline_id, al.airline_name, ac.model_number,
         sa.iata_code AS src_code, sa.airport_name AS src_name, sc.city_name AS src_city,
         da.iata_code AS dest_code, da.airport_name AS dest_name, dc.city_name AS dest_city,
         t.ticket_number, t.issue_date,
         pay.payment_id, pay.amount, pay.payment_method, pay.payment_status, pay.payment_date
  FROM BOOKING b
  JOIN PASSENGER p ON p.passenger_id = b.passenger_id
  JOIN SEAT s ON s.seat_id = b.seat_id
  JOIN FLIGHT f ON f.flight_id = s.flight_id
  JOIN AIRCRAFT ac ON ac.aircraft_id = f.aircraft_id
  JOIN AIRLINE al ON al.airline_id = ac.airline_id
  JOIN AIRPORT sa ON sa.airport_id = f.src_airport_id
  JOIN CITY sc ON sc.city_id = sa.city_id
  JOIN AIRPORT da ON da.airport_id = f.dest_airport_id
  JOIN CITY dc ON dc.city_id = da.city_id
  LEFT JOIN TICKET t ON t.booking_id = b.booking_id
  LEFT JOIN PAYMENT pay ON pay.booking_id = b.booking_id`;

export async function bookingDetails(where = '1 = 1', params = [], order = 'f.dep_datetime DESC, b.booking_id', run = q) {
  const rows = await run(`${BOOKING_SELECT} WHERE ${where} ORDER BY ${order}`, params);
  const t = now();
  return rows.map((r) => ({ ...r, reference: toRef(r.booking_id), duration_min: toMinutes(r.dep_datetime, r.arr_datetime), departed: r.dep_datetime <= t }));
}

/** Cancel a booking: status -> Cancelled (row is kept for history), payment Paid -> Refunded. The seat becomes free automatically. */
export async function cancelBooking(bookingId) {
  return tx(async (x) => {
    const [b] = await x(`SELECT b.status, f.dep_datetime FROM BOOKING b JOIN SEAT s ON s.seat_id = b.seat_id
                         JOIN FLIGHT f ON f.flight_id = s.flight_id WHERE b.booking_id = ?`, [bookingId]);
    if (!b) throw new HttpError(404, 'Booking not found.');
    if (b.status === 'Cancelled') throw new HttpError(409, 'This booking is already cancelled.');
    if (b.dep_datetime <= now()) throw new HttpError(400, 'This flight has already departed and cannot be cancelled.');
    await x(`UPDATE BOOKING SET status = 'Cancelled' WHERE booking_id = ?`, [bookingId]);
    await x(`UPDATE PAYMENT SET payment_status = CASE WHEN payment_status = 'Paid' THEN 'Refunded' ELSE 'Failed' END
             WHERE booking_id = ? AND payment_status IN ('Paid','Pending')`, [bookingId]);
    return (await bookingDetails('b.booking_id = ?', [bookingId], 'b.booking_id', x))[0];
  });
}
