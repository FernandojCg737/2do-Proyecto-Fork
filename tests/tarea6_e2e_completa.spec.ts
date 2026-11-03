import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import * as path from 'path';

/**
 * ==============================================================================
 * TAREA 6 - SUITE DE PRUEBAS END-TO-END (E2E) Y ACCESIBILIDAD PARA STUDYMATCH
 * 
 * Requisitos evaluados (Lámina 13/14 Clase 18):
 *  A - Todos los flujos + Alternativos + Visual + Accesibilidad + Semilla
 *  B - Feature Grande: Lista de espera
 *      - Reglas: Cupo máximo; si se llena, la solicitud entra en espera (FIFO).
 *                Si alguien sale, el primero en espera pasa a confirmado.
 *      - La prueba comprueba: El primero en espera pasa a confirmado automáticamente.
 * ==============================================================================
 */

test.describe('Tarea 6 - Suite Completa E2E: StudyMatch y Lista de Espera', () => {

  // ============================================================================
  // 1. FLUJO PRINCIPAL: Semilla y Autenticación Exitosa (Camino Feliz)
  // ============================================================================
  test('1. Flujo Principal: Inicio de sesión con usuario semilla y acceso al Dashboard', async ({ page }) => {
    // Navegar a la página de inicio de sesión
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Iniciar sesion' })).toBeVisible();

    // Rellenar credenciales del usuario semilla registrado en la base de datos
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();

    // Comprobar que redirige exitosamente al Dashboard privado mostrando el nombre del usuario
    await expect(page.getByRole('heading', { name: /Bienvenido, Carlos Mendoza/i })).toBeVisible();
    await expect(page.getByText('Sesión activa')).toBeVisible();
  });


  // ============================================================================
  // 2. FLUJO ALTERNATIVO: Login Fallido con Credenciales Incorrectas
  // ============================================================================
  test('2. Flujo Alternativo: Login fallido muestra mensaje de error correctivo', async ({ page }) => {
    await page.goto('/login');

    // Intentar inicio de sesión con contraseña equivocada
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('PasswordInvalidoXYZ!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();

    // Verificar que el sistema bloquea el acceso y muestra el mensaje correctivo
    await expect(page.getByText(/correo o contraseña incorrectos/i)).toBeVisible();
    // Comprobar que permanece en la pantalla de login
    await expect(page.getByRole('heading', { name: 'Iniciar sesion' })).toBeVisible();
  });


  // ============================================================================
  // 3. FLUJO ALTERNATIVO: Registro con Correo Ya Existente
  // ============================================================================
  test('3. Flujo Alternativo: Registro con correo duplicado impide creación y notifica', async ({ page }) => {
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Crear cuenta' })).toBeVisible();

    // Rellenar con correo que ya pertenece a un usuario semilla
    await page.getByLabel('Nombre').fill('Carlos Clon');
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Registrarse' }).click();

    // Comprobar que el backend detecta el duplicado y la UI muestra el error
    await expect(page.getByText(/el correo ya está registrado/i)).toBeVisible();
  });


  // ============================================================================
  // 4. FLUJO DE GESTIÓN: Creación de Sesión y Búsqueda con Filtros
  // ============================================================================
  test('4. Flujo de Sesiones: Crear sesión y filtrar por nombre y materia', async ({ page }) => {
    const ts = Date.now();
    const tituloSesion = `Sesion E2E Filtros ${ts}`;

    // 1. Iniciar sesión como Fernando
    await page.goto('/login');
    await page.getByLabel('Email').fill('fernando.calani@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(page.getByRole('heading', { name: /Bienvenido, Fernando Calani/i })).toBeVisible();

    // 2. Ir al formulario de creación
    await page.getByRole('link', { name: /crear sesión/i }).click();
    await expect(page.getByRole('heading', { name: 'Nueva sesion de estudio' })).toBeVisible();

    // 3. Completar campos del formulario
    await page.getByLabel('nombre').fill(tituloSesion);
    await page.getByLabel('Materia').fill('Interacción Hombre-Computador');
    await page.getByLabel('Modalidad').selectOption('virtual');
    await page.getByLabel('cupo').fill('4');
    await page.getByLabel('fecha').fill('2026-11-25');
    await page.getByRole('button', { name: 'Crear sesión' }).click();

    // 4. Verificar mensaje de confirmación
    await expect(page.getByText('Sesión de estudio registrada correctamente.')).toBeVisible();

    // 5. Ir a la vista de sesiones y filtrar
    await page.getByRole('link', { name: 'Ver sesiones' }).click();
    await expect(page.getByRole('heading', { name: 'Sesiones de estudio' })).toBeVisible();

    await page.getByLabel('Buscar por nombre').fill(tituloSesion);
    await page.getByRole('button', { name: 'Buscar' }).click();

    // 6. Verificar que la tarjeta específica aparece con los datos exactos
    const tarjeta = page.locator('.card', { has: page.getByRole('heading', { name: tituloSesion }) });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.getByText('Interacción Hombre-Computador')).toBeVisible();
    await expect(tarjeta.getByText('👑 Organizador')).toBeVisible();
  });


  // ============================================================================
  // 5. FEATURE CENTRAL (PARTE B): Lista de Espera con Promoción Automática FIFO
  //
  // REGLAS EVALUADAS (Lámina 13/14 Clase 18):
  // - Cupo máximo: Si la sesión se llena, la siguiente solicitud entra a lista de espera.
  // - Si alguien sale: El primero de la lista de espera pasa automáticamente a confirmado.
  // LA PRUEBA COMPRUEBA:
  // - El primer estudiante en espera pasa automáticamente a confirmado.
  // ============================================================================
  test('5. Feature Lista de Espera: Sesión llena -> Entra en espera -> Sale confirmado -> Primero en espera pasa a confirmado', async ({ browser }) => {
    // Generar nombre dinámico con marca de tiempo para asegurar que la sesión sea única e independiente
    const ts = Date.now();
    const nombreSesionEspera = `Taller IHC Cupo 1 - ${ts}`;

    // --------------------------------------------------------------------------
    // PASO 1: Organizador (Carlos Mendoza) crea una sesión con cupo máximo = 1
    // Usamos contextos independientes de navegador (browser.newContext) para simular
    // navegación concurrente de usuarios reales sin interferencias de cookies ni tokens.
    // --------------------------------------------------------------------------
    const ctxOrganizador = await browser.newContext();
    const pageOrg = await ctxOrganizador.newPage();

    // 1.1 Iniciar sesión con Carlos Mendoza
    await pageOrg.goto('/login');
    await pageOrg.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await pageOrg.getByLabel('Password').fill('Password123!');
    await pageOrg.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageOrg.getByRole('heading', { name: /Bienvenido, Carlos Mendoza/i })).toBeVisible();

    // 1.2 Ir a la pantalla de crear sesión y configurar cupo estricto = 1
    await pageOrg.getByRole('link', { name: /crear sesión/i }).click();
    await pageOrg.getByLabel('nombre').fill(nombreSesionEspera);
    await pageOrg.getByLabel('Materia').fill('Interacción Hombre-Computador');
    await pageOrg.getByLabel('Modalidad').selectOption('virtual');
    await pageOrg.getByLabel('cupo').fill('1'); // Regla: Cupo máximo = 1 persona
    await pageOrg.getByLabel('fecha').fill('2026-11-28');
    await pageOrg.getByRole('button', { name: 'Crear sesión' }).click();
    await expect(pageOrg.getByText('Sesión de estudio registrada correctamente.')).toBeVisible();


    // --------------------------------------------------------------------------
    // PASO 2: Estudiante 1 (Ana Torres) solicita unirse a la sesión
    // --------------------------------------------------------------------------
    const ctxEstudiante1 = await browser.newContext();
    const pageEst1 = await ctxEstudiante1.newPage();

    // 2.1 Login como Ana Torres
    await pageEst1.goto('/login');
    await pageEst1.getByLabel('Email').fill('ana.torres@studymatch.com');
    await pageEst1.getByLabel('Password').fill('Password123!');
    await pageEst1.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageEst1.getByRole('heading', { name: /Bienvenido, Ana Torres/i })).toBeVisible();

    // 2.2 Buscar la sesión recién creada
    await pageEst1.goto('/sesions');
    await pageEst1.getByLabel('Buscar por nombre').fill(nombreSesionEspera);
    await pageEst1.getByRole('button', { name: 'Buscar' }).click();

    // 2.3 Enviar solicitud de unión mientras todavía hay 1 cupo disponible
    const cardEst1 = pageEst1.locator('.card', { has: pageEst1.getByRole('heading', { name: nombreSesionEspera }) });
    await expect(cardEst1).toBeVisible();
    await cardEst1.getByRole('button', { name: 'Solicitar unirme' }).click();
    // Validar que la solicitud quedó pendiente de respuesta
    await expect(pageEst1.getByText(/solicitud enviada correctamente/i)).toBeVisible();
    await expect(cardEst1.getByRole('button', { name: 'Cancelar solicitud' })).toBeVisible();


    // --------------------------------------------------------------------------
    // PASO 3: Organizador (Carlos) acepta a Ana Torres -> Cupo disponible = 0 (SESIÓN LLENA)
    // --------------------------------------------------------------------------
    await pageOrg.goto('/sesions');
    await pageOrg.getByLabel('Buscar por nombre').fill(nombreSesionEspera);
    await pageOrg.getByRole('button', { name: 'Buscar' }).click();

    const cardOrg = pageOrg.locator('.card', { has: pageOrg.getByRole('heading', { name: nombreSesionEspera }) });
    await expect(cardOrg).toBeVisible();
    await cardOrg.getByRole('button', { name: /gestionar solicitudes/i }).click();
    await expect(cardOrg.getByText('Ana Torres')).toBeVisible();
    // Carlos acepta la solicitud de Ana
    await cardOrg.getByRole('button', { name: '✓ Aceptar' }).click();

    // Regla: Se descuenta el cupo disponible -> Ahora muestra '0 de 1' y el badge 'Lleno'
    await expect(cardOrg.getByText('0 de 1')).toBeVisible();
    await expect(cardOrg.getByText('Lleno')).toBeVisible();


    // --------------------------------------------------------------------------
    // PASO 4: Estudiante 2 (Brayan Gonzales) entra a la sesión que ya está LLENA
    // REGLA: No se le niega el acceso; la interfaz le ofrece "Unirme a la lista de espera"
    // --------------------------------------------------------------------------
    const ctxEstudiante2 = await browser.newContext();
    const pageEst2 = await ctxEstudiante2.newPage();

    // 4.1 Login como Brayan Gonzales
    await pageEst2.goto('/login');
    await pageEst2.getByLabel('Email').fill('brayan.gonzales@studymatch.com');
    await pageEst2.getByLabel('Password').fill('Password123!');
    await pageEst2.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(pageEst2.getByRole('heading', { name: /Bienvenido, Brayan Gonzales/i })).toBeVisible();

    // 4.2 Buscar la sesión llena
    await pageEst2.goto('/sesions');
    await pageEst2.getByLabel('Buscar por nombre').fill(nombreSesionEspera);
    await pageEst2.getByRole('button', { name: 'Buscar' }).click();

    const cardEst2 = pageEst2.locator('.card', { has: pageEst2.getByRole('heading', { name: nombreSesionEspera }) });
    await expect(cardEst2).toBeVisible();
    await expect(cardEst2.getByText('Lleno')).toBeVisible();

    // 4.3 Comprobar que aparece el botón "Unirme a la lista de espera" y hacer clic
    const btnEspera = cardEst2.getByRole('button', { name: 'Unirme a la lista de espera' });
    await expect(btnEspera).toBeVisible();
    await btnEspera.click();

    // 4.4 Verificar que el backend lo registra con estado 'en_espera' y posición ordinal #1 (FIFO)
    await expect(pageEst2.getByText(/has ingresado a la lista de espera/i)).toBeVisible();
    await expect(cardEst2.getByText(/lugar #1/i).first()).toBeVisible();
    await expect(cardEst2.getByRole('button', { name: 'Salir de lista de espera' })).toBeVisible();

    // Guardar evidencia fotográfica del paso: Brayan en Lista de Espera con Lugar #1
    await pageEst2.screenshot({
      path: path.resolve(process.cwd(), 'evidencias', 'captura_01_lista_espera_lugar1.png'),
      fullPage: true,
    });


    // --------------------------------------------------------------------------
    // PASO 5: Estudiante 1 (Ana Torres, la confirmada) ABANDONA LA SESIÓN
    // --------------------------------------------------------------------------
    await pageEst1.goto('/sesions');
    await pageEst1.getByLabel('Buscar por nombre').fill(nombreSesionEspera);
    await pageEst1.getByRole('button', { name: 'Buscar' }).click();

    const cardAna = pageEst1.locator('.card', { has: pageEst1.getByRole('heading', { name: nombreSesionEspera }) });
    const btnAbandonar = cardAna.getByRole('button', { name: 'Abandonar sesión' });
    await expect(btnAbandonar).toBeVisible();
    // Ana hace clic en "Abandonar sesión"
    await btnAbandonar.click();

    // Comprobar que Ana recibe el mensaje de confirmación de salida
    await expect(pageEst1.getByText(/has salido de la sesión/i)).toBeVisible();


    // --------------------------------------------------------------------------
    // PASO 6: LA COMPROBACIÓN CENTRAL DE LA PRÁCTICA (Requisito IHC Clase 18):
    // "si alguien sale, entra el primero. La prueba comprueba: El primero en espera pasa a confirmado."
    // --------------------------------------------------------------------------
    // Brayan recarga su vista de sesiones para comprobar su nuevo estado en la base de datos
    await pageEst2.reload();
    await pageEst2.getByLabel('Buscar por nombre').fill(nombreSesionEspera);
    await pageEst2.getByRole('button', { name: 'Buscar' }).click();

    const cardBrayanActualizado = pageEst2.locator('.card', { has: pageEst2.getByRole('heading', { name: nombreSesionEspera }) });

    // ASERCIÓN CLAVE 1: Brayan ya NO tiene el badge de espera, ahora tiene el badge de "Confirmado"
    await expect(cardBrayanActualizado.getByText(/confirmado/i).first()).toBeVisible();

    // ASERCIÓN CLAVE 2: En la sección inferior ve el mensaje "Inscripción confirmada (estás dentro)"
    await expect(cardBrayanActualizado.getByText(/inscripción confirmada \(estás dentro\)/i)).toBeVisible();

    // ASERCIÓN CLAVE 3: El botón cambió automáticamente a "Abandonar sesión", probando que ahora es titular del cupo
    await expect(cardBrayanActualizado.getByRole('button', { name: 'Abandonar sesión' })).toBeVisible();

    // Guardar evidencia fotográfica del paso: Brayan promovido automáticamente a Confirmado
    await pageEst2.screenshot({
      path: path.resolve(process.cwd(), 'evidencias', 'captura_02_espera_a_confirmado.png'),
      fullPage: true,
    });

    // Cerrar contextos aislados para liberar recursos
    await ctxOrganizador.close();
    await ctxEstudiante1.close();
    await ctxEstudiante2.close();
  });


  // ============================================================================
  // 6. PRUEBA VISUAL: Captura de pantalla de la interfaz con Lista de Espera
  // ============================================================================
  test('6. Prueba Visual: Captura de pantalla y verificación visual de tarjetas', async ({ page }) => {
    // Iniciar sesión con Ana Torres
    await page.goto('/login');
    await page.getByLabel('Email').fill('ana.torres@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible();

    // Navegar a sesiones
    await page.goto('/sesions');
    await expect(page.getByRole('heading', { name: 'Sesiones de estudio' })).toBeVisible();

    // Esperar a que las tarjetas carguen
    await expect(page.locator('.card').first()).toBeVisible();

    // Guardar captura de pantalla en la carpeta evidencias/ para el informe tarea-6.md
    const screenshotPath = path.resolve(process.cwd(), 'evidencias', 'captura_interfaz_sesiones_e2e.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });

    // Validar visibilidad de componentes visuales clave
    await expect(page.getByRole('link', { name: '+ Crear nueva sesión' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Buscar' })).toBeVisible();
  });


  // ============================================================================
  // 7. AUDITORÍA DE ACCESIBILIDAD AUTOMATIZADA: AxeBuilder (@axe-core/playwright)
  // Cumple con el requisito explícito de accesibilidad y @axe-core/playwright
  // ============================================================================
  test('7. Accesibilidad: Auditoría Axe en Login, Sesiones y Dashboard', async ({ page }) => {
    // 1. Auditoría en la página de Login
    await page.goto('/login');
    const resultadosLogin = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .disableRules(['color-contrast']) // El contraste se evalúa en modo claro según el tema de Bootstrap
      .analyze();

    expect(resultadosLogin.violations).toEqual([]);

    // 2. Iniciar sesión para auditar vistas autenticadas
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible();

    // 3. Auditoría en el Dashboard
    const resultadosDashboard = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(resultadosDashboard.violations).toEqual([]);

    // 4. Auditoría en el catálogo de sesiones
    await page.goto('/sesions');
    await expect(page.getByRole('heading', { name: 'Sesiones de estudio' })).toBeVisible();

    const resultadosSesiones = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();

    expect(resultadosSesiones.violations).toEqual([]);
  });

});
