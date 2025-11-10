import db from "./db.js";
import cron from "node-cron";

export async function softDelete(table, idCol, id) {
  // Marca eliminado y fecha
  await db.exec(
    `UPDATE ${table} SET eliminado=1, deleted_at=NOW() WHERE ${idCol}=?`,
    [id]
  );
}

// Purga diaria (03:30 am)
const DAYS = Number(process.env.RETENTION_DAYS || 30);
cron.schedule("30 3 * * *", async () => {
  try {
    await db.exec(
      `DELETE FROM laboratorios
        WHERE eliminado=1 AND deleted_at IS NOT NULL
          AND deleted_at < (NOW() - INTERVAL ? DAY)`,
      [DAYS]
    );
    // Repite para otras tablas cuando lo habilites:
    // await db.exec(`DELETE FROM usuarios ...`, [DAYS]);
    // await db.exec(`DELETE FROM horarios ...`, [DAYS]);
  } catch (e) {
    console.error("Purge error:", e.message);
  }
});

