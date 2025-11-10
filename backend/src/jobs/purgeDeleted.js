import db from "../services/db.js";

export default async function purgeDeleted() {
  // lee TTL desde una tabla de parámetros
  const p = await db.queryOne(`SELECT valor FROM parametros WHERE clave='SOFT_DELETE_TTL_DIAS'`);
  const ttl = Number(p?.valor || 30);

  // Elimina definitivamente registros con eliminado=1 y eliminado_en < NOW() - TTL
  const tables = ["labs","periodos","users","horarios"];
  for (const t of tables) {
    await db.exec(
      `DELETE FROM ${t} WHERE eliminado=1 AND eliminado_en IS NOT NULL AND eliminado_en < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [ttl]
    );
  }
}
