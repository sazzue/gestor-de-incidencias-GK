import Sidebar from "./Sidebar";

function Layout({ children }) {
  return (
    <>
      <div className="app-layout">
        <Sidebar />
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
          background: #0b1220;
          color: white;
          font-family: 'Inter', sans-serif;
        }

        .app-layout {
          display: flex;
          min-height: 100vh;
          background: #0b1220;
          color: white;
          font-family: 'Inter', sans-serif;
        }

        .app-main {
          flex: 1;
          overflow-y: auto;
          min-width: 0;
        }

        @media (max-width: 768px) {
          .app-layout {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}

export default Layout;
