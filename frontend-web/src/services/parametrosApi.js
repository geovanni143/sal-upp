// src/services/parametrosApi.js
import { api } from "./api";

/**
 * GET /parametros
 * params opcionales: q, scope, activo
 */
export const listParametros = (params = {}) => {
  return api.get("/parametros", { params });
};

/**
 * POST /parametros
 */
export const createParametro = (data) => {
  return api.post("/parametros", data);
};

/**
 * PUT /parametros/:id
 */
export const updateParametro = (id, data) => {
  return api.put(`/parametros/${id}`, data);
};

/**
 * PATCH /parametros/:id/activo
 * body: { activo: 0|1 }
 */
export const setParametroActivo = (id, activo) => {
  return api.patch(`/parametros/${id}/activo`, { activo });
};

/**
 * DELETE /parametros/:id
 */
export const deleteParametro = (id) => {
  return api.delete(`/parametros/${id}`);
};
