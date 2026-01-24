import axios from "axios";

const API = "http://localhost:3000/api/invitados";

export const registrarInvitado = async (payload) => {
  const { data } = await axios.post(`${API}/registrar`, payload);
  return data;
};
