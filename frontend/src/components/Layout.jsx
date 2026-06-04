import Sidebar from "./Sidebar";
import { useSystemSettings } from "../hooks/useSystemSettings";
import { useEffect, useState } from "react";

function Layout({ children }) {
  useSystemSettings();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setIsSidebarOpen(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <>
      <div className="app-layout">
        <button
          className="mobile-menu-btn"
          type="button"
          aria-label="Abrir menu"
          onClick={() => setIsSidebarOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        {isSidebarOpen && (
          <button
            className="sidebar-backdrop"
            type="button"
            aria-label="Cerrar menu"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}
        <Sidebar
          isOpen={isSidebarOpen}
          onNavigate={() => setIsSidebarOpen(false)}
        />
        <main className="app-main">
          {children}
        </main>
      </div>

      <style>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          background: var(--app-bg);
          color: var(--app-text);
          font-family: 'Inter', sans-serif;
        }

        .app-layout {
          display: flex;
          min-height: 100vh;
          background: var(--app-bg);
          color: var(--app-text);
          font-family: 'Inter', sans-serif;
        }

        .app-main {
          flex: 1;
          overflow-y: auto;
          min-width: 0;
        }

        .mobile-menu-btn,
        .sidebar-backdrop {
          display: none;
        }

        @media (max-width: 768px) {
          .app-layout {
            display: block;
            min-height: 100vh;
          }

          .app-main {
            min-height: 100vh;
            padding-top: 58px;
          }

          .mobile-menu-btn {
            position: fixed;
            top: 12px;
            left: 12px;
            z-index: 1000;
            width: 42px;
            height: 42px;
            display: inline-flex;
            flex-direction: column;
            justify-content: center;
            gap: 5px;
            padding: 0 10px;
            border-radius: 10px;
            border: 1px solid rgba(255,255,255,0.12);
            background: color-mix(in srgb, var(--app-card) 88%, transparent);
            color: var(--app-title);
            box-shadow: 0 10px 30px rgba(0,0,0,0.28);
            backdrop-filter: blur(12px);
            cursor: pointer;
          }

          .mobile-menu-btn span {
            display: block;
            width: 100%;
            height: 2px;
            border-radius: 999px;
            background: var(--app-title);
          }

          .sidebar-backdrop {
            position: fixed;
            inset: 0;
            z-index: 1000;
            display: block;
            border: none;
            background: rgba(2,6,23,0.58);
            backdrop-filter: blur(2px);
            cursor: pointer;
          }
        }
      `}</style>
    </>
  );
}

export default Layout;
