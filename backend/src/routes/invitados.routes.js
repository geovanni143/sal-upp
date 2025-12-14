import { Router } from "express";
import { pool } from "../services/db.js";

const router = Router();

/* ============================================
   Helper: obtener minutos de tolerancia
   ============================================ */
async function getToleranciaMin() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      "SELECT valor FROM parametros WHERE clave = 'TOLERANCIA_INVITADO_MIN' LIMIT 1"
    );
    if (!rows.length) return 20;
    const n = parseInt(rows[0].valor, 10);
    return Number.isNaN(n) ? 20 : n;
  } finally {
    conn.release();
  }
}

/* ============================================
   Helper: periodo activo que cubra la fecha de hoy
   ============================================ */
async function getPeriodoActivoHoy() {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `
      SELECT id
      FROM periodos
      WHERE activo = 1
        AND eliminado = 0
        AND fecha_ini <= CURDATE()
        AND fecha_fin >= CURDATE()
      ORDER BY fecha_ini DESC
      LIMIT 1
      `
    );
    return rows.length ? rows[0].id : null;
  } finally {
    conn.release();
  }
}

/* ============================================
   Helper: obtener horario actual (si existe)
   ============================================ */
async function getHorarioActual(periodoId, labId) {
  if (!periodoId || !labId) return null;

  // día tipo "lu", "ma", "mi", "ju", "vi"
  const dias = ["do", "lu", "ma", "mi", "ju", "vi", "sa"];
  const hoy = dias[new Date().getDay()];

  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `
      SELECT *
      FROM horarios
      WHERE periodo_id = ?
        AND lab_id = ?
        AND dia = ?
        AND activo = 1
        AND eliminado = 0
        AND TIME(hora_ini) <= CURTIME()
        AND TIME(hora_fin) >= CURTIME()
      LIMIT 1
      `,
      [periodoId, labId, hoy]
    );
    return rows.length ? rows[0] : null;
  } finally {
    conn.release();
  }
}

/* ============================================
   Helper: ver si docente asignado ya se registró
   ============================================ */
async function docenteYaRegistro(horarioId) {
  const conn = await pool.getConnection();
  try {
    const [rows] = await conn.query(
      `
      SELECT id
      FROM asistencias
      WHERE horario_id = ?
        AND fecha = CURDATE()
        AND estado = 'REGISTRADA'
      LIMIT 1
      `,
      [horarioId]
    );
    return rows.length > 0;
  } finally {
    conn.release();
  }
}

/* ============================================
   POST /api/invitados/registrar
   Body:
   {
     nombre,
     tipo,          // DOCENTE_INVITADO | DOCENTE_EXTERNO | ALUMNO
     matricula,     // opcional (solo si ALUMNO)
     email,         // opcional
     motivo,
     labId
   }
   ============================================ */
router.post("/registrar", async (req, res) => {
  try {
    const { nombre, tipo, matricula, email, motivo, labId } = req.body;

    if (!nombre || !tipo || !labId) {
      return res.status(400).json({
        error: "Nombre, tipo de invitado y laboratorio son obligatorios",
      });
    }

    // 1) Periodo activo HOY (si hay)
    const periodoId = await getPeriodoActivoHoy();

    // 2) Horario actual (si existe)
    const horario = await getHorarioActual(periodoId, labId);

    // 3) Si hay horario, aplicar lógica de tolerancia
    if (horario) {
      const toleranciaMin = await getToleranciaMin();

      // calcular minutos transcurridos desde hora_ini
      const hoyFecha = new Date();
      const [hIni, mIni, sIni] = String(horario.hora_ini)
        .substring(0, 8)
        .split(":")
        .map(Number);
      const inicioClase = new Date(
        hoyFecha.getFullYear(),
        hoyFecha.getMonth(),
        hoyFecha.getDate(),
        hIni,
        mIni,
        sIni
      );
      const diffMs = hoyFecha.getTime() - inicioClase.getTime();
      const diffMin = diffMs / 60000;

      // a) Antes de la tolerancia: NO se permite invitado
      if (diffMin < toleranciaMin) {
        return res.status(400).json({
          error:
            "Hay una clase programada en este laboratorio. " +
            `El registro de invitado se habilita después de ${toleranciaMin} minutos de tolerancia.`,
        });
      }

      // b) Verificar si el docente asignado ya se registró
      const yaRegistro = await docenteYaRegistro(horario.id);
      if (yaRegistro) {
        return res.status(400).json({
          error:
            "Este laboratorio ya fue registrado por el docente asignado. No se puede registrar un invitado.",
        });
      }

      // c) En este punto: hay horario, pasó tolerancia, docente NO se registró
      //    → se permite registro de INVITADO sobre ese horario
      const conn = await pool.getConnection();
      try {
        await conn.query(
          `
          INSERT INTO asistencias
            (horario_id, lab_id, docente_id,
             invitado_nombre, tipo_invitado, matricula, email,
             periodo_id, fecha, hora_registro, estado)
          VALUES (?, ?, NULL, ?, ?, ?, ?, ?, CURDATE(), CURTIME(), 'INVITADO')
          `,
          [
            horario.id,
            horario.lab_id,
            nombre,
            tipo,
            matricula || null,
            email || null,
            horario.periodo_id,
          ]
        );
      } finally {
        conn.release();
      }

      return res.json({
        ok: true,
        mensaje: "Registro de invitado realizado sobre una clase programada.",
      });
    }

    // 4) NO hay horario actual → uso extraordinario
    const conn = await pool.getConnection();
    try {
      await conn.query(
        `
        INSERT INTO asistencias
          (horario_id, lab_id, docente_id,
           invitado_nombre, tipo_invitado, matricula, email,
           periodo_id, fecha, hora_registro, estado)
        VALUES (NULL, ?, NULL, ?, ?, ?, ?, ?, CURDATE(), CURTIME(), 'INVITADO')
        `,
        [
          labId,
          nombre,
          tipo,
          matricula || null,
          email || null,
          periodoId, // puede ser NULL si no hay periodo activo hoy
        ]
      );
    } finally {
      conn.release();
    }

    return res.json({
      ok: true,
      mensaje: "Registro de invitado realizado (uso extraordinario del laboratorio).",
    });
  } catch (err) {
    console.error("Error registrar invitado:", err);
    res.status(500).json({ error: "Error al registrar acceso como invitado" });
  }
});

export default router;
