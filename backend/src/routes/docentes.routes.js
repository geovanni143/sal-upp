import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { upsertDocente } from "../controllers/docentesController.js";

const r = Router();
r.post("/", requireAuth, upsertDocente);
r.put("/", requireAuth, upsertDocente);
export default r;
r.get("/", requireAuth, async (_req,res)=>{
  const [rows]=await pool.query("SELECT id,nombre,email,activo FROM docentes WHERE activo=1 ORDER BY nombre");
  res.json(rows);
});
