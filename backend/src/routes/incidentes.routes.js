// backend/routes/incidentes.routes.js
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { pool } from "../services/db.js";

const r = Router();

/**
 * Normaliza la prioridad a: 'baja' | 'media' | 'alta'
 */
function normalizarPrioridad(prioridad) {
  const pri = (prioridad || "").toLowerCase();
  return ["baja", "media", "alta"].includes(pri) ? pri : "media";
}

/**
 * ================================
 *  POST /api/incidentes  (DOCENTE)
 * ================================
 * Crea un incidente reportado por el DOCENTE logueado.
 * El frontend manda: { claseId, tipo, titulo, descripcion, prioridad }
 */
r.post("/", requireAuth, async (req, res) => {
  try {
    const docente_id = req.user.sub; // id del usuario que reporta

    console.log("POST /api/incidentes body:", req.body);

    const {
      clase_id,
      claseId,
      horario_id,
      horarioId,
      tipo,
      tipo_incidente,
      tipoIncidente,
      titulo,
      titulo_breve,
      tituloBreve,
      descripcion,
      descripcion_incidente,
      descripcionIncidente,
      prioridad,
    } = req.body || {};

    // --------- H O R A R I O -----------
    const rawHorario =
      horario_id ?? horarioId ?? clase_id ?? claseId;

    const horarioIdNum = Number(rawHorario);

    if (
      rawHorario === undefined ||
      rawHorario === null ||
      rawHorario === "" ||
      Number.isNaN(horarioIdNum)
    ) {
      return res
        .status(400)
        .json({ ok: false, msg: "Clase inválida (horario_id requerido)" });
    }

    // --------- T I P O -----------
    const rawTipo = tipo || tipo_incidente || tipoIncidente;
    const tipoFinal = (rawTipo && String(rawTipo).trim()) || "Otro";

    // --------- T Í T U L O -----------
    const rawTitulo = titulo || titulo_breve || tituloBreve;
    const tituloFinal =
      (rawTitulo && String(rawTitulo).trim()) || "Incidente sin título";

    // --------- D E S C R I P C I Ó N -----------
    const rawDesc =
      descripcion || descripcion_incidente || descripcionIncidente;

    if (!rawDesc || String(rawDesc).trim() === "") {
      return res.status(400).json({
        ok: false,
        msg: "La descripción del incidente es obligatoria",
      });
    }

    const descFinal = String(rawDesc).trim();

    // --------- P R I O R I D A D -----------
    const prioridadFinal = normalizarPrioridad(prioridad);

    // Insertar en BD (docente y horario obligatorios)
    const [result] = await pool.query(
      `INSERT INTO incidentes
         (docente_id, horario_id, lab_id, tipo, titulo, descripcion, prioridad)
       VALUES (?, ?, NULL, ?, ?, ?, ?)`,
      [docente_id, horarioIdNum, tipoFinal, tituloFinal, descFinal, prioridadFinal]
    );

    return res.status(201).json({
      ok: true,
      id: result.insertId,
      msg: "Incidente creado correctamente",
    });
  } catch (err) {
    console.error("POST /api/incidentes error:", err);
    return res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/**
 * ===================================
 *  POST /api/incidentes/public (PÚBLICO)
 * ===================================
 * Incidente reportado desde el login, sin iniciar sesión.
 * El frontend manda: { lab_id, descripcion, prioridad }
 */
r.post("/public", async (req, res) => {
  try {
    console.log("POST /api/incidentes/public body:", req.body);

    const { lab_id, labId, descripcion, description, prioridad } = req.body || {};

    // Lab
    const rawLab = lab_id ?? labId;
    const labIdNum = Number(rawLab);

    if (
      rawLab === undefined ||
      rawLab === null ||
      rawLab === "" ||
      Number.isNaN(labIdNum)
    ) {
      return res
        .status(400)
        .json({ ok: false, msg: "Laboratorio inválido (lab_id requerido)" });
    }

    // Descripción
    const rawDesc = descripcion ?? description;
    if (!rawDesc || String(rawDesc).trim() === "") {
      return res.status(400).json({
        ok: false,
        msg: "La descripción del incidente es obligatoria",
      });
    }
    const descFinal = String(rawDesc).trim();

    const prioridadFinal = normalizarPrioridad(prioridad);

    // Para incidentes públicos:
    // - docente_id: NULL
    // - horario_id: NULL
    // - lab_id: el seleccionado
    // - tipo / título: genéricos
    const tipoFinal = "Externo";
    const tituloFinal = "Incidente reportado por visitante";

    const [result] = await pool.query(
      `INSERT INTO incidentes
         (docente_id, horario_id, lab_id, tipo, titulo, descripcion, prioridad)
       VALUES (NULL, NULL, ?, ?, ?, ?, ?)`,
      [labIdNum, tipoFinal, tituloFinal, descFinal, prioridadFinal]
    );

    return res.status(201).json({
      ok: true,
      id: result.insertId,
      msg: "Incidente público creado correctamente",
    });
  } catch (err) {
    console.error("POST /api/incidentes/public error:", err);
    return res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/**
 * GET /api/incidentes/mis
 * Incidentes reportados por el docente logueado.
 */
r.get("/mis", requireAuth, async (req, res) => {
  try {
    const docente_id = req.user.sub;

    const [rows] = await pool.query(
      `SELECT
         i.id,
         i.tipo,
         i.titulo,
         i.descripcion,
         i.prioridad,
         i.estado,
         i.creado_en,
         h.materia,
         h.grupo,
         l.nombre AS lab_nombre,
         DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
         DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin
       FROM incidentes i
       JOIN horarios h ON h.id = i.horario_id
       JOIN labs     l ON l.id = h.lab_id
       WHERE i.docente_id = ?
       ORDER BY i.creado_en DESC`,
      [docente_id]
    );

    return res.json({ ok: true, incidentes: rows });
  } catch (err) {
    console.error("GET /api/incidentes/mis error:", err);
    return res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/**
 * ===================================
 *  GET /api/incidentes  (ADMIN)
 * ===================================
 * Listado global para panel del administrador.
 */
r.get("/", requireAuth, async (req, res) => {
  try {
    console.log("USER /api/incidentes:", req.user);

    const [rows] = await pool.query(
      `SELECT
         i.id,
         i.tipo,
         i.titulo,
         i.descripcion,
         i.prioridad,
         i.estado,
         i.creado_en,
         i.docente_id,
         i.horario_id,
         COALESCE(
           CONCAT(u.nombre, ' ', IFNULL(u.apellidos, '')),
           'Reporte externo'
         ) AS docente_nombre,
         h.materia,
         h.grupo,
         l.nombre AS lab_nombre,
         DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
         DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin
       FROM incidentes i
       LEFT JOIN users u
         ON u.id = i.docente_id
       LEFT JOIN horarios h
         ON h.id = i.horario_id
       LEFT JOIN labs l
         ON l.id = COALESCE(i.lab_id, h.lab_id)
       ORDER BY i.creado_en DESC`
    );

    return res.json({ ok: true, incidentes: rows });
  } catch (err) {
    console.error("GET /api/incidentes error:", err);
    return res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/**
 * PATCH /api/incidentes/:id/estado
 * Cambiar estado del incidente (para panel admin).
 */
r.patch("/:id/estado", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado } = req.body || {};

    const allowed = ["pendiente", "en_proceso", "resuelto"];
    if (!allowed.includes(estado)) {
      return res.status(400).json({ ok: false, msg: "estado_invalido" });
    }

    const [result] = await pool.query(
      `UPDATE incidentes
       SET estado = ?
       WHERE id = ?`,
      [estado, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, msg: "not_found" });
    }

    return res.json({ ok: true, msg: "Estado actualizado" });
  } catch (err) {
    console.error("PATCH /api/incidentes/:id/estado error:", err);
    return res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/**
 * DELETE /api/incidentes/:id
 * Eliminar un incidente (para panel admin).
 */
r.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const [result] = await pool.query(
      `DELETE FROM incidentes
       WHERE id = ?`,
      [id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ ok: false, msg: "not_found" });
    }

    return res.json({ ok: true, msg: "Incidente eliminado" });
  } catch (err) {
    console.error("DELETE /api/incidentes/:id error:", err);
    return res.status(500).json({ ok: false, msg: "server_error" });
  }
});


export default r;
