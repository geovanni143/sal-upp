import { Router } from "express";
import { pool } from "../services/db.js";
import { requireAuth } from "../middlewares/auth.js";

const r = Router();

/* Periodos activos o todos si no se manda filtro */
r.get("/periodos", requireAuth, async (req,res)=>{
  const onlyActive = String(req.query.activo||"") === "1";
  const [rows] = await pool.query(
    `SELECT id, nombre, fecha_ini, fecha_fin, activo FROM periodos ${onlyActive ? "WHERE activo=1" : ""} ORDER BY fecha_ini DESC`
  );
  res.json(rows);
});

/* Labs activos o todos si no se manda filtro */
r.get("/labs", requireAuth, async (req,res)=>{
  const onlyActive = String(req.query.activo||"") === "1";
  const [rows] = await pool.query(
    `SELECT id, nombre, encargado, descripcion, activo FROM labs ${onlyActive ? "WHERE activo=1" : ""} ORDER BY nombre`
  );
  res.json(rows);
});

/* Users: permite roles=docente,admin */
r.get("/users", requireAuth, async (req,res)=>{
  const roles = (req.query.roles||"").split(",").map(s=>s.trim()).filter(Boolean);
  let sql = `SELECT id, nombre, rol, activo FROM users WHERE eliminado=0`;
  const params = [];
  if (roles.length){
    sql += ` AND rol IN (${roles.map(_=>"?").join(",")})`;
    params.push(...roles);
  }
  sql += ` ORDER BY nombre`;
  const [rows] = await pool.query(sql, params);
  res.json(rows);
});

export default r;
