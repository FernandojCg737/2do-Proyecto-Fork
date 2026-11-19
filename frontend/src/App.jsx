import { useEffect, useState } from "react";
import { BrowserRouter } from "react-router-dom";

import { apiRequest, TOKEN_KEY } from "./api";
import AppRoutes from "./AppRoutes";
import Layout from "./Layout";

function AppContent() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function validateSession() {
      const token = localStorage.getItem(TOKEN_KEY);

      if (!token) {
        setChecking(false);
        return;
      }

      try {
        const data = await apiRequest("/perfil");
        setUser(data);
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      } finally {
        setChecking(false);
      }
    }

    validateSession();
  }, []);

  useEffect(() => {
    function handleMobileFocus(event) {
      const target = event.target;
      if (
        typeof window !== "undefined" &&
        window.innerWidth <= 768 &&
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")
      ) {

        setTimeout(() => {
          target.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 300);
      }
    }

    window.addEventListener("focusin", handleMobileFocus);
    return () => {
      window.removeEventListener("focusin", handleMobileFocus);
    };
  }, []);

  return (

    <Layout
      user={user}
      onLogout={() => setUser(null)}
    >

      <AppRoutes
        user = {user}
        checking = { checking }
        onLogin={setUser}
      />

    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
