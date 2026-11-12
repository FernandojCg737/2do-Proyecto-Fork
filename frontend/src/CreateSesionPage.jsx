import { useEffect, useState } from "react";
import { Alert, AuthCard, Input } from "./Components";
import { Link } from "react-router-dom";
import { apiRequest } from "./api";
import { track } from "./analitica";

export default function CreateSesionPage() {
  const [nombre, setNombre] = useState("");
  const [materia, setMateria] = useState("");
  const [modalidad, setModalidad] = useState("presencial");
  const [cupo, setCupo] = useState(1);
  const [fecha, setFecha] = useState("");
  // FEEDBACK CLASE 19: Las inscripciones nacen abiertas por defecto (true) sin necesidad de selector redundante
  const [inscripciones] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // TAREA 9 (PARTE A): Registra inicio del flujo de creación en el embudo
  useEffect(() => {
    track("sesion_creacion_iniciada", { origen: "formulario_nueva_sesion" });
  }, []);

  async function createNew(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      // pantalla: al tocar «Crear sesion» 1
      const data = await apiRequest("/guardar-nuevo", { // 2
        method: "POST",
        body: JSON.stringify({ nombre, materia, modalidad, cupo, fecha, inscripciones }),
      });

      // solo llega aquí si se guardó con éxito en el backend (Diapositiva 7/13)
      track("sesion_creada", { // 3
        materia: (materia || "general").toLowerCase(),
        modalidad: modalidad.toLowerCase(),
      });

      setMessage(data.mensaje);
      setNombre("");
      setMateria("");
      setModalidad("presencial");
      setCupo(1);
      setFecha("");
    } catch (err) {
      // TAREA 9 (PARTE A): Error que frena la tarea (Diapositiva 11/13)
      track("sesion_creacion_fallida", {
        motivo: "error_validacion_o_servidor",
      });
      setError(err.message);
    }
  }

  return (
    <AuthCard title="Nueva sesion de estudio">
      {error && <Alert type="danger" text={error} />}
      {message && <Alert type="success" text={message} />}

      <form onSubmit={createNew}>
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
          <label htmlFor="materia" className="form-label fw-semibold">Materia</label>
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
          <label htmlFor="modalidad" className="form-label fw-semibold">Modalidad</label>
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

        {/* FEEDBACK CLASE 19: Se eliminó el selector redundante de inscripciones abiertas/cerradas */}

        <button className="btn btn-primary w-100">Crear sesión</button>

        {/* FEEDBACK CLASE 19: Se ofrece botón explícito Cancelar para escapar del formulario y enlace a Ver sesiones */}
        <div className="d-flex gap-2 mt-2">
          <Link to="/sesions" className="btn btn-outline-secondary w-50">
            Cancelar
          </Link>
          <Link to="/sesions" className="btn btn-link w-50">
            Ver sesiones
          </Link>
        </div>
      </form>
    </AuthCard>
  );
}
