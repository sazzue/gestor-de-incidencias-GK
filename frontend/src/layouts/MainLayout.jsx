import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";

function MainLayout() {
  return (
    <>
      <Navbar />

      <div style={{ paddingTop: "3px" }}>
        <Outlet />
      </div>
    </>
  );
}

export default MainLayout;