// ============================================================
// Import batch de 9 employes — 2026-05-11
// ============================================================
// Cree pour chaque employe :
//   - Firebase Auth user (email synthetique {username}@ltd-sandy-shores.local)
//   - /users/{uid} (avec telephone, iban en plus du standard)
//   - /dossiersEmployes/{batch-<username>} (fiche)
// Username = prenom.nom (lowercase, sans accents, espaces collapses)
// Mot de passe = aleatoire 12 chars (affiche en sortie pour le patron)
// Idempotent : skip si idPerso OU idDiscord OU username deja existant.
// ============================================================
// Usage :
//   cd firebase/functions
//   node scripts/import-employes-batch-2026-05-11.js          → dry-run
//   node scripts/import-employes-batch-2026-05-11.js --apply  → ecrit
// ============================================================

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth as getAdminAuth } from 'firebase-admin/auth';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
const APPLY = process.argv.includes('--apply');

const sa = JSON.parse(readFileSync(KEY_PATH, 'utf-8'));
initializeApp({ credential: cert(sa), projectId: sa.project_id });
const db = getFirestore();
const adminAuth = getAdminAuth();

const EMPLOYES = [
  { prenom: 'Teodomiro', nom: 'Souza',     idPerso: '133926', iban: 'WODHQK', tel: '0085664',  role: 'vendeur-novice',  idDiscord: '898208072579825745' },
  { prenom: 'Aaron',     nom: 'Araghon',   idPerso: '135487', iban: 'AARONN', tel: '722-3749', role: 'vendeur-novice',  idDiscord: '306762593903837184' },
  { prenom: 'T-Kay',     nom: 'Williams',  idPerso: '61632',  iban: 'LO8386', tel: '009-6709', role: 'vendeur-novice',  idDiscord: '1137159737750855761' },
  { prenom: 'Dias',      nom: 'Da Costa',  idPerso: '132416', iban: 'h61hpb', tel: '125-5778', role: 'vendeur-novice',  idDiscord: '901500687265972264' },
  { prenom: 'César',     nom: 'De La Cruz',idPerso: '133708', iban: 'OIE7JD', tel: '2931749',  role: 'pompiste-novice', idDiscord: '1291618876781629440' },
  { prenom: 'Dushane',   nom: 'Crook',     idPerso: '128770', iban: 'ZOPV7W', tel: '1924440',  role: 'vendeur-novice',  idDiscord: '499259608972394507' },
  { prenom: 'Jeorge',    nom: 'Stevenson', idPerso: '131482', iban: 'VMMXKR', tel: '1106322',  role: 'vendeur-novice',  idDiscord: '393106898599018518' },
  { prenom: 'Noé',       nom: 'Varga',     idPerso: '135138', iban: 'KKZWCV', tel: '186-4726', role: 'vendeur-novice',  idDiscord: '1137457442414927973' },
  { prenom: 'Kyle',      nom: 'Jackson',   idPerso: '131723', iban: 'SJEMKE', tel: '294-0418', role: 'vendeur-novice',  idDiscord: '965696737119465523' }
];

function slugify(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function genPwd() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let p = '';
  for (let i = 0; i < 12; i++) p += chars[Math.floor(Math.random() * chars.length)];
  return p;
}

async function exists(username, idDiscord, idPerso) {
  const checks = [];
  if (username)   checks.push(db.collection('users').where('username', '==', username).limit(1).get());
  if (idDiscord)  checks.push(db.collection('users').where('idDiscord', '==', idDiscord).limit(1).get());
  if (idPerso)    checks.push(db.collection('users').where('idPerso', '==', idPerso).limit(1).get());
  const results = await Promise.all(checks);
  for (const r of results) {
    if (!r.empty) return r.docs[0].id;
  }
  return null;
}

async function main() {
  console.log('='.repeat(60));
  console.log(`Import batch employes — ${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  console.log('='.repeat(60));
  console.log(`${EMPLOYES.length} employes a importer\n`);

  const credentials = [];
  let okCount = 0, skipCount = 0, errCount = 0;

  for (const e of EMPLOYES) {
    const username = `${slugify(e.prenom)}.${slugify(e.nom)}`;
    const existingUid = await exists(username, e.idDiscord, e.idPerso);
    if (existingUid) {
      console.log(`  ⊘ SKIP ${e.prenom} ${e.nom.toUpperCase()} (deja en base : uid=${existingUid})`);
      skipCount++;
      continue;
    }

    const password = genPwd();
    const email = `${username}@ltd-sandy-shores.local`;

    if (!APPLY) {
      console.log(`  + ${e.prenom} ${e.nom.toUpperCase().padEnd(15)} username=${username.padEnd(22)} role=${e.role}`);
      okCount++;
      continue;
    }

    try {
      // 1) Firebase Auth
      const userRecord = await adminAuth.createUser({
        email,
        password,
        emailVerified: true,
        displayName: `${e.prenom} ${e.nom}`
      });
      // 2) /users
      await db.collection('users').doc(userRecord.uid).set({
        username,
        email,
        prenom: e.prenom,
        nom: e.nom.toUpperCase(),
        idDiscord: e.idDiscord,
        idPerso: e.idPerso,
        role: e.role,
        statut: 'actif',
        dateEntree: new Date().toISOString().slice(0, 10),
        creePar: 'import-batch-2026-05-11',
        motDePasseProvisoire: true,
        telephone: e.tel,
        iban: e.iban
      });
      // 3) /dossiersEmployes (audit + enrichissement futur via #📋 Dossiers-Employers)
      await db.collection('dossiersEmployes').doc(`batch-${username}`).set({
        threadId: '',
        threadName: `${e.prenom}-${e.nom}`,
        parentForumId: '',
        nomPrenom: `${e.prenom} ${e.nom}`,
        prenom: e.prenom,
        nom: e.nom.toUpperCase(),
        telephone: e.tel,
        iban: e.iban,
        cni: '',
        permis: '',
        pole: e.role.includes('pompiste') ? 'pompiste' : 'vendeur',
        grade: e.role,
        idDiscord: e.idDiscord,
        idPerso: e.idPerso,
        parsedAt: FieldValue.serverTimestamp(),
        source: 'import-batch-2026-05-11',
        userId: userRecord.uid
      });

      credentials.push({ employe: `${e.prenom} ${e.nom.toUpperCase()}`, username, password });
      console.log(`  ✓ ${e.prenom} ${e.nom.toUpperCase().padEnd(15)} username=${username.padEnd(22)} password=${password}`);
      okCount++;
    } catch (err) {
      console.error(`  ✗ ${e.prenom} ${e.nom.toUpperCase()} : ${err.message}`);
      errCount++;
    }
  }

  console.log(`\nResume : ${okCount} crees, ${skipCount} skippes, ${errCount} erreurs.`);

  if (APPLY && credentials.length > 0) {
    const credFile = resolve(__dirname, '../../../IDENTIFIANTS-BATCH-2026-05-11.txt');
    const lines = [
      'IDENTIFIANTS BATCH IMPORT — 2026-05-11',
      'A transmettre individuellement aux employes via Discord ou in-game.',
      'A la 1re connexion, ils seront forces de changer leur mot de passe.',
      '='.repeat(60),
      ''
    ];
    for (const c of credentials) {
      lines.push(`${c.employe}`);
      lines.push(`  Identifiant : ${c.username}`);
      lines.push(`  Mot de passe : ${c.password}`);
      lines.push('');
    }
    writeFileSync(credFile, lines.join('\n'), 'utf-8');
    console.log(`\n✓ Fichier credentials ecrit : ${credFile}`);
    console.log('  (NE PAS COMMIT — gitignore-le ou supprime apres transmission)');
  }

  if (!APPLY) console.log('\nDry-run. Relance avec --apply pour ecrire.');
  process.exit(errCount > 0 ? 1 : 0);
}

main().catch(err => { console.error('FATAL:', err); process.exit(1); });
