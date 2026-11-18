// Opciones compartidas de monocart-coverage-reports (cobertura del frontend).
// Las usan tests/fixtures/cobertura.ts (para acumular) y scripts/cobertura.mjs (para generar el reporte).
//
// - Solo se mide JavaScript de la app (.js y .jsx de frontend/src). El CSS no es código
//   ejecutable: contarlo como «cubierto» inflaría el porcentaje sin decir nada real.
// - Los source maps de Vite nombran los archivos solo por su nombre («Auth.jsx»); se
//   traducen a la ruta del repositorio (frontend/src/Auth.jsx) para que diff-cover los
//   relacione con las líneas agregadas en git.
const esCodigoApp = (p) => !p.includes('node_modules') && /\.(jsx?|mjs)$/.test(p.split('?')[0]);

export const opcionesCobertura = {
  name: 'Cobertura del frontend (E2E)',
  outputDir: './coverage/frontend',
  entryFilter: (entry) => entry.url.includes('/src/') && esCodigoApp(entry.url),
  sourceFilter: (sourcePath) => esCodigoApp(sourcePath),
  sourcePath: (filePath) => {
    const p = filePath.replace(/\\/g, '/');
    const i = p.lastIndexOf('/src/');
    const nombre = i >= 0 ? p.slice(i + 5) : p.split('/').pop();
    return 'frontend/src/' + nombre;
  },
  reports: [['cobertura', { file: 'cobertura-coverage.xml' }], ['lcovonly'], ['console-summary']],
};
