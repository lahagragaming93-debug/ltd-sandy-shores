// Active l'API Apps Script via Service Usage API
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { google } from 'googleapis';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');

const auth = new google.auth.GoogleAuth({
  keyFile: KEY_PATH,
  scopes: ['https://www.googleapis.com/auth/cloud-platform', 'https://www.googleapis.com/auth/service.management']
});

const serviceusage = google.serviceusage({ version: 'v1', auth });

console.log('Activation de script.googleapis.com sur le projet ltd-sandy-shores-f3919...');
try {
  const resp = await serviceusage.services.enable({
    name: 'projects/1070326769058/services/script.googleapis.com'
  });
  console.log('✓ API Apps Script activée (ou déjà active)');
  console.log('  Réponse :', resp.data?.name || 'OK');
} catch (e) {
  console.error('✗ Erreur :', e.message);
  if (e.code === 403) {
    console.error('  Le service account n\'a pas le role roles/serviceusage.serviceUsageAdmin');
  }
  process.exit(1);
}
process.exit(0);
