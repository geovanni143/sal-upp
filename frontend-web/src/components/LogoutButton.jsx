import { logout } from "../state/auth";

export default function LogoutButton(){
  return <button onClick={logout} title="Cerrar sesión">Cerrar sesión</button>;
}
