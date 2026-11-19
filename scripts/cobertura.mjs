// ============================================================================
// Reporte de cobertura del código agregado en el fork (diff-cover)
// ============================================================================
// Uso (desde la raíz del repositorio):   pnpm cobertura
//
// 1. Pruebas unitarias del backend con coverage.py.
// 2. Carga de datos de prueba (seed_data.py) con coverage.py, en una base SQLite temporal
//    (dos veces: la segunda comprueba que se conservan los datos existentes).
// 3. Backend con coverage.py + frontend (Vite) + las pruebas E2E de Playwright,
//    registrando la cobertura V8 del frontend (COBERTURA=1).
// 4. diff-cover compara contra el repositorio original (upstream/main) y genera
//    docs/cobertura/index.html y docs/cobertura/resumen.md.
//
// Requisitos: puertos 8000 y 5173 libres (detén Docker con `docker compose stop`),
// el entorno virtual backend/venv con requirements + coverage + diff-cover, y el remoto
// `upstream` apuntando al repositorio original (ver README).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import MCR from 'monocart-coverage-reports';
import { opcionesCobertura } from './cobertura-opciones.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');
const WIN = process.platform === 'win32';
const PY = fs.existsSync(path.join(BACKEND, 'venv', WIN ? 'Scripts/python.exe' : 'bin/python'))
  ? path.join(BACKEND, 'venv', WIN ? 'Scripts/python.exe' : 'bin/python') : 'python';
const RAMA_BASE = process.env.COMPARE_BRANCH || 'upstream/main';
const paso = (t) => console.log(`\n=== ${t} ===`);
// Sin shell: la ruta del proyecto puede tener espacios. Solo `pnpm` (un .cmd en Windows) necesita shell.
const correr = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { stdio: 'inherit', shell: WIN && cmd === 'pnpm', ...opts }); return r.status; };
const puertoLibre = (p) => new Promise((ok) => { const s = net.createServer().once('error', () => ok(false)).once('listening', () => s.close(() => ok(true))).listen(p, '127.0.0.1'); });
const esperar = async (url, seg = 90) => { for (let i = 0; i < seg * 2; i++) { try { const r = await fetch(url); if (r.ok) return; } catch {} await new Promise((r) => setTimeout(r, 500)); } throw new Error('No respondió: ' + url); };
const matar = (proc) => { if (!proc || proc.exitCode !== null) return; if (WIN) spawnSync('taskkill', ['/pid', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); else proc.kill('SIGTERM'); };

for (const p of [8000, 5173]) if (!(await puertoLibre(p))) { console.error(`El puerto ${p} está ocupado. Detén los servidores (p. ej. \`docker compose stop\`) y vuelve a intentar.`); process.exit(1); }

// Capturas de evidencias que ya estaban modificadas antes (para no tocarlas al final)
const pngsModificados = () => spawnSync('git', ['status', '--porcelain', '--', 'evidencias'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\n').filter((l) => /^ M .*\.png$/.test(l)).map((l) => l.slice(3).trim());
const pngsAntes = new Set(pngsModificados());

// Limpieza de corridas anteriores
// Solo los datos (.coverage y .coverage.<máquina>.<pid>), nunca la configuración .coveragerc
for (const f of fs.readdirSync(BACKEND)) if (f === '.coverage' || f.startsWith('.coverage.')) fs.rmSync(path.join(BACKEND, f), { force: true });
fs.rmSync(path.join(ROOT, 'coverage'), { recursive: true, force: true });
await MCR(opcionesCobertura).cleanCache();

const db = path.join(os.tmpdir(), `studymatch-cobertura-${Date.now()}.db`).replace(/\\/g, '/');
const env = { ...process.env, DATABASE_URL: `sqlite:///${db}`, PYTHONUTF8: '1' };

paso('1/5 Pruebas unitarias del backend (coverage.py)');
const unitarias = correr(PY, ['-m', 'coverage', 'run', '-m', 'unittest', 'discover', '-s', 'tests', '-t', '.'], { cwd: BACKEND, env });

paso('2/5 Datos de prueba (seed_data.py) en una base SQLite temporal');
correr(PY, ['-m', 'coverage', 'run', 'seed_data.py'], { cwd: BACKEND, env });
// Segunda carga: la base ya tiene datos y el seed debe conservarlos (persistencia al reiniciar Docker).
correr(PY, ['-m', 'coverage', 'run', 'seed_data.py'], { cwd: BACKEND, env });

paso('3/5 Backend + frontend + pruebas E2E (Playwright)');
const parada = path.join(os.tmpdir(), `studymatch-parada-${Date.now()}`);
const backend = spawn(PY, [path.join(ROOT, 'scripts', 'servidor_backend_cobertura.py'), parada], { cwd: BACKEND, env, stdio: 'inherit' });
const frontend = spawn(process.execPath, [path.join(FRONTEND, 'node_modules', 'vite', 'bin', 'vite.js'), '--port', '5173', '--strictPort'], { cwd: FRONTEND, env: { ...process.env }, stdio: 'ignore' });
let e2e = 1;
try {
  await esperar('http://127.0.0.1:8000/docs');
  await esperar('http://localhost:5173/');
  // Argumentos extra (p. ej. `pnpm cobertura tests/tarea9_cancelar_sesion.spec.ts`) se pasan a Playwright.
  const argsPlaywright = ['exec', 'playwright', 'test', '--reporter=list,html', ...process.argv.slice(2)];
  e2e = correr('pnpm', argsPlaywright, {
    cwd: ROOT,
    env: {
      ...process.env,
      COBERTURA: '1',
      PLAYWRIGHT_HTML_OPEN: 'never',
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=4096`.trim(),
    },
  });
} finally {
  fs.writeFileSync(parada, 'fin');
  await new Promise((r) => { const t = setTimeout(() => { matar(backend); r(); }, 20000); backend.once('exit', () => { clearTimeout(t); r(); }); });
  matar(frontend);
  fs.rmSync(parada, { force: true });
}

paso('4/5 Reportes de cobertura (backend y frontend)');
correr(PY, ['-m', 'coverage', 'combine'], { cwd: BACKEND });
fs.mkdirSync(path.join(ROOT, 'coverage', 'backend'), { recursive: true });
correr(PY, ['-m', 'coverage', 'xml', '-o', path.join(ROOT, 'coverage', 'backend', 'coverage.xml')], { cwd: BACKEND });
await MCR(opcionesCobertura).generate();

paso(`5/5 diff-cover: solo las líneas agregadas en el fork (contra ${RAMA_BASE})`);
fs.mkdirSync(path.join(ROOT, 'docs', 'cobertura'), { recursive: true });
const diffCover = path.join(BACKEND, 'venv', WIN ? 'Scripts/diff-cover.exe' : 'bin/diff-cover');
const dc = correr(fs.existsSync(diffCover) ? diffCover : 'diff-cover', [
  'coverage/backend/coverage.xml', 'coverage/frontend/cobertura-coverage.xml',
  `--compare-branch=${RAMA_BASE}`,
  '--format', 'html:docs/cobertura/index.html,markdown:docs/cobertura/resumen.md',
], { cwd: ROOT });
correr(fs.existsSync(diffCover) ? diffCover : 'diff-cover', ['coverage/backend/coverage.xml', 'coverage/frontend/cobertura-coverage.xml', `--compare-branch=${RAMA_BASE}`], { cwd: ROOT });

// El reporte E2E (playwright-report/) lleva también la cobertura, como pidió el docente
const reporteE2E = path.join(ROOT, 'playwright-report');
if (fs.existsSync(reporteE2E)) {
  fs.cpSync(path.join(ROOT, 'docs', 'cobertura'), path.join(reporteE2E, 'cobertura'), { recursive: true });
  fs.writeFileSync(path.join(reporteE2E, 'LEEME.md'), [
    '# Reporte de pruebas E2E y cobertura',
    '',
    '- `index.html`: reporte de Playwright (todas las pruebas E2E). Ábrelo con `pnpm exec playwright show-report`.',
    '- `cobertura/index.html`: diff-cover, cobertura del código agregado en el fork (backend + frontend).',
    '- `cobertura/resumen.md`: el mismo resultado en texto.',
    '',
    'Se genera con `pnpm cobertura` desde la raíz del repositorio.',
    '',
  ].join('\n'));
}

// Las pruebas E2E regeneran capturas en evidencias/: se restauran las que no estaban modificadas antes
const nuevas = pngsModificados().filter((f) => !pngsAntes.has(f));
if (nuevas.length) spawnSync('git', ['checkout', '--', ...nuevas], { cwd: ROOT });
fs.rmSync(db, { force: true });

console.log(`\nPruebas unitarias: ${unitarias === 0 ? 'OK' : 'con fallos'} · E2E: ${e2e === 0 ? 'OK' : 'con fallos'} · diff-cover: ${dc === 0 ? 'OK' : 'error'}`);
console.log('Reportes: playwright-report/index.html (E2E) · playwright-report/cobertura/index.html y docs/cobertura/ (cobertura)');
process.exit(unitarias || e2e || dc ? 1 : 0);
