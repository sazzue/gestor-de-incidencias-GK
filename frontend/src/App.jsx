import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";

import Dashboard from "./pages/Dashboard";
import Incidents from "./pages/Incidents";
import CreateIncidencia from "./pages/CreateIncidencia";
import Login from "./pages/Login";
import CreateUser from "./pages/CreateUser";
import MaintenanceCalendar from "./pages/MaintenanceCalendar";
import Info from "./pages/Info";

import PrivateRoute from "./components/PrivateRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* REDIRECCIÓN */}
        <Route path="/" element={<Navigate to="/login" />} />

        {/* LOGIN */}
        <Route path="/login" element={<Login />} />

        {/* RUTA DASHBOARD */}
        <Route
        path="/dashboard"
        element={
       <PrivateRoute>
       <Dashboard />
       </PrivateRoute>
      }
        />
         {/*Ruta de Info*/}
   <Route path="/info" element={<Info />} 
   
   />

        {/* RUTAS CON LAYOUT */}
        <Route element={<MainLayout />}>
          <Route path="/incidents" element={<Incidents />} />

          {/* PROTEGIDA POR ROLES */}
          <Route
            path="/create"
            element={
              <PrivateRoute roles={["admin", "gerencia", "direccion"]}>
                <CreateIncidencia />
              </PrivateRoute>
            }
            
          />
          <Route path="/users" element={<CreateUser />} />  
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

