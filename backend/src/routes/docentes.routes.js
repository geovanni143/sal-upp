import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { upsertDocente } from "../controllers/docentesController.js";
import { pool } from "../services/db.js";

const r = Router();

// Crear o actualizar docente
r.post("/", requireAuth, upsertDocente);
r.put("/", requireAuth, upsertDocente);

// Listar docentes activos
r.get("/", requireAuth, async (_req, res) => {
  const [rows] = await pool.query(
    "SELECT id, nombre, email, activo FROM docentes WHERE activo = 1 ORDER BY nombre"
  );
  res.json(rows);
});

// =======================================
// GET /api/docentes/clases-hoy  (PRUEBA)
// =======================================
r.get("/clases-hoy", requireAuth, async (req, res) => {
  try {
    // ⚠️ PARA PRUEBA: forzamos el docente_id = 8,
    // que es el que ya vimos que tiene horarios en la tabla "horarios".
    const docente_id = req.user.sub;

    // 1) Simular lunes (day = 1)
    let day = new Date().getDay();
    if (day === 6) day = 5;
    if (day < 1 || day > 5) {
      return res.json({ ok: true, clases: [] });
    }

    // 2) Mapear día numérico -> formato de tu BD ('lu','ma','mi','ju','vi')
    const mapDia = { 1: "lu", 2: "ma", 3: "mi", 4: "ju", 5: "vi" };
    const diaDB = mapDia[day];

    // 3) Obtener el periodo real del docente según sus horarios
    const [[p]] = await pool.query(
      `SELECT DISTINCT periodo_id
       FROM horarios
       WHERE docente_id = ?
       LIMIT 1`,
      [docente_id]
    );

    if (!p) {
      return res.json({ ok: true, clases: [] });
    }

    const periodo_id = p.periodo_id;

    // 4) Obtener las clases del docente para ese día
    const [rows] = await pool.query(
      `SELECT
         h.id,
         h.materia,
         h.codigo,
         h.grupo,
         h.lab_id,
         l.nombre AS lab_nombre,
         DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
         DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin
       FROM horarios h
       JOIN labs l ON l.id = h.lab_id
       WHERE h.docente_id = ?
         AND h.periodo_id = ?
         AND h.dia = ?
         AND h.activo = 1
         AND IFNULL(h.eliminado,0) = 0
       ORDER BY h.hora_ini ASC`,
      [docente_id, periodo_id, diaDB]
    );

    res.json({ ok: true, clases: rows });
  } catch (err) {
    console.error("GET /docentes/clases-hoy PRUEBA:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

export default r;
