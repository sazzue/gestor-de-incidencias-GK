import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout.jsx";

import Login           from "./pages/Login.jsx";
import Dashboard       from "./pages/Dashboard.jsx";
import CreateIncidencia from "./pages/CreateIncidencia.jsx";
import Incidents       from "./pages/Incidents.jsx";
import MaintenanceCalendar from "./pages/MaintenanceCalendar.jsx";
import CreateUser      from "./pages/CreateUser.jsx";
import Info            from "./pages/Info.jsx";

// 🔐 Nuevas páginas de autenticación
import ForgotPassword  from "./pages/ForgotPassword.jsx";
import ResetPassword   from "./pages/ResetPassword.jsx";
import ChangePassword  from "./pages/ChangePassword.jsx";

import PrivateRoute    from "./components/PrivateRoute.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* ── Públicas ───────────────────────────────── */}
        <Route path="/"       element={<Navigate to="/login" />} />
        <Route path="/login"  element={<Login />} />
        <Route path="/users"  element={<CreateUser />} />

        {/* 🔐 Recuperación y cambio de contraseña */}
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/change-password" element={<ChangePassword />} />

        {/* ── Privadas ───────────────────────────────── */}
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          }
        />

        <Route element={<MainLayout />}>
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/info"      element={<Info />} />

          <Route
            path="/create"
            element={
              <PrivateRoute roles={["admin", "gerencia", "direccion"]}>
                <CreateIncidencia />
              </PrivateRoute>
            }
          />
        </Route>

        <Route
          path="/maintenance"
          element={
            <PrivateRoute>
              <MaintenanceCalendar />
            </PrivateRoute>
          }
        />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
