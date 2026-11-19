import { apiRequest } from "./api";

function guardarEvento(registro) {
  apiRequest("/eventos", {
    method: "POST",
    body: JSON.stringify(registro),
  }).catch((err) => console.warn("Error guardando evento:", err));
}

export function track(evento, props) {
  const registro = {
    evento, props, fecha: new Date().toISOString()
  };
  guardarEvento(registro);
  console.log('[evento]', registro);
}
