// Importación de hooks de ciclo de vida y estado reactivo de React
import { useEffect, useState } from "react";
// Importación de componentes de interfaz reutilizables del sistema de diseño
import { Alert, AuthCard, Input } from "./Components";
// Importación de componentes de navegación de React Router DOM
import { Link, useNavigate } from "react-router-dom";
// Importación de cliente HTTP para comunicación autenticada con la API FastAPI
import { apiRequest } from "./api";
// Importación del módulo de analítica y telemetría ética para embudos de conversión
import { track } from "./analitica";

/**
 * Componente CreateSesionPage:
 * Formulario para el registro de una nueva sesión de estudio grupal en StudyMatch.
 * Implementa principios de IHC:
 * - Visibilidad del estado del sistema (Heurística #1 de Nielsen): Alertas inmediatas de éxito/error.
 * - Control y libertad del usuario (Heurística #3): Salidas claras (Cancelar) sin forzar permanencia.
 * - Redirección post-creación: Retorna al contexto previo (Mis sesiones) con confirmación explícita.
 */
export default function CreateSesionPage() {
  // Hook de navegación programática para redirigir al usuario al finalizar la tarea
  const navigate = useNavigate();

  // Estados locales para los campos del formulario de creación de sesión
  const [nombre, setNombre] = useState("");
  const [materia, setMateria] = useState("");
  const [modalidad, setModalidad] = useState("presencial");
  const [cupo, setCupo] = useState(1);
  const [fecha, setFecha] = useState("");
  // FEEDBACK CLASE 19: Las inscripciones nacen abiertas por defecto (true) sin necesidad de selector redundante
  const [inscripciones] = useState(true);

  // Estados de retroalimentación de interfaz
  const [message, setMessage] = useState(""); // Mensaje de éxito de la operación
  const [error, setError] = useState(""); // Mensaje de error si falla la validación
  const [loading, setLoading] = useState(false); // Estado de carga para prevenir envíos duplicados

  // TAREA 9 (PARTE A): Registra inicio del flujo de creación en el embudo de telemetría
  useEffect(() => {
    // Se envía el evento de telemetría informando que el estudiante abrió el formulario
    track("sesion_creacion_iniciada", { origen: "formulario_nueva_sesion" });
  }, []); // Array de dependencias vacío para dispararse únicamente al montar el componente

  /**
   * Manejador de envío del formulario:
   * Valida, envía datos al backend y confirma con redirección al panel de sesiones.
   */
  async function createNew(event) {
    // Previene el comportamiento por defecto del navegador de recargar la página
    event.preventDefault();
    // Limpia mensajes de error o éxito previos antes de intentar una nueva solicitud
    setError("");
    setMessage("");
    // Activa bandera de procesamiento para deshabilitar el botón y evitar peticiones dobles
    setLoading(true);

    try {
      // Envía la petición POST al endpoint del backend FastAPI
      const data = await apiRequest("/guardar-nuevo", {
        method: "POST",
        body: JSON.stringify({ nombre, materia, modalidad, cupo, fecha, inscripciones }),
      });

      // Solo llega aquí si se guardó con éxito en el backend (Diapositiva 7/13)
      track("sesion_creada", {
        materia: (materia || "general").toLowerCase(),
        modalidad: modalidad.toLowerCase(),
      });

      // Feedback visual inmediato para el usuario (mantiene la frase exacta para pruebas Playwright)
      const textoExito = data.mensaje || "Sesión de estudio registrada correctamente";
      setMessage(textoExito);

      // Limpia los campos del formulario
      setNombre("");
      setMateria("");
      setModalidad("presencial");
      setCupo(1);
      setFecha("");

      // Redirección suave y confirmada: permite al usuario ver la confirmación durante 1.2 segundos
      // y luego lo retorna a la pestaña de "Mis Sesiones" en el Dashboard para continuar su flujo
      setTimeout(() => {
        navigate("/dashboard?tab=mis-sesiones", {
          state: { mensaje: `🎉 ${textoExito}` },
        });
      }, 1200);
    } catch (err) {
      // TAREA 9 (PARTE A): Error que frena la tarea en el embudo de analítica
      track("sesion_creacion_fallida", {
        motivo: "error_validacion_o_servidor",
      });
      // Captura y despliega el mensaje de error del backend en la interfaz
      setError(err.message);
    } finally {
      // Restablece el estado de carga una vez terminada la petición
      setLoading(false);
    }
  }

  return (
    // Tarjeta contenedora con estilo unificado de autenticación y creación
    <AuthCard title="Nueva sesion de estudio">
      {/* Alerta de error si ocurrió alguna falla en la validación */}
      {error && <Alert type="danger" text={error} />}

      {/* Alerta de confirmación inmediata tras completar el registro */}
      {message && (
        <Alert
          type="success"
          text={`${message}. Redirigiéndote a tus sesiones...`}
        />
      )}

      {/* Formulario de entrada de datos con validaciones HTML5 y React */}
      <form onSubmit={createNew}>
        {/* Campo para el nombre o título descriptivo de la sesión */}
        <Input
          label="nombre"
          name="nombre"
          value={nombre}
          type="text"
          onChange={(e) => setNombre(e.target.value)}
          required
        />

        {/* FEEDBACK CLASE 19: Datalist con sugerencias de materias para evitar errores ortográficos y duplicados */}
        <div className="mb-3">
          <label htmlFor="materia" className="form-label fw-semibold">
            Materia
          </label>
          <input
            id="materia"
            list="materias-sugeridas"
            className="form-control"
            name="materia"
            value={materia}
            onChange={(e) => setMateria(e.target.value)}
            placeholder="Selecciona o escribe la materia"
            required
          />
          {/* Lista de opciones predefinidas para autocompletado rápido */}
          <datalist id="materias-sugeridas">
            <option value="Interacción Hombre-Computador" />
            <option value="Programación Web" />
            <option value="Base de Datos" />
            <option value="Estructuras de Datos" />
            <option value="Cálculo I" />
            <option value="Física I" />
            <option value="Inteligencia Artificial" />
          </datalist>
        </div>

        {/* Selector de modalidad de estudio (Presencial o Virtual) */}
        <div className="mb-3">
          <label htmlFor="modalidad" className="form-label fw-semibold">
            Modalidad
          </label>
          <select
            id="modalidad"
            className="form-select"
            value={modalidad}
            onChange={(e) => setModalidad(e.target.value)}
          >
            <option value="presencial">Presencial</option>
            <option value="virtual">Virtual</option>
          </select>
        </div>

        {/* Campo numérico para el cupo máximo de estudiantes */}
        <Input
          label="cupo"
          name="cupo"
          value={cupo}
          type="number"
          min="1"
          step="1"
          onChange={(e) => setCupo(e.target.value)}
          required
        />

        {/* Selector de fecha programada para la sesión */}
        <Input
          label="fecha"
          name="fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
        />

        {/* Botón principal de acción: Crear sesión (con texto exacto para compatibilidad E2E) */}
        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-100 mt-2 py-2 fw-semibold shadow-sm"
        >
          {loading ? "Creando sesión..." : "Crear sesión"}
        </button>

        {/* FEEDBACK CLASE 19: Botón explícito Cancelar para escapar del formulario y enlace a Ver sesiones */}
        <div className="d-flex gap-2 mt-3">
          {/* Botón Cancelar que retorna a la lista de sesiones */}
          <Link to="/sesions" className="btn btn-outline-secondary w-50 py-2">
            Cancelar
          </Link>
          {/* Enlace alternativo para explorar sesiones existentes */}
          <Link to="/sesions" className="btn btn-link w-50 text-decoration-none py-2">
            Ver sesiones
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
