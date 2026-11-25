-- =====================================================================
-- Assignment-4 queries rewritten for MySQL 8 (original was SQL Server).
-- Run after flight_reservation_system.sql. Each block maps to a requirement.
-- =====================================================================
USE flight_reservation_system;

-- Req 1: flight details with derived duration
SELECT f.flight_number, sa.airport_name AS source, da.airport_name AS destination, f.dep_datetime, f.arr_datetime,
       CONCAT(TIMESTAMPDIFF(MINUTE, f.dep_datetime, f.arr_datetime) DIV 60, 'h ', TIMESTAMPDIFF(MINUTE, f.dep_datetime, f.arr_datetime) % 60, 'm') AS duration
FROM FLIGHT f JOIN AIRPORT sa ON f.src_airport_id = sa.airport_id JOIN AIRPORT da ON f.dest_airport_id = da.airport_id
WHERE f.flight_id <= 3;

-- Req 2: airlines and aircraft
SELECT al.airline_name, ac.model_number, ac.capacity FROM AIRCRAFT ac JOIN AIRLINE al ON ac.airline_id = al.airline_id;

-- Req 3: airports and locations (CITY holds the location once)
SELECT a.iata_code, a.airport_name, c.city_name, c.country FROM AIRPORT a JOIN CITY c ON a.city_id = c.city_id;

-- Req 4 & 7: search Delhi -> Mumbai on 10 Dec 2026 with free seats
SELECT f.flight_number, f.dep_datetime, f.arr_datetime, COUNT(s.seat_id) AS available_seats
FROM FLIGHT f
JOIN AIRPORT sa ON f.src_airport_id = sa.airport_id JOIN CITY sc ON sa.city_id = sc.city_id
JOIN AIRPORT da ON f.dest_airport_id = da.airport_id JOIN CITY dc ON da.city_id = dc.city_id
JOIN SEAT s ON s.flight_id = f.flight_id
WHERE sc.city_name = 'Delhi' AND dc.city_name = 'Mumbai' AND DATE(f.dep_datetime) = '2026-12-10'
  AND NOT EXISTS (SELECT 1 FROM BOOKING b WHERE b.seat_id = s.seat_id AND b.status IN ('Confirmed','Pending'))
GROUP BY f.flight_id, f.flight_number, f.dep_datetime, f.arr_datetime;

-- Req 5, 8, 9, 10: book seat 12D of AI101 for Amit (Pending -> payment -> Confirmed -> ticket)
START TRANSACTION;
INSERT INTO BOOKING (booking_date, status, passenger_id, seat_id)
  SELECT NOW(), 'Pending', 2, seat_id FROM SEAT WHERE flight_id = 1 AND seat_number = '12D';
SET @bid = LAST_INSERT_ID();
INSERT INTO PAYMENT (amount, payment_date, payment_method, payment_status, booking_id) VALUES (6048.00, NOW(), 'UPI', 'Paid', @bid);
UPDATE BOOKING SET status = 'Confirmed' WHERE booking_id = @bid;
INSERT INTO TICKET (ticket_number, issue_date, booking_id) VALUES (CONCAT('TKT-AI101-', LPAD(@bid, 5, '0')), NOW(), @bid);
COMMIT;
SELECT b.booking_id, b.status, s.seat_number, t.ticket_number, p.amount, p.payment_status
FROM BOOKING b JOIN SEAT s ON b.seat_id = s.seat_id JOIN TICKET t ON t.booking_id = b.booking_id JOIN PAYMENT p ON p.booking_id = b.booking_id
WHERE b.booking_id = @bid;

-- Req 6: update and view passenger information
UPDATE PASSENGER SET phone = '9876500000' WHERE passenger_id = 1;
SELECT passenger_id, full_name, email, phone FROM PASSENGER WHERE passenger_id = 1;

-- Req 5 & 7: cancel the booking; the seat becomes available again without any seat-status update
UPDATE BOOKING SET status = 'Cancelled' WHERE booking_id = @bid AND passenger_id = 2;
UPDATE PAYMENT SET payment_status = 'Refunded' WHERE booking_id = @bid;
SELECT s.seat_id, s.seat_number FROM SEAT s
WHERE s.flight_id = 1 AND s.seat_number = '12D'
  AND NOT EXISTS (SELECT 1 FROM BOOKING b WHERE b.seat_id = s.seat_id AND b.status IN ('Confirmed','Pending'));

-- Req 11 & 12: current and previous bookings of passenger 1 with status
SELECT b.booking_id, f.flight_number, f.dep_datetime, s.seat_number, b.status
FROM BOOKING b JOIN SEAT s ON b.seat_id = s.seat_id JOIN FLIGHT f ON s.flight_id = f.flight_id
WHERE b.passenger_id = 1 ORDER BY f.dep_datetime DESC;

-- Req 13 & 14: double booking is rejected by UNIQUE(active_seat_id)
-- Expected: Error 1062 Duplicate entry ... for key 'BOOKING.uq_active_seat'
-- INSERT INTO BOOKING (booking_date, status, passenger_id, seat_id)
--   SELECT NOW(), 'Pending', 2, seat_id FROM SEAT WHERE flight_id = 1 AND seat_number = '12A';

-- Req 15 (a): flight occupancy
SELECT f.flight_number, f.dep_datetime, COUNT(s.seat_id) AS total_seats, COUNT(b.booking_id) AS booked_seats,
       ROUND(100.0 * COUNT(b.booking_id) / COUNT(s.seat_id), 1) AS occupancy_pct
FROM FLIGHT f JOIN SEAT s ON s.flight_id = f.flight_id
LEFT JOIN BOOKING b ON b.seat_id = s.seat_id AND b.status = 'Confirmed'
GROUP BY f.flight_id, f.flight_number, f.dep_datetime ORDER BY f.flight_id LIMIT 10;

-- Req 15 (b): passengers with more than one confirmed booking
SELECT p.full_name, COUNT(b.booking_id) AS total_bookings
FROM PASSENGER p JOIN BOOKING b ON b.passenger_id = p.passenger_id
WHERE b.status = 'Confirmed' GROUP BY p.passenger_id, p.full_name HAVING COUNT(b.booking_id) > 1
ORDER BY total_bookings DESC;

-- Req 16: role derived from ADMIN
SELECT u.username, CASE WHEN a.admin_id IS NOT NULL THEN 'Admin' ELSE 'Passenger' END AS role
FROM USER_ACCOUNT u LEFT JOIN ADMIN a ON a.user_id = u.user_id;

-- Req 17: admin adds, reschedules and removes a flight (only if it has no seats)
INSERT INTO FLIGHT (flight_number, dep_datetime, arr_datetime, base_fare, aircraft_id, src_airport_id, dest_airport_id)
VALUES ('AI102X', '2026-12-12 18:00:00', '2026-12-12 20:10:00', 5200.00, 1, 2, 1);
SET @fid = LAST_INSERT_ID();
UPDATE FLIGHT SET dep_datetime = '2026-12-12 18:30:00', arr_datetime = '2026-12-12 20:40:00' WHERE flight_id = @fid;
DELETE FROM FLIGHT WHERE flight_id = @fid AND NOT EXISTS (SELECT 1 FROM SEAT WHERE SEAT.flight_id = @fid);
