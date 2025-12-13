import 'dotenv/config';
import mysql from 'mysql2/promise';

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = Number(process.env.DB_PORT || 3306);

// 👇 Acepta DB_PASSWORD (nuevo) y DB_PASS (viejo)
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD =
  process.env.DB_PASSWORD !== undefined
    ? process.env.DB_PASSWORD
    : (process.env.DB_PASS || '');

const DB_NAME = process.env.DB_NAME || 'sal_upp';

console.log("=====================================");
console.log(" Conectando a MySQL con:");
console.log(" HOST:", DB_HOST);
console.log(" PORT:", DB_PORT);
console.log(" USER:", DB_USER);
console.log(" PASSWORD:", DB_PASSWORD === "" ? "(vacía)" : "(oculta)");
console.log(" DB:", DB_NAME);
console.log("=====================================");

// Crea el pool
export const pool = await mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  connectionLimit: 10,
  namedPlaceholders: true
});
