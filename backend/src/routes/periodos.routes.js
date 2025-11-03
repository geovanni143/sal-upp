import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { crearPeriodo, crearHorario } from "../controllers/periodosController.js";

const r = Router();
r.post("/", requireAuth, crearPeriodo);
r.post("/horarios", requireAuth, crearHorario);
export default r;
