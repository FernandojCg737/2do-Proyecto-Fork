import { useEffect, useState } from "react";
import { Link, useSearchParams, useLocation } from "react-router-dom";
import { Alert, Loading } from "./Components";
import { apiRequest } from "./api";
import NavPills from "./NavPills";
import {
  InsigniaAsistencia,
  ModalControlAsistencia,
  ModalJustificarAusencia,
} from "./AsistenciaComponents";
import { formatearFecha } from "./fechas";

// Formatea marca de tiempo ISO a fecha y hora de Bolivia
function formatearHora(fechaIso) {
  if (!fechaIso) return "";
  const fecha = new Date(fechaIso);
  // Un valor que no es una fecha se muestra tal cual en lugar de «Invalid Date».
  if (Number.isNaN(fecha.getTime())) return String(fechaIso);
  return fecha.toLocaleDateString("es-BO", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Dashboard({ user }) {
  const [searchParams] = useSearchParams();
  // Hook para acceder al estado de navegación (ej. mensajes de éxito tras crear una sesión)
  const location = useLocation();
  // CLASE 20: Arquitectura de información - Pestaña activa según navegación
  const tabParam = searchParams.get("tab");
  const tabActiva = tabParam === "mis-sesiones" ? "mis-sesiones" : "solicitudes";

  // --- TAREA 5: Estados para Solicitudes del Organizador y del Estudiante ---
  const [solicitudesOrganizador, setSolicitudesOrganizador] = useState([]);
  const [misSolicitudes, setMisSolicitudes] = useState([]);
  const [misSesiones, setMisSesiones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Inicializa el mensaje informativo con el estado transferido desde la navegación previa si existe
  const [mensaje, setMensaje] = useState(location.state?.mensaje || "");
  const [procesando, setProcesando] = useState(null);
  const [actualizacion, setActualizacion] = useState(0);

  // Panel colapsable de solicitudes por sesión en las tarjetas del organizador
  const [panelAbierto, setPanelAbierto] = useState(null);

  // --- TAREA 7: Estados para Modal de Reprogramación ---
  const [modalReprogramar, setModalReprogramar] = useState(null);
  const [reprogFecha, setReprogFecha] = useState("");
  const [reprogMotivo, setReprogMotivo] = useState("");
  const [guardandoReprog, setGuardandoReprog] = useState(false);

  // --- TAREA 8: Modales de Control de Asistencia y Justificaciones ---
  const [modalAsistencia, setModalAsistencia] = useState(null); // { id, nombre }
  const [modalJustificar, setModalJustificar] = useState(null); // { id, nombre }

  // --- TAREA 9: Estados para Modal de Cancelación ---
  const [modalCancelar, setModalCancelar] = useState(null);
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  const [cancelando, setCancelando] = useState(false);

  useEffect(() => {
    let activo = true;

    async function cargarDatos() {
      setLoading(true);
      setError("");
      try {
        const [solOrg, solEstudiante, todasSesiones] = await Promise.all([
          apiRequest("/organizador/solicitudes"),
          apiRequest("/mis-solicitudes"),
          apiRequest("/all-sesions").catch(() => []),
        ]);
        if (activo) {
          setSolicitudesOrganizador(solOrg);
          setMisSolicitudes(solEstudiante);
          const creadasPorMi = Array.isArray(todasSesiones)
            ? todasSesiones.filter((s) => s.es_organizador || s.usuario_id === user.id)
            : [];
          setMisSesiones(creadasPorMi);
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
  }, [actualizacion, user.id]);

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
      setMensaje(res.mensaje || "Solicitud respondida correctamente.");
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

  // --- TAREA 7: Reconfirmar asistencia tras reprogramación ---
  async function reconfirmarAsistencia(sesionId) {
    setProcesando(`reconfirmar-${sesionId}`);
    setError("");
    setMensaje("");
    try {
      const res = await apiRequest(`/sesiones/${sesionId}/reconfirmar`, { method: "POST" });
      setMensaje(res.mensaje || "Has reconfirmado tu asistencia exitosamente.");
      setActualizacion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesando(null);
    }
  }

  // --- TAREA 7: Guardar reprogramación desde el organizador ---
  async function guardarReprogramacion(e) {
    e.preventDefault();
    if (!modalReprogramar) return;
    setGuardandoReprog(true);
    setError("");
    setMensaje("");
    try {
      const res = await apiRequest(`/sesiones/${modalReprogramar.id}/reprogramar`, {
        method: "POST",
        body: JSON.stringify({ fecha: reprogFecha, nueva_fecha: reprogFecha, motivo: reprogMotivo }),
      });
      setMensaje(res.mensaje || "Sesión reprogramada correctamente.");
      setModalReprogramar(null);
      setActualizacion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardandoReprog(false);
    }
  }

  // --- TAREA 9: Confirmar cancelación de sesión ---
  async function confirmarCancelacionSesion(e) {
    e.preventDefault();
    if (!modalCancelar) return;
    setCancelando(true);
    setError("");
    setMensaje("");
    try {
      const res = await apiRequest(`/sesiones/${modalCancelar.id}/cancelar`, {
        method: "POST",
        body: JSON.stringify({ motivo: motivoCancelacion }),
      });
      setMensaje(res.mensaje || "Sesión cancelada formalmente.");
      setModalCancelar(null);
      setActualizacion((v) => v + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setCancelando(false);
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
                <Link to="/sesions" className="btn btn-outline-primary btn-sm">
                  🔍 Explorar sesiones
                </Link>
                <Link to="/new-study" className="btn btn-primary btn-sm">
                  + Crear sesión
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* FEEDBACK VISUAL DE INTERFAZ: Mensajes de éxito y error */}
        {mensaje && (
          <Alert
            type="success"
            text={mensaje}
            onClose={() => setMensaje("")}
          />
        )}
        {error && (
          <Alert
            type="danger"
            text={error}
            onClose={() => setError("")}
          />
        )}

        {/* CLASE 20: PESTAÑAS DE NAVEGACIÓN REACTIVAS */}
        <div className="mb-3">
          <NavPills
            tabs={[
              {
                id: "solicitudes",
                label: "Mis solicitudes",
                icon: "📝",
                badge: misSolicitudes.length > 0 ? misSolicitudes.length : null,
                active: tabActiva === "solicitudes",
                to: "/dashboard?tab=solicitudes",
              },
              {
                id: "mis-sesiones",
                label: "Mis sesiones (Organizador)",
                icon: "👑",
                badge: pendientesOrganizador.length > 0 ? pendientesOrganizador.length : null,
                badgeVariant: "danger",
                active: tabActiva === "mis-sesiones",
                to: "/dashboard?tab=mis-sesiones",
              },
            ]}
          />
        </div>

        {/* INDICADOR DE CARGA */}
        {loading && <Loading mensaje="Cargando tu información académica..." />}

        {!loading && (
          <div>
            {/* ================================================================= */}
            {/* VISTA 1: MIS SOLICITUDES (Pestaña Estudiante - Clase 20)           */}
            {/* ================================================================= */}
            {tabActiva === "solicitudes" && (
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <h2 className="h5 fw-bold mb-0 text-dark">
                      Mis solicitudes de estudio
                    </h2>
                    <p className="text-muted small mb-0">
                      Consulta el estado de tus postulaciones, reconfirmaciones y posición en listas de espera.
                    </p>
                  </div>
                  <Link to="/sesions" className="btn btn-outline-primary btn-sm">
                    Buscar más sesiones
                  </Link>
                </div>
                <div className="card-body p-3 p-md-4">
                  {misSolicitudes.length === 0 ? (
                    <div className="text-center py-5 text-muted bg-light rounded-4">
                      <p className="fs-5 mb-2">Aún no has solicitado unirte a ninguna sesión.</p>
                      <p className="small mb-3">Busca materias de tu interés y postúlate en el catálogo.</p>
                      <Link to="/sesions" className="btn btn-primary px-4">
                        🔍 Explorar catálogo de sesiones
                      </Link>
                    </div>
                  ) : (
                    <div className="d-flex flex-column gap-3">
                      {misSolicitudes.map((sol) => (
                        <div
                          key={sol.sesion_id}
                          className="card border shadow-sm rounded-3 overflow-hidden"
                        >
                          <div className="card-body p-3 p-md-4">
                            <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                              <span className="badge bg-secondary text-wrap">
                                {sol.materia}
                              </span>
                              <div className="d-flex flex-wrap gap-2 ms-auto">
                                {sol.estado === "aceptada" && (
                                  <span className="badge bg-success text-white px-3 py-1 fs-6 d-inline-flex align-items-center gap-1 shadow-sm text-wrap">
                                    ✅ Confirmado
                                  </span>
                                )}
                                {sol.estado === "pendiente" && (
                                  <span className="badge bg-warning text-dark px-3 py-1 fs-6 d-inline-flex align-items-center gap-1 shadow-sm text-wrap">
                                    🕒 Pendiente de respuesta
                                  </span>
                                )}
                                {sol.estado === "en_espera" && (
                                  <span className="badge bg-info text-dark px-3 py-1 fs-6 d-inline-flex align-items-center gap-1 shadow-sm text-wrap">
                                    ⏳ En lista de espera (Lugar #{sol.posicion || 1})
                                  </span>
                                )}
                                {sol.estado === "pendiente_reconfirmacion" && (
                                  <span className="badge bg-warning text-dark px-3 py-1 fs-6 d-inline-flex align-items-center gap-1 shadow-sm text-wrap">
                                    ⚠️ Requiere reconfirmación
                                  </span>
                                )}
                                {sol.estado === "cancelada" && (
                                  <span className="badge bg-danger text-white px-3 py-1 fs-6 d-inline-flex align-items-center gap-1 shadow-sm text-wrap">
                                    🚫 Cancelada
                                  </span>
                                )}
                                {sol.estado === "rechazada" && (
                                  <span className="badge bg-danger text-white px-3 py-1 fs-6 d-inline-flex align-items-center gap-1 shadow-sm text-wrap">
                                    ❌ Rechazada
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Título de la sesión */}
                            <h3 className="h5 fw-bold mb-2 text-dark text-break">
                              {sol.sesion_nombre}
                            </h3>

                            {/* Datos de la sesión */}
                            <div className="bg-light rounded-3 p-3 mb-3 border border-light-subtle">
                              <div className="row g-2 small">
                                <div className="col-12 col-md-7">
                                  <span className="text-secondary d-block fw-semibold">👤 Organizador:</span>
                                  <span className="fw-bold text-dark text-break">{sol.organizador_nombre}</span>
                                  <span className="text-muted d-block text-break">{sol.organizador_email}</span>
                                </div>
                                <div className="col-12 col-md-5">
                                  <span className="text-secondary d-block fw-semibold">📅 Fecha de la sesión:</span>
                                  <span className="fw-bold text-dark">
                                    {formatearFecha(sol.fecha_sesion)}
                                  </span>
                                  <span className="text-muted d-block mt-1">
                                    Modalidad: <strong className="text-capitalize">{sol.modalidad || "presencial"}</strong>
                                  </span>
                                </div>
                              </div>
                            </div>

                            {/* TAREA 7: Alerta interactiva si requiere reconfirmación tras reprogramación */}
                            {sol.estado === "pendiente_reconfirmacion" && (
                              <div className="alert alert-warning py-3 px-3 small my-2 border-warning rounded-3 shadow-sm">
                                <div className="d-flex align-items-center gap-2 mb-1">
                                  <span className="fs-5">⚠️</span>
                                  <strong className="fs-6">Sesión reprogramada: Requiere reconfirmación</strong>
                                </div>
                                <p className="mb-2 text-dark">
                                  {sol.motivo_reprogramacion
                                    ? `Motivo informado por el organizador: "${sol.motivo_reprogramacion}"`
                                    : "El organizador ha actualizado la fecha de esta sesión de estudio."}
                                  <span className="d-block text-muted small mt-1">
                                    Conservas temporalmente tu plaza. Confirma que puedes asistir en la nueva fecha para asegurar tu cupo.
                                  </span>
                                </p>
                                <div className="d-flex gap-2 flex-wrap pt-1">
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-success px-3 py-2 fw-semibold shadow-sm"
                                    disabled={procesando === `reconfirmar-${sol.sesion_id}`}
                                    onClick={() => reconfirmarAsistencia(sol.sesion_id)}
                                  >
                                    {procesando === `reconfirmar-${sol.sesion_id}`
                                      ? "Confirmando..."
                                      : "✅ Aceptar nueva fecha"}
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger px-3 py-2"
                                    disabled={procesando === `salir-${sol.sesion_id}`}
                                    onClick={() => salirDeSesion(sol.sesion_id)}
                                  >
                                    🚪 Retirarme
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* TAREA 9: Explicación visible para el participante si la sesión fue cancelada */}
                            {(sol.estado === "cancelada" || sol.sesion_cancelada) && (
                              <div className="alert alert-danger py-2 px-3 small my-2 border-danger rounded-3">
                                <strong>🚫 Sesión cancelada por el organizador:</strong>
                                <div className="mt-1">
                                  {sol.motivo_cancelacion ? `Motivo: "${sol.motivo_cancelacion}"` : "La sesión fue suspendida definitivamente."}
                                </div>
                                <span className="text-secondary small fst-italic">Tu postulación quedó sin efecto y no admite nuevas solicitudes.</span>
                              </div>
                            )}

                            {/* TAREA 8: Consulta de asistencia y justificación para el estudiante */}
                            {sol.estado === "aceptada" && (
                              <div className="mt-2 mb-2 p-2 bg-light rounded border">
                                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                  <span className="small fw-semibold text-dark">
                                    Resultado de asistencia:
                                  </span>
                                  <InsigniaAsistencia
                                    asistencia={sol.asistencia}
                                    estadoJustificacion={sol.estado_justificacion}
                                    motivoJustificacion={sol.motivo_respuesta_justificacion}
                                    justificacion={sol.justificacion}
                                    onAbrirJustificar={() =>
                                      setModalJustificar({
                                        id: sol.sesion_id,
                                        nombre: sol.sesion_nombre,
                                      })
                                    }
                                  />
                                </div>
                              </div>
                            )}

                            {/* Acciones de la solicitud */}
                            <div className="pt-2 border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
                              <Link
                                to={`/sesions?nombre=${encodeURIComponent(sol.sesion_nombre)}`}
                                className="btn btn-outline-primary btn-sm px-3"
                                title="Ver los detalles de esta sesión en el catálogo"
                              >
                                🔍 Ver sesión
                              </Link>

                              {["aceptada", "en_espera", "pendiente", "pendiente_reconfirmacion"].includes(sol.estado) && (
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm px-3"
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
            {/* VISTA 2: MIS SESIONES (Pestaña Organizador - Tareas 6, 7, 8, 9)   */}
            {/* ================================================================= */}
            {tabActiva === "mis-sesiones" && (
              <div className="card border-0 shadow-sm">
                <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center flex-wrap gap-2">
                  <div>
                    <h2 className="h5 fw-bold mb-0 text-dark">
                      👑 Mis sesiones (Organizador)
                    </h2>
                    <p className="text-muted small mb-0">
                      Gestiona las sesiones que creaste, administra solicitudes de tus compañeros y la lista de espera.
                    </p>
                  </div>
                  <Link to="/new-study" className="btn btn-primary btn-sm px-3">
                    + Crear nueva sesión
                  </Link>
                </div>
                <div className="card-body p-3 p-md-4">
                  {/* GRID DE RECUADROS DE SESIONES CREADAS (SOLICITUD EXPLÍCITA DEL USUARIO CON CAPTURA) */}
                  {misSesiones.length === 0 ? (
                    <div className="text-center py-5 text-muted bg-light rounded-4">
                      <p className="fs-5 mb-2">Aún no has creado ninguna sesión de estudio.</p>
                      <p className="small mb-3">Publica un taller o grupo de repaso para convocar a tus compañeros.</p>
                      <Link to="/new-study" className="btn btn-primary px-4">
                        + Crear sesión de estudio
                      </Link>
                    </div>
                  ) : (
                    <div>
                      <div className="d-flex justify-content-between align-items-center mb-3">
                        <h3 className="h6 fw-bold text-dark mb-0">
                          Tus sesiones publicadas ({misSesiones.length})
                        </h3>
                        <span className="small text-muted">
                          Control total de solicitudes, reprogramación, cancelación y asistencia
                        </span>
                      </div>

                      {/* Recuadros / Tarjetas idénticas a la captura de pantalla del usuario */}
                      <div className="row g-3 row-cols-1 row-cols-md-2">
                        {misSesiones.map((sesion) => {
                          const solicitudesEstaSesion = solicitudesOrganizador.filter(
                            (s) => s.sesion_id === sesion.id
                          );
                          const pendientesEsta = solicitudesEstaSesion.filter(
                            (s) => s.estado === "pendiente"
                          );
                          const tieneReconf = (sesion.reconfirmaciones_pendientes_count || 0) > 0;
                          const estaAbierto = panelAbierto === sesion.id;

                          return (
                            <div key={sesion.id} className="col">
                              <div className="card h-100 shadow-sm border rounded-3 p-3 p-md-4 d-flex flex-column bg-white">
                                {/* Encabezado con etiquetas: Materia + 👑 Organizador */}
                                <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                                  <span className="badge bg-secondary text-wrap">
                                    {sesion.materia}
                                  </span>
                                  <span className="badge bg-primary">
                                    👑 Organizador
                                  </span>
                                </div>

                                {/* Título de la sesión */}
                                <h3 className="h5 fw-bold text-dark mb-3 text-break">
                                  {sesion.nombre}
                                </h3>

                                {/* Datos estructurados de la sesión */}
                                <ul className="list-unstyled text-muted small mb-3">
                                  <li className="mb-1">
                                    <strong>Modalidad:</strong> {sesion.modalidad}
                                  </li>
                                  <li className="mb-1">
                                    <strong>Fecha:</strong> {formatearFecha(sesion.fecha)}
                                  </li>
                                  <li className="mb-1 d-flex align-items-center flex-wrap gap-2">
                                    <span>
                                      <strong>Cupos disponibles:</strong>{" "}
                                      <span className={sesion.cupos_disponibles === 0 ? "text-danger fw-bold" : "text-success fw-bold"}>
                                        {sesion.cupos_disponibles}
                                      </span> de {sesion.cupo}
                                    </span>
                                    {sesion.cupos_disponibles > 0 ? (
                                      <span className="badge bg-success-subtle text-success border border-success-subtle">
                                        ✓ {sesion.cupos_libres} cupo{sesion.cupos_libres !== 1 ? "s" : ""} libre{sesion.cupos_libres !== 1 ? "s" : ""}
                                      </span>
                                    ) : (
                                      <span className="badge bg-danger-subtle text-danger border border-danger-subtle">
                                        0 cupos libres (Sesión llena)
                                      </span>
                                    )}
                                  </li>
                                  <li className="mb-1">
                                    <strong>Estado:</strong>{" "}
                                    <span className={sesion.cancelada ? "text-danger fw-semibold" : sesion.es_pasada ? "text-secondary" : "text-success fw-semibold"}>
                                      {sesion.cancelada ? "Sesión cancelada" : sesion.es_pasada ? "Finalizada" : sesion.inscripciones_abiertas ? "Inscripciones abiertas" : "Inscripciones cerradas"}
                                    </span>
                                  </li>
                                  {sesion.motivo_reprogramacion && (
                                    <li className="mt-2 p-2 bg-light rounded text-info small border border-info-subtle">
                                      📅 <strong>Reprogramada:</strong> "{sesion.motivo_reprogramacion}"
                                    </li>
                                  )}
                                  {sesion.cancelada && (
                                    <li className="mt-2 p-2 bg-danger-subtle text-danger rounded small border border-danger-subtle">
                                      🚫 <strong>Sesión cancelada:</strong> "{sesion.motivo_cancelacion || 'Por disposición del organizador'}"
                                    </li>
                                  )}
                                  {tieneReconf && (
                                    <li className="mt-2 p-2 bg-warning-subtle text-warning-emphasis rounded small border border-warning-subtle">
                                      ⚠️ {sesion.reconfirmaciones_pendientes_count} en espera de reconfirmar
                                    </li>
                                  )}
                                </ul>

                                {/* Separador idéntico a la captura de pantalla */}
                                <hr className="my-2" />

                                {/* Gestión de tu sesión y botones de acción */}
                                <div className="mt-auto pt-2">
                                  <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="small text-muted">Gestión de tu sesión:</span>
                                    {pendientesEsta.length > 0 ? (
                                      <span className="badge bg-danger">
                                        {pendientesEsta.length} pendiente{pendientesEsta.length > 1 ? "s" : ""}
                                      </span>
                                    ) : (
                                      <span className="badge bg-light text-muted border">0 pendientes</span>
                                    )}
                                  </div>

                                  {/* Botones de acción verticales idénticos a la captura */}
                                  <div className="d-flex flex-column gap-2">
                                    {/* 1. Gestionar solicitudes */}
                                    <button
                                      type="button"
                                      className={`btn btn-sm w-100 ${estaAbierto ? "btn-outline-secondary" : pendientesEsta.length > 0 ? "btn-warning text-dark fw-bold" : "btn-outline-primary"}`}
                                      onClick={() => setPanelAbierto(estaAbierto ? null : sesion.id)}
                                    >
                                      {estaAbierto
                                        ? "▲ Cerrar solicitudes"
                                        : `▼ Gestionar solicitudes (${pendientesEsta.length})`}
                                    </button>

                                    {/* 2. Reprogramar sesión */}
                                    {!sesion.es_pasada && !sesion.cancelada && (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-info w-100 fw-semibold"
                                        disabled={tieneReconf}
                                        title={tieneReconf ? "Bloqueado: hay participantes reconfirmando." : "Reprogramar fecha y motivo"}
                                        onClick={() => {
                                          setModalReprogramar(sesion);
                                          setReprogFecha("");
                                          setReprogMotivo("");
                                        }}
                                      >
                                        📅 Reprogramar sesión {tieneReconf ? "(Bloqueado)" : ""}
                                      </button>
                                    )}

                                    {/* 3. Cancelar sesión */}
                                    {sesion.puede_cancelar && (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-danger w-100 fw-semibold"
                                        onClick={() => {
                                          setModalCancelar(sesion);
                                          setMotivoCancelacion("");
                                        }}
                                        title="Cancelar definitivamente esta sesión de estudio con motivo obligatorio"
                                      >
                                        🚫 Cancelar sesión
                                      </button>
                                    )}

                                    {/* 4. Control de asistencia y justificaciones */}
                                    {!sesion.cancelada && (
                                      <button
                                        type="button"
                                        className="btn btn-sm btn-outline-success w-100 fw-semibold"
                                        onClick={() => setModalAsistencia({ id: sesion.id, nombre: sesion.nombre })}
                                        title="Gestionar lista de presentes/ausentes y evaluar justificaciones"
                                      >
                                        📋 Control de asistencia y justificaciones
                                      </button>
                                    )}
                                  </div>

                                  {/* Acordeón desplegable de solicitudes para esta sesión */}
                                  {estaAbierto && (
                                    <div className="mt-3 p-3 bg-light border rounded-3">
                                      <h4 className="h6 fw-bold mb-2">Solicitudes y lista de espera</h4>
                                      {solicitudesEstaSesion.length === 0 ? (
                                        <p className="small text-muted mb-0">No hay solicitudes registradas aún en esta sesión.</p>
                                      ) : (
                                        <div className="d-flex flex-column gap-2">
                                          {solicitudesEstaSesion.map((sol) => (
                                            <div key={sol.solicitante_id} className="card card-body p-2 border-0 shadow-sm bg-white">
                                              <div className="d-flex justify-content-between align-items-center mb-1 flex-wrap gap-1">
                                                <span className="fw-semibold small text-break">{sol.solicitante_nombre}</span>
                                                {sol.estado === "pendiente" && <span className="badge bg-warning text-dark">Pendiente</span>}
                                                {sol.estado === "en_espera" && <span className="badge bg-info text-dark">En espera (#{sol.posicion || 1})</span>}
                                                {sol.estado === "pendiente_reconfirmacion" && <span className="badge bg-warning text-dark">Reconfirmación</span>}
                                                {sol.estado === "aceptada" && <span className="badge bg-success">Aceptada</span>}
                                                {sol.estado === "rechazada" && <span className="badge bg-danger">Rechazada</span>}
                                              </div>
                                              <span className="text-muted small mb-2 text-break">{sol.solicitante_email}</span>

                                              {sol.estado === "pendiente" ? (
                                                <div className="d-flex gap-2 mt-1">
                                                  <button
                                                    type="button"
                                                    className="btn btn-sm btn-success flex-fill py-1 fw-semibold"
                                                    disabled={procesando === `${sesion.id}-${sol.solicitante_id}`}
                                                    onClick={() => responder(sesion.id, sol.solicitante_id, "aceptar")}
                                                  >
                                                    ✓ Aceptar
                                                  </button>
                                                  <button
                                                    type="button"
                                                    className="btn btn-sm btn-outline-danger flex-fill py-1"
                                                    disabled={procesando === `${sesion.id}-${sol.solicitante_id}`}
                                                    onClick={() => responder(sesion.id, sol.solicitante_id, "rechazar")}
                                                  >
                                                    ✕ Rechazar
                                                  </button>
                                                </div>
                                              ) : sol.estado === "en_espera" ? (
                                                <div className="small text-muted fst-italic">
                                                  ⏳ En lista de espera (ascenderá automáticamente si alguien sale)
                                                </div>
                                              ) : sol.estado === "pendiente_reconfirmacion" ? (
                                                <div className="small text-warning fst-italic">
                                                  ⚠️ Esperando que el alumno acepte la nueva fecha o se retire
                                                </div>
                                              ) : (
                                                <div className="small text-muted fst-italic">
                                                  Estado: {sol.estado === "aceptada" ? "Inscrito confirmado" : "Rechazado"}
                                                </div>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* SECCIÓN ORIGINAL (FIGMA / DOCS / REPORTE) SOLICITADA POR EL USUARIO DEBAJO DE LAS TARJETAS */}
                  <div className="mt-4 pt-3 border-top d-flex flex-column gap-3">
                    {/* TAREA 8: Acceso rápido al Control de Asistencia para el Organizador */}
                    {(solicitudesOrganizador.length > 0 || misSesiones.length > 0) && (
                      <div className="card bg-primary-subtle border-0 rounded-3 p-3 mb-2">
                        <div className="mb-2">
                          <h3 className="h6 fw-bold mb-1 text-dark d-flex align-items-center gap-2">
                            <span>📋</span>
                            <span>Control de Asistencia y Justificaciones</span>
                          </h3>
                          <p className="text-secondary small mb-0">
                            Gestiona el registro de presentes o ausentes y resuelve las justificaciones de tus sesiones activas.
                          </p>
                        </div>
                        {/* Botones de asistencia responsivos con wrap y soporte para nombres largos */}
                        <div className="d-flex flex-column flex-sm-row flex-wrap gap-2 mt-2">
                          {Array.from(
                            new Map(
                              [
                                ...solicitudesOrganizador.map((s) => [s.sesion_id, { id: s.sesion_id, nombre: s.sesion_nombre }]),
                                ...misSesiones.map((s) => [s.id, { id: s.id, nombre: s.nombre }]),
                              ]
                            ).values()
                          ).map((ses) => (
                            <button
                              key={ses.id}
                              type="button"
                              className="btn btn-primary btn-sm btn-wrap fw-semibold shadow-sm text-start py-2 px-3 w-100 w-sm-auto"
                              style={{ maxWidth: "100%" }}
                              onClick={() =>
                                setModalAsistencia({ id: ses.id, nombre: ses.nombre })
                              }
                            >
                              <span className="d-inline-flex align-items-center gap-2">
                                <span>📋</span>
                                <span className="text-break">
                                  Tomar asistencia: <strong>{ses.nombre}</strong>
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Subsección: Solicitudes pendientes de responder */}
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
                              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                                <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                                  <h4 className="h6 fw-bold mb-0 text-dark text-break">
                                    {sol.solicitante_nombre}
                                  </h4>
                                  <span className="text-muted small text-break d-block">
                                    {sol.solicitante_email}
                                  </span>
                                </div>
                                <span className="badge bg-warning text-dark flex-shrink-0 px-2 py-1">
                                  ⏳ Pendiente
                                </span>
                              </div>
                              <div className="small text-secondary mb-3 text-break">
                                <strong>Sesión:</strong> {sol.sesion_nombre}{" "}
                                <span className="badge bg-secondary-subtle text-secondary small ms-1">
                                  {sol.materia}
                                </span>
                              </div>
                              <div className="d-flex gap-2 flex-wrap">
                                <button
                                  type="button"
                                  className="btn btn-success btn-sm px-3 fw-semibold shadow-sm"
                                  disabled={procesando === `${sol.sesion_id}-${sol.solicitante_id}`}
                                  onClick={() => responder(sol.sesion_id, sol.solicitante_id, "aceptar")}
                                >
                                  ✓ Aceptar
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-outline-danger btn-sm px-3"
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
                              <div className="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-2">
                                <div style={{ minWidth: 0, flex: "1 1 200px" }}>
                                  <h4 className="h6 fw-bold mb-0 text-dark text-break">
                                    {sol.solicitante_nombre}
                                  </h4>
                                  <span className="text-muted small text-break d-block">
                                    {sol.solicitante_email}
                                  </span>
                                </div>
                                <span className="badge bg-info text-dark flex-shrink-0 px-2 py-1">
                                  Lugar #{sol.posicion || 1}
                                </span>
                              </div>
                              <div className="small text-secondary mb-1 text-break">
                                <strong>Sesión:</strong> {sol.sesion_nombre}{" "}
                                <span className="badge bg-secondary-subtle text-secondary small ms-1">
                                  {sol.materia}
                                </span>
                              </div>
                              <div className="small text-muted fst-italic">
                                ℹ️ Ingresará automáticamente a confirmado si un participante sale.
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Subsección: Historial de solicitudes respondidas */}
                    {respondidasOrganizador.length > 0 && (
                      <div className="mt-2">
                        <h3 className="h6 text-muted fw-bold mb-2">
                          Historial de solicitudes respondidas
                        </h3>
                        <div className="d-flex flex-column gap-2">
                          {respondidasOrganizador.slice(0, 10).map((sol) => (
                            <div
                              key={`${sol.sesion_id}-${sol.solicitante_id}`}
                              className="border rounded p-2 bg-white small d-flex justify-content-between align-items-center flex-wrap gap-2"
                            >
                              <div className="text-break" style={{ minWidth: 0, flex: "1 1 180px" }}>
                                <strong>{sol.solicitante_nombre}</strong> en <em>{sol.sesion_nombre}</em>
                              </div>
                              <div className="flex-shrink-0">
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
                </div>
              </div>
            )}
          </div>
        )}

        {/* --- TAREA 7: MODAL DE REPROGRAMACIÓN DE SESIÓN --- */}
        {modalReprogramar && (
          <div className="modal show d-block" style={{ backgroundColor: "var(--color-fondo-modal)", zIndex: 1060 }} role="dialog">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow border-0" style={{ borderRadius: "14px" }}>
                <form onSubmit={guardarReprogramacion}>
                  <div className="modal-header bg-primary text-white">
                    <h5 className="modal-title fw-bold">📅 Reprogramar sesión</h5>
                    <button
                      type="button"
                      className="btn-close btn-close-white"
                      onClick={() => setModalReprogramar(null)}
                      aria-label="Cerrar"
                    />
                  </div>
                  <div className="modal-body p-4">
                    <p className="mb-2">
                      Sesión: <strong>{modalReprogramar.nombre}</strong> ({modalReprogramar.materia})
                    </p>
                    <p className="text-muted small mb-3">
                      Fecha actual: <strong>{formatearFecha(modalReprogramar.fecha)}</strong>
                    </p>

                    <div className="alert alert-warning small mb-3">
                      ℹ️ <strong>Reglas de Reprogramación (Tarea 7):</strong>
                      <ul className="mb-0 mt-1 ps-3">
                        <li>Los participantes confirmados pasarán a <em>pendientes de reconfirmación</em> y conservarán temporalmente su cupo.</li>
                        <li>Cada uno podrá aceptar la nueva fecha o retirarse.</li>
                        <li>Mientras haya reconfirmaciones pendientes, <strong>no se admitirá otra reprogramación</strong>.</li>
                      </ul>
                    </div>

                    <div className="mb-3">
                      <label htmlFor="reprog-fecha-dash" className="form-label fw-semibold">Nueva fecha</label>
                      <input
                        id="reprog-fecha-dash"
                        type="date"
                        className="form-control"
                        min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                        value={reprogFecha}
                        onChange={(e) => setReprogFecha(e.target.value)}
                        required
                      />
                    </div>

                    <div className="mb-3">
                      <label htmlFor="reprog-motivo-dash" className="form-label fw-semibold">Motivo de la reprogramación</label>
                      <textarea
                        id="reprog-motivo-dash"
                        className="form-control"
                        rows="3"
                        placeholder="Indica el motivo (ej. Cruce de horarios con examen de Cálculo)"
                        value={reprogMotivo}
                        onChange={(e) => setReprogMotivo(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="modal-footer bg-light">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => setModalReprogramar(null)}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary fw-semibold"
                      disabled={guardandoReprog}
                    >
                      {guardandoReprog ? "Guardando..." : "Confirmar reprogramación"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* --- TAREA 9: MODAL DE CANCELACIÓN DE SESIÓN --- */}
        {modalCancelar && (
          <div
            className="modal show d-block"
            style={{ backgroundColor: "var(--color-fondo-modal)", zIndex: 1060 }}
            tabIndex="-1"
            role="dialog"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content shadow border-0" style={{ borderRadius: "14px" }}>
                <div className="modal-header bg-danger text-white">
                  <h5 className="modal-title fw-bold">🚫 Cancelar sesión de estudio</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    aria-label="Cerrar"
                    onClick={() => {
                      setModalCancelar(null);
                      setMotivoCancelacion("");
                    }}
                  />
                </div>
                <form onSubmit={confirmarCancelacionSesion}>
                  <div className="modal-body p-4">
                    <p className="mb-2">
                      ¿Estás seguro de que deseas cancelar la sesión <strong>{modalCancelar.nombre}</strong>?
                    </p>
                    <div className="alert alert-warning py-2 small mb-3">
                      ⚠️ <strong>Consecuencias éticas:</strong>
                      <ul className="mb-0 ps-3 mt-1">
                        <li>Los participantes aceptados, pendientes y en espera pasarán a <strong>cancelada</strong>.</li>
                        <li>Todos ellos verán el motivo que ingreses a continuación.</li>
                        <li>No se admitirán nuevas solicitudes ni registro de asistencia.</li>
                        <li>Esta acción es definitiva.</li>
                      </ul>
                    </div>

                    <div className="mb-3">
                      <label htmlFor="motivo-cancelacion-dash" className="form-label fw-semibold">
                        Motivo obligatorio de cancelación:
                      </label>
                      <textarea
                        id="motivo-cancelacion-dash"
                        className="form-control"
                        rows="3"
                        placeholder="Explica el motivo (ej. Problemas de fuerza mayor, enfermedad, etc.)"
                        value={motivoCancelacion}
                        onChange={(e) => setMotivoCancelacion(e.target.value)}
                        required
                        minLength={5}
                      />
                      <div className="form-text small">Mínimo 5 caracteres explicativos.</div>
                    </div>
                  </div>
                  <div className="modal-footer bg-light">
                    <button
                      type="button"
                      className="btn btn-outline-secondary"
                      onClick={() => {
                        setModalCancelar(null);
                        setMotivoCancelacion("");
                      }}
                    >
                      Volver sin cancelar
                    </button>
                    <button
                      type="submit"
                      className="btn btn-danger fw-semibold"
                      disabled={cancelando || motivoCancelacion.trim().length < 5}
                    >
                      {cancelando ? "Cancelando sesión..." : "Confirmar cancelación"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* --- TAREA 8: Modal de Control de Asistencia y Justificaciones para Organizador --- */}
        {modalAsistencia && (
          <ModalControlAsistencia
            sesionId={modalAsistencia.id}
            sesionNombre={modalAsistencia.nombre}
            onClose={() => setModalAsistencia(null)}
            onUpdated={() => setActualizacion((v) => v + 1)}
          />
        )}

        {/* --- TAREA 8: Modal de Justificación de Inasistencia para Estudiante Ausente --- */}
        {modalJustificar && (
          <ModalJustificarAusencia
            sesionId={modalJustificar.id}
            sesionNombre={modalJustificar.nombre}
            onClose={() => setModalJustificar(null)}
            onSuccess={(msg) => {
              setMensaje(msg);
              setActualizacion((v) => v + 1);
            }}
          />
        )}
      </div>
    </div>
  );
}
