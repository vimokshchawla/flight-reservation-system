import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftRight, Minus, PlaneLanding, PlaneTakeoff, Plus, Search } from 'lucide-react';
import AirportPicker from './AirportPicker';
import { Button, cx } from './ui';
import { flightService } from '../services/api';
import { addDays, isoDate } from '../utils/format';

let airportCache = null;
export function useAirports() {
  const [state, setState] = useState({ airports: airportCache || [], loading: !airportCache, error: null });
  useEffect(() => {
    if (airportCache) return;
    flightService.airports()
      .then((a) => { airportCache = a; setState({ airports: a, loading: false, error: null }); })
      .catch((e) => setState({ airports: [], loading: false, error: e.message }));
  }, []);
  return state;
}

// Sample data in the database covers 1-21 Dec 2026; default to the Assignment-4 demo date while it is upcoming.
export const defaultDate = () => { const t = addDays(isoDate(), 1); return t < '2026-12-10' ? '2026-12-10' : t; };

export default function FlightSearchForm({ initial = {}, compact = false }) {
  const navigate = useNavigate();
  const { airports, loading, error: loadError } = useAirports();
  const [f, setF] = useState(() => ({
    trip: initial.trip || 'oneway', from: initial.from || 'DEL', to: initial.to || 'BOM',
    date: initial.date || defaultDate(), ret: initial.ret || '', pax: Number(initial.pax) || 1, cabin: initial.cabin || 'Economy',
  }));
  const [errors, setErrors] = useState({});
  const set = (k, v) => { setF((x) => ({ ...x, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); };
  const today = isoDate();
  const cityOf = (code) => airports.find((a) => a.iata_code === code)?.city_name;

  const submit = (e) => {
    e.preventDefault();
    const err = {};
    if (!f.from) err.from = 'Choose a departure airport';
    if (!f.to) err.to = 'Choose a destination';
    if (f.from && f.to && cityOf(f.from) === cityOf(f.to)) err.to = 'Destination must be a different city';
    if (!f.date || f.date < today) err.date = 'Choose today or a later date';
    if (f.trip === 'round' && (!f.ret || f.ret < f.date)) err.ret = 'Return must be on or after departure';
    setErrors(err);
    if (Object.keys(err).length) return;
    const p = new URLSearchParams({ from: f.from, to: f.to, date: f.date, pax: f.pax, cabin: f.cabin, trip: f.trip });
    if (f.trip === 'round') p.set('ret', f.ret);
    navigate(`/flights?${p}`);
  };

  return (
    <form onSubmit={submit} noValidate className={cx('panel', compact ? 'p-4 sm:p-5' : 'p-5 shadow-[0_30px_60px_-30px_rgba(6,17,31,0.45)] sm:p-7')}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-xl bg-mist-100 p-1" role="radiogroup" aria-label="Trip type">
          {[['oneway', 'One-way'], ['round', 'Round trip']].map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={f.trip === v} onClick={() => set('trip', v)}
              className={cx('rounded-lg px-4 py-2 text-sm font-semibold transition', f.trip === v ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-500 hover:text-ink-900')}>{l}</button>
          ))}
        </div>
        {loadError && <span className="text-xs font-medium text-red-600">Airports unavailable: {loadError}</span>}
      </div>

      <div className={cx('grid gap-4', compact ? 'md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_145px_145px_120px_125px_auto]' : 'md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]')}>
        <AirportPicker label="From" icon={PlaneTakeoff} airports={airports} value={f.from} onChange={(v) => set('from', v)} error={errors.from} placeholder={loading ? 'Loading airports…' : 'City or airport'} />
        <div className={cx('hidden items-start pt-7', compact ? 'xl:flex' : 'lg:flex')}>
          <button type="button" onClick={() => setF((x) => ({ ...x, from: x.to, to: x.from }))} aria-label="Swap airports"
            className="grid h-10 w-10 place-items-center rounded-full border border-mist-300 bg-white text-ink-700 transition hover:rotate-180 hover:border-ink-400"><ArrowLeftRight className="h-4 w-4" /></button>
        </div>
        <AirportPicker label="To" icon={PlaneLanding} airports={airports} value={f.to} onChange={(v) => set('to', v)} error={errors.to} placeholder={loading ? 'Loading airports…' : 'City or airport'} />

        <div className={compact ? 'contents' : 'grid grid-cols-2 gap-4 md:col-span-2 lg:col-span-3 lg:grid-cols-4'}>
          <label className="block">
            <span className="label">Departure</span>
            <input type="date" min={today} value={f.date} onChange={(e) => set('date', e.target.value)} className={cx('control h-14 font-semibold', errors.date && 'control-error')} />
            {errors.date && <span className="mt-1 block text-xs font-medium text-red-600">{errors.date}</span>}
          </label>
          <label className="block">
            <span className="label">Return</span>
            <input type="date" min={f.date || today} value={f.trip === 'round' ? f.ret : ''} disabled={f.trip !== 'round'}
              onChange={(e) => set('ret', e.target.value)} className={cx('control h-14 font-semibold', errors.ret && 'control-error')} />
            {errors.ret && <span className="mt-1 block text-xs font-medium text-red-600">{errors.ret}</span>}
          </label>
          <div>
            <span className="label">Passengers</span>
            <div className="flex h-14 items-center justify-between rounded-xl border border-mist-300 bg-white px-2">
              <button type="button" aria-label="Fewer passengers" disabled={f.pax <= 1} onClick={() => set('pax', f.pax - 1)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-700 hover:bg-mist-100 disabled:opacity-30"><Minus className="h-4 w-4" /></button>
              <span className="text-[15px] font-semibold">{f.pax}</span>
              <button type="button" aria-label="More passengers" disabled={f.pax >= 6} onClick={() => set('pax', f.pax + 1)} className="grid h-9 w-9 place-items-center rounded-lg text-ink-700 hover:bg-mist-100 disabled:opacity-30"><Plus className="h-4 w-4" /></button>
            </div>
          </div>
          <label className="block">
            <span className="label">Cabin</span>
            <select value={f.cabin} onChange={(e) => set('cabin', e.target.value)} className="control h-14 font-semibold">
              <option>Economy</option><option>Business</option>
            </select>
          </label>
          {compact && <div className="flex items-start md:col-span-2 md:pt-0 xl:col-span-1 xl:pt-[22px]"><Button type="submit" variant="brand" className="h-14 w-full px-6"><Search className="h-4 w-4" />Search</Button></div>}
        </div>
      </div>
      {!compact && (
        <div className="mt-6 flex flex-col-reverse items-stretch justify-between gap-4 border-t border-mist-200 pt-5 sm:flex-row sm:items-center">
          <p className="text-xs text-ink-500">Searches every airport in the selected city · up to 6 passengers per booking</p>
          <Button type="submit" variant="brand" size="lg" className="sm:min-w-56"><Search className="h-5 w-5" />Search flights</Button>
        </div>
      )}
    </form>
  );
}
