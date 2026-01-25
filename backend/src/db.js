// backend/src/services/db.js
import "dotenv/config";
import mysql from "mysql2/promise";

const DB_HOST = process.env.DB_HOST;
const DB_PORT = Number(process.env.DB_PORT || 3306);
const DB_USER = process.env.DB_USER;
const DB_PASSWORD =
  process.env.DB_PASSWORD !== undefined
    ? process.env.DB_PASSWORD
    : process.env.DB_PASS || "";
const DB_NAME = process.env.DB_NAME;

// Logs seguros (sin mostrar password)
console.log("=====================================");
console.log(" Conectando a MySQL con:");
console.log(" HOST:", DB_HOST);
console.log(" PORT:", DB_PORT);
console.log(" USER:", DB_USER);
console.log(" PASSWORD:", DB_PASSWORD ? "(oculta)" : "(vacía)");
console.log(" DB:", DB_NAME);
console.log(" SSL:", "ENABLED");
console.log("=====================================");

// Pool de conexión (Railway REQUIERE SSL)
export const pool = await mysql.createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,

  // 🔐 OBLIGATORIO PARA RAILWAY
  ssl: {
    rejectUnauthorized: false,
  },

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
});
