
import { Link } from "react-router-dom";

export default function Home({ user }) {
  return (

    <div
      className="row justify-content-center align-items-center"
      style={{ minHeight: "75vh" }}
    >

      <div className="col-12 col-sm-11 col-md-10 col-lg-8 col-xl-7 my-3">

        <div className="card shadow-sm border-0 hero-card">
          <div className="card-body p-4 p-md-5 text-center">

            <div className="mb-3">
              <span className="badge bg-primary text-primary px-3 py-2 fs-6">
                📚 StudyMatch
              </span>
            </div>

            <h1 className="h2 fw-bold text-dark mb-3" style={{ letterSpacing: "-0.02em" }}>
              Encuentra compañeros y sesiones de estudio
            </h1>

            {/* Descripción introductoria clara y legible sin desbordamientos */}
            <p className="text-secondary lead fs-6 mx-auto mb-4" style={{ maxWidth: "560px" }}>
              Una plataforma colaborativa para coordinar grupos académicos, participar en sesiones
              de estudio activas y potenciar tu aprendizaje universitario.
            </p>

            {user ? (

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
