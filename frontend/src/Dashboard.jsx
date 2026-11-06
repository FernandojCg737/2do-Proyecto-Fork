import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Loading } from "./Components";
import { apiRequest } from "./api";
import NavPills from "./NavPills";

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
  const [searchParams] = useSearchParams();
  // CLASE 20: Arquitectura de información - Pestaña activa según navegación
  const tabParam = searchParams.get("tab");
  const tabActiva = tabParam === "mis-sesiones" ? "mis-sesiones" : "solicitudes";

  // --- TAREA 5: Estados para Solicitudes del Organizador y del Estudiante ---
  const [solicitudesOrganizador, setSolicitudesOrganizador] = useState([]);
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [procesando, setProcesando] = useState(null);
  const [actualizacion, setActualizacion] = useState(0);

  useEffect(() => {
    let activo = true;

    async function cargarDatos() {
      setLoading(true);
      setError("");
      try {
        const [solOrg, solEstudiante] = await Promise.all([
          apiRequest("/organizador/solicitudes"),
          apiRequest("/mis-solicitudes"),
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

  // --- TAREA 5: Responder solicitud (Aceptar o Rechazar) ---
  async function responder(sesionId, solicitanteId, decision) {
    const clave = `${sesionId}-${solicitanteId}`;
    setProcesando(clave);
    setError("");
    setMensaje("");
    try {
      const res = await apiRequest(`/solicitudes/${sesionId}/usuarios/${solicitanteId}/responder`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setMensaje(res.mensaje);
      setActualizacion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(null);
    }
  }

  // --- TAREA 6 & 7: Salir de sesión o abandonar lista de espera ---
  async function salirDeSesion(sesionId) {
    setProcesando(`salir-${sesionId}`);
    setError("");
    setMensaje("");
    try {
      const res = await apiRequest(`/sesiones/${sesionId}/salir`, { method: "POST" });
      setMensaje(res.mensaje || "Has salido de la sesión correctamente.");
      setActualizacion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(null);
    }
  }

  const pendientesOrganizador = solicitudesOrganizador.filter((s) => s.estado === "pendiente");
  const enEsperaOrganizador = solicitudesOrganizador.filter((s) => s.estado === "en_espera");
  const respondidasOrganizador = solicitudesOrganizador.filter((s) => !["pendiente", "en_espera"].includes(s.estado));

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-xl-10">
        {/* ENCABEZADO DE BIENVENIDA */}
        <div className="card border-0 shadow-sm mb-3">
          <div className="card-body p-3 p-md-4">
            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div>
                <span className="badge text-bg-success mb-1">Sesión activa</span>
                <h1 className="h4 fw-bold mb-0">Bienvenido, {user.nombre}</h1>
                <p className="text-secondary small mb-0">
                  Panel de control &bull; {user.email}
                </p>
              </div>
              <div className="d-flex gap-2 flex-wrap">
                <Link to="/sesions" className="btn btn-outline-primary btn-sm rounded-pill">
                  🔍 Explorar sesiones
                </Link>
                <Link to="/new-study" className="btn btn-primary btn-sm rounded-pill">
                  + Crear sesión
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* CLASE 20: Arquitectura de información - Pestañas de navegación organizadas */}
        <NavPills activeTab={tabActiva} />

        {/* Notificaciones */}
        {error && <Alert type="danger" text={error} />}
        {mensaje && <Alert type="success" text={mensaje} />}

        {loading ? (
          <Loading />
        ) : (
          <div>
            {/* ================================================================= */}
            {/* VISTA 1: MIS SOLICITUDES (Pestaña Estudiante - Clase 20) */}
            {/* ================================================================= */}
            {tabActiva === "solicitudes" && (
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <h2 className="h5 fw-bold mb-0 text-dark">
                      📨 Mis solicitudes
                    </h2>
                    <p className="text-muted small mb-0">
                      Consulta si ya aceptaron tu solicitud, si requieres reconfirmar o tu lugar en lista de espera.
                    </p>
                  </div>
                  <span className="badge bg-primary rounded-pill px-3 py-2">
                    {misSolicitudes.length} solicitud{misSolicitudes.length !== 1 ? "es" : ""}
                  </span>
                </div>
                <div className="card-body p-3 p-md-4">
                  {misSolicitudes.length === 0 ? (
                    <div className="text-center py-5 text-muted bg-light rounded-4">
                      <p className="fs-5 mb-2">Aún no has enviado solicitudes para unirte a sesiones.</p>
                      <p className="small mb-3">Encuentra una materia que te interese y postula a un grupo.</p>
                      <Link to="/sesions" className="btn btn-primary rounded-pill px-4">
                        🔍 Buscar sesiones disponibles
                      </Link>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {misSolicitudes.map((sol) => (
                        <div
                          key={sol.sesion_id}
                          className="card border border-light-subtle shadow-sm rounded-3 overflow-hidden"
                        >
                          <div className="card-body p-3 p-md-4">
                            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                              <div>
                                <span className="badge bg-secondary-subtle text-secondary small mb-1">
                                  {sol.materia}
                                </span>
                                <h3 className="h5 fw-bold mb-1 text-dark">
                                  {sol.sesion_nombre}
                                </h3>
                                <p className="text-muted small mb-0">
                                  Organizador: <strong>{sol.organizador_nombre}</strong> ({sol.organizador_email}) &bull; Fecha: {formatearFecha(sol.fecha_sesion)}
                                </p>
                              </div>

                              {/* CLASE 20: Insignia de estado limpia según el diseño de Arquitectura */}
                              <div className="text-end">
                                {sol.estado === "aceptada" && (
                                  <span className="badge bg-success text-white px-3 py-2 fs-6 rounded-pill d-inline-flex align-items-center gap-1 shadow-sm">
                                    ✓ Aceptada
                                  </span>
                                )}
                                {sol.estado === "pendiente" && (
                                  <span className="badge bg-warning text-dark px-3 py-2 fs-6 rounded-pill d-inline-flex align-items-center gap-1 shadow-sm">
                                    🕒 Pendiente de respuesta
                                  </span>
                                )}
                                {sol.estado === "en_espera" && (
                                  <span className="badge bg-info text-dark px-3 py-2 fs-6 rounded-pill d-inline-flex align-items-center gap-1 shadow-sm">
                                    ⏳ En lista de espera (Lugar #{sol.posicion || 1})
                                  </span>
                                )}
                                {sol.estado === "pendiente_reconfirmacion" && (
                                  <span className="badge bg-warning text-dark px-3 py-2 fs-6 rounded-pill d-inline-flex align-items-center gap-1 shadow-sm">
                                    ⚠️ Requiere reconfirmación
                                  </span>
                                )}
                                {sol.estado === "rechazada" && (
                                  <span className="badge bg-danger text-white px-3 py-2 fs-6 rounded-pill d-inline-flex align-items-center gap-1 shadow-sm">
                                    ❌ Rechazada
                                  </span>
                                )}
                              </div>
                            </div>

                            {sol.fecha_respuesta && (
                              <p className="small text-muted mb-2 fst-italic">
                                Respondida: {formatearHora(sol.fecha_respuesta)}
                              </p>
                            )}

                            {/* Acciones de la solicitud */}
                            <div className="pt-2 border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
                              <Link to="/sesions" className="btn btn-outline-primary btn-sm rounded-pill px-3">
                                Ver sesión
                              </Link>

                              {["aceptada", "en_espera", "pendiente", "pendiente_reconfirmacion"].includes(sol.estado) && (
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm rounded-pill px-3"
                                  disabled={procesando === `salir-${sol.sesion_id}`}
                                  onClick={() => salirDeSesion(sol.sesion_id)}
                                >
                                  {sol.estado === "en_espera"
                                    ? "Salir de lista de espera"
                                    : sol.estado === "aceptada"
                                    ? "Abandonar sesión"
                                    : sol.estado === "pendiente_reconfirmacion"
                                    ? "Retirarme de la sesión"
                                    : "Cancelar solicitud"}
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* VISTA 2: MIS SESIONES (Pestaña Organizador - Clase 20) */}
            {/* ================================================================= */}
            {tabActiva === "mis-sesiones" && (
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <h2 className="h5 fw-bold mb-0 text-dark">
                      👑 Mis sesiones (Organizador)
                    </h2>
                    <p className="text-muted small mb-0">
                      Gestiona las solicitudes de tus compañeros y la lista de espera de tus sesiones.
                    </p>
                  </div>
                  <Link to="/new-study" className="btn btn-primary btn-sm rounded-pill px-3">
                    + Crear nueva sesión
                  </Link>
                </div>
                <div className="card-body p-3 p-md-4">
                  {solicitudesOrganizador.length === 0 ? (
                    <div className="text-center py-5 text-muted bg-light rounded-4">
                      <p className="fs-5 mb-2">Aún no has recibido solicitudes en tus sesiones.</p>
                      <p className="small mb-3">Crea una sesión para convocar estudiantes de tu carrera.</p>
                      <Link to="/new-study" className="btn btn-primary rounded-pill px-4">
                        + Crear sesión de estudio
                      </Link>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {/* Subsección: Solicitudes pendientes de respuesta */}
                      {pendientesOrganizador.length > 0 && (
                        <div>
                          <h3 className="h6 text-danger fw-bold mb-2">
                            ⚠️ Pendientes de responder ({pendientesOrganizador.length})
                          </h3>
                          <div className="d-flex flex-column gap-2">
                            {pendientesOrganizador.map((sol) => (
                              <div
                                key={`${sol.sesion_id}-${sol.solicitante_id}`}
                                className="border rounded-3 p-3 bg-light shadow-sm"
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
                                <div className="d-flex gap-2">
                                  <button
                                    type="button"
                                    className="btn btn-success btn-sm rounded-pill px-3"
                                    disabled={procesando === `${sol.sesion_id}-${sol.solicitante_id}`}
                                    onClick={() => responder(sol.sesion_id, sol.solicitante_id, "aceptar")}
                                  >
                                    Aceptar
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-outline-danger btn-sm rounded-pill px-3"
                                    disabled={procesando === `${sol.sesion_id}-${sol.solicitante_id}`}
                                    onClick={() => responder(sol.sesion_id, sol.solicitante_id, "rechazar")}
                                  >
                                    Rechazar
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Subsección: En lista de espera */}
                      {enEsperaOrganizador.length > 0 && (
                        <div>
                          <h3 className="h6 text-primary fw-bold mb-2">
                            ⏳ En lista de espera ({enEsperaOrganizador.length})
                          </h3>
                          <div className="d-flex flex-column gap-2">
                            {enEsperaOrganizador.map((sol) => (
                              <div
                                key={`${sol.sesion_id}-${sol.solicitante_id}`}
                                className="border rounded-3 p-3 bg-light shadow-sm"
                              >
                                <div className="d-flex justify-content-between align-items-start mb-1">
                                  <div>
                                    <h4 className="h6 fw-bold mb-0">{sol.solicitante_nombre}</h4>
                                    <span className="text-muted small">{sol.solicitante_email}</span>
                                  </div>
                                  <span className="badge bg-info text-dark">Lugar #{sol.posicion || 1}</span>
                                </div>
                                <div className="small text-secondary">
                                  <strong>Sesión:</strong> {sol.sesion_nombre} ({sol.materia})
                                </div>
                                <div className="small text-muted mt-1 fst-italic">
                                  ℹ️ Ingresará automáticamente a confirmado si un participante sale.
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Subsección: Historial respondidas */}
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}
