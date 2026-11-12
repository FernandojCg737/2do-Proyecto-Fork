import { Link } from "react-router-dom";

/**
 * CLASE 20: Arquitectura de Información
 * Barra de navegación unificada por propósito y rol:
 * - Buscar sesiones: Para encontrar materias y explorar cupos (Cálculo I, Álgebra)
 * - Mis solicitudes: Para consultar estado de postulaciones y reconfirmaciones (Física, Química)
 * - Mis sesiones: Para el organizador gestionar postulantes
 * - Historial: Para consultar sesiones terminadas y pasadas (Programación)
 */
export default function NavPills({ activeTab = "buscar" }) {
  return (
    <nav aria-label="Navegación principal de secciones" className="mb-4">
      <div className="d-flex gap-2 flex-wrap align-items-center p-1 bg-white rounded-pill shadow-sm border border-light-subtle d-inline-flex">
        <Link
          to="/sesions"
          className={`btn btn-sm rounded-pill px-3 py-2 fw-semibold text-decoration-none transition ${
            activeTab === "buscar"
              ? "btn-primary shadow-sm text-white"
              : "btn-light text-secondary border-0"
          }`}
        >
          🔍 Buscar sesiones
        </Link>

        <Link
          to="/dashboard?tab=solicitudes"
          className={`btn btn-sm rounded-pill px-3 py-2 fw-semibold text-decoration-none transition ${
            activeTab === "solicitudes"
              ? "btn-primary shadow-sm text-white"
              : "btn-light text-secondary border-0"
          }`}
        >
          📨 Mis solicitudes
        </Link>

        <Link
          to="/dashboard?tab=mis-sesiones"
          className={`btn btn-sm rounded-pill px-3 py-2 fw-semibold text-decoration-none transition ${
            activeTab === "mis-sesiones"
              ? "btn-primary shadow-sm text-white"
              : "btn-light text-secondary border-0"
          }`}
        >
          👑 Mis sesiones
        </Link>

        <Link
          to="/historial"
          className={`btn btn-sm rounded-pill px-3 py-2 fw-semibold text-decoration-none transition ${
            activeTab === "historial"
              ? "btn-primary shadow-sm text-white"
              : "btn-light text-secondary border-0"
          }`}
        >
          📋 Historial
        </Link>

        {/* CLASE 21: Acceso al panel de telemetría y analítica de interacción */}
        <Link
          to="/analitica"
          className={`btn btn-sm rounded-pill px-3 py-2 fw-semibold text-decoration-none transition ${
            activeTab === "analitica"
              ? "btn-success shadow-sm text-white"
              : "btn-light text-secondary border-0"
          }`}
        >
          📊 Analítica
        </Link>
      </div>
    </nav>
  );
}

