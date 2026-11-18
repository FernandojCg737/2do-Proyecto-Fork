import { test as base, expect } from '@playwright/test';
import type { Page, BrowserContext } from '@playwright/test';
import MCR from 'monocart-coverage-reports';
import { opcionesCobertura } from '../../scripts/cobertura-opciones.mjs';

/**
 * Fixture de cobertura del frontend.
 * ----------------------------------------------------------------------------
 * Solo se activa con la variable de entorno COBERTURA=1 (la usa scripts/cobertura.mjs).
 * Registra la cobertura V8 de Chromium de TODAS las páginas de la prueba: la página
 * principal y las que se abren en otros contextos (organizador y estudiante a la vez,
 * con browser.newContext()). La cobertura se acumula con monocart-coverage-reports,
 * que la traduce a las líneas de los .jsx originales mediante los source maps de Vite.
 *
 * Detalle importante: V8 solo informa la cobertura de los scripts que siguen vivos.
 * Cada page.goto() o page.reload() carga un documento nuevo y descarta lo ejecutado en
 * el anterior, así que se toma una instantánea justo antes de cada navegación completa,
 * antes de cerrar una página o un contexto y al terminar la prueba.
 *
 * Sin COBERTURA=1 las pruebas se comportan exactamente igual que con '@playwright/test'.
 */
const activa = process.env.COBERTURA === '1';
const OPCIONES_V8 = { resetOnNavigation: false };

export const test = base.extend<{ registrarCobertura: void }>({
  registrarCobertura: [
    async ({ page, browser }, use) => {
      if (!activa) {
        await use();
        return;
      }
      const reporte = MCR(opcionesCobertura);
      const medidas = new Set<Page>();

      // Guarda lo ejecutado hasta ahora (solo el código de la app: /src/).
      const guardar = async (p: Page, seguirMidiendo: boolean) => {
        if (!medidas.has(p)) return;
        try {
          const datos = await p.coverage.stopJSCoverage();
          await reporte.add(datos.filter((d) => d.url.includes('/src/')));
          if (seguirMidiendo) await p.coverage.startJSCoverage(OPCIONES_V8);
          else medidas.delete(p);
        } catch {
          medidas.delete(p); // la página ya estaba cerrada
        }
      };
      const iniciar = async (p: Page) => {
        await p.coverage.startJSCoverage(OPCIONES_V8);
        medidas.add(p);
        const cerrar = p.close.bind(p);
        p.close = async (...args: Parameters<Page['close']>) => {
          await guardar(p, false);
          return cerrar(...args);
        };
        const ir = p.goto.bind(p);
        p.goto = async (...args: Parameters<Page['goto']>) => {
          await guardar(p, true);
          return ir(...args);
        };
        const recargar = p.reload.bind(p);
        p.reload = async (...args: Parameters<Page['reload']>) => {
          await guardar(p, true);
          return recargar(...args);
        };
      };
      const instrumentarContexto = (ctx: BrowserContext) => {
        const nuevaPagina = ctx.newPage.bind(ctx);
        ctx.newPage = async () => {
          const p = await nuevaPagina();
          await iniciar(p);
          return p;
        };
        const cerrar = ctx.close.bind(ctx);
        ctx.close = async (...args: Parameters<BrowserContext['close']>) => {
          for (const p of ctx.pages()) await guardar(p, false);
          return cerrar(...args);
        };
      };

      await iniciar(page);
      const nuevoContexto = browser.newContext.bind(browser);
      browser.newContext = async (...args: Parameters<typeof browser.newContext>) => {
        const ctx = await nuevoContexto(...args);
        instrumentarContexto(ctx);
        return ctx;
      };

      await use();

      browser.newContext = nuevoContexto;
      for (const p of [...medidas]) await guardar(p, false);
    },
    { auto: true },
  ],
});

export { expect };
