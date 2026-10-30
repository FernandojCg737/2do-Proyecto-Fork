import { test, expect } from '@playwright/test';

test.describe('Clase 18 - Reto de Automatización E2E StudyMatch', () => {

  // ============================================================================
  // FLUJO PRINCIPAL (Camino Feliz): Semilla -> Login -> Crear sesión -> Aparece al buscar
  // Cumple con el requisito exacto de la Lámina 12 de la Clase 18:
  // "StudyMatch: Crear sesión -> aparece al buscar"
  // ============================================================================
  test('Flujo principal: Usuario inicia sesión, crea una sesión de estudio y aparece al buscar', async ({ page }) => {
    const timestamp = Date.now();
    const nombreSesion = `Taller IHC Playwright ${timestamp}`;
    const nombreMateria = 'Interacción Hombre-Computador';

    // 1. Ir a la pantalla de inicio de sesión
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Iniciar sesion' })).toBeVisible();

    // 2. Iniciar sesión con usuario de prueba (semilla)
    // Usamos selectores por etiqueta (getByLabel) según las buenas prácticas de la lámina 7
    await page.getByLabel('Email').fill('fernando.calani@studymatch.com');
    await page.getByLabel('Password').fill('Password123!');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();

    // 3. Verificar que llegó al panel privado (Dashboard)
    await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible();

    // 4. Navegar a "Crear sesión"
    await page.getByRole('link', { name: /crear sesión/i }).click();
    await expect(page.getByRole('heading', { name: 'Nueva sesion de estudio' })).toBeVisible();

    // 5. Completar el formulario de creación de sesión (como usuario)
    await page.getByLabel('nombre').fill(nombreSesion);
    await page.getByLabel('Materia').fill(nombreMateria);
    await page.getByLabel('Modalidad').selectOption('virtual');
    await page.getByLabel('cupo').fill('6');
    await page.getByLabel('fecha').fill('2026-11-20');

    // 6. Enviar formulario
    await page.getByRole('button', { name: 'Crear sesión' }).click();

    // 7. Comprobar mensaje de éxito ("El clic no prueba nada. Lo que aparece, sí")
    await expect(page.getByText('Sesión de estudio registrada correctamente.')).toBeVisible();

    // 8. Navegar a la búsqueda de sesiones
    await page.getByRole('link', { name: 'Ver sesiones' }).click();
    await expect(page.getByRole('heading', { name: 'Sesiones de estudio' })).toBeVisible();

    // 9. Filtrar por el nombre de la sesión recién creada
    await page.getByLabel('Buscar por nombre').fill(nombreSesion);
    await page.getByRole('button', { name: 'Buscar' }).click();

    // 10. Validar que la tarjeta de la sesión aparece en la pantalla con sus datos
    const tarjeta = page.locator('.card', { has: page.getByRole('heading', { name: nombreSesion }) });
    await expect(tarjeta).toBeVisible();
    await expect(tarjeta.getByRole('heading', { name: nombreSesion })).toBeVisible();
    await expect(tarjeta.getByText(nombreMateria)).toBeVisible();
  });


  // ============================================================================
  // FLUJO ALTERNATIVO (Lámina 8: "Un camino feliz y uno alternativo")
  // Intento de login con credenciales inválidas muestra mensaje de error correctivo
  // ============================================================================
  test('Flujo alternativo: Login fallido muestra mensaje de error claro al usuario', async ({ page }) => {
    await page.goto('/login');

    await page.getByLabel('Email').fill('noexiste@studymatch.com');
    await page.getByLabel('Password').fill('ClaveIncorrecta999');
    await page.getByRole('button', { name: 'Iniciar Sesion' }).click();

    // Comprobar que aparece el mensaje de error y no permite entrar
    await expect(page.getByText(/correo o contraseña incorrectos/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Iniciar sesion' })).toBeVisible();
  });

});
