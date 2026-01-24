import { pool } from "../services/db.js";

/*
  Se ejecuta al final del día
  Marca NO_ASISTIO solo si:
  - Hay horario
  - No hubo registro
  - No hubo invitado
*/
export async function generarNoAsistio(fecha = null) {
  const conn = await pool.getConnection();
  try {
    const dia = fecha || new Date().toISOString().slice(0, 10);

    const [horarios] = await conn.query(`
      SELECT h.id, h.docente_id
      FROM horarios h
      WHERE h.activo = 1
    `);

    for (const h of horarios) {
      const [yaExiste] = await conn.query(`
        SELECT id FROM asistencias
        WHERE horario_id = ? AND fecha = ?
      `, [h.id, dia]);

      if (yaExiste.length === 0) {
        await conn.query(`
          INSERT INTO asistencias
          (horario_id, docente_id, fecha, estado)
          VALUES (?, ?, ?, 'NO_ASISTIO')
        `, [h.id, h.docente_id, dia]);
      }
    }
  } finally {
    conn.release();
  }
}
