import { test, expect } from '@playwright/test';

/**
 * ============================================================================
 * TAREA 9 - SUITE DE PRUEBAS END-TO-END (E2E) EN PLAYWRIGHT
 * IHC CLASE 21: PARTE A (TELEMETRÍA Y EMBUDOS) & PARTE B (CANCELAR SESIÓN)
 * ============================================================================
 * 
 * RÚBRICA Y REQUISITOS OFICIALES (DIAPOSITIVAS 11/13 Y 12/13):
 * 
 * 1. REGLAS DE NEGOCIO PARA «CANCELAR UNA SESIÓN» (StudyMatch):
 *    - Solo el organizador creador tiene privilegios para cancelar la sesión.
 *    - Solo antes de la fecha programada (no vencida ni finalizada).
 *    - Motivo de cancelación obligatorio (mínimo 5 caracteres).
 *    - Consecuencia en estados: Confirmados ('aceptada'), pendientes ('pendiente')
 *      y en lista de espera ('en_espera' / 'pendiente_reconfirmacion') pasan a 'cancelada'.
 *    - Todos los participantes ven el motivo oficial provisto por el organizador.
 *    - Bloqueo estricto: No se admiten nuevas solicitudes ni toma de asistencia.
 *    - Un participante cancelado no puede volver a solicitar unirse.
 * 
 * 2. TELEMETRÍA Y ANALÍTICA EN TODO EL PRODUCTO:
 *    - Registro de eventos en los 4 flujos principales (Solicitud, Creación, Justificación, Cancelación).
 *    - Comprobación del panel /analitica con embudos, caídas porcentuales y decisión IHC.
 *    - Respeto estricto de la regla de privacidad: sin nombres ni correos personales.
 */

test.describe('Tarea 9 - Cancelar una sesión y Analítica en todo el producto (StudyMatch)', () => {

  // --------------------------------------------------------------------------
  // TEST 1: Flujo completo de Cancelación de Sesión con 3 Estados de Participantes
  // --------------------------------------------------------------------------
  test('1. Feature Tarea 9 (Parte B): Cancelar sesión con participantes en tres estados (aceptada, pendiente, en_espera), visualización de motivo y bloqueo de nueva solicitud', async ({ browser }) => {
    // Configuración de tiempo límite extendido para orquestar los 4 navegadores
    test.setTimeout(120000);

    // Generar nombre único para la sesión para aislamiento total entre pruebas
    const timestamp = Date.now();
    const nombreSesion = `Sesión Tarea 9 IHC Cancelar ${timestamp}`;
    const motivoOficial = 'Emergencia médica y reprogramación general de exámenes finales';

    // ========================================================================
    // PASO 1: Organizador (Carlos Mendoza) crea una sesión futura con cupo = 1
    // ========================================================================
    const contextOrg = await browser.newContext();
    const pageOrg = await contextOrg.newPage();
    await pageOrg.setViewportSize({ width: 1280, height: 800 });

    // Inicio de sesión del organizador
    await pageOrg.goto('/login');
    await pageOrg.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await pageOrg.getByLabel('Password').fill('Password123!');
    await pageOrg.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageOrg.getByRole('heading', { name: /Bienvenido, Carlos Mendoza/i })).toBeVisible();

    // Navegar a la pantalla de creación de sesiones
    await pageOrg.goto('/new-study');
    await pageOrg.getByLabel('nombre').fill(nombreSesion);
    await pageOrg.locator('#materia').fill('Interacción Hombre-Computador');
    await pageOrg.locator('#modalidad').selectOption('presencial');
    await pageOrg.getByLabel('cupo').fill('1'); // Cupo estricto = 1 para forzar la lista de espera
    await pageOrg.getByLabel('fecha').fill('2026-11-25'); // Fecha futura válida
    await pageOrg.getByRole('button', { name: 'Crear sesión' }).click();
    await expect(pageOrg.getByText(/Sesión de estudio registrada correctamente/i)).toBeVisible();

    // ========================================================================
    // PASO 2: Estudiante 1 (Fernando Calani) solicita unirse -> Estado 'pendiente'
    // ========================================================================
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

    // ========================================================================
    // PASO 3: Estudiante 2 (Brayan Gonzales) solicita unirse -> Estado 'pendiente'
    // ========================================================================
    const contextEst2 = await browser.newContext();
    const pageEst2 = await contextEst2.newPage();
    await pageEst2.setViewportSize({ width: 1280, height: 800 });

    await pageEst2.goto('/login');
    await pageEst2.getByLabel('Email').fill('brayan.gonzales@studymatch.com');
    await pageEst2.getByLabel('Password').fill('Password123!');
    await pageEst2.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageEst2.getByRole('heading', { name: /Bienvenido, Brayan Gonzales/i })).toBeVisible();

    await pageEst2.goto('/sesions');
    await pageEst2.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst2.getByRole('button', { name: 'Buscar' }).click();
    await pageEst2.waitForTimeout(600);

    const cardEst2 = pageEst2.locator('.card', { hasText: nombreSesion });
    await expect(cardEst2).toBeVisible();
    await cardEst2.getByRole('button', { name: 'Solicitar unirme' }).click();
    await expect(cardEst2.getByText('⏳ Solicitud pendiente de aprobación')).toBeVisible();

    // ========================================================================
    // PASO 4: Organizador acepta a Estudiante 1 (Fernando).
    // Consecuencia: Fernando pasa a 'aceptada' y llena el cupo. Brayan queda en 'pendiente'.
    // ========================================================================
    await pageOrg.goto('/sesions');
    await pageOrg.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageOrg.getByRole('button', { name: 'Buscar' }).click();
    await pageOrg.waitForTimeout(600);

    const cardOrg = pageOrg.locator('.card', { hasText: nombreSesion });
    await expect(cardOrg).toBeVisible();
    await cardOrg.getByRole('button', { name: /gestionar solicitudes/i }).click();
    await pageOrg.waitForTimeout(600);

    // Aceptar la primera solicitud (Fernando Calani)
    const btnAceptarFernando = cardOrg.getByRole('button', { name: '✓ Aceptar' }).first();
    await expect(btnAceptarFernando).toBeVisible();
    await btnAceptarFernando.click();
    await pageOrg.waitForTimeout(800);

    // ========================================================================
    // PASO 5: Estudiante 3 (Ana Torres) solicita unirse.
    // Como el cupo está lleno (1/1), se une a la LISTA DE ESPERA -> Estado 'en_espera'
    // ========================================================================
    const contextEst3 = await browser.newContext();
    const pageEst3 = await contextEst3.newPage();
    await pageEst3.setViewportSize({ width: 1280, height: 800 });

    await pageEst3.goto('/login');
    await pageEst3.getByLabel('Email').fill('ana.torres@studymatch.com');
    await pageEst3.getByLabel('Password').fill('Password123!');
    await pageEst3.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageEst3.getByRole('heading', { name: /Bienvenido, Ana Torres/i })).toBeVisible();

    await pageEst3.goto('/sesions');
    await pageEst3.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst3.getByRole('button', { name: 'Buscar' }).click();
    await pageEst3.waitForTimeout(600);

    const cardEst3 = pageEst3.locator('.card', { hasText: nombreSesion });
    await expect(cardEst3).toBeVisible();
    // Botón dinámico de lista de espera
    await cardEst3.getByRole('button', { name: 'Unirme a la lista de espera' }).click();
    await expect(cardEst3.getByText(/En lista de espera/i).first()).toBeVisible();

    // ========================================================================
    // VERIFICACIÓN PREVIA: Demostrar que los 3 participantes están en los 3 estados distintos
    // 1. Fernando Calani: 'aceptada'
    // 2. Brayan Gonzales: 'pendiente'
    // 3. Ana Torres: 'en_espera'
    // ========================================================================
    await pageEst1.goto('/sesions');
    await pageEst1.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst1.getByRole('button', { name: 'Buscar' }).click();
    await pageEst1.waitForTimeout(600);
    const cardEst1Pre = pageEst1.locator('.card', { hasText: nombreSesion });

    await pageEst2.goto('/sesions');
    await pageEst2.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst2.getByRole('button', { name: 'Buscar' }).click();
    await pageEst2.waitForTimeout(600);
    const cardEst2Pre = pageEst2.locator('.card', { hasText: nombreSesion });

    // Uno de los dos postulantes fue aceptado y el otro permanece en pendiente
    const est1Aceptado = await cardEst1Pre.getByText(/Confirmado/i).first().isVisible();
    if (est1Aceptado) {
      await expect(cardEst2Pre.getByText(/Solicitud pendiente/i).first()).toBeVisible();
    } else {
      await expect(cardEst1Pre.getByText(/Solicitud pendiente/i).first()).toBeVisible();
      await expect(cardEst2Pre.getByText(/Confirmado/i).first()).toBeVisible();
    }

    await pageEst3.goto('/sesions');
    await pageEst3.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst3.getByRole('button', { name: 'Buscar' }).click();
    await pageEst3.waitForTimeout(600);
    const cardEst3Pre = pageEst3.locator('.card', { hasText: nombreSesion });
    await expect(cardEst3Pre.getByText(/En lista de espera/i).first()).toBeVisible();

    // ========================================================================
    // PASO 6: El Organizador abre el modal de Cancelar Sesión e ingresa motivo obligatorio
    // ========================================================================
    await pageOrg.goto('/sesions');
    await pageOrg.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageOrg.getByRole('button', { name: 'Buscar' }).click();
    await pageOrg.waitForTimeout(600);

    const cardOrgFinal = pageOrg.locator('.card', { hasText: nombreSesion });
    await expect(cardOrgFinal.getByRole('button', { name: /Cancelar sesión/i })).toBeVisible();
    await cardOrgFinal.getByRole('button', { name: /Cancelar sesión/i }).click();

    // El modal de confirmación debe presentarse con advertencias claras de IHC
    const modalCancelar = pageOrg.locator('.modal', { hasText: /Cancelar sesión de estudio/i });
    await expect(modalCancelar).toBeVisible();
    await expect(modalCancelar.getByText(/Consecuencias de IHC/i)).toBeVisible();

    // Escribir el motivo obligatorio (>= 5 caracteres)
    const inputMotivo = modalCancelar.locator('#motivo-cancelacion-input');
    await inputMotivo.fill(motivoOficial);

    // Confirmar la cancelación formal
    await modalCancelar.getByRole('button', { name: 'Confirmar cancelación' }).click();
    await expect(pageOrg.getByText(/Sesión cancelada exitosamente/i)).toBeVisible();

    // ========================================================================
    // PASO 7: Comprobaciones en la vista del Organizador
    // - Badge 🚫 Cancelada
    // - Alerta informativa con el motivo oficial
    // - Botón de control de asistencia bloqueado / ausente
    // ========================================================================
    await pageOrg.reload();
    const cardOrgCancelada = pageOrg.locator('.card', { hasText: nombreSesion });
    await expect(cardOrgCancelada.getByText(/Cancelada/i).first()).toBeVisible();
    await expect(cardOrgCancelada.getByText(motivoOficial).first()).toBeVisible();
    await expect(cardOrgCancelada.getByRole('button', { name: /Control de asistencia/i })).toHaveCount(0);

    // ========================================================================
    // PASO 8: Comprobaciones en los participantes de los 3 estados
    // - Fernando (ex-aceptado) pasa a 'cancelada'
    // - Brayan (ex-pendiente) pasa a 'cancelada'
    // - Ana (ex-en_espera) pasa a 'cancelada'
    // - Todos ven el motivo oficial provisto por el docente
    // - Ninguno puede volver a solicitar unirse (botón deshabilitado)
    // ========================================================================
    // 1. Verificación para Fernando (Confirmado -> Cancelado)
    await pageEst1.goto('/sesions');
    await pageEst1.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst1.getByRole('button', { name: 'Buscar' }).click();
    await pageEst1.waitForTimeout(500);
    const cardEst1Post = pageEst1.locator('.card', { hasText: nombreSesion });
    await expect(cardEst1Post.getByText(/Cancelada/i).first()).toBeVisible();
    await expect(cardEst1Post.getByText(motivoOficial).first()).toBeVisible();
    await expect(cardEst1Post.getByRole('button', { name: /No se admiten nuevas solicitudes/i })).toBeDisabled();

    // 2. Verificación para Brayan (Pendiente -> Cancelado)
    await pageEst2.goto('/sesions');
    await pageEst2.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst2.getByRole('button', { name: 'Buscar' }).click();
    await pageEst2.waitForTimeout(500);
    const cardEst2Post = pageEst2.locator('.card', { hasText: nombreSesion });
    await expect(cardEst2Post.getByText(/Cancelada/i).first()).toBeVisible();
    await expect(cardEst2Post.getByText(motivoOficial).first()).toBeVisible();
    await expect(cardEst2Post.getByRole('button', { name: /No se admiten nuevas solicitudes/i })).toBeDisabled();

    // 3. Verificación para Ana (En Espera -> Cancelada)
    await pageEst3.goto('/sesions');
    await pageEst3.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst3.getByRole('button', { name: 'Buscar' }).click();
    await pageEst3.waitForTimeout(500);
    const cardEst3Post = pageEst3.locator('.card', { hasText: nombreSesion });
    await expect(cardEst3Post.getByText(/Cancelada/i).first()).toBeVisible();
    await expect(cardEst3Post.getByText(motivoOficial).first()).toBeVisible();
    await expect(cardEst3Post.getByRole('button', { name: /No se admiten nuevas solicitudes/i })).toBeDisabled();

    // 4. Verificación en el Dashboard del participante (/dashboard pestaña solicitudes)
    await pageEst1.goto('/dashboard?tab=solicitudes');
    await expect(pageEst1.getByText(nombreSesion).first()).toBeVisible();
    await expect(pageEst1.getByText(/Sesión cancelada por el organizador/i).first()).toBeVisible();
    await expect(pageEst1.getByText(motivoOficial).first()).toBeVisible();

    // ========================================================================
    // PASO 9: Captura de pantalla para evidencias oficiales
    // ========================================================================
    await pageEst1.screenshot({
      path: 'evidencias/captura_tarea9_cancelar_sesion.png',
      fullPage: true,
    });

    // Cerrar contextos de navegación limpios
    await contextOrg.close();
    await contextEst1.close();
    await contextEst2.close();
    await contextEst3.close();
  });

  // --------------------------------------------------------------------------
  // TEST 2: Restricciones de Seguridad y Manejo de Errores en Backend (HTTP 403 / 400)
  // --------------------------------------------------------------------------
  test('2. Seguridad y Reglas de Negocio: Rechaza cancelación por no-organizador (HTTP 403) y motivo menor a 5 caracteres (HTTP 400)', async ({ request }) => {
    // 1. Iniciar sesión como organizador (Carlos Mendoza) para obtener token
    const loginOrg = await request.post('http://localhost:8000/login', {
      data: {
        email: 'carlos.mendoza@studymatch.com',
        password: 'Password123!',
      },
    });
    expect(loginOrg.status()).toBe(200);
    const bodyOrg = await loginOrg.json();
    const tokenOrg = bodyOrg.token;

    // 2. Crear una nueva sesión de prueba
    const crearSesionRes = await request.post('http://localhost:8000/guardar-nuevo', {
      headers: { Authorization: `Bearer ${tokenOrg}` },
      data: {
        nombre: `Sesión de Validación Reglas ${Date.now()}`,
        materia: 'Cálculo',
        modalidad: 'presencial',
        cupo: 5,
        fecha: '2026-11-30',
        inscripciones: true,
      },
    });
    expect([200, 201]).toContain(crearSesionRes.status());
    const sesionCreada = await crearSesionRes.json();
    const sesionId = sesionCreada.id;

    // 3. Iniciar sesión como estudiante ajeno (Fernando Calani)
    const loginEst = await request.post('http://localhost:8000/login', {
      data: {
        email: 'fernando.calani@studymatch.com',
        password: 'Password123!',
      },
    });
    expect(loginEst.status()).toBe(200);
    const bodyEst = await loginEst.json();
    const tokenEst = bodyEst.token;

    // 4. Intento de cancelar por un usuario ajeno (HTTP 403 FORBIDDEN esperado)
    const cancelacionNoAutorizada = await request.post(`http://localhost:8000/sesiones/${sesionId}/cancelar`, {
      headers: { Authorization: `Bearer ${tokenEst}` },
      data: { motivo: 'Intento malicioso de cancelar' },
    });
    expect(cancelacionNoAutorizada.status()).toBe(403);
    const errorAuth = await cancelacionNoAutorizada.json();
    expect(errorAuth.detail).toContain('Solo el organizador de la sesión tiene permisos para cancelarla');

    // 5. Intento de cancelar por el organizador pero con motivo menor a 5 caracteres (HTTP 400 BAD REQUEST esperado)
    const cancelacionMotivoCorto = await request.post(`http://localhost:8000/sesiones/${sesionId}/cancelar`, {
      headers: { Authorization: `Bearer ${tokenOrg}` },
      data: { motivo: 'abc' },
    });
    expect([400, 422]).toContain(cancelacionMotivoCorto.status());

    // 6. Cancelar con motivo válido por el organizador (Éxito esperado)
    const cancelacionValida = await request.post(`http://localhost:8000/sesiones/${sesionId}/cancelar`, {
      headers: { Authorization: `Bearer ${tokenOrg}` },
      data: { motivo: 'Motivo perfectamente justificado para la cancelación' },
    });
    expect(cancelacionValida.status()).toBe(200);

    // 7. Intento de solicitar unirse a la sesión cancelada (Bloqueo estricto esperado)
    const solicitudBloqueada = await request.post(`http://localhost:8000/sesiones/${sesionId}/solicitar`, {
      headers: { Authorization: `Bearer ${tokenEst}` },
    });
    expect(solicitudBloqueada.status()).toBe(400);
    const errorSolicitud = await solicitudBloqueada.json();
    expect(errorSolicitud.detail).toMatch(/cancelada|cerradas/i);
  });

  // --------------------------------------------------------------------------
  // TEST 3: Telemetría y Panel /analitica con Embudos de Conversión (Parte A)
  // --------------------------------------------------------------------------
  test('3. Telemetría y Panel /analitica: Visualiza embudos, tasas de caída y justificación de diseño IHC', async ({ page }) => {
    // 1. Iniciar sesión para acceder al panel
    await page.goto('/login');
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();

    // 2. Navegar a /analitica
    await page.goto('/analitica');

    // 3. Comprobar encabezado canónico de la diapositiva 10/13
    await expect(page.getByText('/analitica').first()).toBeVisible();
    await expect(page.getByText('StudyMatch').first()).toBeVisible();

    // 4. Comprobar tarjetas obligatorias de telemetría
    await expect(page.getByText('solicitud_iniciada').first()).toBeVisible();
    await expect(page.getByText('solicitud_enviada').first()).toBeVisible();
    await expect(page.getByText('terminan').first()).toBeVisible();
    await expect(page.getByText(/búsquedas sin resultado/i).first()).toBeVisible();

    // 5. Comprobar sección de embudos de conversión por flujo principal (Diapositiva 11/13)
    await expect(page.getByText('Embudos de Conversión por Flujo Principal').first()).toBeVisible();
    await expect(page.getByText('Solicitud de ingreso a sesión').first()).toBeVisible();
    await expect(page.getByText('Cancelación formal de sesión').first()).toBeVisible();

    // 6. Comprobar cuadro de análisis de la mayor caída y decisión de diseño IHC
    await expect(page.getByText(/Paso con la mayor caída detectado/i)).toBeVisible();
    await expect(page.getByText(/Decisión de diseño IHC que cambiaríamos/i)).toBeVisible();

    // 7. Comprobar consulta canónica SELECT
    await expect(page.getByText('SELECT evento, COUNT(*)').first()).toBeVisible();
  });

});
