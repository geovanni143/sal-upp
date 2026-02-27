// backend/src/routes/admin.routes.js
// =======================================================
// SAL-UPP — Rutas de administración (panel principal)
// -------------------------------------------------------
//  - GET /api/admin/asistencias-dia
//    Devuelve TODAS las clases del día / semana seleccionada
//    con:
//       • Estado de horario   → en_curso | proxima | impartida
//       • Estado de registro  → sin_registrar | registrado
//                                | tardio | no_asistio | registro_invitado
//  - GET /api/admin/
//
//  *** IMPORTANTE ***
//  Este archivo asume que ya existe la tabla:
//
//  CREATE TABLE asistencias ( ... )   (ver arriba)
//
// =======================================================

import { Router } from "express";
import { pool } from "../services/db.js";

const r = Router();

function nowMX() {
  const now = new Date();   // ✅ AQUÍ estaba el error
  const offsetMX = -6;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * offsetMX);
}


/* =======================================================
   Helpers de tiempo (horas y fechas)
   ======================================================= */

// Convierte "HH:MM" a minutos desde las 00:00
function toMin(hhmm) {
  if (!hhmm) return 0;
  const [H, M] = hhmm.split(":").map(Number);
  return H * 60 + M;
}

// Convierte minutos → { horas, minutos } positivos
function minToHM(totalMin) {
  const abs = Math.max(0, totalMin);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return { h, m };
}

// Formatea algo tipo:
//   0h 5m  -> "5 minutos"
//   1h 0m  -> "1 hora"
//   1h 20m -> "1 hora con 20 minutos"
function formatHM(totalMin) {
  const { h, m } = minToHM(totalMin);
  if (h === 0 && m <= 0) return "0 minutos";
  if (h === 0) return `${m} minuto${m === 1 ? "" : "s"}`;
  if (m === 0) return `${h} hora${h === 1 ? "" : "s"}`;
  return `${h} hora${h === 1 ? "" : "s"} con ${m} minuto${m === 1 ? "" : "s"}`;
}

// Devuelve fecha YYYY-MM-DD de un objeto Date
function toDateStr(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Lunes de la semana actual (tomamos Lunes=1..Dom=0)
// Si hoy es domingo, toma el lunes ANTERIOR (porque
// el domingo lo usamos como "reinicio de próxima semana").
function getMondayOfCurrentWeek() {
  const today = nowMX();
  const day = today.getDay(); // 0=Dom,1=Lun,...6=Sab
  const d = new Date(today); // copia

  // day=1 -> lun → diff=0
  // day=2 -> mar → diff=-1
  // ...
  // day=0 (dom) → diff=-6 (lunes anterior)
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

// Suma días a una fecha y regresa nuevo Date
function addDays(baseDate, days) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + days);
  return d;
}

/* =======================================================
   Helpers de día de semana (1..5) y etiquetas
   ======================================================= */

// Mapeo 1..5 → etiqueta
const DIA_LABEL = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
};

// Para "Hoy (Jueves)" en el combo
function getTodayDiaNumeroLabel() {
  const dow = nowMX().getDay(); // 0=dom,1=lun,..6=sab
  if (dow >= 1 && dow <= 5) return dow;
  return 1; // si es fin de semana, mostramos "Hoy (Lunes)"
}

// Para la lógica de semana (reinicio en domingo):
//  0 = domingo → sirve para decir "todo 1..5 es próxima"
//  1..5 = lunes..viernes normales
//  6 = sábado → lo tratamos como >=5
function getTodayDiaNumeroLogic() {
  const dow = nowMX().getDay();
  if (dow === 0) return 0; // domingo
  if (dow >= 1 && dow <= 5) return dow;
  if (dow === 6) return 5; // sábado -> después de viernes
  return 0;
}

/* =======================================================
   Helpers de ESTADO DE REGISTRO
   ======================================================= */

/**
 * Calcula el estado de REGISTRO de una clase.
 *
 * Parámetros:
 *  - clase: {
 *      fecha_clase: 'YYYY-MM-DD',
 *      hora_ini: 'HH:MM',
 *      hora_fin: 'HH:MM'
 *    }
 *  - asistencia: null | {
 *      fecha: 'YYYY-MM-DD',
 *      hora_registro: 'HH:MM:SS' | null,
 *      estado: 'sin_registrar' | 'registrado' | 'tardio'
 *               | 'no_asistio' | 'registro_invitado',
 *      invitado_nombre: string | null,
 *      docente_id: number | null
 *    }
 *
 * RESULTADO:
 *  {
 *    codigo: 'sin_registrar' | 'registrado' | 'tardio'
 *             | 'no_asistio' | 'registro_invitado',
 *    label:  'Sin registrar' | 'Registrado' | 'Registro tardío'
 *             | 'No asistió' | 'Registro de invitado',
 *    mensaje: texto auxiliar para la tarjeta
 *  }
 */
function calcularEstadoRegistro(clase, asistencia) {
  const now = nowMX();
  const hoyStr = toDateStr(now);
  const fechaClase = clase.fecha_clase; // 'YYYY-MM-DD'

  // ======================================================
  // 1️⃣ NO existe asistencia
  // ======================================================
  if (!asistencia) {
    if (hoyStr < fechaClase) {
      return {
        codigo: "sin_registrar",
        label: "Sin registrar",
        mensaje: "Clase próxima, aún sin registrar",
      };
    }

    if (hoyStr === fechaClase) {
      return {
        codigo: "sin_registrar",
        label: "Sin registrar",
        mensaje: "Clase de hoy aún sin registrar",
      };
    }

    return {
      codigo: "no_asistio",
      label: "No asistió",
      mensaje: "No se registró esta clase en el día correspondiente",
    };
  }

  // ======================================================
  // 2️⃣ SÍ existe asistencia → CONFIAMOS EN LA BD
  // ======================================================

  switch (asistencia.estado) {
    case "registrado":
      return {
        codigo: "registrado",
        label: "Registrado",
        mensaje: "Registro dentro del horario permitido",
      };

    case "tardio":
      return {
        codigo: "tardio",
        label: "Registro tardío",
        mensaje: "Registro realizado fuera del horario permitido",
      };

    case "registro_invitado":
      return {
        codigo: "registro_invitado",
        label: "Registro invitado",
        mensaje: `Registrado por invitado: ${
          asistencia.invitado_nombre || "Invitado"
        }`,
      };

    case "no_asistio":
      return {
        codigo: "no_asistio",
        label: "No asistió",
        mensaje: "No se registró esta clase",
      };

    default:
      // Si por alguna razón llega algo raro
      return {
        codigo: asistencia.estado || "registrado",
        label: "Registrado",
        mensaje: "Registro detectado",
      };
  }
}

/* =======================================================
   GET /api/admin/asistencias-dia
   -------------------------------------------------------
   Query params:
     - dia:
          "hoy"      → día real de hoy
          "1".."5"   → lunes..viernes específicos
          "semana"   → semana completa (1..5)
     - lab_id (opcional): filtrar por laboratorio
   ======================================================= */

r.get("/asistencias-dia", async (req, res) => {
  try {
    const { dia = "hoy", lab_id } = req.query;

    const todayLogic = getTodayDiaNumeroLogic(); // 0..5
    const todayLabel = getTodayDiaNumeroLabel(); // 1..5
    const now = nowMX();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    const hoyStr = now.toISOString().slice(0, 10);

console.log("==== DEBUG ADMIN ====");
console.log("NOW MX:", now);
console.log("HOY STR:", hoyStr);

    // -------------------------------
    // 1) Armar filtro de día (SQL)
    // -------------------------------
    let filterDiaSql = "";
    const params = [];

    if (dia === "hoy") {
      filterDiaSql = "AND h.dia = ?";
      params.push(todayLabel);
    } else if (dia === "semana") {
      filterDiaSql = "AND h.dia BETWEEN 1 AND 5";
      // sin params extra
    } else {
      const n = Number(dia);
      if (n >= 1 && n <= 5) {
        filterDiaSql = "AND h.dia = ?";
        params.push(n);
      } else {
        return res.json([]);
      }
    }

    // Filtro por laboratorio (opcional)
    if (lab_id) {
      filterDiaSql += " AND h.lab_id = ?";
      params.push(Number(lab_id));
    }

    // -------------------------------
    // 2) Query de HORARIOS (clases)
    // -------------------------------
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
        h.periodo_id,
        CONCAT(
          COALESCE(u.nombre,''),
          IF(u.apellidos IS NULL OR u.apellidos='', '', CONCAT(' ',u.apellidos))
        ) AS docente_nombre
      FROM horarios h
      JOIN labs   l ON l.id = h.lab_id
      LEFT JOIN users u ON u.id = h.docente_id
      WHERE IFNULL(h.eliminado,0)=0
        ${filterDiaSql}
      ORDER BY h.dia, h.hora_ini
      `,
      params
    );

    // Si no hay horarios, regresamos vacío
    if (!rows.length) {
      return res.json([]);
    }

    // -------------------------------
    // 3) Preparar info de semana
    // -------------------------------
    const monday = getMondayOfCurrentWeek();
    const semana_inicio_str = toDateStr(monday);
    const semana_fin_str = toDateStr(addDays(monday, 6)); // domingo

    console.log("LUNES CALCULADO:", semana_inicio_str);
console.log("DOMINGO CALCULADO:", semana_fin_str);

    // Para cada horario, determinamos:
    //  - dia_num      (1..5)
    //  - fecha_clase  (lunes+offset)
    const clases = rows.map((row) => {
      const diaNum = Number(row.dia); // 1..5 (ENUM index)
      const fechaClaseDate = addDays(monday, diaNum - 1);
      const fechaClaseStr = toDateStr(fechaClaseDate);

      return {
        id: row.id,
        lab_id: row.lab_id,
        periodo_id: row.periodo_id,
        lab: row.lab_nombre,
        materia: row.materia,
        dia_num: diaNum,
        dia_label: DIA_LABEL[diaNum] || "",
        hora_ini: row.hora_ini,
        hora_fin: row.hora_fin,
        docente: row.docente_nombre || "",
        fecha_clase: fechaClaseStr,
      };
    });

    // -------------------------------
    // 4) Leer ASISTENCIAS de la semana
    // -------------------------------
    const horarioIds = clases.map((c) => c.id);
    if (!horarioIds.length) {
  return res.json([]);
}
console.log("Horarios encontrados:", horarioIds);

    const [asisRows] = await pool.query(
      `
      SELECT
        a.id,
        a.horario_id,
        a.docente_id,
        a.periodo_id,
        a.invitado_nombre,
        DATE_FORMAT(a.fecha,'%Y-%m-%d') AS fecha,
        DATE_FORMAT(a.hora_registro,'%H:%i:%s') AS hora_registro,
        a.estado
      FROM asistencias a
      WHERE a.fecha BETWEEN ? AND ?
        AND a.horario_id IN (${horarioIds.map(() => "?").join(",")})
      `,
      [semana_inicio_str, semana_fin_str, ...horarioIds]
    );
console.log("ASISTENCIAS RAW:", asisRows);

    // Mapear asistencias por (horario_id, fecha) → tomamos la MÁS reciente
    const asistenciasMap = new Map(); // key: `${horario_id}_${fecha}`

    for (const row of asisRows) {
      const key = `${row.horario_id}_${row.fecha}`;
      const existing = asistenciasMap.get(key);

      if (!existing) {
        asistenciasMap.set(key, row);
      } else {
        // Elegimos la más "reciente" por hora_registro
        const prevT = existing.hora_registro || "00:00:00";
        const newT = row.hora_registro || "00:00:00";
        if (newT > prevT) {
          asistenciasMap.set(key, row);
        }
      }
    }

    // -------------------------------
    // 5) Calcular estado de HORARIO
    // -------------------------------
    function calcularEstadoHorario(clase) {
      const diaNum = clase.dia_num; // 1..5
      const iniMin = toMin(clase.hora_ini);
      const finMin = toMin(clase.hora_fin);

      let estado_codigo = "impartida"; // por defecto

      if (dia === "hoy") {
        // Comparamos con el día REAL de hoy (todayLabel)
        if (diaNum === todayLabel) {
          if (nowMin >= iniMin && nowMin < finMin) {
            estado_codigo = "en_curso";
          } else if (nowMin < iniMin) {
            estado_codigo = "proxima";
          } else {
            estado_codigo = "impartida";
          }
        } else if (diaNum < todayLabel) {
          estado_codigo = "impartida";
        } else {
          estado_codigo = "proxima";
        }
      } else if (dia === "semana") {
        // Semana completa: comparamos contra todayLogic (0..5)
        if (diaNum < todayLogic) {
          estado_codigo = "impartida";
        } else if (diaNum > todayLogic) {
          estado_codigo = "proxima";
        } else {
          // mismo día lógico que hoy
          if (nowMin >= iniMin && nowMin < finMin) {
            estado_codigo = "en_curso";
          } else if (nowMin < iniMin) {
            estado_codigo = "proxima";
          } else {
            estado_codigo = "impartida";
          }
        }
      } else {
        // Día fijo "1".."5"
        const selec = Number(dia);
        if (selec < todayLogic) {
          estado_codigo = "impartida";
        } else if (selec > todayLogic) {
          estado_codigo = "proxima";
        } else {
          if (nowMin >= iniMin && nowMin < finMin) {
            estado_codigo = "en_curso";
          } else if (nowMin < iniMin) {
            estado_codigo = "proxima";
          } else {
            estado_codigo = "impartida";
          }
        }
      }

      const estado_label =
        estado_codigo === "en_curso"
          ? "En curso"
          : estado_codigo === "proxima"
          ? "Próxima"
          : "Impartida";

      // Texto auxiliar (para cuando quieres mostrar algo debajo)
      let texto = "";

      if (estado_codigo === "en_curso") {
        const restantes = finMin - nowMin;
        texto = `Termina en ${formatHM(restantes)}`;
      } else if (estado_codigo === "proxima") {
        // Si la clase es de hoy y todavía no comenzó → cuánto falta
        if (clase.dia_num === todayLabel) {
          const faltan = iniMin - nowMin;
          if (faltan > 0) texto = `Comienza en ${formatHM(faltan)}`;
        } else {
          texto = "Clase próxima esta semana";
        }
      } else {
        texto = "Clase ya impartida";
      }

      return { estado_codigo, estado_label, texto };
    }
console.log("CLASES CALCULADAS:", clases.map(c => ({
  id: c.id,
  fecha_clase: c.fecha_clase
})));

    // -------------------------------
    // 6) Unir TODO: clase + asistencia
    // -------------------------------
    const items = clases.map((clase) => {
      // Buscar asistencia de esta semana para esa clase
      const key = `${clase.id}_${clase.fecha_clase}`;
      const asistencia = asistenciasMap.get(key) || null;

      // Estado de horario (en curso / próxima / impartida)
      const { estado_codigo, estado_label, texto } =
        calcularEstadoHorario(clase);

      // Estado de registro (sin_registrar / tardio / etc)
      const regInfo = calcularEstadoRegistro(clase, asistencia);

      return {
        id: clase.id,
        lab_id: clase.lab_id,
        periodo_id: clase.periodo_id,
        lab: clase.lab,
        materia: clase.materia,
        dia_num: clase.dia_num,
        dia: clase.dia_label,
        fecha_clase: clase.fecha_clase,
        hora_ini: clase.hora_ini,
        hora_fin: clase.hora_fin,
        docente: clase.docente,

        // Estado del horario
        estado_codigo,
        estado: estado_label,
        texto_estado: texto,

        // Datos de registro / asistencia
        registro_codigo: regInfo.codigo,
        registro: regInfo.label,
        registro_detalle: regInfo.mensaje,

        // Info cruda de asistencia (por si el front la quiere)
        asistencia_id: asistencia ? asistencia.id : null,
        asistencia_fecha: asistencia ? asistencia.fecha : null,
        asistencia_hora_registro: asistencia ? asistencia.hora_registro : null,
        asistencia_invitado_nombre: asistencia ? asistencia.invitado_nombre : null,
      };
    });

    res.json(items);
  } catch (err) {
    console.error("GET /api/admin/asistencias-dia:", err);
    res.status(500).json({ ok: false, msg: "server_error" });
  }
});

/* =======================================================
   Ruta de salud / sanity
   ======================================================= */

r.get("/", (_req, res) => {
  res.json({ ok: true, scope: "admin" });
});

export default r;
