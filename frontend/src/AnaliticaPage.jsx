import React, { useEffect, useState } from "react";
import { apiRequest } from "./api";
import NavPills from "./NavPills";

/**
 * TAREA 9 (PARTE A): Panel de Analítica en Todo el Producto (/analitica)
 * Cumple estrictamente con las Diapositivas 10/13 y 11/13:
 * - Embudos por cada flujo principal (inicio -> éxito con caídas intermedias)
 * - Registro y conteo de errores que frenan la tarea
 * - Búsquedas y filtros sin resultados
 * - Detección automática del paso con mayor caída y propuesta de cambio IHC
 * - Consulta canónica: SELECT evento, COUNT(*) FROM eventos GROUP BY evento;
 */
export default function AnaliticaPage() {
  const [metricas, setMetricas] = useState({
    conteo: { solicitud_iniciada: 0, solicitud_enviada: 0 },
    porcentaje_terminan: 0,
    embudos: [],
    flujo_mayor_caida: null,
    busquedas_sin_resultados: 0,
    ultimos_eventos: [],
  });
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  // Carga las métricas del servidor ejecutando la agregación SQL
  async function cargarMetricas() {
    setCargando(true);
    setError("");
    try {
      const data = await apiRequest("/analitica/metricas");
      setMetricas(data);
    } catch (err) {
      setError(err.message || "Error al obtener las métricas de eventos.");
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargarMetricas();
    // Auto-actualización periódica para ver eventos en tiempo real
    const intervalo = setInterval(cargarMetricas, 4000);
    return () => clearInterval(intervalo);
  }, []);

  const totalIniciadas = metricas?.conteo?.solicitud_iniciada || 0;
  const totalEnviadas = metricas?.conteo?.solicitud_enviada || 0;
  const porcentaje = metricas?.porcentaje_terminan || 0;
  const eventos = metricas?.ultimos_eventos || [];
  const embudos = metricas?.embudos || [];
  const mayorCaida = metricas?.flujo_mayor_caida;
  const busquedasVacias = metricas?.busquedas_sin_resultados || 0;

  function formatearHora(fechaIso) {
    if (!fechaIso) return "";
    try {
      const d = new Date(fechaIso);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch (_) {
      return fechaIso;
    }
  }

  return (
    <div className="container py-4">
      {/* Navegación por píldoras */}
      <NavPills activeTab="analitica" />

      {/* Encabezado con estilo de terminal / panel de desarrollo */}
      <div className="card shadow-sm border-0 mb-4 overflow-hidden" style={{ borderRadius: "14px" }}>
        <div className="p-3 text-white d-flex justify-content-between align-items-center" style={{ backgroundColor: "#2d3748" }}>
          <div>
            <span className="fw-mono text-warning me-2">/analitica</span>
            <span className="fw-semibold text-white">· StudyMatch</span>
            <span className="text-muted small ms-2">(solo desarrollo)</span>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-outline-light rounded-pill px-3"
            onClick={cargarMetricas}
            disabled={cargando}
          >
            {cargando ? "Actualizando..." : "🔄 Actualizar"}
          </button>
        </div>

        <div className="card-body p-4 bg-light">
          {error && <div className="alert alert-danger py-2">{error}</div>}

          {/* Tarjetas de Métricas Principales (Diapositiva 10/13) */}
          <div className="row g-3 mb-4">
            {/* Tarjeta 1: solicitud_iniciada */}
            <div className="col-12 col-md-3">
              <div className="card h-100 border-0 shadow-sm p-4 text-center bg-white" style={{ borderRadius: "12px" }}>
                <div className="display-5 fw-bold text-dark mb-1">{totalIniciadas}</div>
                <div className="fw-mono text-muted small">solicitud_iniciada</div>
              </div>
            </div>

            {/* Tarjeta 2: solicitud_enviada */}
            <div className="col-12 col-md-3">
              <div className="card h-100 border-0 shadow-sm p-4 text-center bg-white" style={{ borderRadius: "12px" }}>
                <div className="display-5 fw-bold text-dark mb-1">{totalEnviadas}</div>
                <div className="fw-mono text-muted small">solicitud_enviada</div>
              </div>
            </div>

            {/* Tarjeta 3: % que terminan (Fosforescente destacado) */}
            <div className="col-12 col-md-3">
              <div
                className="card h-100 border-0 shadow-sm p-4 text-center"
                style={{
                  borderRadius: "12px",
                  backgroundColor: "#c6f646",
                  color: "#1a202c",
                }}
              >
                <div className="display-5 fw-bold mb-1">{porcentaje} %</div>
                <div className="fw-semibold">terminan</div>
              </div>
            </div>

            {/* Tarjeta 4: Búsquedas sin resultados (Diapositiva 11/13) */}
            <div className="col-12 col-md-3">
              <div className="card h-100 border-0 shadow-sm p-4 text-center bg-white" style={{ borderRadius: "12px" }}>
                <div className="display-5 fw-bold text-warning mb-1">{busquedasVacias}</div>
                <div className="fw-mono text-muted small">búsquedas sin resultado</div>
              </div>
            </div>
          </div>

          {/* ================================================================= */}
          {/* TAREA 9: EMBUDOS DE CONVERSIÓN POR FLUJO PRINCIPAL (Diapositiva 11/13) */}
          {/* ================================================================= */}
          <div className="card border-0 shadow-sm p-4 bg-white mb-4" style={{ borderRadius: "12px" }}>
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="h5 fw-bold text-dark mb-0">
                📊 Embudos de Conversión por Flujo Principal
              </h2>
              <span className="badge bg-secondary-subtle text-secondary small">
                Que la app les diga dónde se traba la gente
              </span>
            </div>

            <div className="row g-3">
              {embudos.map((emb, idx) => (
                <div key={idx} className="col-12 col-md-6">
                  <div className="p-3 border rounded-3 bg-light h-100 d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <span className="fw-bold text-dark">{emb.flujo}</span>
                      <span className={`badge ${emb.tasa_exito >= 50 ? "bg-success" : "bg-warning text-dark"}`}>
                        {emb.tasa_exito}% éxito
                      </span>
                    </div>

                    <div className="small text-muted mb-2 fst-italic">
                      "{emb.pregunta}"
                    </div>

                    <div className="progress mb-2" style={{ height: "12px" }}>
                      <div
                        className="progress-bar bg-success"
                        role="progressbar"
                        style={{ width: `${emb.tasa_exito}%` }}
                        aria-valuenow={emb.tasa_exito}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                      <div
                        className="progress-bar bg-danger"
                        role="progressbar"
                        style={{ width: `${emb.tasa_caida}%` }}
                        aria-valuenow={emb.tasa_caida}
                        aria-valuemin="0"
                        aria-valuemax="100"
                      />
                    </div>

                    <div className="d-flex justify-content-between text-muted small mt-auto pt-2 border-top">
                      <span>Inicios: <strong>{emb.inicios}</strong> ({emb.evento_inicio})</span>
                      <span>Éxitos: <strong>{emb.exitos}</strong></span>
                      <span className="text-danger">Caída: <strong>{emb.tasa_caida}%</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ================================================================= */}
          {/* TAREA 9: DECISIÓN DE DISEÑO IHC ANTE EL PASO CON MAYOR CAÍDA */}
          {/* ================================================================= */}
          {mayorCaida && (
            <div
              className="alert border-0 shadow-sm p-4 mb-4"
              style={{
                borderRadius: "12px",
                backgroundColor: "#fff3cd",
                borderLeft: "6px solid #ffc107",
              }}
            >
              <div className="d-flex align-items-center gap-2 mb-2">
                <span className="fs-4">⚠️</span>
                <h3 className="h6 fw-bold mb-0 text-dark">
                  Paso con la mayor caída detectado: {mayorCaida.flujo} ({mayorCaida.tasa_caida}% de abandono)
                </h3>
              </div>
              <p className="small text-dark mb-2">
                <strong>¿Dónde se traba la gente?</strong> En la transición entre <code>{mayorCaida.evento_inicio}</code> y <code>{mayorCaida.evento_exito}</code>, el {mayorCaida.tasa_caida}% de los usuarios no concluye la acción.
              </p>
              <div className="p-2 bg-white rounded border small text-secondary">
                💡 <strong>Decisión de diseño IHC que cambiaríamos:</strong> Si los estudiantes o creadores abandonan en este paso, la interfaz debe anticipar los requisitos previos (mostrar cupos disponibles en vivo, autocompletar materias sugeridas y reducir campos obligatorios en el formulario para disminuir la carga cognitiva antes de presionar enviar).
              </div>
            </div>
          )}

          <div className="row g-4">
            {/* Columna Izquierda: Últimos Eventos Registrados */}
            <div className="col-12 col-lg-7">
              <h2 className="h6 fw-bold text-secondary mb-3">Últimos eventos registrados</h2>
              {eventos.length === 0 ? (
                <div className="p-4 bg-white rounded text-center text-muted border">
                  No hay eventos registrados en la tabla aún. Interactúa solicitando unirte, creando sesiones o cancelando.
                </div>
              ) : (
                <div className="d-flex flex-column gap-2" style={{ maxHeight: "380px", overflowY: "auto" }}>
                  {eventos.map((ev) => {
                    const materia = ev.props?.materia || "general";
                    const hora = formatearHora(ev.fecha);
                    const esExito = ev.evento.includes("enviada") || ev.evento.includes("creada") || ev.evento.includes("cancelada");
                    const esError = ev.evento.includes("fallid");

                    return (
                      <div
                        key={ev.id}
                        className="card border-0 shadow-sm p-3 bg-white d-flex flex-row justify-content-between align-items-center"
                        style={{ borderRadius: "10px" }}
                      >
                        <div>
                          <div className={`fw-mono fw-bold small ${esError ? "text-danger" : esExito ? "text-success" : "text-primary"}`}>
                            {ev.evento}
                          </div>
                          <div className="text-muted small">
                            materia: <span className="fw-semibold text-dark">{materia}</span> · {hora}
                          </div>
                        </div>
                        <span className={`badge ${esError ? "bg-danger" : esExito ? "bg-success" : "bg-primary"} rounded-pill px-2 py-1 small`}>
                          #{ev.id}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Columna Derecha: Reglas de Rúbrica y Consultas IHC */}
            <div className="col-12 col-lg-5">
              {/* Caja Obligatorio - Panel Propio */}
              <div className="card border-0 shadow-sm p-3 bg-white mb-3" style={{ borderRadius: "10px", borderLeft: "4px solid #10b981" }}>
                <span className="badge bg-success-subtle text-success text-uppercase fw-bold align-self-start mb-2 px-2 py-1">
                  OBLIGATORIO · PANEL PROPIO
                </span>
                <p className="small text-muted mb-2">
                  Una ruta <code className="fw-bold">/analitica</code> que lee la tabla <code>eventos</code> y muestra cuántos hay de cada uno y el % que termina.
                </p>
                <div className="p-2 bg-dark rounded text-light small font-monospace">
                  SELECT evento, COUNT(*)<br />
                  FROM eventos GROUP BY evento;
                </div>
              </div>

              {/* Caja Regla de Privacidad */}
              <div className="card border-0 shadow-sm p-3 bg-white" style={{ borderRadius: "10px", borderLeft: "4px solid #6366f1" }}>
                <span className="badge bg-primary-subtle text-primary text-uppercase fw-bold align-self-start mb-2 px-2 py-1">
                  REGLA IHC · PRIVACIDAD
                </span>
                <p className="small text-muted mb-1">
                  <strong>«Registren la acción, no a la persona»</strong>
                </p>
                <ul className="small text-muted ps-3 mb-0">
                  <li>✅ Se guarda: evento, props mínimas (materia, modalidad), fecha ISO.</li>
                  <li>🚫 Prohibido: emails, nombres, contraseñas ni textos privados.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
