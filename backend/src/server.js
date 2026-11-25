import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { q } from './db.js';
import { authOptional } from './utils.js';
import publicRoutes from './routes/public.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()) }));
app.use(express.json({ limit: '100kb' }));
app.use(authOptional);

app.get('/api/health', async (_req, res) => {
  const [row] = await q('SELECT COUNT(*) AS flights FROM FLIGHT');
  res.json({ status: 'ok', database: 'SQLite', flights: row.flights });
});
app.use('/api/admin', adminRoutes);
app.use('/api', publicRoutes);
app.use('/api', (_req, res) => res.status(404).json({ message: 'Endpoint not found.' }));

// Translate database errors into clear API responses
const DB_ERRORS = {
  ER_DUP_ENTRY: [409, 'A record with the same unique value already exists.'],
  ER_ROW_IS_REFERENCED_2: [409, 'This record is used by other records and cannot be deleted.'],
  ER_ROW_IS_REFERENCED: [409, 'This record is used by other records and cannot be deleted.'],
  ER_NO_REFERENCED_ROW_2: [400, 'A referenced record does not exist.'],
  ER_CHECK_CONSTRAINT_VIOLATED: [400, null],
};

app.use((err, _req, res, _next) => {
  if (err.status) return res.status(err.status).json({ message: err.message });
  if (DB_ERRORS[err.code]) {
    const [status, msg] = DB_ERRORS[err.code];
    return res.status(status).json({ message: msg || `Database constraint rejected the change: ${err.sqlMessage}`, detail: err.sqlMessage });
  }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ message: 'Malformed JSON body.' });
  console.error(err);
  res.status(500).json({ message: 'Unexpected server error.' });
});

const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Flight Reservation API running on http://localhost:${port}/api`));
