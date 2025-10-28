export function saveSession({ token, role }, { remember = true } = {}) {
  const primary = remember ? localStorage : sessionStorage;
  const secondary = remember ? sessionStorage : localStorage;
  primary.setItem("token", token);
  primary.setItem("role", role);
  // limpia el otro storage para evitar inconsistencias
  secondary.removeItem("token");
  secondary.removeItem("role");
}

export function getToken(){
  return localStorage.getItem("token") || sessionStorage.getItem("token");
}

export function getRole(){
  return localStorage.getItem("role") || sessionStorage.getItem("role");
}

export function clearSession(){
  localStorage.removeItem("token"); localStorage.removeItem("role");
  sessionStorage.removeItem("token"); sessionStorage.removeItem("role");
}

export function logout(){
  clearSession();
  window.location.href = "/login";
}
