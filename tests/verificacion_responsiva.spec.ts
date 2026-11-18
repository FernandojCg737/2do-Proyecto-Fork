import { test, expect } from './fixtures/cobertura';

/**
 * ============================================================================
 * TEST DE VERIFICACIÓN RESPONSIVA Y ARQUITECTURA DE INFORMACIÓN (IHC)
 * ============================================================================
 * Verifica que:
 * 1. En móvil: Solo logo a la izquierda, lupa y hamburguesa a la derecha.
 * 2. El menú hamburguesa contiene todas las opciones (Mis solicitudes, Mis sesiones,
 *    Historial, Analítica, Mis datos, Cerrar sesión) y la lupa lleva a /sesions.
 * 3. En escritorio: Se visualizan todas las opciones completas incluyendo Analítica.
 * 4. La barra redundante de pills ha sido eliminada por completo.
 * 5. Cero desbordamiento horizontal en todas las resoluciones.
 */

test.describe('Verificación de Responsividad y Navbar IHC (StudyMatch)', () => {

  test('Móvil (iPhone 14 / 390x844): Header minimalista con Logo, Lupa y Menú Hamburguesa', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });

    // 1. Iniciar sesión con Carlos Mendoza
    await page.goto('/login');
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(page.getByRole('heading', { name: /Bienvenido, Carlos Mendoza/i })).toBeVisible();

    // 2. Verificar que el logo está visible
    await expect(page.getByRole('link', { name: /StudyMatch/i })).toBeVisible();

    // 3. Verificar que la lupa está visible a la derecha
    const btnLupa = page.getByRole('link', { name: 'Buscar sesiones' });
    await expect(btnLupa).toBeVisible();

    // 4. Verificar que el botón hamburguesa está visible
    const btnHamburguesa = page.getByRole('button', { name: /Abrir menú de opciones|Cerrar menú/i });
    await expect(btnHamburguesa).toBeVisible();

    // 5. Probar que la lupa redirige a /sesions
    await btnLupa.click();
    await expect(page).toHaveURL(/.*\/sesions/);
    await expect(page.getByRole('heading', { name: 'Sesiones de estudio' })).toBeVisible();

    // 6. Verificar que la barra secundaria redundante de pills ya NO aparece
    await expect(page.locator('nav[aria-label="Navegación principal de secciones"]')).toHaveCount(0);

    // 7. Abrir el menú hamburguesa
    await btnHamburguesa.click();

    // 8. Verificar que el menú contiene las opciones requeridas
    await expect(page.getByRole('link', { name: /Mis solicitudes/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Mis sesiones/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Historial/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Analítica/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Mis datos/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cerrar sesión/i })).toBeVisible();

    // 9. Verificar que no hay scroll horizontal
    const noScrollHorizontal = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(noScrollHorizontal).toBe(true);
  });

  test('Escritorio (1280x800): Barra completa con Analítica y sin menú hamburguesa', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });

    await page.goto('/login');
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(page.getByRole('heading', { name: /Bienvenido, Carlos Mendoza/i })).toBeVisible();

    // En escritorio, el botón hamburguesa NO debe estar visible
    const btnHamburguesa = page.getByRole('button', { name: /Abrir menú de opciones/i });
    await expect(btnHamburguesa).toBeHidden();

    // Verificar presencia de todas las opciones en la barra superior
    await expect(page.getByRole('link', { name: '🔍 Buscar sesiones' })).toBeVisible();
    await expect(page.getByRole('link', { name: '📨 Mis solicitudes' })).toBeVisible();
    await expect(page.getByRole('link', { name: '👑 Mis sesiones' })).toBeVisible();
    await expect(page.getByRole('link', { name: '📋 Historial' })).toBeVisible();
    await expect(page.getByRole('link', { name: '📊 Analítica' })).toBeVisible();
    await expect(page.getByRole('link', { name: '🔒 Mis datos' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();

    // Verificar que la barra secundaria redundante de pills no aparece
    await expect(page.locator('nav[aria-label="Navegación principal de secciones"]')).toHaveCount(0);
  });

  test('Formularios de Login y Registro: Centrado responsivo y preparación para teclado virtual en móviles', async ({ page }) => {
    // 1. Probar en tamaño móvil (iPhone 14: 390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');

    // Comprobar que la tarjeta de autenticación está visible y centrada
    const authCard = page.locator('.auth-card');
    await expect(authCard).toBeVisible();

    // Verificar que el contenedor usa flexbox centrado
    const rowContainer = page.locator('.row.justify-content-center.align-items-center');
    await expect(rowContainer).toBeVisible();

    // Comprobar que los campos tienen scroll-margin-top para el teclado virtual
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toBeVisible();
    const scrollMarginTop = await emailInput.evaluate((el) => {
      return window.getComputedStyle(el).scrollMarginTop;
    });
    expect(scrollMarginTop).toBe('100px');

    // Comprobar que tocar la etiqueta enfoca el input (delegación semántica label -> input)
    await page.locator('label[for="email"]').click();
    await expect(emailInput).toBeFocused();

    // 2. Navegar a /register y verificar centrado responsivo
    await page.goto('/register');
    const registerCard = page.locator('.auth-card');
    await expect(registerCard).toBeVisible();

    const nombreInput = page.getByLabel('Nombre');
    await expect(nombreInput).toBeVisible();
    const registerScrollMargin = await nombreInput.evaluate((el) => {
      return window.getComputedStyle(el).scrollMarginTop;
    });
    expect(registerScrollMargin).toBe('100px');

    // Comprobar que al tocar el label 'Password' en /register se enfoca el input
    await page.locator('label[for="password"]').click();
    await expect(page.getByLabel('Password')).toBeFocused();

    // 3. Verificar en escritorio (1280x800) que se mantiene centrado
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(registerCard).toBeVisible();
    const box = await registerCard.boundingBox();
    expect(box).not.toBeNull();
    // En 1280px de ancho, la tarjeta debe estar centrada horizontalmente
    if (box) {
      const cardCenter = box.x + box.width / 2;
      expect(Math.abs(cardCenter - 640)).toBeLessThan(50); // Centrado con margen menor a 50px
    }
  });

  test('Página Principal Home (http://localhost:5173/): Centrado vertical y horizontal responsivo', async ({ page }) => {
    // 1. Probar en móvil (iPhone 14: 390x844)
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    // Comprobar que la tarjeta de bienvenida (hero-card) está visible
    const heroCard = page.locator('.hero-card');
    await expect(heroCard).toBeVisible();

    // Comprobar contenedor centrado vertical y horizontalmente
    const rowContainer = page.locator('.row.justify-content-center.align-items-center');
    await expect(rowContainer).toBeVisible();

    // Verificar presencia de botones de acción
    const btnCrear = page.getByRole('link', { name: /Crear cuenta/i });
    const btnLogin = page.getByRole('link', { name: /Iniciar sesión/i });
    await expect(btnCrear).toBeVisible();
    await expect(btnLogin).toBeVisible();

    // Comprobar que no hay desbordamiento horizontal en móvil
    const noScrollHorizontal = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(noScrollHorizontal).toBe(true);

    // 2. Probar en escritorio (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(heroCard).toBeVisible();

    const box = await heroCard.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // Centrado horizontal en pantalla de 1280px (centro ~640px)
      const cardCenterX = box.x + box.width / 2;
      expect(Math.abs(cardCenterX - 640)).toBeLessThan(50);

      // Centrado vertical (la tarjeta no debe estar pegada al techo ni al fondo)
      expect(box.y).toBeGreaterThan(60); // Hay espacio arriba
      const cardBottom = box.y + box.height;
      expect(cardBottom).toBeLessThan(750); // Hay espacio abajo
    }
  });

  test('Mis datos (/mis-datos): Sección Seguridad y Contraseña con Auto-Layout responsivo y flujo de cambio de clave', async ({ page }) => {
    // 1. Iniciar sesión con usuario semilla
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');
    await page.getByLabel('Email').fill('carlos.mendoza@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Navegar a /mis-datos
    await page.goto('/mis-datos');
    await expect(page.getByRole('heading', { name: /Mis datos y salida honesta/i })).toBeVisible();

    // 3. Verificar que la sección "Seguridad y Contraseña" está visible con Auto-Layout
    const seccionSeguridad = page.locator('text=Seguridad y Contraseña');
    await expect(seccionSeguridad).toBeVisible();

    const btnToggle = page.locator('[data-testid="btn-toggle-cambiar-password"]');
    await expect(btnToggle).toBeVisible();

    // 4. Abrir formulario de cambio de contraseña
    await btnToggle.click();
    const inputActual = page.locator('[data-testid="input-pass-actual"]');
    const inputNueva = page.locator('[data-testid="input-pass-nueva"]');
    const btnGuardar = page.locator('[data-testid="btn-guardar-nueva-password"]');

    await expect(inputActual).toBeVisible();
    await expect(inputNueva).toBeVisible();
    await expect(btnGuardar).toBeVisible();

    // 5. Probar intento con contraseña actual incorrecta (Validación y prevención de errores)
    await inputActual.fill('claveErronea123');
    await inputNueva.fill('NuevaClave123!');
    await btnGuardar.click();

    // Debe mostrar alerta de error
    await expect(page.locator('.alert-danger')).toBeVisible();

    // 6. Probar cambio de contraseña válido
    await inputActual.fill('Password123!');
    await inputNueva.fill('TemporalPassword123!');
    await btnGuardar.click();

    // Debe mostrar alerta de éxito
    await expect(page.locator('.alert-success')).toBeVisible();

    // 7. Restaurar la contraseña original para preservar integridad de datos
    await btnToggle.click(); // reabrir formulario si se cerró o esperar visibilidad
    if (!(await inputActual.isVisible())) {
      await btnToggle.click();
    }
    await inputActual.fill('TemporalPassword123!');
    await inputNueva.fill('Password123!');
    await btnGuardar.click();
    await expect(page.locator('.alert-success')).toBeVisible();

    // 8. Verificación en escritorio (1280x800)
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(seccionSeguridad).toBeVisible();

    // Comprobar que no hay desbordamiento horizontal
    const sinDesbordamiento = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= window.innerWidth;
    });
    expect(sinDesbordamiento).toBe(true);
  });
});
