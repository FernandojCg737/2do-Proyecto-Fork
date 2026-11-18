import { test, expect } from './fixtures/cobertura';
import type { APIRequestContext, Page, Browser } from '@playwright/test';

/**
 * Casos límite de la interfaz
 * ----------------------------------------------------------------------------
 * Las demás suites recorren los flujos felices. Aquí se comprueba que cada pantalla
 * responde bien cuando algo sale mal o el usuario se arrepiente:
 *  - el servidor devuelve un error (simulado con page.route) → se muestra el mensaje,
 *  - validaciones del cliente (textos demasiado cortos, contraseña vacía),
 *  - cerrar o cancelar modales, quitar filtros, menú móvil,
 *  - datos con fechas en formatos no estándar.
 * Cada prueba crea sus propios usuarios y sesiones por la API, así no depende de otras.
 */

const API = 'http://127.0.0.1:8000';
const CLAVE = 'Clave123!';
type Usuario = { nombre: string; email: string; id: number; token: string };

let contador = 0;
async function crearUsuario(request: APIRequestContext, nombre: string): Promise<Usuario> {
  const sufijo = `${Date.now()}${contador++}${Math.floor(Math.random() * 1000)}`;
  const email = `limite.${sufijo}@prueba.test`;
  const nombreUnico = `${nombre} ${sufijo.slice(-6)}`;
  expect((await request.post(`${API}/registro`, { data: { nombre: nombreUnico, email, password: CLAVE } })).ok()).toBeTruthy();
  const login = await (await request.post(`${API}/login`, { data: { email, password: CLAVE } })).json();
  return { nombre: nombreUnico, email, id: login.usuario.id, token: login.token };
}

async function api(request: APIRequestContext, u: Usuario, ruta: string, data?: unknown) {
  const r = await request.post(`${API}${ruta}`, { headers: { Authorization: `Bearer ${u.token}` }, data });
  expect(r.ok(), await r.text()).toBeTruthy();
  return r.json();
}

async function crearSesion(request: APIRequestContext, org: Usuario, nombre: string) {
  const r = await api(request, org, '/guardar-nuevo', {
    nombre, materia: 'Pruebas', fecha: '2099-03-15', modalidad: 'virtual', cupo: 3, inscripciones: true,
  });
  return r.id as number;
}

async function entrar(page: Page, u: Usuario) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(u.email);
  await page.getByLabel('Password').fill(CLAVE);
  await page.getByRole('button', { name: 'Iniciar Sesion' }).click();
  await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible();
}

async function nuevaPagina(browser: Browser, u: Usuario) {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await entrar(p, u);
  return p;
}

/** Patrón que solo coincide con la API (puerto 8000), nunca con las páginas del frontend. */
const enApi = (ruta: string) => new RegExp(':8000' + ruta + '([?].*)?$');

/**
 * Las próximas `veces` peticiones que coincidan responden con error; las siguientes llegan al
 * servidor real. Las cargas GET usan 2: en desarrollo React (StrictMode) ejecuta dos veces
 * los efectos de carga y descarta la primera respuesta.
 */
async function fallarUnaVez(page: Page, ruta: string, metodo = 'POST', status = 400, cuerpo: string | object = { detail: 'Error simulado del servidor' }, veces = metodo === 'GET' ? 2 : 1) {
  let restantes = veces;
  await page.route(enApi(ruta), async (route) => {
    if (restantes <= 0 || route.request().method() !== metodo) return route.fallback();
    restantes--;
    await route.fulfill({
      status,
      headers: { 'Access-Control-Allow-Origin': '*' },
      contentType: typeof cuerpo === 'string' ? 'text/plain' : 'application/json',
      body: typeof cuerpo === 'string' ? cuerpo : JSON.stringify(cuerpo),
    });
  });
}

/** Modifica la respuesta real de una petición GET (para probar formatos de datos poco comunes). */
async function modificarRespuesta(page: Page, ruta: string, cambiar: (json: any) => void) {
  await page.route(enApi(ruta), async (route) => {
    if (route.request().method() !== 'GET') return route.fallback();
    const response = await route.fetch();
    const json = await response.json();
    cambiar(json);
    await route.fulfill({ response, json });
  });
}

const errorVisible = (page: Page) => expect(page.locator('.alert-danger').first()).toBeVisible();

async function tarjeta(page: Page, nombreSesion: string) {
  await page.goto(`/sesions?nombre=${encodeURIComponent(nombreSesion)}`);
  const card = page.locator('.card', { hasText: nombreSesion }).first();
  await expect(card).toBeVisible();
  return card;
}

test.describe('Casos límite de la interfaz', () => {
  test.describe.configure({ timeout: 120000 });
  test.use({ actionTimeout: 15000 });

  test('Panel principal: responder, salir, errores del servidor y fechas no estándar', async ({ page, browser, request }) => {
    const [org, est1, est2] = [await crearUsuario(request, 'Org'), await crearUsuario(request, 'EstUno'), await crearUsuario(request, 'EstDos')];
    const nombre = `Limite Panel ${Date.now()}`;
    const id = await crearSesion(request, org, nombre);
    await api(request, est1, `/sesiones/${id}/solicitar`);
    await api(request, est2, `/sesiones/${id}/solicitar`);

    await entrar(page, org);
    await fallarUnaVez(page, '/organizador/solicitudes', 'GET', 500);
    await page.goto('/dashboard?tab=mis-sesiones');
    await errorVisible(page);

    await page.goto('/dashboard?tab=mis-sesiones');
    await page.getByRole('button', { name: '✓ Aceptar' }).first().click();
    await expect(page.getByText(/Solicitud aceptada correctamente/i)).toBeVisible();
    await fallarUnaVez(page, '/solicitudes/\\d+/usuarios/\\d+/responder');
    await page.getByRole('button', { name: '✕ Rechazar' }).first().click();
    await expect(page.getByText('Error simulado del servidor')).toBeVisible();

    // Estudiantes: fechas en formato no estándar, salir con éxito y con error del servidor
    for (const est of [est1, est2]) {
      const p = await nuevaPagina(browser, est);
      await modificarRespuesta(p, '/mis-solicitudes', (lista) => lista.forEach((s: any) => {
        s.fecha_sesion = 'Por definir';
        s.fecha_respuesta = s.fecha_respuesta ? 'sin registro' : s.fecha_respuesta;
      }));
      await p.goto('/dashboard?tab=solicitudes');
      await expect(p.getByText('Por definir').first()).toBeVisible();
      await p.unroute(enApi('/mis-solicitudes'));
      await p.goto('/dashboard?tab=solicitudes');
      const card = p.locator('.card.overflow-hidden', { hasText: nombre });
      if (est === est2) await fallarUnaVez(p, '/sesiones/\\d+/salir');
      await card.getByRole('button', { name: /Abandonar sesión|Cancelar solicitud/ }).click();
      if (est === est2) await expect(p.getByText('Error simulado del servidor')).toBeVisible();
      else await expect(p.getByText(/Has salido de la sesión/i)).toBeVisible();
    }
  });

  test('Catálogo: filtros, búsqueda vacía, errores y modales del organizador', async ({ page, browser, request }) => {
    const [org, est] = [await crearUsuario(request, 'Org'), await crearUsuario(request, 'Est')];
    const s1 = `Limite Catalogo A ${Date.now()}`;
    const s2 = `Limite Catalogo B ${Date.now()}`;
    const id1 = await crearSesion(request, org, s1);
    await crearSesion(request, org, s2);
    await api(request, est, `/sesiones/${id1}/solicitar`);
    // s3: el estudiante fue aceptado y luego la sesión se reprogramó (debe reconfirmar)
    const s3 = `Limite Catalogo C ${Date.now()}`;
    const id3 = await crearSesion(request, org, s3);
    await api(request, est, `/sesiones/${id3}/solicitar`);
    await api(request, org, `/solicitudes/${id3}/usuarios/${est.id}/responder`, { decision: 'aceptar' });
    await api(request, org, `/sesiones/${id3}/reprogramar`, { fecha: '2099-06-01', motivo: 'Cambio de aula' });

    // Estudiante: búsqueda sin resultados y chips de filtros
    await entrar(page, est);
    await page.goto(`/sesions?nombre=NoExiste${Date.now()}&modalidad=virtual&disponible=true&periodo=proximos7`);
    await expect(page.getByRole('button', { name: /Quitar filtro/ }).first()).toBeVisible();
    for (const filtro of ['Modalidad', 'Disponibilidad', 'Fecha', 'Nombre']) {
      const chip = page.getByRole('button', { name: new RegExp(`Quitar filtro ${filtro}`, 'i') });
      if (await chip.count()) await chip.first().click();
    }
    await page.goto(`/sesions?nombre=x&modalidad=virtual`);
    await page.getByRole('button', { name: 'Limpiar filtros' }).click();
    await expect(page.getByRole('button', { name: /Quitar filtro/ })).toHaveCount(0);

    // Estudiante: errores al salir y al solicitar
    const c1 = await tarjeta(page, s1);
    await fallarUnaVez(page, '/sesiones/\\d+/salir');
    await c1.getByRole('button', { name: 'Cancelar solicitud' }).click();
    await expect(page.getByText('Error simulado del servidor')).toBeVisible();
    const c2 = await tarjeta(page, s2);
    await fallarUnaVez(page, '/sesiones/\\d+/solicitar');
    await c2.getByRole('button', { name: 'Solicitar unirme' }).click();
    await expect(page.getByText('Error simulado del servidor')).toBeVisible();

    const c3 = await tarjeta(page, s3);
    await fallarUnaVez(page, '/sesiones/\\d+/reconfirmar');
    await c3.getByRole('button', { name: /Aceptar nueva fecha/ }).click();
    await expect(page.getByText('Error simulado del servidor')).toBeVisible();

    // Organizador: panel de solicitudes, reprogramar y cancelar
    const po = await nuevaPagina(browser, org);
    const co = await tarjeta(po, s1);
    await fallarUnaVez(po, '/organizador/solicitudes', 'GET', 500, { detail: 'Error simulado del servidor' }, 1);
    await co.getByRole('button', { name: /Gestionar solicitudes/ }).click();
    await errorVisible(po);
    await co.getByRole('button', { name: /Cerrar panel de solicitudes/ }).click();
    await co.getByRole('button', { name: /Gestionar solicitudes/ }).click();
    await fallarUnaVez(po, '/solicitudes/\\d+/usuarios/\\d+/responder');
    await co.getByRole('button', { name: '✓ Aceptar' }).first().click();
    await expect(po.getByText('Error simulado del servidor')).toBeVisible();

    await co.getByRole('button', { name: /Reprogramar sesión/ }).click();
    await po.locator('#reprog-fecha').fill('2099-04-20');
    await po.locator('#reprog-motivo').fill('Cambio de aula');
    await fallarUnaVez(po, '/sesiones/\\d+/reprogramar');
    await po.getByRole('button', { name: 'Confirmar reprogramación' }).click();
    await expect(po.getByText('Error simulado del servidor').first()).toBeVisible();
    await po.getByRole('button', { name: 'Cerrar', exact: true }).first().click();

    const abrirCancelar = async () => {
      await co.getByRole('button', { name: /Cancelar sesión/ }).click();
      const m = po.locator('.modal', { hasText: 'Cancelar sesión de estudio' });
      await expect(m).toBeVisible();
      return m;
    };
    await (await abrirCancelar()).getByRole('button', { name: 'Cerrar' }).click();
    await (await abrirCancelar()).getByRole('button', { name: 'Volver sin cancelar' }).click();
    const modal = await abrirCancelar();
    // Con un motivo de menos de 5 caracteres (sin contar espacios) no se puede confirmar
    await modal.locator('#motivo-cancelacion-input').fill('     ab');
    await expect(modal.getByRole('button', { name: 'Confirmar cancelación' })).toBeDisabled();
    await modal.locator('#motivo-cancelacion-input').fill('Feriado largo');
    await fallarUnaVez(po, '/sesiones/\\d+/cancelar');
    await modal.getByRole('button', { name: 'Confirmar cancelación' }).click();
    await expect(po.getByText('Error simulado del servidor').first()).toBeVisible();
  });

  test('Asistencia y justificaciones: concluir, cancelar edición, validaciones y errores', async ({ page, browser, request }) => {
    const [org, est] = [await crearUsuario(request, 'Org'), await crearUsuario(request, 'Est')];
    const s3 = `Limite Asistencia A ${Date.now()}`;
    const s4 = `Limite Asistencia B ${Date.now()}`;
    const id3 = await crearSesion(request, org, s3);
    const id4 = await crearSesion(request, org, s4);
    for (const id of [id3, id4]) {
      await api(request, est, `/sesiones/${id}/solicitar`);
      await api(request, org, `/solicitudes/${id}/usuarios/${est.id}/responder`, { decision: 'aceptar' });
    }
    await api(request, org, `/sesiones/${id4}/asistencia`, { asistencias: [{ usuario_id: est.id, asistencia: 'ausente' }] });

    // Organizador: control de asistencia de s3
    await entrar(page, org);
    const co = await tarjeta(page, s3);
    const modal = page.locator('.modal', { hasText: /control de asistencia y justificaciones/i });
    await fallarUnaVez(page, `/sesiones/${id3}/asistencia`, 'GET', 500);
    await co.getByRole('button', { name: /control de asistencia/i }).click();
    await errorVisible(page);
    await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await co.getByRole('button', { name: /control de asistencia/i }).click();
    await fallarUnaVez(page, '/sesiones/\\d+/finalizar');
    await modal.getByRole('button', { name: /Dar sesión por concluida/ }).click();
    await expect(modal.getByText('Error simulado del servidor')).toBeVisible();
    await modal.getByRole('button', { name: /Dar sesión por concluida/ }).click();
    await expect(modal.getByText(/concluida exitosamente/i)).toBeVisible();

    const fila = modal.locator('.border.bg-white', { hasText: est.nombre });
    await fila.getByRole('button', { name: /ausente/i }).click();
    await modal.getByRole('button', { name: /guardar registro de asistencia/i }).click();
    await modal.getByRole('button', { name: /Editar \/ Modificar asistencia/ }).click();
    await modal.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await modal.getByRole('button', { name: /Editar \/ Modificar asistencia/ }).click();
    await fallarUnaVez(page, `/sesiones/${id3}/asistencia`);
    await modal.getByRole('button', { name: /Guardar modificaciones/ }).click();
    await expect(modal.getByText('Error simulado del servidor')).toBeVisible();
    await modal.getByRole('button', { name: 'Cerrar', exact: true }).click();

    // Estudiante: historial con fechas no estándar y justificación con validación y error
    const pe = await nuevaPagina(browser, est);
    await modificarRespuesta(pe, '/historial-sesiones', (lista) => lista.forEach((r: any, i: number) => {
      r.fecha_inscripcion = i === 0 ? '2026-11-05T14:30:00' : 'sin registro';
      r.fecha_sesion = i === 0 ? r.fecha_sesion : 'Por definir';
    }));
    await pe.goto('/historial');
    await expect(pe.getByText('sin registro').first()).toBeVisible();
    await pe.unroute(enApi('/historial-sesiones'));
    await pe.goto('/historial');
    await pe.locator('article', { hasText: s3 }).getByRole('button', { name: /justificar inasistencia/i }).click();
    const mj = pe.locator('.modal', { hasText: /justificar inasistencia/i });
    await mj.locator('#texto-justificacion').fill('abc');
    await mj.getByRole('button', { name: /enviar justificación/i }).click();
    await expect(mj.getByText(/al menos 5 caracteres/)).toBeVisible();
    await mj.locator('#texto-justificacion').fill('Estuve enfermo con certificado');
    await fallarUnaVez(pe, '/sesiones/\\d+/justificar');
    await mj.getByRole('button', { name: /enviar justificación/i }).click();
    await expect(mj.getByText('Error simulado del servidor')).toBeVisible();
    await mj.getByRole('button', { name: /enviar justificación/i }).click();
    await expect(mj).toBeHidden();

    // Estudiante: justificar s4 desde el catálogo
    const ce = await tarjeta(pe, s4);
    await ce.getByRole('button', { name: /justificar inasistencia/i }).click();
    await mj.locator('#texto-justificacion').fill('Cruce con examen presencial');
    await mj.getByRole('button', { name: /enviar justificación/i }).click();
    await expect(mj).toBeHidden();

    // Organizador: responder la justificación sin motivo y con error del servidor
    const co2 = await tarjeta(page, s3);
    await co2.getByRole('button', { name: /control de asistencia/i }).click();
    const jc = modal.locator('.card.bg-light', { hasText: est.nombre });
    await jc.getByRole('button', { name: /aceptar justificación/i }).click();
    await expect(modal.getByText(/al menos 3 caracteres/)).toBeVisible();
    await jc.locator('input[id^="motivo-res-"]').fill('Certificado válido');
    await fallarUnaVez(page, '/sesiones/\\d+/usuarios/\\d+/responder-justificacion');
    await jc.getByRole('button', { name: /aceptar justificación/i }).click();
    await expect(modal.getByText('Error simulado del servidor')).toBeVisible();
  });

  test('Mis datos y registro: errores de carga y descarga, contraseña y eliminación', async ({ page, request }) => {
    // Registro por la interfaz: tras el aviso de éxito redirige a /login
    const email = `limite.registro.${Date.now()}@prueba.test`;
    await page.goto('/register');
    await page.getByLabel('Nombre').fill('Registro Limite');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(CLAVE);
    await page.getByRole('button', { name: 'Registrarse' }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 });

    const u = await crearUsuario(request, 'MisDatos');
    await entrar(page, u);
    await fallarUnaVez(page, '/mis-datos', 'GET', 500);
    await page.goto('/mis-datos');
    await errorVisible(page);
    await page.goto('/mis-datos');
    await fallarUnaVez(page, '/mis-datos/descargar', 'GET', 500);
    await page.getByTestId('btn-descargar-json').click();
    await errorVisible(page);

    await page.getByTestId('btn-toggle-cambiar-password').click();
    await page.getByTestId('input-pass-actual').fill(CLAVE);
    await page.getByTestId('input-pass-nueva').fill('Clave456!');
    await page.getByTestId('btn-guardar-nueva-password').click();
    await expect(page.getByTestId('input-pass-actual')).toBeHidden({ timeout: 6000 });
    await page.getByTestId('btn-toggle-cambiar-password').click();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(page.getByTestId('input-pass-actual')).toBeHidden();

    await page.getByTestId('btn-abrir-modal-eliminar').click();
    await page.getByTestId('input-password-confirmacion').fill('   ');
    await page.getByTestId('btn-modal-confirmar-eliminar').click();
    await expect(page.getByText(/ingresa tu contraseña/i).first()).toBeVisible();
    await page.getByTestId('input-password-confirmacion').fill('Incorrecta1');
    await page.getByTestId('btn-modal-confirmar-eliminar').click();
    await expect(page.getByText(/incorrecta/i).first()).toBeVisible();
    await page.getByTestId('btn-modal-cancelar').click();
  });

  test('Validación del servidor, analítica con errores y menú móvil', async ({ page, request }) => {
    const u = await crearUsuario(request, 'Varios');
    await entrar(page, u);

    // Error de validación con lista de campos (422 de FastAPI)
    await page.goto('/new-study');
    await page.getByLabel('nombre').fill('Sesion con error');
    await page.locator('#materia').fill('Pruebas');
    await page.getByLabel('cupo').fill('2');
    await page.getByLabel('fecha').fill('2099-05-01');
    await fallarUnaVez(page, '/guardar-nuevo', 'POST', 422, { detail: [{ loc: ['body', 'cupo'], msg: 'valor no permitido' }] });
    await page.getByRole('button', { name: 'Crear sesión' }).click();
    await expect(page.getByText('cupo: valor no permitido')).toBeVisible();

    // Analítica: error sin cuerpo JSON y fecha de evento no estándar
    await fallarUnaVez(page, '/analitica/metricas', 'GET', 500, '');
    await page.goto('/analitica');
    await expect(page.getByText('Ocurrió un error.')).toBeVisible();
    await modificarRespuesta(page, '/analitica/metricas', (m) => {
      m.ultimos_eventos = [{ id: 1, evento: 'evento_prueba', props: {}, fecha: 'sin-fecha' }];
    });
    await page.goto('/analitica');
    await expect(page.getByText('sin-fecha').first()).toBeVisible();
    await page.unroute(enApi('/analitica/metricas'));

    // Menú móvil: cerrar sesión
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/dashboard');
    await page.getByRole('button', { name: 'Abrir menú de opciones' }).click();
    await page.getByRole('button', { name: /Cerrar sesión/ }).last().click();
    await expect(page).toHaveURL(/\/login|\/$/);
  });
});
