import "dotenv/config";
import express from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import { requireAuth } from "./middlewares/auth.js";

const app = express();
const PORT = process.env.PORT || 4000;

app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: false,
  hsts: { maxAge: 15552000, includeSubDomains: true, preload: true },
  referrerPolicy: { policy: "no-referrer" }
}));

app.use((req, res, next) => {
  const xfProto = req.get("x-forwarded-proto");
  const isSecure = req.secure || xfProto === "https";
  if (process.env.NODE_ENV === "production" && !isSecure){
    return res.redirect(301, `https://${req.get("host")}${req.originalUrl}`);
  }
  next();
});

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(compression({ level: 6 }));

// Rutas públicas
app.use("/api", authRoutes);

// Ruta protegida de prueba
app.get("/api/secure/ping", requireAuth, (_req, res) => {
  res.json({ ok:true, msg:"pong" });
});

app.listen(PORT, () => {
  console.log(`Backend SAL-UPP escuchando en puerto ${PORT}`);
});
