import { Router } from "express";
import { requireAuth, requireRole } from "../middlewares/auth.js";
import {
  listarLabs,
  crearLab,
  actualizarLab,
  eliminarLab,
} from "../controllers/labsController.js";

const r = Router();

// Solo usuarios autenticados y con rol de administración
r.use(requireAuth, requireRole(["superadmin", "admin_lab"]));

r.get("/", listarLabs);
r.post("/", crearLab);
r.put("/:id", actualizarLab);
r.delete("/:id", eliminarLab);

export default r;
