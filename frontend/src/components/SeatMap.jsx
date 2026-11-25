import { cx } from './ui';

const LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** Seat map built from SEAT rows. selected: array of seat_id per passenger (index = passenger). */
export default function SeatMap({ seats, cabin, selected, activePax, onPick }) {
  const byNumber = new Map(seats.map((s) => [s.seat_number, s]));
  const rows = [...new Set(seats.map((s) => parseInt(s.seat_number, 10)))].sort((a, b) => a - b);
  const paxOf = (id) => selected.indexOf(id);

  return (
    <div className="overflow-x-auto">
      <div className="mx-auto w-max rounded-[2.5rem] border border-mist-200 bg-mist-50 px-5 pb-6 pt-8 sm:px-8">
        <div className="mb-3 grid grid-cols-[repeat(3,2.25rem)_1.75rem_repeat(3,2.25rem)] gap-1.5 text-center text-[11px] font-semibold text-ink-400 sm:grid-cols-[repeat(3,2.5rem)_2rem_repeat(3,2.5rem)]">
          {LETTERS.slice(0, 3).map((l) => <span key={l}>{l}</span>)}<span />{LETTERS.slice(3).map((l) => <span key={l}>{l}</span>)}
        </div>
        {rows.map((r) => {
          const first = byNumber.get(`${r}A`);
          const isBusinessRow = first?.seat_class === 'Business';
          const prev = byNumber.get(`${r - 1}A`);
          return (
            <div key={r}>
              {prev && prev.seat_class !== first?.seat_class && <div className="my-3 border-t border-dashed border-mist-300 pt-2 text-center text-[10px] font-semibold uppercase tracking-widest text-ink-400">Economy</div>}
              {r === rows[0] && isBusinessRow && <div className="mb-2 text-center text-[10px] font-semibold uppercase tracking-widest text-gold-600">Business</div>}
              <div className="mb-1.5 grid grid-cols-[repeat(3,2.25rem)_1.75rem_repeat(3,2.25rem)] gap-1.5 sm:grid-cols-[repeat(3,2.5rem)_2rem_repeat(3,2.5rem)]">
                {LETTERS.map((l, i) => {
                  const s = byNumber.get(`${r}${l}`);
                  const aisle = i === 3 ? [<span key="aisle" className="grid place-items-center text-[11px] font-medium text-ink-400">{r}</span>] : [];
                  if (!s) return [...aisle, <span key={l} />];
                  const p = paxOf(s.seat_id);
                  const wrongCabin = s.seat_class !== cabin;
                  const disabled = (!s.available || wrongCabin) && p < 0;
                  return [...aisle, (
                    <button key={l} type="button" disabled={disabled} onClick={() => onPick(s)}
                      title={`${s.seat_number} · ${s.seat_class}${!s.available ? ' · occupied' : ''}`}
                      aria-label={`Seat ${s.seat_number} ${s.seat_class}${!s.available ? ' occupied' : p >= 0 ? ` selected for passenger ${p + 1}` : ''}`}
                      className={cx('grid h-9 place-items-center rounded-t-lg rounded-b-md text-[11px] font-bold transition sm:h-10',
                        p >= 0 ? (p === activePax ? 'bg-brand-600 text-white ring-2 ring-brand-100' : 'bg-brand-500 text-white')
                          : !s.available ? 'bg-ink-700/80 text-white/60' : wrongCabin ? 'bg-mist-200 text-ink-400' :
                            s.seat_class === 'Business' ? 'border border-gold-500/50 bg-gold-100 text-ink-800 hover:bg-gold-500 hover:text-white' : 'border border-mist-300 bg-white text-ink-700 hover:border-brand-500 hover:bg-brand-50')}>
                      {p >= 0 ? `P${p + 1}` : !s.available ? '×' : s.seat_number}
                    </button>
                  )];
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-ink-500">
        {[['bg-white border border-mist-300', 'Available'], ['bg-brand-600', 'Selected'], ['bg-ink-700/80', 'Occupied'], ['bg-mist-200', 'Other cabin']].map(([c, l]) => (
          <span key={l} className="flex items-center gap-1.5"><span className={cx('h-3.5 w-3.5 rounded', c)} />{l}</span>
        ))}
      </div>
    </div>
  );
}
