// frontend-web/src/services/parametrosApi.js
import api from "./api";

/**
 * OJO:
 * Tu componente espera estos nombres:
 * - listParametros
 * - createParametro
 * - updateParametro
 * - setParametroActivo
 * - deleteParametro
 *
 * Aquí los exportamos tal cual.
 */

// LISTAR
export const listParametros = (params = {}) => {
  return api.get("/parametros", { params }); // <-- regresa {data: ...}
};

// CREAR
export const createParametro = (body) => {
  return api.post("/parametros", body);
};

// ACTUALIZAR
export const updateParametro = (id, body) => {
  return api.put(`/parametros/${id}`, body);
};

// ACTIVAR / DESACTIVAR (lo que tu UI llama setParametroActivo)
export const setParametroActivo = (id, activo) => {
  return api.patch(`/parametros/${id}/activo`, { activo });
};

// ELIMINAR (lo que tu UI llama deleteParametro)
export const deleteParametro = (id) => {
  return api.delete(`/parametros/${id}`);
};

// (Opcional) auditoría si la usas después
export const listParametrosAudit = (params = {}) => {
  return api.get("/parametros_audit", { params });
};

export default {
  listParametros,
  createParametro,
  updateParametro,
  setParametroActivo,
  deleteParametro,
  listParametrosAudit,
};
