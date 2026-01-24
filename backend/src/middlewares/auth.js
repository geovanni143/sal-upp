// backend/src/middlewares/auth.js
import jwt from "jsonwebtoken";

/* =========================================================
   AUTH MIDDLEWARE (SAL-UPP)
   - Exporta: requireAuth, requireRole
   - requireRole soporta:
       requireRole("admin")
       requireRole("admin","superadmin")
       requireRole(["admin","superadmin"])
   ========================================================= */

function getTokenFromHeader(req) {
  const h = req.headers.authorization || req.headers.Authorization;
  if (!h) return null;

  const parts = String(h).split(" ");
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) return parts[1];

  return String(h).trim();
}

export function requireAuth(req, res, next) {
  try {
    const token = getTokenFromHeader(req);

    if (!token) {
      return res.status(401).json({ error: "No autorizado: falta token" });
    }

    const secret = process.env.JWT_SECRET || process.env.SECRET || "dev_secret";
    const payload = jwt.verify(token, secret);

    // Normaliza el usuario en req.user
    req.user = payload?.user || payload;

    return next();
  } catch (err) {
    return res.status(401).json({ error: "No autorizado: token inválido" });
  }
}

/**
 * requireRole variádico:
 *  - requireRole("admin","superadmin")
 *  - requireRole(["admin","superadmin"])
 */
export function requireRole(...roles) {
  let allowed = roles;

  // Si viene como un arreglo único: requireRole(["admin","superadmin"])
  if (allowed.length === 1 && Array.isArray(allowed[0])) {
    allowed = allowed[0];
  }

  // Normaliza strings
  allowed = (allowed || []).filter(Boolean);

  return (req, res, next) => {
    const user = req.user || {};
    const role = user.rol || user.role;

    if (!role) {
      return res.status(403).json({ error: "Prohibido: rol no detectado" });
    }

    // Si no hay allow list, deja pasar
    if (!allowed.length) return next();

    if (!allowed.includes(role)) {
      return res.status(403).json({ error: "Prohibido: rol no permitido" });
    }

    return next();
  };
}

/* =========================
   ALIASES (por compatibilidad)
========================= */
export const auth = requireAuth;
export const authorize = requireRole;
export const requireRoles = requireRole;
