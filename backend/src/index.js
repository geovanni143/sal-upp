import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

// ===============================
// IMPORTACIÓN DE RUTAS
// ===============================
import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import historialRoutes from "./routes/historial.routes.js";

import labsRoutes from "./routes/labs.routes.js";
import periodosRoutes from "./routes/periodos.routes.js";
import horariosRoutes from "./routes/horarios.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import asistenciasRoutes from "./routes/asistencias.routes.js";
import meRoutes from "./routes/me.routes.js";
import invitadosRoutes from "./routes/invitados.routes.js";
import docentesRoutes from "./routes/docentes.routes.js";
import incidentesRoutes from "./routes/incidentes.routes.js";

import parametrosRoutes from "./routes/parametros.routes.js";
import parametrosAuditRoutes from "./routes/parametros_audit.routes.js";

// ===============================
// PATHS & UPLOADS
// ===============================
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsPath = path.join(__dirname, "..", "uploads");

// ===============================
// APP
// ===============================
const app = express();

// ===============================
// CORS
// ===============================
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

// ===============================
// BODY
// ===============================
app.use(express.json());

// ===============================
// ARCHIVOS ESTÁTICOS
// ===============================
app.use("/uploads", express.static(uploadsPath));

// ===============================
// HEALTH CHECK
// ===============================
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "SAL-UPP backend" });
});

// ===============================
// RUTAS API
// ===============================
// Auth base
app.use("/api", authRoutes);

// Recursos
app.use("/api/users", usersRoutes);
app.use("/api/labs", labsRoutes);
app.use("/api/periodos", periodosRoutes);
app.use("/api/horarios", horariosRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/asistencias", asistenciasRoutes);
app.use("/api/me", meRoutes);
app.use("/api/docentes", docentesRoutes);
app.use("/api/incidentes", incidentesRoutes);
app.use("/api/historial", historialRoutes);

// Invitados (solo 1 vez, aquí)
app.use("/api/invitados", invitadosRoutes);

// Parámetros (solo si existen los archivos)
app.use("/api/parametros", parametrosRoutes);
app.use("/api/parametros_audit", parametrosAuditRoutes);

// ===============================
// 404 API (para ver claro qué ruta falta)
// ===============================
app.use("/api", (req, res) => {
  res.status(404).json({
    message: "Ruta API no encontrada",
    method: req.method,
    path: req.originalUrl,
  });
});

// ===============================
// ERROR HANDLER
// ===============================
app.use((err, _req, res, _next) => {
  console.error("[SERVER ERROR]", err);
  res.status(500).json({ message: "Error interno del servidor" });
});

// ===============================
// SERVER
// ===============================
const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
  console.log("----------------------------------------");
  console.log(" SAL-UPP backend corriendo en :", PORT);
  console.log(" Base URL API                : http://localhost:" + PORT + "/api");
  console.log(" CORS permitido desde        : http://localhost:5173");
  console.log(" Archivos estáticos en       :", uploadsPath);
  console.log("----------------------------------------");
});
