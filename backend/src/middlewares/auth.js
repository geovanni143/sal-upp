import jwt from "jsonwebtoken";

/** Verifica JWT y coloca el payload en req.user */
export function verifyJWT(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "No token" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "secretito");
    req.user = payload; // ej. { id, username, role }
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

/** Restringe el acceso a roles permitidos */
export function requireRole(...allowed) {
  return (req, res, next) => {
    const role = req.user?.role;
    if (!role || !allowed.includes(role)) {
      return res.status(403).json({ error: "No autorizado" });
    }
    next();
  };
}

// === Alias para mantener compatibilidad con tus rutas ===
export { verifyJWT as requireAuth };
