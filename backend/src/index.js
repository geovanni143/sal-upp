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
// JSON
// ===============================
app.use(express.json());
app.use("/api/invitados", invitadosRoutes);

// ===============================
// ARCHIVOS ESTÁTICOS
// ===============================
app.use("/uploads", express.static(uploadsPath));

// ===============================
// RUTAS API
// ===============================
app.use("/api", authRoutes);
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
// ===============================
// HEALTH CHECK
// ===============================
app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// ===============================
// SERVER
// ===============================
const PORT = Number(process.env.PORT || 4000);

app.listen(PORT, () => {
  console.log("----------------------------------------");
  console.log(" SAL-UPP backend corriendo en :", PORT);
  console.log(" CORS permitido desde        : http://localhost:5173");
  console.log(" Archivos estáticos en       :", uploadsPath);
  console.log("----------------------------------------");
});
