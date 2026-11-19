
import { useState } from "react";

import { Link, useLocation, useNavigate } from "react-router-dom";

import { apiRequest, TOKEN_KEY } from "./api";

import { Alert, AuthCard, Input } from "./Components";

export function Login({ onLogin }) {

  const navigate = useNavigate();

  const location = useLocation();

  const [mensajeExito, setMensajeExito] = useState(location.state?.mensaje || "");

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");

  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    setForm({
      ...form, 
      [event.target.name]: event.target.value, 
    });
  }

  async function handleSubmit(event) {

    event.preventDefault();

    setError("");

    setLoading(true);

    try {

      const data = await apiRequest("/login", {
        method: "POST",
        body: JSON.stringify(form),
      });

      localStorage.setItem(TOKEN_KEY, data.token);

      onLogin(data.usuario);

      navigate("/dashboard");
    } catch (err) {

      setError(err.message);
    } finally {

      setLoading(false);
    }
  }

  return (

    <AuthCard
      title="Iniciar sesion"
      subtitle="Ingresa a tu cuenta de studmatch"
    >

      {mensajeExito && <Alert type="success" text={mensajeExito} />}
      {/* Alerta de error si las credenciales fallan */}
      {error && <Alert type="danger" text={error} />}

      <form onSubmit={handleSubmit}>

        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <Input
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          required
        />

        <button
          type="submit"
          className="btn btn-primary w-100 py-2 fw-semibold shadow-sm"
          disabled={loading}
        >
          {loading ? "Ingresando..." : "Iniciar Sesion"}
        </button>
      </form>

      <div className="text-center mt-3">
        <Link to="/recover" className="text-decoration-none small">
          ¿Olvidaste la contraseña?
        </Link>
      </div>

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

  const [form, setForm] = useState({
    nombre: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(event) {
    setForm({
      ...form,
      [event.target.name]: event.target.value,
    });
  }

  async function handleSubmit(event) {

    event.preventDefault();

    setError("");
    setSuccess("");

    setLoading(true);

    try {

      const data = await apiRequest("/registro", {
        method: "POST",
        body: JSON.stringify(form),
      });

      const mensajeConfirmacion = data.mensaje || "Cuenta registrada exitosamente";
      setSuccess(mensajeConfirmacion);

      setTimeout(() => {
        navigate("/login", {
          state: { mensaje: `🎉 ${mensajeConfirmacion}. ¡Ya puedes iniciar sesión!` },
        });
      }, 1200);
    } catch (err) {

      setError(err.message);
    } finally {

      setLoading(false);
    }
  }

  return (

    <AuthCard
      title="Crear cuenta"
      subtitle="Registrate para empezar a usar StudyMatch"
    >

      {error && <Alert type="danger" text={error} />}

      {/* Alerta de confirmación inmediata con notificación de salida */}
      {success && (
        <Alert
          type="success"
          text={`🎉 ${success}. Redirigiéndote al inicio de sesión...`}
        />
      )}

      <form onSubmit={handleSubmit}>

        <Input
          label="Nombre"
          name="nombre"
          type="text"
          value={form.nombre}
          onChange={handleChange}
          required
        />

        <Input
          label="Email"
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          required
        />

        <Input
          label="Password"
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          required
        />

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
