import jwt from "jsonwebtoken";

/** Verifica JWT y normaliza rol/role */
export function verifyJWT(req, res, next) {
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;

  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || "secretito");
    // payload esperado: { id, username, rol }
    const rol = payload.rol || payload.role || null;
    req.user = { ...payload, rol, role: rol }; // compat: deja ambas keys
    next();
  } catch {
    return res.status(401).json({ error: "Token inválido" });
  }
}

/** Restringe el acceso a roles permitidos (superadmin siempre pasa) */
export function requireRole(...allowed) {
  return (req, res, next) => {
    const rol = req.user?.rol;
    if (!rol) return res.status(401).json({ error: "No autorizado" });
    if (rol === "superadmin") return next(); // 👈 siempre pasa
    if (!allowed.includes(rol)) return res.status(403).json({ error: "Prohibido" });
    next();
  };
}

// Alias
export { verifyJWT as requireAuth };
