import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";

import Login               from "./pages/Login.jsx";
import Dashboard           from "./pages/Dashboard.jsx";
import CreateIncidencia    from "./pages/CreateIncidencia.jsx";
import Incidents           from "./pages/Incidents.jsx";
import IncidentDetail      from "./pages/IncidentDetail.jsx";
import MaintenanceCalendar from "./pages/MaintenanceCalendar.jsx";
import Inventory           from "./pages/Inventory.jsx";
import Suppliers           from "./pages/Suppliers.jsx";
import CreateUser          from "./pages/CreateUser.jsx";
import Info                from "./pages/Info.jsx";
import SystemSettings      from "./pages/SystemSettings.jsx";
import PlatformIdentity    from "./pages/PlatformIdentity.jsx";
import Organizations       from "./pages/Organizations.jsx";
import Catalogs            from "./pages/Catalogs.jsx";
import ForgotPassword      from "./pages/ForgotPassword.jsx";
import ResetPassword       from "./pages/ResetPassword.jsx";
import ChangePassword      from "./pages/ChangePassword.jsx";
import AuditLog            from "./pages/AuditLog.jsx";

import PrivateRoute        from "./components/PrivateRoute.jsx";
import InactivityLogout    from "./components/InactivityLogout.jsx";
import { useNoAutoTranslate } from "./hooks/useNoAutoTranslate.js";
import { useTextInputAssist } from "./hooks/useTextInputAssist.js";

function App() {
  useNoAutoTranslate();
  useTextInputAssist();

  return (
    <BrowserRouter>
      <InactivityLogout />
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

        <Route path="/internal-tasks" element={
          <PrivateRoute>
            <Layout>
              <Incidents
                type="internal_task"
                title="Tareas internas"
                createLabel="Crear tarea interna"
                createPath="/internal-tasks/create"
                detailBasePath="/internal-tasks"
                viewPermission="INTERNAL_TASKS_VIEW"
                createPermission="INTERNAL_TASKS_CREATE"
                emptyPermissionMessage="No tienes permisos para ver tareas internas."
                exportTitle="Reporte de tareas internas"
                searchLabel="Buscar tareas internas"
              />
            </Layout>
          </PrivateRoute>
        } />

        <Route path="/incidents/:id" element={
          <PrivateRoute>
            <Layout><IncidentDetail /></Layout>
          </PrivateRoute>
        } />

        <Route path="/internal-tasks/:id" element={
          <PrivateRoute>
            <Layout><IncidentDetail backPath="/internal-tasks" /></Layout>
          </PrivateRoute>
        } />

        <Route path="/create" element={
          <PrivateRoute>
            <Layout><CreateIncidencia /></Layout>
          </PrivateRoute>
        } />

        <Route path="/internal-tasks/create" element={
          <PrivateRoute>
            <Layout>
              <CreateIncidencia
                type="internal_task"
                pageTitle="Crear tarea interna"
                subtitle="Asigna una tarea a tu departamento"
                backPath="/internal-tasks"
                permission="INTERNAL_TASKS_CREATE"
                submitLabel="Guardar tarea interna"
                successTitle="Tarea interna creada correctamente"
                successDetail="La tarea quedo registrada para seguimiento."
                noAccessMessage="No tienes permisos para crear tareas internas."
              />
            </Layout>
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

        <Route path="/suppliers" element={
          <PrivateRoute>
            <Layout><Suppliers /></Layout>
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

        <Route path="/audit" element={
          <PrivateRoute permissions={["AUDIT_VIEW"]}>
            <Layout><AuditLog /></Layout>
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
