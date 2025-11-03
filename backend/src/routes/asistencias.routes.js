import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { requireAuth } from "../middlewares/auth.js";
import { registrarAsistencia } from "../controllers/asistenciasController.js";

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg").toLowerCase() || ".jpg";
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage });

const r = Router();
r.post("/",
  requireAuth,
  upload.fields([{ name: "foto", maxCount:1 }, { name: "firma", maxCount:1 }]),
  registrarAsistencia
);
export default r;
