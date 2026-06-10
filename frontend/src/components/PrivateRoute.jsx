import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { hasPermission } from "../config/permissions";

function PrivateRoute({ children, roles, permissions }) {
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

  if (permissions && !permissions.every((permission) => hasPermission(user, permission))) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default PrivateRoute;
