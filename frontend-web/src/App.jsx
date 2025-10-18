import { Outlet, Link, useNavigate } from "react-router-dom";

export default function App(){
  const nav = useNavigate();
  const logout = ()=>{ localStorage.removeItem("token"); nav("/login"); }
  return (
    <div style={{maxWidth:960, margin:"20px auto", padding:"0 16px"}}>
      <header style={{display:"flex", gap:16, alignItems:"center", justifyContent:"space-between"}}>
        <h1>SAL-UPP</h1>
        <nav style={{display:"flex", gap:12}}>
          <Link to="/">Dashboard</Link>
          <Link to="/login">Login</Link>
          <button onClick={logout}>Salir</button>
        </nav>
      </header>
      <Outlet/>
    </div>
  );
}

