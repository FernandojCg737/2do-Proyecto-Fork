import { useEffect, useState } from "react";
import { Alert, Loading } from "./Components";
import { apiRequest } from "./api";
import { track } from "./analitica";

// =============================================================================
// --- TAREA 8: COMPONENTES DE ASISTENCIA, JUSTIFICACIONES Y AUDITORÍA ---
// Diseñados bajo principios de Interacción Humano-Computador (IHC):
// - Feedback inmediato al usuario ante cada cambio de estado
// - Visibilidad del estado del sistema (Nielsen Heuristic #1)
// - Prevención de errores con validaciones en cliente y servidor
// =============================================================================

/**
 * Formatea marcas de tiempo ISO a formato legible boliviano (DD/MM/YYYY, hh:mm a. m./p. m.)
 * Garantizando la conversión a la zona horaria oficial de Bolivia (America/La_Paz, UTC-4).
 */
function formatearFechaHora(fechaIso) {
  if (!fechaIso) return "Fecha no registrada";
  try {
    let str = String(fechaIso).trim();
    // Si la cadena ISO no tiene indicador explícito de zona horaria (Z o offset +/-),
    // se le agrega 'Z' para asegurar que JavaScript interprete la marca como UTC
    // y toLocaleString realice la resta correspondiente a la zona horaria de Bolivia (UTC-4).
    if (!str.endsWith("Z") && !str.includes("+") && !str.slice(10).includes("-")) {
      str = str + "Z";
    }
    const fecha = new Date(str);
    return fecha.toLocaleString("es-BO", {
      timeZone: "America/La_Paz",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return String(fechaIso);
  }
}

/**
 * Componente InsigniaAsistencia:
 * Muestra el estado de asistencia y justificación del estudiante de forma clara e interactiva.
 */
export function InsigniaAsistencia({
  asistencia,
  estadoJustificacion,
  motivoJustificacion,
  justificacion,
  onAbrirJustificar,
}) {
  // Caso 1: Estudiante marcado como PRESENTE
  if (asistencia === "presente") {
    return (
      <div className="d-inline-flex align-items-center gap-1">
        <span className="badge bg-success px-2 py-1 fs-7 rounded-pill">
          ✅ Presente en la sesión
        </span>
      </div>
    );
  }

  // Caso 2: Estudiante marcado como AUSENTE
  if (asistencia === "ausente") {
    return (
      <div className="d-flex flex-column gap-1 align-items-start">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {estadoJustificacion === "aceptada" ? (
            <span className="badge bg-success px-2 py-1 fs-7 rounded-pill">
              ✅ Ausencia justificada
            </span>
          ) : estadoJustificacion === "rechazada" ? (
            <span className="badge bg-danger px-2 py-1 fs-7 rounded-pill">
              ❌ Justificación rechazada
            </span>
          ) : estadoJustificacion === "pendiente" ? (
            <span className="badge bg-warning text-dark px-2 py-1 fs-7 rounded-pill">
              ⏳ Justificación en revisión
            </span>
          ) : (
            <span className="badge bg-danger px-2 py-1 fs-7 rounded-pill">
              ❌ Registrado como ausente
            </span>
          )}

          {/* Botón para presentar justificación si no la ha enviado aún o si fue rechazada */}
          {(!estadoJustificacion || estadoJustificacion === "rechazada") && onAbrirJustificar && (
            <button
              type="button"
              className="btn btn-outline-warning btn-sm py-0 px-2 rounded-pill fw-semibold"
              onClick={onAbrirJustificar}
              title="Presentar justificativo formal al organizador"
            >
              📝 Justificar inasistencia
            </button>
          )}
        </div>

        {/* Motivo o detalle de la justificación */}
        {justificacion && (
          <small className="text-muted fst-italic">
            Tu justificación: "{justificacion}"
          </small>
        )}
        {motivoJustificacion && (
          <small className={estadoJustificacion === "aceptada" ? "text-success fw-semibold" : "text-danger fw-semibold"}>
            Respuesta organizador: "{motivoJustificacion}"
          </small>
        )}
      </div>
    );
  }

  // Caso 3: Asistencia no registrada todavía
  return (
    <span className="badge bg-secondary-subtle text-secondary px-2 py-1 fs-7 rounded-pill">
      ⏳ Asistencia no registrada
    </span>
  );
}

/**
 * ModalControlAsistencia:
 * Panel exclusivo para el organizador de la sesión.
 * Permite:
 * 1. Marcar presentes y ausentes entre participantes confirmados.
 * 2. Bloquear la toma repetida accidental y ofrecer un botón explícito de "Editar asistencia".
 * 3. Finalizar la sesión si es futura para habilitar la toma al terminar.
 * 4. Visualizar y evaluar justificaciones recibidas con motivo obligatorio.
 * 5. Consultar la bitácora de auditoría / historial de cambios.
 */
export function ModalControlAsistencia({ sesionId, sesionNombre, onClose, onUpdated }) {
  // Estado general de los datos de la sesión traídos desde la API
  const [datos, setDatos] = useState(null);
  // Indicador de carga inicial
  const [cargando, setCargando] = useState(true);
  // Indicador de guardado en proceso
  const [guardando, setGuardando] = useState(false);
  // Indicador de finalización anticipada de sesión
  const [finalizando, setFinalizando] = useState(false);
  // Mensajes de error y éxito para feedback de usuario (IHC Heurística #1)
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Estado local para los toggles de asistencia: { [usuario_id]: 'presente' | 'ausente' }
  const [asistencias, setAsistencias] = useState({});

  // Control de modo: 'lectura' (bloqueado) o 'edicion' (activo)
  // REGLA: Si la asistencia ya fue tomada por primera vez, se bloquea por defecto (false)
  // y solo se desbloquea al pulsar el botón "Editar asistencia".
  // Si ningún alumno tiene asistencia registrada, arranca en modo captura (true).
  const [modoEdicion, setModoEdicion] = useState(false);

  // Estado local para los motivos de respuesta a justificaciones: { [usuario_id]: string }
  const [motivosResolucion, setMotivosResolucion] = useState({});
  const [procesandoJustificacion, setProcesandoJustificacion] = useState(null);

  // Carga los datos de asistencia e historial desde la API
  async function cargarDatos() {
    setCargando(true);
    setError("");
    try {
      const resp = await apiRequest(`/sesiones/${sesionId}/asistencia`);
      setDatos(resp);

      // Inicializar el estado de asistencia con los datos guardados en la BD
      const inicial = {};
      let tieneRegistrosPrevios = false;
      resp.participantes.forEach((p) => {
        if (p.asistencia) {
          inicial[p.usuario_id] = p.asistencia;
          tieneRegistrosPrevios = true;
        }
      });
      setAsistencias(inicial);

      // Si ningún participante tiene asistencia, arrancamos en modo captura inicial (true).
      // Si al menos uno ya tiene asistencia, arrancamos bloqueados en modo lectura (false).
      setModoEdicion(!tieneRegistrosPrevios);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarDatos();
  }, [sesionId]);

  // Permite al organizador dar la sesión por concluida para habilitar la toma de asistencia
  async function finalizarSesionAhora() {
    setFinalizando(true);
    setError("");
    try {
      const res = await apiRequest(`/sesiones/${sesionId}/finalizar`, {
        method: "POST",
      });
      setMensaje(res.mensaje || "Sesión concluida. Ya puedes tomar o editar la asistencia.");
      await cargarDatos();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setFinalizando(false);
    }
  }

  // Maneja el toggle entre Presente y Ausente para un estudiante
  function seleccionarAsistencia(usuarioId, estado) {
    setAsistencias((prev) => ({
      ...prev,
      [usuarioId]: estado,
    }));
  }

  // Guarda en bloque el registro o modificación de asistencia
  async function guardarAsistencias(e) {
    e.preventDefault();
    setError("");
    setMensaje("");

    if (!datos || datos.participantes.length === 0) {
      setError("No hay participantes confirmados para registrar asistencia.");
      return;
    }

    // Convertir el estado a la lista de items requerida por el backend
    const payload = datos.participantes.map((p) => ({
      usuario_id: p.usuario_id,
      asistencia: asistencias[p.usuario_id] || "ausente", // Por defecto ausente si no se marcó
    }));

    setGuardando(true);
    try {
      const res = await apiRequest(`/sesiones/${sesionId}/asistencia`, {
        method: "POST",
        body: JSON.stringify({ asistencias: payload }),
      });
      setMensaje(res.mensaje || "Asistencia registrada correctamente.");
      await cargarDatos();
      // Tras guardar exitosamente, bloqueamos los controles y activamos el botón de editar
      setModoEdicion(false);
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  // Evalúa y responde una justificación con motivo obligatorio
  async function responderJustificacion(estudianteId, decision) {
    const motivo = (motivosResolucion[estudianteId] || "").trim();
    if (!motivo || motivo.length < 3) {
      setError("Debes indicar un motivo explicativo de al menos 3 caracteres.");
      return;
    }

    setProcesandoJustificacion(`${estudianteId}-${decision}`);
    setError("");
    setMensaje("");
    try {
      const res = await apiRequest(
        `/sesiones/${sesionId}/usuarios/${estudianteId}/responder-justificacion`,
        {
          method: "POST",
          body: JSON.stringify({ decision, motivo }),
        }
      );
      setMensaje(res.mensaje || `Justificación ${decision === "aceptar" ? "aceptada" : "rechazada"}.`);
      setMotivosResolucion((prev) => ({ ...prev, [estudianteId]: "" }));
      await cargarDatos();
      if (onUpdated) onUpdated();
    } catch (err) {
      setError(err.message);
    } finally {
      setProcesandoJustificacion(null);
    }
  }

  // Comprueba si ya existe al menos un alumno con asistencia registrada previamente
  const tieneAsistenciaRegistrada = Boolean(
    datos && datos.participantes.some((p) => p.asistencia !== null && p.asistencia !== undefined)
  );

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1055 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-asistencia-titulo"
    >
      <div className="modal-dialog modal-lg modal-dialog-scrollable">
        <div className="modal-content shadow border-0">
          {/* Encabezado del modal */}
          <div className="modal-header bg-primary text-white">
            <h2 className="modal-title h5 fw-bold mb-0" id="modal-asistencia-titulo">
              📋 Control de Asistencia y Justificaciones
            </h2>
            <button
              type="button"
              className="btn-close btn-close-white"
              aria-label="Cerrar modal"
              onClick={onClose}
            />
          </div>

          <div className="modal-body p-3 p-md-4">
            <div className="mb-3">
              <span className="badge bg-secondary-subtle text-secondary mb-1">Sesión</span>
              <h3 className="h6 fw-bold mb-1 text-dark">{sesionNombre}</h3>
              <p className="text-muted small mb-0">
                Registra la presencia o inasistencia de cada estudiante confirmado y evalúa las justificaciones presentadas.
              </p>
            </div>

            {error && <Alert type="danger" text={error} />}
            {mensaje && <Alert type="success" text={mensaje} />}

            {cargando ? (
              <Loading />
            ) : !datos ? (
              <p className="text-muted text-center py-3">No se pudieron cargar los datos de la sesión.</p>
            ) : (
              <div>
                {/* AVISO: Al terminar una sesión (el mismo día o al concluirla) */}
                {!datos.esta_concluida && (
                  <div className="alert alert-warning border d-flex flex-column gap-2 p-3 mb-3">
                    <div className="d-flex align-items-center gap-2">
                      <span className="fs-5">⚠️</span>
                      <div>
                        <strong>Sesión programada para: {datos.fecha_sesion}</strong>
                        <div className="small text-muted">
                          Por regla del sistema, la lista de asistencia se registra <em>al terminar la sesión</em> (el mismo día o al darla por concluida).
                        </div>
                      </div>
                    </div>
                    <div className="d-flex justify-content-end">
                      <button
                        type="button"
                        className="btn btn-warning btn-sm fw-semibold shadow-sm"
                        disabled={finalizando}
                        onClick={finalizarSesionAhora}
                      >
                        {finalizando ? "Concluyendo sesión..." : "🏁 Dar sesión por concluida y habilitar asistencia"}
                      </button>
                    </div>
                  </div>
                )}

                {/* ======================================================= */}
                {/* SECCIÓN 1: REGISTRO Y EDICIÓN DE ASISTENCIA            */}
                {/* ======================================================= */}
                <div className="card border mb-4">
                  <div className="card-header bg-light py-2 d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <h4 className="h6 fw-bold mb-0 text-dark">
                      1. Participantes confirmados ({datos.participantes.length})
                    </h4>
                    <div>
                      {tieneAsistenciaRegistrada && !modoEdicion ? (
                        <span className="badge bg-success-subtle text-success border border-success small">
                          🔒 Asistencia registrada (Solo lectura)
                        </span>
                      ) : tieneAsistenciaRegistrada && modoEdicion ? (
                        <span className="badge bg-warning-subtle text-warning border border-warning small">
                          ✏️ Modo de edición activo
                        </span>
                      ) : (
                        <span className="badge bg-info-subtle text-info border border-info small">
                          📝 Primer registro de asistencia
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="card-body p-2 p-md-3">
                    {datos.participantes.length === 0 ? (
                      <p className="text-muted small mb-0 text-center py-3">
                        No hay participantes confirmados en esta sesión.
                      </p>
                    ) : !modoEdicion && tieneAsistenciaRegistrada ? (
                      /* --- VISTA BLOQUEADA: La asistencia ya fue tomada previamente --- */
                      <div>
                        <div className="d-flex flex-column gap-2 mb-3">
                          {datos.participantes.map((p) => (
                            <div
                              key={p.usuario_id}
                              className="d-flex justify-content-between align-items-center p-2 rounded border bg-white flex-wrap gap-2"
                            >
                              <div>
                                <div className="fw-semibold text-dark">{p.usuario_nombre}</div>
                                <div className="text-muted small">{p.usuario_email}</div>
                              </div>
                              <div>
                                {p.asistencia === "presente" ? (
                                  <span className="badge bg-success px-3 py-2 fs-7 rounded-pill fw-semibold">
                                    ✓ Presente
                                  </span>
                                ) : p.asistencia === "ausente" ? (
                                  <span className="badge bg-danger px-3 py-2 fs-7 rounded-pill fw-semibold">
                                    ✕ Ausente
                                  </span>
                                ) : (
                                  <span className="badge bg-secondary-subtle text-secondary px-3 py-2 fs-7 rounded-pill">
                                    ⏳ Sin registrar
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Botón para habilitar la edición de asistencia si se necesita cambiar un registro */}
                        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 pt-2 border-top">
                          <span className="text-muted small">
                            🔒 <strong>Asistencia guardada:</strong> Los controles están protegidos para evitar modificaciones accidentales.
                          </span>
                          <button
                            type="button"
                            className="btn btn-outline-primary btn-sm px-3 rounded-pill fw-semibold"
                            onClick={() => setModoEdicion(true)}
                          >
                            ✏️ Editar / Modificar asistencia
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* --- VISTA EDITABLE: Primera toma o modo edición activado --- */
                      <form onSubmit={guardarAsistencias}>
                        <div className="d-flex flex-column gap-2 mb-3">
                          {datos.participantes.map((p) => {
                            const actual = asistencias[p.usuario_id] || p.asistencia;
                            return (
                              <div
                                key={p.usuario_id}
                                className="d-flex justify-content-between align-items-center p-2 rounded border bg-white flex-wrap gap-2"
                              >
                                <div>
                                  <div className="fw-semibold text-dark">{p.usuario_nombre}</div>
                                  <div className="text-muted small">{p.usuario_email}</div>
                                </div>
                                <div className="btn-group" role="group" aria-label={`Asistencia de ${p.usuario_nombre}`}>
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${
                                      actual === "presente"
                                        ? "btn-success text-white fw-bold shadow-sm"
                                        : "btn-outline-success"
                                    }`}
                                    onClick={() => seleccionarAsistencia(p.usuario_id, "presente")}
                                  >
                                    ✓ Presente
                                  </button>
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${
                                      actual === "ausente"
                                        ? "btn-danger text-white fw-bold shadow-sm"
                                        : "btn-outline-danger"
                                    }`}
                                    onClick={() => seleccionarAsistencia(p.usuario_id, "ausente")}
                                  >
                                    ✕ Ausente
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="d-flex justify-content-end align-items-center gap-2 pt-2 border-top">
                          {tieneAsistenciaRegistrada && (
                            <button
                              type="button"
                              className="btn btn-outline-secondary btn-sm px-3 rounded-pill"
                              disabled={guardando}
                              onClick={() => {
                                // Cancelar edición: restaurar valores guardados previamente
                                const guardados = {};
                                datos.participantes.forEach((p) => {
                                  if (p.asistencia) guardados[p.usuario_id] = p.asistencia;
                                });
                                setAsistencias(guardados);
                                setModoEdicion(false);
                              }}
                            >
                              Cancelar
                            </button>
                          )}
                          <button
                            type="submit"
                            className="btn btn-primary btn-sm px-3 rounded-pill fw-semibold"
                            disabled={guardando}
                          >
                            {guardando
                              ? "Guardando..."
                              : tieneAsistenciaRegistrada
                              ? "💾 Guardar modificaciones de asistencia"
                              : "💾 Guardar registro de asistencia"}
                          </button>
                        </div>
                      </form>
                    )}
                  </div>
                </div>

                {/* ======================================================= */}
                {/* SECCIÓN 2: JUSTIFICACIONES RECIBIDAS DE AUSENTES        */}
                {/* ======================================================= */}
                <div className="card border mb-4">
                  <div className="card-header bg-light py-2">
                    <h4 className="h6 fw-bold mb-0 text-dark">
                      2. Justificaciones de inasistencia
                    </h4>
                  </div>
                  <div className="card-body p-2 p-md-3">
                    {datos.participantes.filter((p) => p.asistencia === "ausente" && p.justificacion).length === 0 ? (
                      <p className="text-muted small mb-0 text-center py-2">
                        No hay justificaciones registradas de alumnos ausentes.
                      </p>
                    ) : (
                      <div className="d-flex flex-column gap-3">
                        {datos.participantes
                          .filter((p) => p.asistencia === "ausente" && p.justificacion)
                          .map((p) => (
                            <div
                              key={p.usuario_id}
                              className="card border-0 shadow-sm p-3 bg-light rounded"
                            >
                              <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                                <div>
                                  <strong className="text-dark">{p.usuario_nombre}</strong>{" "}
                                  <span className="text-muted small">({p.usuario_email})</span>
                                </div>
                                <div>
                                  {p.estado_justificacion === "pendiente" && (
                                    <span className="badge bg-warning text-dark">⏳ Pendiente de revisión</span>
                                  )}
                                  {p.estado_justificacion === "aceptada" && (
                                    <span className="badge bg-success">✅ Justificación aceptada</span>
                                  )}
                                  {p.estado_justificacion === "rechazada" && (
                                    <span className="badge bg-danger">❌ Justificación rechazada</span>
                                  )}
                                </div>
                              </div>

                              <p className="small mb-2 p-2 bg-white rounded border">
                                <strong>Motivo del estudiante:</strong> "{p.justificacion}"
                                <br />
                                <span className="text-muted small">
                                  Enviada: {formatearFechaHora(p.fecha_justificacion)}
                                </span>
                              </p>

                              {/* Formulario para resolver la justificación si está pendiente */}
                              {p.estado_justificacion === "pendiente" ? (
                                <div className="mt-2 pt-2 border-top">
                                  <label
                                    htmlFor={`motivo-res-${p.usuario_id}`}
                                    className="form-label small fw-semibold text-dark mb-1"
                                  >
                                    Motivo de la resolución (Obligatorio):
                                  </label>
                                  <input
                                    id={`motivo-res-${p.usuario_id}`}
                                    type="text"
                                    className="form-control form-control-sm mb-2"
                                    placeholder="Indica el motivo (ej. Justificante médico verificado)"
                                    value={motivosResolucion[p.usuario_id] || ""}
                                    onChange={(e) =>
                                      setMotivosResolucion((prev) => ({
                                        ...prev,
                                        [p.usuario_id]: e.target.value,
                                      }))
                                    }
                                  />
                                  <div className="d-flex gap-2">
                                    <button
                                      type="button"
                                      className="btn btn-success btn-sm flex-fill"
                                      disabled={procesandoJustificacion === `${p.usuario_id}-aceptar`}
                                      onClick={() => responderJustificacion(p.usuario_id, "aceptar")}
                                    >
                                      ✓ Aceptar justificación
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-outline-danger btn-sm flex-fill"
                                      disabled={procesandoJustificacion === `${p.usuario_id}-rechazar`}
                                      onClick={() => responderJustificacion(p.usuario_id, "rechazar")}
                                    >
                                      ✕ Rechazar justificación
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="small mb-0 text-muted fst-italic">
                                  Resuelto con motivo: "{p.motivo_respuesta_justificacion}" &bull;{" "}
                                  {formatearFechaHora(p.fecha_respuesta_justificacion)}
                                </p>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* ======================================================= */}
                {/* SECCIÓN 3: HISTORIAL DE CAMBIOS Y AUDITORÍA             */}
                {/* ======================================================= */}
                <div className="card border">
                  <div className="card-header bg-light py-2">
                    <h4 className="h6 fw-bold mb-0 text-dark">
                      3. 📜 Historial de cambios y auditoría
                    </h4>
                  </div>
                  <div className="card-body p-2 p-md-3">
                    {datos.historial.length === 0 ? (
                      <p className="text-muted small mb-0 text-center py-2">
                        Aún no hay registros de cambios de asistencia en esta sesión.
                      </p>
                    ) : (
                      <div className="table-responsive">
                        <table className="table table-sm table-striped small mb-0 align-middle">
                          <thead>
                            <tr>
                              <th>Fecha / Hora (Bolivia)</th>
                              <th>Estudiante</th>
                              <th>Acción realizada por</th>
                              <th>Evento</th>
                              <th>Estado anterior</th>
                              <th>Estado nuevo</th>
                              <th>Detalle / Motivo</th>
                            </tr>
                          </thead>
                          <tbody>
                            {datos.historial.map((h) => (
                              <tr key={h.id}>
                                <td className="text-nowrap">{formatearFechaHora(h.fecha)}</td>
                                <td>
                                  <div className="fw-semibold text-dark">
                                    {h.estudiante_nombre || `ID #${h.usuario_id}`}
                                  </div>
                                  {h.estudiante_email && (
                                    <div className="text-muted small">{h.estudiante_email}</div>
                                  )}
                                </td>
                                <td>
                                  <div className="fw-semibold text-primary">{h.actor_nombre}</div>
                                  <span className="badge bg-light text-secondary border small">
                                    {h.actor_rol || (h.actor_id === h.usuario_id ? "Estudiante" : "Organizador")}
                                  </span>
                                </td>
                                <td>
                                  <span className="badge bg-secondary-subtle text-secondary">
                                    {h.tipo_evento}
                                  </span>
                                </td>
                                <td className="text-muted">{h.estado_anterior || "—"}</td>
                                <td className="fw-semibold text-primary">{h.estado_nuevo}</td>
                                <td>{h.detalle || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-outline-secondary btn-sm" onClick={onClose}>
              Cerrar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * ModalJustificarAusencia:
 * Modal interactivo para que el estudiante ausente remita su justificación formal al organizador.
 */
export function ModalJustificarAusencia({ sesionId, sesionNombre, onClose, onSuccess }) {
  const [justificacion, setJustificacion] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");

  // TAREA 9 (PARTE A): Registra inicio del flujo de justificación en el embudo
  useEffect(() => {
    track("justificacion_iniciada", { sesion_id: sesionId });
  }, [sesionId]);

  async function enviar(e) {
    e.preventDefault();
    const texto = justificacion.trim();
    if (texto.length < 5) {
      setError("La justificación debe tener al menos 5 caracteres explicativos.");
      // TAREA 9: Registro de error de validación en el embudo
      track("justificacion_fallida", { sesion_id: sesionId, motivo: "texto_muy_corto" });
      return;
    }

    setEnviando(true);
    setError("");
    try {
      // pantalla: al tocar «Enviar justificación» 1
      const res = await apiRequest(`/sesiones/${sesionId}/justificar`, { // 2
        method: "POST",
        body: JSON.stringify({ justificacion: texto }),
      });

      // solo llega aquí si se guardó con éxito (Diapositiva 7/13)
      track("justificacion_enviada", { sesion_id: sesionId }); // 3

      if (onSuccess) onSuccess(res.mensaje);
      onClose();
    } catch (err) {
      // Error que frena la tarea (Diapositiva 11/13)
      track("justificacion_fallida", { sesion_id: sesionId, motivo: "error_servidor" });
      setError(err.message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="modal show d-block"
      tabIndex="-1"
      style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-justificar-titulo"
    >
      <div className="modal-dialog">
        <div className="modal-content shadow border-0">
          <div className="modal-header bg-warning text-dark">
            <h2 className="modal-title h5 fw-bold mb-0" id="modal-justificar-titulo">
              📝 Justificar Inasistencia
            </h2>
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar modal"
              onClick={onClose}
            />
          </div>
          <form onSubmit={enviar}>
            <div className="modal-body p-3 p-md-4">
              <p className="small text-muted mb-2">
                Sesión: <strong className="text-dark">{sesionNombre}</strong>
              </p>
              <p className="small text-secondary mb-3">
                Explica el motivo por el cual no pudiste asistir a esta sesión. El organizador evaluará tu solicitud y emitirá una resolución con motivo.
              </p>

              {error && <Alert type="danger" text={error} />}

              <div className="mb-3">
                <label htmlFor="texto-justificacion" className="form-label fw-semibold small">
                  Motivo de inasistencia (mínimo 5 caracteres):
                </label>
                <textarea
                  id="texto-justificacion"
                  className="form-control"
                  rows="3"
                  placeholder="Ej. Tuve cruce de horarios con un examen presencial de Cálculo..."
                  value={justificacion}
                  onChange={(e) => setJustificacion(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={onClose}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary btn-sm px-3"
                disabled={enviando}
              >
                {enviando ? "Enviando..." : "Enviar justificación"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

