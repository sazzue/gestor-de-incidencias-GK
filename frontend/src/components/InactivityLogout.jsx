import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const INACTIVITY_LIMIT_MS = 5 * 60 * 1000;
const INACTIVITY_MESSAGE_KEY = "sessionInactiveMessage";
const ACTIVITY_EVENTS = [
  "click",
  "keydown",
  "mousemove",
  "scroll",
  "touchstart",
  "wheel",
];

function InactivityLogout() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    let timeoutId;

    const logoutByInactivity = () => {
      if (!localStorage.getItem("token")) return;

      localStorage.removeItem("token");
      localStorage.removeItem("user");
      sessionStorage.setItem(INACTIVITY_MESSAGE_KEY, "Tu sesion se cerro por inactividad.");
      window.dispatchEvent(new Event("auth-updated"));
      navigate("/login", {
        replace: true,
        state: { inactiveSession: true },
      });
    };

    const resetTimer = () => {
      window.clearTimeout(timeoutId);
      if (!localStorage.getItem("token")) return;
      timeoutId = window.setTimeout(logoutByInactivity, INACTIVITY_LIMIT_MS);
    };

    resetTimer();

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    return () => {
      window.clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });
    };
  }, [location.pathname, navigate]);

  return null;
}

export { INACTIVITY_MESSAGE_KEY };
export default InactivityLogout;
