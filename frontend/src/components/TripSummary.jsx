import { Plane } from 'lucide-react';
import { AirlineMark } from './ui';
import { duration, fmtDate, fmtTime, inr, round2, TAX_RATE } from '../utils/format';

export function LegCard({ f, label }) {
  return (
    <div className="rounded-xl border border-mist-200 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-500">{label}</span>
        <span className="text-xs text-ink-500">{fmtDate(f.dep_datetime)}</span>
      </div>
      <div className="flex items-center gap-3">
        <AirlineMark name={f.airline_name} id={f.airline_id ?? 0} size="sm" />
        <div className="flex flex-1 items-center justify-between gap-2">
          <div><p className="font-bold">{fmtTime(f.dep_datetime)}</p><p className="text-xs text-ink-500">{f.src_code}</p></div>
          <div className="flex flex-1 flex-col items-center text-[11px] text-ink-400"><span>{duration(f.duration_min)}</span><span className="relative my-1 h-px w-full bg-mist-300"><Plane className="absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white" /></span><span>{f.flight_number}</span></div>
          <div className="text-right"><p className="font-bold">{fmtTime(f.arr_datetime)}</p><p className="text-xs text-ink-500">{f.dest_code}</p></div>
        </div>
      </div>
    </div>
  );
}

/** Fare breakdown: per-leg fare x passengers, 12% taxes & fees. Backend recalculates the charged amount. */
export function FareBreakdown({ legs, pax, cabin }) {
  const base = round2(legs.reduce((s, f) => s + (cabin === 'Business' ? f.business_fare : f.economy_fare) * pax, 0));
  const taxes = round2(base * TAX_RATE);
  return (
    <div className="space-y-2.5 text-sm">
      {legs.map((f) => (
        <div key={f.flight_id} className="flex justify-between gap-3 text-ink-700">
          <span>{f.src_code} → {f.dest_code} · {cabin} × {pax}</span>
          <span className="font-medium tabular-nums">{inr((cabin === 'Business' ? f.business_fare : f.economy_fare) * pax)}</span>
        </div>
      ))}
      <div className="flex justify-between gap-3 text-ink-700"><span>Taxes & fees (12%)</span><span className="font-medium tabular-nums">{inr(taxes, true)}</span></div>
      <div className="flex items-baseline justify-between gap-3 border-t border-mist-200 pt-3">
        <span className="font-semibold">Total</span><span className="text-2xl font-bold tabular-nums">{inr(base + taxes, true)}</span>
      </div>
    </div>
  );
}
