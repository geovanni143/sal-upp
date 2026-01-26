import axios from "axios";

const API = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// 👉 base correcta del historial
const HISTORIAL_API = `${API}/historial`;

// Filtros iniciales (periodos + labs)
export const getFiltrosHistorial = async () => {
  const { data } = await axios.get(`${HISTORIAL_API}/filtros`);
  return data;
};

// Docentes para periodo + lab
export const getDocentesHistorial = async ({ periodoId, labId }) => {
  const { data } = await axios.get(`${HISTORIAL_API}/docentes`, {
    params: {
      periodoId,
      labId: labId ?? "",
    },
  });
  return data;
};

// Historial filtrado
export const getHistorial = async (filtros) => {
  const { data } = await axios.get(HISTORIAL_API, {
    params: filtros,
  });
  return data;
};
