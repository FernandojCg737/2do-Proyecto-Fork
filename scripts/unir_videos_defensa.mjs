import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIDEOS_DIR = path.join(ROOT, 'videos_defensa');
const PRESENTABLES_DIR = path.resolve('D:/INTERACCION HOMBRE-COMPUTADOR/Presentables 2do proyecto/videos_defensa');
const FFMPEG = path.join(ROOT, 'backend', 'venv', 'Lib', 'site-packages', 'imageio_ffmpeg', 'binaries', 'ffmpeg-win-x86_64-v9.0.2.exe');

const SECCIONES = [
  {
    num: '01',
    archivo: '01_flujo_principal_login_catalogo.mp4',
    badge: 'AUTENTICACIÓN Y CATÁLOGO',
    titulo: 'Flujo Principal · Login y Catálogo Reactivo',
    subtitulo: 'Autenticación con credenciales limpias, filtros en tiempo real y tokens accesibles.',
  },
  {
    num: '02',
    archivo: '02_tarea6_lista_espera_fifo.mp4',
    badge: 'TAREA 6 · ARQUITECTURA FIFO',
    titulo: 'Lista de Espera Transparente (FIFO)',
    subtitulo: 'Sesión llena (1/1), ingreso a espera (Lugar #1), salida voluntaria y ascenso automático.',
  },
  {
    num: '03',
    archivo: '03_tarea7_reprogramacion_reconfirmacion.mp4',
    badge: 'TAREA 7 · REPROGRAMACIÓN ÉTICA',
    titulo: 'Reprogramación Ética y Reconfirmación',
    subtitulo: 'Cambio con motivo obligatorio (05/12/2026), bloqueo de duplicados y reconfirmación.',
  },
  {
    num: '04',
    archivo: '04_tarea8_asistencia_y_justificaciones.mp4',
    badge: 'TAREA 8 · ASISTENCIA Y JUSTIFICACIONES',
    titulo: 'Control de Asistencia Inmutable',
    subtitulo: 'Toma de asistencia presencial/remota y resolución responsable de justificaciones.',
  },
  {
    num: '05',
    archivo: '05_tarea9_cancelacion_y_analitica.mp4',
    badge: 'TAREA 9 · CANCELACIÓN Y TELEMETRÍA',
    titulo: 'Cancelación Responsable y Panel /analitica',
    subtitulo: 'Cancelación definitiva con motivo público y visualización de embudos de telemetría.',
  },
  {
    num: '06',
    archivo: '06_clase22_patrones_oscuros_honestidad.mp4',
    badge: 'CLASE 22 · DISEÑO ÉTICO',
    titulo: 'Erradicación de Patrones Oscuros',
    subtitulo: 'Principio de Honestidad: cálculo matemático de cupos reales sin falsas urgencias.',
  },
  {
    num: '07',
    archivo: '07_tarea10_salida_honesta_expediente.mp4',
    badge: 'TAREA 10 · SALIDA HONESTA',
    titulo: 'Expediente del Alumno y Salida Honesta',
    subtitulo: 'Descarga en JSON/CSV y bloqueo preventivo de eliminación con compromisos activos.',
  },
  {
    num: '08',
    archivo: '08_responsivo_movil_hamburguesa.mp4',
    badge: 'DISEÑO RESPONSIVO',
    titulo: 'Experiencia Móvil y Menú Hamburguesa',
    subtitulo: 'Viewport de smartphone (390 × 844 px), drawer colapsable y auto-layout táctil.',
  },
];

async function main() {
  console.log('=== Generando video unificado con separadores de título ===\n');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sm-unir-'));

  console.log('1. Renderizando diapositivas de separación con Playwright (1280x720)...');
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const listaConcat = [];

  for (let i = 0; i < SECCIONES.length; i++) {
    const s = SECCIONES[i];
    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    width: 1280px;
    height: 720px;
    background: radial-gradient(circle at 50% 25%, #1e1b4b 0%, #0f172a 85%);
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    color: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .counter {
    color: #a5b4fc;
    font-size: 16px;
    font-weight: 700;
    letter-spacing: 2.5px;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .tag {
    background: linear-gradient(135deg, #4f46e5, #4338ca);
    color: #ffffff;
    padding: 8px 26px;
    border-radius: 9999px;
    font-size: 15px;
    font-weight: 800;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    box-shadow: 0 4px 20px rgba(99, 102, 241, 0.45);
    margin-bottom: 26px;
    border: 1.5px solid #818cf8;
  }
  h1 {
    font-size: 44px;
    font-weight: 800;
    margin: 0 0 18px;
    background: linear-gradient(135deg, #ffffff 40%, #e2e8f0);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    line-height: 1.25;
    max-width: 950px;
  }
  p {
    font-size: 21px;
    color: #94a3b8;
    max-width: 820px;
    margin: 0;
    line-height: 1.5;
  }
  .footer {
    position: absolute;
    bottom: 34px;
    display: flex;
    align-items: center;
    gap: 12px;
    font-size: 14px;
    color: #64748b;
    font-weight: 600;
    letter-spacing: 0.5px;
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #6366f1;
  }
</style>
</head>
<body>
  <div class="counter">DEMOSTRACIÓN ${i + 1} DE ${SECCIONES.length}</div>
  <div class="tag">${s.badge}</div>
  <h1>${s.titulo}</h1>
  <p>${s.subtitulo}</p>
  <div class="footer">
    <span>StudyMatch · Interacción Hombre-Computador</span>
    <span class="dot"></span>
    <span>Defensa Proyecto 2</span>
  </div>
</body>
</html>`;

    await page.setContent(html);
    const pngPath = path.join(tempDir, `card_${s.num}.png`);
    await page.screenshot({ path: pngPath });

    // 2. Crear video de 3 segundos para el separador (1280x720, 30fps)
    const titleVideoPath = path.join(tempDir, `title_${s.num}.mp4`);
    console.log(`  -> Creando separador para [${s.num}]: ${s.titulo}...`);
    spawnSync(FFMPEG, [
      '-y',
      '-loop', '1',
      '-i', pngPath,
      '-c:v', 'libx264',
      '-t', '3.0',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-vf', 'scale=1280:720,setsar=1',
      titleVideoPath,
    ], { stdio: 'ignore' });

    listaConcat.push(titleVideoPath);

    // 3. Normalizar el video del contenido a 1280x720, 30fps con pad
    const srcVideo = path.join(VIDEOS_DIR, s.archivo);
    const normVideoPath = path.join(tempDir, `norm_${s.num}.mp4`);
    console.log(`  -> Normalizando video [${s.num}]: ${s.archivo}...`);
    spawnSync(FFMPEG, [
      '-y',
      '-i', srcVideo,
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-r', '30',
      '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black,setsar=1',
      normVideoPath,
    ], { stdio: 'ignore' });

    listaConcat.push(normVideoPath);
  }

  await browser.close();

  // 4. Escribir lista de concatenación
  const listFile = path.join(tempDir, 'concat_list.txt');
  const fileLines = listaConcat.map((f) => `file '${f.replace(/\\/g, '/')}'`).join('\n');
  fs.writeFileSync(listFile, fileLines, 'utf8');

  // 5. Concatenar todo en el video final
  console.log('\n2. Uniendo todos los bloques en el video definitivo...');
  const outLocal = path.join(VIDEOS_DIR, 'video_defensa_completo.mp4');
  const outPresentables = path.join(PRESENTABLES_DIR, 'video_defensa_completo.mp4');

  const joinRes = spawnSync(FFMPEG, [
    '-y',
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c', 'copy',
    outLocal,
  ], { stdio: 'inherit' });

  if (joinRes.status === 0 && fs.existsSync(outLocal)) {
    fs.copyFileSync(outLocal, outPresentables);
    const sizeMb = (fs.statSync(outLocal).size / 1024 / 1024).toFixed(2);
    console.log(`\n✓ ¡Video completo generado con éxito! (${sizeMb} MB)`);
    console.log(`  - Local:        ${outLocal}`);
    console.log(`  - Presentables: ${outPresentables}`);
  } else {
    console.error('✗ Error concatenando los videos.');
  }

  // Limpieza
  fs.rmSync(tempDir, { recursive: true, force: true });
}

main().catch(console.error);
