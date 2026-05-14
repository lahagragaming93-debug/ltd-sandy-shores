// Diagnostic : trouve le produit fertilisant et vérifie son ID technique FiveM
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

const snap = await db.collection('produits').get();

const matches = snap.docs.filter(d => {
  const p = d.data();
  const txt = `${d.id} ${p.nom || ''} ${p.nomFivem || ''}`.toLowerCase();
  return txt.includes('fertilis') || txt.includes('engrais') || txt.includes('fertilizer');
});

if (matches.length === 0) {
  console.log('Aucun produit "fertilisant" trouvé.');
  console.log('\nPour t\'aider, voici les 10 derniers produits créés :');
  const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  // Pas de champ dateCreation toujours, on prend juste les 10 derniers ajoutés
  // par ordre alphabétique (faute de mieux)
  all.sort((a, b) => (a.id || '').localeCompare(b.id || ''));
  for (const p of all.slice(-10)) {
    console.log(`  ${p.id.padEnd(35)} | nomFivem="${p.nomFivem || '—'}" | nom="${p.nom || '—'}"`);
  }
  process.exit(0);
}

console.log(`${matches.length} produit(s) trouvé(s) :\n`);
for (const d of matches) {
  const p = d.data();
  console.log(`📦 ID Firestore : ${d.id}`);
  console.log(`   nom               : ${p.nom || '—'}`);
  console.log(`   nomFivem          : ${p.nomFivem || '⚠ MANQUANT'}`);
  console.log(`   categorie         : ${p.categorie || '—'}`);
  console.log(`   prixAchat         : ${p.prixAchat ?? '—'} $`);
  console.log(`   prixVente         : ${p.prixVente ?? '—'} $`);
  console.log(`   pourPro           : ${p.pourPro ?? '—'}`);
  console.log(`   matierePremiere   : ${p.matierePremiere ?? '—'}`);
  console.log(`   tout :`, JSON.stringify(p, null, 2));
  console.log('');
}

process.exit(0);
