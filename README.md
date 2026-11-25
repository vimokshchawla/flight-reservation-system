# Skyroute — Flight Reservation System (DBMS Project)

Full-stack flight reservation system built on the normalized schema from Assignments 1–4:

- **MySQL 8**: 12-table 3NF/BCNF schema with keys, constraints and realistic sample data
- **Node.js + Express**: REST API that reads and changes real database rows
- **React + Vite + Tailwind CSS**: customer booking site plus an admin dashboard

```
flight-reservation-system/
├── database/
│   ├── flight_reservation_system.sql   ← ONE file: creates the DB, tables, relationships and sample data
│   ├── schema.sql                      ← tables only (same as the first half of the file above)
│   ├── seed.sql                        ← sample data only (run after schema.sql)
│   └── queries.sql                     ← Assignment-4 queries rewritten for MySQL, for the demo
├── backend/
│   ├── .env.example
│   ├── package.json
│   └── src/
│       ├── server.js        Express app, error mapping (MySQL error codes → HTTP)
│       ├── db.js            mysql2 connection pool + transaction helper
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

## 1. Install the prerequisites

| Tool | Version | Download |
|---|---|---|
| MySQL Server + MySQL Workbench | 8.0 or newer | https://dev.mysql.com/downloads/installer/ (Windows) or https://dev.mysql.com/downloads/mysql/ (macOS/Linux) |
| Node.js (includes npm) | 18 or newer (20 LTS recommended) | https://nodejs.org |

**Installing MySQL (Windows):** run *MySQL Installer*, choose **Developer Default** (or Server + Workbench), keep port **3306**, and set a **root password** — you'll need it in step 3.
**macOS:** install the MySQL DMG and MySQL Workbench, then start MySQL from *System Settings → MySQL*.
**Linux (Ubuntu):** `sudo apt install mysql-server`, then `sudo mysql` and run
`ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';`

Check that Node works: `node -v` and `npm -v`.

## 2. Create and populate the database (MySQL Workbench)

1. Open **MySQL Workbench** and connect to your local instance (`root`, port 3306).
2. **File → Open SQL Script…** and choose `database/flight_reservation_system.sql`.
3. Click the **lightning bolt** (Execute all), or press `Ctrl+Shift+Enter` / `Cmd+Shift+Enter`.
4. In the *Schemas* panel click the refresh icon. `flight_reservation_system` appears with 12 tables.

Quick check (new query tab):

```sql
USE flight_reservation_system;
SELECT COUNT(*) FROM FLIGHT;   -- 304
SELECT COUNT(*) FROM SEAT;     -- 24,320 (80 per flight)
SELECT COUNT(*) FROM BOOKING;  -- about 4,200
```

> The script starts with `DROP DATABASE IF EXISTS flight_reservation_system`, so you can re-run it any time to reset the demo data.
> Command-line alternative: `mysql -u root -p < database/flight_reservation_system.sql`

**What's in the sample data:** 6 airlines, 10 aircraft, 13 cities, 15 airports (Delhi and Goa each have two airports), **304 flights** from 6 Nov to 21 Dec 2026 (past and upcoming, 30 routes including international), 80 seats per flight, 160 passengers, about 4,200 bookings with tickets and payments, and 3 user accounts. The Assignment-4 sample rows are kept as IDs 1–6 (AI101 / 6E202 on 10 Dec 2026, Rahul's and Amit's bookings, and so on).

## 3. Configure and run the backend

```bash
cd backend
npm install
cp .env.example .env          # Windows PowerShell: copy .env.example .env
```

Edit `backend/.env`:

```ini
PORT=5000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password      # the root password from step 1
DB_NAME=flight_reservation_system
AUTH_SECRET=any-long-random-string
CORS_ORIGIN=http://localhost:5173
```

```bash
npm run dev        # or: npm start
```

Open http://localhost:5000/api/health. It should show `{"status":"ok", ..., "flights":304}`.
If it shows *Cannot reach the MySQL database*, check the password, that MySQL is running, and that step 2 completed.

## 4. Run the frontend

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to `http://localhost:5000`, so no extra configuration is needed.
Production build: `npm run build`, then `npm run preview`.

## 5. Demo script (about 5 minutes)

| Account | Username / password |
|---|---|
| Administrator | `admin1` / `admin123` |
| Passenger | `rahul01` / `rahul123` (also `amit02` / `amit123`) |

1. **Search** Delhi → Mumbai on **10 Dec 2026**: AI101 and 6E202, the Assignment-4 query result. The date strip shows the cheapest fare on nearby days.
2. **Filter and sort** by price, departure time and airline. Try a **round trip** with 2 passengers.
3. **Book**: fill in passenger details (validation runs on every field) and pick seats on the seat map. Occupied seats come from BOOKING rows with status Confirmed or Pending.
4. **Continue to payment**: the bookings are now **Pending** in MySQL and the seats are held.
   Show it in Workbench: `SELECT * FROM BOOKING ORDER BY booking_id DESC LIMIT 4;`
5. **Pay** with card `4000 0000 0000 0002` to show a **declined** payment (PAYMENT = Failed, BOOKING stays Pending). Then pay with any other 16-digit card, for example `4111 1111 1111 1111`, with a future expiry and any CVV. The booking becomes **Confirmed** and a **TICKET** row is inserted.
6. **Ticket**: print it or download it as an HTML e-ticket.
7. **My bookings**: look up the booking by reference + email (or sign in as `rahul01`) and **cancel** it. BOOKING becomes Cancelled, PAYMENT becomes Refunded, and the seat is free again because availability is derived, not stored.
8. **Admin** (`admin1`): the dashboard shows occupancy (LEFT JOIN / GROUP BY), revenue by airline, frequent passengers (HAVING) and user roles (CASE). You can also:
   - Add a flight; 80 seats are generated automatically.
   - Try to delete a flight that has bookings. The delete is refused, as Assignment-4 Req 17 requires.
   - Try to delete an airline that owns aircraft. The foreign key refuses it.
   - Set a flight's arrival before its departure, or reuse a passenger email. The CHECK or UNIQUE constraint rejects it.
9. Run `database/queries.sql` in Workbench to show every Assignment-4 query on live data.

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

The frontend never talks to MySQL directly. All calls go through `frontend/src/services/api.js`, which calls the Express API. Database credentials live only in `backend/.env`.

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

- **`ER_ACCESS_DENIED_ERROR`**: wrong `DB_USER` / `DB_PASSWORD` in `backend/.env`.
- **`ER_BAD_DB_ERROR`**: the SQL script hasn't been run. Repeat step 2.
- **Frontend says "Cannot reach the server"**: the backend isn't running on port 5000.
- **Port 5000 busy (common on macOS, AirPlay)**: set `PORT=5001` in `backend/.env` and change the proxy target in `frontend/vite.config.js`.
- **No flights found**: the sample flights run 6 Nov – 21 Dec 2026, and search only shows flights that haven't departed. Pick a date in that range, or re-run the SQL script with later dates.
- **MySQL 5.7**: not supported (needs CHECK constraints and the `utf8mb4_0900_ai_ci` collation from 8.0).
