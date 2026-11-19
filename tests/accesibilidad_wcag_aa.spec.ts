import { test, expect } from './fixtures/cobertura';
import type { Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Accesibilidad · WCAG 2.1 AA en TODAS las pantallas (presentación final)
 * ----------------------------------------------------------------------------
 * Audita con axe-core (el mismo motor que usa Lighthouse para accesibilidad)
 * las 11 pantallas de StudyMatch en escritorio y en móvil.
 *
 * Protege las correcciones documentadas en docs/accesibilidad.md:
 *  - contraste AA de los textos (tokens color-texto-secundario, color-error, -texto),
 *  - etiqueta del campo de Recuperar contraseña,
 *  - nombre accesible de las barras de progreso de /analitica,
 *  - regiones con desplazamiento accesibles con teclado.
 *
 * Si alguien vuelve a introducir un color sin contraste o un campo sin etiqueta,
 * esta prueba falla e indica la regla, la pantalla y el elemento.
 */

const PUBLICAS = ['/', '/login', '/register', '/recover'];
const PRIVADAS = [
  '/dashboard?tab=solicitudes',
  '/dashboard?tab=mis-sesiones',
  '/new-study',
  '/sesions',
  '/historial',
  '/analitica',
  '/mis-datos',
];

async function violacionesWcagAA(page: Page, ruta: string) {
  await page.goto(ruta);
  await page.waitForLoadState('networkidle');
  // Se audita el estado final, no una transición a medias: los botones animan su color
  // 0.18 s (index.css) y axe podría medir un color intermedio. [class] iguala la
  // especificidad de .btn y, al cargarse después, gana aunque ambos usen !important.
  await page.addStyleTag({
    content: '*, *::before, *::after, [class] { transition: none !important; animation: none !important; }',
  });
  const resultado = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();
  return resultado.violations.map((v) => ({
    pantalla: ruta,
    regla: v.id,
    impacto: v.impact,
    elementos: v.nodes.slice(0, 3).map((n) => n.target.join(' ')),
  }));
}

async function iniciarSesion(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('fernando.calani@studymatch.com');
  await page.getByLabel('Password').fill('Password123!');
  await page.getByRole('button', { name: 'Iniciar Sesion' }).click();
  await expect(page.getByRole('heading', { name: /bienvenido/i })).toBeVisible();
}

for (const [vista, viewport] of [
  ['escritorio', { width: 1280, height: 800 }],
  ['móvil', { width: 390, height: 844 }],
] as const) {
  test.describe(`Accesibilidad WCAG 2.1 AA · ${vista}`, () => {
    test.use({ viewport });
    // Cada prueba audita 4 o 7 pantallas con axe: con la medición de cobertura activa supera los 30 s por defecto.
    test.describe.configure({ timeout: 180000 });

    test(`Pantallas públicas sin violaciones (${vista})`, async ({ page }) => {
      const violaciones = [];
      for (const ruta of PUBLICAS) violaciones.push(...(await violacionesWcagAA(page, ruta)));
      expect(violaciones, JSON.stringify(violaciones, null, 2)).toEqual([]);
    });

    test(`Pantallas con sesión iniciada sin violaciones (${vista})`, async ({ page }) => {
      await iniciarSesion(page);
      const violaciones = [];
      for (const ruta of PRIVADAS) violaciones.push(...(await violacionesWcagAA(page, ruta)));
      expect(violaciones, JSON.stringify(violaciones, null, 2)).toEqual([]);
    });
  });
}
