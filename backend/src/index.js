import "dotenv/config";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";

// Middlewares
import { requireAuth } from "./middlewares/auth.js";

// Rutas
import authRoutes from "./routes/auth.routes.js";
import labsRoutes from "./routes/labs.routes.js";
import periodosRoutes from "./routes/periodos.routes.js";
import docentesRoutes from "./routes/docentes.routes.js";
import asistenciasRoutes from "./routes/asistencias.routes.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Confianza en proxy (necesario para HTTPS en producción)
app.set("trust proxy", 1);

// Seguridad con Helmet
app.use(helmet({
  contentSecurityPolicy: false,
  hsts: { maxAge: 15552000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: "no-referrer" }
}));

// Redirección automática a HTTPS en producción
app.use((req, res, next) => {
  const xfProto = req.get("x-forwarded-proto");
  const isSecure = req.secure || xfProto === "https";
  if (process.env.NODE_ENV === "production" && !isSecure) {
    return res.redirect(301, `https://${req.get("host")}${req.originalUrl}`);
  }
  next();
});

// CORS, JSON y compresión
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(compression({ level: 6 }));

// Carpeta pública para uploads
app.use("/uploads", express.static("uploads"));

// ===================== Rutas =====================

// Públicas (sin auth)
app.use("/api", authRoutes);

// Protegidas (con auth)
app.use("/api/labs", requireAuth, labsRoutes);
app.use("/api/periodos", requireAuth, periodosRoutes);
app.use("/api/docentes", requireAuth, docentesRoutes);
app.use("/api/asistencias", requireAuth, asistenciasRoutes);

// Ruta protegida de prueba
app.get("/api/secure/ping", requireAuth, (_req, res) => {
  res.json({ ok: true, msg: "pong" });
});

// =================================================

app.listen(PORT, () => {
  console.log(`Backend SAL-UPP escuchando en puerto ${PORT}`);
});
