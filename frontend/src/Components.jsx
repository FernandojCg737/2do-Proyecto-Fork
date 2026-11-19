import React, { useId } from "react";

export function AuthCard({ title, subtitle, children }) {
  return (

    <div className="row justify-content-center align-items-center" style={{ minHeight: "75vh" }}>

      <div className="col-12 col-sm-10 col-md-7 col-lg-5 col-xl-4 my-3">
        <div className="card border-0 shadow-sm auth-card">
          <div className="card-body p-4 p-md-5">

            <h1 className="h3 fw-bold mb-1">{title}</h1>
            {/* Subtítulo explicativo opcional */}
            {subtitle && <p className="text-secondary small mb-4">{subtitle}</p>}

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Input({ label, name, id, onFocus, ...props }) {

  const idGenerado = useId();
  const inputId = id || name || idGenerado;

  const handleFocus = (event) => {
    if (typeof window !== "undefined" && window.innerWidth <= 768) {
      setTimeout(() => {
        event.target.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 300);
    }

    onFocus?.(event);
  };

  return (
    <div className="mb-3">

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
