import { pool } from "../db.js";

export async function logBitacora({
  usuario = "sys",
  accion,
  entidad,
  entidad_id = null,
  detalle = null,
} = {}) {
  try {
    await pool.query(
      "INSERT INTO bitacora (usuario, accion, entidad, entidad_id, detalle) VALUES (?,?,?,?,?)",
      [usuario, accion, entidad, entidad_id, detalle]
    );
  } catch (e) {
    // No romper el flujo si falla la bitácora
    console.error("[BITACORA]", e.message);
  }
}
