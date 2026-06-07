// ============================================================
// Build front LTD Sandy Shores — bundle + minifie chaque page.
// ------------------------------------------------------------
// Chaque public/js/pages/X.js → public/js/dist/X.js (1 fichier minifié au lieu
// d'une cascade de ~14 modules ES). Les imports Firebase (https://www.gstatic…)
// restent EXTERNES → chargés depuis le CDN Google, pas bundlés.
// Lancé en CI (GitHub Actions) avant le déploiement Pages : si ce build échoue,
// rien n'est déployé (l'ancienne version reste en ligne).
//   Local : npm install && node build.mjs
// ============================================================
import { build } from 'esbuild';
import { readdirSync } from 'fs';

const SRC = 'public/js/pages';
const OUT = 'public/js/dist';
const entries = readdirSync(SRC).filter(f => f.endsWith('.js')).map(f => `${SRC}/${f}`);

const externalHttps = {
  name: 'external-https',
  setup(b) { b.onResolve({ filter: /^https?:\/\// }, a => ({ path: a.path, external: true })); }
};

await build({
  entryPoints: entries,
  bundle: true,
  format: 'esm',        // garde le top-level await (déjà utilisé par le site)
  minify: true,
  target: 'es2022',
  outdir: OUT,
  plugins: [externalHttps],
  logLevel: 'info'
});
console.log(`Build OK — ${entries.length} pages bundlées dans ${OUT}/`);
