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

async function manualPaso(page, badge, texto) {
  await page.evaluate(({ b, t }) => {
    window.__manual_set_step?.(t, b);
  }, { b: badge, t: texto }).catch(() => {});
  await sleep(700);
}

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
    await sleep(200);
    await locator.evaluate((el) => el.classList.remove('manual-target-glow')).catch(() => {});
  }
  await locator.click();
  await sleep(400);
}

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

  const type = await locator.getAttribute('type').catch(() => null);
  if (type === 'date') {
    await locator.fill(texto);
  } else {
    await locator.fill('');
    await locator.pressSequentially(texto, { delay });
    await locator.fill(texto);
  }
  await locator.evaluate((el) => el.classList.remove('manual-target-glow')).catch(() => {});
  await sleep(300);
}

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

async function cambiarUsuario(page, email, password = 'Password123!') {
  await manualPaso(page, 'LOGIN', `Iniciando sesión como ${email}`);

  const btnLogout = page.getByRole('button', { name: /Cerrar sesión/i }).first();
  if (await btnLogout.isVisible().catch(() => false)) {
    await manualClick(page, btnLogout, 'Clic en "Cerrar sesión"');
    await sleep(600);
  }
  
  await page.goto('http://localhost:5173/login');
  await sleep(300);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await sleep(500);

  await page.waitForSelector('input[name="email"]', { timeout: 8000 }).catch(() => {});
  await sleep(250);

  const inputEmail = page.locator('input[name="email"]');
  const inputPass = page.locator('input[name="password"]');
  await manualEscribir(page, inputEmail, email, 'Ingresar correo');
  await manualEscribir(page, inputPass, password, 'Ingresar contraseña');
  await inputEmail.fill(email);
  await inputPass.fill(password);
  await sleep(250);

  await manualClick(page, page.getByRole('button', { name: 'Iniciar Sesion' }), 'Clic en "Iniciar Sesión"');
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 }).catch(() => { });
  await sleep(1000);
}

async function main() {
  console.log('=== Grabando Flujo 3: Reprogramación Ética y Reconfirmación ===\n');

  for (const p of [8000, 5173]) {
    if (!(await puertoLibre(p))) {
      console.log(`Liberando puerto ${p}...`);
      spawnSync('powershell', ['-Command', `Get-NetTCPConnection -LocalPort ${p} -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }`]);
      await sleep(1500);
    }
  }

  const db = path.join(os.tmpdir(), `studymatch-videos-${Date.now()}.db`).replace(/\\/g, '/');
  const env = { ...process.env, DATABASE_URL: `sqlite:///${db}`, PYTHONUTF8: '1' };

  spawnSync(PY, ['seed_data.py'], { cwd: BACKEND, env, stdio: 'inherit' });

  const backend = spawn(PY, ['-m', 'uvicorn', 'main:app', '--port', '8000', '--host', '127.0.0.1'], { cwd: BACKEND, env, stdio: 'inherit' });
  const frontend = spawn(WIN ? 'pnpm.cmd' : 'pnpm', ['run', 'dev', '--port', '5173', '--strictPort'], { cwd: FRONTEND, env: { ...process.env }, shell: WIN, stdio: 'inherit' });

  try {
    await esperar('http://127.0.0.1:8000/docs');
    await esperar('http://localhost:5173/');
    await sleep(2000);
    console.log('✓ Servidores listos: Backend y Frontend\n');

    const browser = await chromium.launch({ headless: true });
    const id = '03_tarea7_reprogramacion_reconfirmacion';
    const titulo = 'Tarea 7 · Reprogramación Ética y Reconfirmación';
    const viewport = { width: 1280, height: 720 };

    console.log(`▶ Grabando [${id}]...`);
    const tempVideoDir = fs.mkdtempSync(path.join(os.tmpdir(), `sm-video-${id}-`));
    const context = await browser.newContext({
      viewport,
      recordVideo: { dir: tempVideoDir, size: viewport },
    });
    await context.addInitScript(MANUAL_SCRIPT);

    const page = await context.newPage();

    const ts = Date.now();
    const nombreSesion = `Taller de Usabilidad y Accesibilidad (${ts})`;

    // 1. Carlos crea la sesión con fecha futura inicial: 2026-11-28
    await manualPaso(page, 'PASO 1', 'Carlos Mendoza programa sesión para el 28/11/2026');
    await cambiarUsuario(page, 'carlos.mendoza@studymatch.com');
    await page.goto('http://localhost:5173/new-study');
    await sleep(800);
    await manualEscribir(page, page.getByLabel('nombre'), nombreSesion, 'Nombre de la sesión');
    await manualEscribir(page, page.getByLabel('Materia'), 'Interacción Hombre-Computador', 'Materia');
    await manualSelect(page, page.getByLabel('Modalidad'), 'presencial', 'Modalidad');
    await manualEscribir(page, page.getByLabel('cupo'), '3', 'Cupo: 3');
    await manualEscribir(page, page.getByLabel('fecha'), '2026-11-28', 'Fecha inicial: 2026-11-28');
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

    // 3. Carlos reprograma la sesión desde el Dashboard hacia una fecha posterior: 2026-12-05
    await manualPaso(page, 'PASO 4', 'Carlos solicita reprogramación ética desde su panel con motivo obligatorio');
    await page.goto('http://localhost:5173/dashboard?tab=mis-sesiones');
    await sleep(1500);

    // Buscar exactamente la tarjeta de la sesión en el grid de Mis Sesiones
    const cardCarlos = page.locator('.col', { has: page.getByRole('heading', { name: nombreSesion }) });
    const btnReprog = cardCarlos.getByRole('button', { name: /Reprogramar sesión/i }).first();
    await manualClick(page, btnReprog, 'Clic en "Reprogramar sesión"');
    await sleep(1200);

    // Llenar nueva fecha y motivo en el modal
    await manualPaso(page, 'PASO 5', 'Establecer nueva fecha futura (05/12/2026) y motivo académico');
    await manualEscribir(page, page.locator('#reprog-fecha-dash'), '2026-12-05', 'Nueva fecha: 2026-12-05');
    await manualEscribir(page, page.locator('#reprog-motivo-dash'), 'Cambio al Laboratorio 4 para pruebas prácticas con lectores de pantalla', 'Motivo del cambio');
    await sleep(1200);
    await manualClick(page, page.getByRole('button', { name: /Confirmar reprogramación/i }), 'Clic en "Confirmar reprogramación"');
    await sleep(2500);

    // 4. Ana ve la notificación con el motivo visible y reconfirma en Mis Solicitudes
    await manualPaso(page, 'PASO 6', 'Ana revisa el motivo transparente del cambio y reconfirma asistencia');
    await cambiarUsuario(page, 'ana.torres@studymatch.com');
    await page.goto('http://localhost:5173/dashboard?tab=solicitudes');
    await sleep(1500);

    const cardAna = page.locator('.card', { has: page.getByRole('heading', { name: nombreSesion }) }).first();
    const btnAceptarFecha = cardAna.getByRole('button', { name: /Aceptar nueva fecha/i }).first();
    await manualClick(page, btnAceptarFecha, 'Clic en "Aceptar nueva fecha"');
    await sleep(1500);

    await manualPaso(page, 'COMPLETADO', 'Asistencia reconfirmada con éxito. Cupo asegurado en la nueva fecha.');
    await sleep(2000);

    await page.close();
    await context.close();
    await sleep(600);
    await browser.close();

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
    console.log('✓ Flujo 3 regrabado exitosamente.\n');

  } catch (err) {
    console.error("FATAL ERROR EN REGRABACIÓN DE FLUJO 3:", err);
  } finally {
    matar(backend);
    matar(frontend);
    try { fs.rmSync(db, { force: true }); } catch {}
  }

  // Ahora regenerar el video completo unificado
  console.log('=== Reensamblando video completo unificado ===');
  spawnSync('node', [path.join(ROOT, 'scripts', 'unir_videos_defensa.mjs')], { cwd: ROOT, stdio: 'inherit' });
}

main().catch(console.error);
