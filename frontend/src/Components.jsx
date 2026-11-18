import React, { useId } from "react";

/**
 * ============================================================================
 * COMPONENTE AUTHCARD (Tarjeta Contenedora para Formularios)
 * ============================================================================
 * Utilizada en /login, /register, /recover y /new-study.
 * 
 * Principios aplicados de IHC:
 * 1. Centrado Óptimo (Vertical y Horizontal): Mediante `min-vh-75` y flexbox,
 *    el formulario se ubica en el centro de atención visual natural del usuario.
 * 2. Adaptación a Teclado Móvil: Permite scroll fluido y reposicionamiento
 *    automático cuando el teclado virtual del celular se activa.
 */
export function AuthCard({ title, subtitle, children }) {
  return (
    // Fila con alineación centrada tanto horizontal (justify-content-center) como vertical (align-items-center)
    <div className="row justify-content-center align-items-center" style={{ minHeight: "75vh" }}>
      {/* Columna responsiva: ocupa todo el ancho en móvil (col-12) y se ajusta proporcionalmente en pantallas mayores */}
      <div className="col-12 col-sm-10 col-md-7 col-lg-5 col-xl-4 my-3">
        <div className="card border-0 shadow-sm auth-card">
          <div className="card-body p-4 p-md-5">
            {/* Título principal del formulario */}
            <h1 className="h3 fw-bold mb-1">{title}</h1>
            {/* Subtítulo explicativo opcional */}
            {subtitle && <p className="text-secondary small mb-4">{subtitle}</p>}
            {/* Contenido inyectado (inputs, botones, alertas) */}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Componente Input reutilizable con etiqueta accesible y vinculación htmlFor -> id.
 * Soporta auto-desplazamiento vertical cuando el usuario pulsa en móvil y se abre el teclado.
 */
export function Input({ label, name, id, onFocus, ...props }) {
  // Accesibilidad (WCAG 1.3.1 / 4.1.2): todo campo necesita un id para que su <label> lo nombre.
  // Si no llega ni id ni name (p. ej. en Recuperar contraseña), React genera uno único.
  const idGenerado = useId();
  const inputId = id || name || idGenerado;
  /**
   * Manejador de foco adaptado para dispositivos móviles (IHC - Visibilidad y Control):
   * Al pulsar el input o su etiqueta en celulares, aguarda 300ms a que el teclado
   * virtual se despliegue y centra suavemente el campo en la ventana visible.
   */
  const handleFocus = (event) => {
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setTimeout(() => {
        event.target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }
    // Respeta un onFocus propio si la pantalla que usa el campo lo define.
    onFocus?.(event);
  };

  return (
    <div className="mb-3">
      {/* Etiqueta asociada semánticamente al campo para accesibilidad WCAG (al tocarla enfoca el input) */}
      <label htmlFor={inputId} className="form-label fw-semibold">{label}</label>
      {/* Campo de entrada con estilos modernos y soporte de autodesplazamiento al enfocar */}
      <input
        id={inputId}
        name={name}
        className="form-control"
        onFocus={handleFocus}
        {...props}
      />
    </div>
  );
}

/**
 * Componente Alert para retroalimentación instantánea (éxito, error, advertencia)
 */
export function Alert({ type, text, tipo, mensaje, onClose }) {
  const alertType = type || tipo || "info";
  const alertText = text || mensaje || "";
  return (
    <div className={`alert alert-${alertType} ${onClose ? "alert-dismissible fade show" : ""}`} role="alert">
      {alertText}
      {onClose && (
        <button type="button" className="btn-close" aria-label="Close" onClick={onClose} />
      )}
    </div>
  );
}

/**
 * Componente Loading para indicar espera activa en operaciones asíncronas
 */
export function Loading() {
  return (
    <div className="d-flex justify-content-center align-items-center py-5">
      <div className="spinner-border text-primary" role="status">
        <span className="visually-hidden">Cargando...</span>
      </div>
    </div>
  );
}
