import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * ============================================================================
 * TAREA 7 - SUITE E2E: REPROGRAMACIÓN CON RECONFIRMACIÓN Y MEJORA POR FEEDBACK
 * ============================================================================
 * 
 * Requisitos evaluados (IHC Clase 19):
 * 1. MEJORA POR FEEDBACK:
 *    - Selector de inscripciones abiertas/cerradas eliminado del formulario.
 *    - Datalist con sugerencias de materias en el campo Materia.
 *    - Botón "Cancelar" en el formulario de creación.
 * 2. FUNCIONALIDAD OBLIGATORIA (StudyMatch):
 *    - El organizador cambia fecha e indica el motivo.
 *    - Los participantes confirmados pasan a pendientes de reconfirmación y conservan temporalmente su cupo.
 *    - Mientras haya reconfirmaciones pendientes, no se admite otra reprogramación.
 *    - Escenario mínimo a demostrar:
 *      * Dos participantes: uno reconfirma y otro se retira.
 *      * La primera persona en espera asciende una sola vez.
 */

test.describe('Tarea 7 - Reprogramación con Reconfirmación y Mejoras por Feedback', () => {

  // ============================================================================
  // TEST 1: Verificación de las mejoras aplicadas por el feedback de la Clase 19
  // ============================================================================
  test('1. Feedback: Formulario simplificado sin selector redundante, con datalist y boton cancelar', async ({ page }) => {
    // 1. Iniciar sesión con Carlos Mendoza
    await page.goto('/login');
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(page.getByRole('heading', { name: /Bienvenido, Carlos Mendoza/i })).toBeVisible();

    // 2. Ir a la pantalla de creación de sesión
    await page.getByRole('link', { name: /crear sesión/i }).click();
    await expect(page.getByRole('heading', { name: 'Nueva sesion de estudio' })).toBeVisible();

    // Verificación 1: El selector redundante de "Inscripciones abiertas/cerradas" ya NO existe
    await expect(page.getByText('Inscripciones:')).toHaveCount(0);
    await expect(page.locator('input[name="checkdeinscripciones"]')).toHaveCount(0);

    // Verificación 2: El campo Materia tiene datalist con sugerencias
    const inputMateria = page.locator('#materia');
    await expect(inputMateria).toBeVisible();
    await expect(inputMateria).toHaveAttribute('list', 'materias-sugeridas');
    const datalist = page.locator('datalist#materias-sugeridas');
    await expect(datalist).toBeAttached();

    // Verificación 3: El botón "Cancelar" está presente y redirige a /sesions
    const btnCancelar = page.getByRole('link', { name: 'Cancelar' });
    await expect(btnCancelar).toBeVisible();
    await btnCancelar.click();
    await expect(page).toHaveURL(/\/sesions/);
  });


  // ============================================================================
  // TEST 2: Escenario Mínimo Obligatorio de Tarea 7
  // Dos participantes: uno reconfirma y otro se retira -> Primero en espera asciende
  // ============================================================================
  test('2. Feature Tarea 7: Reprogramar sesion -> Uno reconfirma, otro se retira -> Primero en espera asciende una vez', async ({ browser }) => {
    // Aumentar tiempo límite para permitir los 8 pasos concurrentes entre 4 usuarios reales
    test.setTimeout(90000);

    const ts = Date.now();
    const nombreSesion = `Taller Reprogramación IHC - ${ts}`;

    // --------------------------------------------------------------------------
    // PASO 1: Organizador (Carlos) crea una sesión con cupo = 2
    // --------------------------------------------------------------------------
    const ctxOrganizador = await browser.newContext();
    const pageOrg = await ctxOrganizador.newPage();

    await pageOrg.goto('/login');
    await pageOrg.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await pageOrg.getByLabel('Password').fill('Password123!');
    await pageOrg.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageOrg.getByRole('heading', { name: /Bienvenido, Carlos Mendoza/i })).toBeVisible();

    await pageOrg.goto('/new-study');
    await pageOrg.getByLabel('nombre').fill(nombreSesion);
    await pageOrg.locator('#materia').fill('Interacción Hombre-Computador');
    await pageOrg.getByLabel('cupo').fill('2'); // Cupo estricto = 2 personas
    await pageOrg.getByLabel('fecha').fill('2026-11-20');
    await pageOrg.getByRole('button', { name: 'Crear sesión' }).click();
    await expect(pageOrg.getByText('Sesión de estudio registrada correctamente.')).toBeVisible();

    // --------------------------------------------------------------------------
    // PASO 2: Estudiante 1 (Ana Torres) solicita y es aceptada (Cupo: 1 de 2)
    // --------------------------------------------------------------------------
    const ctxEst1 = await browser.newContext();
    const pageEst1 = await ctxEst1.newPage();

    await pageEst1.goto('/login');
    await pageEst1.getByLabel('Email').fill('ana.torres@studymatch.com');
    await pageEst1.getByLabel('Password').fill('Password123!');
    await pageEst1.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageEst1.getByRole('heading', { name: /Bienvenido, Ana Torres/i })).toBeVisible();

    await pageEst1.goto('/sesions');
    await pageEst1.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst1.getByRole('button', { name: 'Buscar' }).click();

    const cardEst1 = pageEst1.locator('.card', { has: pageEst1.getByRole('heading', { name: nombreSesion }) });
    await expect(cardEst1).toBeVisible();
    await cardEst1.getByRole('button', { name: 'Solicitar unirme' }).click();
    await expect(pageEst1.getByText(/solicitud enviada correctamente/i)).toBeVisible();

    // Carlos acepta a Ana
    await pageOrg.goto('/sesions');
    await pageOrg.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageOrg.getByRole('button', { name: 'Buscar' }).click();
    const cardOrg = pageOrg.locator('.card', { has: pageOrg.getByRole('heading', { name: nombreSesion }) });
    await cardOrg.getByRole('button', { name: /gestionar solicitudes/i }).click();
    await cardOrg.getByRole('button', { name: '✓ Aceptar' }).click();
    await expect(pageOrg.getByText(/solicitud aceptada correctamente/i)).toBeVisible();
    await expect(cardOrg.getByText(/1\s+de\s+2/)).toBeVisible();

    // --------------------------------------------------------------------------
    // PASO 3: Estudiante 2 (Fernando Calani) solicita y es aceptado (Cupo: 0 de 2, Lleno)
    // --------------------------------------------------------------------------
    const ctxEst2 = await browser.newContext();
    const pageEst2 = await ctxEst2.newPage();

    await pageEst2.goto('/login');
    await pageEst2.getByLabel('Email').fill('fernando.calani@studymatch.com');
    await pageEst2.getByLabel('Password').fill('Password123!');
    await pageEst2.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageEst2.getByRole('heading', { name: /Bienvenido, Fernando Calani/i })).toBeVisible();

    await pageEst2.goto('/sesions');
    await pageEst2.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst2.getByRole('button', { name: 'Buscar' }).click();
    const cardEst2 = pageEst2.locator('.card', { has: pageEst2.getByRole('heading', { name: nombreSesion }) });
    await cardEst2.getByRole('button', { name: 'Solicitar unirme' }).click();
    await expect(pageEst2.getByText(/solicitud enviada correctamente/i)).toBeVisible();

    // Carlos acepta a Fernando -> Sesión llena (0 de 2, Lleno)
    await pageOrg.reload();
    await pageOrg.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageOrg.getByRole('button', { name: 'Buscar' }).click();
    const cardOrg2 = pageOrg.locator('.card', { has: pageOrg.getByRole('heading', { name: nombreSesion }) });
    await cardOrg2.getByRole('button', { name: /gestionar solicitudes/i }).click();
    await cardOrg2.getByRole('button', { name: '✓ Aceptar' }).click();
    await expect(pageOrg.getByText(/solicitud aceptada correctamente/i)).toBeVisible();
    await expect(cardOrg2.getByText('Lleno')).toBeVisible();

    // --------------------------------------------------------------------------
    // PASO 4: Estudiante 3 (Brayan Gonzales) entra en lista de espera (Lugar #1)
    // --------------------------------------------------------------------------
    const ctxEst3 = await browser.newContext();
    const pageEst3 = await ctxEst3.newPage();

    await pageEst3.goto('/login');
    await pageEst3.getByLabel('Email').fill('brayan.gonzales@studymatch.com');
    await pageEst3.getByLabel('Password').fill('Password123!');
    await pageEst3.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageEst3.getByRole('heading', { name: /Bienvenido, Brayan Gonzales/i })).toBeVisible();

    await pageEst3.goto('/sesions');
    await pageEst3.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst3.getByRole('button', { name: 'Buscar' }).click();
    const cardEst3 = pageEst3.locator('.card', { has: pageEst3.getByRole('heading', { name: nombreSesion }) });
    await expect(cardEst3.getByText('Lleno')).toBeVisible();
    await cardEst3.getByRole('button', { name: 'Unirme a la lista de espera' }).click();
    await expect(pageEst3.getByText(/has ingresado a la lista de espera/i)).toBeVisible();
    await expect(cardEst3.getByText(/lugar #1/i).first()).toBeVisible();

    // --------------------------------------------------------------------------
    // PASO 5: Organizador (Carlos) reprograma la sesión indicando motivo
    // Regla: Los participantes confirmados pasan a pendientes de reconfirmación.
    // --------------------------------------------------------------------------
    await pageOrg.reload();
    await pageOrg.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageOrg.getByRole('button', { name: 'Buscar' }).click();
    const cardOrgReprog = pageOrg.locator('.card', { has: pageOrg.getByRole('heading', { name: nombreSesion }) });

    // Clic en Reprogramar sesión
    await cardOrgReprog.getByRole('button', { name: '📅 Reprogramar sesión' }).click();
    await expect(pageOrg.getByRole('heading', { name: '📅 Reprogramar sesión' })).toBeVisible();

    // Rellenar nueva fecha y motivo
    await pageOrg.locator('#reprog-fecha').fill('2026-11-28');
    await pageOrg.locator('#reprog-motivo').fill('Cruce de horario con examen de Cálculo');
    await pageOrg.getByRole('button', { name: 'Confirmar reprogramación' }).click();
    await expect(pageOrg.getByText(/sesión reprogramada exitosamente/i)).toBeVisible();

    // REGLA CLAVE: Mientras haya reconfirmaciones pendientes, NO se admite otra reprogramación (botón bloqueado)
    await expect(cardOrgReprog.getByRole('button', { name: /bloqueado: pendientes/i })).toBeDisabled();

    // --------------------------------------------------------------------------
    // PASO 6: Participante 1 (Ana Torres) RECONFIRMA su asistencia
    // --------------------------------------------------------------------------
    await pageEst1.reload();
    await pageEst1.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst1.getByRole('button', { name: 'Buscar' }).click();
    const cardAnaReprog = pageEst1.locator('.card', { has: pageEst1.getByRole('heading', { name: nombreSesion }) });

    // Verifica que ve el badge de reconfirmación requerida y el motivo
    await expect(cardAnaReprog.getByText(/requiere reconfirmación/i).first()).toBeVisible();
    await expect(cardAnaReprog.getByText(/cruce de horario con examen de cálculo/i).first()).toBeVisible();

    // Ana hace clic en "Aceptar nueva fecha"
    await cardAnaReprog.getByRole('button', { name: '✅ Aceptar nueva fecha' }).click();
    await expect(pageEst1.getByText(/has reconfirmado tu asistencia/i)).toBeVisible();
    // Vuelve a estar en estado Confirmado
    await expect(cardAnaReprog.getByText(/inscripción confirmada \(estás dentro\)/i)).toBeVisible();

    // Tomar captura de evidencia 1: Participante reconfirmada
    await pageEst1.screenshot({
      path: path.resolve(process.cwd(), 'evidencias', 'captura_tarea7_01_reconfirmacion.png'),
      fullPage: true,
    });

    // --------------------------------------------------------------------------
    // PASO 7: Participante 2 (Fernando Calani) SE RETIRA de la sesión
    // Regla: Retirarse libera el cupo y promueve automáticamente al primero en espera
    // --------------------------------------------------------------------------
    await pageEst2.reload();
    await pageEst2.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst2.getByRole('button', { name: 'Buscar' }).click();
    const cardFerReprog = pageEst2.locator('.card', { has: pageEst2.getByRole('heading', { name: nombreSesion }) });

    await expect(cardFerReprog.getByText(/requiere reconfirmación/i).first()).toBeVisible();
    // Fernando hace clic en "Retirarme"
    await cardFerReprog.getByRole('button', { name: '🚪 Retirarme' }).click();
    await expect(pageEst2.getByText(/has salido de la sesión correctamente/i)).toBeVisible();

    // --------------------------------------------------------------------------
    // PASO 8: La primera persona en espera (Brayan Gonzales) ASCIENDE UNA SOLA VEZ
    // --------------------------------------------------------------------------
    await pageEst3.reload();
    await pageEst3.getByLabel('Buscar por nombre').fill(nombreSesion);
    await pageEst3.getByRole('button', { name: 'Buscar' }).click();
    const cardBrayanPromovido = pageEst3.locator('.card', { has: pageEst3.getByRole('heading', { name: nombreSesion }) });

    // Comprobación 1: Brayan ya NO está en lista de espera, ahora está CONFIRMADO
    await expect(cardBrayanPromovido.getByText(/confirmado/i).first()).toBeVisible();
    await expect(cardBrayanPromovido.getByText(/inscripción confirmada \(estás dentro\)/i)).toBeVisible();

    // Comprobación 2: El botón cambió a "Abandonar sesión", probando que ahora tiene el cupo asignado
    await expect(cardBrayanPromovido.getByRole('button', { name: 'Abandonar sesión' })).toBeVisible();

    // Tomar captura de evidencia 2: Brayan promovido automáticamente por el retiro de Fernando
    await pageEst3.screenshot({
      path: path.resolve(process.cwd(), 'evidencias', 'captura_tarea7_02_promocion_por_retiro.png'),
      fullPage: true,
    });

    // Cerrar contextos para liberar memoria
    await ctxOrganizador.close();
    await ctxEst1.close();
    await ctxEst2.close();
    await ctxEst3.close();
  });

});
