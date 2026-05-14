// MAJ produits : ajoute aliases IG pour matching automatique côté onFacture
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');
initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

// Aliases : noms tels qu'écrits par la direction dans les factures IG.
// Le lookup côté onFacture / backfill vérifie l'array `aliases` du produit.
const MAJ = [
  {
    id: 'bouteille-eau-purifiee',
    aliases: ['eau purifier', 'eau purifiee', 'eau purifiée', 'eau pur', 'EAU PURIFIER'],
    // Eau purifiée destinée à la revente PROFESSIONNELLE (autres entreprises).
    // Achat 0.5$, vente 1.25$ → bénéfice 0.75$/unité (confirmé patron).
    pourPro: true,
    prixAchat: 0.5,
    prixVente: 1.25
  },
  {
    id: 'bouteille-eau',
    // Bouteille d'eau classique : destinée à la revente PARTICULIER (clients comptoir).
    // Catégorie "boisson", commissionnable pour vendeurs novice/inter/exp.
    pourPro: false
    // prixAchat/Vente inchangés (5 / 10.5 actuellement)
  },
  {
    id: 'lumiere-violette',
    aliases: ['lampe', 'lampe violette', 'lumiere violette', 'lumière'],
    // Bénéfice x2 sur achat (= prixVente = 3 × prixAchat selon dire patron).
    // Valeurs temporaires à confirmer ultérieurement.
    notePrix: 'TEMP — bénéfice x2 sur achat selon patron. Vrai prix achat à confirmer.'
  }
];

for (const m of MAJ) {
  const ref = db.collection('produits').doc(m.id);
  const snap = await ref.get();
  if (!snap.exists) {
    console.log(`❌ ${m.id} introuvable`);
    continue;
  }
  const update = {};
  if (m.aliases) update.aliases = m.aliases;
  if (m.prixAchat != null) update.prixAchat = m.prixAchat;
  if (m.prixVente != null) update.prixVente = m.prixVente;
  if (m.pourPro != null) update.pourPro = m.pourPro;
  if (m.notePrix) update.notePrix = m.notePrix;
  await ref.set(update, { merge: true });
  const aliasesStr = m.aliases ? `aliases=[${m.aliases.join(', ')}] ` : '';
  const pourProStr = m.pourPro != null ? `pourPro=${m.pourPro} ` : '';
  const prixStr = m.prixAchat != null ? `achat=${m.prixAchat}$ vente=${m.prixVente}$` : '';
  console.log(`✓ ${m.id} : ${aliasesStr}${pourProStr}${prixStr}`);
}

process.exit(0);
