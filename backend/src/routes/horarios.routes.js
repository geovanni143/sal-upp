// backend/src/routes/horarios.routes.js
import { Router } from "express";
import { pool } from "../services/db.js";

const r = Router();

/* ================= Helpers ================= */

const HHMM = (s) => (s || "").slice(0, 5); // "08:30"
const HHMMSS = (s) => `${HHMM(s)}:00`;

function isTodayBetween(iniStr, finStr) {
  if (!iniStr || !finStr) return false;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  return todayStr >= iniStr && todayStr <= finStr;
}

/* =========================================================
   GET /api/horarios/catalogo?search=&mostrar_eliminados=0|1

   Un renglón por (periodo_id, lab_id)
   - periodo_nombre, periodo_ini, periodo_fin
   - lab_nombre
   - bloques_activos
   - activo (0/1)
   - horario_eliminado (1 si TODOS los bloques están eliminados)
   - en_curso (1 si hoy ∈ [fecha_ini, fecha_fin])
   ========================================================= */
r.get("/catalogo", async (req, res) => {
  try {
    const { search = "", mostrar_eliminados = "0" } = req.query;
    const showDeleted = Number(mostrar_eliminados) === 1;

    const filtros = [];
    const params = [];

    if (!showDeleted) {
      filtros.push("IFNULL(h.eliminado,0) = 0");
    }
    if (search) {
      filtros.push("(p.nombre LIKE ? OR l.nombre LIKE ?)");
      const like = `%${search}%`;
      params.push(like, like);
    }

    const where = filtros.length ? "WHERE " + filtros.join(" AND ") : "";

    const [rows] = await pool.query(
      `
      SELECT
        h.periodo_id,
        p.nombre AS periodo_nombre,
        DATE_FORMAT(p.fecha_ini,'%Y-%m-%d') AS periodo_ini,
        DATE_FORMAT(p.fecha_fin,'%Y-%m-%d') AS periodo_fin,
        h.lab_id,
        l.nombre AS lab_nombre,
        SUM(IF(IFNULL(h.eliminado,0)=0,1,0)) AS bloques_activos,
        SUM(IF(IFNULL(h.eliminado,0)=1,1,0)) AS bloques_eliminados,
        MIN(IFNULL(h.activo,0)) AS activo_flag,
        MAX(IFNULL(h.eliminado,0)) AS eliminado_flag
      FROM horarios h
      JOIN periodos p ON p.id = h.periodo_id
      JOIN labs     l ON l.id = h.lab_id
      ${where}
      GROUP BY h.periodo_id, h.lab_id
      ORDER BY p.fecha_ini DESC, l.nombre ASC
      `,
      params
    );

    const data = rows.map((r) => {
      const horario_eliminado =
        Number(r.bloques_activos) === 0 && Number(r.bloques_eliminados) > 0
          ? 1
          : 0;

      const en_curso = isTodayBetween(r.periodo_ini, r.periodo_fin);

      return {
        periodo_id: r.periodo_id,
        lab_id: r.lab_id,
        periodo_nombre: r.periodo_nombre,
        periodo_ini: r.periodo_ini,
        periodo_fin: r.periodo_fin,
        lab_nombre: r.lab_nombre,
        bloques_activos: Number(r.bloques_activos),
        horario_eliminado,
        activo: Number(r.activo_flag),
        en_curso,
      };
    });

    res.json({ ok: true, items: data });
  } catch (err) {
    console.error("GET /horarios/catalogo:", err);
    res.status(500).json({ ok: false, msg: "server_error", items: [] });
  }
});

/* =========================================================
   GET /api/horarios/catalogo/:periodo_id/:lab_id
   (no la usa el front por ahora, la dejamos por si acaso)
   ========================================================= */
r.get("/catalogo/:periodo_id/:lab_id", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;
    const [rows] = await pool.query(
      `
      SELECT 
        id, periodo_id, lab_id, dia,
        DATE_FORMAT(hora_ini,'%H:%i') AS hora_ini,
        DATE_FORMAT(hora_fin,'%H:%i') AS hora_fin,
        materia, codigo, grupo, docente_id, activo
      FROM horarios
      WHERE periodo_id=? AND lab_id=? AND IFNULL(eliminado,0)=0
      ORDER BY dia, hora_ini
      `,
      [periodo_id, lab_id]
    );
    res.json({ ok: true, bloques: rows });
  } catch (err) {
    console.error("GET /horarios/catalogo/:pid/:lid:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   PATCH /api/horarios/catalogo/:periodo_id/:lab_id/activar
   - Siempre se puede activar
   ========================================================= */
r.patch("/catalogo/:periodo_id/:lab_id/activar", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;

    await pool.query(
      `UPDATE horarios SET activo=1 
       WHERE periodo_id=? AND lab_id=? AND IFNULL(eliminado,0)=0`,
      [periodo_id, lab_id]
    );

    res.json({ ok: true, msg: "Horario activado" });
  } catch (err) {
    console.error("PATCH activar horario:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   PATCH /api/horarios/catalogo/:periodo_id/:lab_id/desactivar
   - Solo si el período NO está en curso
   ========================================================= */
r.patch("/catalogo/:periodo_id/:lab_id/desactivar", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;

    const [[p]] = await pool.query(
      `SELECT DATE_FORMAT(fecha_ini,'%Y-%m-%d') AS ini,
              DATE_FORMAT(fecha_fin,'%Y-%m-%d') AS fin
       FROM periodos WHERE id=?`,
      [periodo_id]
    );

    if (!p) {
      return res.json({ ok: false, msg: "Periodo no encontrado" });
    }

    if (isTodayBetween(p.ini, p.fin)) {
      return res.json({
        ok: false,
        msg: "No puedes desactivar un horario que está en curso.",
      });
    }

    await pool.query(
      `UPDATE horarios SET activo=0 
       WHERE periodo_id=? AND lab_id=? AND IFNULL(eliminado,0)=0`,
      [periodo_id, lab_id]
    );

    res.json({ ok: true, msg: "Horario desactivado" });
  } catch (err) {
    console.error("PATCH desactivar horario:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   DELETE /api/horarios/catalogo/:periodo_id/:lab_id
   - Eliminación lógica (eliminado=1)
   - Solo si el período NO está en curso
   ========================================================= */
r.delete("/catalogo/:periodo_id/:lab_id", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;

    const [[p]] = await pool.query(
      `SELECT DATE_FORMAT(fecha_ini,'%Y-%m-%d') AS ini,
              DATE_FORMAT(fecha_fin,'%Y-%m-%d') AS fin
       FROM periodos WHERE id=?`,
      [periodo_id]
    );

    if (!p) {
      return res.json({ ok: false, msg: "Periodo no encontrado" });
    }

    if (isTodayBetween(p.ini, p.fin)) {
      return res.json({
        ok: false,
        msg: "No puedes eliminar un horario mientras el período está en curso.",
      });
    }

    await pool.query(
      `UPDATE horarios SET eliminado=1 
       WHERE periodo_id=? AND lab_id=?`,
      [periodo_id, lab_id]
    );

    res.json({ ok: true, msg: "Horario eliminado." });
  } catch (err) {
    console.error("DELETE horario:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   POST /api/horarios/catalogo/:periodo_id/:lab_id/restore
   - Volver a eliminar=0
   ========================================================= */
r.post("/catalogo/:periodo_id/:lab_id/restore", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.params;

    await pool.query(
      `UPDATE horarios SET eliminado=0 
       WHERE periodo_id=? AND lab_id=?`,
      [periodo_id, lab_id]
    );

    res.json({ ok: true, msg: "Horario restaurado." });
  } catch (err) {
    console.error("POST restore horario:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =========================================================
   GET /api/horarios/semana?periodo_id=..&lab_id=..
   - Devuelve TODOS los bloques de ese horario
   ========================================================= */
r.get("/semana", async (req, res) => {
  try {
    const { periodo_id, lab_id } = req.query;
    if (!periodo_id || !lab_id) {
      return res
        .status(400)
        .json({ ok: false, msg: "missing_ids", bloques: [] });
    }

    const [rows] = await pool.query(
      `
      SELECT 
        h.id,
        h.periodo_id,
        h.lab_id,
        h.dia,
        DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
        DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin,
        h.materia,
        h.codigo,
        h.grupo,
        h.docente_id,
        h.activo,
        CONCAT(
          COALESCE(u.nombre,''), 
          IF(u.apellidos IS NULL OR u.apellidos='', '', CONCAT(' ',u.apellidos))
        ) AS docente_nombre
      FROM horarios h
      LEFT JOIN users u ON u.id = h.docente_id
      WHERE h.periodo_id=? AND h.lab_id=? AND IFNULL(h.eliminado,0)=0
      ORDER BY h.dia, h.hora_ini
      `,
      [periodo_id, lab_id]
    );

    res.json({ ok: true, bloques: rows });
  } catch (err) {
    console.error("GET /horarios/semana:", err);
    res.status(500).json({ ok: false, msg: "server_error", bloques: [] });
  }
});

/* =========================================================
   POST /api/horarios/bulk
   - Reemplaza COMPLETAMENTE el horario (periodo_id, lab_id)
   - upserts = arreglo de bloques
   ========================================================= */
r.post("/bulk", async (req, res) => {
  const { periodo_id, lab_id, upserts = [] } = req.body || {};
  if (!periodo_id || !lab_id) {
    return res.status(400).json({ ok: false, msg: "missing_ids" });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Reglas: un lab solo puede tener un horario por periodo
    // (ya lo garantizamos porque BORRAMOS y volvemos a insertar)
    await conn.query(
      `DELETE FROM horarios WHERE periodo_id=? AND lab_id=?`,
      [periodo_id, lab_id]
    );

    if (Array.isArray(upserts) && upserts.length) {
      const ph = [];
      const val = [];

      for (const b of upserts) {
        if (!b) continue;
        const {
          dia,
          hora_ini,
          hora_fin,
          materia = null,
          codigo = null,
          grupo = null,
          docente_id = null,
        } = b;

        if (dia == null || !hora_ini || !hora_fin) continue;

        ph.push(`(?,?,?,?,?,?,?,?,?,1,0,NOW())`);
        val.push(
          periodo_id,
          lab_id,
          Number(dia),
          HHMMSS(hora_ini),
          HHMMSS(hora_fin),
          materia,
          codigo,
          grupo,
          docente_id
        );
      }

      if (ph.length) {
        await conn.query(
          `
          INSERT INTO horarios
          (periodo_id, lab_id, dia, hora_ini, hora_fin,
           materia, codigo, grupo, docente_id, activo, eliminado, created_at)
          VALUES ${ph.join(",")}
          `,
          val
        );
      }
    }

    await conn.commit();
    res.json({ ok: true, msg: "Horario guardado" });
  } catch (err) {
    console.error("POST /horarios/bulk:", err);
    await conn.rollback();
    res.status(400).json({ ok: false, msg: "bulk_failed" });
  } finally {
    conn.release();
  }
});

/* =========================================================
   PDF (placeholder)
   ========================================================= */
r.get("/pdf", async (_req, res) => {
  res.json({ ok: true, msg: "Falta implementar PDF" });
});

/* =========================================================
   Sanity check
   ========================================================= */
r.get("/", (_req, res) => {
  res.json({ ok: true, scope: "horarios" });
});

export default r;
