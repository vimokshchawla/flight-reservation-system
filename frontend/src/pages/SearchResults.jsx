import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CalendarX2, Moon, Plane, SlidersHorizontal, Sun, Sunrise, Sunset, X } from 'lucide-react';
import FlightSearchForm, { useAirports } from '../components/FlightSearchForm';
import { Alert, AirlineMark, Button, EmptyState, Stepper, cx } from '../components/ui';
import { flightService } from '../services/api';
import { useTrip } from '../context/AppContext';
import { addDays, dayShift, duration, fareOf, fmtDate, fmtTime, inr, seatsOf, timeBucket } from '../utils/format';

const BUCKETS = [['night', 'Before 6 AM', Moon], ['morning', '6 AM – 12 PM', Sunrise], ['afternoon', '12 – 6 PM', Sun], ['evening', 'After 6 PM', Sunset]];
const SORTS = [['price', 'Cheapest'], ['duration', 'Fastest'], ['departure', 'Earliest']];

export function FlightRow({ f, cabin, pax, onSelect, compact }) {
  const seats = seatsOf(f, cabin);
  const soldOut = seats < pax;
  const shift = dayShift(f.dep_datetime, f.arr_datetime);
  return (
    <div className={cx('panel grid items-center gap-4 p-4 transition sm:p-5', !compact && 'hover:border-mist-300 hover:shadow-[0_12px_30px_-18px_rgba(11,31,58,0.35)] md:grid-cols-[200px_1fr_150px]', soldOut && 'opacity-60')}>
      <div className="flex items-center gap-3">
        <AirlineMark name={f.airline_name} id={f.airline_id} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{f.airline_name}</p>
          <p className="text-xs text-ink-500">{f.flight_number} · {f.model_number}</p>
        </div>
      </div>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 sm:gap-5">
        <div>
          <p className="text-2xl font-bold tabular-nums">{fmtTime(f.dep_datetime)}</p>
          <p className="text-xs font-semibold text-ink-500" title={f.src_name}>{f.src_code}</p>
        </div>
        <div className="text-center">
          <p className="text-xs font-medium text-ink-500">{duration(f.duration_min)}</p>
          <div className="relative my-1.5 h-px bg-mist-300"><Plane className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rotate-45 bg-white text-ink-400" /></div>
          <p className="text-xs text-ink-400">Non-stop</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold tabular-nums">{fmtTime(f.arr_datetime)}{shift > 0 && <sup className="ml-0.5 text-xs font-semibold text-gold-600">+{shift}</sup>}</p>
          <p className="text-xs font-semibold text-ink-500" title={f.dest_name}>{f.dest_code}</p>
        </div>
      </div>
      {!compact && (
        <div className="flex items-center justify-between gap-3 border-t border-mist-200 pt-4 md:flex-col md:items-end md:border-0 md:pt-0">
          <div className="md:text-right">
            <p className="text-xl font-bold">{inr(fareOf(f, cabin))}</p>
            <p className={cx('text-xs font-medium', soldOut ? 'text-red-600' : seats <= 8 ? 'text-gold-600' : 'text-ink-500')}>
              {soldOut ? 'Not enough seats' : `${seats} ${cabin.toLowerCase()} seats left`}
            </p>
          </div>
          <Button size="sm" variant="brand" disabled={soldOut} onClick={() => onSelect(f)} className="px-5">Select</Button>
        </div>
      )}
    </div>
  );
}

export default function SearchResults() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { trip, setTrip } = useTrip();
  const { airports } = useAirports();
  const q = Object.fromEntries(params);
  const pax = Number(q.pax) || 1, cabin = q.cabin === 'Business' ? 'Business' : 'Economy';
  const isReturn = q.trip === 'round' && q.leg === 'ret';
  const leg = isReturn ? { from: q.to, to: q.from, date: q.ret } : { from: q.from, to: q.to, date: q.date };
  const outbound = isReturn ? trip.outbound : null;

  const [state, setState] = useState({ loading: true });
  const [filters, setFilters] = useState({ maxPrice: null, times: [], airlines: [], sort: 'price' });
  const [showFilters, setShowFilters] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const load = () => {
    setState({ loading: true });
    flightService.search(leg).then((d) => setState({ ...d, loading: false })).catch((e) => setState({ loading: false, error: e.message }));
  };
  useEffect(() => { if (leg.from && leg.to && leg.date) load(); setFilters((x) => ({ ...x, maxPrice: null, times: [], airlines: [] })); }, [leg.from, leg.to, leg.date]); // eslint-disable-line

  const all = useMemo(() => (state.flights || []).filter((f) => !outbound || f.dep_datetime > outbound.arr_datetime), [state.flights, outbound]);
  const priceMax = Math.max(0, ...all.map((f) => fareOf(f, cabin)));
  const priceMin = all.length ? Math.min(...all.map((f) => fareOf(f, cabin))) : 0;
  const airlines = [...new Map(all.map((f) => [f.airline_id, f.airline_name])).entries()];
  const shown = useMemo(() => {
    const list = all.filter((f) => (filters.maxPrice == null || fareOf(f, cabin) <= filters.maxPrice)
      && (!filters.times.length || filters.times.includes(timeBucket(f.dep_datetime)))
      && (!filters.airlines.length || filters.airlines.includes(f.airline_id)));
    const key = { price: (f) => fareOf(f, cabin), duration: (f) => f.duration_min, departure: (f) => f.dep_datetime }[filters.sort];
    return list.sort((a, b) => (key(a) > key(b) ? 1 : key(a) < key(b) ? -1 : 0));
  }, [all, filters, cabin]);
  const toggle = (k, v) => setFilters((x) => ({ ...x, [k]: x[k].includes(v) ? x[k].filter((y) => y !== v) : [...x[k], v] }));
  const activeFilters = filters.times.length + filters.airlines.length + (filters.maxPrice != null ? 1 : 0);
  const city = (code) => airports.find((a) => a.iata_code === code)?.city_name || code;

  const select = (f) => {
    const search = { ...q, pax, cabin };
    if (q.trip === 'round' && !isReturn) {
      setTrip({ search, outbound: f, inbound: null, bookingIds: null, confirmed: null });
      setParams({ ...q, leg: 'ret' });
    } else if (isReturn) {
      setTrip({ inbound: f, bookingIds: null, confirmed: null });
      navigate('/booking');
    } else {
      setTrip({ search, outbound: f, inbound: null, bookingIds: null, confirmed: null });
      navigate('/booking');
    }
  };
  const goDate = (d) => setParams({ ...q, [isReturn ? 'ret' : 'date']: d });

  if (isReturn && !outbound) return <div className="container-x py-16"><EmptyState title="Choose your outbound flight first" action={<Button onClick={() => setParams({ ...q, leg: 'out' })}>Back to outbound flights</Button>} /></div>;

  const filterPanel = (
    <div className="space-y-7">
      <div>
        <div className="flex items-center justify-between"><h4 className="label mb-0">Max price</h4><span className="text-sm font-semibold">{inr(filters.maxPrice ?? priceMax)}</span></div>
        <input type="range" className="mt-3 w-full accent-brand-600" min={priceMin} max={priceMax || 1} step={50} value={filters.maxPrice ?? priceMax}
          onChange={(e) => setFilters((x) => ({ ...x, maxPrice: Number(e.target.value) }))} disabled={!all.length} aria-label="Maximum price" />
        <div className="flex justify-between text-xs text-ink-400"><span>{inr(priceMin)}</span><span>{inr(priceMax)}</span></div>
      </div>
      <div>
        <h4 className="label">Departure time</h4>
        <div className="grid grid-cols-2 gap-2">
          {BUCKETS.map(([v, l, Icon]) => (
            <button key={v} type="button" onClick={() => toggle('times', v)} aria-pressed={filters.times.includes(v)}
              className={cx('flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-xs font-medium transition', filters.times.includes(v) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-mist-300 text-ink-700 hover:border-ink-400')}>
              <Icon className="h-4 w-4" />{l}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h4 className="label">Airlines</h4>
        <div className="space-y-2.5">
          {airlines.length === 0 && <p className="text-sm text-ink-400">—</p>}
          {airlines.map(([id, name]) => (
            <label key={id} className="flex cursor-pointer items-center gap-3 text-sm">
              <input type="checkbox" checked={filters.airlines.includes(id)} onChange={() => toggle('airlines', id)} className="h-4 w-4 rounded accent-brand-600" />
              <AirlineMark name={name} id={id} size="sm" /><span className="flex-1">{name}</span>
              <span className="text-xs text-ink-400">{all.filter((f) => f.airline_id === id).length}</span>
            </label>
          ))}
        </div>
      </div>
      {activeFilters > 0 && <Button variant="ghost" size="sm" className="w-full" onClick={() => setFilters((x) => ({ ...x, maxPrice: null, times: [], airlines: [] }))}>Clear all filters</Button>}
    </div>
  );

  return (
    <div className="pb-8">
      <div className="border-b border-mist-200 bg-white">
        <div className="container-x py-4 md:py-5">
          <button onClick={() => setEditOpen(!editOpen)} className="flex w-full items-center justify-between gap-3 text-left md:hidden">
            <span className="min-w-0 text-sm"><span className="block font-semibold">{q.from} → {q.to}{q.trip === 'round' ? ` → ${q.from}` : ''}</span><span className="text-ink-500">{q.date && fmtDate(q.date)} · {pax} pax · {cabin}</span></span>
            <span className="rounded-lg border border-mist-300 px-3 py-1.5 text-sm font-semibold">{editOpen ? 'Close' : 'Edit'}</span>
          </button>
          <div className={cx(!editOpen && 'hidden', 'mt-4 md:mt-0 md:block')}><FlightSearchForm compact initial={q} key={params.toString().replace(/&?leg=\w+/, '')} /></div>
        </div>
      </div>

      <div className="container-x pt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="eyebrow">{q.trip === 'round' ? (isReturn ? 'Step 2 of 2 · Return flight' : 'Step 1 of 2 · Outbound flight') : 'Select your flight'}</p>
            <h1 className="mt-1.5 flex flex-wrap items-center gap-x-3 font-display text-2xl font-semibold sm:text-3xl">
              {city(leg.from)} <ArrowRight className="h-5 w-5 text-ink-400" /> {city(leg.to)}
            </h1>
            <p className="mt-1 text-sm text-ink-500">{leg.date && fmtDate(leg.date)} · {pax} passenger{pax > 1 ? 's' : ''} · {cabin}</p>
          </div>
          <Stepper step={0} />
        </div>

        {outbound && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm">
            <span><span className="font-semibold text-emerald-800">Outbound selected:</span> {outbound.flight_number} · {outbound.src_code} {fmtTime(outbound.dep_datetime)} → {outbound.dest_code} {fmtTime(outbound.arr_datetime)} · {fmtDate(outbound.dep_datetime)}</span>
            <button className="font-semibold text-emerald-800 underline-offset-2 hover:underline" onClick={() => setParams({ ...q, leg: 'out' })}>Change</button>
          </div>
        )}

        {state.nearby?.length > 0 && (
          <div className="mt-6 flex gap-2 overflow-x-auto pb-1">
            {Array.from({ length: 7 }, (_, i) => addDays(leg.date, i - 3)).map((d) => {
              const n = state.nearby.find((x) => x.date === d);
              const active = d === leg.date;
              return (
                <button key={d} onClick={() => n && goDate(d)} disabled={!n}
                  className={cx('min-w-[104px] flex-1 rounded-xl border px-3 py-2.5 text-center transition', active ? 'border-ink-900 bg-ink-900 text-white' : n ? 'border-mist-300 bg-white hover:border-ink-400' : 'border-mist-200 bg-mist-50 text-ink-400')}>
                  <span className="block text-xs font-medium opacity-80">{fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                  <span className="mt-0.5 block text-sm font-bold">{n ? inr(cabin === 'Business' ? n.min_fare * 2.5 : n.min_fare) : 'No flights'}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[260px_1fr]">
          <aside className="hidden lg:block"><div className="panel sticky top-24 p-5">{filterPanel}</div></aside>
          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-500">{state.loading ? 'Searching flights…' : `${shown.length} of ${all.length} flights`}</p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setShowFilters(true)}><SlidersHorizontal className="h-4 w-4" />Filters{activeFilters ? ` (${activeFilters})` : ''}</Button>
                <div className="inline-flex rounded-xl border border-mist-300 bg-white p-1">
                  {SORTS.map(([v, l]) => (
                    <button key={v} onClick={() => setFilters((x) => ({ ...x, sort: v }))} className={cx('rounded-lg px-3 py-1.5 text-sm font-semibold', filters.sort === v ? 'bg-ink-900 text-white' : 'text-ink-500 hover:text-ink-900')}>{l}</button>
                  ))}
                </div>
              </div>
            </div>
            {state.error && <Alert tone="error" title="Could not load flights" onRetry={load}>{state.error}</Alert>}
            <div className="space-y-3">
              {state.loading && Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-mist-200/70" />)}
              {!state.loading && !state.error && shown.map((f) => <FlightRow key={f.flight_id} f={f} cabin={cabin} pax={pax} onSelect={select} />)}
              {!state.loading && !state.error && shown.length === 0 && (
                <div className="panel">
                  <EmptyState icon={CalendarX2} title={all.length ? 'No flights match your filters' : 'No flights on this date'}
                    text={all.length ? 'Try widening the price range or clearing filters.' : state.nearby?.length ? 'Pick one of the nearby dates above that has flights.' : 'There are no upcoming flights on this route around this date. Try another route or date.'}
                    action={all.length ? <Button variant="secondary" onClick={() => setFilters((x) => ({ ...x, maxPrice: null, times: [], airlines: [] }))}>Clear filters</Button> : null} />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-50 flex justify-end bg-ink-950/40 lg:hidden" onClick={() => setShowFilters(false)}>
          <div className="h-full w-[min(340px,90vw)] overflow-y-auto bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between"><h3 className="text-lg font-semibold">Filters</h3><button onClick={() => setShowFilters(false)} aria-label="Close"><X className="h-5 w-5" /></button></div>
            {filterPanel}
            <Button className="mt-8 w-full" onClick={() => setShowFilters(false)}>Show {shown.length} flights</Button>
          </div>
        </div>
      )}
    </div>
  );
}
