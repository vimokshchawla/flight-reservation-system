export const TAX_RATE = 0.12; // mirrors backend; the backend computes the amount actually charged

const inrFmt = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inrFmt2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const inr = (n, exact = false) => (exact ? inrFmt2 : inrFmt).format(Number(n) || 0);

export const parseDT = (s) => new Date(String(s).replace(' ', 'T'));
export const fmtTime = (s) => String(s).slice(11, 16);
export const fmtDate = (s, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) =>
  parseDT(String(s).length === 10 ? `${s}T00:00:00` : s).toLocaleDateString('en-GB', opts);
export const fmtDateTime = (s) => `${fmtDate(s, { day: 'numeric', month: 'short', year: 'numeric' })}, ${fmtTime(s)}`;
export const duration = (m) => `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
export const dayShift = (dep, arr) => Math.round((parseDT(arr.slice(0, 10)) - parseDT(dep.slice(0, 10))) / 864e5);

export const isoDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const addDays = (iso, n) => { const d = new Date(`${iso}T00:00:00`); d.setDate(d.getDate() + n); return isoDate(d); };

export const fareOf = (flight, cabin) => (cabin === 'Business' ? flight.business_fare : flight.economy_fare);
export const seatsOf = (flight, cabin) => (cabin === 'Business' ? flight.bus_available : flight.eco_available);
export const round2 = (n) => Math.round(n * 100) / 100;

export const timeBucket = (s) => {
  const h = Number(fmtTime(s).slice(0, 2));
  return h < 6 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
};

export const initials = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
