
export function formatearFecha(fecha) {
  if (!fecha) return "";
  const partes = String(fecha).split("-");
  if (partes.length === 3) {
    const [anio, mes, dia] = partes;
    return `${dia}/${mes}/${anio}`;
  }
  return String(fecha);
}

export function formatearFechaHora(fechaIso) {
  if (!fechaIso) return "Fecha no registrada";
  let str = String(fechaIso).trim();

  if (!str.endsWith("Z") && !str.includes("+") && !str.slice(10).includes("-")) {
    str = str + "Z";
  }
  const fecha = new Date(str);

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
