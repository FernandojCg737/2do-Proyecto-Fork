import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Loading } from "./Components";
import { apiRequest } from "./api";

// Formatea fecha YYYY-MM-DD a DD/MM/YYYY
function formatearFecha(fecha) {
  if (!fecha) return "";
  const partes = String(fecha).split("-");
  if (partes.length === 3) {
    const [anio, mes, dia] = partes;
    return `${dia}/${mes}/${anio}`;
  }
  return String(fecha);
}

// Formatea fecha y hora con zona horaria de Bolivia
function formatearFechaHora(fecha) {
  if (!fecha) return "Fecha no registrada";

  return new Date(fecha).toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HistorialPage() {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actualizacion, setActualizacion] = useState(0);

  useEffect(() => {
    let activo = true;

    // Consulta el historial cronológico de inscripciones y solicitudes del usuario
    async function cargarHistorial() {
      setLoading(true);
      setError("");
      try {
        const datos = await apiRequest("/historial-sesiones");
        if (activo) setHistorial(datos);
      } catch (err) {
        if (activo) setError(err.message);
      } finally {
        if (activo) setLoading(false);
      }
    }

    cargarHistorial();

    return () => {
      activo = false;
    };
  }, [actualizacion]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h2 mb-1">Mi historial de sesiones</h1>
          <p className="text-secondary mb-0">
            Tus solicitudes e inscripciones con fecha registrada aparecen de la más reciente a la más antigua.
          </p>
        </div>
        <div className="d-flex gap-2">
          <Link to="/sesions" className="btn btn-primary">
            Buscar sesiones
          </Link>
          <Link to="/dashboard" className="btn btn-outline-secondary">
            Volver al panel
          </Link>
        </div>
      </div>

      {loading && <Loading />}

      {!loading && error && (
        <div className="mb-3">
          <Alert type="danger" text={error} />
          <button
            type="button"
            className="btn btn-outline-primary"
            onClick={() => setActualizacion((valor) => valor + 1)}
          >
            Reintentar
          </button>
        </div>
      )}

      {!loading && !error && historial.length === 0 && (
        <div className="card card-body">
          <h2 className="h5">Todavía no tienes solicitudes ni inscripciones</h2>
          <p className="mb-0">
            Usa «Buscar sesiones» para encontrar una y solicitar unirte.
          </p>
        </div>
      )}

      {/* Listado cronológico de solicitudes con estados persistentes */}
      {!loading && !error && (
        <div className="d-grid gap-3">
          {historial.map((registro) => (
            <article className="card shadow-sm border" key={registro.sesion_id}>
              <div className="card-body">
                {/* --- TAREA 5: Insignia visual coloreada según el estado persistente --- */}
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <h2 className="h5 fw-bold mb-0">{registro.nombre}</h2>
                  {registro.estado === "aceptada" ? (
                    // Verde si el organizador aprobó la solicitud
                    <span className="badge bg-success">✅ Inscripción aceptada</span>
                  ) : registro.estado === "pendiente" ? (
                    // Amarillo si la solicitud aún espera respuesta
                    <span className="badge bg-warning text-dark">⏳ Solicitud pendiente</span>
                  ) : (
                    // Rojo si el organizador rechazó la solicitud
                    <span className="badge bg-danger">❌ Solicitud rechazada</span>
                  )}
                </div>

                <p className="mb-1">
                  <strong>Materia:</strong> {registro.materia} &bull; <strong>Modalidad:</strong> {registro.modalidad}
                </p>

                <p className="mb-1">
                  <strong>Fecha de la sesión:</strong> {formatearFecha(registro.fecha_sesion)}
                </p>

                <p className="mb-1 text-muted small">
                  <strong>Fecha de solicitud:</strong> {formatearFechaHora(registro.fecha_inscripcion)}
                </p>

                {/* Resultado textual legible */}
                <p className="mb-0">
                  <strong>Resultado:</strong>{" "}
                  <span className="fw-semibold">{registro.resultado}</span>
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
