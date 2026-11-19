import { useState } from "react";
import { Alert, AuthCard, Input } from "./Components";
import { Link } from "react-router-dom";
import { apiRequest } from "./api";

export default function Recover() {
  const [email, setEmail] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function requestCode(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const data = await apiRequest("/recuperar-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      });

      setCodigo(data.codigo);
      setCodeSent(true);
      setMessage(`Código simulado: ${data.codigo}`);

    } catch (err) {
      setError(err.message);
    }
  }

  async function changePassword(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const data = await apiRequest("/cambiar-password", {
        method: "POST",
        body: JSON.stringify({ 
            email, 
            codigo, 
            nueva_password: nuevaPassword 
        }),
      });

      setMessage(`${data.mensaje} Ya puedes iniciar sesión con tu nueva contraseña.`);
      setCodeSent(false);
      setCodigo("");
      setNuevaPassword("");

    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <AuthCard 
        title="Recuperar contraseña" 
        subtitle="No se envía un correo real: el código se muestra en pantalla para la demostración."
    >
      {error && <Alert type="danger" text={error} />}
      {message && <Alert type="success" text={message} />}

      {!codeSent ? (
        <form onSubmit={requestCode}>
            <Input 
                label="Correo electrónico" 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                required 
            />
            <button className="btn btn-primary w-100">
                Generar código
            </button>
        </form>

      ) : (
        <form onSubmit={changePassword}>
            <Input 
                label="Código de recuperación" 
                value={codigo} 
                onChange={(e) => setCodigo(e.target.value)} 
                required 
            />

            <Input 
                label="Nueva contraseña" 
                type="password" 
                value={nuevaPassword} 
                onChange={(e) => setNuevaPassword(e.target.value)} 
                required 
            />

            <button className="btn btn-primary w-100">
                Cambiar contraseña
            </button>
        </form>
      )}

      <p className="text-center mt-3 mb-0">
        <Link to="/login">
            Volver al inicio de sesión
        </Link>
      </p>
    </AuthCard>
  );
}