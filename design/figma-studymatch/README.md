# StudyMatch — Diseño en Figma

## Archivo vigente (actualizado el 2026-11-17)

Archivo: https://www.figma.com/design/Rgr5SlD3oZ6f5vDdbbPRO8

- **🧩 Fundamentos y componentes:** 52 variables tomadas de `frontend/src/index.css` (colores, espaciados y radios), 9 estilos de texto en Plus Jakarta Sans (24 / 18 / 14 / 13px) y una sombra de card. Componentes: Button (Primary, Secondary y Danger × Default, Hover y Pressed × Default y Small, con prototipo de hover y clic), Badge (8 tonos), Campo, NavLink, BotónIcono y Navbar (escritorio y móvil, usuario e invitado, menú abierto). Incluye la guía de especificaciones.
- **📱 Pantallas (según código):** las 11 páginas de `frontend/src` en escritorio (1280px) y móvil (390px), más el menú hamburguesa abierto y una prueba de auto-layout a 820px. Todo está armado con auto-layout: el alto se ajusta al contenido, los contenedores usan FILL y las grillas usan Wrap con ancho mínimo, como `col-md-6` y `col-lg-4`.
- **🗄️ Diseño anterior (v1):** las pantallas previas, conservadas solo como referencia.

---

## Historial: versión anterior (2026-10-08)

La edición remota volvió a funcionar en el archivo original. Se completaron las pantallas y la biblioteca; no hace falta ejecutar el plugin local.

- [01 · Pantallas](https://www.figma.com/design/2Ju6RqrBC5he2dLX2AVRoR?node-id=22-2): 21 frames editables, ocho vistas principales en escritorio y móvil y cinco estados adicionales de acceso.
- [02 · Componentes](https://www.figma.com/design/2Ju6RqrBC5he2dLX2AVRoR?node-id=21-428): catálogo de instancias y componentes principales separados. Incluye Button, Input, Alert, Badge, Feature, Profile row, Link, Loading, AuthCard, Navbar, HeroCard, DashboardCard y AccessForm.
- Se reutilizan 56 variables, 15 estilos de texto y un estilo de sombra. Hay 55 variantes/componentes en 13 familias.
- Se usa Auto Layout horizontal/vertical, Wrap en acciones del inicio, Fill/Hug, límites de ancho y constraints STRETCH en el flujo de cada pantalla.

Las vistas representan el código actual, incluyendo NewStudy (/new-study) con nombre, modalidad y cupo, botón Enviar y enlace desde el panel. Se conserva la ortografía de los textos del código. Nombre, correo y código de recuperación son datos de ejemplo.

## Validación

Se verificaron las 21 pantallas: contienen texto editable e instancias, sin imágenes del UI completo, textos de altura insuficiente ni desbordamientos detectados. Las capturas revisadas incluyen inicio de escritorio y móvil, login móvil, recuperación móvil, panel móvil, nueva sesión móvil y catálogo. Se corrigieron la insignia Ruta privada, separación de pies de formulario, altura de títulos de AuthCard y valores de títulos/subtítulos por variante.

Se comparó el inicio con una captura de la aplicación local. **Noto Sans es la diferencia tipográfica autorizada**; la aplicación mantiene la pila de fuentes de Bootstrap. Puede cambiar el ancho de texto y los saltos de línea, por lo que no se certifica identidad píxel a píxel. Esto no valida el funcionamiento del backend ni los flujos de autenticación.

La captura temporal en Figma se retiró. También se retiró el script temporal de frontend/index.html, que quedó sin diferencias respecto de su versión previa. Se detuvo el servidor Vite iniciado para la revisión.

## Archivos de seguimiento

- state.json: estado y punto de continuación.
- components-report.json: IDs retornados durante la construcción de biblioteca.
- screens-report.json: IDs de las pantallas y estructura inicial. Los ajustes finales están registrados en state.json; algunas dimensiones iniciales pueden diferir tras las correcciones.
- code.js, manifest.json, configurar.ps1: generador local de respaldo, no ejecutado. El manifest conserva un marcador de ID y requiere un ID generado por Figma para importarlo. El generador se detiene si encuentra AccessForm existente; no se debe ejecutar sobre el diseño actual.

Archivo destino: https://www.figma.com/design/2Ju6RqrBC5he2dLX2AVRoR
