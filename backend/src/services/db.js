import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASS || "",
  database: process.env.DB_NAME || "sal_upp",   // <-- OJO: usa sal_upp
  connectionLimit: 10,
});

export default {
  async query(sql, params = []) { const [rows] = await pool.query(sql, params); return rows; },
  async queryOne(sql, params = []) { const [rows] = await pool.query(sql, params); return rows[0] || null; },
  async exec(sql, params = []) { const [r] = await pool.execute(sql, params); return r; },
};
