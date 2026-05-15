// Reproduit exactement le calcul des 4 KPI de la page Banque LTD
// pour savoir exactement quelle période est couverte.
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
initializeApp({ credential: cert(resolve(__dirname, '../../serviceAccountKey.json')) });
const db = getFirestore();

const banqueSnap = await db.collection('banqueLtd').orderBy('timestamp', 'desc').limit(500).get();
const depSnap    = await db.collection('depenses').orderBy('timestamp', 'desc').limit(500).get();

const banqueOps = banqueSnap.docs.map(d => {
  const x = d.data();
  return {
    timestamp: x.timestamp,
    type: x.type === 'remove' ? 'remove' : 'add',
    montant: Number(x.montant) || 0,
    raison: x.raison || '',
    source: 'xbankaccount'
  };
});
const depOps = depSnap.docs.map(d => {
  const x = d.data();
  return {
    timestamp: x.timestamp,
    type: 'remove',
    montant: Number(x.montant) || 0,
    raison: x.raison || '',
    source: 'depense'
  };
});

const all = [...banqueOps, ...depOps].sort((a, b) => {
  const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
  const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
  return tb - ta;
});

const adds    = all.filter(m => m.type === 'add');
const removes = all.filter(m => m.type === 'remove');
const totalEntrees = adds.reduce((s, m) => s + m.montant, 0);
const totalSorties = removes.reduce((s, m) => s + m.montant, 0);

const plusVieux  = all[all.length - 1]?.timestamp?.toDate?.().toLocaleString('fr-FR') || '?';
const plusRecent = all[0]?.timestamp?.toDate?.().toLocaleString('fr-FR') || '?';

console.log(`Période chargée : du ${plusVieux} au ${plusRecent}`);
console.log(`Limite par source : 500 docs banqueLtd + 500 docs depenses (= 1000 max combinés)\n`);

console.log(`🟢 Total entrées : ${totalEntrees.toLocaleString('fr-FR')} $ sur ${adds.length} mouvements`);
console.log(`   Source 100 % : banqueLtd type=add (xbankaccount addmoney)\n`);

console.log(`🔴 Total sorties : ${totalSorties.toLocaleString('fr-FR')} $ sur ${removes.length} mouvements`);
const removesBanque = removes.filter(m => m.source === 'xbankaccount').length;
const removesDep    = removes.filter(m => m.source === 'depense').length;
console.log(`   Sources mixtes : ${removesBanque} banqueLtd (xbankaccount removemoney) + ${removesDep} depenses (#depenses Discord)\n`);

console.log(`📊 Net : ${(totalEntrees - totalSorties).toLocaleString('fr-FR')} $ (entrées − sorties sur la période chargée)`);

// Limites Firestore : a-t-on saturé l'une des 2 limites ?
console.log(`\n⚠ Vérif saturation limites :`);
console.log(`   banqueLtd : ${banqueSnap.size} docs ${banqueSnap.size === 500 ? '(LIMITE ATTEINTE — il existe plus de 500 docs)' : '(toute la collection)'}`);
console.log(`   depenses  : ${depSnap.size} docs ${depSnap.size === 500 ? '(LIMITE ATTEINTE — il existe plus de 500 docs)' : '(toute la collection)'}`);

process.exit(0);
