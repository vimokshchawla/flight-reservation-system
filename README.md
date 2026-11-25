# Skyroute — Flight Reservation System (DBMS Project)

Full-stack flight reservation system built on the normalized schema from Assignments 1–4:

- **SQLite (embedded)**: 12-table 3NF/BCNF schema with keys, constraints and realistic sample data, created automatically
- **Node.js + Express**: REST API that reads and changes real database rows (no database server to install)
- **React + Vite + Tailwind CSS**: customer booking site plus an admin dashboard

```
flight-reservation-system/
├── database/
│   ├── sqlite/schema.sql, sqlite/seed.sql ← used by the app (loaded automatically)
│   ├── flight_reservation_system.sql   ← MySQL version of the same database (optional)
│   ├── schema.sql                      ← tables only (same as the first half of the file above)
│   ├── seed.sql                        ← sample data only (run after schema.sql)
│   └── queries.sql                     ← Assignment-4 queries rewritten for MySQL, for the demo
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── server.js        Express app, error mapping (MySQL error codes → HTTP)
│       ├── db.js            SQLite connection, auto-setup, transaction helper
│       ├── queries.js       shared SQL (flight search, booking details, cancellation)
│       ├── utils.js         fares, tokens, validation, seat layout
│       └── routes/
│           ├── public.js    airports, search, flight + seats, bookings, payments, login/register
│           └── admin.js     dashboard/reports and CRUD for flights, airports, airlines, aircraft, passengers
└── frontend/
    ├── .env.example
    ├── package.json, vite.config.js, index.html
    └── src/
        ├── services/api.js       the service layer; the only place that calls the backend
        ├── context/AppContext.jsx auth session + trip state (search → flights → pending booking → ticket)
        ├── components/           UI kit, search form, airport picker, seat map, data table, generic CRUD page
        ├── layouts/              customer layout (navbar/footer) and admin layout (sidebar)
        ├── pages/                Home, SearchResults, Booking, Payment, Confirmation, MyBookings, Login
        └── pages/admin/          Dashboard + Flights, Airports, Airlines & aircraft, Passengers, Bookings, Payments
```

---

## 1. Install the prerequisite

Only **Node.js 22.13 or newer** (the current LTS from https://nodejs.org is fine). Check with `node -v`.
No database server is needed: the backend uses SQLite, which is built into Node.js.

## 2. Run the backend (creates the database automatically)

```bash
cd backend
npm install
npm run dev
```

On the first start it creates `backend/data/flight_reservation.db` from `database/sqlite/schema.sql` and `database/sqlite/seed.sql`:
6 airlines, 10 aircraft, 15 airports, **304 flights**, 24,320 seats, 160 passengers and about 4,200 bookings with tickets and payments.
Open http://localhost:5000/api/health and you should see `"flights":304`.

- Reset to fresh sample data at any time: stop the server, run `npm run db:reset`, start again.
- A `.env` file is optional; see `backend/.env.example` for the defaults.
- To browse the data, open the `.db` file in **DB Browser for SQLite** (free, https://sqlitebrowser.org).

## 3. Run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite forwards `/api` requests to the backend on port 5000.

## 4. MySQL scripts (optional, for the DBMS course)

`database/flight_reservation_system.sql`, `schema.sql`, `seed.sql` and `queries.sql` are the same design in MySQL 8 syntax.
They are not needed to run the app; use them only if you want to show the database in MySQL Workbench.

## 5. Demo script (about 5 minutes)

| Account | Username / password |
|---|---|
| Administrator | `admin1` / `admin123` |
| Passenger | `rahul01` / `rahul123` (also `amit02` / `amit123`) |

1. **Search** Delhi → Mumbai on **10 Dec 2026**: AI101 and 6E202, the Assignment-4 query result. The date strip shows the cheapest fare on nearby days.
2. **Filter and sort** by price, departure time and airline. Try a **round trip** with 2 passengers.
3. **Book**: fill in passenger details (validation runs on every field) and pick seats on the seat map. Occupied seats come from BOOKING rows with status Confirmed or Pending.
4. **Continue to payment**: the bookings are now **Pending** in MySQL and the seats are held.
   Show it in DB Browser for SQLite: `SELECT * FROM BOOKING ORDER BY booking_id DESC LIMIT 4;`
5. **Pay** with card `4000 0000 0000 0002` to show a **declined** payment (PAYMENT = Failed, BOOKING stays Pending). Then pay with any other 16-digit card, for example `4111 1111 1111 1111`, with a future expiry and any CVV. The booking becomes **Confirmed** and a **TICKET** row is inserted.
6. **Ticket**: print it or download it as an HTML e-ticket.
7. **My bookings**: look up the booking by reference + email (or sign in as `rahul01`) and **cancel** it. BOOKING becomes Cancelled, PAYMENT becomes Refunded, and the seat is free again because availability is derived, not stored.
8. **Admin** (`admin1`): the dashboard shows occupancy (LEFT JOIN / GROUP BY), revenue by airline, frequent passengers (HAVING) and user roles (CASE). You can also:
   - Add a flight; 80 seats are generated automatically.
   - Try to delete a flight that has bookings. The delete is refused, as Assignment-4 Req 17 requires.
   - Try to delete an airline that owns aircraft. The foreign key refuses it.
   - Set a flight's arrival before its departure, or reuse a passenger email. The CHECK or UNIQUE constraint rejects it.
9. Optional: run `database/queries.sql` in MySQL Workbench to show the Assignment-4 queries in MySQL.

## 6. Requirement coverage

| Req (Assignment-1) | Where |
|---|---|
| 1, 4, 7 Flight details, search, seat availability | `GET /api/flights/search`, Search results page |
| 2, 3, 17 Airlines, aircraft, airports, admin CRUD | Admin → Flights, Airports, Airlines & aircraft |
| 5, 8, 9, 10 Book, assign seat, ticket, payment | Booking → Payment → Confirmation (`POST /api/bookings`, `POST /api/payments`) |
| 6 Passenger information | Booking form (stored and updated by email), Admin → Passengers |
| 11, 12 Current / previous bookings and status | My bookings (tabs: upcoming, past, pending, cancelled) |
| 13, 14 No duplicate seats, integrity | `UNIQUE(active_seat_id)`, FKs, CHECKs, transactions; the API returns 409 on a seat race |
| 15 Occupancy and passenger reports | Admin dashboard |
| 16 User accounts and roles | Login/register; role = row exists in ADMIN |

## 7. Assumptions (beyond the documented schema)

The final normalized schema from Assignment-3 is implemented as written. These additions were needed for a working application and are marked in `schema.sql`:

1. **`FLIGHT.base_fare`**: the documents don't store a price. Economy fare = `base_fare`, Business = `base_fare × 2.5`, and checkout adds 12% taxes and fees. `PAYMENT.amount` stores what was charged.
2. **`AIRPORT.iata_code`** (unique): a 3-letter code for search and tickets.
3. **`PASSENGER.user_id` is nullable**: co-travellers and guests can be passengers without an account. It is still UNIQUE, so an account maps to at most one passenger.
4. **`BOOKING.active_seat_id`**: a generated column. MySQL has no partial indexes, so `UNIQUE(active_seat_id)` implements Assignment-3's `UNIQUE(seat_id) WHERE status <> 'Cancelled'`.
5. **Seat inventory**: each flight releases 80 seats (rows 1–2 Business A/C/D/F, rows 3–14 Economy A–F), smaller than the aircraft capacity, to keep the dataset manageable.
6. **Payment flow**: booking created as **Pending**, plus a PAYMENT row (Pending). On success, PAYMENT becomes Paid, BOOKING becomes Confirmed and a TICKET is inserted. On failure, PAYMENT becomes Failed and BOOKING stays Pending so the user can retry. Payment status values are Pending, Paid, Failed and Refunded. Seats held by an unpaid booking stay held until it is paid or cancelled.
7. **Multiple passengers**: one BOOKING (and TICKET and PAYMENT) per passenger per flight, matching the schema (a booking has one passenger and one seat). Each passenger needs a distinct email because `PASSENGER.email` is unique.
8. **Booking reference** shown to users = `FRS` + zero-padded `booking_id` (for example `FRS000001`). Ticket numbers follow Assignment-4: `TKT-<flight>-<booking_id>`.
9. **Search by city**: choosing an airport searches all airports in that city, as in the Assignment-4 query (for example Goa covers both GOI and GOX).
10. Passwords are stored as SHA-256 hashes, and login returns an HMAC-signed token. That is adequate for a demo; use bcrypt/argon2 and JWT for production.
11. `booking_date`, `issue_date` and `payment_date` are DATETIME so the time is kept.

## 8. API reference and backend connection

The frontend never talks to the database directly. All calls go through `frontend/src/services/api.js`, which calls the Express API.

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | API + DB check |
| GET | `/api/airports` | Airports with city/country |
| GET | `/api/flights/popular` | Routes with flight count and lowest fare |
| GET | `/api/flights/search?from=DEL&to=BOM&date=2026-12-10` | Flights with free seats per cabin, plus nearby-date fares |
| GET | `/api/flights/:id` | Flight + seat map (available flag per seat) |
| POST | `/api/bookings` | `{cabin, passengers:[...], legs:[{flight_id, seat_ids}]}` → Pending bookings |
| GET | `/api/bookings/pending?ids=1,2` | Pending bookings for checkout |
| POST | `/api/payments` | `{booking_ids, method, simulate_failure}` → Paid + Confirmed + tickets |
| GET | `/api/bookings/lookup?ref=FRS000001&email=…` | Guest booking lookup |
| GET | `/api/bookings/mine` | Signed-in passenger's bookings (Bearer token) |
| POST | `/api/bookings/:id/cancel` | Cancel (owner email, owner token or admin) |
| POST | `/api/auth/login`, `/api/auth/register` | Accounts |
| GET | `/api/admin/dashboard`, `/api/admin/lookups` | Admin overview and form options |
| GET/POST/PUT/DELETE | `/api/admin/{flights,airports,airlines,aircraft,passengers}[/:id]` | CRUD |
| GET | `/api/admin/bookings`, `/api/admin/payments`; POST `/api/admin/bookings/:id/cancel` | Booking and payment management |

**Hosting the API elsewhere:** set `VITE_API_URL=https://your-api.example.com/api` in `frontend/.env`, and add the frontend URL to `CORS_ORIGIN` in `backend/.env`.
**Adding a feature:** add an endpoint in `backend/src/routes/*`, add a function to the matching service in `frontend/src/services/api.js`, and call it from a page. Components never use `fetch` directly.

## Troubleshooting

- **"This backend needs Node.js 22.13 or newer"**: install the current LTS from https://nodejs.org.
- **Frontend says "Cannot reach the server"**: the backend isn't running on port 5000.
- **Port 5000 busy (common on macOS)**: set `PORT=5001` in `backend/.env` and change the proxy target in `frontend/vite.config.js`.
- **No flights found**: sample flights run 6 Nov – 21 Dec 2026, and search hides departed flights. Pick a date in that range.
- **Start over with clean data**: `npm run db:reset` in `backend`.
