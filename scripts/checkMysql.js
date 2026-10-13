import mysql from 'mysql2/promise';
import '../config/loadEnv.js';

const password = process.env.DB_PASSWORD || '';

console.log(JSON.stringify({
  host: process.env.DB_HOST || null,
  database: process.env.DB_NAME || null,
  user: process.env.DB_USER || null,
  passwordLength: password.length,
  passwordHasDollar: password.includes('$'),
}));

try {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password,
    database: process.env.DB_NAME,
  });
  await connection.query('SELECT 1');
  await connection.end();
  console.log('CONNECTED');
} catch (error) {
  console.log('FAILED', error.code || '', error.message);
}
