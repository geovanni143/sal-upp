import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import labRoutes from "./routes/labs.js";

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(",") || true, credentials: true }));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "SAL-UPP backend", ts: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/labs", labRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Backend escuchando en puerto ${PORT}`));
