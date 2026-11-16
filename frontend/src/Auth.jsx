// Importación de hooks fundamentales de React para el manejo de estado
import { useState } from "react";
// Importación de componentes de enrutamiento para enlaces y navegación programática
import { Link, useLocation, useNavigate } from "react-router-dom";
// Importación de utilidades de cliente HTTP y clave del token de autenticación
import { apiRequest, TOKEN_KEY } from "./api";
// Importación de componentes reutilizables del sistema de diseño
import { Alert, AuthCard, Input } from "./Components";

/**
 * ============================================================================
 * COMPONENTE LOGIN (Inicio de Sesión)
 * ============================================================================
 * Permite a los usuarios autenticarse en StudyMatch.
 * Recibe por props `onLogin` para actualizar el estado global del usuario en la aplicación.
 */
export function Login({ onLogin }) {
  // Hook de navegación de React Router para redirigir tras un inicio de sesión exitoso
  const navigate = useNavigate();
  // Hook de ubicación para recibir mensajes pasados en el estado de navegación (ej. post-registro o post-eliminación)
  const location = useLocation();
  // Estado para desplegar mensajes de éxito informativos recibidos desde otra página
  const [mensajeExito, setMensajeExito] = useState(location.state?.mensaje || "");
  // Estado reactivo que almacena las credenciales introducidas en el formulario
  const [form, setForm] = useState({
    email: "",
    password: "",
  });
  // Estado para capturar y desplegar errores de autenticación
  const [error, setError] = useState("");
  // Estado booleano para indicar si la solicitud de autenticación está en progreso
  const [loading, setLoading] = useState(false);

  /**
   * Manejador genérico de cambio en los campos de entrada:
   * Sincroniza dinámicamente el campo correspondiente en el objeto de estado `form`.
   */
  function handleChange(event) {
    setForm({
      ...form, // Mantiene los valores de los demás campos
      [event.target.name]: event.target.value, // Actualiza la clave cuyo nombre coincida con el input
    });
  }

  /**
   * Manejador de envío del formulario de login:
   * Valida credenciales contra la API FastAPI y almacena la sesión.
   */
  async function handleSubmit(event) {
    // Evita la recarga automática de la página al enviar el formulario
    event.preventDefault();
    // Limpia errores previos antes de iniciar la solicitud
    setError("");
    // Activa el indicador de carga
    setLoading(true);

    try {
      // Envía la petición POST al endpoint de autenticación `/login`
      const data = await apiRequest("/login", {
        method: "POST",
        body: JSON.stringify(form),
      });

      // Guarda el token JWT devuelto en el almacenamiento local del navegador
      localStorage.setItem(TOKEN_KEY, data.token);
      // Notifica al componente padre `App` sobre el usuario autenticado
      onLogin(data.usuario);
      // Redirige al panel principal del usuario
      navigate("/dashboard");
    } catch (err) {
      // En caso de credenciales inválidas o error de servidor, muestra el mensaje
      setError(err.message);
    } finally {
      // Desactiva el indicador de carga al finalizar la operación
      setLoading(false);
    }
  }

  return (
    // Tarjeta contenedora con título y subtítulo explicativo
    <AuthCard
      title="Iniciar sesion"
      subtitle="Ingresa a tu cuenta de studmatch"
    >
      {/* Alerta de éxito si venimos de un registro o acción previa confirmada */}
      {mensajeExito && <Alert type="success" text={mensajeExito} />}
      {/* Alerta de error si las credenciales fallan */}
      {error && <Alert type="danger" text={error} />}

      {/* Formulario con campos de correo y contraseña */}
      <form onSubmit={handleSubmit}>
        {/* Campo de entrada para el correo electrónico del estudiante */}
        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          required
        />

        {/* Campo de entrada para la contraseña protegida */}
        <Input
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          required
        />

        {/* Botón principal de autenticación con estado de carga */}
        <button
          type="submit"
          className="btn btn-primary w-100 py-2 fw-semibold shadow-sm"
          disabled={loading}
        >
          {loading ? "Ingresando..." : "Iniciar Sesion"}
        </button>
      </form>

      {/* Enlace para recuperación de contraseña */}
      <div className="text-center mt-3">
        <Link to="/recover" className="text-decoration-none small">
          ¿Olvidaste la contraseña?
        </Link>
      </div>

      {/* Enlace para cambiar a la pantalla de registro */}
      <p className="text-center text-secondary mt-3 mb-0">
        ¿No tienes cuenta?{" "}
        <Link to="/register" className="fw-semibold text-primary text-decoration-none">
          Regístrate
        </Link>
      </p>
    </AuthCard>
  );
}

/**
 * ============================================================================
 * COMPONENTE REGISTER (Crear cuenta)
 * ============================================================================
 * Permite a nuevos estudiantes registrarse en StudyMatch.
 * Incorpora:
 * - Retroalimentación clara inmediata tras el registro (Nielsen #1).
 * - Salida suave y confirmación visual antes de redirigir a Login.
 * - Botón de escape / cancelación para salir del flujo sin registrarse (Nielsen #3).
 */
export function Register() {
  // Hook para redireccionar al usuario programáticamente
  const navigate = useNavigate();

  // Estado local para los campos del formulario de registro
  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
  });

  // Estados de retroalimentación en la interfaz
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * Sincroniza dinámicamente los campos del formulario con el estado `form`.
   */
  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  /**
   * Envía los datos de registro a la API y realiza la salida confirmada.
   */
  async function handleSubmit(event) {
    // Previene la recarga del navegador
    event.preventDefault();
    // Limpia mensajes anteriores
    setError("");
    setSuccess("");
    // Inicia estado de carga
    setLoading(true);

    try {
      // Envía la petición POST al endpoint `/registro`
      const data = await apiRequest("/registro", {
        method: "POST",
        body: JSON.stringify(form),
      });

      // Muestra confirmación inmediata de éxito en la pantalla actual
      const mensajeConfirmacion = data.mensaje || "Cuenta registrada exitosamente";
      setSuccess(mensajeConfirmacion);

      // Redirección suave y transparente: permite percibir el mensaje positivo por 1.2 segundos
      // y luego redirige a la pantalla de Login con el mensaje preservado en el estado de navegación
      setTimeout(() => {
        navigate("/login", {
          state: { mensaje: `🎉 ${mensajeConfirmacion}. ¡Ya puedes iniciar sesión!` },
        });
      }, 1200);
    } catch (err) {
      // Muestra error devuelto por la API (ej. correo duplicado o contraseña corta)
      setError(err.message);
    } finally {
      // Restablece estado de carga
      setLoading(false);
    }
  }

  return (
    // Tarjeta contenedora con estilo unificado de autenticación
    <AuthCard
      title="Crear cuenta"
      subtitle="Registrate para empezar a usar StudyMatch"
    >
      {/* Alerta de error si falla el registro */}
      {error && <Alert type="danger" text={error} />}

      {/* Alerta de confirmación inmediata con notificación de salida */}
      {success && (
        <Alert
          type="success"
          text={`🎉 ${success}. Redirigiéndote al inicio de sesión...`}
        />
      )}

      {/* Formulario de registro */}
      <form onSubmit={handleSubmit}>
        {/* Campo para el nombre completo del estudiante */}
        <Input
          label="Nombre"
          name="nombre"
          type="text"
          value={form.nombre}
          onChange={handleChange}
          required
        />

        {/* Campo para el correo electrónico institucional o personal */}
        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          required
        />

        {/* Campo para la contraseña segura */}
        <Input
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          required
        />

        {/* Botón principal de acción: Registrarse (Nombre exacto para compatibilidad E2E) */}
        <button
          type="submit"
          className="btn btn-primary w-100 py-2 fw-semibold shadow-sm mt-2"
          disabled={loading}
        >
          {loading ? "Creando cuenta..." : "Registrarse"}
        </button>

        {/* Botón de escape/cancelación para salir del formulario si el usuario se arrepiente */}
        <div className="d-flex gap-2 mt-3">
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="btn btn-outline-secondary w-100 py-2"
          >
            ← Cancelar y volver al inicio
          </button>
        </div>
      </form>

      {/* Enlace inferior de navegación hacia el login */}
      <p className="text-center text-secondary mt-3 mb-0">
        ¿Ya tienes cuenta?{" "}
        <Link to="/login" className="fw-semibold text-primary text-decoration-none">
          Inicia sesion
        </Link>
      </p>
    </AuthCard>
  );
}
