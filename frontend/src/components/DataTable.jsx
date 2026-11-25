import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { EmptyState, Input, Select, cx } from './ui';

/**
 * Client-side table with search, column sorting, select filters and pagination.
 * columns: [{ key, label, render?(row), sortValue?(row), sortable?, className? }]
 * filters: [{ key, label, options: [[value,label]], test(row, value) }]
 */
export default function DataTable({ rows = [], columns, searchKeys = [], filters = [], actions, pageSize = 12, loading, empty = 'No records found', toolbar }) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState({ key: null, dir: 1 });
  const [active, setActive] = useState({});
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const t = query.trim().toLowerCase();
    let list = rows.filter((r) => (!t || searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(t)))
      && filters.every((f) => !active[f.key] || f.test(r, active[f.key])));
    if (sort.key) {
      const col = columns.find((c) => c.key === sort.key);
      const val = col.sortValue || ((r) => r[col.key]);
      list = [...list].sort((a, b) => { const x = val(a), y = val(b); return (x > y ? 1 : x < y ? -1 : 0) * sort.dir; });
    }
    return list;
  }, [rows, query, active, sort, columns, filters, searchKeys]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const slice = filtered.slice(current * pageSize, current * pageSize + pageSize);
  const toggleSort = (k) => { setSort((s) => ({ key: k, dir: s.key === k ? -s.dir : 1 })); setPage(0); };

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-mist-200 p-4">
        <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-ink-400" />
          <Input value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} placeholder="Search…" className="h-10 pl-9" aria-label="Search table" />
        </div>
        {filters.map((f) => (
          <Select key={f.key} value={active[f.key] || ''} onChange={(e) => { setActive((a) => ({ ...a, [f.key]: e.target.value })); setPage(0); }} className="h-10 w-auto min-w-36 text-sm" aria-label={f.label}>
            <option value="">{f.label}: All</option>
            {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </Select>
        ))}
        <div className="ml-auto flex items-center gap-2">{toolbar}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-mist-50 text-xs uppercase tracking-wider text-ink-500">
            <tr>
              {columns.map((c) => (
                <th key={c.key} className={cx('whitespace-nowrap px-4 py-3 font-semibold', c.className)}>
                  {c.sortable === false ? c.label : (
                    <button onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 hover:text-ink-900">
                      {c.label}{sort.key === c.key ? (sort.dir > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 opacity-40" />}
                    </button>
                  )}
                </th>
              ))}
              {actions && <th className="px-4 py-3 text-right font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-mist-200">
            {loading && Array.from({ length: 6 }).map((_, i) => <tr key={i}><td colSpan={columns.length + 1} className="px-4 py-3"><div className="h-5 animate-pulse rounded bg-mist-100" /></td></tr>)}
            {!loading && slice.map((r, i) => (
              <tr key={r.id ?? i} className="hover:bg-mist-50/70">
                {columns.map((c) => <td key={c.key} className={cx('px-4 py-3 align-middle', c.className)}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
                {actions && <td className="whitespace-nowrap px-4 py-2 text-right">{actions(r)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && <EmptyState title={empty} text={rows.length ? 'Try a different search or filter.' : undefined} />}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist-200 px-4 py-3 text-sm text-ink-500">
        <span>{filtered.length ? `${current * pageSize + 1}–${Math.min(filtered.length, (current + 1) * pageSize)} of ${filtered.length}` : '0 records'}{filtered.length !== rows.length && ` (filtered from ${rows.length})`}</span>
        <div className="flex items-center gap-1">
          <button disabled={current === 0} onClick={() => setPage(current - 1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-mist-100 disabled:opacity-30" aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></button>
          <span className="px-2 font-medium text-ink-700">Page {current + 1} / {pages}</span>
          <button disabled={current >= pages - 1} onClick={() => setPage(current + 1)} className="grid h-8 w-8 place-items-center rounded-lg hover:bg-mist-100 disabled:opacity-30" aria-label="Next page"><ChevronRight className="h-4 w-4" /></button>
        </div>
      </div>
    </div>
  );
}
