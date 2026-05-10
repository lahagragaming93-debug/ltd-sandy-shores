// ============================================================
// Compare les employes presents dans Discord (catego LIAISONS EMPLOYER)
// avec la collection /users Firestore.
// ============================================================
// Usage :
//   cd firebase/functions
//   node scripts/compare-employes.js
//
// Necessite firebase/serviceAccountKey.json
// ============================================================

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH  = resolve(__dirname, '../../serviceAccountKey.json');

// Snapshot Discord du 2026-05-10 — categorie #══ LIAISONS EMPLOYER ══
// Noms tels qu'apparaissant dans le nom de salon (slug) + role deduit de l'emoji.
const DISCORD_EMPLOYES = [
  { slug: 'williams-charlie',    nomAffiche: 'Charlie Williams',    role: 'pompiste',  channelId: '1480336098776453291', emoji: '⛽' },
  { slug: 'jackerton-maverick',  nomAffiche: 'Maverick Jackerton',  role: 'epicier',   channelId: '1488593306911903885', emoji: '🛒' },
  { slug: 'tac-tony',            nomAffiche: 'Tony Tac',            role: 'epicier',   channelId: '1488580926052237412', emoji: '🛒' },
  { slug: 'davis-logan',         nomAffiche: 'Logan Davis',         role: 'epicier',   channelId: '1486143802681852014', emoji: '🛒' },
  { slug: 'mars-liam',           nomAffiche: 'Liam Mars',           role: 'pompiste',  channelId: '1442247855300415618', emoji: '⛽' },
  { slug: 'broas-nesquik',       nomAffiche: 'Nesquik Broas',       role: '?',         channelId: '1501859268624908298', emoji: '📝' },
  { slug: 'wallace-travis',      nomAffiche: 'Travis Wallace',      role: 'epicier',   channelId: '1486124834865020999', emoji: '🛒' },
  { slug: 'williams-hailey',     nomAffiche: 'Hailey Williams',     role: 'epicier',   channelId: '1479624244856885292', emoji: '🛒' }
];

// Slug d'un nom complet pour la comparaison (insensible a l'ordre nom/prenom).
function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .sort()
    .join('-');
}

async function main() {
  let sa;
  try { sa = JSON.parse(readFileSync(KEY_PATH, 'utf-8')); }
  catch (err) {
    console.error(`\nImpossible de lire ${KEY_PATH}. Telecharge la cle service-account.\nErreur: ${err.message}`);
    process.exit(1);
  }
  initializeApp({ credential: cert(sa), projectId: sa.project_id });
  const db = getFirestore();

  console.log('Lecture /users ...');
  const snap = await db.collection('users').get();
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  console.log(`${users.length} users en base.\n`);

  // Index Discord par slug normalise (ex. "charlie-williams" == "williams-charlie")
  const idxDiscord = new Map();
  for (const e of DISCORD_EMPLOYES) {
    idxDiscord.set(slugify(e.nomAffiche), e);
  }

  // Index Firestore par slug normalise du nom
  const idxFirestore = new Map();
  for (const u of users) {
    const nomComplet = u.nomComplet || u.nom || u.prenomNom ||
      [u.prenom, u.nom].filter(Boolean).join(' ') || u.id;
    idxFirestore.set(slugify(nomComplet), { ...u, _nomAffiche: nomComplet });
  }

  // 1) Discord MAIS PAS dans Firestore -> a creer cote site
  const aCreer = [];
  for (const [slug, disc] of idxDiscord) {
    if (!idxFirestore.has(slug)) aCreer.push(disc);
  }

  // 2) Firestore MAIS PAS dans Discord -> a verifier (peut-etre exclu en jeu, ou patron, ou setup helper)
  const aVerifier = [];
  for (const [slug, user] of idxFirestore) {
    if (!idxDiscord.has(slug)) aVerifier.push(user);
  }

  // 3) Presents des 2 cotes -> on verifie le role
  const desync = [];
  for (const [slug, disc] of idxDiscord) {
    const fs = idxFirestore.get(slug);
    if (!fs) continue;
    const roleSite = fs.role || fs.roleId || '(non defini)';
    if (!roleEquivalent(roleSite, disc.role)) {
      desync.push({ slug, disc, fs, roleSite });
    }
  }

  console.log('='.repeat(70));
  console.log(`A creer cote /users (${aCreer.length}) :`);
  for (const e of aCreer) {
    console.log(`  + ${e.nomAffiche.padEnd(28)} role=${e.role}  ${e.emoji} (channel ${e.channelId})`);
  }

  console.log(`\nPresents en base SANS salon Discord (${aVerifier.length}) :`);
  for (const u of aVerifier) {
    console.log(`  ? ${u._nomAffiche.padEnd(28)} role=${u.role || '(none)'}  uid=${u.id}`);
  }

  console.log(`\nDesync de role (${desync.length}) :`);
  for (const d of desync) {
    console.log(`  ! ${d.disc.nomAffiche.padEnd(28)} discord=${d.disc.role.padEnd(10)} site=${d.roleSite}`);
  }

  console.log('\n' + '='.repeat(70));
  console.log(`Resume : ${DISCORD_EMPLOYES.length} discord, ${users.length} site, ${aCreer.length} a creer, ${aVerifier.length} hors discord, ${desync.length} desync.`);
  process.exit(0);
}

function roleEquivalent(roleSite, roleDiscord) {
  if (!roleSite || !roleDiscord || roleDiscord === '?') return true; // pas evaluable
  const a = String(roleSite).toLowerCase();
  const b = String(roleDiscord).toLowerCase();
  if (a === b) return true;
  // Equivalences connues
  const eq = {
    epicier:  ['vendeur', 'epicerie', 'employe-epicerie'],
    pompiste: ['pompiste', 'employe-essence', 'station']
  };
  for (const [k, alts] of Object.entries(eq)) {
    if (b === k && (a === k || alts.includes(a))) return true;
  }
  return false;
}

main().catch(err => { console.error(err); process.exit(1); });
