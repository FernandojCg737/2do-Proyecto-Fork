import { test, expect } from '@playwright/test';

/**
 * ============================================================================
 * CLASE 22 - AUDITORÍA ÉTICA Y CORRECCIÓN DE PATRONES OSCUROS (IHC)
 * ============================================================================
 * 
 * Requisitos y rúbrica de entrega (Diapositivas 9/16, 10/16 y 11/16):
 * 1. Producto asignado: StudyMatch (Detalle de la sesión en /sesions).
 * 2. Patrón asignado: Tipo 3 - Urgencia / Escasez falsa («¡Últimos cupos!» que no sale del dato real).
 * 3. Pregunta para verificar: ¿El mensaje se calcula o está escrito fijo?
 * 4. Principio de diseño ético aplicado:
 *    Principio 1: Honestidad - La interfaz dice la verdad.
 *    (Cupos, plazos y contadores salen de datos reales. Sin urgencia ni escasez inventadas).
 * 5. Requisito de la prueba E2E:
 *    Debe fallar con el 'antes' (cuando existe el patrón oscuro fijo) y
 *    pasar con el 'después' (cuando la interfaz calcula con honestidad y elimina la urgencia falsa).
 */

test.describe('Clase 22 · Auditoría de Patrones Oscuros y Diseño Ético (StudyMatch)', () => {

  // --------------------------------------------------------------------------
  // TEST 1: Detección y erradicación del patrón oscuro de escasez falsa
  // --------------------------------------------------------------------------
  test('1. Erradicación de escasez falsa: No debe existir cartel fijo de "¡Últimos cupos!" cuando hay cupos disponibles reales', async ({ page }) => {
    // 1. Iniciar sesión con un usuario verificado en la plataforma
    await page.goto('/login');
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(page.getByRole('heading', { name: /Bienvenido, Carlos Mendoza/i })).toBeVisible();

    // 2. Navegar a la pantalla de sesiones (Detalle de sesiones en /sesions)
    await page.goto('/sesions');
    await page.waitForLoadState('networkidle');

    // 3. Tomar captura de pantalla de evidencia (se guarda según el estado evaluado)
    const badgeOscuro = page.locator('[data-testid="badge-urgencia-falsa"]');
    const badgeCount = await badgeOscuro.count();

    if (badgeCount > 0) {
      // Si el badge oscuro existe, guardamos la captura del "ANTES" para el reporte
      await page.screenshot({ path: 'evidencias/captura_clase22_antes.png', fullPage: true });
    } else {
      // Si el badge oscuro fue eliminado y corregido, guardamos la captura del "DESPUÉS"
      await page.screenshot({ path: 'evidencias/captura_clase22_despues.png', fullPage: true });
    }

    // 4. VERIFICACIÓN ÉTICA FUNDAMENTAL (Falla con el antes, pasa con el después):
    // Ninguna tarjeta de sesión debe contener badges de urgencia artificial no fundamentados en escasez real
    await expect(page.locator('[data-testid="badge-urgencia-falsa"]')).toHaveCount(0);
    await expect(page.getByText('¡Últimos cupos! Inscríbete ya')).toHaveCount(0);
  });

  // --------------------------------------------------------------------------
  // TEST 2: Principio de Honestidad - Cálculo veraz y transparente de cupos
  // --------------------------------------------------------------------------
  test('2. Principio de Honestidad: La interfaz dice la verdad y calcula la disponibilidad desde datos reales', async ({ page }) => {
    // 1. Iniciar sesión
    await page.goto('/login');
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(page.getByRole('heading', { name: /Bienvenido, Carlos Mendoza/i })).toBeVisible();

    // 2. Navegar a /sesions
    await page.goto('/sesions');
    await page.waitForLoadState('networkidle');

    // 3. Verificar que las sesiones muestran los cupos con neutralidad y transparencia
    const cuposLabel = page.getByText(/Cupos disponibles:/i).first();
    await expect(cuposLabel).toBeVisible();

    // 4. Verificar que las insignias de estado de cupo son honestas y no contienen disparadores engañosos
    const textoPagina = await page.textContent('body');
    expect(textoPagina).not.toContain('⚡ ¡Últimos cupos! Inscríbete ya');
    expect(textoPagina).not.toContain('¡Apúrate o te quedarás sin estudiar!');
  });

});
