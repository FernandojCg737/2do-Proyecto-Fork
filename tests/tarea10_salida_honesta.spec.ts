import { test, expect } from './fixtures/cobertura';

/**
 * ============================================================================
 * TAREA 10 - SALIDA HONESTA, PORTABILIDAD DE DATOS Y ELIMINACIÓN DE CUENTA (IHC)
 * ============================================================================
 * 
 * Materia: Interacción Hombre-Computador (IHC)
 * Producto: StudyMatch
 * Fecha de Entrega: Lunes 16/11/2026, 23:59
 * 
 * Rúbrica y especificaciones oficiales (Diapositivas 12/16 y 13/16):
 * 1. Mis datos: Ver y descargar (JSON o CSV).
 * 2. Regla difícil de StudyMatch:
 *    "Las sesiones que organiza se cancelan y los participantes ven el motivo.
 *     Sale de las listas de espera sin afectar el orden de los demás."
 * 3. Salida clara:
 *    "si la regla bloquea la eliminación, el mensaje dice por qué y qué hacer
 *     para poder eliminarla."
 * 4. Confirmación honesta (Diseño Ético):
 *    - Botones del mismo tamaño y peso visual (Simetría).
 *    - Consecuencias explicadas sin rodeos.
 *    - Sin culpa (sin confirmshaming) y sin pasos de más (sin roach motel).
 * 5. Inhabilitación total:
 *    - Después de eliminarla, esa cuenta no puede iniciar sesión.
 * 6. Telemetría de la Tarea 9 y 10:
 *    - Eventos de inicio, bloqueo y éxito registrados sin datos personales.
 */

test.describe('Tarea 10 · Mis datos y salida honesta (StudyMatch)', () => {

  // --------------------------------------------------------------------------
  // TEST 1: Verificación de visualización de datos y descarga en JSON y CSV
  // --------------------------------------------------------------------------
  test('1. Mis datos: Ver expediente y descargar en formatos abiertos (JSON y CSV)', async ({ page }) => {
    // 1. Iniciar sesión con un usuario existente en la base de datos
    await page.goto('/login');
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(page.getByRole('heading', { name: /Bienvenido, Carlos Mendoza/i })).toBeVisible();

    // 2. Navegar a la pantalla de Mis Datos mediante el pill de navegación
    await page.locator('[data-testid="pill-mis-datos"]').click();
    await expect(page).toHaveURL(/.*\/mis-datos/);
    await expect(page.getByRole('heading', { name: /Mis datos y salida honesta/i })).toBeVisible();

    // 3. Verificar que se despliega la información almacenada y las métricas de perfil en el área principal
    await expect(page.getByRole('main').getByText('Carlos Mendoza')).toBeVisible();
    await expect(page.getByText('carlos.mendoza@studymatch.com')).toBeVisible();
    await expect(page.getByText('Estado: Cuenta activa')).toBeVisible();

    // 4. Capturar evidencia visual de la pantalla de Mis Datos
    await page.screenshot({ path: 'evidencias/captura_tarea10_01_mis_datos_descarga.png', fullPage: true });

    // 5. Probar descarga de datos en formato JSON
    const promesaDescargaJson = page.waitForEvent('download');
    await page.locator('[data-testid="btn-descargar-json"]').click();
    const descargaJson = await promesaDescargaJson;
    expect(descargaJson.suggestedFilename()).toContain('.json');

    // 6. Probar descarga de datos en formato CSV
    const promesaDescargaCsv = page.waitForEvent('download');
    await page.locator('[data-testid="btn-descargar-csv"]').click();
    const descargaCsv = await promesaDescargaCsv;
    expect(descargaCsv.suggestedFilename()).toContain('.csv');

    // 7. Verificar mensaje de confirmación de descarga en la interfaz
    await expect(page.getByText(/Tus datos se descargaron exitosamente/i)).toBeVisible();
  });

  // --------------------------------------------------------------------------
  // TEST 2: Intento bloqueado por la regla de StudyMatch (Por qué y Qué hacer)
  // --------------------------------------------------------------------------
  test('2. Intento bloqueado: La regla de la app bloquea la eliminación si hay sesiones activas sin motivo y explica por qué y qué hacer', async ({ browser, request }) => {
    test.setTimeout(120000);

    // Generar credenciales únicas para un organizador nuevo
    const ts = Date.now();
    const emailOrg = `org.bloqueo.${ts}@studymatch.com`;
    const passwordOrg = 'Password123!';
    const nombreOrg = `Profesor Bloqueo ${ts}`;

    // Paso A: Registrar al organizador directamente vía API para rapidez y aislamiento
    const regRes = await request.post('http://localhost:8000/registro', {
      data: {
        nombre: nombreOrg,
        email: emailOrg,
        password: passwordOrg,
      },
    });
    expect(regRes.status()).toBe(200);

    // Iniciar sesión con el nuevo organizador en el navegador
    const ctxOrg = await browser.newContext();
    const pageOrg = await ctxOrg.newPage();
    await pageOrg.goto('/login');
    await pageOrg.getByLabel('Email').fill(emailOrg);
    await pageOrg.getByLabel('Password').fill(passwordOrg);
    await pageOrg.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageOrg.getByRole('heading', { name: new RegExp(`Bienvenido, ${nombreOrg}`, 'i') })).toBeVisible();

    // Paso B: Crear una sesión de estudio activa
    const nombreSesion = `Sesión Bloqueo Regla ${ts}`;
    await pageOrg.goto('/new-study');
    await pageOrg.getByLabel('nombre').fill(nombreSesion);
    await pageOrg.locator('#materia').fill('Interacción Hombre-Computador');
    await pageOrg.locator('#modalidad').selectOption('presencial');
    await pageOrg.getByLabel('cupo').fill('2');
    await pageOrg.getByLabel('fecha').fill('2026-11-30');
    await pageOrg.getByRole('button', { name: 'Crear sesión' }).click();
    await expect(pageOrg.getByText(/Sesión de estudio registrada correctamente/i)).toBeVisible();

    // Paso C: Estudiante Fernando Calani solicita unirse a esta sesión
    const ctxEst = await browser.newContext();
    const pageEst = await ctxEst.newPage();
    await pageEst.goto('/login');
    await pageEst.getByLabel('Email').fill('fernando.calani@studymatch.com');
    await pageEst.getByLabel('Password').fill('Password123!');
    await pageEst.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageEst.getByRole('heading', { name: /Bienvenido, Fernando Calani/i })).toBeVisible();

    await pageEst.goto('/sesions');
    await pageEst.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst.getByRole('button', { name: 'Buscar' }).click();
    await pageEst.waitForTimeout(500);

    const cardSesionEst = pageEst.locator('.card', { hasText: nombreSesion });
    await expect(cardSesionEst).toBeVisible();
    await cardSesionEst.getByRole('button', { name: 'Solicitar unirme' }).click();
    await expect(cardSesionEst.getByText('⏳ Solicitud pendiente de aprobación')).toBeVisible();

    // Paso D: El organizador intenta eliminar su cuenta SIN ingresar el motivo de cancelación
    await pageOrg.goto('/mis-datos');
    await pageOrg.locator('[data-testid="btn-abrir-modal-eliminar"]').click();

    // Verificar apertura del modal de confirmación honesta
    await expect(pageOrg.getByText('Confirmación de salida honesta')).toBeVisible();

    // Dejar el motivo vacío e ingresar solo la contraseña
    await pageOrg.locator('[data-testid="input-motivo-cancelacion-cuenta"]').fill('');
    await pageOrg.locator('[data-testid="input-password-confirmacion"]').fill(passwordOrg);

    // Intentar confirmar eliminación
    await pageOrg.locator('[data-testid="btn-modal-confirmar-eliminar"]').click();

    // COMPROBACIÓN REQUERIDA (Diapositiva 12/16 y 13/16):
    // El sistema debe bloquear la eliminación y explicar con claridad el por qué y qué hacer
    const alertaBloqueo = pageOrg.locator('[data-testid="alerta-intento-bloqueado"]');
    await expect(alertaBloqueo).toBeVisible();
    await expect(alertaBloqueo).toContainText('Eliminación bloqueada por la regla de la plataforma');
    await expect(alertaBloqueo).toContainText('¿Por qué?');
    await expect(alertaBloqueo).toContainText('¿Qué hacer?');

    // Capturar evidencia del intento bloqueado
    await pageOrg.screenshot({ path: 'evidencias/captura_tarea10_02_intento_bloqueado.png' });

    await ctxOrg.close();
    await ctxEst.close();
  });

  // --------------------------------------------------------------------------
  // TEST 3: Eliminación honesta completa, cascada de sesiones y salida de espera
  // --------------------------------------------------------------------------
  test('3. Eliminación honesta completa: Cancela sesiones con motivo visible, limpia listas de espera y desactiva cuenta', async ({ browser, request }) => {
    test.setTimeout(120000);

    const ts = Date.now();
    const emailOrg = `org.eliminar.${ts}@studymatch.com`;
    const passwordOrg = 'Password123!';
    const nombreOrg = `Organizador Salida ${ts}`;
    const motivoOficial = 'Renuncia a la plataforma por viaje de intercambio académico';

    // 1. Crear organizador vía API
    const regRes = await request.post('http://localhost:8000/registro', {
      data: {
        nombre: nombreOrg,
        email: emailOrg,
        password: passwordOrg,
      },
    });
    expect(regRes.status()).toBe(200);

    const ctxOrg = await browser.newContext();
    const pageOrg = await ctxOrg.newPage();
    await pageOrg.goto('/login');
    await pageOrg.getByLabel('Email').fill(emailOrg);
    await pageOrg.getByLabel('Password').fill(passwordOrg);
    await pageOrg.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageOrg.getByRole('heading', { name: new RegExp(`Bienvenido, ${nombreOrg}`, 'i') })).toBeVisible();

    // 2. Crear sesión activa
    const nombreSesion = `Sesión Cascada Honestidad ${ts}`;
    await pageOrg.goto('/new-study');
    await pageOrg.getByLabel('nombre').fill(nombreSesion);
    await pageOrg.locator('#materia').fill('Cálculo I');
    await pageOrg.locator('#modalidad').selectOption('virtual');
    await pageOrg.getByLabel('cupo').fill('2');
    await pageOrg.getByLabel('fecha').fill('2026-11-28');
    await pageOrg.getByRole('button', { name: 'Crear sesión' }).click();
    await expect(pageOrg.getByText(/Sesión de estudio registrada correctamente/i)).toBeVisible();

    // 3. Estudiante Brayan Gonzales solicita unirse
    const ctxEst = await browser.newContext();
    const pageEst = await ctxEst.newPage();
    await pageEst.goto('/login');
    await pageEst.getByLabel('Email').fill('brayan.gonzales@studymatch.com');
    await pageEst.getByLabel('Password').fill('Password123!');
    await pageEst.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageEst.getByRole('heading', { name: /Bienvenido, Brayan Gonzales/i })).toBeVisible();

    await pageEst.goto('/sesions');
    await pageEst.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst.getByRole('button', { name: 'Buscar' }).click();
    await pageEst.waitForTimeout(500);

    const cardSesionEst = pageEst.locator('.card', { hasText: nombreSesion });
    await expect(cardSesionEst).toBeVisible();
    await cardSesionEst.getByRole('button', { name: 'Solicitar unirme' }).click();
    await expect(cardSesionEst.getByText('⏳ Solicitud pendiente de aprobación')).toBeVisible();

    // 4. El organizador procede con la eliminación honesta cumpliendo la regla
    await pageOrg.goto('/mis-datos');
    await pageOrg.locator('[data-testid="btn-abrir-modal-eliminar"]').click();

    // Capturar evidencia de la confirmación honesta con botones del mismo tamaño
    await pageOrg.screenshot({ path: 'evidencias/captura_tarea10_03_modal_confirmacion_honesta.png' });

    // Ingresar motivo válido y contraseña
    await pageOrg.locator('[data-testid="input-motivo-cancelacion-cuenta"]').fill(motivoOficial);
    await pageOrg.locator('[data-testid="input-password-confirmacion"]').fill(passwordOrg);

    // Confirmar eliminación
    await pageOrg.locator('[data-testid="btn-modal-confirmar-eliminar"]').click();

    // 5. Verificar que fue redirigido a login tras la eliminación
    await expect(pageOrg).toHaveURL(/.*\/login/);
    await expect(pageOrg.getByText(/Tu cuenta ha sido eliminada permanentemente/i)).toBeVisible();

    // 6. Verificar que el participante ahora ve la sesión cancelada con el motivo oficial
    await pageEst.reload();
    await pageEst.goto('/sesions');
    await pageEst.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst.getByRole('button', { name: 'Buscar' }).click();
    await pageEst.waitForTimeout(500);

    const cardCancelada = pageEst.locator('.card', { hasText: nombreSesion });
    await expect(cardCancelada.getByText('🚫 Cancelada').first()).toBeVisible();
    await expect(cardCancelada.getByText(new RegExp(motivoOficial, 'i')).first()).toBeVisible();

    // 7. VERIFICACIÓN CRUCIAL (Diapositiva 12/16):
    // "Después de eliminarla, esa cuenta no puede iniciar sesión."
    await pageOrg.goto('/login');
    await pageOrg.getByLabel('Email').fill(emailOrg);
    await pageOrg.getByLabel('Password').fill(passwordOrg);
    await pageOrg.getByRole('button', { name: 'Iniciar Sesion' }).click();

    // Comprobar rechazo terminante del login
    await expect(pageOrg.getByText(/Esta cuenta ha sido eliminada permanentemente y no puede iniciar sesión/i)).toBeVisible();

    // Capturar evidencia del intento de login bloqueado
    await pageOrg.screenshot({ path: 'evidencias/captura_tarea10_04_cuenta_eliminada_login_bloqueado.png' });

    await ctxOrg.close();
    await ctxEst.close();
  });

  // --------------------------------------------------------------------------
  // TEST 4: Verificación de telemetría y regla de privacidad IHC
  // --------------------------------------------------------------------------
  test('4. Telemetría y Privacidad: Registra eventos de salida honesta en la tabla analítica sin datos personales', async ({ request }) => {
    // 1. Simular evento de inicio de descarga
    const res1 = await request.post('http://localhost:8000/eventos', {
      data: {
        evento: 'descarga_datos_iniciada',
        props: {
          formato: 'json',
          // Intento de inyectar datos personales que deben ser filtrados
          email: 'alumno@privado.com',
          nombre: 'Juan Perez',
        },
      },
    });
    expect(res1.status()).toBe(201);
    const body1 = await res1.json();
    expect(body1.evento).toBe('descarga_datos_iniciada');
    expect(body1.props.formato).toBe('json');
    expect(body1.props.email).toBeUndefined();
    expect(body1.props.nombre).toBeUndefined();

    // 2. Simular evento de intento bloqueado por la regla de la app
    const res2 = await request.post('http://localhost:8000/eventos', {
      data: {
        evento: 'eliminacion_cuenta_bloqueada',
        props: {
          razon: 'motivo_cancelacion_requerido',
          sesiones_afectadas: 2,
        },
      },
    });
    expect(res2.status()).toBe(201);
    const body2 = await res2.json();
    expect(body2.evento).toBe('eliminacion_cuenta_bloqueada');
    expect(body2.props.razon).toBe('motivo_cancelacion_requerido');

    // 3. Simular evento de eliminación completada
    const res3 = await request.post('http://localhost:8000/eventos', {
      data: {
        evento: 'eliminacion_cuenta_completada',
        props: {
          sesiones_canceladas: 2,
          filas_espera_liberadas: 1,
        },
      },
    });
    expect(res3.status()).toBe(201);
    const body3 = await res3.json();
    expect(body3.evento).toBe('eliminacion_cuenta_completada');
    expect(body3.props.sesiones_canceladas).toBe(2);
  });

});
