import { apiRequest } from "./api";

// 4. Va a la tabla eventos (guarda en la base de datos de la app)
function guardarEvento(registro) {
  apiRequest("/eventos", {
    method: "POST",
    body: JSON.stringify(registro),
  }).catch((err) => console.warn("Error guardando evento:", err));
}

// // analitica.js (Diapositiva 7/13)
export function track(evento, props) {
  const registro = {
    evento, props, fecha: new Date().toISOString()
  };
  guardarEvento(registro);
  console.log('[evento]', registro);
}
