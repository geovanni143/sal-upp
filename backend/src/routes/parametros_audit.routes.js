// backend/src/routes/parametros_audit.routes.js
import { Router } from "express";
import { pool } from "../services/db.js";

const r = Router();
const norm = (s) => String(s ?? "").trim();

r.get("/", async (req, res) => {
  try {
    const parametro_id = req.query.parametro_id ? Number(req.query.parametro_id) : null;
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 500) : 100;

    const where = [];
    const args = [];

    if (parametro_id && Number.isFinite(parametro_id)) {
      where.push("a.parametro_id = ?");
      args.push(parametro_id);
    }

    const sql =
      `SELECT a.id, a.parametro_id, a.accion, a.before_json, a.after_json, a.actor_user_id, a.created_at
       FROM parametros_audit a
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY a.id DESC
       LIMIT ?`;

    args.push(limit);

    const [rows] = await pool.query(sql, args);
    return res.json(rows);
  } catch (e) {
    console.error("[GET /parametros_audit]", e);
    return res.status(500).json({ message: "Error obteniendo auditoría" });
  }
});

export default r;
