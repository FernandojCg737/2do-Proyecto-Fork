// Formatos de fecha compartidos por las pantallas de StudyMatch.
// Antes cada pantalla tenía su propia copia de estas funciones; ahora hay una sola,
// así un cambio de formato se hace en un único lugar.

/**
 * Fecha de calendario "2026-11-05" -> "05/11/2026".
 * Si el valor no tiene ese formato, se muestra tal cual.
 */
export function formatearFecha(fecha) {
  if (!fecha) return "";
  const partes = String(fecha).split("-");
  if (partes.length === 3) {
    const [anio, mes, dia] = partes;
    return `${dia}/${mes}/${anio}`;
  }
  return String(fecha);
}

/**
 * Marca de tiempo ISO -> fecha y hora de Bolivia (America/La_Paz, UTC-4),
 * por ejemplo "05/11/2026, 06:00 a. m.".
 */
export function formatearFechaHora(fechaIso) {
  if (!fechaIso) return "Fecha no registrada";
  let str = String(fechaIso).trim();
  // El backend guarda en UTC. Si la marca no trae zona horaria (Z u offset +/-),
  // se agrega 'Z' para que el navegador la interprete como UTC y reste las 4 horas de Bolivia.
  if (!str.endsWith("Z") && !str.includes("+") && !str.slice(10).includes("-")) {
    str = str + "Z";
  }
  const fecha = new Date(str);
  // Un valor que no es una fecha se muestra tal cual en lugar de «Invalid Date».
  if (Number.isNaN(fecha.getTime())) return String(fechaIso);
  return fecha.toLocaleString("es-BO", {
    timeZone: "America/La_Paz",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}
