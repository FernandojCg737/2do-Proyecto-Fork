import { test, expect } from '@playwright/test';

/**
 * ============================================================================
 * CLASE 21 - SUITE DE ANALÍTICA DE INTERACCIÓN (TELEMETRÍA IHC)
 * ============================================================================
 * 
 * Requisitos y rúbrica obligatoria:
 * 1. Diapositiva 7/13: "El evento en una función de siete líneas"
 * 2. Diapositiva 8/13: "Si no hay prueba, no sabemos si el evento existe"
 *    - El evento se dispara una vez.
 *    - Las propiedades son las definidas y ninguna más.
 *    - No aparece ningún dato personal (Privacidad IHC).
 * 3. Diapositiva 9/13: "Dos eventos, un panel, una decisión"
 *    - StudyMatch: evento de inicio 'solicitud_iniciada', evento de éxito 'solicitud_enviada'.
 * 4. Diapositiva 10/13: "Sus eventos tienen que verse en un panel" (/analitica)
 */

test.describe('Clase 21 - Telemetría y Analítica de Interacción (StudyMatch)', () => {

  // --------------------------------------------------------------------------
  // TEST 1: Comprobación del evento de inicio 'solicitud_iniciada'
  // --------------------------------------------------------------------------
  test('1. Registra evento de inicio: solicitud_iniciada con propiedades mínimas y sin datos personales', async ({ request }) => {
    // 1. Simular inicio de solicitud para la materia Física
    const respuesta = await request.post('http://localhost:8000/eventos', {
      data: {
        evento: 'solicitud_iniciada',
        props: {
          materia: 'fisica',
          // Intentar inyectar datos personales para verificar regla de privacidad
          email: 'alumno@privado.com',
          nombre: 'Juan Perez',
        },
      },
    });

    expect(respuesta.status()).toBe(201);
    const body = await respuesta.json();

    // Comprobaciones Diapositiva 8/13:
    // a) Nombre de evento correcto
    expect(body.evento).toBe('solicitud_iniciada');
    // b) Propiedades mínimas preservadas
    expect(body.props.materia).toBe('fisica');
    // c) Regla de Privacidad: Se eliminaron los datos personales sensibles
    expect(body.props.email).toBeUndefined();
    expect(body.props.nombre).toBeUndefined();
    // d) Marca temporal presente
    expect(body.fecha).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // TEST 2: Comprobación del evento de éxito 'solicitud_enviada'
  // --------------------------------------------------------------------------
  test('2. Registra evento de éxito: solicitud_enviada tras guardado exitoso', async ({ request }) => {
    // 1. Simular envío exitoso de solicitud para la materia Cálculo
    const respuesta = await request.post('http://localhost:8000/eventos', {
      data: {
        evento: 'solicitud_enviada',
        props: {
          materia: 'calculo',
        },
      },
    });

    expect(respuesta.status()).toBe(201);
    const body = await respuesta.json();

    // Comprobaciones Diapositiva 8/13:
    expect(body.evento).toBe('solicitud_enviada');
    expect(body.props.materia).toBe('calculo');
    expect(body.props.usuario).toBeUndefined();
    expect(body.fecha).toBeDefined();
  });

  // --------------------------------------------------------------------------
  // TEST 3: Comprobación del Panel Propio /analitica (Diapositiva 10/13)
  // --------------------------------------------------------------------------
  test('3. Panel /analitica visualiza conteos por evento, % de conversión y últimos eventos', async ({ page }) => {
    // 1. Iniciar sesión con un usuario válido
    await page.goto('http://localhost:5173/login');
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();

    // 2. Navegar al panel propio /analitica
    await page.goto('http://localhost:5173/analitica');

    // 3. Verificar encabezado canónico de la diapositiva 10/13
    await expect(page.getByText('/analitica').first()).toBeVisible();
    await expect(page.getByText('StudyMatch').first()).toBeVisible();

    // 4. Verificar etiquetas de las tarjetas
    await expect(page.getByText('solicitud_iniciada').first()).toBeVisible();
    await expect(page.getByText('solicitud_enviada').first()).toBeVisible();
    await expect(page.getByText('terminan').first()).toBeVisible();

    // 5. Verificar sección de últimos eventos
    await expect(page.getByRole('heading', { name: 'Últimos eventos' })).toBeVisible();

    // 6. Verificar bloque informativo obligatorio de la rúbrica
    await expect(page.getByText('OBLIGATORIO · PANEL PROPIO').first()).toBeVisible();
    await expect(page.getByText('SELECT evento, COUNT(*)').first()).toBeVisible();

    // 7. Tomar captura de pantalla para el informe de evidencias
    await page.screenshot({ path: 'evidencias/captura_clase21_analitica.png', fullPage: true });
  });

});
