import { jwtDecode } from "jwt-decode";
import { useNavigate, Link } from "react-router-dom";

function Navbar() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const user = token ? jwtDecode(token) : null;

   console.log("USER DECODIFICADO:", user);

  const logout = () => {
    localStorage.removeItem("token");
    navigate("/login");
  };

  return (
    <div
      style={{
        container: {
  padding: "5px 20px",
},
title: {
  marginBottom: "5px",
  marginTop: "5px",
},
        display: "flex",
        justifyContent: "space-between",
        padding: "10px 20px",
        background: "#222",
        color: "#fff",
        alignItems: "center",
      }}
    >
      <div>
        <strong>Panel Incidencias</strong>
</div>

      <button
  className={location.pathname === "/dashboard" ? "active" : ""}
  onClick={() => navigate("/dashboard")}
>
  INICIO
</button>


      <div>
        👤 {user?.nombre} ({user?.role})

        <button onClick={logout} style={{ marginLeft: 10 }}>
          Logout
        </button>
      </div>
    </div>
  );
}

export default Navbar;