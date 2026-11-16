// Importación de Link (mantenido por compatibilidad de tipos si se requiere)
import React from "react";

/**
 * ============================================================================
 * COMPONENTE NAVPILLS (DEPRECADO POR SIMPLIFICACIÓN Y ARQUITECTURA IHC)
 * ============================================================================
 * 
 * Motivo del cambio de diseño:
 * Anteriormente se renderizaba una barra flotante de "pills" secundarias dentro de cada página.
 * Como el encabezado principal (Navbar en escritorio y menú hamburguesa en móvil)
 * ya contiene todas las opciones de navegación (Buscar sesiones, Mis solicitudes, Mis sesiones,
 * Historial, Analítica y Mis datos), la presencia de esta barra creaba redundancia visual
 * y sobrecargaba la pantalla del usuario (Ley de Miller / Carga Cognitiva).
 * 
 * Al retornar `null`, se elimina completamente la tarjeta redundante de todas las pantallas
 * sin romper los componentes que aún la importan.
 */
export default function NavPills() {
  // Retorna null para no pintar la barra redundante en la interfaz
  return null;
}
