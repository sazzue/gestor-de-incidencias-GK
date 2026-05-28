import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";

function PrivateRoute({ children, roles }) {
  const token = localStorage.getItem("token");
  let user = null;

  if (!token) {
    return <Navigate to="/login" />;
  }

  try {
    user = jwtDecode(token);
  } catch {
    return <Navigate to="/login" />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/incidents" />;
  }

  return children;
}

export default PrivateRoute;
