import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Loading } from "./Components";
import { apiRequest } from "./api";

// Formatea fecha a formato legible local DD/MM/YYYY
function formatearFecha(fecha) {
  if (!fecha) return "";
  const partes = String(fecha).split("-");
  if (partes.length === 3) {
    const [anio, mes, dia] = partes;
    return `${dia}/${mes}/${anio}`;
  }
  return String(fecha);
}

// Formatea marca de tiempo ISO a fecha y hora de Bolivia
function formatearHora(fechaIso) {
  if (!fechaIso) return "";
  try {
    const fecha = new Date(fechaIso);
    return fecha.toLocaleDateString("es-BO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return fechaIso;
  }
}

export default function Dashboard({ user }) {
  // --- TAREA 5: Estados para Solicitudes del Organizador y del Estudiante ---
  // Guarda las solicitudes entrantes dirigidas a las sesiones creadas por el usuario
  const [solicitudesOrganizador, setSolicitudesOrganizador] = useState([]);
  // Guarda las solicitudes enviadas por el usuario a sesiones de otros organizadores
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  // Guarda el id de la solicitud en proceso de respuesta para evitar clics dobles
  const [procesando, setProcesando] = useState(null);
  const [actualizacion, setActualizacion] = useState(0);

  useEffect(() => {
    let activo = true;

    // Carga paralela de solicitudes recibidas (organizador) y solicitudes enviadas (estudiante)
    async function cargarDatos() {
      setLoading(true);
      setError("");
      try {
        const [solOrg, solEstudiante] = await Promise.all([
          apiRequest("/organizador/solicitudes"), // Endpoint Tarea 5 para organizador
          apiRequest("/mis-solicitudes"),         // Endpoint Tarea 5 para estudiante
        ]);
        if (activo) {
          setSolicitudesOrganizador(solOrg);
          setMisSolicitudes(solEstudiante);
        }
      } catch (err) {
        if (activo) setError(err.message);
      } finally {
        if (activo) setLoading(false);
      }
    }

    cargarDatos();
    return () => {
      activo = false;
    };
  }, [actualizacion]);

  // --- TAREA 5: Responder solicitud (Aceptar o Rechazar) directamente desde el Dashboard ---
  async function responder(sesionId, solicitanteId, decision) {
    const clave = `${sesionId}-${solicitanteId}`;
    setProcesando(clave);
    setError("");
    setMensaje("");
    try {
      // Envía la decisión al endpoint de resolución del backend
      const res = await apiRequest(`/solicitudes/${sesionId}/usuarios/${solicitanteId}/responder`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setMensaje(res.mensaje);
      // Dispara la recarga inmediata para actualizar la lista de solicitudes
      setActualizacion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(null);
    }
  }

  // Filtrado de solicitudes recibidas entre pendientes y resueltas
  const pendientesOrganizador = solicitudesOrganizador.filter((s) => s.estado === "pendiente");
  const respondidasOrganizador = solicitudesOrganizador.filter((s) => s.estado !== "pendiente");

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-xl-10">
        {/* ENCABEZADO DE BIENVENIDA */}
        <div className="card border-0 shadow-sm mb-4">
          <div className="card-body p-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <span className="badge text-bg-success mb-2">Sesión activa</span>
                <h1 className="h3 fw-bold mb-1">Bienvenido, {user.nombre}</h1>
                <p className="text-secondary mb-0">
                  Panel de control de <strong>StudyMatch</strong> &bull; {user.email}
                </p>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <Link to="/sesions" className="btn btn-primary">
                  🔍 Explorar sesiones
                </Link>
                <Link to="/new-study" className="btn btn-outline-primary">
                  + Crear sesión
                </Link>
                <Link to="/historial" className="btn btn-outline-secondary">
                  📋 Mi historial
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Notificaciones */}
        {error && <Alert type="danger" text={error} />}
        {mensaje && <Alert type="success" text={mensaje} />}

        {loading ? (
          <Loading />
        ) : (
          <div className="row g-4">
            {/* --- SECCIÓN 1: PANEL ORGANIZADOR (Solicitudes a mis sesiones) --- */}
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                  <h2 className="h5 fw-bold mb-0">
                    👑 Solicitudes a mis sesiones
                  </h2>
                  {pendientesOrganizador.length > 0 ? (
                    <span className="badge bg-danger rounded-pill">
                      {pendientesOrganizador.length} pendiente{pendientesOrganizador.length > 1 ? "s" : ""}
                    </span>
                  ) : (
                    <span className="badge bg-secondary rounded-pill">Al día</span>
                  )}
                </div>
                <div className="card-body p-3">
                  <p className="small text-muted mb-3">
                    Como organizador, tú decides quién se une a tus sesiones. Al aceptar, se descuenta un cupo disponible.
                  </p>

                  {solicitudesOrganizador.length === 0 ? (
                    <div className="text-center py-4 text-muted bg-light rounded">
                      <p className="mb-0">Aún no has recibido solicitudes para tus sesiones de estudio.</p>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {/* Subsección: Solicitudes pendientes de respuesta */}
                      {pendientesOrganizador.length > 0 && (
                        <div>
                          <h3 className="h6 text-danger fw-bold mb-2">
                            Pendientes de responder ({pendientesOrganizador.length})
                          </h3>
                          <div className="d-flex flex-column gap-2">
                            {pendientesOrganizador.map((sol) => (
                              <div
                                key={`${sol.sesion_id}-${sol.solicitante_id}`}
                                className="border rounded p-3 bg-light shadow-sm"
                              >
                                <div className="d-flex justify-content-between align-items-start mb-1">
                                  <div>
                                    <h4 className="h6 fw-bold mb-0">{sol.solicitante_nombre}</h4>
                                    <span className="text-muted small">{sol.solicitante_email}</span>
                                  </div>
                                  <span className="badge bg-warning text-dark">Pendiente</span>
                                </div>
                                <div className="small text-secondary mb-2">
                                  <strong>Sesión:</strong> {sol.sesion_nombre} ({sol.materia})
                                </div>
                                {/* Botones para que el organizador acepte o rechace la solicitud */}
                                <div className="d-flex gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-success flex-fill"
                                    disabled={procesando === `${sol.sesion_id}-${sol.solicitante_id}`}
                                    onClick={() => responder(sol.sesion_id, sol.solicitante_id, "aceptar")}
                                  >
                                    ✓ Aceptar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger flex-fill"
                                    disabled={procesando === `${sol.sesion_id}-${sol.solicitante_id}`}
                                    onClick={() => responder(sol.sesion_id, sol.solicitante_id, "rechazar")}
                                  >
                                    ✕ Rechazar
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Subsección: Historial de solicitudes ya resueltas */}
                      {respondidasOrganizador.length > 0 && (
                        <div className="mt-2">
                          <h3 className="h6 text-muted fw-bold mb-2">
                            Historial de solicitudes respondidas
                          </h3>
                          <div className="d-flex flex-column gap-2">
                            {respondidasOrganizador.slice(0, 5).map((sol) => (
                              <div
                                key={`${sol.sesion_id}-${sol.solicitante_id}`}
                                className="border rounded p-2 bg-white small d-flex justify-content-between align-items-center"
                              >
                                <div>
                                  <strong>{sol.solicitante_nombre}</strong> en <em>{sol.sesion_nombre}</em>
                                </div>
                                <div>
                                  {sol.estado === "aceptada" ? (
                                    <span className="badge bg-success">Aceptada</span>
                                  ) : (
                                    <span className="badge bg-danger">Rechazada</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* --- SECCIÓN 2: PANEL ESTUDIANTE (Mis solicitudes enviadas) --- */}
            <div className="col-12 col-lg-6">
              <div className="card border-0 shadow-sm h-100">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
                  <h2 className="h5 fw-bold mb-0">
                    📨 Mis solicitudes enviadas
                  </h2>
                  <span className="badge bg-primary rounded-pill">
                    {misSolicitudes.length} total
                  </span>
                </div>
                <div className="card-body p-3">
                  <p className="small text-muted mb-3">
                    Sesiones a las que has solicitado unirte. Tu estado persiste incluso al recargar o volver a entrar.
                  </p>

                  {misSolicitudes.length === 0 ? (
                    <div className="text-center py-4 text-muted bg-light rounded">
                      <p className="mb-2">Aún no has enviado solicitudes para unirte a sesiones.</p>
                      <Link to="/sesions" className="btn btn-sm btn-outline-primary">
                        Buscar sesiones disponibles
                      </Link>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-2">
                      {misSolicitudes.map((sol) => (
                        <div
                          key={sol.sesion_id}
                          className="border rounded p-3 bg-white shadow-sm"
                        >
                          <div className="d-flex justify-content-between align-items-start mb-1">
                            <h4 className="h6 fw-bold mb-0">{sol.sesion_nombre}</h4>
                            {/* Insignia del estado de la solicitud según la respuesta del organizador */}
                            {sol.estado === "pendiente" ? (
                              <span className="badge bg-warning text-dark">⏳ Pendiente</span>
                            ) : sol.estado === "aceptada" ? (
                              <span className="badge bg-success">✅ Aceptada</span>
                            ) : (
                              <span className="badge bg-danger">❌ Rechazada</span>
                            )}
                          </div>
                          <div className="small text-muted mb-1">
                            <strong>Materia:</strong> {sol.materia} &bull; <strong>Modalidad:</strong> {sol.modalidad}
                          </div>
                          <div className="small text-secondary">
                            <strong>Organizador:</strong> {sol.organizador_nombre} ({sol.organizador_email})
                          </div>
                          {sol.fecha_respuesta && (
                            <div className="small text-muted mt-1 fst-italic">
                              Respondida: {formatearHora(sol.fecha_respuesta)}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
