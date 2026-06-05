import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";

import Login               from "./pages/Login.jsx";
import Dashboard           from "./pages/Dashboard.jsx";
import CreateIncidencia    from "./pages/CreateIncidencia.jsx";
import Incidents           from "./pages/Incidents.jsx";
import MaintenanceCalendar from "./pages/MaintenanceCalendar.jsx";
import Inventory           from "./pages/Inventory.jsx";
import CreateUser          from "./pages/CreateUser.jsx";
import Info                from "./pages/Info.jsx";
import SystemSettings      from "./pages/SystemSettings.jsx";
import PlatformIdentity    from "./pages/PlatformIdentity.jsx";
import Organizations       from "./pages/Organizations.jsx";
import Catalogs            from "./pages/Catalogs.jsx";
import ForgotPassword      from "./pages/ForgotPassword.jsx";
import ResetPassword       from "./pages/ResetPassword.jsx";
import ChangePassword      from "./pages/ChangePassword.jsx";

import PrivateRoute        from "./components/PrivateRoute.jsx";
import { useNoAutoTranslate } from "./hooks/useNoAutoTranslate.js";
import { useTextInputAssist } from "./hooks/useTextInputAssist.js";

function App() {
  useNoAutoTranslate();
  useTextInputAssist();

  return (
    <BrowserRouter>
      <Routes>

        {/* ── Públicas ───────────────────────────── */}
        <Route path="/"                element={<Navigate to="/login" />} />
        <Route path="/login"           element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password"  element={<ResetPassword />} />
        <Route path="/change-password" element={<ChangePassword />} />

        {/* ── Privadas con Sidebar ───────────────── */}
        <Route path="/dashboard" element={
          <PrivateRoute>
            <Layout><Dashboard /></Layout>
          </PrivateRoute>
        } />

        <Route path="/incidents" element={
          <PrivateRoute>
            <Layout><Incidents /></Layout>
          </PrivateRoute>
        } />

        <Route path="/create" element={
          <PrivateRoute>
            <Layout><CreateIncidencia /></Layout>
          </PrivateRoute>
        } />

        <Route path="/maintenance" element={
          <PrivateRoute>
            <Layout><MaintenanceCalendar /></Layout>
          </PrivateRoute>
        } />

        <Route path="/inventory" element={
          <PrivateRoute>
            <Layout><Inventory /></Layout>
          </PrivateRoute>
        } />

        <Route path="/users" element={
          <PrivateRoute>
            <Layout><CreateUser /></Layout>
          </PrivateRoute>
        } />

        <Route path="/catalogs" element={
          <PrivateRoute>
            <Layout><Catalogs /></Layout>
          </PrivateRoute>
        } />

        <Route path="/info" element={
          <PrivateRoute>
            <Layout><Info /></Layout>
          </PrivateRoute>
        } />

        <Route path="/settings" element={
          <PrivateRoute>
            <Layout><SystemSettings /></Layout>
          </PrivateRoute>
        } />

        <Route path="/platform-identity" element={
          <PrivateRoute>
            <Layout><PlatformIdentity /></Layout>
          </PrivateRoute>
        } />

        <Route path="/organizations" element={
          <PrivateRoute>
            <Layout><Organizations /></Layout>
          </PrivateRoute>
        } />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
