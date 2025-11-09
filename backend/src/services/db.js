// backend/src/services/db.js
import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "sal_upp",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Helpers opcionales (compatibilidad con imports 'default')
const db = {
  async query(sql, params = []) {
    const [rows] = await pool.query(sql, params);
    return rows;
  },
  async exec(sql, params = []) {
    const [result] = await pool.execute(sql, params);
    return result;
  },
};

export default db;
