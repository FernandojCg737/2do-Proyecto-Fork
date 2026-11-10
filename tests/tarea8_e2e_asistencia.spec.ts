import { test, expect } from '@playwright/test';

/**
 * ============================================================================
 * TAREA 8 - SUITE E2E: ASISTENCIA Y JUSTIFICACIÓN (IHC Clase 20)
 * ============================================================================
 * 
 * Requisitos y rúbrica obligatoria:
 * 1. REGISTRO DE ASISTENCIA:
 *    - Al terminar una sesión, el organizador registra presentes o ausentes entre sus participantes confirmados.
 *    - Cada participante consulta su resultado de forma clara y persistente.
 * 2. JUSTIFICACIÓN:
 *    - Un ausente puede presentar una justificación formal.
 *    - El organizador la acepta o rechaza con motivo obligatorio.
 *    - Conservar el historial completo de cambios (auditoría persistente).
 * 3. RESTRICCIONES DE SEGURIDAD OBLIGATORIAS:
 *    - Bloqueo estricto de modificaciones por un usuario ajeno (HTTP 403 / UI protegida).
 *    - Validación de estados (solo ausentes pueden justificar).
 *    - Motivo de resolución obligatorio en el backend y frontend.
 *    - Comprobación de persistencia al recargar el navegador.
 */

test.describe('Tarea 8 - Asistencia y Justificación con Estados, Consecuencias y Auditoría', () => {

  // ============================================================================
  // TEST 1: Recorrido completo asignado con todos los estados y actores necesarios
  // ============================================================================
  test('1. Feature Tarea 8: Recorrido completo asignado (Organizador marca presente/ausente -> Ausente justifica -> Organizador resuelve con motivo -> Persistencia y Auditoría)', async ({ browser }) => {
    test.setTimeout(90000);

    const timestamp = Date.now();
    const nombreSesion = `Taller Tarea 8 IHC ${timestamp}`;

    // ------------------------------------------------------------------------
    // ACTOR 1: Organizador (Carlos Mendoza) crea la sesión de estudio
    // ------------------------------------------------------------------------
    const contextOrg = await browser.newContext();
    const pageOrg = await contextOrg.newPage();
    await pageOrg.setViewportSize({ width: 1280, height: 800 });

    await pageOrg.goto('/login');
    await pageOrg.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await pageOrg.getByLabel('Password').fill('Password123!');
    await pageOrg.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageOrg.getByRole('heading', { name: /Bienvenido, Carlos Mendoza/i })).toBeVisible();

    // Crear sesión de estudio con cupo para 2 participantes
    await pageOrg.goto('/new-study');
    await pageOrg.getByLabel('nombre').fill(nombreSesion);
    await pageOrg.locator('#materia').fill('Interacción Hombre-Computador');
    await pageOrg.locator('#modalidad').selectOption('presencial');
    await pageOrg.getByLabel('cupo').fill('2');
    await pageOrg.getByLabel('fecha').fill('2026-11-20');
    await pageOrg.getByRole('button', { name: 'Crear sesión' }).click();
    await expect(pageOrg.getByText(/Sesión de estudio registrada correctamente/i)).toBeVisible();

    // ------------------------------------------------------------------------
    // ACTOR 2: Fernando Calani solicita unirse a la sesión
    // ------------------------------------------------------------------------
    const contextEst1 = await browser.newContext();
    const pageEst1 = await contextEst1.newPage();
    await pageEst1.setViewportSize({ width: 1280, height: 800 });

    await pageEst1.goto('/login');
    await pageEst1.getByLabel('Email').fill('fernando.calani@studymatch.com');
    await pageEst1.getByLabel('Password').fill('Password123!');
    await pageEst1.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageEst1.getByRole('heading', { name: /Bienvenido, Fernando Calani/i })).toBeVisible();

    await pageEst1.goto('/sesions');
    await pageEst1.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst1.getByRole('button', { name: 'Buscar' }).click();
    await pageEst1.waitForTimeout(600);
    const cardEst1 = pageEst1.locator('.card', { hasText: nombreSesion });
    await expect(cardEst1).toBeVisible();
    await cardEst1.getByRole('button', { name: 'Solicitar unirme' }).click();
    await expect(cardEst1.getByText('⏳ Solicitud pendiente de aprobación')).toBeVisible();

    // ------------------------------------------------------------------------
    // ACTOR 3: Ana Torres solicita unirse a la sesión
    // ------------------------------------------------------------------------
    const contextEst2 = await browser.newContext();
    const pageEst2 = await contextEst2.newPage();
    await pageEst2.setViewportSize({ width: 1280, height: 800 });

    await pageEst2.goto('/login');
    await pageEst2.getByLabel('Email').fill('ana.torres@studymatch.com');
    await pageEst2.getByLabel('Password').fill('Password123!');
    await pageEst2.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageEst2.getByRole('heading', { name: /Bienvenido, Ana Torres/i })).toBeVisible();

    await pageEst2.goto('/sesions');
    await pageEst2.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst2.getByRole('button', { name: 'Buscar' }).click();
    await pageEst2.waitForTimeout(600);
    const cardEst2 = pageEst2.locator('.card', { hasText: nombreSesion });
    await expect(cardEst2).toBeVisible();
    await cardEst2.getByRole('button', { name: 'Solicitar unirme' }).click();
    await expect(cardEst2.getByText('⏳ Solicitud pendiente de aprobación')).toBeVisible();

    // ------------------------------------------------------------------------
    // ORGANIZADOR (Carlos Mendoza) acepta las 2 solicitudes
    // ------------------------------------------------------------------------
    await pageOrg.goto('/sesions');
    await pageOrg.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageOrg.getByRole('button', { name: 'Buscar' }).click();
    await pageOrg.waitForTimeout(600);
    const cardOrg = pageOrg.locator('.card', { hasText: nombreSesion });
    await expect(cardOrg).toBeVisible();

    // Abrir panel de solicitudes y aceptar a ambos alumnos
    await cardOrg.getByRole('button', { name: /gestionar solicitudes/i }).click();
    await pageOrg.waitForTimeout(500);

    const btnAceptar1 = cardOrg.getByRole('button', { name: '✓ Aceptar' }).first();
    await expect(btnAceptar1).toBeVisible();
    await btnAceptar1.click();
    await pageOrg.waitForTimeout(600);

    const btnAceptar2 = cardOrg.getByRole('button', { name: '✓ Aceptar' }).first();
    await expect(btnAceptar2).toBeVisible();
    await btnAceptar2.click();
    await pageOrg.waitForTimeout(600);

    // ------------------------------------------------------------------------
    // ORGANIZADOR: Abre Control de Asistencia y registra Presentes y Ausentes
    // (Fernando Calani = Presente, Ana Torres = Ausente)
    // ------------------------------------------------------------------------
    const btnAsistencia = cardOrg.getByRole('button', { name: /control de asistencia/i });
    await expect(btnAsistencia).toBeVisible();
    await btnAsistencia.click();

    // Modal de asistencia
    const modalAsistencia = pageOrg.locator('.modal', { hasText: /control de asistencia y justificaciones/i });
    await expect(modalAsistencia).toBeVisible();

    // En la fila de Fernando Calani -> Clic en Presente
    const filaFernando = modalAsistencia.locator('.border.bg-white', { hasText: 'Fernando Calani' });
    await expect(filaFernando).toBeVisible();
    await filaFernando.getByRole('button', { name: /presente/i }).click();

    // En la fila de Ana Torres -> Clic en Ausente
    const filaAna = modalAsistencia.locator('.border.bg-white', { hasText: 'Ana Torres' });
    await expect(filaAna).toBeVisible();
    await filaAna.getByRole('button', { name: /ausente/i }).click();

    // Guardar el registro de asistencia
    await modalAsistencia.getByRole('button', { name: /guardar registro de asistencia/i }).click();
    await expect(modalAsistencia.getByText(/Se registró la asistencia de 2 participante\(s\) correctamente/i)).toBeVisible();

    // Cerrar modal del organizador temporalmente
    await modalAsistencia.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await pageOrg.waitForTimeout(500);

    // ------------------------------------------------------------------------
    // ACTOR 2: Fernando Calani consulta su resultado -> Presente
    // ------------------------------------------------------------------------
    await pageEst1.goto('/dashboard?tab=solicitudes');
    await pageEst1.waitForTimeout(800);
    const cardFernandoDash = pageEst1.locator('.card.overflow-hidden', { hasText: nombreSesion });
    await expect(cardFernandoDash).toBeVisible();
    await expect(cardFernandoDash.getByText('✅ Presente en la sesión')).toBeVisible();

    // ------------------------------------------------------------------------
    // ACTOR 3: Ana Torres consulta su resultado -> Ausente y presenta justificación
    // ------------------------------------------------------------------------
    await pageEst2.goto('/dashboard?tab=solicitudes');
    await pageEst2.waitForTimeout(800);
    const cardAnaDash = pageEst2.locator('.card.overflow-hidden', { hasText: nombreSesion });
    await expect(cardAnaDash).toBeVisible();
    await expect(cardAnaDash.getByText('❌ Registrado como ausente')).toBeVisible();

    // Ana hace clic en "📝 Justificar inasistencia"
    const btnJustificar = cardAnaDash.getByRole('button', { name: /justificar inasistencia/i });
    await expect(btnJustificar).toBeVisible();
    await btnJustificar.click();

    // Modal de justificación
    const modalJustificar = pageEst2.locator('.modal', { hasText: /justificar inasistencia/i });
    await expect(modalJustificar).toBeVisible();
    await modalJustificar.locator('#texto-justificacion').fill('Tuve cruce de horario con un examen presencial de IHC.');
    await modalJustificar.getByRole('button', { name: /enviar justificación/i }).click();

    // El estado de Ana pasa inmediatamente a "⏳ Justificación en revisión"
    await pageEst2.waitForTimeout(800);
    await expect(cardAnaDash.getByText('⏳ Justificación en revisión')).toBeVisible();
    await expect(cardAnaDash.getByText('Tuve cruce de horario con un examen presencial de IHC.')).toBeVisible();

    // ------------------------------------------------------------------------
    // ORGANIZADOR (Carlos Mendoza): Revisa la justificación y la ACEPTA con motivo
    // ------------------------------------------------------------------------
    await pageOrg.goto('/sesions');
    await pageOrg.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageOrg.getByRole('button', { name: 'Buscar' }).click();
    await pageOrg.waitForTimeout(600);
    const cardOrgFinal = pageOrg.locator('.card', { hasText: nombreSesion });
    await cardOrgFinal.getByRole('button', { name: /control de asistencia/i }).click();

    const modalOrgRevision = pageOrg.locator('.modal', { hasText: /control de asistencia y justificaciones/i });
    await expect(modalOrgRevision).toBeVisible();

    // Localizar la justificación recibida de Ana Torres
    const justifCard = modalOrgRevision.locator('.card.bg-light', { hasText: 'Ana Torres' });
    await expect(justifCard).toBeVisible();
    await expect(justifCard.getByText('⏳ Pendiente de revisión')).toBeVisible();
    await expect(justifCard.getByText('Tuve cruce de horario con un examen presencial de IHC.')).toBeVisible();

    // Rellenar el motivo de la resolución obligatoria
    const inputMotivoRes = justifCard.locator('input[id^="motivo-res-"]');
    await expect(inputMotivoRes).toBeVisible();
    await inputMotivoRes.fill('Comprobante académico verificado y aprobado');

    // Clic en "✓ Aceptar justificación"
    await justifCard.getByRole('button', { name: /aceptar justificación/i }).click();
    await pageOrg.waitForTimeout(800);

    // Verificar que la justificación pasa a "✅ Justificación aceptada" con su motivo
    await expect(justifCard.getByText('✅ Justificación aceptada')).toBeVisible();
    await expect(justifCard.getByText(/Resuelto con motivo: "Comprobante académico verificado y aprobado"/i)).toBeVisible();

    // Verificar que en el Historial de Cambios y Auditoría aparecen los eventos de auditoría
    const tablaAuditoria = modalOrgRevision.locator('table');
    await expect(tablaAuditoria).toBeVisible();
    await expect(tablaAuditoria.getByText('registro_asistencia').first()).toBeVisible();
    await expect(tablaAuditoria.getByText('envio_justificacion')).toBeVisible();
    await expect(tablaAuditoria.getByText('resolucion_justificacion')).toBeVisible();

    // Captura de pantalla DESPUÉS como Organizador
    await pageOrg.screenshot({ path: 'evidencias/captura_tarea8_despues_organizador.png', fullPage: false });
    console.log('Captura DESPUÉS Organizador guardada.');

    // ------------------------------------------------------------------------
    // COMPROBACIÓN DE PERSISTENCIA: Ana Torres recarga la página
    // ------------------------------------------------------------------------
    await pageEst2.reload();
    await pageEst2.waitForTimeout(1000);
    const cardAnaPersistente = pageEst2.locator('.card.overflow-hidden', { hasText: nombreSesion });
    await expect(cardAnaPersistente).toBeVisible();

    // Verifica que el estado persiste como "✅ Ausencia justificada" y muestra la respuesta del organizador
    await expect(cardAnaPersistente.getByText('✅ Ausencia justificada')).toBeVisible();
    await expect(cardAnaPersistente.getByText(/Respuesta organizador: "Comprobante académico verificado y aprobado"/i)).toBeVisible();

    // Captura de pantalla DESPUÉS como Estudiante
    await pageEst2.screenshot({ path: 'evidencias/captura_tarea8_despues_estudiante.png', fullPage: false });
    console.log('Captura DESPUÉS Estudiante guardada.');

    // Limpieza de contextos
    await contextOrg.close();
    await contextEst1.close();
    await contextEst2.close();
  });


  // ============================================================================
  // TEST 2: Restricciones de Seguridad Obligatorias
  // ============================================================================
  test('2. Restricciones de Seguridad: Bloqueo de modificaciones por usuario ajeno (403), validación de estados y motivo obligatorio', async ({ browser, request }) => {
    test.setTimeout(60000);

    const timestamp = Date.now();
    const nombreSesion = `Seguridad Tarea 8 IHC ${timestamp}`;

    // 1. Carlos Mendoza crea una sesión de estudio
    const contextOrg = await browser.newContext();
    const pageOrg = await contextOrg.newPage();
    await pageOrg.goto('/login');
    await pageOrg.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await pageOrg.getByLabel('Password').fill('Password123!');
    await pageOrg.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageOrg.getByRole('heading', { name: /Bienvenido, Carlos Mendoza/i })).toBeVisible();

    await pageOrg.goto('/new-study');
    await pageOrg.getByLabel('nombre').fill(nombreSesion);
    await pageOrg.locator('#materia').fill('Interacción Hombre-Computador');
    await pageOrg.locator('#modalidad').selectOption('presencial');
    await pageOrg.getByLabel('cupo').fill('3');
    await pageOrg.getByLabel('fecha').fill('2026-11-20');
    await pageOrg.getByRole('button', { name: 'Crear sesión' }).click();
    await expect(pageOrg.getByText(/Sesión de estudio registrada correctamente/i)).toBeVisible();

    // Obtener el ID de la sesión recién creada buscando en /all-sesions con el token del organizador
    const tokenOrg = await pageOrg.evaluate(() => localStorage.getItem('studymatch_token'));
    const resSesiones = await request.get(`http://127.0.0.1:8000/all-sesions?nombre=${encodeURIComponent(nombreSesion)}`, {
      headers: { Authorization: `Bearer ${tokenOrg}` },
    });
    const lista = await resSesiones.json();
    expect(lista.length).toBeGreaterThan(0);
    const sesionId = lista[0].id;

    // 2. Iniciar sesión con un USUARIO AJENO (Brayan Gonzales) que no es organizador ni participante
    const contextAjeno = await browser.newContext();
    const pageAjeno = await contextAjeno.newPage();
    await pageAjeno.goto('/login');
    await pageAjeno.getByLabel('Email').fill('brayan.gonzales@studymatch.com');
    await pageAjeno.getByLabel('Password').fill('Password123!');
    await pageAjeno.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageAjeno.getByRole('heading', { name: /Bienvenido, Brayan Gonzales/i })).toBeVisible();

    // RESTRICCIÓN EN INTERFAZ:
    // Brayan navega a /sesions y localiza la tarjeta de la sesión de Carlos Mendoza
    await pageAjeno.goto('/sesions');
    await pageAjeno.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageAjeno.getByRole('button', { name: 'Buscar' }).click();
    await pageAjeno.waitForTimeout(600);
    const cardAjeno = pageAjeno.locator('.card', { hasText: nombreSesion });
    await expect(cardAjeno).toBeVisible();

    // La interfaz NO debe mostrar el botón de "Control de asistencia" a un usuario ajeno
    await expect(cardAjeno.getByRole('button', { name: /control de asistencia/i })).toHaveCount(0);
    await expect(cardAjeno.getByRole('button', { name: /gestionar solicitudes/i })).toHaveCount(0);

    // Obtener token JWT de Brayan Gonzales para probar los bloqueos directos en el backend
    const tokenAjeno = await pageAjeno.evaluate(() => localStorage.getItem('studymatch_token'));
    expect(tokenAjeno).toBeTruthy();

    // RESTRICCIÓN EN BACKEND 1:
    // Usuario ajeno intenta registrar asistencia mediante POST directo -> Debe recibir HTTP 403 Forbidden
    const resIntentoAsistencia = await request.post(`http://127.0.0.1:8000/sesiones/${sesionId}/asistencia`, {
      headers: {
        Authorization: `Bearer ${tokenAjeno}`,
        'Content-Type': 'application/json',
      },
      data: {
        asistencias: [{ usuario_id: 2, asistencia: 'presente' }],
      },
    });
    expect(resIntentoAsistencia.status()).toBe(403);
    const errAsistencia = await resIntentoAsistencia.json();
    expect(errAsistencia.detail).toContain('Solo el organizador de la sesión tiene permisos');

    // RESTRICCIÓN EN BACKEND 2:
    // Usuario ajeno intenta resolver una justificación -> Debe recibir HTTP 403 Forbidden
    const resIntentoResolucion = await request.post(
      `http://127.0.0.1:8000/sesiones/${sesionId}/usuarios/2/responder-justificacion`,
      {
        headers: {
          Authorization: `Bearer ${tokenAjeno}`,
          'Content-Type': 'application/json',
        },
        data: {
          decision: 'aceptar',
          motivo: 'Motivo arbitrario de un usuario ajeno',
        },
      }
    );
    expect(resIntentoResolucion.status()).toBe(403);
    const errResolucion = await resIntentoResolucion.json();
    expect(errResolucion.detail).toContain('Solo el organizador de la sesión puede aceptar o rechazar');

    // RESTRICCIÓN EN BACKEND 3:
    // Usuario ajeno intenta finalizar la sesión -> Debe recibir HTTP 403 Forbidden
    const resIntentoFinalizar = await request.post(`http://127.0.0.1:8000/sesiones/${sesionId}/finalizar`, {
      headers: {
        Authorization: `Bearer ${tokenAjeno}`,
      },
    });
    expect(resIntentoFinalizar.status()).toBe(403);

    // RESTRICCIÓN EN BACKEND 4:
    // Un usuario que no figura como ausente intenta enviar justificación -> HTTP 400 Bad Request
    const resIntentoJustificarSinSerAusente = await request.post(`http://127.0.0.1:8000/sesiones/${sesionId}/justificar`, {
      headers: {
        Authorization: `Bearer ${tokenAjeno}`,
        'Content-Type': 'application/json',
      },
      data: {
        justificacion: 'Intento ilegal de justificar sin ser ausente',
      },
    });
    expect(resIntentoJustificarSinSerAusente.status()).toBe(400);

    await contextOrg.close();
    await contextAjeno.close();
  });

});
