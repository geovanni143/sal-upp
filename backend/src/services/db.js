// backend/src/services/db.js
import "dotenv/config";
import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL no está definida");
  process.exit(1);
}

console.log("=====================================");
console.log(" Conectando a MySQL con DATABASE_URL");
console.log("=====================================");

export const pool = mysql.createPool({
  uri: DATABASE_URL,

  // 🔐 OBLIGATORIO para Railway / Render
  ssl: {
    rejectUnauthorized: false,
  },

  connectTimeout: 30000,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// 🔥🔥🔥 FORZAR ZONA HORARIA MÉXICO
(async () => {
  try {
    await pool.query("SET time_zone = '-06:00'");
    console.log("✅ Zona horaria MySQL configurada a -06:00 (México)");
  } catch (err) {
    console.error("❌ Error configurando zona horaria:", err);
  }
})();
