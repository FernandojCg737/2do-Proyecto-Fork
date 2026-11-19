
import { useEffect, useState } from "react";

import { Alert, AuthCard, Input } from "./Components";

import { Link, useNavigate } from "react-router-dom";

import { apiRequest } from "./api";

import { track } from "./analitica";

export default function CreateSesionPage() {

  const navigate = useNavigate();

  const [nombre, setNombre] = useState("");
  const [materia, setMateria] = useState("");
  const [modalidad, setModalidad] = useState("presencial");
  const [cupo, setCupo] = useState(1);
  const [fecha, setFecha] = useState("");

  const [inscripciones] = useState(true);

  const [message, setMessage] = useState(""); 
  const [error, setError] = useState(""); 
  const [loading, setLoading] = useState(false); 

  useEffect(() => {

    track("sesion_creacion_iniciada", { origen: "formulario_nueva_sesion" });
  }, []); 

  async function createNew(event) {

    event.preventDefault();

    setError("");
    setMessage("");

    setLoading(true);

    try {

      const data = await apiRequest("/guardar-nuevo", {
        method: "POST",
        body: JSON.stringify({ nombre, materia, modalidad, cupo, fecha, inscripciones }),
      });

      track("sesion_creada", {
        materia: (materia || "general").toLowerCase(),
        modalidad: modalidad.toLowerCase(),
      });

      const textoExito = data.mensaje || "Sesión de estudio registrada correctamente";
      setMessage(textoExito);

      setNombre("");
      setMateria("");
      setModalidad("presencial");
      setCupo(1);
      setFecha("");

      setTimeout(() => {
        navigate("/dashboard?tab=mis-sesiones", {
          state: { mensaje: `🎉 ${textoExito}` },
        });
      }, 1200);
    } catch (err) {

      track("sesion_creacion_fallida", {
        motivo: "error_validacion_o_servidor",
      });

      setError(err.message);
    } finally {

      setLoading(false);
    }
  }

  return (

    <AuthCard title="Nueva sesion de estudio">

      {error && <Alert type="danger" text={error} />}

      {/* Alerta de confirmación inmediata tras completar el registro */}
      {message && (
        <Alert
          type="success"
          text={`${message}. Redirigiéndote a tus sesiones...`}
        />
      )}

      <form onSubmit={createNew}>

        <Input
          label="nombre"
          name="nombre"
          value={nombre}
          type="text"
          onChange={(e) => setNombre(e.target.value)}
          required
        />

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

        <Input
          label="fecha"
          name="fecha"
          type="date"
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          required
        />

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
