import { useEffect, useState } from "react";
import { jwtDecode } from "jwt-decode";

const readUserFromToken = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    return jwtDecode(token);
  } catch {
    return null;
  }
};

export function useAuthUser() {
  const [user, setUser] = useState(readUserFromToken);

  useEffect(() => {
    const syncUser = () => setUser(readUserFromToken());

    window.addEventListener("auth-updated", syncUser);
    window.addEventListener("storage", syncUser);

    return () => {
      window.removeEventListener("auth-updated", syncUser);
      window.removeEventListener("storage", syncUser);
    };
  }, []);

  return user;
}
