// src/routes/admin.routes.js
import { Router } from "express";
import { pool } from "../services/db.js";

const r = Router();

/* ================= Helpers de tiempo ================= */

// Convierte "HH:MM:SS" o "HH:MM" a "HH:MM"
const HHMM = (s) => (s || "").slice(0, 5);

// Devuelve 1..5 para Lunes..Viernes, siempre en ese rango
function getTodayDiaNumero() {
  const dow = new Date().getDay(); // 0=Dom,...6=Sab
  // Si es Lunes..Viernes, regresa 1..5; si es sábado/domingo, tomamos 1 (Lunes)
  if (dow >= 1 && dow <= 5) return dow;
  return 1;
}

// HH:MM actual
function getNowHHMM() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

// Suma minutos a una hora "HH:MM"
function addMinutes(hhmm, minutes) {
  const [H, M] = hhmm.split(":").map(Number);
  const total = H * 60 + M + minutes;
  const H2 = Math.floor((total + 24 * 60) % (24 * 60) / 60);
  const M2 = (total + 24 * 60) % (24 * 60) % 60;
  return `${String(H2).padStart(2, "0")}:${String(M2).padStart(2, "0")}`;
}

// Etiquetas de días
const DIA_LABEL = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

/* =========================================================
   GET /api/admin/asistencias-dia?dia=...
   dia:
     - "hoy"           -> usa el día real de hoy
     - "1".."5"        -> Lunes..Viernes
     - "semana"        -> todos los días 1..5
   Devuelve clases con estado:
     "En curso", "Próxima", "No asistió"
   (luego se podrán combinar con estados de asistencia real)
   ========================================================= */
r.get("/asistencias-dia", async (req, res) => {
  try {
    const { dia = "hoy" } = req.query;

    const todayDia = getTodayDiaNumero();
    const nowHHMM = getNowHHMM();
    const ventanaFin = addMinutes(nowHHMM, 180); // rango 3 horas

    // Determinar filtro SQL por día
    let filterDiaSql = "";
    const params = [];

    if (dia === "hoy") {
      filterDiaSql = "AND h.dia = ?";
      params.push(todayDia);
    } else if (dia === "semana") {
      filterDiaSql = "AND h.dia BETWEEN 1 AND 5";
      // sin params extra
    } else {
      const n = Number(dia);
      if (n >= 1 && n <= 5) {
        filterDiaSql = "AND h.dia = ?";
        params.push(n);
      } else {
        // valor inválido -> regresamos vacío
        return res.json([]);
      }
    }

    const [rows] = await pool.query(
      `
      SELECT 
        h.id,
        h.lab_id,
        l.nombre AS lab_nombre,
        h.materia,
        DATE_FORMAT(h.hora_ini,'%H:%i') AS hora_ini,
        DATE_FORMAT(h.hora_fin,'%H:%i') AS hora_fin,
        h.dia,
        CONCAT(
          COALESCE(u.nombre,''),
          IF(u.apellidos IS NULL OR u.apellidos='', '', CONCAT(' ',u.apellidos))
        ) AS docente_nombre
      FROM horarios h
      JOIN labs l     ON l.id = h.lab_id
      LEFT JOIN users u ON u.id = h.docente_id
      WHERE IFNULL(h.eliminado,0)=0
        ${filterDiaSql}
      ORDER BY h.dia, h.hora_ini
      `,
      params
    );

    // Clasificar estado según:
    // - día de la clase vs hoy
    // - hora actual vs horario
    const items = rows.map((r) => {
      const diaNum = Number(r.dia);
      const isToday = dia === "hoy"
        ? diaNum === todayDia
        : dia === "semana"
        ? diaNum === todayDia
        : diaNum === Number(dia);

      let estado = "Próxima"; // valor por defecto

      if (!isToday) {
        // Día distinto a hoy
        if (diaNum < todayDia) {
          estado = "No asistió"; // día ya pasó
        } else if (diaNum > todayDia) {
          estado = "Próxima"; // día futuro
        }
      } else {
        // Día de hoy: comparamos por hora
        const ini = r.hora_ini;
        const fin = r.hora_fin;

        if (nowHHMM >= ini && nowHHMM < fin) {
          estado = "En curso";
        } else if (nowHHMM < ini) {
          // Si empieza dentro de la ventana de 3 horas -> "Próxima"
          if (ini <= ventanaFin) {
            estado = "Próxima";
          } else {
            // Más tarde hoy, pero fuera de la ventana
            estado = "Próxima"; // si quieres podrías usar "Pendiente"
          }
        } else if (nowHHMM >= fin) {
          estado = "No asistió"; // horario ya terminó
        }
      }

      return {
        id: r.id,
        lab_id: r.lab_id,
        lab: r.lab_nombre,
        materia: r.materia,
        dia: DIA_LABEL[diaNum] || "",
        hora_ini: r.hora_ini,
        hora_fin: r.hora_fin,
        docente: r.docente_nombre || "",
        estado,
      };
    });

    res.json(items);
  } catch (err) {
    console.error("GET /api/admin/asistencias-dia:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* Sanity */
r.get("/", (_req, res) => {
  res.json({ ok: true, scope: "admin" });
});

export default r;
