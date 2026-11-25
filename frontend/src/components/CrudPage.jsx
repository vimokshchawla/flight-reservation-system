import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import DataTable from './DataTable';
import { Alert, Button, Field, Input, Modal, Select, useToast } from './ui';
import { adminService } from '../services/api';

/**
 * Generic admin CRUD screen backed by /api/admin/:resource.
 * fields: [{ name, label, type: text|number|email|datetime-local|select, required, options?(lookups) => [[v,l]], span?, min?, step? }]
 */
export default function CrudPage({ resource, title, singular, description, columns, fields, searchKeys, filters, toForm = (r) => r, idKey, needsLookups, canDelete = true }) {
  const toast = useToast();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lookups, setLookups] = useState({ airlines: [], aircraft: [], airports: [] });
  const [editing, setEditing] = useState(null); // {id|null, values}
  const [formErr, setFormErr] = useState({});
  const [saveErr, setSaveErr] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    return adminService.list(resource).then((r) => setRows(r.map((x) => ({ ...x, id: x[idKey] }))))
      .catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [resource, idKey]);
  useEffect(() => { load(); if (needsLookups) adminService.lookups().then(setLookups).catch(() => {}); }, [load, needsLookups]);

  const open = (row) => { setFormErr({}); setSaveErr(null); setEditing({ id: row?.id ?? null, values: row ? toForm(row) : Object.fromEntries(fields.map((f) => [f.name, f.default ?? ''])) }); };
  const setVal = (k, v) => { setEditing((e) => ({ ...e, values: { ...e.values, [k]: v } })); setFormErr((x) => ({ ...x, [k]: undefined })); };

  const save = async () => {
    const errs = {};
    for (const f of fields) {
      const v = editing.values[f.name];
      if (f.required && (v === '' || v == null)) errs[f.name] = `${f.label} is required`;
      else if (f.type === 'number' && v !== '' && (Number.isNaN(Number(v)) || Number(v) < (f.min ?? 0))) errs[f.name] = `Must be at least ${f.min ?? 0}`;
      else if (f.type === 'email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) errs[f.name] = 'Enter a valid email';
      else if (f.validate) { const m = f.validate(v, editing.values); if (m) errs[f.name] = m; }
    }
    setFormErr(errs);
    if (Object.keys(errs).length) return;
    setSaving(true); setSaveErr(null);
    try {
      if (editing.id == null) await adminService.create(resource, editing.values);
      else await adminService.update(resource, editing.id, editing.values);
      toast(`${singular} ${editing.id == null ? 'added' : 'updated'}.`);
      setEditing(null);
      load();
    } catch (e) { setSaveErr(e.message); } finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await adminService.remove(resource, deleting.id);
      toast(`${singular} deleted.`);
      setDeleting(null);
      load();
    } catch (e) { toast(e.message, 'error'); setDeleting(null); } finally { setSaving(false); }
  };

  return (
    <section>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="font-display text-2xl font-semibold">{title}</h2>{description && <p className="mt-1 max-w-2xl text-sm text-ink-500">{description}</p>}</div>
        <Button onClick={() => open(null)}><Plus className="h-4 w-4" />Add {singular.toLowerCase()}</Button>
      </div>
      {error && <Alert tone="error" className="mb-4" onRetry={load}>{error}</Alert>}
      <DataTable rows={rows} columns={columns} loading={loading} searchKeys={searchKeys} filters={filters}
        actions={(r) => (
          <div className="inline-flex gap-1">
            <Button size="icon" variant="ghost" onClick={() => open(r)} aria-label={`Edit ${singular}`} title="Edit"><Pencil className="h-4 w-4" /></Button>
            {canDelete && <Button size="icon" variant="danger-ghost" onClick={() => setDeleting(r)} aria-label={`Delete ${singular}`} title="Delete"><Trash2 className="h-4 w-4" /></Button>}
          </div>
        )} />

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`${editing?.id == null ? 'Add' : 'Edit'} ${singular.toLowerCase()}`} width="max-w-2xl"
        footer={<><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button loading={saving} onClick={save}>{editing?.id == null ? 'Create' : 'Save changes'}</Button></>}>
        {editing && (
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <Field key={f.name} label={f.label + (f.required ? '' : ' (optional)')} error={formErr[f.name]} hint={f.hint} className={f.span ? 'sm:col-span-2' : ''}>
                {f.type === 'select' ? (
                  <Select value={editing.values[f.name] ?? ''} error={formErr[f.name]} onChange={(e) => setVal(f.name, e.target.value)}>
                    <option value="">Select…</option>
                    {f.options(lookups).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                ) : (
                  <Input type={f.type || 'text'} min={f.min} step={f.step} value={editing.values[f.name] ?? ''} error={formErr[f.name]} placeholder={f.placeholder} onChange={(e) => setVal(f.name, e.target.value)} />
                )}
              </Field>
            ))}
            {saveErr && <Alert tone="error" className="sm:col-span-2" title="The database rejected this change">{saveErr}</Alert>}
          </div>
        )}
      </Modal>

      <Modal open={!!deleting} onClose={() => setDeleting(null)} title={`Delete ${singular.toLowerCase()}?`}
        footer={<><Button variant="secondary" onClick={() => setDeleting(null)}>Keep it</Button><Button variant="danger" loading={saving} onClick={remove}>Delete</Button></>}>
        <p className="text-sm text-ink-700">This permanently removes the record. Records that other tables depend on are protected by foreign keys and will be refused.</p>
      </Modal>
    </section>
  );
}
