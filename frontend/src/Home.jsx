// Importación de componentes de navegación de React Router DOM
import { Link } from "react-router-dom";

/**
 * ============================================================================
 * COMPONENTE HOME (Página Principal de Bienvenida - Landing Page)
 * ============================================================================
 * Ruta: http://localhost:5173/
 * 
 * Principios de Diseño e Interacción Humano-Computador (IHC):
 * 1. Centrado Integral Responsivo (Horizontal y Vertical):
 *    Utiliza flexbox (`row justify-content-center align-items-center`) con `minHeight: "75vh"`
 *    para que la tarjeta principal quede suspendida perfectamente en el centro óptico
 *    y de atención del usuario en cualquier resolución (móvil, tablet, laptop y desktop).
 * 2. Adaptación Móvil y Ley de Fitts:
 *    En móviles (`< 576px`), los botones de acción usan `d-grid` ocupando el ancho cómodo
 *    del pulgar para interacción táctil sin errores; en pantallas mayores (`>= 576px`)
 *    se distribuyen en fila fluida (`d-sm-flex justify-content-sm-center`).
 * 3. Estilo Modern Tech:
 *    Botones con esquinas suaves de 8px (sin formato circular de burbuja) y tipografía
 *    balanceada que previene desbordamientos o tamaños excesivos.
 */
export default function Home({ user }) {
  return (
    // Fila flexbox centrada tanto vertical como horizontalmente
    <div
      className="row justify-content-center align-items-center"
      style={{ minHeight: "75vh" }}
    >
      {/* Columna responsiva: adaptable en móvil (col-12), tablet (col-md-10) y escritorio (col-lg-8 col-xl-7) */}
      <div className="col-12 col-sm-11 col-md-10 col-lg-8 col-xl-7 my-3">
        {/* Tarjeta hero con elevación moderna tech y bordes redondeados limpios */}
        <div className="card shadow-sm border-0 hero-card">
          <div className="card-body p-4 p-md-5 text-center">

            {/* Insignia moderna de marca con diseño rectangular refinado */}
            <div className="mb-3">
              <span className="badge bg-primary text-primary px-3 py-2 fs-6">
                📚 StudyMatch
              </span>
            </div>

            {/* Título principal con tamaño responsivo equilibrado */}
            <h1 className="h2 fw-bold text-dark mb-3" style={{ letterSpacing: "-0.02em" }}>
              Encuentra compañeros y sesiones de estudio
            </h1>

            {/* Descripción introductoria clara y legible sin desbordamientos */}
            <p className="text-secondary lead fs-6 mx-auto mb-4" style={{ maxWidth: "560px" }}>
              Una plataforma colaborativa para coordinar grupos académicos, participar en sesiones
              de estudio activas y potenciar tu aprendizaje universitario.
            </p>

            {/* Acciones principales según el estado de autenticación */}
            {user ? (
              // Usuario autenticado: acceso directo a su panel
              <div className="d-grid d-sm-flex justify-content-sm-center mt-4">
                <Link
                  to="/dashboard"
                  className="btn btn-primary px-4 py-2 fw-semibold shadow-sm"
                  style={{ minHeight: "44px" }}
                >
                  🚀 Ir a mi espacio
                </Link>
              </div>
            ) : (
              // Usuario no autenticado: opciones de registro e inicio de sesión
              <div className="d-grid d-sm-flex justify-content-sm-center gap-2 gap-sm-3 mt-4">
                <Link
                  to="/register"
                  className="btn btn-primary px-4 py-2 fw-semibold shadow-sm"
                  style={{ minHeight: "44px" }}
                >
                  ✨ Crear cuenta
                </Link>
                <Link
                  to="/login"
                  className="btn btn-outline-secondary px-4 py-2 fw-semibold shadow-sm"
                  style={{ minHeight: "44px" }}
                >
                  🔑 Iniciar sesión
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
