export function redirectByRole(rol) {
  if (rol === "superadmin" || rol === "admin") return "/admin";
  if (rol === "docente") return "/docente";
  return "/login";
}
