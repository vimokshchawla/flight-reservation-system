import 'dotenv/config';
import mysql from 'mysql2/promise';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'flight_reservation_system',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,      // DATETIME -> 'YYYY-MM-DD HH:MM:SS' (no timezone shifting)
  decimalNumbers: true,   // DECIMAL -> JS number
});

/** Run one parameterised query and return rows (SELECT) or the result header (INSERT/UPDATE/DELETE). */
export const q = async (sql, params = []) => (await pool.query(sql, params))[0];

/** Run fn(query) inside a transaction; commits on success, rolls back on error. */
export async function tx(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(async (sql, params = []) => (await conn.query(sql, params))[0]);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}
