import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { listLabs } from "../controllers/labs.controller.js";
const r = Router();
r.get("/", requireAuth, listLabs);
export default r;
