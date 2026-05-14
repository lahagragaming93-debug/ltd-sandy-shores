// Diagnostic : pourquoi Teodomiro ne peut plus déclarer une vente
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

// 1. Trouve Teodomiro dans /users
const usnap = await db.collection('users').get();
const teo = usnap.docs.find(d => {
  const u = d.data();
  return /teodomiro/i.test(`${u.prenom || ''} ${u.nom || ''} ${u.username || ''}`);
});

if (!teo) {
  console.log('❌ Teodomiro introuvable dans /users');
  process.exit(1);
}

const u = teo.data();
console.log('👤 Teodomiro trouvé :');
console.log(`   uid          : ${teo.id}`);
console.log(`   prenom/nom   : ${u.prenom} ${u.nom}`);
console.log(`   role         : ${u.role}`);
console.log(`   statut       : ${u.statut || 'actif'}`);
console.log(`   avertsActifs : ${u.avertsActifs ?? 0}`);
console.log(`   idDiscord    : ${u.idDiscord || '—'}`);
console.log(`   idPerso      : ${u.idPerso || '—'}`);
console.log(`   dateEntree   : ${u.dateEntree || '—'}`);

// 2. Vérifie son service ouvert
const svcSnap = await db.collection('servicesOuverts').doc(teo.id).get();
console.log(`\n🕐 Service ouvert : ${svcSnap.exists ? 'OUI (en service)' : 'NON (hors service)'}`);
if (svcSnap.exists) {
  const s = svcSnap.data();
  console.log(`   début : ${s.debut?.toDate?.()?.toLocaleString('fr-FR')}`);
}

// 3. Liste ses ventes des dernières 24h
const il_y_a_24h = new Date(Date.now() - 24 * 3600 * 1000);
const vSnap = await db.collection('ventes')
  .where('timestamp', '>=', require('firebase-admin/firestore').Timestamp.fromDate(il_y_a_24h))
  .orderBy('timestamp', 'desc')
  .get();
const sesVentes = vSnap.docs.filter(d => d.data().vendeurId === teo.id);
console.log(`\n📋 Ses ventes des dernières 24h : ${sesVentes.length}`);
for (const d of sesVentes) {
  const v = d.data();
  console.log(`   ${d.id.padEnd(25)}  ${v.timestamp?.toDate?.()?.toLocaleString('fr-FR')}  ${String(v.montant).padStart(6)}$  source=${v.source}  cachee=${!!v.cachee}  modifiePar=${v.modifiePar || '—'}`);
}

// 4. Avertissements actifs
const avSnap = await db.collection('avertissements')
  .where('employeId', '==', teo.id)
  .where('actif', '==', true)
  .get();
console.log(`\n⚠ Avertissements actifs : ${avSnap.size}`);
for (const a of avSnap.docs) {
  const ad = a.data();
  console.log(`   ${a.id}  ${ad.timestamp?.toDate?.()?.toLocaleString('fr-FR') || '?'}  motif="${ad.motif || ad.raison || '?'}"  par ${ad.parNom || ad.parUid || '?'}`);
}

// 5. Si avertsActifs >= 3, c'est bloqué
const avBlock = (u.avertsActifs || 0) >= 3;
console.log(`\n🚫 Compte bloqué par avertissements ? ${avBlock ? 'OUI (avertsActifs >= 3)' : 'NON'}`);

// 6. Si statut != actif, bloqué
const statutBlock = (u.statut || 'actif') !== 'actif';
console.log(`🚫 Compte bloqué par statut ? ${statutBlock ? `OUI (statut=${u.statut})` : 'NON'}`);

// 7. Diagnostic final
console.log('\n=== DIAGNOSTIC ===');
if (statutBlock) console.log('🔴 BLOQUÉ : statut non actif → declarerVente refusé (Cloud Function ligne 1853)');
else if (avBlock) console.log('🔴 BLOQUÉ : avertsActifs >= 3 → declarerVente refusé (Cloud Function ligne 1858)');
else console.log('🟢 Compte non bloqué côté Cloud Function');
console.log('');

process.exit(0);
