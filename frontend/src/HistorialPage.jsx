import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Loading } from "./Components";
import { apiRequest } from "./api";
import NavPills from "./NavPills";
import { InsigniaAsistencia, ModalJustificarAusencia } from "./AsistenciaComponents";
import { formatearFecha, formatearFechaHora } from "./fechas";

export default function HistorialPage() {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [actualizacion, setActualizacion] = useState(0);
  // TAREA 8: Modal para presentar justificación desde Mi historial
  const [modalJustificar, setModalJustificar] = useState(null);

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
      {/* CLASE 20: Navegación de secciones */}
      <NavPills activeTab="historial" />

      <div className="d-flex justify-content-between align-items-start align-items-sm-center flex-wrap gap-3 mb-4">
        <div>
          <h1 className="h2 mb-1">Mi historial de sesiones</h1>
          <p className="text-secondary mb-0">
            Tus solicitudes e inscripciones con fecha registrada aparecen de la más reciente a la más antigua.
          </p>
        </div>
        <div className="d-flex gap-2 flex-wrap">
          <Link to="/sesions" className="btn btn-primary text-nowrap">
            🔍 Buscar sesiones
          </Link>
          <Link to="/dashboard" className="btn btn-outline-secondary text-nowrap">
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

      {/* Listado cronológico de solicitudes con estados persistentes y Auto-Layout responsivo */}
      {!loading && !error && (
        <div className="d-grid gap-3">
          {historial.map((registro) => (
            <article className="card shadow-sm border" key={registro.sesion_id}>
              <div className="card-body p-3 p-md-4">
                {/* Cabecera con Auto-Layout responsivo: Materia a la izquierda y Estado en la parte superior derecha */}
                <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2">
                  <span className="badge bg-secondary-subtle text-secondary small">
                    📚 {registro.materia}
                  </span>

                  {/* Insignia visual de estado con Auto-Layout y tamaño adaptable */}
                  <div className="flex-shrink-0">
                    {registro.estado === "aceptada" ? (
                      <span className="badge bg-success text-white px-3 py-1 fs-6 d-inline-flex align-items-center gap-1 shadow-sm">
                        ✅ Inscripción aceptada
                      </span>
                    ) : registro.estado === "pendiente" ? (
                      <span className="badge bg-warning text-dark px-3 py-1 fs-6 d-inline-flex align-items-center gap-1 shadow-sm">
                        ⏳ Solicitud pendiente
                      </span>
                    ) : (
                      <span className="badge bg-danger text-white px-3 py-1 fs-6 d-inline-flex align-items-center gap-1 shadow-sm">
                        ❌ Solicitud rechazada
                      </span>
                    )}
                  </div>
                </div>

                {/* Título de la sesión a ancho completo: previene que se quiebre en líneas diminutas */}
                <h2 className="h5 fw-bold mb-3 text-dark text-break">
                  {registro.nombre}
                </h2>

                {/* Caja estructurada de datos (Auto-Layout en rejilla responsiva) */}
                <div className="bg-light rounded-3 p-3 mb-3 border border-light-subtle">
                  <div className="row g-2 small">
                    <div className="col-12 col-sm-6">
                      <span className="text-secondary d-block fw-semibold">💻 Modalidad:</span>
                      <span className="fw-semibold text-dark text-capitalize d-block">{registro.modalidad}</span>
                    </div>
                    <div className="col-12 col-sm-6">
                      <span className="text-secondary d-block fw-semibold">📅 Fecha de la sesión:</span>
                      <span className="fw-semibold text-dark d-block">{formatearFecha(registro.fecha_sesion)}</span>
                    </div>
                    <div className="col-12 col-sm-6">
                      <span className="text-secondary d-block fw-semibold">🕒 Fecha de solicitud:</span>
                      <span className="text-muted d-block">{formatearFechaHora(registro.fecha_inscripcion)}</span>
                    </div>
                    <div className="col-12 col-sm-6">
                      <span className="text-secondary d-block fw-semibold">📋 Resultado:</span>
                      <span className="fw-semibold text-dark d-block">{registro.resultado}</span>
                    </div>
                  </div>
                </div>

                {/* TAREA 8: Detalle interactivo de Asistencia y Justificación */}
                {registro.estado === "aceptada" && (
                  <div className="pt-2 border-top d-flex justify-content-between align-items-center flex-wrap gap-2">
                    <span className="small text-muted fw-semibold">Control de asistencia:</span>
                    <InsigniaAsistencia
                      asistencia={registro.asistencia}
                      estadoJustificacion={registro.estado_justificacion}
                      motivoJustificacion={registro.motivo_respuesta_justificacion}
                      justificacion={registro.justificacion}
                      onAbrirJustificar={() =>
                        setModalJustificar({ id: registro.sesion_id, nombre: registro.nombre })
                      }
                    />
                  </div>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      {/* TAREA 8: Modal para presentar justificación */}
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
  );
}
