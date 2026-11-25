import crypto from 'node:crypto';

export const BUSINESS_MULTIPLIER = 2.5; // business fare = base_fare x 2.5
export const TAX_RATE = 0.12;           // taxes & fees on top of the fare
export const PAYMENT_METHODS = ['Card', 'UPI', 'NetBanking', 'Wallet'];

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const pad = (n) => String(n).padStart(2, '0');
/** Local server time as a MySQL DATETIME string. */
export function now(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
export const toMinutes = (a, b) => Math.round((Date.parse(b.replace(' ', 'T')) - Date.parse(a.replace(' ', 'T'))) / 60000);
export const round2 = (n) => Math.round(n * 100) / 100;
export const fareFor = (base, cls) => round2(base * (cls === 'Business' ? BUSINESS_MULTIPLIER : 1));
export const amountFor = (base, cls) => round2(fareFor(base, cls) * (1 + TAX_RATE));

/** Booking reference shown to users (PNR-style). FRS000123 <-> booking_id 123 */
export const toRef = (id) => `FRS${String(id).padStart(6, '0')}`;
export const fromRef = (ref) => {
  const m = String(ref || '').trim().toUpperCase().match(/^(?:FRS)?0*(\d{1,9})$/);
  return m ? Number(m[1]) : null;
};
export const ticketNumber = (flightNumber, bookingId) => `TKT-${flightNumber}-${String(bookingId).padStart(5, '0')}`;

/** Seat inventory released for every flight: rows 1-2 Business (A C D F), rows 3-14 Economy (A-F). Same as seed.sql. */
export const SEAT_LAYOUT = [];
for (let r = 1; r <= 14; r++) for (const c of 'ABCDEF') if (r > 2 || 'ACDF'.includes(c)) SEAT_LAYOUT.push([`${r}${c}`, r <= 2 ? 'Business' : 'Economy']);

export const sha256 = (s) => crypto.createHash('sha256').update(String(s)).digest('hex');

// ---- Minimal signed token (HMAC-SHA256). Keeps the demo free of extra dependencies. ----
const secret = () => process.env.AUTH_SECRET || 'dev-only-secret';
const b64 = (s) => Buffer.from(s).toString('base64url');
export function signToken(payload, hours = 12) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + hours * 3600e3 }));
  return `${body}.${crypto.createHmac('sha256', secret()).update(body).digest('base64url')}`;
}
export function verifyToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(body, 'base64url').toString());
  return data.exp > Date.now() ? data : null;
}

export function authOptional(req, _res, next) {
  const h = req.headers.authorization || '';
  req.user = h.startsWith('Bearer ') ? verifyToken(h.slice(7)) : null;
  next();
}
export function requireAuth(req, _res, next) {
  if (!req.user) throw new HttpError(401, 'Please sign in to continue.');
  next();
}
export function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== 'Admin') throw new HttpError(403, 'Administrator access required.');
  next();
}

// ---- Validation helpers ----
export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(s || ''));
export const isPhone = (s) => /^\+?[0-9\s-]{10,15}$/.test(String(s || ''));
export const ids = (arr) => (Array.isArray(arr) ? arr.map(Number).filter((n) => Number.isInteger(n) && n > 0) : []);
