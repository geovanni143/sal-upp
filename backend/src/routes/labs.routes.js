import { Router } from "express";
import { pool } from "../services/db.js";           // <- tu pool mysql2/promise
import log from "../middlewares/bitacora.js";       // si aún no lo usas, puedes quitarlo

const r = Router();

/* Utilidad: trae una fila por id */
async function getById(id){
  const [rows] = await pool.query(
    "SELECT id, nombre, encargado, descripcion, activo FROM labs WHERE id=?",
    [id]
  );
  return rows[0] || null;
}

/* GET /api/labs  (lista + búsqueda). Soporta ?q= y ?includeDeleted= (no aplica aquí) */
r.get("/", async (req, res) => {
  try {
    const q = (req.query.q || "").trim();
    let sql   = "SELECT id, nombre, encargado, descripcion, activo FROM labs";
    const p   = [];
    if (q) {
      sql += " WHERE CONCAT_WS(' ', nombre, encargado, descripcion) LIKE ?";
      p.push(`%${q}%`);
    }
    sql += " ORDER BY nombre ASC";
    const [rows] = await pool.query(sql, p);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Error al listar labs", detail: e.message });
  }
});

/* POST /api/labs */
r.post("/", log("labs:create"), async (req, res) => {
  try {
    const { nombre, encargado = "", descripcion = "" } = req.body || {};
    if (!nombre?.trim())
      return res.status(400).json({ error: "'nombre' es requerido" });

    const [rs] = await pool.query(
      "INSERT INTO labs (nombre, encargado, descripcion, activo) VALUES (?,?,?,1)",
      [nombre.trim(), encargado.trim(), descripcion || ""]
    );

    const row = await getById(rs.insertId);
    res.status(201).json(row);
  } catch (e) {
    res.status(500).json({ error: "Error al crear lab", detail: e.message });
  }
});

/* PUT /api/labs/:id */
r.put("/:id", log("labs:update"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { nombre, encargado = "", descripcion = "" } = req.body || {};
    if (!id || !nombre?.trim())
      return res.status(400).json({ error: "Datos inválidos" });

    const cur = await getById(id);
    if (!cur) return res.status(404).json({ error: "Laboratorio no encontrado" });

    await pool.query(
      "UPDATE labs SET nombre=?, encargado=?, descripcion=? WHERE id=?",
      [nombre.trim(), encargado.trim(), descripcion || "", id]
    );

    const row = await getById(id);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Error al actualizar", detail: e.message });
  }
});

/* PATCH /api/labs/:id/activo (toggle) */
r.patch("/:id/activo", log("labs:toggle"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const cur = await getById(id);
    if (!cur) return res.status(404).json({ error: "Laboratorio no encontrado" });

    const nuevo = cur.activo ? 0 : 1;
    await pool.query("UPDATE labs SET activo=? WHERE id=?", [nuevo, id]);

    const row = await getById(id);
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Error al cambiar estado", detail: e.message });
  }
});

/* DELETE /api/labs/:id  (bloquea si tiene relaciones en horarios) */
r.delete("/:id", log("labs:delete"), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ error: "id requerido" });

    const cur = await getById(id);
    if (!cur) return res.status(404).json({ error: "Laboratorio no encontrado" });

    // detectar FK probable en horarios
    const posibles = ["lab_id", "laboratorio_id", "id_laboratorio", "id_lab"];
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME='horarios'
         AND COLUMN_NAME IN (${posibles.map(()=>"?").join(",")})`,
      posibles
    );

    if (cols.length) {
      const fk = cols[0].COLUMN_NAME;
      const [[{ n }]] = await pool.query(
        `SELECT COUNT(*) n FROM horarios WHERE \`${fk}\`=?`,
        [id]
      );
      if (n > 0) {
        return res.status(409).json({
          error: "No se puede eliminar: laboratorio con horarios vinculados",
          code: "LAB_HAS_SCHEDULES",
          reason: `Existen ${n} registros en 'horarios'.`
        });
      }
    }

    await pool.query("DELETE FROM labs WHERE id=?", [id]);
    res.sendStatus(204);
  } catch (e) {
    res.status(500).json({ error: "Error al eliminar", detail: e.message });
  }
});

export default r;
