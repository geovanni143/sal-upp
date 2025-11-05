import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);

// Acepta DB_USER/DB_USERNAME y DB_PASSWORD/DB_PASS (por si quedaron viejos)
const DB_USER = process.env.DB_USER || process.env.DB_USERNAME || 'root';
const DB_PASSWORD = (process.env.DB_PASSWORD ?? process.env.DB_PASS ?? '');
const DB_NAME = process.env.DB_NAME || 'sal_upp';

export const pool = await mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: 10,
  namedPlaceholders: true
});
