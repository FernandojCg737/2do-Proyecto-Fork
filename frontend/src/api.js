


// URL del backend. En la nube se define con la variable VITE_API_URL (Vercel);
// en local, si no existe, se usa el backend de desarrollo.
export const API_URL = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8000").replace(/\/+$/, "");
export const TOKEN_KEY = "studymatch_token";


export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      headers,
    });
  } catch (err) {
    if (err.name === "AbortError") throw err;
    throw new Error("No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.");
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail = data.detail;
    let message = "";
    if (typeof detail === "string") {
      message = detail;
    } else if (Array.isArray(detail)) {
      message = detail.map((error) => `${error.loc.at(-1)}: ${error.msg}`).join(". ");
    } else if (typeof detail === "object" && detail !== null) {
      message = detail.que_hacer || detail.por_que || detail.mensaje || "Ocurrió un error.";
    } else {
      message = "Ocurrió un error.";
    }

    const err = new Error(message);
    err.data = typeof detail === "object" ? detail : data;
    throw err;
  }

  return data;
}
