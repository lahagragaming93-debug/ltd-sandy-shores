// ============================================================
// Initialise 8 embauches en attente dans rhEvenements
// pour les employes detectes dans la categorie Discord
// #══ LIAISONS EMPLOYER ══.
// ============================================================
// Le patron les voit ensuite dans /admin section "Embauches a
// traiter" et finalise la creation de compte (email, idPerso,
// mot de passe provisoire) via l'UI.
// ============================================================
// Usage :
//   cd firebase/functions
//   node scripts/init-embauches.js          dry-run
//   node scripts/init-embauches.js --apply  execute
// ============================================================

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');

// Liste finale alignee avec la convention nom famille en MAJUSCULES, prenom en Title Case.
// Slug Discord = {nom-famille}-{prenom} (ex. williams-hailey = WILLIAMS / Hailey).
const EMBAUCHES = [
  { nom: 'WILLIAMS',   prenom: 'Charlie',  roleSuggere: 'pompiste',  channelId: '1480336098776453291' },
  { nom: 'MARS',       prenom: 'Liam',     roleSuggere: 'pompiste',  channelId: '1442247855300415618' },
  { nom: 'JACKERTON',  prenom: 'Maverick', roleSuggere: 'epicier',   channelId: '1488593306911903885' },
  { nom: 'TAC',        prenom: 'Tony',     roleSuggere: 'epicier',   channelId: '1488580926052237412' },
  { nom: 'DAVIS',      prenom: 'Logan',    roleSuggere: 'epicier',   channelId: '1486143802681852014' },
  { nom: 'WALLACE',    prenom: 'Travis',   roleSuggere: 'epicier',   channelId: '1486124834865020999' },
  { nom: 'WILLIAMS',   prenom: 'Hailey',   roleSuggere: 'epicier',   channelId: '1479624244856885292' },
  { nom: 'BROAS',      prenom: 'Nesquik',  roleSuggere: 'manager',   channelId: '1501859268624908298' }
];

const APPLY = process.argv.includes('--apply');

function loadServiceAccount() {
  try { return JSON.parse(readFileSync(KEY_PATH, 'utf-8')); }
  catch (err) {
    console.error(`\nImpossible de lire ${KEY_PATH}\nErreur: ${err.message}\n`);
    process.exit(1);
  }
}

async function main() {
  console.log('='.repeat(70));
  console.log(`Init embauches en attente — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(70));
  console.log(`${EMBAUCHES.length} embauches a creer dans rhEvenements (type=embauche, traitee=false)\n`);

  for (const e of EMBAUCHES) {
    console.log(`  ${e.nom.padEnd(12)} ${e.prenom.padEnd(10)} role=${e.roleSuggere.padEnd(9)} channel=${e.channelId}`);
  }

  if (!APPLY) {
    console.log('\nDry-run termine. Relance avec --apply.');
    process.exit(0);
  }

  const sa = loadServiceAccount();
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
  const db = getFirestore();

  // Anti-doublon : verifie si une embauche identique non-traitee existe deja
  const dejaSnap = await db.collection('rhEvenements')
    .where('type', '==', 'embauche')
    .where('traitee', '==', false)
    .get();
  const dejaParCleNomPrenom = new Map();
  for (const d of dejaSnap.docs) {
    const x = d.data();
    const k = `${(x.nom || '').toUpperCase()}-${(x.prenom || '').toLowerCase()}`;
    dejaParCleNomPrenom.set(k, d.id);
  }

  let created = 0, skipped = 0;
  for (const e of EMBAUCHES) {
    const k = `${e.nom}-${e.prenom.toLowerCase()}`;
    if (dejaParCleNomPrenom.has(k)) {
      console.log(`SKIP ${e.nom} ${e.prenom} (deja en attente : ${dejaParCleNomPrenom.get(k)})`);
      skipped++;
      continue;
    }
    await db.collection('rhEvenements').add({
      type:    'embauche',
      prenom:  e.prenom,
      nom:     e.nom,
      idDiscord: '',           // user ID Discord (pas le channel ID — a saisir au moment de la creation du compte)
      idPerso:   '',           // FiveM character ID — a saisir au moment de la creation du compte
      parQui:    'init-script-2026-05-10 (depuis catego LIAISONS EMPLOYER)',
      timestamp: FieldValue.serverTimestamp(),
      traitee:   false,
      // Champs extras pour audit / pre-remplissage UI
      roleSuggere:        e.roleSuggere,
      discordChannelId:   e.channelId,
      sourceDetection:    'categorie-liaisons-employer'
    });
    console.log(`OK   ${e.nom} ${e.prenom}`);
    created++;
  }

  console.log(`\nDone : ${created} crees, ${skipped} skipped.`);
  process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
