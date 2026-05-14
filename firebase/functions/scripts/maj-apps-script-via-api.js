// Modifie l'Apps Script du Sheet via l'API script.googleapis.com
// pour neutraliser le trigger qui écrase le Dashboard pro.
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
const SCRIPT_ID = '1ieOg3yzzCwHdA62gB1Txgp1i35LcjF1ETYDfeI8Td1A7loPnrAdEDh84';

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: [
    'https://www.googleapis.com/auth/script.projects',
    'https://www.googleapis.com/auth/script.deployments'
  ]
});

const script = google.script({ version: 'v1', auth });

console.log(`Tentative d'accès au projet Apps Script ${SCRIPT_ID}...\n`);

// 1. Lire le contenu actuel
try {
  const resp = await script.projects.getContent({ scriptId: SCRIPT_ID });
  console.log('✓ Lecture OK');
  console.log(`  Fichiers : ${resp.data.files?.length || 0}`);
  for (const f of resp.data.files || []) {
    console.log(`    - ${f.name}.${f.type === 'SERVER_JS' ? 'gs' : f.type.toLowerCase()} (${f.source?.length || 0} chars)`);
  }
} catch (e) {
  console.error('✗ Lecture échouée :', e.message);
  if (e.message?.includes('PERMISSION_DENIED')) {
    console.error('\n→ Le service account n\'a pas accès au projet Apps Script.');
    console.error('  Solutions :');
    console.error('  A) Active l\'API script.googleapis.com sur le projet GCP');
    console.error('  B) Partage le projet Apps Script avec le service account');
    console.error('     (Dans Apps Script Editor → ⚙ Project Settings → Editors → Add)');
  }
  process.exit(1);
}

// 2. Pousser le nouveau code (no-op total)
const NOUVEAU_CODE = `// ============================================================
// LTD Sandy Shores — Apps Script NEUTRALISE (2026-05-14)
// ============================================================
// Le Dashboard est desormais gere cote Node.js Firebase :
//   - Script : firebase/functions/scripts/refaire-dashboard-pro.js
//   - Cron protection : Cloud Function dashboardKeepAlive (H:02 horaire)
//   - Boutons site : 🔄 Rafraichir + 🔒 Cloturer (page Comptabilite)
//
// Ce script ne fait plus rien : toutes les fonctions sont des no-op
// pour empecher l'ancien Dashboard d'ecraser le visuel pro.
// ============================================================

function onOpen() {
  // Pas de menu cree
}

function creerDashboard() {
  console.log('creerDashboard NEUTRALISE - Dashboard gere par Node.js');
}

function formaterEntetes() {
  console.log('formaterEntetes NEUTRALISE - format gere par scripts/format-sheet.js');
}

function formaterEtDashboard() {
  console.log('formaterEtDashboard NEUTRALISE');
}

function lireDonneesSources() {
  return null;
}

function ecrireDashboard() {
  // no-op
}

function migrerOnglets() {
  // no-op
}
`;

const MANIFEST = JSON.stringify({
  timeZone: 'Europe/Paris',
  dependencies: {},
  exceptionLogging: 'STACKDRIVER',
  runtimeVersion: 'V8'
}, null, 2);

console.log('\nPoussée du nouveau code (no-op)...');
try {
  await script.projects.updateContent({
    scriptId: SCRIPT_ID,
    requestBody: {
      files: [
        { name: 'appsscript', type: 'JSON', source: MANIFEST },
        { name: 'Code', type: 'SERVER_JS', source: NOUVEAU_CODE }
      ]
    }
  });
  console.log('✓ Code pousse avec succes');
  console.log('  Le trigger horaire continue de tourner mais appelle desormais des no-op.');
  console.log('  Plus aucune ecriture sur l\'onglet Dashboard.');
} catch (e) {
  console.error('✗ Push échoué :', e.message);
  if (e.errors) console.error('  Détails :', JSON.stringify(e.errors, null, 2));
  process.exit(2);
}

process.exit(0);
