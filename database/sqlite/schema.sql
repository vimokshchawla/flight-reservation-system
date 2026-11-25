-- =====================================================================
-- Flight Reservation System - SQLite schema (auto-loaded by the backend)
-- Final normalized schema from Assignment-3 (3NF / BCNF), 12 tables.
-- Project extensions (documented in README, "Assumptions"):
--   AIRPORT.iata_code  - 3-letter code used in search and on tickets
--   FLIGHT.base_fare   - economy fare; business = base_fare x 2.5
--   PASSENGER.user_id  - NULL allowed so co-travellers / guests can be passengers
--   BOOKING.active_seat_id - generated column; MySQL has no partial index, so
--     UNIQUE(active_seat_id) implements "UNIQUE(seat_id) WHERE status <> 'Cancelled'"
-- =====================================================================

CREATE TABLE AIRLINE (
  airline_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  airline_name  VARCHAR(100) NOT NULL,
  contact_info  VARCHAR(150),
  CONSTRAINT uq_airline_name UNIQUE (airline_name)
);

CREATE TABLE CITY (
  city_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  city_name  VARCHAR(80) NOT NULL,
  country    VARCHAR(80) NOT NULL,
  CONSTRAINT uq_city UNIQUE (city_name, country)
);

CREATE TABLE AIRPORT (
  airport_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  iata_code     CHAR(3) NOT NULL,
  airport_name  VARCHAR(120) NOT NULL,
  city_id       INT NOT NULL,
  CONSTRAINT uq_airport_iata UNIQUE (iata_code),
  CONSTRAINT fk_airport_city FOREIGN KEY (city_id) REFERENCES CITY(city_id)
);

CREATE TABLE AIRCRAFT (
  aircraft_id   INTEGER PRIMARY KEY AUTOINCREMENT,
  model_number  VARCHAR(40) NOT NULL,
  capacity      INT NOT NULL,
  airline_id    INT NOT NULL,
  CONSTRAINT chk_aircraft_capacity CHECK (capacity > 0),
  CONSTRAINT fk_aircraft_airline FOREIGN KEY (airline_id) REFERENCES AIRLINE(airline_id)
);

CREATE TABLE FLIGHT (
  flight_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_number    VARCHAR(10) NOT NULL,
  dep_datetime     DATETIME NOT NULL,
  arr_datetime     DATETIME NOT NULL,
  base_fare        DECIMAL(10,2) NOT NULL,
  aircraft_id      INT NOT NULL,
  src_airport_id   INT NOT NULL,
  dest_airport_id  INT NOT NULL,
  CONSTRAINT uq_flight UNIQUE (flight_number, dep_datetime),
  CONSTRAINT chk_flight_times CHECK (arr_datetime > dep_datetime),
  CONSTRAINT chk_flight_route CHECK (src_airport_id <> dest_airport_id),
  CONSTRAINT chk_flight_fare CHECK (base_fare > 0),
  CONSTRAINT fk_flight_aircraft FOREIGN KEY (aircraft_id) REFERENCES AIRCRAFT(aircraft_id),
  CONSTRAINT fk_flight_src FOREIGN KEY (src_airport_id) REFERENCES AIRPORT(airport_id),
  CONSTRAINT fk_flight_dest FOREIGN KEY (dest_airport_id) REFERENCES AIRPORT(airport_id)
);
CREATE INDEX idx_flight_search ON FLIGHT (src_airport_id, dest_airport_id, dep_datetime);

CREATE TABLE USER_ACCOUNT (
  user_id        INTEGER PRIMARY KEY AUTOINCREMENT,
  username       VARCHAR(50) NOT NULL,
  password_hash  CHAR(64) NOT NULL,
  CONSTRAINT uq_username UNIQUE (username)
);

CREATE TABLE PASSENGER (
  passenger_id  INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INT NULL,
  full_name     VARCHAR(100) NOT NULL,
  email         VARCHAR(120) NOT NULL,
  phone         VARCHAR(20),
  address       VARCHAR(255),
  CONSTRAINT uq_passenger_user UNIQUE (user_id),
  CONSTRAINT uq_passenger_email UNIQUE (email),
  CONSTRAINT fk_passenger_user FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT(user_id)
);

CREATE TABLE ADMIN (
  admin_id    INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INT NOT NULL,
  admin_name  VARCHAR(100) NOT NULL,
  CONSTRAINT uq_admin_user UNIQUE (user_id),
  CONSTRAINT fk_admin_user FOREIGN KEY (user_id) REFERENCES USER_ACCOUNT(user_id)
);

CREATE TABLE SEAT (
  seat_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  flight_id    INT NOT NULL,
  seat_number  VARCHAR(4) NOT NULL,
  seat_class   VARCHAR(10) NOT NULL,
  CONSTRAINT uq_seat UNIQUE (flight_id, seat_number),
  CONSTRAINT chk_seat_class CHECK (seat_class IN ('Economy','Business')),
  CONSTRAINT fk_seat_flight FOREIGN KEY (flight_id) REFERENCES FLIGHT(flight_id)
);

CREATE TABLE BOOKING (
  booking_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  booking_date    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status          VARCHAR(10) NOT NULL DEFAULT 'Pending',
  passenger_id    INT NOT NULL,
  seat_id         INT NOT NULL,
  active_seat_id  INT GENERATED ALWAYS AS (CASE WHEN status <> 'Cancelled' THEN seat_id END) STORED,
  CONSTRAINT chk_booking_status CHECK (status IN ('Confirmed','Cancelled','Pending')),
  CONSTRAINT uq_active_seat UNIQUE (active_seat_id),
  CONSTRAINT fk_booking_passenger FOREIGN KEY (passenger_id) REFERENCES PASSENGER(passenger_id),
  CONSTRAINT fk_booking_seat FOREIGN KEY (seat_id) REFERENCES SEAT(seat_id)
);
CREATE INDEX idx_booking_seat_status ON BOOKING (seat_id, status);

CREATE TABLE TICKET (
  ticket_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_number  VARCHAR(30) NOT NULL,
  issue_date     DATETIME NOT NULL,
  booking_id     INT NOT NULL,
  CONSTRAINT uq_ticket_number UNIQUE (ticket_number),
  CONSTRAINT uq_ticket_booking UNIQUE (booking_id),
  CONSTRAINT fk_ticket_booking FOREIGN KEY (booking_id) REFERENCES BOOKING(booking_id)
);

CREATE TABLE PAYMENT (
  payment_id      INTEGER PRIMARY KEY AUTOINCREMENT,
  amount          DECIMAL(10,2) NOT NULL,
  payment_date    DATETIME NOT NULL,
  payment_method  VARCHAR(12) NULL,
  payment_status  VARCHAR(10) NOT NULL DEFAULT 'Pending',
  booking_id      INT NOT NULL,
  CONSTRAINT chk_payment_amount CHECK (amount >= 0),
  CONSTRAINT chk_payment_method CHECK (payment_method IN ('Card','UPI','NetBanking','Wallet')),
  CONSTRAINT chk_payment_status CHECK (payment_status IN ('Pending','Paid','Failed','Refunded')),
  CONSTRAINT fk_payment_booking FOREIGN KEY (booking_id) REFERENCES BOOKING(booking_id)
);
