import api from "./client";

export function login({ user, password }) {
  // OJO: el backend espera exactamente { user, password }
  return api.post("/login", { user, password });
}
