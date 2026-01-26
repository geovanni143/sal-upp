import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// Filtros iniciales (periodos + labs)
export const getFiltrosHistorial = async () => {
  const { data } = await axios.get(`${API}/filtros`);
  return data;
};

// Docentes para periodo + lab
export const getDocentesHistorial = async ({ periodoId, labId }) => {
  const { data } = await axios.get(`${API}/docentes`, {
    params: {
      periodoId,
      labId: labId ?? "",
    },
  });
  return data;
};

// Historial filtrado
export const getHistorial = async (filtros) => {
  const { data } = await axios.get(API, {
    params: filtros,
  });
  return data;
};
