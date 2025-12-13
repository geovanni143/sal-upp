// backend/src/routes/asistencias.routes.js
// =======================================================
// Registro de asistencias (docente o invitado)
//
// POST /api/asistencias/registrar
//   body:
//     {
//       horario_id: number,
//       docente_id?: number | null,
//       invitado_nombre?: string | null
//     }
//
// Reglas:
//   - La fecha de la clase se calcula con la semana ACTUAL
//     (lunes a domingo) igual que en admin.routes.
//   - Solo se puede registrar EN EL MISMO DÍA de la clase.
//   - Si se registra dentro del horario → estado = 'registrado'
//   - Si se registra el mismo día pero después de la hora_fin
//       → estado = 'tardio'
//   - Si se manda invitado_nombre y no hay docente_id,
//       → estado = 'registro_invitado'
//   - Si hoy no es el día de la clase → 400 (no se puede registrar).
// =======================================================

import { Router } from "express";
import { pool } from "../services/db.js";

const r = Router();

/* Helpers reusados */

function toMin(hhmm) {
  if (!hhmm) return 0;
  const [H, M] = hhmm.split(":").map(Number);
  return H * 60 + M;
}

function toDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function getMondayOfCurrentWeek() {
  const today = new Date();
  const day = today.getDay();
  const d = new Date(today);
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function addDays(baseDate, days) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d;
}

/* Ruta de registro */

r.post("/registrar", async (req, res) => {
  try {
    const { horario_id, docente_id, invitado_nombre } = req.body || {};

    if (!horario_id) {
      return res
        .status(400)
        .json({ ok: false, msg: "horario_id_requerido" });
    }

    // 1) Consultar datos del horario
    const [rows] = await pool.query(
      `
      SELECT
        h.id,
        h.dia,
        h.periodo_id,
        DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
        DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin
      FROM horarios h
      WHERE h.id = ? AND IFNULL(h.eliminado,0)=0
      `,
      [horario_id]
    );

    if (!rows.length) {
      return res
        .status(404)
        .json({ ok: false, msg: "horario_no_encontrado" });
    }

    const h = rows[0];
    const diaNum = Number(h.dia); // 1..5
    const horaIni = h.hora_ini;
    const horaFin = h.hora_fin;

    const monday = getMondayOfCurrentWeek();
    const fechaClaseDate = addDays(monday, diaNum - 1);
    const fechaClaseStr = toDateStr(fechaClaseDate);

    const now = new Date();
    const hoyStr = toDateStr(now);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const iniMin = toMin(horaIni);
    const finMin = toMin(horaFin);

    // 2) Validar que hoy sea el día de la clase
    if (hoyStr < fechaClaseStr) {
      return res.status(400).json({
        ok: false,
        msg: "clase_no_ha_ocurrido",
        detalle: "Solo se puede registrar el mismo día de la clase.",
      });
    }
    if (hoyStr > fechaClaseStr) {
      return res.status(400).json({
        ok: false,
        msg: "clase_expirada",
        detalle:
          "Ya pasó el día de la clase. Esta clase cuenta como 'No asistió'.",
      });
    }

    // 3) Determinar estado base
    let estado = "registrado";

    if (invitado_nombre && (!docente_id || docente_id === null)) {
      estado = "registro_invitado";
    } else {
      if (nowMin > finMin) {
        estado = "tardio"; // mismo día, pero ya fuera del horario
      } else {
        estado = "registrado"; // dentro de horario
      }
    }

    const cleanInvitado =
      invitado_nombre && invitado_nombre.trim().length > 0
        ? invitado_nombre.trim()
        : null;
    const docenteIdNum =
      docente_id === undefined || docente_id === null || docente_id === ""
        ? null
        : Number(docente_id) || null;

    // 4) Insertar / actualizar (único por horario+fecha)
    await pool.query(
      `
      INSERT INTO asistencias
        (horario_id, docente_id, periodo_id, invitado_nombre, fecha, hora_registro, estado)
      VALUES
        (?, ?, ?, ?, ?, TIME(NOW()), ?)
      ON DUPLICATE KEY UPDATE
        docente_id = VALUES(docente_id),
        invitado_nombre = VALUES(invitado_nombre),
        hora_registro = VALUES(hora_registro),
        estado = VALUES(estado),
        actualizado_en = CURRENT_TIMESTAMP
      `,
      [
        h.id,
        docenteIdNum,
        h.periodo_id,
        cleanInvitado,
        fechaClaseStr,
        estado,
      ]
    );

    return res.json({
      ok: true,
      msg: "asistencia_registrada",
      data: {
        horario_id: h.id,
        fecha_clase: fechaClaseStr,
        estado,
      },
    });
  } catch (err) {
    console.error("POST /api/asistencias/registrar:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

export default r;
