// src/utils/redirectByRole.js

export function redirectByRole(role) {
  switch (role) {
    case "superadmin":
    case "admin":
    case "admin_lab":
      return "/admin";
    case "docente":
      return "/docente";
    default:
      return "/login";
  }
}
