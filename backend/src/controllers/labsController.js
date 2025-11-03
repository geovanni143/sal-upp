import { pool } from "../db.js";
import { logBitacora } from "../utils/bitacora.js";

/* GET /api/labs */
export async function listarLabs(_req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM laboratorios ORDER BY clave ASC"
    );
    return res.json(rows);
  } catch (e) {
    return res.status(500).json({ ok: false, msg: "Error al listar", error: e.message });
  }
}

/* POST /api/labs */
export async function crearLab(req, res) {
  try {
    const { clave, nombre, ubicacion, activo = 1 } = req.body || {};
    if (!clave || !nombre) {
      return res.status(400).json({ ok: false, msg: "Clave y nombre son obligatorios" });
    }

    // Unicidad de clave
    const [u] = await pool.query("SELECT id FROM laboratorios WHERE clave=?", [clave]);
    if (u.length) return res.status(409).json({ ok: false, msg: "La clave ya existe" });

    const [r] = await pool.query(
      "INSERT INTO laboratorios (clave,nombre,ubicacion,activo) VALUES (?,?,?,?)",
      [clave.trim(), nombre.trim(), ubicacion || null, activo ? 1 : 0]
    );

    await logBitacora({
      usuario: String(req.user?.uid || "sys"),
      accion: "CREATE",
      entidad: "laboratorios",
      entidad_id: r.insertId,
      detalle: JSON.stringify({ clave, nombre }),
    });

    return res.json({ ok: true, id: r.insertId });
  } catch (e) {
    return res.status(500).json({ ok: false, msg: "Error al crear", error: e.message });
  }
}

/* PUT /api/labs/:id */
export async function actualizarLab(req, res) {
  try {
    const { id } = req.params;
    const { nombre, ubicacion, activo } = req.body || {};
    if (!id) return res.status(400).json({ ok: false, msg: "id requerido" });
    if (!nombre) return res.status(400).json({ ok: false, msg: "nombre es obligatorio" });

    await pool.query(
      "UPDATE laboratorios SET nombre=?, ubicacion=?, activo=? WHERE id=?",
      [nombre.trim(), ubicacion || null, activo ? 1 : 0, id]
    );

    await logBitacora({
      usuario: String(req.user?.uid || "sys"),
      accion: "UPDATE",
      entidad: "laboratorios",
      entidad_id: Number(id),
      detalle: JSON.stringify({ nombre, ubicacion, activo }),
    });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, msg: "Error al actualizar", error: e.message });
  }
}

/* DELETE /api/labs/:id */
export async function eliminarLab(req, res) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ ok: false, msg: "id requerido" });

    // Bloqueo por relaciones (si existen tablas; si no existen, no truena)
    let tieneRel = false;
    let motivo = "";

    try {
      const [[h]] = await pool.query(
        "SELECT COUNT(*) c FROM horarios WHERE laboratorio_id=?",
        [id]
      );
      if ((h?.c || 0) > 0) {
        tieneRel = true;
        motivo = "Existen horarios relacionados";
      }
    } catch {}

    try {
      const [[a]] = await pool.query(
        "SELECT COUNT(*) c FROM asistencias WHERE laboratorio_id=?",
        [id]
      );
      if ((a?.c || 0) > 0) {
        tieneRel = true;
        motivo = motivo || "Existen asistencias relacionadas";
      }
    } catch {}

    if (tieneRel) {
      return res.status(409).json({
        ok: false,
        msg: `No se puede eliminar. ${motivo}.`,
      });
    }

    await pool.query("DELETE FROM laboratorios WHERE id=?", [id]);

    await logBitacora({
      usuario: String(req.user?.uid || "sys"),
      accion: "DELETE",
      entidad: "laboratorios",
      entidad_id: Number(id),
    });

    return res.json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, msg: "Error al eliminar", error: e.message });
  }
}
