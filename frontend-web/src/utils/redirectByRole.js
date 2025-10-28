export function redirectByRole(role){
  if (["superadmin","admin_lab"].includes(role)) return "/admin";
  if (role === "docente") return "/docente";
  if (role === "mantenimiento") return "/mantenimiento";
  return "/403";
}
