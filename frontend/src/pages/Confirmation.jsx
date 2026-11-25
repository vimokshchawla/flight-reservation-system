import { Link, useLocation } from 'react-router-dom';
import { CircleCheck, Download, Plane, Printer } from 'lucide-react';
import { Button, EmptyState, StatusBadge } from '../components/ui';
import { useTrip } from '../context/AppContext';
import { duration, fmtDate, fmtDateTime, fmtTime, inr } from '../utils/format';

export function TicketCard({ b }) {
  return (
    <article className="print-break overflow-hidden rounded-2xl border border-mist-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-ink-900 px-6 py-4 text-white">
        <div className="flex items-center gap-2.5"><Plane className="h-4 w-4 -rotate-45 text-gold-500" /><span className="font-display text-lg font-semibold">Skyroute e-ticket</span></div>
        <div className="text-right"><p className="text-[10px] uppercase tracking-[0.2em] text-white/60">Booking reference</p><p className="font-mono text-lg font-bold tracking-wider">{b.reference}</p></div>
      </div>
      <div className="grid md:grid-cols-[1fr_auto_240px]">
        <div className="p-6">
          <div className="flex items-center justify-between gap-4">
            <div><p className="text-3xl font-bold">{b.src_code}</p><p className="text-sm text-ink-500">{b.src_city}</p><p className="mt-2 text-lg font-semibold">{fmtTime(b.dep_datetime)}</p><p className="text-xs text-ink-500">{fmtDate(b.dep_datetime)}</p></div>
            <div className="flex flex-1 flex-col items-center px-2 text-xs text-ink-500">
              <span>{duration(b.duration_min)}</span>
              <span className="relative my-2 h-px w-full bg-mist-300"><Plane className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white text-ink-700" /></span>
              <span>{b.airline_name} · {b.flight_number}</span>
            </div>
            <div className="text-right"><p className="text-3xl font-bold">{b.dest_code}</p><p className="text-sm text-ink-500">{b.dest_city}</p><p className="mt-2 text-lg font-semibold">{fmtTime(b.arr_datetime)}</p><p className="text-xs text-ink-500">{fmtDate(b.arr_datetime)}</p></div>
          </div>
          <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-dashed border-mist-300 pt-5 text-sm sm:grid-cols-4">
            {[['Passenger', b.full_name], ['Seat', `${b.seat_number}`], ['Cabin', b.seat_class], ['Aircraft', b.model_number],
              ['Ticket no.', b.ticket_number || '—'], ['Amount', inr(b.amount, true)], ['Method', b.payment_method || '—'], ['Booked', fmtDateTime(b.booking_date)]].map(([k, v]) => (
              <div key={k} className="min-w-0"><dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{k}</dt><dd className="truncate font-semibold">{v}</dd></div>
            ))}
          </dl>
        </div>
        <div className="ticket-cut hidden w-6 md:block"><div className="mx-auto h-full w-px border-l border-dashed border-mist-300" /></div>
        <div className="flex flex-col justify-between gap-5 border-t border-dashed border-mist-300 bg-mist-50 p-6 md:border-t-0">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2"><span className="text-xs text-ink-500">Booking</span><StatusBadge status={b.status} /></div>
            <div className="flex items-center justify-between gap-2"><span className="text-xs text-ink-500">Payment</span><StatusBadge status={b.payment_status} /></div>
          </div>
          <div aria-hidden className="flex h-14 items-end gap-[2px]">
            {b.reference.split('').concat((b.ticket_number || '').split('')).map((c, i) => <span key={i} className="bg-ink-900" style={{ width: (c.charCodeAt(0) % 3) + 1, height: `${60 + (c.charCodeAt(0) * 7 % 40)}%` }} />)}
          </div>
          <p className="text-xs text-ink-500">Arrive at {b.src_code} at least 2 hours before departure with a valid photo ID.</p>
        </div>
      </div>
    </article>
  );
}

function downloadTickets(list) {
  const rows = list.map((b) => `
    <div class="t"><div class="h"><b>Skyroute e-ticket</b><span>${b.reference}</span></div>
    <h2>${b.src_code} → ${b.dest_code} <small>${b.src_city} to ${b.dest_city}</small></h2>
    <table>${[['Passenger', b.full_name], ['Flight', `${b.airline_name} ${b.flight_number} (${b.model_number})`], ['Departure', fmtDateTime(b.dep_datetime)], ['Arrival', fmtDateTime(b.arr_datetime)],
      ['Seat', `${b.seat_number} · ${b.seat_class}`], ['Ticket number', b.ticket_number || '-'], ['Booking status', b.status], ['Payment', `${b.payment_status} · ${b.payment_method || '-'} · ${inr(b.amount, true)}`]]
      .map(([k, v]) => `<tr><th>${k}</th><td>${String(v).replace(/</g, '&lt;')}</td></tr>`).join('')}</table></div>`).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Tickets ${list[0].reference}</title><style>
    body{font-family:Arial,sans-serif;background:#f6f8fb;padding:24px;color:#0b1f3a}.t{background:#fff;border:1px solid #dfe7f1;border-radius:14px;margin:0 auto 20px;max-width:680px;overflow:hidden}
    .h{background:#0b1f3a;color:#fff;padding:14px 20px;display:flex;justify-content:space-between;font-family:monospace;font-size:16px}h2{margin:18px 20px 6px}small{font-size:13px;color:#52688a;font-weight:normal}
    table{width:calc(100% - 40px);margin:0 20px 20px;border-collapse:collapse}th,td{text-align:left;padding:8px 0;border-bottom:1px solid #eef3f9;font-size:14px}th{color:#52688a;width:40%}</style></head><body>${rows}</body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
  a.download = `ticket-${list[0].reference}.html`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function Confirmation() {
  const { state } = useLocation();
  const { trip } = useTrip();
  const list = state?.bookings || trip.confirmed || [];
  if (!list.length) return <div className="container-x py-16"><EmptyState title="No ticket to show" text="Find your booking with its reference and email." action={<Link to="/my-bookings"><Button>My bookings</Button></Link>} /></div>;
  const fresh = !state?.bookings;
  const confirmed = list.every((b) => b.status === 'Confirmed');

  return (
    <div className="container-x max-w-5xl py-10">
      {fresh && confirmed ? (
        <div className="no-print mb-8 flex flex-col items-center text-center">
          <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600"><CircleCheck className="h-8 w-8" /></span>
          <h1 className="mt-4 font-display text-3xl font-semibold">Booking confirmed</h1>
          <p className="mt-2 max-w-lg text-ink-500">Payment received. {list.length > 1 ? `${list.length} tickets have` : 'Your ticket has'} been issued — a copy is available any time in My bookings.</p>
        </div>
      ) : (
        <h1 className="no-print mb-6 font-display text-3xl font-semibold">Your ticket{list.length > 1 ? 's' : ''}</h1>
      )}
      <div className="no-print mb-6 flex flex-wrap justify-center gap-3">
        <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" />Print ticket</Button>
        <Button variant="secondary" onClick={() => downloadTickets(list)}><Download className="h-4 w-4" />Download ticket</Button>
        <Link to="/my-bookings"><Button variant="ghost">Manage bookings</Button></Link>
      </div>
      <div className="space-y-5">{list.map((b) => <TicketCard key={b.booking_id} b={b} />)}</div>
    </div>
  );
}
