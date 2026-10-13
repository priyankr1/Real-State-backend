import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

if (process.env.NODE_ENV !== 'production') dotenv.config({ path: './.env.local' });
dotenv.config();

let pool;

const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

export const getPool = () => {
  if (!pool) throw new Error('MySQL has not been connected yet');
  return pool;
};

export const isDatabaseReady = () => Boolean(pool);

export const closeDatabase = async () => {
  if (pool) await pool.end();
  pool = undefined;
};

export default async function connectdb() {
  if (pool) return pool;

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Missing MySQL environment variables: ${missing.join(', ')}`);

  pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
    queueLimit: 0,
    charset: 'utf8mb4',
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined,
  });

  try {
    await pool.query('SELECT 1');
    return pool;
  } catch (error) {
    await pool.end().catch(() => {});
    pool = undefined;
    const target = `${process.env.DB_HOST}:${process.env.DB_PORT || 3306}/${process.env.DB_NAME}`;
    const reason = error.code || error.message || 'unknown connection error';
    throw new Error(`Could not connect to MySQL at ${target} (${reason})`, { cause: error });
  }
}

