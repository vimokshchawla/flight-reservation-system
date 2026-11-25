// Embedded SQLite database (built into Node.js 22.13+). No database server to install.
// On first start the file is created from database/sqlite/schema.sql + seed.sql (bundled in src/sql.js).
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { schemaSql, seedSql } from './sql.js';

// getBuiltinModule works in both ES modules and bundled CommonJS (no top-level await / import.meta needed)
const sqlite = typeof process.getBuiltinModule === 'function' ? process.getBuiltinModule('node:sqlite') : null;
if (!sqlite?.DatabaseSync) {
  throw new Error(`This backend needs Node.js 22.13 or newer (running ${process.version}). Install the LTS version from https://nodejs.org`);
}
const { DatabaseSync } = sqlite;
// Use backend/data locally; if that folder is read-only (Vercel, other serverless hosts) use the temp folder.
function pickDbFile() {
  const local = path.resolve(process.cwd(), process.env.DB_FILE || 'data/flight_reservation.db');
  if (!process.env.VERCEL) {
    try { fs.mkdirSync(path.dirname(local), { recursive: true }); fs.accessSync(path.dirname(local), fs.constants.W_OK); return local; } catch { /* read-only */ }
  }
  return path.join(os.tmpdir(), 'flight_reservation.db');
}
export const DB_FILE = pickDbFile();

if (process.argv.includes('--reset') && fs.existsSync(DB_FILE)) fs.rmSync(DB_FILE);
const fresh = !fs.existsSync(DB_FILE);
const db = new DatabaseSync(DB_FILE);
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;');
if (fresh) {
  console.log('Creating database with sample data (first run)...');
  db.exec(schemaSql);
  db.exec(seedSql);
  console.log(`Database ready: ${DB_FILE}`);
}
if (process.argv.includes('--reset')) process.exit(0);

// Expand array parameters like mysql2: IN (?) with [1,2,3]  and  VALUES ? with [[a,b],[c,d]]
function expand(sql, params) {
  const out = [];
  let i = 0;
  const text = sql.replace(/\?/g, () => {
    const p = params[i++];
    if (Array.isArray(p)) {
      if (Array.isArray(p[0])) { p.forEach((r) => out.push(...r)); return p.map((r) => `(${r.map(() => '?').join(',')})`).join(','); }
      out.push(...p); return p.map(() => '?').join(',');
    }
    out.push(p === undefined ? null : p);
    return '?';
  });
  return [text, out];
}

// Give SQLite errors the same codes the routes already handle (MySQL style)
function mapError(e, sql) {
  const m = e.message || '';
  const err = new Error(m);
  err.sqlMessage = m;
  err.code = /UNIQUE/.test(m) ? 'ER_DUP_ENTRY'
    : /FOREIGN KEY/.test(m) ? (/^\s*DELETE/i.test(sql) ? 'ER_ROW_IS_REFERENCED_2' : 'ER_NO_REFERENCED_ROW_2')
      : /CHECK/.test(m) ? 'ER_CHECK_CONSTRAINT_VIOLATED' : 'DB_ERROR';
  return err;
}

function run(sql, params = []) {
  const [text, values] = expand(sql, params);
  try {
    const st = db.prepare(text);
    if (/^\s*(SELECT|WITH)/i.test(text)) return st.all(...values).map((r) => ({ ...r }));
    const r = st.run(...values);
    return { insertId: Number(r.lastInsertRowid), affectedRows: Number(r.changes) };
  } catch (e) {
    throw mapError(e, text);
  }
}

// One connection: transactions are serialised so requests never interleave inside one.
let lock = Promise.resolve();
const withLock = (fn) => {
  const next = lock.then(fn, fn);
  lock = next.catch(() => {});
  return next;
};

/** Run one parameterised query: rows for SELECT, { insertId, affectedRows } otherwise. */
export const q = (sql, params = []) => withLock(() => run(sql, params));

/** Run fn(query) inside a transaction; commits on success, rolls back on error. */
export const tx = (fn) => withLock(async () => {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = await fn(async (sql, params = []) => run(sql, params));
    db.exec('COMMIT');
    return result;
  } catch (e) {
    db.exec('ROLLBACK');
    throw e;
  }
});
