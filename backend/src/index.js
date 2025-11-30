// src/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.routes.js";
import usersRoutes from "./routes/users.routes.js";
import labsRoutes from "./routes/labs.routes.js";
import periodosRoutes from "./routes/periodos.routes.js";
import horariosRoutes from "./routes/horarios.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import meRoutes from "./routes/me.routes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CORREGIDO ✔ — uploads está en /backend/uploads, NO en /backend/src/uploads
const uploadsPath = path.join(__dirname, "..", "uploads");
console.log("Uploads dir REAL:", uploadsPath);

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json());

// Servir archivos estáticos correctamente ✔
app.use("/uploads", express.static(uploadsPath));

/* Rutas */
app.use("/api", authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/labs", labsRoutes);
app.use("/api/periodos", periodosRoutes);
app.use("/api/horarios", horariosRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/me", meRoutes);

const PORT = Number(process.env.PORT || 4000);
app.listen(PORT, () => {
  console.log("----------------------------------------");
  console.log("  SAL-UPP backend corriendo en :", PORT);
  console.log("  CORS permitido desde          : http://localhost:5173");
  console.log("  Archivos estáticos en         :", uploadsPath);
  console.log("----------------------------------------");
});
