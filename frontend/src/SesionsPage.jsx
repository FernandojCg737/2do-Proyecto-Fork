import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Input, Loading } from "./Components";
import { apiRequest } from "./api";

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
  // Guarda el id de la sesión cuyo panel de solicitudes está desplegado
  const [panelAbierto, setPanelAbierto] = useState(null);
  // Mapa de { [sesionId]: [solicitudes...] } cargadas desde el backend
  const [solicitudesPorSesion, setSolicitudesPorSesion] = useState({});
  // Indicador de carga cuando se consulta la lista de postulantes
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(null);
  // Identificador de la solicitud que se está respondiendo actualmente para bloquear botones duplicados
  const [procesandoRespuesta, setProcesandoRespuesta] = useState(null);

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
    const nuevos = new URLSearchParams();
    for (const [nombre, valor] of Object.entries(filtros)) {
      if ((nombre === "desde" || nombre === "hasta") && filtros.periodo !== "rango") continue;
      if (valor) nuevos.set(nombre, String(valor).trim());
    }
    setMensaje("");
    setErrorInscripcion("");
    setParametros(nuevos);
  }

  function quitarFiltro(nombre) {
    const nuevos = new URLSearchParams(parametros);
    nuevos.delete(nombre);
    if (["periodo", "desde", "hasta"].includes(nombre)) {
      nuevos.delete("periodo");
      nuevos.delete("desde");
      nuevos.delete("hasta");
    }
    setMensaje("");
    setErrorInscripcion("");
    setParametros(nuevos);
  }

  // ==============================================================================
  // --- TAREA 5 & 6: ACCIONES DEL ESTUDIANTE (SOLICITAR Y LISTA DE ESPERA) ---
  // ==============================================================================

  // Función 1: Solicitar unirse a una sesión o ingresar a la lista de espera
  // Se invoca cuando el alumno presiona "Solicitar unirme" o "Unirme a la lista de espera"
  async function solicitarUnirse(sesionId) {
    // 1. Activar estado de carga para deshabilitar el botón y evitar clics duplicados
    setInscribiendo(sesionId);
    setErrorInscripcion("");
    setMensaje("");

    try {
      // 2. Realizar petición POST al endpoint del backend (/sesiones/{id}/solicitar)
      // Si la sesión tiene cupo: el backend la registra como 'pendiente'.
      // Si la sesión está llena: el backend la registra como 'en_espera' con orden FIFO.
      const respuesta = await apiRequest(`/sesiones/${sesionId}/solicitar`, { method: "POST" });

      // 3. Mostrar al usuario el mensaje retornado (incluyendo su lugar en la lista si quedó en espera)
      setMensaje(respuesta.mensaje || "Solicitud enviada correctamente.");
    } catch (err) {
      // 4. Si ocurrió un error (ej. cupo duplicado o fecha pasada), capturar y mostrar alerta roja
      setErrorInscripcion(err.message);
    } finally {
      // 5. Desactivar el estado de carga del botón
      setInscribiendo(null);
      // 6. Incrementar 'actualizacion' para forzar a useEffect a recargar las sesiones desde la API
      // y actualizar inmediatamente los badges, contadores y botones en pantalla
      setActualizacion((valor) => valor + 1);
    }
  }

  // Función 2: Salir de la sesión o abandonar la lista de espera (TAREA 6)
  // Se invoca al presionar "Abandonar sesión", "Salir de lista de espera" o "Cancelar solicitud"
  async function salirDeSesion(sesionId) {
    // 1. Bloquear el botón con el spinner/texto de carga
    setInscribiendo(sesionId);
    setErrorInscripcion("");
    setMensaje("");

    try {
      // 2. Realizar petición POST a /sesiones/{id}/salir
      // REGLA CLAVE TAREA 6: Si el alumno estaba confirmado ('aceptada'), el backend automáticamente
      // promueve al primer estudiante que estaba en 'en_espera' a estado 'aceptada'.
      const respuesta = await apiRequest(`/sesiones/${sesionId}/salir`, { method: "POST" });

      // 3. Notificar al usuario que su salida fue exitosa
      setMensaje(respuesta.mensaje || "Has salido de la sesión correctamente.");
    } catch (err) {
      // 4. Si no estaba inscrito o falló la red, mostrar mensaje de error
      setErrorInscripcion(err.message);
    } finally {
      // 5. Restablecer el botón
      setInscribiendo(null);
      // 6. Disparar recarga reactiva de sesiones para que el cupo libre o la promoción se reflejen al instante
      setActualizacion((valor) => valor + 1);
    }
  }

  // --- TAREA 5: Organizador despliega el panel de solicitudes de su sesión ---
  // Consulta la lista de postulantes de la sesión seleccionada mediante GET /organizador/solicitudes
  async function togglePanelSolicitudes(sesionId) {
    // Si ya está abierto, se colapsa
    if (panelAbierto === sesionId) {
      setPanelAbierto(null);
      return;
    }

    setPanelAbierto(sesionId);
    setCargandoSolicitudes(sesionId);
    try {
      // Obtiene los postulantes de esta sesión específica
      const lista = await apiRequest(`/organizador/solicitudes?sesion_id=${sesionId}`);
      setSolicitudesPorSesion((prev) => ({ ...prev, [sesionId]: lista }));
    } catch (err) {
      setErrorInscripcion(`Error al cargar solicitudes: ${err.message}`);
    } finally {
      setCargandoSolicitudes(null);
    }
  }

  // --- TAREA 5: Organizador acepta o rechaza una solicitud ---
  // Llama al endpoint POST /solicitudes/{sesionId}/usuarios/{solicitanteId}/responder
  async function responderSolicitud(sesionId, solicitanteId, decision) {
    const clave = `${sesionId}-${solicitanteId}`;
    setProcesandoRespuesta(clave);
    setErrorInscripcion("");
    setMensaje("");
    try {
      // Envía la decisión ('aceptar' o 'rechazar')
      const res = await apiRequest(`/solicitudes/${sesionId}/usuarios/${solicitanteId}/responder`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      setMensaje(res.mensaje);

      // Vuelve a consultar la lista actualizada de solicitudes para esta sesión
      const lista = await apiRequest(`/organizador/solicitudes?sesion_id=${sesionId}`);
      setSolicitudesPorSesion((prev) => ({ ...prev, [sesionId]: lista }));
      // Dispara recarga de sesiones para que el cupo disponible se actualice en la tarjeta
      setActualizacion((v) => v + 1);
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
          {filtros.periodo === "rango" && <>
            <div className="col-md-6">
              <Input label="Desde" name="desde" type="date" value={filtros.desde} onChange={cambiarFiltro} required />
            </div>
            <div className="col-md-6">
              <Input label="Hasta" name="hasta" type="date" min={filtros.desde} value={filtros.hasta} onChange={cambiarFiltro} required />
            </div>
          </>}
        </div>
        <label className="mb-3">
          <input type="checkbox" name="disponible" checked={filtros.disponible} onChange={cambiarFiltro} />
          {" "}Solo sesiones a las que puedo unirme
        </label>
        <div className="d-flex gap-2 flex-wrap">
          <button className="btn btn-primary" type="submit">Buscar</button>
          <button className="btn btn-outline-secondary" type="button" onClick={() => {
            setFiltros(leerFiltros(new URLSearchParams()));
            setParametros({});
            setMensaje("");
            setErrorInscripcion("");
          }}>Limpiar filtros</button>
        </div>
      </form>

      {/* Chips de filtros activos */}
      {consulta && <div className="mb-3 d-flex gap-2 flex-wrap" aria-label="Filtros activos">
        {Array.from(parametros).filter(([nombre]) => nombresFiltros[nombre]).map(([nombre, valor]) => (
          <button key={nombre} className="btn btn-outline-secondary btn-sm" onClick={() => quitarFiltro(nombre)}
                  aria-label={`Quitar filtro ${nombresFiltros[nombre]}`}>
            {nombresFiltros[nombre]}: {textoFiltro(nombre, valor)} ×
          </button>
        ))}
      </div>}

      {/* Alertas de error o éxito */}
      {error && <div className="mb-3">
        <Alert type="danger" text={error} />
        <button type="button" className="btn btn-outline-primary"
                onClick={() => setActualizacion((valor) => valor + 1)}>
          Reintentar
        </button>
      </div>}
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
            // Variables de conveniencia según los datos provistos por la API para Tarea 5
            const esMio = sesion.es_organizador;
            const tienePendientes = sesion.solicitudes_pendientes_count > 0;
            const estaAbierto = panelAbierto === sesion.id;
            const solicitudesDeEstaSesion = solicitudesPorSesion[sesion.id] || [];

            return (
              <div key={sesion.id} className="col-12 col-md-6 col-lg-4">
                <div className={`card h-100 shadow-sm border ${esMio ? "border-primary" : ""}`}>
                  <div className="card-body d-flex flex-column">
                    {/* Encabezado con insignias de rol y estado de la solicitud */}
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="badge bg-secondary">{sesion.materia}</span>
                      {esMio ? (
                        // Insignia si el usuario actual es el organizador
                        <span className="badge bg-primary">👑 Organizador</span>
                      ) : sesion.estado_solicitud === "pendiente" ? (
                        // Insignia si la solicitud está pendiente de aprobación
                        <span className="badge bg-warning text-dark">⏳ Solicitud pendiente</span>
                      ) : sesion.estado_solicitud === "en_espera" ? (
                        // TAREA 6: Insignia destacada si el usuario está en Lista de Espera con su posición FIFO
                        <span className="badge bg-info text-dark">⏳ En espera (#{sesion.posicion_espera || 1})</span>
                      ) : sesion.estado_solicitud === "aceptada" ? (
                        // Insignia si el usuario está confirmado dentro del cupo
                        <span className="badge bg-success">✅ Confirmado</span>
                      ) : sesion.estado_solicitud === "rechazada" ? (
                        // Insignia si el organizador rechazó la solicitud
                        <span className="badge bg-danger">❌ Rechazada</span>
                      ) : null}
                    </div>

                    <h2 className="h5 fw-bold mb-2">{sesion.nombre}</h2>
                    <ul className="list-unstyled text-muted small mb-3">
                      <li><strong>Modalidad:</strong> {sesion.modalidad}</li>
                      <li><strong>Fecha:</strong> {formatearFecha(sesion.fecha)}</li>
                      <li>
                        {/* Cupos disponibles: solo descuentan las solicitudes aceptadas */}
                        <strong>Cupos disponibles:</strong>{" "}
                        <span className={sesion.cupos_disponibles === 0 ? "text-danger fw-bold" : "text-success fw-bold"}>
                          {sesion.cupos_disponibles}
                        </span> de {sesion.cupo}
                        {/* TAREA 6: Indicador visual si el cupo está lleno */}
                        {sesion.cupos_disponibles === 0 && (
                          <span className="badge bg-danger ms-2">Lleno</span>
                        )}
                        {/* TAREA 6: Contador de personas esperando en la fila si hay lista de espera */}
                        {sesion.en_espera_count > 0 && (
                          <div className="text-primary small mt-1 fw-semibold">
                            👥 {sesion.en_espera_count} en lista de espera
                          </div>
                        )}
                      </li>
                      <li>
                        <strong>Estado:</strong>{" "}
                        {sesion.inscripciones_abiertas ? (
                          <span className="text-success">Inscripciones abiertas</span>
                        ) : (
                          <span className="text-danger">Inscripciones cerradas</span>
                        )}
                      </li>
                    </ul>

                    {/* Mensaje de motivo cuando la sesión no está disponible */}
                    {sesion.motivo && !esMio && (
                      <p className="text-secondary small mb-3 bg-light p-2 rounded">
                        ℹ️ {sesion.motivo}
                      </p>
                    )}

                    {/* --- TAREA 5 & 6: SECCIÓN DE ACCIONES SEGÚN EL ROL DEL USUARIO --- */}
                    {esMio ? (
                      /* ROL ORGANIZADOR: Panel de gestión de postulantes y lista de espera */
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
                                      {sol.estado === "aceptada" && <span className="badge bg-success">Aceptada</span>}
                                      {sol.estado === "rechazada" && <span className="badge bg-danger">Rechazada</span>}
                                    </div>
                                    <span className="text-muted small mb-2">{sol.solicitante_email}</span>

                                    {/* Botones de acción directa para el organizador si la solicitud es pendiente */}
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
                                        ⏳ Esperando cupo libre (subirá automáticamente si alguien abandona)
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
                      /* ROL ESTUDIANTE: Acciones dinámicas de acuerdo a la Tarea 6 (Lista de espera y salida) */
                      <div className="mt-auto pt-2 border-top">
                        {sesion.estado_solicitud === "pendiente" ? (
                          // Si ya envió solicitud y está pendiente: puede esperar o cancelar
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
                          // TAREA 6: El estudiante está en lista de espera; puede ver su lugar y salir de la lista
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
                          // TAREA 6: El estudiante está confirmado; puede abandonar la sesión para ceder su lugar
                          <div className="d-flex flex-column gap-2">
                            <span className="badge bg-success py-2">
                              ✅ Inscripción confirmada (estás dentro)
                            </span>
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
                          // Si fue rechazada
                          <button className="btn btn-outline-danger w-100" disabled>
                            ❌ Solicitud no aprobada
                          </button>
                        ) : sesion.puede_solicitar_espera ? (
                          // TAREA 6: Sesión llena; el estudiante puede entrar a la LISTA DE ESPERA
                          <button
                            type="button"
                            className="btn btn-warning text-dark fw-bold w-100"
                            disabled={inscribiendo !== null}
                            onClick={() => solicitarUnirse(sesion.id)}
                          >
                            {inscribiendo === sesion.id ? "Ingresando..." : "Unirme a la lista de espera"}
                          </button>
                        ) : (
                          // Si aún no postuló y hay cupos libres
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

      <p className="text-center mt-4">
        <Link to="/dashboard" className="btn btn-outline-secondary">
          Volver al panel principal
        </Link>
      </p>
    </div>
  );
}
