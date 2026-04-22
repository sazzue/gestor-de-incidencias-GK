import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

function PrivateRoute({ children, roles }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/login" />;
  }

  try {
    const user = jwtDecode(token);

    // 🔐 validar roles si se envían
    if (roles && !roles.includes(user.role)) {
      return <Navigate to="/incidents" />;
    }

    return children;

  } catch (error) {
    return <Navigate to="/login" />;
  }
}

export default PrivateRoute;