# StudyMatch

Aplicación web académica para **encontrar compañeros y sesiones de estudio**. Los estudiantes pueden crear sesiones, postularse a las de otros, gestionar listas de espera, registrar asistencia y descargar o eliminar sus datos sin trampas.

Proyecto 2 de **Interacción Hombre-Computador**. Este repositorio es un fork de [BrayanG123/proyecto_2_IHC](https://github.com/BrayanG123/proyecto_2_IHC).

---

## App en la nube

| | Enlace |
| --- | --- |
| **Aplicación** (frontend en Vercel) | **https://2do-proyecto-fork.vercel.app** |
| API (backend en Render, contenedor Docker) | https://studymatch-api-f592.onrender.com/docs |
| Base de datos | PostgreSQL 16 administrado en Render (red interna; no es pública) |

Entra con un [usuario de prueba](#usuarios-de-prueba): por ejemplo `fernando.calani@studymatch.com` / `Password123!`.

> El backend usa el plan gratis de Render: si estuvo más de 15 minutos sin uso, la primera petición puede tardar hasta un minuto mientras se activa.

**Cómo está desplegado:** Vercel compila `frontend/` (`npm run build`) con la variable `VITE_API_URL` que apunta al backend. Render construye la imagen de [`backend/Dockerfile`](backend/Dockerfile), que arranca con [`backend/start.sh`](backend/start.sh): carga los datos de prueba si la base está vacía y levanta la API en el puerto `PORT`. Las variables del backend son `DATABASE_URL`, `SECRET_KEY`, `ALGORITHM`, `TOKEN_EXPIRE_HOURS` y `ALLOWED_ORIGINS` (con el dominio de Vercel).

---

## Enlaces

| Recurso | Enlace |
| --- | --- |
| **App en la nube** | https://2do-proyecto-fork.vercel.app |
| Figma · **Sistema de diseño** (logo, paleta, tipografía, tokens en modo claro y oscuro, 12 componentes con variantes y estados) | [🧩 Fundamentos y componentes](https://www.figma.com/design/Rgr5SlD3oZ6f5vDdbbPRO8/StudyMatch---Dise%C3%B1os-Oficiales-IHC?node-id=57-251) |
| Figma · **Pantallas** armadas con los componentes (escritorio, móvil y tema oscuro) | [📱 Pantallas (según código)](https://www.figma.com/design/Rgr5SlD3oZ6f5vDdbbPRO8/StudyMatch---Dise%C3%B1os-Oficiales-IHC?node-id=57-252) |
| Repositorio original | https://github.com/BrayanG123/proyecto_2_IHC |
| **Accesibilidad**: reporte de Lighthouse interpretado y corregido (promedio 94,8 → **100**) y contraste AA comprobado | [docs/accesibilidad.md](docs/accesibilidad.md) · [reportes de Lighthouse](docs/accesibilidad/lighthouse/) |
| Evaluación heurística | [docs/evaluacion-heuristicas.md](docs/evaluacion-heuristicas.md) |
| Decisiones de interacción | [docs/decisiones-interaccion.md](docs/decisiones-interaccion.md) |
| Tablas de hallazgos | [docs/tabla_de_hallazgos.md](docs/tabla_de_hallazgos.md) · [docs/clase_16_tabla_de_hallazgos.md](docs/clase_16_tabla_de_hallazgos.md) |
| Ficha del proyecto | [docs/project-card.md](docs/project-card.md) |
| Notas del diseño en Figma | [design/figma-studymatch/README.md](design/figma-studymatch/README.md) |
| Feedback a otro proyecto (clase 19) | [clase-19-feedback-a-otro-proyecto/calani/](clase-19-feedback-a-otro-proyecto/calani/) |

### Evidencias por entrega

| Entrega | Documento |
| --- | --- |
| Clase 17 | [evidencias/clase-17.md](evidencias/clase-17.md) |
| Tarea 6 · Lista de espera | [evidencias/tarea-6.md](evidencias/tarea-6.md) |
| Tarea 7 · Reprogramación | [evidencias/tarea-7.md](evidencias/tarea-7.md) |
| Tarea 8 · Asistencia y justificaciones | [evidencias/tarea-8.md](evidencias/tarea-8.md) |
| Tarea 9 · Cancelar sesión y analítica | [evidencias/tarea-9.md](evidencias/tarea-9.md) |
| Clase 20 · Arquitectura de información | [evidencias/clase-20.md](evidencias/clase-20.md) |
| Clase 21 · Analítica de interacción | [evidencias/clase-21.md](evidencias/clase-21.md) |
| Clase 22 · Patrones oscuros | [evidencias/clase-22.md](evidencias/clase-22.md) |
| Tarea 10 · Mis datos y salida honesta | [evidencias/tarea-10.md](evidencias/tarea-10.md) |
| Clase 23 · Inventario y tokens | [evidencias/clase-23.md](evidencias/clase-23.md) |

---

## Funcionalidades

- **Cuenta:** registro, inicio y cierre de sesión con JWT, y sesión conservada al recargar. La recuperación de contraseña usa un código simulado que se muestra en pantalla, sin correos reales.
- **Sesiones de estudio:** crear sesiones con nombre, materia (con sugerencias), modalidad, cupo y fecha. Buscar por nombre y filtrar por materia, modalidad, fecha y disponibilidad; los filtros se guardan en la URL.
- **Solicitudes:** postularse a una sesión, y el organizador acepta o rechaza.
- **Lista de espera** (FIFO): si la sesión está llena se entra en espera, y al liberarse un cupo asciende el primero.
- **Reprogramación** con motivo: los participantes deben reconfirmar.
- **Asistencia y justificaciones:** el organizador marca presente o ausente, el ausente justifica y el organizador resuelve con un motivo.
- **Cancelar sesión** con motivo obligatorio, visible para todos los participantes.
- **Analítica** (`/analitica`): eventos de interacción, embudos de conversión y el paso con mayor caída.
- **Mis datos y salida honesta** (`/mis-datos`): ver la información guardada, descargarla en JSON o CSV, cambiar la contraseña y eliminar la cuenta sin patrones oscuros.
- **Interfaz responsiva:** navbar en una fila en escritorio y menú hamburguesa en móvil.

## Tecnologías

- **Frontend:** React, Vite, React Router y Bootstrap 5.
- **Backend:** FastAPI, SQLAlchemy, JWT (python-jose) y bcrypt.
- **Base de datos:** PostgreSQL 16 en Docker. Sin Docker se usa SQLite automáticamente.
- **Pruebas:** `unittest` en el backend y Playwright con axe-core (accesibilidad) para pruebas E2E.

---

## Sistema de diseño en el código (tokens)

El código usa **los mismos tokens que Figma**, con los mismos nombres:

| Pieza | Dónde |
| --- | --- |
| Definición de los tokens (el **único** archivo con valores) | [`frontend/src/tokens.css`](frontend/src/tokens.css): 69 tokens generados desde las variables de Figma. Modo Claro en `:root` y Oscuro en `[data-tema="oscuro"]` |
| Variables en Figma | [🧩 Fundamentos y componentes](https://www.figma.com/design/Rgr5SlD3oZ6f5vDdbbPRO8/StudyMatch---Dise%C3%B1os-Oficiales-IHC?node-id=57-251), colección «Tokens StudyMatch» (modos Claro y Oscuro) |
| Estilos de los componentes | [`frontend/src/index.css`](frontend/src/index.css), que solo usa `var(--token)`; las transparencias salen del token con `color-mix()` |

Los tokens se nombran **por uso, no por apariencia**. Por ejemplo, la variable de Figma `color-accion` es `var(--color-accion)` en el código:

| Grupo | Tokens (ejemplos) |
| --- | --- |
| Color | `color-accion`, `color-accion-hover`, `color-texto`, `color-texto-secundario`, `color-texto-sobre-color`, `color-error`, `color-exito`, `color-advertencia`, `color-info`, `color-fondo`, `color-superficie`, `color-borde`, `color-fondo-modal`, `color-sombra` |
| Espaciado (escala de 4px) | `espacio-1` (4px), `espacio-2` (8px), `espacio-4` (16px), `espacio-6` (24px)… |
| Radios | `radio-pequeno` (6px), `radio-control` (8px), `radio-alerta` (10px), `radio-tarjeta` (12px) |
| Tamaño de texto | `texto-titulo` (24px), `texto-subtitulo` (18px), `texto-cuerpo` (14px), `texto-detalle` (13px) |

**Sin colores fijos.** Fuera de `tokens.css` no hay ningún color escrito a mano. Se comprueba con este comando, que no debe mostrar nada:

```bash
git grep -nE "#[0-9a-fA-F]{3,8}\b|rgba?\(" -- frontend/src ":!frontend/src/tokens.css"
```

Antes había 66 colores fijos (ver [evidencias/clase-23.md](evidencias/clase-23.md)).

### Tabla componente ↔ archivo

| Componente en Figma | Archivo en el código | Clase o elemento |
| --- | --- | --- |
| **Button** (Primario, Secundario, Peligro × Normal, Hover, Presionado, Foco, Deshabilitado, Cargando) | [index.css:130](frontend/src/index.css#L130) · [index.css:161](frontend/src/index.css#L161) · [index.css:211](frontend/src/index.css#L211) | `.btn`, `.btn-primary`, `.btn-outline-secondary`, `.btn-outline-danger`, `.btn-sm`. Se usa en las 11 pantallas (94 botones, ver el [anexo de la clase 23](evidencias/clase-23.md#anexo--los-94-botones-de-la-app)) |
| **Campo** (Default, Foco, Error, Deshabilitado) | [Components.jsx:40](frontend/src/Components.jsx#L40) · [index.css:221](frontend/src/index.css#L221) | Componente `Input` y `.form-control` / `.form-select` |
| **Alerta** (Éxito, Error, Advertencia, Info) | [Components.jsx:76](frontend/src/Components.jsx#L76) · [index.css:288](frontend/src/index.css#L288) | Componente `Alert` y `.alert-*` |
| **Badge** (8 tonos) | [index.css:250](frontend/src/index.css#L250) · por ejemplo, [Dashboard.jsx:211](frontend/src/Dashboard.jsx#L211) | `.badge.bg-*` |
| **Checkbox** | [SesionsPage.jsx:463](frontend/src/SesionsPage.jsx#L463) | `<input type="checkbox">` «Solo sesiones a las que puedo unirme» |
| **Chip de filtro** | [SesionsPage.jsx:479](frontend/src/SesionsPage.jsx#L479) | `.badge.bg-secondary` + `.btn-close-white` |
| **Enlace** | [index.css:64](frontend/src/index.css#L64) · por ejemplo, [Auth.jsx:124](frontend/src/Auth.jsx#L124) | `<Link>` / `a` / `.btn-link` |
| **Tarjeta de métrica** (Normal, Destacada, Advertencia) | [AnaliticaPage.jsx:91](frontend/src/AnaliticaPage.jsx#L91) | Tarjetas de `/analitica` |
| **Navbar responsivo** (usuario / invitado, menú abierto / cerrado) | [Layout.jsx:64](frontend/src/Layout.jsx#L64) · [index.css:77](frontend/src/index.css#L77) | `<nav>` y `.navbar.bg-dark` |
| **NavLink** (Default, Hover, Presionado, Activo, Activo móvil) | [Layout.jsx:131](frontend/src/Layout.jsx#L131) · [Layout.jsx:227](frontend/src/Layout.jsx#L227) · [index.css:94](frontend/src/index.css#L94) | Enlaces del navbar y del menú móvil, `.nav-link-btn` |
| **BotónIcono** (🔍 ☰ ✕) | [Layout.jsx:94](frontend/src/Layout.jsx#L94) · [Layout.jsx:107](frontend/src/Layout.jsx#L107) | Lupa y botón del menú hamburguesa |
| **Logo** | [Layout.jsx:71](frontend/src/Layout.jsx#L71) | `.navbar-brand` («📚 StudyMatch») |
| Tarjeta (estilo base, no es un componente aparte en Figma) | [Components.jsx:15](frontend/src/Components.jsx#L15) · [index.css:106](frontend/src/index.css#L106) | `AuthCard` y `.card` |

---

## Requisitos previos

| Herramienta | Versión verificada | Necesaria para |
| --- | --- | --- |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | 29.4 | Opción A (Docker) |
| [Python](https://www.python.org/) | 3.12 | Opción B y pruebas del backend |
| [Node.js](https://nodejs.org/) (incluye npm) | 24.15 | Opción B |
| [pnpm](https://pnpm.io/installation) | 12.16 | Pruebas E2E |
| Git | — | Clonar el repositorio |

```bash
git clone https://github.com/FernandojCg737/2do-Proyecto-Fork.git
cd 2do-Proyecto-Fork
```

---

## Opción A: ejecutar con Docker (recomendado)

Levanta la base de datos PostgreSQL, el backend y el frontend con un solo comando. Docker Desktop debe estar abierto.

```bash
docker compose up -d --build
```

| Servicio | URL |
| --- | --- |
| Aplicación | http://localhost:5173 |
| API | http://127.0.0.1:8000 |
| Documentación de la API | http://127.0.0.1:8000/docs |
| PostgreSQL (desde tu máquina) | `localhost:5434` · base `studymatch` · usuario `postgres` · contraseña `studymatch123` |

La primera vez, el backend carga automáticamente los [usuarios de prueba](#usuarios-de-prueba). Los datos se guardan en `database/pgdata` y se conservan entre reinicios.

```bash
docker compose stop                                   # detener
docker compose up -d                                  # volver a iniciar
docker compose exec backend python seed_data.py --force   # restablecer los datos de prueba
```

## Opción B: ejecutar sin Docker

Si PostgreSQL no está disponible, el backend usa SQLite automáticamente en `database/studymatch.db`. No hace falta configurar nada.

### 1. Backend (terminal 1)

**Windows (PowerShell):**

```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python seed_data.py
uvicorn main:app --reload
```

**Linux / macOS:**

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python seed_data.py
uvicorn main:app --reload
```

`python seed_data.py` crea los usuarios y sesiones de prueba. Si la base ya tiene datos, no los borra; para reiniciarlos usa `python seed_data.py --force`.

La API queda en http://127.0.0.1:8000 y su documentación en http://127.0.0.1:8000/docs.

### 2. Frontend (terminal 2)

```bash
cd frontend
npm install
npm run dev
```

La aplicación queda en http://localhost:5173.

> En Windows también puedes usar `backend\start_backend.bat` y `frontend\start_frontend.bat`. Estos scripts no ejecutan `seed_data.py`, así que corre ese paso una vez antes.

---

## Usuarios de prueba

Todos tienen la contraseña **`Password123!`**.

| Nombre | Email |
| --- | --- |
| Fernando Calani | fernando.calani@studymatch.com |
| Carlos Mendoza | carlos.mendoza@studymatch.com |
| Ana Torres | ana.torres@studymatch.com |
| Brayan Gonzales | brayan.gonzales@studymatch.com |
| Lucia Paredes | lucia.paredes@studymatch.com |

## Recorrido rápido

1. Entra a http://localhost:5173 e inicia sesión con `fernando.calani@studymatch.com` / `Password123!`.
2. En **🔍 Buscar sesiones**, filtra por materia o fecha y pulsa **Solicitar unirme** en una sesión.
3. En **+ Crear sesión**, crea una nueva sesión de estudio.
4. Cierra sesión y entra con otro usuario (por ejemplo `ana.torres@studymatch.com`) para postularte a la sesión del primero.
5. Vuelve al primer usuario. En **👑 Mis sesiones** acepta o rechaza la solicitud y toma asistencia. En **🔍 Buscar sesiones**, desde la tarjeta de tu sesión, puedes reprogramarla o cancelarla con un motivo.
6. Revisa **📋 Historial**, **📊 Analítica** y **🔒 Mis datos** (descarga JSON o CSV, o elimina la cuenta).
7. Reduce el ancho de la ventana para ver el menú hamburguesa.

---

## Pruebas

### Backend (unitarias e integración)

Desde `backend`, con el entorno virtual activado:

```bash
python -m unittest discover -s tests -t . -v
```

Las pruebas usan bases de datos aisladas y no modifican tus datos.

### E2E con Playwright

Requisitos: backend en el puerto 8000 y frontend en el 5173 en ejecución, con los usuarios de prueba cargados (Opción A u Opción B). Desde la **raíz** del repositorio:

```bash
pnpm install
pnpm exec playwright install chromium
pnpm exec playwright test
pnpm exec playwright show-report   # informe HTML
```

> Usa `pnpm exec` y no `npx`: el `package.json` de la raíz exige pnpm (`devEngines`), y `npx` termina con el error `EBADDEVENGINES`.

Las pruebas E2E crean usuarios y sesiones nuevos en la base de datos que esté usando el backend. Algunas también regeneran capturas dentro de `evidencias/`; si no quieres modificarlas, restáuralas después con `git checkout -- evidencias/`.

Solo la auditoría de accesibilidad (WCAG 2.1 AA en las 11 pantallas, en escritorio y móvil):

```bash
pnpm exec playwright test tests/accesibilidad_wcag_aa.spec.ts
```

---

## Verificación de estas instrucciones

Verificado el **17/11/2026** en Windows 11 con Python 3.12.10, Node.js 24.15.0, npm 11.12.1, pnpm 12.16.1 y Docker 29.4.2:

| Paso | Resultado |
| --- | --- |
| Opción B en una copia recién clonada (instalación, `seed_data.py`, backend y frontend) | ✅ |
| `npm run build` del frontend | ✅ |
| Pruebas del backend | ✅ 49 de 49 |
| Pruebas E2E con Playwright | ✅ 30 de 30 (34 de 34 desde el 18/11, con las pruebas de accesibilidad WCAG 2.1 AA) |
| Accesibilidad (18/11/2026): Lighthouse en las 11 pantallas y axe en 22 vistas (escritorio y móvil) | ✅ 100 en todas · 0 problemas ([docs/accesibilidad.md](docs/accesibilidad.md)) |
| Opción A, `docker compose up -d --build` (API, frontend e inicio de sesión con usuario de prueba) | ✅ |
| Despliegue en la nube (18/11/2026): CORS desde Vercel, inicio de sesión, datos de prueba en la BD y rutas `/`, `/login`, `/dashboard` y `/sesions` | ✅ |

Los comandos de Linux/macOS son equivalentes, pero no se probaron en esos sistemas.

---

## Estructura del proyecto

```
backend/            API FastAPI
  app/              rutas (routes.py), lógica (repositorio.py, services.py), modelos y analítica
  tests/            pruebas unitarias e integración
  seed_data.py      datos de prueba
frontend/           aplicación React + Vite
  src/              páginas (Dashboard, SesionsPage, HistorialPage, AnaliticaPage, MisDatosPage, …)
tests/              pruebas E2E de Playwright
database/           datos persistentes (PostgreSQL en pgdata/ o SQLite)
design/             notas del diseño en Figma
docs/               evaluación heurística, decisiones de interacción y hallazgos
evidencias/         evidencias de cada tarea y clase
docker-compose.yml  base de datos + backend + frontend
```
