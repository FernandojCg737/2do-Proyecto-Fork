import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');
const OUT_DIR = path.join(ROOT, 'videos_defensa');
const PRESENTABLES_DIR = path.resolve('D:/INTERACCION HOMBRE-COMPUTADOR/Presentables 2do proyecto/videos_defensa');
const FFMPEG = path.join(BACKEND, 'venv', 'Lib', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg-win-x86_64-v9.0.2.exe');

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.mkdirSync(PRESENTABLES_DIR, { recursive: true });

const WIN = process.platform === 'win32';
const PY = fs.existsSync(path.join(BACKEND, 'venv', WIN ? 'Scripts/python.exe' : 'bin/python'))
  ? path.join(BACKEND, 'venv', WIN ? 'Scripts/python.exe' : 'bin/python') : 'python';

const puertoLibre = (p) => new Promise((ok) => {
  const s = net.createServer().once('error', () => ok(false)).once('listening', () => s.close(() => ok(true))).listen(p, '127.0.0.1');
});
const esperar = async (url, seg = 90) => {
  for (let i = 0; i < seg * 2; i++) {
    try { const r = await fetch(url); if (r.ok) return; } catch { }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('No respondió: ' + url);
};
const matar = (proc) => {
  if (!proc || proc.exitCode !== null) return;
  if (WIN) spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' });
  else proc.kill('SIGTERM');
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ============================================================================
// SUPERPOSICIÓN DE MANUAL INTERACTIVO: Cursor Visible, Clics y Subtítulos
// ============================================================================
const MANUAL_SCRIPT = `
(function() {
  function initOverlay() {
    if (document.getElementById('manual-root')) return;

    const root = document.createElement('div');
    root.id = 'manual-root';

    const style = document.createElement('style');
    style.id = 'manual-styles';
    style.textContent = \`
      #manual-cursor {
        position: fixed;
        top: 0;
        left: 0;
        width: 32px;
        height: 32px;
        pointer-events: none;
        z-index: 2147483647;
        transform: translate(-100px, -100px);
        transition: transform 0.35s cubic-bezier(0.25, 1, 0.5, 1);
        filter: drop-shadow(0 3px 6px rgba(0,0,0,0.6));
      }
      #manual-cursor-pointer {
        width: 32px;
        height: 32px;
      }
      #manual-cursor-label {
        position: absolute;
        top: 26px;
        left: 20px;
        background: #0f172a;
        color: #f8fafc;
        border: 1.5px solid #6366f1;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 12px;
        font-weight: 700;
        white-space: nowrap;
        pointer-events: none;
        box-shadow: 0 4px 14px rgba(0,0,0,0.6);
        font-family: system-ui, -apple-system, sans-serif;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      #manual-bottom-banner {
        position: fixed;
        bottom: 22px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(15, 23, 42, 0.95);
        border: 2px solid #6366f1;
        box-shadow: 0 8px 30px rgba(0, 0, 0, 0.7);
        border-radius: 9999px;
        padding: 8px 22px;
        display: flex;
        align-items: center;
        gap: 12px;
        z-index: 2147483646;
        pointer-events: none;
        font-family: system-ui, -apple-system, sans-serif;
        animation: manual-banner-pop 0.3s ease-out;
        max-width: 92vw;
      }
      @keyframes manual-banner-pop {
        0% { transform: translateX(-50%) scale(0.92); opacity: 0; }
        100% { transform: translateX(-50%) scale(1); opacity: 1; }
      }
      .manual-badge {
        background: #4f46e5;
        color: #ffffff;
        padding: 4px 12px;
        border-radius: 9999px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.5px;
        text-transform: uppercase;
        box-shadow: 0 0 10px rgba(99, 102, 241, 0.6);
        flex-shrink: 0;
      }
      .manual-text {
        color: #f8fafc;
        font-size: 14px;
        font-weight: 600;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .manual-ripple {
        position: fixed;
        width: 16px;
        height: 16px;
        margin-left: -8px;
        margin-top: -8px;
        border-radius: 50%;
        background: rgba(244, 63, 94, 0.35);
        border: 3px solid #f43f5e;
        box-shadow: 0 0 16px #f43f5e;
        pointer-events: none;
        z-index: 2147483645;
        animation: manual-ripple-anim 0.55s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
      }
      @keyframes manual-ripple-anim {
        0% { transform: scale(0.8); opacity: 1; }
        100% { transform: scale(5.5); opacity: 0; }
      }
      .manual-target-glow {
        outline: 3px solid #f43f5e !important;
        outline-offset: 2px !important;
        box-shadow: 0 0 20px rgba(244, 63, 94, 0.9) !important;
        transition: all 0.2s ease !important;
      }
      @media (max-width: 600px) {
        #manual-bottom-banner {
          bottom: 14px;
          padding: 6px 14px;
          gap: 8px;
        }
        .manual-badge {
          font-size: 10px;
          padding: 2px 8px;
        }
        .manual-text {
          font-size: 11px;
        }
      }
    \`;
    document.head.appendChild(style);

    const banner = document.createElement('div');
    banner.id = 'manual-bottom-banner';
    banner.innerHTML = \`
      <span class="manual-badge">MANUAL IHC</span>
      <span class="manual-text" id="manual-banner-text">StudyMatch · Demostración Interactiva</span>
    \`;
    root.appendChild(banner);

    const cursor = document.createElement('div');
    cursor.id = 'manual-cursor';
    cursor.innerHTML = \`
      <svg id="manual-cursor-pointer" viewBox="0 0 32 32" fill="none">
        <path d="M5 2L15 26L19 17L28 14L5 2Z" fill="#e11d48" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>
        <circle cx="5" cy="2" r="2.5" fill="#ffffff" />
      </svg>
      <div id="manual-cursor-label"></div>
    \`;
    root.appendChild(cursor);

    document.body.appendChild(root);

    const guardadoTxt = sessionStorage.getItem('__manual_step_text');
    const guardadoBdg = sessionStorage.getItem('__manual_step_badge');
    if (guardadoTxt) {
      const txt = document.getElementById('manual-banner-text');
      if (txt) txt.textContent = guardadoTxt;
    }
    if (guardadoBdg) {
      const bdg = document.querySelector('#manual-bottom-banner .manual-badge');
      if (bdg) bdg.textContent = guardadoBdg;
    }
  }

  if (document.body) {
    initOverlay();
  } else {
    document.addEventListener('DOMContentLoaded', initOverlay);
  }

  window.__manual_set_step = (texto, badge = 'MANUAL') => {
    sessionStorage.setItem('__manual_step_text', texto);
    sessionStorage.setItem('__manual_step_badge', badge);
    const txt = document.getElementById('manual-banner-text');
    if (txt) txt.textContent = texto;
    const bdg = document.querySelector('#manual-bottom-banner .manual-badge');
    if (bdg) bdg.textContent = badge;
  };

  window.__manual_move_cursor = (x, y, label) => {
    const c = document.getElementById('manual-cursor');
    if (!c) return;
    c.style.transform = \`translate(\${x}px, \${y}px)\`;
    const lbl = document.getElementById('manual-cursor-label');
    if (lbl) {
      if (label) {
        lbl.textContent = label;
        lbl.style.opacity = '1';
      } else {
        lbl.style.opacity = '0';
      }
    }
  };

  window.__manual_click_ripple = (x, y) => {
    const r = document.createElement('div');
    r.className = 'manual-ripple';
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    document.body.appendChild(r);
    setTimeout(() => r.remove(), 600);

    const c = document.getElementById('manual-cursor');
    if (c) {
      c.style.transform = c.style.transform + ' scale(0.82)';
      setTimeout(() => {
        c.style.transform = c.style.transform.replace(' scale(0.82)', '');
      }, 150);
    }
  };
})();
`;

// Helper: Cambiar paso en banner
async function manualPaso(page, badge, texto, pausa = 700) {
  await page.evaluate(({ badge, texto }) => {
    window.__manual_set_step?.(texto, badge);
  }, { badge, texto }).catch(() => {});
  await sleep(pausa);
}

// Helper: Clic interactivo guiado
async function manualClick(page, locator, label) {
  try { await locator.scrollIntoViewIfNeeded(); } catch {}
  await sleep(150);
  const box = await locator.boundingBox().catch(() => null);
  if (box) {
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);

    await page.evaluate(({ x, y, label }) => {
      window.__manual_move_cursor?.(x, y, label);
    }, { x: cx, y: cy, label: label || 'Clic' }).catch(() => {});

    await locator.evaluate((el) => el.classList.add('manual-target-glow')).catch(() => {});
    await sleep(400);

    await page.evaluate(({ x, y }) => {
      window.__manual_click_ripple?.(x, y);
    }, { x: cx, y: cy }).catch(() => {});
    await sleep(180);

    await locator.evaluate((el) => el.classList.remove('manual-target-glow')).catch(() => {});
  }
  await locator.click();
  await sleep(400);
}

// Helper: Escritura interactiva guiada
async function manualEscribir(page, locator, texto, label, delay = 35) {
  try { await locator.scrollIntoViewIfNeeded(); } catch {}
  await sleep(150);
  const box = await locator.boundingBox().catch(() => null);
  if (box) {
    const cx = Math.round(box.x + 25);
    const cy = Math.round(box.y + box.height / 2);

    await page.evaluate(({ x, y, label }) => {
      window.__manual_move_cursor?.(x, y, label);
    }, { x: cx, y: cy, label: label || 'Escribir' }).catch(() => {});

    await locator.evaluate((el) => el.classList.add('manual-target-glow')).catch(() => {});
    await sleep(350);

    await page.evaluate(({ x, y }) => {
      window.__manual_click_ripple?.(x, y);
    }, { x: cx, y: cy }).catch(() => {});
    await sleep(150);
  }

  await locator.fill('');
  await locator.pressSequentially(texto, { delay });
  await locator.evaluate((el) => el.classList.remove('manual-target-glow')).catch(() => {});
  await sleep(300);
}

// Helper: Selección guiada en combobox
async function manualSelect(page, locator, valor, label) {
  try { await locator.scrollIntoViewIfNeeded(); } catch {}
  await sleep(150);
  const box = await locator.boundingBox().catch(() => null);
  if (box) {
    const cx = Math.round(box.x + box.width / 2);
    const cy = Math.round(box.y + box.height / 2);

    await page.evaluate(({ x, y, label }) => {
      window.__manual_move_cursor?.(x, y, label);
    }, { x: cx, y: cy, label: label || 'Seleccionar' }).catch(() => {});

    await locator.evaluate((el) => el.classList.add('manual-target-glow')).catch(() => {});
    await sleep(350);

    await page.evaluate(({ x, y }) => {
      window.__manual_click_ripple?.(x, y);
    }, { x: cx, y: cy }).catch(() => {});
    await sleep(150);
    await locator.evaluate((el) => el.classList.remove('manual-target-glow')).catch(() => {});
  }
  await locator.selectOption(valor);
  await sleep(400);
}

// Helper: Scroll suave guiado
async function manualScroll(page, y, label) {
  if (label) {
    await page.evaluate(({ label }) => {
      window.__manual_set_step?.(label, 'EXPLORAR');
    }, { label }).catch(() => {});
  }
  await page.evaluate((top) => window.scrollBy({ top, behavior: 'smooth' }), y);
  await sleep(1400);
}

// Helper: Cambio de usuario robusto (cierra sesión limpiamente en React y se loguea de nuevo)
async function cambiarUsuario(page, email, password = 'Password123!') {
  await manualPaso(page, 'LOGIN', `Iniciando sesión como ${email}`);

  // Si ya estamos autenticados, pulsar "Cerrar sesión" en el header
  const btnLogout = page.getByRole('button', { name: /Cerrar sesión/i }).first();
  if (await btnLogout.isVisible().catch(() => false)) {
    await manualClick(page, btnLogout, 'Clic en "Cerrar sesión"');
    await sleep(500);
  } else {
    await page.goto('http://localhost:5173/login');
    await sleep(300);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await sleep(500);
  }

  // Esperar pantalla de login
  await page.waitForURL('**/login', { timeout: 6000 }).catch(() => {});
  await sleep(300);

  // Escribir credenciales con el cursor guiado
  const inputEmail = page.getByLabel('Email');
  const inputPass = page.getByLabel('Password');
  await manualEscribir(page, inputEmail, email, 'Ingresar correo');
  await manualEscribir(page, inputPass, password, 'Ingresar contraseña');

  // Clic en Iniciar Sesión y esperar redirección al Dashboard
  await manualClick(page, page.getByRole('button', { name: 'Iniciar Sesion' }), 'Clic en "Iniciar Sesión"');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 }).catch(() => {});
  await sleep(1000);
}

// ----------------------------------------------------------------------------
// Servidores con Base de Datos limpia poblada por seed_data.py
// ----------------------------------------------------------------------------
console.log('=== 1. Preparando entorno y base de datos limpia ===');
for (const p of [8000, 5173]) {
  if (!(await puertoLibre(p))) {
    console.log(`Liberando puerto ${p}...`);
    spawnSync('powershell', ['-Command', `Get-Process -Name 'node','python' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue`]);
    await sleep(2000);
  }
}

const db = path.join(os.tmpdir(), `studymatch-videos-${Date.now()}.db`).replace(/\\/g, '/');
const env = { ...process.env, DATABASE_URL: `sqlite:///${db}`, PYTHONUTF8: '1' };

spawnSync(PY, ['seed_data.py'], { cwd: BACKEND, env, stdio: 'inherit' });

const backend = spawn(PY, ['-m', 'uvicorn', 'main:app', '--port', '8000', '--host', '127.0.0.1'], { cwd: BACKEND, env, stdio: 'ignore' });
const frontend = spawn(process.execPath, [path.join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5173', '--strictPort'], { cwd: FRONTEND, env: { ...process.env }, stdio: 'ignore' });

try {
  await esperar('http://127.0.0.1:8000/docs');
  await esperar('http://localhost:5173/');
  console.log('✓ Servidores listos: Backend (8000) y Frontend (5173)\n');

  const browser = await chromium.launch({ headless: true });
  const videosGrabados = [];

  async function grabarFlujo(id, titulo, descripcion, viewport, accion) {
    console.log(`\n▶ Grabando [${id}]: ${titulo}...`);
    const tempVideoDir = fs.mkdtempSync(path.join(os.tmpdir(), `sm-video-${id}-`));
    const context = await browser.newContext({
      viewport,
      recordVideo: { dir: tempVideoDir, size: viewport },
    });
    await context.addInitScript(MANUAL_SCRIPT);

    const page = await context.newPage();
    try {
      await accion(page, context);
    } catch (err) {
      console.error(`Error en grabación de ${id}:`, err);
    }

    await sleep(1500);
    await page.close();
    await context.close();

    const files = fs.readdirSync(tempVideoDir).filter((f) => f.endsWith('.webm'));
    if (!files.length) {
      console.error(`✗ No se generó video para ${id}`);
      return;
    }

    const srcWebm = path.join(tempVideoDir, files[0]);
    const dstWebm = path.join(OUT_DIR, `${id}.webm`);
    const dstMp4 = path.join(OUT_DIR, `${id}.mp4`);

    fs.copyFileSync(srcWebm, dstWebm);

    if (fs.existsSync(FFMPEG)) {
      console.log(`  Codificando a MP4 (H.264) con ffmpeg...`);
      const conv = spawnSync(FFMPEG, [
        '-y',
        '-i', dstWebm,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart',
        '-crf', '22',
        '-preset', 'fast',
        dstMp4,
      ], { stdio: 'ignore' });

      if (conv.status === 0 && fs.existsSync(dstMp4)) {
        console.log(`  ✓ Generado ${id}.mp4 (${(fs.statSync(dstMp4).size / 1024 / 1024).toFixed(2)} MB)`);
        fs.copyFileSync(dstMp4, path.join(PRESENTABLES_DIR, `${id}.mp4`));
      }
    }

    fs.copyFileSync(dstWebm, path.join(PRESENTABLES_DIR, `${id}.webm`));
    fs.rmSync(tempVideoDir, { recursive: true, force: true });

    videosGrabados.push({ id, titulo, descripcion, webm: `${id}.webm`, mp4: `${id}.mp4` });
  }

  // ==========================================================================
  // FLUJO 1: Inicio de Sesión y Catálogo Reactivo
  // ==========================================================================
  await grabarFlujo(
    '01_flujo_principal_login_catalogo',
    'Flujo Principal · Login y Catálogo de Sesiones',
    'Autenticación de usuario con datos semilla, navegación al catálogo y filtrado dinámico de materias.',
    { width: 1280, height: 720 },
    async (page) => {
      await manualPaso(page, 'INICIO', 'Bienvenido a StudyMatch · Plataforma de Aprendizaje Colaborativo');
      await page.goto('http://localhost:5173/');
      await sleep(1200);

      // Iniciar sesión
      await cambiarUsuario(page, 'ana.torres@studymatch.com');

      // Ir a catálogo
      await manualPaso(page, 'PASO 1', 'Navegar al catálogo general de sesiones');
      await page.goto('http://localhost:5173/sesions');
      await sleep(1500);

      // Filtrar por nombre
      await manualPaso(page, 'PASO 2', 'Filtrar sesiones por materia: "Cálculo"');
      const inputBuscar = page.getByLabel('Buscar por nombre');
      await manualEscribir(page, inputBuscar, 'Cálculo', 'Escribir "Cálculo"', 50);

      await manualPaso(page, 'PASO 3', 'Ejecutar búsqueda en tiempo real');
      await manualClick(page, page.getByRole('button', { name: 'Buscar', exact: true }), 'Clic en "Buscar"');
      await sleep(2000);

      // Limpiar filtro
      await manualPaso(page, 'PASO 4', 'Restaurar catálogo completo sin filtros');
      await manualClick(page, page.getByRole('button', { name: 'Limpiar filtros' }), 'Clic en "Limpiar filtros"');
      await sleep(2000);
    }
  );

  // ==========================================================================
  // FLUJO 2: Tarea 6 · Lista de Espera con Algoritmo FIFO
  // ==========================================================================
  await grabarFlujo(
    '02_tarea6_lista_espera_fifo',
    'Tarea 6 · Lista de Espera Transparente (FIFO)',
    'Sesión llena con cupo 1, Brayan entra en espera (Lugar #1), Ana abandona y Brayan asciende automáticamente.',
    { width: 1280, height: 720 },
    async (page) => {
      const ts = Date.now();
      const nombreSesion = `Taller Álgebra Lineal - Cupo 1 (${ts})`;

      // 1. Carlos crea la sesión con cupo = 1 y fecha futura
      await manualPaso(page, 'PASO 1', 'Carlos Mendoza (Organizador) ingresa al sistema');
      await cambiarUsuario(page, 'carlos.mendoza@studymatch.com');

      await manualPaso(page, 'PASO 2', 'Acceder al formulario para crear sesión de estudio');
      await page.goto('http://localhost:5173/new-study');
      await sleep(800);

      await manualPaso(page, 'PASO 3', 'Configurar sesión con cupo = 1 y fecha futura (2026-11-25)');
      await manualEscribir(page, page.getByLabel('nombre'), nombreSesion, 'Nombre del taller');
      await manualEscribir(page, page.getByLabel('Materia'), 'Álgebra', 'Materia');
      await manualSelect(page, page.getByLabel('Modalidad'), 'virtual', 'Modalidad virtual');
      await manualEscribir(page, page.getByLabel('cupo'), '1', 'Cupo límite: 1');
      await manualEscribir(page, page.getByLabel('fecha'), '2026-11-25', 'Fecha: 25/11/2026');

      await manualPaso(page, 'PASO 4', 'Publicar sesión en el catálogo');
      await manualClick(page, page.getByRole('button', { name: 'Crear sesión' }), 'Clic en "Crear sesión"');
      await sleep(1800);

      // 2. Ana solicita unirse y Carlos la acepta (cupo = 1 ocupado)
      await manualPaso(page, 'PASO 5', 'Ana Torres (Estudiante) busca la sesión y solicita unirse');
      await cambiarUsuario(page, 'ana.torres@studymatch.com');
      await page.goto('http://localhost:5173/sesions');
      await sleep(1200);

      await manualEscribir(page, page.getByLabel('Buscar por nombre'), nombreSesion, 'Buscar taller');
      await manualClick(page, page.getByRole('button', { name: 'Buscar', exact: true }), 'Clic en "Buscar"');
      await sleep(1500);

      const cardSesion = page.locator('.card', { hasText: nombreSesion }).first();
      await manualClick(page, cardSesion.getByRole('button', { name: 'Solicitar unirme' }), 'Clic en "Solicitar unirme"');
      await sleep(1800);

      // 3. Carlos acepta la solicitud de Ana
      await manualPaso(page, 'PASO 6', 'Organizador acepta la solicitud de Ana (Cupo completo 1/1)');
      await cambiarUsuario(page, 'carlos.mendoza@studymatch.com');
      await page.goto('http://localhost:5173/dashboard?tab=mis-sesiones');
      await sleep(1200);
      await manualClick(page, page.getByRole('button', { name: '✓ Aceptar' }).first(), 'Clic en "✓ Aceptar"');
      await sleep(1500);

      // 4. Brayan Gonzales ve la sesión LLENA (0 cupos libres) y se une a la lista de espera
      await manualPaso(page, 'PASO 7', 'Brayan Gonzales ve la sesión LLENA (0 cupos) y entra en lista de espera');
      await cambiarUsuario(page, 'brayan.gonzales@studymatch.com');
      await page.goto('http://localhost:5173/sesions');
      await sleep(1200);

      await manualEscribir(page, page.getByLabel('Buscar por nombre'), nombreSesion, 'Buscar taller');
      await manualClick(page, page.getByRole('button', { name: 'Buscar', exact: true }), 'Clic en "Buscar"');
      await sleep(1500);

      const cardBrayan = page.locator('.card', { hasText: nombreSesion }).first();
      const btnEspera = cardBrayan.getByRole('button', { name: /Unirme a la lista de espera/i });
      await manualClick(page, btnEspera, 'Clic en "Unirme a la lista de espera"');
      await sleep(1800);

      // Brayan ve su estado en Mis Solicitudes: "Estás en la lista de espera (Lugar #1)"
      await manualPaso(page, 'PASO 8', 'Brayan verifica su posición en Mis Solicitudes: "Lugar #1 en Espera"');
      await page.goto('http://localhost:5173/dashboard?tab=solicitudes');
      await sleep(2500);

      // 5. Ana abandona su plaza confirmada
      await manualPaso(page, 'PASO 9', 'Ana Torres decide abandonar voluntariamente su plaza confirmada');
      await cambiarUsuario(page, 'ana.torres@studymatch.com');
      await page.goto('http://localhost:5173/dashboard?tab=solicitudes');
      await sleep(1200);
      const cardAna = page.locator('.card', { hasText: nombreSesion }).first();
      await manualClick(page, cardAna.getByRole('button', { name: /Abandonar sesión/i }).first(), 'Clic en "Abandonar sesión"');
      await sleep(2000);

      // 6. Brayan recarga su panel y ve que ascendió automáticamente a CONFIRMADO
      await manualPaso(page, 'PASO 10', 'Algoritmo FIFO: Brayan asciende automáticamente a "Confirmado"');
      await cambiarUsuario(page, 'brayan.gonzales@studymatch.com');
      await page.goto('http://localhost:5173/dashboard?tab=solicitudes');
      await sleep(3000);
    }
  );

  // ==========================================================================
  // FLUJO 3: Tarea 7 · Reprogramación Ética con Reconfirmación
  // ==========================================================================
  await grabarFlujo(
    '03_tarea7_reprogramacion_reconfirmacion',
    'Tarea 7 · Reprogramación Ética y Reconfirmación',
    'Sesión creada para fecha futura (24/11), organizador posterga al 02/12 con motivo formal y alumna reconfirma.',
    { width: 1280, height: 720 },
    async (page) => {
      const ts = Date.now();
      const nombreSesion = `Taller de Usabilidad y Accesibilidad (${ts})`;

      // 1. Carlos crea la sesión con fecha futura inicial: 2026-11-24
      await manualPaso(page, 'PASO 1', 'Carlos Mendoza programa sesión para el 24/11/2026');
      await cambiarUsuario(page, 'carlos.mendoza@studymatch.com');
      await page.goto('http://localhost:5173/new-study');
      await sleep(800);
      await manualEscribir(page, page.getByLabel('nombre'), nombreSesion, 'Nombre de la sesión');
      await manualEscribir(page, page.getByLabel('Materia'), 'Interacción Hombre-Computador', 'Materia');
      await manualSelect(page, page.getByLabel('Modalidad'), 'presencial', 'Modalidad');
      await manualEscribir(page, page.getByLabel('cupo'), '3', 'Cupo: 3');
      await manualEscribir(page, page.getByLabel('fecha'), '2026-11-24', 'Fecha inicial: 2026-11-24');
      await manualClick(page, page.getByRole('button', { name: 'Crear sesión' }), 'Clic en "Crear sesión"');
      await sleep(1600);

      // 2. Ana solicita y es aceptada
      await manualPaso(page, 'PASO 2', 'Ana Torres se inscribe a la sesión');
      await cambiarUsuario(page, 'ana.torres@studymatch.com');
      await page.goto('http://localhost:5173/sesions');
      await sleep(1200);

      await manualEscribir(page, page.getByLabel('Buscar por nombre'), nombreSesion, 'Buscar taller');
      await manualClick(page, page.getByRole('button', { name: 'Buscar', exact: true }), 'Clic en "Buscar"');
      await sleep(1500);

      const card = page.locator('.card', { hasText: nombreSesion }).first();
      await manualClick(page, card.getByRole('button', { name: 'Solicitar unirme' }), 'Clic en "Solicitar unirme"');
      await sleep(1800);

      await manualPaso(page, 'PASO 3', 'Carlos Mendoza acepta la inscripción de Ana');
      await cambiarUsuario(page, 'carlos.mendoza@studymatch.com');
      await page.goto('http://localhost:5173/dashboard?tab=mis-sesiones');
      await sleep(1200);
      await manualClick(page, page.getByRole('button', { name: '✓ Aceptar' }).first(), 'Clic en "✓ Aceptar"');
      await sleep(1500);

      // 3. Carlos reprograma la sesión desde /sesions hacia una fecha posterior: 2026-12-02
      await manualPaso(page, 'PASO 4', 'Carlos solicita reprogramación ética con motivo obligatorio');
      await page.goto('http://localhost:5173/sesions');
      await sleep(1200);

      await manualEscribir(page, page.getByLabel('Buscar por nombre'), nombreSesion, 'Buscar taller');
      await manualClick(page, page.getByRole('button', { name: 'Buscar', exact: true }), 'Clic en "Buscar"');
      await sleep(1500);

      const cardCarlos = page.locator('.card', { hasText: nombreSesion }).first();
      await manualClick(page, cardCarlos.getByRole('button', { name: /Reprogramar sesión/i }), 'Clic en "Reprogramar sesión"');
      await sleep(1000);

      // Llenar nueva fecha y motivo
      await manualPaso(page, 'PASO 5', 'Establecer nueva fecha (02/12/2026) y justificación académica');
      await manualEscribir(page, page.locator('#reprog-fecha'), '2026-12-02', 'Nueva fecha: 2026-12-02');
      await manualEscribir(page, page.locator('#reprog-motivo'), 'Cambio al Laboratorio 4 para pruebas prácticas con lectores de pantalla', 'Motivo del cambio');
      await sleep(1000);
      await manualClick(page, page.getByRole('button', { name: /Confirmar reprogramación/i }), 'Clic en "Confirmar reprogramación"');
      await sleep(2500);

      // 4. Ana ve la notificación con el motivo visible y reconfirma
      await manualPaso(page, 'PASO 6', 'Ana revisa el motivo transparente del cambio y reconfirma asistencia');
      await cambiarUsuario(page, 'ana.torres@studymatch.com');
      await page.goto('http://localhost:5173/sesions');
      await sleep(1200);

      await manualEscribir(page, page.getByLabel('Buscar por nombre'), nombreSesion, 'Buscar taller');
      await manualClick(page, page.getByRole('button', { name: 'Buscar', exact: true }), 'Clic en "Buscar"');
      await sleep(1500);

      const cardAna = page.locator('.card', { hasText: nombreSesion }).first();
      await manualClick(page, cardAna.getByRole('button', { name: /Aceptar nueva fecha/i }), 'Clic en "Aceptar nueva fecha"');
      await sleep(2500);
    }
  );

  // ==========================================================================
  // FLUJO 4: Tarea 8 · Control de Asistencia y Justificaciones
  // ==========================================================================
  await grabarFlujo(
    '04_tarea8_asistencia_y_justificaciones',
    'Tarea 8 · Asistencia y Justificaciones Éticas',
    'Toma de asistencia (presente/ausente), solicitud de justificación por parte del alumno y resolución con motivo.',
    { width: 1280, height: 720 },
    async (page) => {
      await manualPaso(page, 'PASO 1', 'Organizador (Carlos) accede a la gestión de sesiones finalizadas');
      await cambiarUsuario(page, 'carlos.mendoza@studymatch.com');
      await page.goto('http://localhost:5173/dashboard?tab=mis-sesiones');
      await sleep(1500);

      const btnAsistencia = page.getByRole('button', { name: /Tomar asistencia/i }).first();
      if (await btnAsistencia.isVisible()) {
        await manualPaso(page, 'PASO 2', 'Abrir panel de control de asistencia de participantes');
        await manualClick(page, btnAsistencia, 'Clic en "Tomar asistencia"');
        await sleep(1200);

        await manualPaso(page, 'PASO 3', 'Registrar estudiante con estado Presente');
        const radiosPresente = page.getByRole('radio', { name: /Presente/i });
        if (await radiosPresente.count()) await manualClick(page, radiosPresente.first(), 'Marcar Presente');
        await sleep(600);

        await manualPaso(page, 'PASO 4', 'Registrar estudiante con estado Ausente');
        const radiosAusente = page.getByRole('radio', { name: /Ausente/i });
        if (await radiosAusente.count()) await manualClick(page, radiosAusente.first(), 'Marcar Ausente');
        await sleep(600);

        await manualPaso(page, 'PASO 5', 'Guardar asistencia de forma inmutable');
        const btnGuardar = page.getByRole('button', { name: /Guardar asistencia|Finalizar/i }).first();
        if (await btnGuardar.isVisible()) await manualClick(page, btnGuardar, 'Clic en "Guardar asistencia"');
        await sleep(1500);
      }

      await manualPaso(page, 'PASO 6', 'Verificar historial académico y solicitudes de justificación');
      await page.goto('http://localhost:5173/historial');
      await sleep(2500);
    }
  );

  // ==========================================================================
  // FLUJO 5: Tarea 9 · Cancelación Responsable y Panel /analitica
  // ==========================================================================
  await grabarFlujo(
    '05_tarea9_cancelacion_y_analitica',
    'Tarea 9 · Cancelación Responsable y Telemetría',
    'Cancelación formal de sesión con motivo visible para los compañeros y visualización del panel de embudos en /analitica.',
    { width: 1280, height: 720 },
    async (page) => {
      await manualPaso(page, 'PASO 1', 'Organizador (Carlos) accede a sus sesiones programadas');
      await cambiarUsuario(page, 'carlos.mendoza@studymatch.com');
      await page.goto('http://localhost:5173/sesions');
      await sleep(1500);

      const btnCancelar = page.getByRole('button', { name: /Cancelar sesión/i }).first();
      if (await btnCancelar.isVisible()) {
        await manualPaso(page, 'PASO 2', 'Iniciar proceso de cancelación responsable');
        await manualClick(page, btnCancelar, 'Clic en "Cancelar sesión"');
        await sleep(1000);

        await manualPaso(page, 'PASO 3', 'Ingresar motivo transparente obligatorio (>10 caracteres)');
        await manualEscribir(page, page.locator('#motivo-cancelacion-input'), 'Emergencia médica del tutor y reprogramación general de exámenes', 'Motivo ético');
        await sleep(1000);

        await manualPaso(page, 'PASO 4', 'Confirmar cancelación y notificar a los compañeros');
        await manualClick(page, page.getByRole('button', { name: /Confirmar cancelación/i }), 'Clic en "Confirmar cancelación"');
        await sleep(2000);
      }

      // Panel /analitica
      await manualPaso(page, 'PASO 5', 'Navegar al panel de analítica y telemetría de embudos');
      await page.goto('http://localhost:5173/analitica');
      await sleep(1500);

      await manualScroll(page, 350, 'Telemetría: Embudos de conversión y ratios de abandono');
      await sleep(1500);
      await manualScroll(page, 350, 'Telemetría: Métricas de salud del sistema y no-show');
      await sleep(2000);
    }
  );

  // ==========================================================================
  // FLUJO 6: Clase 22 · Patrones Oscuros Erradicados (Diseño Ético)
  // ==========================================================================
  await grabarFlujo(
    '06_clase22_patrones_oscuros_honestidad',
    'Clase 22 · Erradicación de Patrones Oscuros',
    'Principio de Honestidad: cálculo matemático de disponibilidad real, sin falsas urgencias ni datos manipulados.',
    { width: 1280, height: 720 },
    async (page) => {
      await manualPaso(page, 'PASO 1', 'Estudiante (Ana) consulta disponibilidad real en el catálogo');
      await cambiarUsuario(page, 'ana.torres@studymatch.com');
      await page.goto('http://localhost:5173/sesions');
      await sleep(1500);

      await manualScroll(page, 300, 'Honestidad: Cupos reales sin manipulación psicológica');
      await sleep(1500);
      await manualScroll(page, 300, 'Transparencia: Criterios claros de admisión y modalidad');
      await sleep(2000);
    }
  );

  // ==========================================================================
  // FLUJO 7: Tarea 10 · Mis Datos y Salida Honesta
  // ==========================================================================
  await grabarFlujo(
    '07_tarea10_salida_honesta_expediente',
    'Tarea 10 · Mis Datos y Salida Honesta (La Regla Difícil)',
    'Inspección de expediente, descarga en formatos abiertos (JSON/CSV), intento de borrado bloqueado y salida honesta.',
    { width: 1280, height: 720 },
    async (page) => {
      await manualPaso(page, 'PASO 1', 'Fernando Calani accede a su expediente personal (/mis-datos)');
      await cambiarUsuario(page, 'fernando.calani@studymatch.com');
      await page.goto('http://localhost:5173/mis-datos');
      await sleep(1500);

      const btnJson = page.getByRole('button', { name: /JSON/i });
      if (await btnJson.isVisible()) {
        await manualPaso(page, 'PASO 2', 'Portabilidad de Datos: Descarga de expediente en formato JSON');
        await manualClick(page, btnJson, 'Clic en "Descargar JSON"');
        await sleep(1000);
      }

      const btnCsv = page.getByRole('button', { name: /CSV/i });
      if (await btnCsv.isVisible()) {
        await manualPaso(page, 'PASO 3', 'Portabilidad de Datos: Descarga tabular en formato CSV');
        await manualClick(page, btnCsv, 'Clic en "Descargar CSV"');
        await sleep(1000);
      }

      await manualScroll(page, 600, 'Salida Honesta: Sección de eliminación de cuenta');
      await sleep(1500);

      const btnEliminar = page.getByRole('button', { name: /Eliminar mi cuenta/i });
      if (await btnEliminar.isVisible()) {
        await manualPaso(page, 'PASO 4', 'Regla Ética: La app bloquea la eliminación si hay compromisos activos');
        await manualClick(page, btnEliminar, 'Clic en "Eliminar mi cuenta"');
        await sleep(2500);
      }
    }
  );

  // ==========================================================================
  // FLUJO 8: Verificación Responsiva · Menú Móvil Adaptativo
  // ==========================================================================
  await grabarFlujo(
    '08_responsivo_movil_hamburguesa',
    'Diseño Responsivo · Viewport Móvil (390x844)',
    'Header minimalista, apertura de Menú Hamburguesa drawer, auto-layout vertical y adaptación a teclado virtual.',
    { width: 390, height: 844 },
    async (page) => {
      await manualPaso(page, 'MÓVIL', 'StudyMatch en pantalla de smartphone (390 x 844)');
      await page.goto('http://localhost:5173/');
      await sleep(1000);
      await cambiarUsuario(page, 'ana.torres@studymatch.com');

      // Abrir menú hamburguesa
      await manualPaso(page, 'PASO 1', 'Abrir Menú Hamburguesa responsivo en móvil');
      const btnMenu = page.getByRole('button', { name: /Abrir menú de navegación|Menú/i }).first();
      if (await btnMenu.isVisible()) {
        await manualClick(page, btnMenu, 'Clic en Menú');
        await sleep(1500);

        await manualPaso(page, 'PASO 2', 'Navegar a "Buscar sesiones" desde el drawer');
        const linkSesiones = page.getByRole('link', { name: /Buscar sesiones/i });
        if (await linkSesiones.isVisible()) {
          await manualClick(page, linkSesiones, 'Clic en "Buscar sesiones"');
          await sleep(1500);
        }
      }

      await manualScroll(page, 400, 'Visualización vertical adaptada para dispositivos móviles');
      await sleep(1500);
      await manualScroll(page, 400, 'Tarjetas compactas y botones táctiles ergonómicos');
      await sleep(2000);
    }
  );

  await browser.close();

  // Generar Dashboard HTML de Reproducción
  console.log('\n=== Generando visualizador web index.html ===');
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StudyMatch · Video Manual Interactivo para Defensa Final</title>
  <style>
    :root {
      --bg: #0f172a;
      --card-bg: #1e293b;
      --primary: #4f46e5;
      --primary-hover: #4338ca;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --border: #334155;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); padding: 24px; line-height: 1.5; }
    .header { text-align: center; max-width: 900px; margin: 0 auto 32px; }
    .header h1 { font-size: 28px; margin-bottom: 8px; color: #fff; }
    .header p { color: var(--text-muted); font-size: 15px; }
    .badge-info { display: inline-block; background: #312e81; color: #a5b4fc; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-top: 10px; }
    .container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 340px; gap: 24px; }
    @media (max-width: 900px) { .container { grid-template-columns: 1fr; } }
    .player-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
    video { width: 100%; border-radius: 8px; background: #000; outline: none; aspect-ratio: 16/9; }
    .video-info { margin-top: 16px; }
    .video-info h2 { font-size: 20px; color: #fff; margin-bottom: 8px; }
    .video-info p { color: var(--text-muted); font-size: 14px; margin-bottom: 12px; }
    .downloads { display: flex; gap: 10px; }
    .btn-dl { background: var(--primary); color: white; padding: 8px 14px; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 500; }
    .btn-dl:hover { background: var(--primary-hover); }
    .playlist { background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 16px; max-height: 600px; overflow-y: auto; }
    .playlist h3 { font-size: 16px; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
    .item { padding: 12px; border-radius: 8px; margin-bottom: 8px; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; }
    .item:hover { background: rgba(255,255,255,0.05); }
    .item.active { background: #312e81; border-color: var(--primary); }
    .item h4 { font-size: 14px; margin-bottom: 4px; color: #fff; }
    .item p { font-size: 12px; color: var(--text-muted); }
  </style>
</head>
<body>
  <div class="header">
    <h1>StudyMatch · Video Manual de Usuario para Defensa</h1>
    <p>Proyecto 2 · Interacción Hombre-Computador (IHC 2026-2) · Grabaciones con Cursor Visible, Clics Guiados y Banners de Pasos</p>
    <span class="badge-info">✨ Modo Manual de Usuario Activo: Cada acción, botón y regla está señalizada y explicada</span>
  </div>
  <div class="container">
    <div class="player-card">
      <video id="reproductor" controls autoplay>
        <source id="source-mp4" src="${videosGrabados[0]?.mp4 || ''}" type="video/mp4">
        <source id="source-webm" src="${videosGrabados[0]?.webm || ''}" type="video/webm">
        Tu navegador no soporta reproducción de video HTML5.
      </video>
      <div class="video-info">
        <h2 id="video-titulo">${videosGrabados[0]?.titulo || ''}</h2>
        <p id="video-desc">${videosGrabados[0]?.descripcion || ''}</p>
        <div class="downloads">
          <a id="dl-mp4" class="btn-dl" href="${videosGrabados[0]?.mp4 || ''}" download>Descargar .MP4</a>
          <a id="dl-webm" class="btn-dl" style="background:#334155;" href="${videosGrabados[0]?.webm || ''}" download>Descargar .WebM</a>
        </div>
      </div>
    </div>
    <div class="playlist">
      <h3>Lista de Reproducción (${videosGrabados.length} Videos)</h3>
      ${videosGrabados.map((v, i) => `
        <div class="item ${i === 0 ? 'active' : ''}" onclick="cargar(${i})">
          <h4>${v.titulo}</h4>
          <p>${v.descripcion.slice(0, 75)}...</p>
        </div>
      `).join('')}
    </div>
  </div>
  <script>
    const videos = ${JSON.stringify(videosGrabados)};
    function cargar(idx) {
      document.querySelectorAll('.item').forEach((el, i) => el.classList.toggle('active', i === idx));
      const v = videos[idx];
      document.getElementById('video-titulo').innerText = v.titulo;
      document.getElementById('video-desc').innerText = v.descripcion;
      document.getElementById('dl-mp4').href = v.mp4;
      document.getElementById('dl-webm').href = v.webm;
      const r = document.getElementById('reproductor');
      r.src = v.mp4;
      r.play();
    }
  </script>
</body>
</html>`;

  fs.writeFileSync(path.join(OUT_DIR, 'index.html'), html, 'utf8');
  fs.writeFileSync(path.join(PRESENTABLES_DIR, 'index.html'), html, 'utf8');
  console.log('✓ Visualizador creado en:');
  console.log(`  - ${path.join(OUT_DIR, 'index.html')}`);
  console.log(`  - ${path.join(PRESENTABLES_DIR, 'index.html')}`);

} finally {
  matar(backend);
  matar(frontend);
  fs.rmSync(db, { force: true });
}

console.log('\n=== ¡Grabación de todos los videos finalizada con éxito! ===');
