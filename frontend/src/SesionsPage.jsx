import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Input, Loading } from "./Components";
import { apiRequest } from "./api";
import NavPills from "./NavPills";
import { track } from "./analitica";
import {
  InsigniaAsistencia,
  ModalControlAsistencia,
  ModalJustificarAusencia,
} from "./AsistenciaComponents";

// Diccionario de nombres legibles para los chips de filtros activos
const nombresFiltros = {
  nombre: "Nombre",
  materia: "Materia",
  modalidad: "Modalidad",
  periodo: "Fecha",
  desde: "Desde",
  hasta: "Hasta",
  disponible: "Disponibilidad",
};

// Formatea fechas YYYY-MM-DD a DD/MM/YYYY
function formatearFecha(fecha) {
  if (!fecha) return "";
  const partes = String(fecha).split("-");
  if (partes.length === 3) {
    const [anio, mes, dia] = partes;
    return `${dia}/${mes}/${anio}`;
  }
  return String(fecha);
}

// Parsea los parámetros URL a un objeto de estado
function leerFiltros(parametros) {
  return {
    nombre: parametros.get("nombre") || "",
    materia: parametros.get("materia") || "",
    modalidad: parametros.get("modalidad") || "",
    periodo: parametros.get("periodo") || "",
    desde: parametros.get("desde") || "",
    hasta: parametros.get("hasta") || "",
    disponible: parametros.get("disponible") === "true",
  };
}

export default function SesionsPage() {
  const [parametros, setParametros] = useSearchParams();
  const consulta = parametros.toString();
  const [filtros, setFiltros] = useState(() => leerFiltros(parametros));
  const [sesiones, setSesiones] = useState([]);
  const [materias, setMaterias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [errorInscripcion, setErrorInscripcion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [inscribiendo, setInscribiendo] = useState(null);
  const [actualizacion, setActualizacion] = useState(0);

  // --- TAREA 5: Estados para la gestión de solicitudes por el organizador ---
  const [panelAbierto, setPanelAbierto] = useState(null);
  const [solicitudesPorSesion, setSolicitudesPorSesion] = useState({});
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(null);
  const [procesandoRespuesta, setProcesandoRespuesta] = useState(null);

  // --- TAREA 7: Estados para la reprogramación de sesiones con reconfirmación ---
  const [modalReprogramar, setModalReprogramar] = useState(null);
  const [reprogFecha, setReprogFecha] = useState("");
  const [reprogMotivo, setReprogMotivo] = useState("");
  const [guardandoReprog, setGuardandoReprog] = useState(false);

  // --- TAREA 8: Estados para el control de asistencia y justificaciones ---
  const [modalAsistencia, setModalAsistencia] = useState(null); // { id, nombre }
  const [modalJustificar, setModalJustificar] = useState(null); // { id, nombre }

  // --- TAREA 9: Estados para la cancelación formal de sesiones por el organizador ---
  const [modalCancelar, setModalCancelar] = useState(null); // Sesión seleccionada para cancelar
  const [motivoCancelacion, setMotivoCancelacion] = useState(""); // Motivo obligatorio con mínimo 5 letras
  const [cancelando, setCancelando] = useState(false); // Bandera indicadora de proceso asíncrono

  useEffect(() => {
    let activo = true;
    const controlador = new AbortController();
    setFiltros(leerFiltros(new URLSearchParams(consulta)));

    // Carga sesiones y materias desde la API
    async function cargarSesiones() {
      setLoading(true);
      setError("");
      try {
        const [lista, listaMaterias] = await Promise.all([
          apiRequest(`/all-sesions?${consulta}`, { signal: controlador.signal }),
          apiRequest("/materias", { signal: controlador.signal }),
        ]);
        if (activo) {
          setSesiones(lista);
          setMaterias(listaMaterias);

          // TAREA 9 (PARTE A): Registrar telemetría de búsquedas o filtros sin resultados (Diapositiva 11/13)
          if (lista.length === 0 && consulta) {
            track("busqueda_sin_resultados", {
              materia: (filtros.materia || "general").toLowerCase(),
            });
          }
        }
      } catch (err) {
        if (activo) setError(err.message);
      } finally {
        if (activo) setLoading(false);
      }
    }

    cargarSesiones();
    return () => {
      activo = false;
      controlador.abort();
    };
  }, [consulta, actualizacion]);

  function cambiarFiltro(event) {
    const { name, value, type, checked } = event.target;
    setFiltros({ ...filtros, [name]: type === "checkbox" ? checked : value });
  }

  function aplicarFiltros(event) {
    event.preventDefault();
    const nuevosParametros = new URLSearchParams();
    Object.entries(filtros).forEach(([clave, valor]) => {
      if (typeof valor === "boolean" && valor) nuevosParametros.set(clave, "true");
      else if (typeof valor === "string" && valor.trim()) nuevosParametros.set(clave, valor.trim());
    });
    setParametros(nuevosParametros);
  }

  function removerFiltro(nombre) {
    const nuevosFiltros = { ...filtros };
    if (nombre === "disponible") nuevosFiltros.disponible = false;
    else if (nombre === "periodo") {
      nuevosFiltros.periodo = "";
      nuevosFiltros.desde = "";
      nuevosFiltros.hasta = "";
    } else {
      nuevosFiltros[nombre] = "";
    }
    setFiltros(nuevosFiltros);
    const nuevosParametros = new URLSearchParams();
    Object.entries(nuevosFiltros).forEach(([clave, valor]) => {
      if (typeof valor === "boolean" && valor) nuevosParametros.set(clave, "true");
      else if (typeof valor === "string" && valor.trim()) nuevosParametros.set(clave, valor.trim());
    });
    setParametros(nuevosParametros);
  }

  function limpiarTodosLosFiltros() {
    setFiltros({
      nombre: "",
      materia: "",
      modalidad: "",
      periodo: "",
      desde: "",
      hasta: "",
      disponible: false,
    });
    setParametros(new URLSearchParams());
  }

  // ==============================================================================
  // --- TAREA 5, 6, 7 & 9: ACCIONES DEL ESTUDIANTE Y ORGANIZADOR ---
  // ==============================================================================

  // Solicitar unirse o entrar en lista de espera con telemetría de embudo (Diapositiva 11/13)
  async function solicitarUnirse(sesion) {
    const sesionId = typeof sesion === "object" ? sesion.id : sesion;
    const sesionObj = typeof sesion === "object" ? sesion : sesiones.find((s) => s.id === sesionId);
    const materiaNombre = (sesionObj?.materia || "general").toLowerCase();

    setInscribiendo(sesionId);
    setErrorInscripcion("");
    setMensaje("");

    // Diapositiva 11/13: Paso 1 del embudo de solicitud (evento de inicio)
    track("solicitud_iniciada", {
      materia: materiaNombre,
    });

    try {
      // Petición al backend para registrar la solicitud
      const respuesta = await apiRequest(`/sesiones/${sesionId}/solicitar`, { method: "POST" });

      // Diapositiva 11/13: Paso final del embudo de solicitud (evento de éxito)
      track("solicitud_enviada", {
        materia: materiaNombre,
      });

      setMensaje(respuesta.mensaje || "Solicitud enviada correctamente.");
    } catch (err) {
      // Diapositiva 11/13: Registro de error que frena la tarea
      track("solicitud_fallida", {
        motivo: "error_servidor",
      });
      setErrorInscripcion(err.message);
    } finally {
      setInscribiendo(null);
      setActualizacion((valor) => valor + 1);
    }
  }

  // TAREA 9 (PARTE B): Abre el modal para que el organizador confirme la cancelación
  function abrirModalCancelar(sesion) {
    setModalCancelar(sesion); // Asigna la sesión seleccionada al estado
    setMotivoCancelacion(""); // Limpia el motivo anterior
    // Diapositiva 11/13: Evento de inicio del embudo de cancelación
    track("cancelacion_sesion_iniciada", {
      sesion_id: sesion.id,
      materia: (sesion.materia || "general").toLowerCase(),
    });
  }

  // TAREA 9 (PARTE B): Envía el motivo y procesa la cancelación formal en el backend
  async function confirmarCancelacionSesion(e) {
    e.preventDefault(); // Previene la recarga default del formulario HTML
    if (!modalCancelar) return; // Salvaguarda si no hay sesión seleccionada

    const motivoLimpio = motivoCancelacion.trim(); // Limpia espacios en blanco iniciales y finales
    if (motivoLimpio.length < 5) { // Regla obligatoria: motivo con al menos 5 caracteres
      setErrorInscripcion("El motivo de cancelación debe tener al menos 5 caracteres.");
      // Diapositiva 11/13: Registro del error de validación
      track("cancelacion_fallida", {
        sesion_id: modalCancelar.id,
        motivo: "motivo_muy_corto",
      });
      return;
    }

    setCancelando(true); // Bloquea el botón e indica procesamiento
    setErrorInscripcion(""); // Limpia mensajes de error previos
    setMensaje(""); // Limpia notificaciones previas

    try {
      // Pantalla: al tocar «Confirmar cancelación» (Diapositiva 7/13)
      const respuesta = await apiRequest(`/sesiones/${modalCancelar.id}/cancelar`, {
        method: "POST",
        body: JSON.stringify({ motivo: motivoLimpio }),
      });

      // Solo llega aquí si se guardó con éxito en el backend (Diapositiva 7/13)
      track("sesion_cancelada", {
        sesion_id: modalCancelar.id,
        materia: (modalCancelar.materia || "general").toLowerCase(),
      });

      setMensaje(respuesta.mensaje || "Sesión cancelada exitosamente.");
      setModalCancelar(null); // Cierra el modal de confirmación
      setMotivoCancelacion(""); // Reinicia el campo de texto
    } catch (err) {
      // Diapositiva 11/13: Evento de error reportado por el servidor
      track("cancelacion_fallida", {
        sesion_id: modalCancelar.id,
        motivo: "error_servidor",
      });
      setErrorInscripcion(err.message);
    } finally {
      setCancelando(false); // Restaura estado interactivo
      setActualizacion((v) => v + 1); // Dispara la recarga de sesiones actualizadas
    }
  }

  // Salir de la sesión o retirarse de la fila (TAREA 6 & 7: libera cupo y promueve al primero en espera)
  async function salirDeSesion(sesionId) {
    setInscribiendo(sesionId);
    setErrorInscripcion("");
    setMensaje("");

    try {
      const respuesta = await apiRequest(`/sesiones/${sesionId}/salir`, { method: "POST" });
      setMensaje(respuesta.mensaje || "Has salido de la sesión correctamente.");
    } catch (err) {
      setErrorInscripcion(err.message);
    } finally {
      setInscribiendo(null);
      setActualizacion((valor) => valor + 1);
    }
  }

  // TAREA 7: El estudiante reconfirma su participación en la sesión reprogramada
  async function reconfirmarAsistencia(sesionId) {
    setInscribiendo(sesionId);
    setErrorInscripcion("");
    setMensaje("");

    try {
      const respuesta = await apiRequest(`/sesiones/${sesionId}/reconfirmar`, { method: "POST" });
      setMensaje(respuesta.mensaje || "Has reconfirmado tu asistencia exitosamente.");
    } catch (err) {
      setErrorInscripcion(err.message);
    } finally {
      setInscribiendo(null);
      setActualizacion((valor) => valor + 1);
    }
  }

  // TAREA 7: Abrir el modal para que el organizador reprograme la sesión
  function abrirModalReprogramar(sesion) {
    setModalReprogramar(sesion);
    // Sugerir fecha siguiente a la actual de la sesión
    setReprogFecha("");
    setReprogMotivo("");
    setErrorInscripcion("");
  }

  // TAREA 7: El organizador guarda la reprogramación (cambia fecha y motivo; confirmados pasan a reconfirmación)
  async function guardarReprogramacion(e) {
    e.preventDefault();
    if (!modalReprogramar) return;

    setGuardandoReprog(true);
    setErrorInscripcion("");
    setMensaje("");

    try {
      const respuesta = await apiRequest(`/sesiones/${modalReprogramar.id}/reprogramar`, {
        method: "POST",
        body: JSON.stringify({ fecha: reprogFecha, motivo: reprogMotivo }),
      });
      setMensaje(respuesta.mensaje || "Sesión reprogramada exitosamente.");
      setModalReprogramar(null);
      setReprogFecha("");
      setReprogMotivo("");
    } catch (err) {
      setErrorInscripcion(err.message);
    } finally {
      setGuardandoReprog(false);
      setActualizacion((valor) => valor + 1);
    }
  }

  // Organizador despliega el panel de solicitudes de su sesión
  async function togglePanelSolicitudes(sesionId) {
    if (panelAbierto === sesionId) {
      setPanelAbierto(null);
      return;
    }
    setPanelAbierto(sesionId);
    if (!solicitudesPorSesion[sesionId]) {
      setCargandoSolicitudes(sesionId);
      try {
        const datos = await apiRequest(`/organizador/solicitudes?sesion_id=${sesionId}`);
        setSolicitudesPorSesion((prev) => ({ ...prev, [sesionId]: datos }));
      } catch (err) {
        setErrorInscripcion(err.message);
      } finally {
        setCargandoSolicitudes(null);
      }
    }
  }

  // Responder a una solicitud: aceptar o rechazar
  async function responderSolicitud(sesionId, solicitanteId, decision) {
    setProcesandoRespuesta(`${sesionId}-${solicitanteId}`);
    setErrorInscripcion("");
    setMensaje("");

    try {
      const respuesta = await apiRequest(`/solicitudes/${sesionId}/usuarios/${solicitanteId}/responder`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setMensaje(respuesta.mensaje || `Solicitud ${decision === "aceptar" ? "aceptada" : "rechazada"} con éxito.`);
      const datosActualizados = await apiRequest(`/organizador/solicitudes?sesion_id=${sesionId}`);
      setSolicitudesPorSesion((prev) => ({ ...prev, [sesionId]: datosActualizados }));
      setActualizacion((valor) => valor + 1);
    } catch (err) {
      setErrorInscripcion(err.message);
    } finally {
      setProcesandoRespuesta(null);
    }
  }

  function textoFiltro(nombre, valor) {
    if (nombre === "disponible") return "Puedo unirme";
    if (nombre === "desde" || nombre === "hasta") return formatearFecha(valor);
    if (nombre === "periodo") return { hoy: "Hoy", proximos7: "Próximos 7 días", rango: "Rango de fechas" }[valor] || valor;
    return valor;
  }

  return (
    <div>
      {/* CLASE 20: Navegación de secciones */}
      <NavPills activeTab="buscar" />

      <div className="d-flex justify-content-between align-items-center mb-3">
        <div>
          <h1 className="h2 mb-1">Sesiones de estudio</h1>
          <p className="text-muted mb-0">Explora sesiones disponibles o administra las solicitudes de las tuyas.</p>
        </div>
        <Link to="/new-study" className="btn btn-primary">
          + Crear nueva sesión
        </Link>
      </div>

      {/* Formulario de búsqueda y filtros */}
      <form className="card card-body mb-4 shadow-sm" onSubmit={aplicarFiltros}>
        <div className="row">
          <div className="col-md-6">
            <Input label="Buscar por nombre" name="nombre" value={filtros.nombre} onChange={cambiarFiltro} />
          </div>
          <div className="col-md-6 mb-3">
            <label htmlFor="materia" className="form-label fw-semibold">Materia</label>
            <select id="materia" name="materia" className="form-select" value={filtros.materia} onChange={cambiarFiltro}>
              <option value="">Todas</option>
              {materias.map((materia) => <option key={materia} value={materia}>{materia}</option>)}
            </select>
          </div>
          <div className="col-md-6 mb-3">
            <label htmlFor="modalidad" className="form-label fw-semibold">Modalidad</label>
            <select id="modalidad" name="modalidad" className="form-select" value={filtros.modalidad} onChange={cambiarFiltro}>
              <option value="">Todas</option>
              <option value="presencial">Presencial</option>
              <option value="virtual">Virtual</option>
            </select>
          </div>
          <div className="col-md-6 mb-3">
            <label htmlFor="periodo" className="form-label fw-semibold">Fecha</label>
            <select id="periodo" name="periodo" className="form-select" value={filtros.periodo} onChange={cambiarFiltro} aria-describedby="ayuda-fecha">
              <option value="">Todas</option>
              <option value="hoy">Hoy</option>
              <option value="proximos7">Próximos 7 días</option>
              <option value="rango">Rango de fechas</option>
            </select>
            <p id="ayuda-fecha" className="form-text mb-0">
              «Próximos 7 días» cuenta desde mañana hasta dentro de 7 días.
              Solo puedes unirte a sesiones con fecha futura.
            </p>
          </div>
          {/* FEEDBACK CLASE 19: No permitir seleccionar fechas pasadas en el rango de búsqueda */}
          {filtros.periodo === "rango" && <>
            <div className="col-md-6">
              <Input
                label="Desde"
                name="desde"
                type="date"
                min={new Date().toISOString().split("T")[0]}
                value={filtros.desde}
                onChange={cambiarFiltro}
                required
              />
            </div>
            <div className="col-md-6">
              <Input
                label="Hasta"
                name="hasta"
                type="date"
                min={filtros.desde || new Date().toISOString().split("T")[0]}
                value={filtros.hasta}
                onChange={cambiarFiltro}
                required
              />
            </div>
          </>}
        </div>
        <label className="mb-3">
          <input type="checkbox" name="disponible" checked={filtros.disponible} onChange={cambiarFiltro} />
          {" "}Solo sesiones a las que puedo unirme
        </label>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-primary">Buscar</button>
          <button type="button" className="btn btn-outline-secondary" onClick={limpiarTodosLosFiltros}>
            Limpiar filtros
          </button>
        </div>
      </form>

      {/* Chips de filtros activos */}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {Object.entries(filtros).map(([clave, valor]) => {
          if (!valor || (typeof valor === "string" && !valor.trim())) return null;
          return (
            <span key={clave} className="badge bg-secondary d-inline-flex align-items-center gap-2 p-2">
              <span>{nombresFiltros[clave] || clave}: {textoFiltro(clave, valor)}</span>
              <button
                type="button"
                className="btn-close btn-close-white"
                aria-label={`Quitar filtro ${nombresFiltros[clave] || clave}`}
                onClick={() => removerFiltro(clave)}
              />
            </span>
          );
        })}
      </div>

      {/* Alertas informativas y de error */}
      {error && <Alert type="danger" text={error} />}
      {errorInscripcion && <Alert type="danger" text={errorInscripcion} />}
      {mensaje && <Alert type="success" text={mensaje} />}

      {/* Listado de sesiones */}
      {loading ? <Loading /> : !error && <>
        {sesiones.length === 0 && (
          <div className="alert alert-info">
            {consulta ? "Ninguna sesión coincide con los filtros. Prueba quitarlos."
              : "Todavía no hay sesiones. Puedes crear una para empezar."}
          </div>
        )}

        <div className="row g-4">
          {sesiones.map((sesion) => {
            const esMio = sesion.es_organizador;
            const tienePendientes = sesion.solicitudes_pendientes_count > 0;
            const tieneReconfirmaciones = (sesion.reconfirmaciones_pendientes_count || 0) > 0;
            const estaAbierto = panelAbierto === sesion.id;
            const solicitudesDeEstaSesion = solicitudesPorSesion[sesion.id] || [];

            return (
              <div key={sesion.id} className="col-12 col-md-6 col-lg-4">
                <div className={`card h-100 shadow-sm border ${esMio ? "border-primary" : ""}`}>
                  <div className="card-body d-flex flex-column">
                    {/* Encabezado con insignias de rol y estado de la solicitud */}
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge bg-secondary">{sesion.materia}</span>
                      <div className="d-flex gap-1 align-items-center">
                        {sesion.cancelada && (
                          // TAREA 9: Indicador destacado si la sesión fue cancelada por el organizador
                          <span className="badge bg-danger">🚫 Cancelada</span>
                        )}
                        {esMio ? (
                          <span className="badge bg-primary">👑 Organizador</span>
                        ) : sesion.estado_solicitud === "cancelada" ? (
                          // TAREA 9: Estado del participante cuando la sesión fue cancelada
                          <span className="badge bg-danger">🚫 Cancelada</span>
                        ) : sesion.estado_solicitud === "pendiente_reconfirmacion" ? (
                          // TAREA 7: Insignia de reconfirmación requerida tras reprogramación
                          <span className="badge bg-warning text-dark">⚠️ Requiere reconfirmación</span>
                        ) : sesion.estado_solicitud === "pendiente" ? (
                          <span className="badge bg-warning text-dark">⏳ Solicitud pendiente</span>
                        ) : sesion.estado_solicitud === "en_espera" ? (
                          <span className="badge bg-info text-dark">⏳ En espera (#{sesion.posicion_espera || 1})</span>
                        ) : sesion.estado_solicitud === "aceptada" ? (
                          <span className="badge bg-success">✅ Confirmado</span>
                        ) : sesion.estado_solicitud === "rechazada" ? (
                          <span className="badge bg-danger">❌ Rechazada</span>
                        ) : null}
                      </div>
                    </div>

                    <h2 className="h5 fw-bold mb-2">{sesion.nombre}</h2>
                    <ul className="list-unstyled text-muted small mb-3">
                      <li><strong>Modalidad:</strong> {sesion.modalidad}</li>
                      <li><strong>Fecha:</strong> {formatearFecha(sesion.fecha)}</li>
                      <li>
                        <strong>Cupos disponibles:</strong>{" "}
                        <span className={sesion.cupos_disponibles === 0 ? "text-danger fw-bold" : "text-success fw-bold"}>
                          {sesion.cupos_disponibles}
                        </span> de {sesion.cupo}
                        {/* ========================================================================================= */}
                        {/* CORRECCIÓN ÉTICA IHC - CLASE 22 (Patrones Oscuros)                                       */}
                        {/* Principio aplicado: 1. Honestidad - La interfaz dice la verdad.                          */}
                        {/* Los cupos, plazos y estados salen de datos reales calculados en tiempo real.            */}
                        {/* Se erradicó el cartel fijo '¡Últimos cupos!' que manipulaba con escasez artificial.    */}
                        {/* ========================================================================================= */}
                        {sesion.cupos_disponibles === 0 ? (
                          // Si no hay cupos, informar con neutralidad sin culpabilizar al estudiante
                          <span className="badge bg-secondary ms-2" data-testid="badge-cupo-real">
                            Sin cupos (Lleno)
                          </span>
                        ) : sesion.cupos_disponibles === 1 && sesion.cupo > 1 ? (
                          // Solo si matemáticamente queda 1 cupo real, mostrar advertencia puramente informativa y verídica
                          <span className="badge bg-warning text-dark ms-2" data-testid="badge-cupo-real">
                            ℹ️ Último cupo disponible (1 libre)
                          </span>
                        ) : (
                          // Si hay 2 o más cupos disponibles, presentar disponibilidad con transparencia sin urgencia engañosa
                          <span className="badge bg-light text-success border border-success ms-2" data-testid="badge-cupo-real">
                            ✓ {sesion.cupos_disponibles} cupos libres
                          </span>
                        )}
                        {sesion.en_espera_count > 0 && (
                          <div className="text-primary small mt-1 fw-semibold">
                            👥 {sesion.en_espera_count} en lista de espera
                          </div>
                        )}
                        {tieneReconfirmaciones && esMio && (
                          <div className="text-warning small mt-1 fw-semibold">
                            ⚠️ {sesion.reconfirmaciones_pendientes_count} en espera de reconfirmar
                          </div>
                        )}
                      </li>
                      <li>
                        <strong>Estado:</strong>{" "}
                        {/* FEEDBACK CLASE 19: Si la sesión ya pasó, mostrar claramente Inscripciones cerradas */}
                        {sesion.es_pasada ? (
                          <span className="text-secondary fw-semibold">Inscripciones cerradas (sesión pasada)</span>
                        ) : sesion.inscripciones_abiertas ? (
                          <span className="text-success">Inscripciones abiertas</span>
                        ) : (
                          <span className="text-danger">Inscripciones cerradas</span>
                        )}
                      </li>
                      {/* TAREA 7: Indicador visible si la sesión fue reprogramada */}
                      {sesion.motivo_reprogramacion && (
                        <li className="mt-2 p-2 bg-light rounded text-info small">
                          📅 <strong>Reprogramada:</strong> "{sesion.motivo_reprogramacion}"
                        </li>
                      )}
                      {/* TAREA 9: Indicador visible si la sesión fue cancelada por el organizador */}
                      {sesion.cancelada && (
                        <li className="mt-2 p-2 bg-danger-subtle text-danger rounded small border border-danger-subtle">
                          🚫 <strong>Sesión cancelada:</strong> "{sesion.motivo_cancelacion || 'Por disposición del organizador'}"
                        </li>
                      )}
                    </ul>

                    {/* Mensaje de motivo cuando la sesión no está disponible */}
                    {sesion.motivo && !esMio && (
                      <p className="text-secondary small mb-3 bg-light p-2 rounded">
                        ℹ️ {sesion.motivo}
                      </p>
                    )}

                    {/* --- ACCIONES SEGÚN EL ROL DEL USUARIO --- */}
                    {esMio ? (
                      /* ROL ORGANIZADOR: Panel de gestión de postulantes y reprogramación */
                      <div className="mt-auto pt-2 border-top">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <span className="small text-muted">Gestión de tu sesión:</span>
                          {tienePendientes ? (
                            <span className="badge bg-danger">
                              {sesion.solicitudes_pendientes_count} pendiente{sesion.solicitudes_pendientes_count > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="badge bg-light text-muted border">0 pendientes</span>
                          )}
                        </div>

                        {/* Botón para colapsar/desplegar solicitudes */}
                        <button
                          type="button"
                          className={`btn btn-sm w-100 ${estaAbierto ? "btn-outline-secondary" : tienePendientes ? "btn-warning text-dark fw-bold" : "btn-outline-primary"}`}
                          onClick={() => togglePanelSolicitudes(sesion.id)}
                        >
                          {estaAbierto ? "▲ Cerrar panel de solicitudes" : `▼ Gestionar solicitudes (${sesion.solicitudes_pendientes_count})`}
                        </button>

                        {/* TAREA 7: Botón para Reprogramar sesión */}
                        {!sesion.es_pasada && !sesion.cancelada && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-info w-100 mt-2"
                            disabled={tieneReconfirmaciones}
                            title={tieneReconfirmaciones ? "No se admite otra reprogramación mientras haya reconfirmaciones pendientes." : "Reprogramar fecha y motivo"}
                            onClick={() => abrirModalReprogramar(sesion)}
                          >
                            📅 Reprogramar sesión {tieneReconfirmaciones ? `(Bloqueado: pendientes)` : ""}
                          </button>
                        )}

                        {/* TAREA 9: Botón para Cancelar sesión formalmente por el organizador */}
                        {sesion.puede_cancelar && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger w-100 mt-2 fw-semibold"
                            onClick={() => abrirModalCancelar(sesion)}
                            title="Cancelar definitivamente esta sesión de estudio con motivo obligatorio"
                          >
                            🚫 Cancelar sesión
                          </button>
                        )}

                        {/* TAREA 8: Control de asistencia y resolución de justificaciones para el organizador */}
                        {!sesion.cancelada && (
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-success w-100 mt-2 fw-semibold"
                            onClick={() => setModalAsistencia({ id: sesion.id, nombre: sesion.nombre })}
                            title="Gestionar lista de presentes/ausentes y evaluar justificaciones"
                          >
                            📋 Control de asistencia y justificaciones
                          </button>
                        )}

                        {/* Contenido desplegable con la lista de solicitudes de esta sesión */}
                        {estaAbierto && (
                          <div className="mt-3 p-2 bg-light border rounded">
                            <h3 className="h6 fw-bold mb-2">Solicitudes y lista de espera</h3>
                            {cargandoSolicitudes === sesion.id ? (
                              <div className="text-center py-2 small text-muted">Cargando solicitudes...</div>
                            ) : solicitudesDeEstaSesion.length === 0 ? (
                              <p className="small text-muted mb-0">No hay solicitudes registradas aún.</p>
                            ) : (
                              <div className="d-flex flex-column gap-2">
                                {solicitudesDeEstaSesion.map((sol) => (
                                  <div key={sol.solicitante_id} className="card card-body p-2 border-0 shadow-sm bg-white">
                                    <div className="d-flex justify-content-between align-items-center mb-1">
                                      <span className="fw-semibold small">{sol.solicitante_nombre}</span>
                                      {sol.estado === "pendiente" && <span className="badge bg-warning text-dark">Pendiente</span>}
                                      {sol.estado === "en_espera" && <span className="badge bg-info text-dark">En espera (#{sol.posicion || 1})</span>}
                                      {sol.estado === "pendiente_reconfirmacion" && <span className="badge bg-warning text-dark">Reconfirmación</span>}
                                      {sol.estado === "aceptada" && <span className="badge bg-success">Aceptada</span>}
                                      {sol.estado === "rechazada" && <span className="badge bg-danger">Rechazada</span>}
                                    </div>
                                    <span className="text-muted small mb-2">{sol.solicitante_email}</span>

                                    {sol.estado === "pendiente" ? (
                                      <div className="d-flex gap-2 mt-1">
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-success flex-fill py-1"
                                          disabled={procesandoRespuesta === `${sesion.id}-${sol.solicitante_id}`}
                                          onClick={() => responderSolicitud(sesion.id, sol.solicitante_id, "aceptar")}
                                        >
                                          ✓ Aceptar
                                        </button>
                                        <button
                                          type="button"
                                          className="btn btn-sm btn-outline-danger flex-fill py-1"
                                          disabled={procesandoRespuesta === `${sesion.id}-${sol.solicitante_id}`}
                                          onClick={() => responderSolicitud(sesion.id, sol.solicitante_id, "rechazar")}
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
                                        Respondida: {sol.fecha_respuesta ? formatearFecha(sol.fecha_respuesta.split("T")[0]) : "Guardada"}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      /* ROL ESTUDIANTE: Acciones dinámicas */
                      <div className="mt-auto pt-2 border-top">
                        {sesion.cancelada || sesion.estado_solicitud === "cancelada" ? (
                          // TAREA 9 (PARTE B): Un participante ve el motivo y no puede volver a solicitar (Diapositiva 12/13)
                          <div className="d-flex flex-column gap-2">
                            <span className="badge bg-danger py-2">
                              🚫 Sesión cancelada por el organizador
                            </span>
                            <div className="small text-danger bg-light p-2 rounded border border-danger-subtle">
                              <strong>Motivo oficial:</strong> "{sesion.motivo_cancelacion || 'Por fuerza mayor o reprogramación'}"
                            </div>
                            <button className="btn btn-secondary w-100" disabled>
                              🚫 No se admiten nuevas solicitudes
                            </button>
                          </div>
                        ) : sesion.estado_solicitud === "pendiente_reconfirmacion" ? (
                          // TAREA 7: El estudiante debe reconfirmar o retirarse tras reprogramación
                          <div className="d-flex flex-column gap-2">
                            <span className="badge bg-warning text-dark py-2">
                              ⚠️ Sesión reprogramada: requiere reconfirmación
                            </span>
                            <div className="small text-muted bg-light p-2 rounded">
                              {sesion.motivo_reprogramacion ? `Motivo: "${sesion.motivo_reprogramacion}"` : "El organizador actualizó la fecha."} Conservas temporalmente tu cupo.
                            </div>
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-success flex-fill py-2 fw-semibold"
                                disabled={inscribiendo === sesion.id}
                                onClick={() => reconfirmarAsistencia(sesion.id)}
                              >
                                {inscribiendo === sesion.id ? "Aceptando..." : "✅ Aceptar nueva fecha"}
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger flex-fill py-2"
                                disabled={inscribiendo === sesion.id}
                                onClick={() => salirDeSesion(sesion.id)}
                              >
                                {inscribiendo === sesion.id ? "Saliendo..." : "🚪 Retirarme"}
                              </button>
                            </div>
                          </div>
                        ) : sesion.estado_solicitud === "pendiente" ? (
                          <div className="d-flex flex-column gap-2">
                            <span className="badge bg-warning text-dark py-2">
                              ⏳ Solicitud pendiente de aprobación
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger w-100"
                              disabled={inscribiendo === sesion.id}
                              onClick={() => salirDeSesion(sesion.id)}
                            >
                              {inscribiendo === sesion.id ? "Cancelando..." : "Cancelar solicitud"}
                            </button>
                          </div>
                        ) : sesion.estado_solicitud === "en_espera" ? (
                          <div className="d-flex flex-column gap-2">
                            <span className="badge bg-info text-dark py-2">
                              ⏳ En lista de espera (Lugar #{sesion.posicion_espera || 1})
                            </span>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary w-100"
                              disabled={inscribiendo === sesion.id}
                              onClick={() => salirDeSesion(sesion.id)}
                            >
                              {inscribiendo === sesion.id ? "Saliendo..." : "Salir de lista de espera"}
                            </button>
                          </div>
                        ) : sesion.estado_solicitud === "aceptada" ? (
                          <div className="d-flex flex-column gap-2">
                            <span className="badge bg-success py-2">
                              ✅ Inscripción confirmada (estás dentro)
                            </span>

                            {/* TAREA 8: Estado de asistencia del estudiante y acción de justificar */}
                            <InsigniaAsistencia
                              asistencia={sesion.mi_asistencia}
                              estadoJustificacion={sesion.mi_estado_justificacion}
                              motivoJustificacion={sesion.mi_motivo_justificacion}
                              justificacion={sesion.mi_justificacion}
                              onAbrirJustificar={() =>
                                setModalJustificar({ id: sesion.id, nombre: sesion.nombre })
                              }
                            />

                            <button
                              type="button"
                              className="btn btn-sm btn-outline-danger w-100"
                              disabled={inscribiendo === sesion.id}
                              onClick={() => salirDeSesion(sesion.id)}
                            >
                              {inscribiendo === sesion.id ? "Procesando..." : "Abandonar sesión"}
                            </button>
                          </div>
                        ) : sesion.estado_solicitud === "rechazada" ? (
                          <button className="btn btn-outline-danger w-100" disabled>
                            ❌ Solicitud no aprobada
                          </button>
                        ) : sesion.puede_solicitar_espera ? (
                          <button
                            type="button"
                            className="btn btn-warning text-dark fw-bold w-100"
                            disabled={inscribiendo !== null}
                            onClick={() => solicitarUnirse(sesion.id)}
                          >
                            {inscribiendo === sesion.id ? "Ingresando..." : "Unirme a la lista de espera"}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary w-100"
                            disabled={!sesion.puede_solicitar || inscribiendo !== null}
                            onClick={() => solicitarUnirse(sesion.id)}
                          >
                            {inscribiendo === sesion.id ? "Enviando solicitud..." : "Solicitar unirme"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </>}

      {/* --- TAREA 7: MODAL DE REPROGRAMACIÓN DE SESIÓN --- */}
      {modalReprogramar && (
        <div className="modal show d-block" style={{ backgroundColor: "rgba(0,0,0,0.5)" }} role="dialog">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content shadow border-0">
              <form onSubmit={guardarReprogramacion}>
                <div className="modal-header bg-primary text-white">
                  <h5 className="modal-title">📅 Reprogramar sesión</h5>
                  <button
                    type="button"
                    className="btn-close btn-close-white"
                    onClick={() => setModalReprogramar(null)}
                    aria-label="Cerrar"
                  />
                </div>
                <div className="modal-body">
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
                    <label htmlFor="reprog-fecha" className="form-label fw-semibold">Nueva fecha</label>
                    <input
                      id="reprog-fecha"
                      type="date"
                      className="form-control"
                      min={new Date(Date.now() + 86400000).toISOString().split("T")[0]}
                      value={reprogFecha}
                      onChange={(e) => setReprogFecha(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="reprog-motivo" className="form-label fw-semibold">Motivo de la reprogramación</label>
                    <textarea
                      id="reprog-motivo"
                      className="form-control"
                      rows="3"
                      placeholder="Indica el motivo (ej. Cruce de horarios con examen de Cálculo)"
                      value={reprogMotivo}
                      onChange={(e) => setReprogMotivo(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => setModalReprogramar(null)}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
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

      {/* --- TAREA 9 (PARTE B): Modal de Cancelación de Sesión para el Organizador --- */}
      {modalCancelar && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1060 }}
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
                    ⚠️ <strong>Consecuencias de IHC (Diapositiva 12/13):</strong>
                    <ul className="mb-0 ps-3 mt-1">
                      <li>Los participantes aceptados, pendientes y en espera pasarán a <strong>cancelada</strong>.</li>
                      <li>Todos ellos verán el motivo que ingreses a continuación.</li>
                      <li>No se admitirán nuevas solicitudes ni registro de asistencia.</li>
                      <li>Esta acción es definitiva y no se puede revertir.</li>
                    </ul>
                  </div>

                  <div className="mb-3">
                    <label htmlFor="motivo-cancelacion-input" className="form-label fw-semibold">
                      Motivo obligatorio de cancelación:
                    </label>
                    <textarea
                      id="motivo-cancelacion-input"
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

      <p className="text-center mt-4">
        <Link to="/dashboard" className="btn btn-outline-secondary">
          Volver al panel principal
        </Link>
      </p>
    </div>
  );
}
