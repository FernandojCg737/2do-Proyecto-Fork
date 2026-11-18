import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiRequest, API_URL, TOKEN_KEY } from "./api";
import { Alert, Loading } from "./Components";
import NavPills from "./NavPills";
import { track } from "./analitica";

/**
 * ============================================================================
 * CLASE 22 · TAREA 10: MIS DATOS Y SALIDA HONESTA (IHC)
 * ============================================================================
 * 
 * Requisitos y Rúbrica de la Diapositiva 12/16 y 13/16:
 * 1. Mis datos: Ver y descargar en formatos abiertos (JSON o CSV).
 * 2. Regla difícil de StudyMatch:
 *    "Las sesiones que organiza se cancelan y los participantes ven el motivo.
 *     Sale de las listas de espera sin afectar el orden de los demás."
 * 3. Salida tan clara como la entrada:
 *    "si la regla bloquea la eliminación, el mensaje dice por qué y qué hacer
 *     para poder eliminarla."
 * 4. Confirmación honesta (Diseño Ético):
 *    - Botones del mismo tamaño y peso visual (Simetría).
 *    - Consecuencias explicadas sin rodeos.
 *    - Sin manipulación emocional (sin confirmshaming ni culpabilización).
 *    - Sin pasos de más (sin laberintos de retención / roach motel).
 * 5. Inhabilitación permanente:
 *    - Después de eliminarla, esa cuenta no puede volver a iniciar sesión.
 * 6. Telemetría de interacción sin datos personales.
 */

export default function MisDatosPage() {
  // Hook de navegación para redirigir tras eliminar la cuenta
  const navigate = useNavigate();

  // Estados para almacenar el expediente de datos del usuario
  const [expediente, setExpediente] = useState(null);
  // Estado de carga inicial mientras se consulta al backend
  const [loading, setLoading] = useState(true);
  // Mensajes de alerta para retroalimentación visual al usuario
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  // Estado para controlar la apertura del modal de confirmación honesta
  const [modalEliminarAbierto, setModalEliminarAbierto] = useState(false);
  // Campo de verificación de contraseña para prevenir eliminaciones accidentales (Nielsen #5)
  const [passwordConfirmacion, setPasswordConfirmacion] = useState("");
  // Campo obligatorio si el usuario organiza sesiones activas con participantes
  const [motivoCancelacion, setMotivoCancelacion] = useState("");
  // Estado para desplegar el bloqueo de la regla de la app con el "por qué" y "qué hacer"
  const [bloqueoInfo, setBloqueoInfo] = useState(null);
  // Estado de envío durante la eliminación
  const [procesandoEliminacion, setProcesandoEliminacion] = useState(false);

  // Estados para el cambio de contraseña autenticado desde Mis datos
  const [mostrarFormPassword, setMostrarFormPassword] = useState(false);
  const [passActual, setPassActual] = useState("");
  const [passNueva, setPassNueva] = useState("");
  const [cargandoPassword, setCargandoPassword] = useState(false);
  const [errorPassword, setErrorPassword] = useState("");
  const [exitoPassword, setExitoPassword] = useState("");

  /**
   * Manejador de cambio de contraseña dentro de 'Mis datos' (IHC - Gestión de cuenta sin fricciones):
   * Permite actualizar la clave de acceso de manera directa sin tener que cerrar sesión
   * ni recurrir al flujo externo de recuperación.
   */
  async function manejarCambioPassword(e) {
    e.preventDefault();
    setErrorPassword("");
    setExitoPassword("");
    setCargandoPassword(true);

    try {
      const res = await apiRequest("/mis-datos/cambiar-password", {
        method: "POST",
        body: JSON.stringify({
          password_actual: passActual,
          nueva_password: passNueva,
        }),
      });

      setExitoPassword(res.mensaje || "¡Contraseña actualizada exitosamente!");
      setPassActual("");
      setPassNueva("");
      setTimeout(() => {
        setMostrarFormPassword(false);
        setExitoPassword("");
      }, 3000);
    } catch (err) {
      setErrorPassword(err.message || "Error al actualizar la contraseña.");
    } finally {
      setCargandoPassword(false);
    }
  }

  // Efecto inicial: Cargar el expediente completo de datos del usuario autenticado
  useEffect(() => {
    async function cargarMisDatos() {
      try {
        setLoading(true);
        // Consulta el endpoint GET /mis-datos
        const data = await apiRequest("/mis-datos");
        setExpediente(data);
      } catch (err) {
        setError(err.message || "No se pudieron cargar tus datos personales.");
      } finally {
        setLoading(false);
      }
    }
    cargarMisDatos();
  }, []);

  // --------------------------------------------------------------------------
  // FUNCIONALIDAD 1: Descarga de datos en JSON o CSV (Portabilidad Honesta)
  // --------------------------------------------------------------------------
  async function manejarDescarga(formato) {
    try {
      // TELEMETRÍA IHC: Registrar inicio de descarga (sin datos personales)
      track("descarga_datos_iniciada", { formato });

      const token = localStorage.getItem(TOKEN_KEY);
      // Descarga directa mediante fetch con cabeceras de autorización
      const respuesta = await fetch(`${API_URL}/mis-datos/descargar?formato=${formato}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!respuesta.ok) {
        throw new Error("Error al generar el archivo de descarga.");
      }

      // Convertir la respuesta binaria a Blob para disparar la descarga en el navegador
      const blob = await respuesta.blob();
      const urlDescarga = window.URL.createObjectURL(blob);
      const enlaceTemporal = document.createElement("a");
      enlaceTemporal.href = urlDescarga;
      enlaceTemporal.download = `studymatch_mis_datos.${formato}`;
      document.body.appendChild(enlaceTemporal);
      enlaceTemporal.click();
      enlaceTemporal.remove();
      window.URL.revokeObjectURL(urlDescarga);

      // TELEMETRÍA IHC: Registrar éxito en la descarga
      track("descarga_datos_completada", {
        formato,
        total_sesiones: expediente?.sesiones_organizadas?.length || 0,
      });

      setMensaje(`Tus datos se descargaron exitosamente en formato .${formato.toUpperCase()}`);
    } catch (err) {
      setError(err.message || "Error al descargar el archivo de datos.");
    }
  }

  // --------------------------------------------------------------------------
  // FUNCIONALIDAD 2: Abrir Modal de Confirmación Honesta
  // --------------------------------------------------------------------------
  function abrirModalEliminar() {
    setError("");
    setBloqueoInfo(null);
    setPasswordConfirmacion("");
    setMotivoCancelacion("");
    setModalEliminarAbierto(true);

    // TELEMETRÍA IHC: Registrar intención de salida honesta
    track("eliminacion_cuenta_iniciada", {
      tiene_sesiones_activas: (expediente?.sesiones_organizadas?.length || 0) > 0,
    });
  }

  // --------------------------------------------------------------------------
  // FUNCIONALIDAD 3: Ejecución de la Eliminación con la Regla de StudyMatch
  // --------------------------------------------------------------------------
  async function confirmarEliminacionCuenta(e) {
    e.preventDefault();
    setError("");
    setBloqueoInfo(null);

    // Validación preventiva en cliente: Contraseña requerida
    if (!passwordConfirmacion.trim()) {
      setError("Por favor ingresa tu contraseña para verificar tu identidad.");
      return;
    }

    try {
      setProcesandoEliminacion(true);

      // Llamada al endpoint POST /cuenta/eliminar
      const respuesta = await apiRequest("/cuenta/eliminar", {
        method: "POST",
        body: JSON.stringify({
          password_confirmacion: passwordConfirmacion,
          motivo_cancelacion_sesiones: motivoCancelacion,
        }),
      });

      // CASO A: ELIMINACIÓN COMPLETADA EXITOSAMENTE
      // TELEMETRÍA IHC: Evento de éxito con consecuencias aplicadas
      track("eliminacion_cuenta_completada", {
        sesiones_canceladas: respuesta.sesiones_canceladas || 0,
        filas_espera_liberadas: respuesta.filas_espera_liberadas || 0,
      });

      // Limpiar credenciales locales para cerrar la sesión
      localStorage.removeItem(TOKEN_KEY);
      setModalEliminarAbierto(false);

      // Redirigir a la pantalla de login con aviso informativo
      navigate("/login", {
        state: {
          mensaje: "Tu cuenta ha sido eliminada permanentemente. Las sesiones que organizabas fueron canceladas con el motivo provisto y saliste de las listas de espera.",
        },
      });
    } catch (err) {
      // CASO B: INTENTO BLOQUEADO POR LA REGLA DE LA APP (Diapositiva 12/16 y 13/16)
      // Si el backend responde con el detalle del bloqueo (por qué y qué hacer)
      if (err.data && err.data.bloqueado) {
        setBloqueoInfo(err.data);
        // TELEMETRÍA IHC: Registro de bloqueo por la regla de negocio
        track("eliminacion_cuenta_bloqueada", {
          razon: "motivo_cancelacion_requerido",
          sesiones_afectadas: err.data.sesiones_afectadas || 0,
        });
      } else {
        setError(err.message || "No se pudo procesar la eliminación de tu cuenta.");
      }
    } finally {
      setProcesandoEliminacion(false);
    }
  }

  if (loading) {
    return <Loading texto="Cargando tu expediente de datos..." />;
  }

  // Desestructuración de datos seguros para renderizar
  const perfil = expediente?.perfil || {};
  const stats = expediente?.estadisticas || {};
  const sesionesOrganizadas = expediente?.sesiones_organizadas || [];
  const misInscripciones = expediente?.solicitudes_e_inscripciones || [];

  return (
    <div className="container py-2" style={{ maxWidth: "920px" }}>
      {/* Navegación unificada por propósito de StudyMatch */}
      <NavPills activeTab="mis-datos" />

      {/* Encabezado canónico de la Tarea 10 */}
      <div className="mb-4 text-center text-md-start">
        <h1 className="h3 fw-bold mb-1 d-flex align-items-center gap-2">
          <span>🔒</span>
          <span>Mis datos y salida honesta</span>
        </h1>
        <p className="text-muted small mb-0">
          En cumplimiento del diseño ético y centrado en las personas (IHC): visualiza toda tu información,
          descárgala libremente en formatos abiertos o elimina tu cuenta sin obstáculos ni manipulaciones.
        </p>
      </div>

      {/* Alertas de retroalimentación visual al estudiante */}
      {mensaje && <Alert tipo="success" mensaje={mensaje} onClose={() => setMensaje("")} />}
      {error && <Alert tipo="danger" mensaje={error} onClose={() => setError("")} />}

      {/* ===================================================================== */}
      {/* SECCIÓN 1: VISUALIZACIÓN Y PORTABILIDAD DE DATOS (Diapositiva 12/16)  */}
      {/* ===================================================================== */}
      <div className="card shadow-sm border-0 mb-4 rounded-4">
        <div className="card-body p-4">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-3 mb-3">
            <div>
              <h2 className="h5 fw-bold mb-1">📋 Información almacenada en tu cuenta</h2>
              <p className="text-muted small mb-0">
                Transparencia total sobre los datos que StudyMatch guarda sobre tu actividad académica.
              </p>
            </div>
            {/* Botones de descarga honesta (formatos JSON y CSV) con Auto-Layout responsivo */}
            <div className="d-flex flex-column flex-sm-row gap-2 w-100 w-sm-auto">
              <button
                type="button"
                className="btn btn-outline-primary btn-sm px-3 py-2 fw-semibold d-inline-flex align-items-center justify-content-center gap-2 w-100 w-sm-auto"
                onClick={() => manejarDescarga("json")}
                data-testid="btn-descargar-json"
              >
                <span>📥</span>
                <span>Descargar en JSON</span>
              </button>
              <button
                type="button"
                className="btn btn-outline-success btn-sm px-3 py-2 fw-semibold d-inline-flex align-items-center justify-content-center gap-2 w-100 w-sm-auto"
                onClick={() => manejarDescarga("csv")}
                data-testid="btn-descargar-csv"
              >
                <span>📊</span>
                <span>Descargar en CSV</span>
              </button>
            </div>
          </div>

          {/* Tarjetas de estadísticas y perfil */}
          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <div className="p-3 bg-light rounded-3 border">
                <span className="text-muted small d-block">Perfil de estudiante:</span>
                <span className="fw-bold d-block text-dark fs-6">{perfil.nombre}</span>
                <span className="text-muted small d-block">{perfil.email}</span>
                <span className="badge bg-success-subtle text-success border border-success-subtle mt-2">
                  Estado: Cuenta activa
                </span>
              </div>
            </div>
            <div className="col-md-6">
              <div className="p-3 bg-light rounded-3 border">
                <span className="text-muted small d-block mb-1">Métricas de actividad:</span>
                <div className="d-flex justify-content-between text-muted small">
                  <span>Sesiones creadas:</span>
                  <strong className="text-dark">{stats.total_sesiones_organizadas}</strong>
                </div>
                <div className="d-flex justify-content-between text-muted small">
                  <span>Postulaciones / Inscripciones:</span>
                  <strong className="text-dark">{stats.total_solicitudes_e_inscripciones}</strong>
                </div>
                <div className="d-flex justify-content-between text-muted small">
                  <span>Asistencias confirmadas:</span>
                  <strong className="text-dark">{stats.total_asistencias_confirmadas}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* Tablas resumen de sesiones e inscripciones */}
          <div className="row g-4">
            {/* Columna A: Sesiones Organizadas */}
            <div className="col-lg-6">
              <h3 className="h6 fw-bold mb-2">👑 Sesiones que organizas ({sesionesOrganizadas.length})</h3>
              {sesionesOrganizadas.length === 0 ? (
                <p className="text-muted small fst-italic">No has creado ninguna sesión de estudio.</p>
              ) : (
                <div className="table-responsive border rounded-3" style={{ maxHeight: "200px" }}>
                  <table className="table table-sm table-hover mb-0 small">
                    <thead className="table-light">
                      <tr>
                        <th>Sesión</th>
                        <th>Fecha</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sesionesOrganizadas.map((s) => (
                        <tr key={s.id}>
                          <td className="fw-semibold">{s.nombre}</td>
                          <td>{s.fecha}</td>
                          <td>
                            {s.cancelada ? (
                              <span className="badge bg-danger">Cancelada</span>
                            ) : s.finalizada ? (
                              <span className="badge bg-secondary">Finalizada</span>
                            ) : (
                              <span className="badge bg-success">Activa ({s.total_participantes} part.)</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Columna B: Inscripciones y solicitudes del estudiante */}
            <div className="col-lg-6">
              <h3 className="h6 fw-bold mb-2">📨 Mis solicitudes e inscripciones ({misInscripciones.length})</h3>
              {misInscripciones.length === 0 ? (
                <p className="text-muted small fst-italic">No tienes solicitudes activas ni pasadas.</p>
              ) : (
                <div className="table-responsive border rounded-3" style={{ maxHeight: "200px" }}>
                  <table className="table table-sm table-hover mb-0 small">
                    <thead className="table-light">
                      <tr>
                        <th>Materia</th>
                        <th>Sesión</th>
                        <th>Estado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {misInscripciones.map((ins, idx) => (
                        <tr key={idx}>
                          <td className="fw-semibold">{ins.materia}</td>
                          <td>{ins.sesion_nombre}</td>
                          <td>
                            <span className="badge bg-light text-dark border">
                              {ins.estado_solicitud}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECCIÓN 2: SEGURIDAD Y CAMBIO DE CONTRASEÑA (IHC - Gestión de cuenta) */}
      {/* ===================================================================== */}
      <div className="card shadow-sm border-0 mb-4 rounded-4 bg-white">
        <div className="card-body p-3 p-md-4">
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div>
              <h2 className="h5 fw-bold mb-1 d-flex align-items-center gap-2">
                <span>🔑</span>
                <span>Seguridad y Contraseña</span>
              </h2>
              <p className="text-muted small mb-0">
                Cambia tu clave de acceso directamente mientras tu sesión está iniciada.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-outline-primary btn-sm px-3 fw-semibold"
              onClick={() => {
                setMostrarFormPassword(!mostrarFormPassword);
                setErrorPassword("");
                setExitoPassword("");
              }}
              data-testid="btn-toggle-cambiar-password"
            >
              {mostrarFormPassword ? "✕ Ocultar formulario" : "✏️ Cambiar mi contraseña"}
            </button>
          </div>

          {mostrarFormPassword && (
            <form onSubmit={manejarCambioPassword} className="mt-3 pt-3 border-top">
              {errorPassword && <Alert tipo="danger" mensaje={errorPassword} onClose={() => setErrorPassword("")} />}
              {exitoPassword && <Alert tipo="success" mensaje={exitoPassword} onClose={() => setExitoPassword("")} />}

              <div className="row g-3">
                <div className="col-12 col-md-6">
                  <label htmlFor="passActual" className="form-label fw-semibold small text-dark mb-1">
                    Contraseña actual:
                  </label>
                  <input
                    id="passActual"
                    type="password"
                    className="form-control"
                    placeholder="Ingresa tu contraseña actual"
                    value={passActual}
                    onChange={(e) => setPassActual(e.target.value)}
                    required
                    data-testid="input-pass-actual"
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="passNueva" className="form-label fw-semibold small text-dark mb-1">
                    Nueva contraseña:
                  </label>
                  <input
                    id="passNueva"
                    type="password"
                    className="form-control"
                    placeholder="Mínimo 6 caracteres"
                    value={passNueva}
                    onChange={(e) => setPassNueva(e.target.value)}
                    required
                    data-testid="input-pass-nueva"
                  />
                </div>
              </div>

              <div className="mt-3 d-flex justify-content-end gap-2 flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm px-3"
                  onClick={() => {
                    setMostrarFormPassword(false);
                    setPassActual("");
                    setPassNueva("");
                    setErrorPassword("");
                    setExitoPassword("");
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm px-4 fw-semibold"
                  disabled={cargandoPassword}
                  data-testid="btn-guardar-nueva-password"
                >
                  {cargandoPassword ? "Guardando..." : "Guardar nueva contraseña"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* SECCIÓN 3: SALIDA HONESTA Y ELIMINACIÓN DE CUENTA (Diapositivas 12 y 13) */}
      {/* ===================================================================== */}
      <div className="card shadow-sm border border-danger-subtle rounded-4 bg-white">
        <div className="card-body p-3 p-md-4">
          <div className="d-flex flex-column flex-sm-row align-items-start gap-3">
            {/* Icono en pantallas sm o mayores */}
            <div className="p-2 bg-danger-subtle text-danger rounded-3 fs-4 d-none d-sm-block flex-shrink-0">
              <span>⚠️</span>
            </div>
            <div className="flex-grow-1 w-100">
              <h2 className="h5 fw-bold text-danger mb-1 d-flex align-items-center gap-2">
                <span className="d-sm-none">⚠️</span>
                <span>Zona de salida honesta: Eliminar tu cuenta</span>
              </h2>
              <p className="text-muted small mb-3">
                En StudyMatch respetamos tu derecho a salir de la plataforma con la misma facilidad y claridad
                con la que entraste. Sin laberintos, sin culpabilizaciones y sin trampas de retención.
              </p>

              {/* Consecuencias explicadas sin rodeos (Diapositiva 12/16) */}
              <div className="p-3 bg-light rounded-3 border mb-3 small">
                <strong className="d-block mb-1 text-dark">Consecuencias de eliminar tu cuenta:</strong>
                <ul className="mb-0 text-muted ps-3">
                  <li>
                    <strong>Regla de sesiones organizadas:</strong> Las sesiones que organizas se cancelarán formalmente
                    y tus participantes inscritos verán el motivo de cancelación que indiques.
                  </li>
                  <li>
                    <strong>Regla de listas de espera:</strong> Saldrás limpiamente de todas las listas de espera sin
                    afectar el orden relativo de los demás estudiantes en la fila.
                  </li>
                  <li>
                    <strong>Inhabilitación total:</strong> Tu cuenta quedará desactivada permanentemente y no podrás
                    volver a iniciar sesión con estas credenciales.
                  </li>
                </ul>
              </div>

              {/* Botón de apertura de eliminación (accesible, responsivo, con btn-wrap y sin quiebres) */}
              <button
                type="button"
                className="btn btn-outline-danger btn-sm btn-wrap px-4 py-2 fw-semibold w-100 w-sm-auto text-center"
                onClick={abrirModalEliminar}
                data-testid="btn-abrir-modal-eliminar"
              >
                Eliminar mi cuenta permanentemente
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* MODAL DE CONFIRMACIÓN HONESTA (Diapositiva 12/16)                     */}
      {/* Principios aplicados:                                                 */}
      {/* - Botones del mismo tamaño y peso visual (Simetría).                  */}
      {/* - Consecuencias explicadas claramente sin textos culpabilizantes.      */}
      {/* - Prevención de errores accidentales (Nielsen #5): Password requerido. */}
      {/* ===================================================================== */}
      {modalEliminarAbierto && (
        <div
          className="modal fade show d-block"
          tabIndex="-1"
          style={{ backgroundColor: "var(--color-fondo-modal)" }}
          role="dialog"
          aria-modal="true"
        >
          <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: "540px" }}>
            <div className="modal-content rounded-4 border-0 shadow-lg">
              {/* Cabecera honesta sin manipulación emocional */}
              <div className="modal-header border-0 pb-0">
                <h5 className="modal-title fw-bold text-dark d-flex align-items-center gap-2">
                  <span>Confirmación de salida honesta</span>
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Cerrar modal"
                  onClick={() => setModalEliminarAbierto(false)}
                />
              </div>

              <form onSubmit={confirmarEliminacionCuenta}>
                <div className="modal-body py-3">
                  <p className="text-muted small mb-3">
                    Estás a punto de eliminar tu cuenta de <strong>StudyMatch</strong>. Esta acción es definitiva
                    e inhabilitará tu acceso al sistema.
                  </p>

                  {/* ALERTA DE INTENTO BLOQUEADO POR LA REGLA DE LA APP (Diapositivas 12/16 y 13/16) */}
                  {bloqueoInfo && (
                    <div
                      className="alert alert-warning border border-warning-subtle rounded-3 small mb-3"
                      data-testid="alerta-intento-bloqueado"
                    >
                      <strong className="d-block text-dark mb-1">
                        ⚠️ Eliminación bloqueada por la regla de la plataforma
                      </strong>
                      <p className="mb-1">
                        <strong>¿Por qué?</strong> {bloqueoInfo.por_que}
                      </p>
                      <p className="mb-0">
                        <strong>¿Qué hacer?</strong> {bloqueoInfo.que_hacer}
                      </p>
                    </div>
                  )}

                  {/* CAMPO OBLIGATORIO SEGÚN LA REGLA DE STUDYMATCH: MOTIVO PARA LOS PARTICIPANTES */}
                  <div className="mb-3">
                    <label htmlFor="motivo_cancelacion" className="form-label fw-semibold small text-dark mb-1">
                      Motivo de cancelación para tus participantes:
                    </label>
                    <textarea
                      id="motivo_cancelacion"
                      className="form-control form-control-sm"
                      rows="3"
                      placeholder="Indica el motivo que verán los participantes de tus sesiones organizadas (mínimo 5 caracteres)..."
                      value={motivoCancelacion}
                      onChange={(e) => setMotivoCancelacion(e.target.value)}
                      data-testid="input-motivo-cancelacion-cuenta"
                    />
                    <div className="form-text small text-muted">
                      Cumplimiento de la regla: Tus estudiantes verán este motivo en sus sesiones canceladas.
                    </div>
                  </div>

                  {/* PREVENCIÓN DE ERRORES (Nielsen #5): CONFIRMACIÓN DE CONTRASEÑA */}
                  <div className="mb-2">
                    <label htmlFor="password_confirmacion" className="form-label fw-semibold small text-dark mb-1">
                      Ingresa tu contraseña para verificar tu identidad:
                    </label>
                    <input
                      type="password"
                      id="password_confirmacion"
                      className="form-control form-control-sm"
                      placeholder="Tu contraseña actual"
                      value={passwordConfirmacion}
                      onChange={(e) => setPasswordConfirmacion(e.target.value)}
                      required
                      data-testid="input-password-confirmacion"
                    />
                  </div>
                </div>

                {/* =========================================================== */}
                {/* BOTONES SIMÉTRICOS DEL MISMO TAMAÑO (Diapositiva 12/16)     */}
                {/* =========================================================== */}
                <div className="modal-footer border-0 pt-0 px-3 pb-3">
                  <div className="d-flex flex-column flex-sm-row w-100 gap-2">
                    {/* Botón 1: Cancelar y quedarse (mismo tamaño simétrico) */}
                    <button
                      type="button"
                      className="btn btn-secondary w-100 w-sm-50 py-2 fs-6 fw-semibold"
                      onClick={() => setModalEliminarAbierto(false)}
                      disabled={procesandoEliminacion}
                      data-testid="btn-modal-cancelar"
                    >
                      Cancelar y volver
                    </button>
                    {/* Botón 2: Confirmar eliminación (mismo tamaño simétrico) */}
                    <button
                      type="submit"
                      className="btn btn-danger w-100 w-sm-50 py-2 fs-6 fw-semibold"
                      disabled={procesandoEliminacion}
                      data-testid="btn-modal-confirmar-eliminar"
                    >
                      {procesandoEliminacion ? "Eliminando..." : "Confirmar eliminación"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

