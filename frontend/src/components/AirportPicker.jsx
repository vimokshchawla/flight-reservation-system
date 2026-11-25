import { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { cx } from './ui';

/** Searchable airport combobox. value = IATA code. */
export default function AirportPicker({ label, icon: Icon = MapPin, airports, value, onChange, error, placeholder = 'City or airport' }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const selected = airports.find((a) => a.iata_code === value);

  useEffect(() => {
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false);
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const matches = useMemo(() => {
    const t = text.trim().toLowerCase();
    return airports.filter((a) => !t || `${a.iata_code} ${a.city_name} ${a.airport_name} ${a.country}`.toLowerCase().includes(t));
  }, [airports, text]);

  const pick = (a) => { onChange(a.iata_code); setOpen(false); setText(''); };

  return (
    <div ref={ref} className="relative">
      <span className="label">{label}</span>
      <div className={cx('flex h-14 items-center gap-3 rounded-xl border bg-white px-3.5 transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100', error ? 'border-red-400' : 'border-mist-300')}>
        <Icon className="h-5 w-5 shrink-0 text-ink-400" />
        <input
          className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-ink-900 outline-none placeholder:font-normal placeholder:text-ink-400"
          placeholder={selected ? `${selected.city_name} (${selected.iata_code})` : placeholder}
          value={open ? text : selected ? `${selected.city_name} (${selected.iata_code})` : ''}
          onFocus={() => { setOpen(true); setText(''); setActive(0); }}
          onChange={(e) => { setText(e.target.value); setActive(0); setOpen(true); }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && open && matches[active]) { e.preventDefault(); pick(matches[active]); }
            if (e.key === 'Escape') setOpen(false);
          }}
          aria-label={label}
        />
      </div>
      {selected && !open && <p className="mt-1 truncate text-xs text-ink-500">{selected.airport_name}</p>}
      {error && <p className="mt-1 text-xs font-medium text-red-600">{error}</p>}
      {open && (
        <ul className="absolute z-30 mt-2 max-h-80 w-full min-w-[280px] overflow-auto rounded-xl border border-mist-200 bg-white p-1.5 shadow-xl">
          {matches.length === 0 && <li className="px-3 py-3 text-sm text-ink-500">No airports match “{text}”.</li>}
          {matches.map((a, i) => (
            <li key={a.iata_code}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(a)} onMouseEnter={() => setActive(i)}
                className={cx('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left', i === active && 'bg-mist-100')}>
                <span className="w-11 rounded-md bg-ink-900 py-1 text-center text-xs font-bold tracking-wider text-white">{a.iata_code}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold">{a.city_name}, {a.country}</span>
                  <span className="block truncate text-xs text-ink-500">{a.airport_name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
