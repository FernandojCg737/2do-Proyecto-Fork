// Importación de hooks de React para navegación y estado reactivo
import { useState } from "react";
// Importación de componentes de React Router DOM para enlaces y detección de ruta activa
import { Link, useLocation, useNavigate } from "react-router-dom";
// Importación de cliente HTTP y clave del token JWT de sesión
import { apiRequest, TOKEN_KEY } from "./api";

/**
 * ============================================================================
 * COMPONENTE LAYOUT (Encabezado y Navegación Responsiva StudyMatch)
 * ============================================================================
 * 
 * Principios de Diseño IHC aplicados:
 * 1. Fila Única en Escritorio: En resoluciones >= 992px todo el menú (Logo, 6 enlaces
 *    principales, saludo y botón de cierre) se distribuye fluidamente en UNA SOLA FILA
 *    sin saltos de línea ni elementos que caigan debajo.
 * 2. Simplicidad Móvil: En pantallas pequeñas (< 992px), el encabezado solo muestra
 *    el logo a la izquierda, y a la derecha una lupa (🔍) junto al botón de menú (☰).
 * 3. Estilo de Botones Rectangulares Suaves: Botones modernos con border-radius de 8px
 *    (estilo Linear/GitHub), abandonando la estética circular o de burbuja.
 * 4. Eliminación de Redundancia: No hay barras flotantes duplicadas en las páginas.
 */
export default function Layout({ user, onLogout, children }) {
  // Hook para redireccionar tras cerrar sesión
  const navigate = useNavigate();
  // Hook para conocer la URL actual y resaltar el enlace activo
  const location = useLocation();
  // Estado booleano para controlar la apertura/cierre del menú hamburguesa en móvil
  const [menuAbierto, setMenuAbierto] = useState(false);

  /**
   * Cierra la sesión del usuario tanto en el backend como en el almacenamiento local.
   */
  async function handleLogout() {
    try {
      if (localStorage.getItem(TOKEN_KEY)) {
        await apiRequest("/logout", { method: "POST" });
      }
    } catch {
      // Si la API falla, eliminamos el token igualmente por seguridad
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      onLogout();
      navigate("/login");
    }
  }

  /**
   * Determina si una ruta o parámetro de pestaña coincide con la ubicación actual.
   */
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
      {/* Barra de navegación superior fija en una sola fila fluida */}
      <nav className="navbar navbar-dark bg-dark shadow-sm sticky-top py-2">
        <div className="container-fluid px-3 px-xl-4 d-flex align-items-center justify-content-between flex-nowrap">
          
          {/* ================================================================ */}
          {/* LOGOTIPO DE LA APLICACIÓN (Extremo izquierdo)                   */}
          {/* ================================================================ */}
          <Link
            className="navbar-brand fw-bold d-flex align-items-center gap-2 m-0 flex-shrink-0 text-decoration-none"
            to={user ? "/dashboard" : "/"}
            onClick={() => setMenuAbierto(false)}
          >
            <span style={{ fontSize: "1.25rem" }}>📚</span>
            <span style={{ fontSize: "1.15rem", letterSpacing: "-0.01em" }}>StudyMatch</span>
          </Link>

          {/* ================================================================ */}
          {/* SECCIÓN MÓVIL (< 992px): Lupa de Búsqueda + Icono Hamburguesa    */}
          {/* ================================================================ */}
          {user ? (
            <div className="d-flex d-lg-none align-items-center gap-2 flex-shrink-0">
              {/* Lupa: Acceso directo a Buscar Sesiones */}
              <Link
                to="/sesions"
                onClick={() => setMenuAbierto(false)}
                className={`btn btn-sm d-flex align-items-center justify-content-center p-0 ${
                  esRutaActiva("/sesions")
                    ? "btn-primary text-white shadow-sm"
                    : "btn-outline-light text-white"
                }`}
                style={{ width: "38px", height: "38px", borderRadius: "8px", fontSize: "1.05rem" }}
                aria-label="Buscar sesiones"
                title="Buscar sesiones"
              >
                🔍
              </Link>

              {/* Icono de menú hamburguesa con esquinas suaves */}
              <button
                type="button"
                onClick={() => setMenuAbierto(!menuAbierto)}
                className="btn btn-outline-light btn-sm d-flex align-items-center justify-content-center p-0"
                style={{ width: "38px", height: "38px", borderRadius: "8px", fontSize: "1.25rem" }}
                aria-label={menuAbierto ? "Cerrar menú" : "Abrir menú de opciones"}
                aria-expanded={menuAbierto}
              >
                {menuAbierto ? "✕" : "☰"}
              </button>
            </div>
          ) : (
            // Si el usuario no ha iniciado sesión en móvil
            <div className="d-flex d-lg-none align-items-center gap-2">
              <Link to="/login" className="btn btn-outline-light btn-sm px-3">
                Ingresar
              </Link>
            </div>
          )}

          {/* ================================================================ */}
          {/* SECCIÓN ESCRITORIO (>= 992px): UNA SOLA FILA FLUIDA CON TODO     */}
          {/* ================================================================ */}
          <div className="d-none d-lg-flex align-items-center justify-content-between flex-grow-1 flex-nowrap ms-3">
            {user ? (
              <>
                {/* 6 opciones centrales en fila única */}
                <div className="d-flex align-items-center gap-1 flex-nowrap">
                  <Link
                    to="/sesions"
                    className={`btn btn-sm nav-link-btn ${
                      esRutaActiva("/sesions")
                        ? "btn-light text-dark fw-bold shadow-sm"
                        : "btn-outline-light border-0 text-white-50"
                    }`}
                  >
                    <span>🔍</span> <span>Buscar sesiones</span>
                  </Link>

                  <Link
                    to="/dashboard?tab=solicitudes"
                    className={`btn btn-sm nav-link-btn ${
                      esRutaActiva("/dashboard", "solicitudes")
                        ? "btn-light text-dark fw-bold shadow-sm"
                        : "btn-outline-light border-0 text-white-50"
                    }`}
                  >
                    <span>📨</span> <span>Mis solicitudes</span>
                  </Link>

                  <Link
                    to="/dashboard?tab=mis-sesiones"
                    className={`btn btn-sm nav-link-btn ${
                      esRutaActiva("/dashboard", "mis-sesiones")
                        ? "btn-light text-dark fw-bold shadow-sm"
                        : "btn-outline-light border-0 text-white-50"
                    }`}
                  >
                    <span>👑</span> <span>Mis sesiones</span>
                  </Link>

                  <Link
                    to="/historial"
                    className={`btn btn-sm nav-link-btn ${
                      esRutaActiva("/historial")
                        ? "btn-light text-dark fw-bold shadow-sm"
                        : "btn-outline-light border-0 text-white-50"
                    }`}
                  >
                    <span>📋</span> <span>Historial</span>
                  </Link>

                  {/* Opción de Analítica en escritorio */}
                  <Link
                    to="/analitica"
                    className={`btn btn-sm nav-link-btn ${
                      esRutaActiva("/analitica")
                        ? "btn-light text-dark fw-bold shadow-sm"
                        : "btn-outline-light border-0 text-white-50"
                    }`}
                  >
                    <span>📊</span> <span>Analítica</span>
                  </Link>

                  {/* Mis datos y salida honesta */}
                  <Link
                    to="/mis-datos"
                    className={`btn btn-sm nav-link-btn ${
                      esRutaActiva("/mis-datos")
                        ? "btn-light text-dark fw-bold shadow-sm"
                        : "btn-outline-light border-0 text-white-50"
                    }`}
                    data-testid="pill-mis-datos"
                  >
                    <span>🔒</span> <span>Mis datos</span>
                  </Link>
                </div>

                {/* Perfil del estudiante y botón Cerrar sesión en el extremo derecho */}
                <div className="d-flex align-items-center gap-2 flex-shrink-0 ms-auto flex-nowrap">
                  <span className="text-white-50 small text-nowrap me-1">
                    Hola, <strong className="text-white">{user.nombre}</strong>
                  </span>
                  <button
                    className="btn btn-outline-danger btn-sm text-nowrap px-3 py-1 fw-semibold"
                    onClick={handleLogout}
                  >
                    Cerrar sesión
                  </button>
                </div>
              </>
            ) : (
              // Enlaces para invitados no autenticados en escritorio
              <div className="d-flex align-items-center gap-2 ms-auto">
                <Link className="btn btn-outline-light btn-sm px-3" to="/login">
                  Iniciar sesión
                </Link>
                <Link className="btn btn-primary btn-sm px-3" to="/register">
                  Registrarse
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ================================================================ */}
        {/* MENÚ DESPLEGABLE MÓVIL (< 992px) AL TOCAR EL ICONO HAMBURGUESA   */}
        {/* ================================================================ */}
        {user && menuAbierto && (
          <div className="d-lg-none w-100 bg-dark border-top border-secondary-subtle px-3 py-3 shadow-lg">
            <div className="container-fluid">
              {/* Tarjeta del usuario conectado */}
              <div className="d-flex align-items-center justify-content-between pb-3 mb-3 border-bottom border-secondary border-opacity-50">
                <div>
                  <div className="text-white-50 small">Conectado como:</div>
                  <div className="text-white fw-bold fs-6">👤 {user.nombre}</div>
                  <div className="text-white-50 small">{user.email}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setMenuAbierto(false)}
                  className="btn-close btn-close-white"
                  aria-label="Cerrar menú"
                ></button>
              </div>

              {/* Lista vertical de opciones en móvil */}
              <div className="d-flex flex-column gap-2 mb-3">
                <Link
                  to="/dashboard?tab=solicitudes"
                  onClick={() => setMenuAbierto(false)}
                  className={`btn text-start px-3 py-2 fw-semibold ${
                    esRutaActiva("/dashboard", "solicitudes")
                      ? "btn-primary text-white shadow-sm"
                      : "btn-outline-light border-0 text-white-50"
                  }`}
                >
                  📨 Mis solicitudes
                </Link>

                <Link
                  to="/dashboard?tab=mis-sesiones"
                  onClick={() => setMenuAbierto(false)}
                  className={`btn text-start px-3 py-2 fw-semibold ${
                    esRutaActiva("/dashboard", "mis-sesiones")
                      ? "btn-primary text-white shadow-sm"
                      : "btn-outline-light border-0 text-white-50"
                  }`}
                >
                  👑 Mis sesiones
                </Link>

                <Link
                  to="/historial"
                  onClick={() => setMenuAbierto(false)}
                  className={`btn text-start px-3 py-2 fw-semibold ${
                    esRutaActiva("/historial")
                      ? "btn-primary text-white shadow-sm"
                      : "btn-outline-light border-0 text-white-50"
                  }`}
                >
                  📋 Historial
                </Link>

                <Link
                  to="/analitica"
                  onClick={() => setMenuAbierto(false)}
                  className={`btn text-start px-3 py-2 fw-semibold ${
                    esRutaActiva("/analitica")
                      ? "btn-primary text-white shadow-sm"
                      : "btn-outline-light border-0 text-white-50"
                  }`}
                >
                  📊 Analítica
                </Link>

                <Link
                  to="/mis-datos"
                  onClick={() => setMenuAbierto(false)}
                  className={`btn text-start px-3 py-2 fw-semibold ${
                    esRutaActiva("/mis-datos")
                      ? "btn-primary text-white shadow-sm"
                      : "btn-outline-light border-0 text-white-50"
                  }`}
                  data-testid="mobile-pill-mis-datos"
                >
                  🔒 Mis datos y salida honesta
                </Link>
              </div>

              {/* Botón para cerrar sesión desde móvil */}
              <button
                onClick={() => {
                  setMenuAbierto(false);
                  handleLogout();
                }}
                className="btn btn-outline-danger w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
              >
                <span>🚪</span>
                <span>Cerrar sesión</span>
              </button>
            </div>
          </div>
        )}
      </nav>

      {/* Contenido principal de cada página dentro del layout */}
      <main className="container-fluid px-3 px-xl-5 py-4">{children}</main>
    </>
  );
}
