import { Link, useLocation, useNavigate } from "react-router-dom";
import { apiRequest, TOKEN_KEY } from "./api";

export default function Layout({ user, onLogout, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  async function handleLogout() {
    try {
      if (localStorage.getItem(TOKEN_KEY)) {
        await apiRequest("/logout", { method: "POST" });
      }
    } catch {
      // Aunque la API falle, eliminamos el token local para cerrar sesión.
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      onLogout();
      navigate("/login");
    }
  }

  // Comprueba si una ruta o pestaña está activa para el estilo visual
  const esRutaActiva = (ruta, tabRequerida = null) => {
    if (location.pathname !== ruta) return false;
    if (tabRequerida) {
      const params = new URLSearchParams(location.search);
      const tabActual = params.get("tab") || "solicitudes";
      return tabActual === tabRequerida;
    }
    return true;
  };

  return (
    <>
      <nav className="navbar navbar-expand-lg bg-dark navbar-dark shadow-sm sticky-top">
        <div className="container">
          <Link className="navbar-brand fw-bold d-flex align-items-center gap-2" to={user ? "/dashboard" : "/"}>
            <span>📚</span>
            <span>StudyMatch</span>
          </Link>

          {/* CLASE 20 - Arquitectura de Información: Menú organizado por propósito y rol */}
          {user && (
            <div className="d-flex align-items-center gap-1 mx-lg-3 flex-wrap my-2 my-lg-0">
              <Link
                to="/sesions"
                className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold ${
                  esRutaActiva("/sesions") ? "btn-light text-dark fw-bold shadow-sm" : "btn-outline-light border-0 text-white-50"
                }`}
              >
                Buscar sesiones
              </Link>
              <Link
                to="/dashboard?tab=solicitudes"
                className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold ${
                  esRutaActiva("/dashboard", "solicitudes") ? "btn-light text-dark fw-bold shadow-sm" : "btn-outline-light border-0 text-white-50"
                }`}
              >
                Mis solicitudes
              </Link>
              <Link
                to="/dashboard?tab=mis-sesiones"
                className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold ${
                  esRutaActiva("/dashboard", "mis-sesiones") ? "btn-light text-dark fw-bold shadow-sm" : "btn-outline-light border-0 text-white-50"
                }`}
              >
                Mis sesiones
              </Link>
              <Link
                to="/historial"
                className={`btn btn-sm rounded-pill px-3 py-1 fw-semibold ${
                  esRutaActiva("/historial") ? "btn-light text-dark fw-bold shadow-sm" : "btn-outline-light border-0 text-white-50"
                }`}
              >
                Historial
              </Link>
            </div>
          )}

          <div className="d-flex align-items-center gap-2 ms-auto">
            {user ? (
              <>
                <span className="text-white-50 small d-none d-md-inline me-1">
                  Hola, <strong className="text-white">{user.nombre}</strong>
                </span>
                <button className="btn btn-outline-danger btn-sm rounded-pill px-3" onClick={handleLogout}>
                  Cerrar sesión
                </button>
              </>
            ) : (
              <>
                <Link className="btn btn-outline-light btn-sm rounded-pill px-3" to="/login">
                  Iniciar sesión
                </Link>
                <Link className="btn btn-primary btn-sm rounded-pill px-3" to="/register">
                  Registrarse
                </Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="container py-4">{children}</main>
    </>
  );
}
