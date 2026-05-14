// ============================================================
// Inspecte un cas "vente annulee apres declaration"
// ============================================================
// Pour les alertes /alertes type='vente-annulee-apres-declaration',
// reconstitue le dossier complet :
//   - La facture bot d'origine (/ventes/fac-{billId})
//   - La declaration manuelle qui l'a remplacee (avec lignes / items)
//   - Le contexte d'annulation (qui, quand, motif)
//   - Le service ouvert du vendeur au moment de la vente
// Usage :
//   cd firebase/functions
//   node scripts/inspect-fraude-annulation.js <billId>
//   node scripts/inspect-fraude-annulation.js --all   (toutes les alertes non resolues)
// ============================================================

import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const KEY_PATH = resolve(__dirname, '../../serviceAccountKey.json');

initializeApp({ credential: cert(KEY_PATH) });
const db = getFirestore();

function fmtTs(ts) {
  const d = ts?.toDate?.() || (ts ? new Date(ts) : null);
  return d ? d.toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' }) : '—';
}

function fmtMoney(n) {
  return Number(n || 0).toLocaleString('fr-FR') + ' $';
}

async function inspect(billId) {
  console.log('═'.repeat(72));
  console.log(`DOSSIER FACTURE #${billId}`);
  console.log('═'.repeat(72));

  // 1. La facture bot d'origine
  const botRef = db.collection('ventes').doc(`fac-${billId}`);
  const botSnap = await botRef.get();
  if (!botSnap.exists) {
    console.log(`❌ Aucune facture bot fac-${billId} en base.\n`);
    return;
  }
  const bot = botSnap.data();

  console.log(`\n📡 FACTURE BOT (telle que remontee par Faab'Hook)`);
  console.log(`   Date            : ${fmtTs(bot.timestamp)}`);
  console.log(`   Vendeur         : ${bot.vendeurNom || '?'} (discord ${bot.vendeurDiscord || '?'}, uid ${bot.vendeurId || '?'})`);
  console.log(`   Client          : ${bot.client || '?'}`);
  console.log(`   Montant total   : ${fmtMoney(bot.montant)}`);
  console.log(`   Montant partic. : ${fmtMoney(bot.montantParticulier)} (base commission)`);
  console.log(`   Paiement        : ${bot.paiement || '?'}`);
  console.log(`   Raison embed    : "${bot.raison || ''}"`);
  console.log(`   En service ?    : ${bot.enServiceAuMomentDeLaVente === true ? '✓ oui' : bot.enServiceAuMomentDeLaVente === false ? '⚠ NON (hors service)' : 'inconnu'}`);
  console.log(`   Items embed     : ${(bot.items || []).length === 0 ? '(aucun)' : ''}`);
  for (const it of bot.items || []) {
    console.log(`     - ${it.quantite || '?'}× ${it.nom || it.produitId || '?'}`);
  }
  console.log(`   Source          : ${bot.source}`);
  console.log(`   Cachee/Annulee  : cachee=${!!bot.cachee} annulee=${!!bot.annulee}`);

  // 2. Annulation IG
  if (bot.annulee) {
    console.log(`\n❌ ANNULATION IG`);
    console.log(`   Motif           : ${bot.motifAnnulation || '?'}`);
    console.log(`   Annule par      : ${bot.annulateurNom || '?'} (discord ${bot.annulateurDiscord || '?'})`);
    console.log(`   Date annulation : ${fmtTs(bot.dateAnnulation)}`);
    console.log(`   Source          : ${bot.annulationSource || '?'}`);
  }

  // 3. Declaration manuelle qui l'a remplacee
  const remplaceeParId = bot.remplaceeParId;
  if (remplaceeParId) {
    console.log(`\n📝 DECLARATION MANUELLE LIEE (id ${remplaceeParId})`);
    const manSnap = await db.collection('ventes').doc(remplaceeParId).get();
    if (manSnap.exists) {
      const man = manSnap.data();
      console.log(`   FactureId manuel: #${man.factureId || '?'}`);
      console.log(`   Date declaration: ${fmtTs(man.timestamp)}`);
      console.log(`   Vendeur         : ${man.vendeurNom || '?'} (uid ${man.vendeurId || '?'})`);
      console.log(`   Client declare  : ${man.client || '?'}`);
      console.log(`   Moyen paiement  : ${man.paiement || '?'}`);
      console.log(`   Montant encaiss : ${fmtMoney(man.montantEncaisse ?? man.montant)}`);
      console.log(`   Montant partic. : ${fmtMoney(man.montantParticulier)}`);
      console.log(`   Cout total      : ${fmtMoney(man.coutTotal)}`);
      console.log(`   Benefice        : ${fmtMoney(man.benefice)}`);
      console.log(`   Items declares  :`);
      for (const l of man.lignes || []) {
        const sub = (Number(l.quantite) || 0) * (Number(l.prixUnitaire) || 0);
        console.log(`     - ${l.quantite || '?'}× ${l.produitNom || l.produitId || '?'}  @ ${fmtMoney(l.prixUnitaire)}  = ${fmtMoney(sub)}  [achat unit ${fmtMoney(l.prixAchat)}]`);
      }
      console.log(`   Verrouille      : ${man.verrouille ? 'oui' : 'non'}`);

      // Verifications de coherence
      console.log(`\n🔍 VERIFICATIONS DE COHERENCE`);
      const montantBot = Number(bot.montant || 0);
      const montantMan = Number(man.montantEncaisse ?? man.montant ?? 0);
      const ecart = montantMan - montantBot;
      if (ecart === 0) {
        console.log(`   ✓ Montant bot (${fmtMoney(montantBot)}) == Montant declare (${fmtMoney(montantMan)})`);
      } else {
        console.log(`   ⚠ ECART MONTANT : bot=${fmtMoney(montantBot)} declare=${fmtMoney(montantMan)} (ecart ${fmtMoney(ecart)})`);
      }

      // Coherence items vs raison embed
      const raisonEmbed = (bot.raison || '').toLowerCase();
      let itemsManquants = 0;
      for (const l of man.lignes || []) {
        const nom = (l.produitNom || '').toLowerCase();
        if (nom && raisonEmbed && !raisonEmbed.includes(nom.split(' ')[0])) {
          itemsManquants++;
        }
      }
      if ((bot.raison || '').trim()) {
        if (itemsManquants === 0) {
          console.log(`   ✓ Items declares semblent coherents avec la raison embed`);
        } else {
          console.log(`   ⚠ ${itemsManquants} item(s) declare(s) absent(s) du libelle embed "${bot.raison}"`);
        }
      } else {
        console.log(`   ⚠ Embed bot n'a pas de raison detaillee (juste montant) — verification visuelle impossible`);
      }

      // Delai declaration -> annulation REELLE (parse depuis motifAnnulation
      // qui contient "le HHhMM DD/MM/YYYY" — dateAnnulation peut etre la date
      // du backfill et non la vraie suppression IG)
      const tsDeclar = man.timestamp?.toDate?.();
      const motif = bot.motifAnnulation || '';
      const matchHeure = motif.match(/(\d{1,2})h(\d{2})\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/);
      if (tsDeclar && matchHeure) {
        const [_, hh, mm, dd, mo, yy] = matchHeure;
        const tsAnnulIG = new Date(`${yy}-${mo.padStart(2,'0')}-${dd.padStart(2,'0')}T${hh.padStart(2,'0')}:${mm}:00`);
        const minutes = Math.round((tsAnnulIG.getTime() - tsDeclar.getTime()) / 60000);
        console.log(`   ⏱ Delai declaration → annulation IG : ${minutes} min  (vraie heure IG : ${tsAnnulIG.toLocaleString('fr-FR')})`);
      } else if (tsDeclar && bot.dateAnnulation?.toDate) {
        const minutes = Math.round((bot.dateAnnulation.toDate().getTime() - tsDeclar.getTime()) / 60000);
        console.log(`   ⏱ Delai declaration → annulation (date du backfill, pas exacte) : ${minutes} min`);
      }
    } else {
      console.log(`   ❌ Document manuel ${remplaceeParId} introuvable`);
    }
  } else {
    console.log(`\n📝 Pas de declaration manuelle liee (vente bot non declaree avant annulation).`);
  }

  // 4. Mouvements de stock generes par la declaration
  if (remplaceeParId) {
    const movSnap = await db.collection('mouvementsStock')
      .where('source', '==', `vente:${(await db.collection('ventes').doc(remplaceeParId).get()).data()?.factureId || ''}`)
      .get();
    if (!movSnap.empty) {
      console.log(`\n📦 MOUVEMENTS STOCK generes par la declaration (${movSnap.size}) :`);
      for (const m of movSnap.docs) {
        const d = m.data();
        console.log(`     ${fmtTs(d.timestamp).padEnd(20)}  ${String(d.quantite).padStart(4)}× ${d.itemNom || d.item}`);
      }
    }
  }

  // 5. Service ouvert au moment de la vente (tolerant : skip si index manquant)
  if (bot.vendeurId) {
    try {
      const svcAvantSnap = await db.collection('services')
        .where('employeId', '==', bot.vendeurId)
        .orderBy('fin', 'desc')
        .limit(5)
        .get();
      if (!svcAvantSnap.empty) {
        console.log(`\n🕐 5 derniers services du vendeur :`);
        for (const s of svcAvantSnap.docs) {
          const d = s.data();
          const h = Math.floor((d.duree || 0) / 3600000);
          const m = Math.floor(((d.duree || 0) % 3600000) / 60000);
          console.log(`     ${fmtTs(d.debut)} → ${fmtTs(d.fin)}  (${h}h${String(m).padStart(2,'0')})`);
        }
      }
    } catch (e) {
      if (String(e.message || '').includes('index')) {
        console.log(`\n🕐 (Requete services skippee : index Firestore manquant)`);
      } else {
        console.log(`\n🕐 (Erreur requete services : ${e.message})`);
      }
    }
  }

  console.log('');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.log('Usage : node inspect-fraude-annulation.js <billId>');
    console.log('        node inspect-fraude-annulation.js --all');
    process.exit(1);
  }

  if (args[0] === '--all') {
    const snap = await db.collection('alertes')
      .where('type', '==', 'vente-annulee-apres-declaration')
      .where('resolue', '==', false)
      .get();
    console.log(`${snap.size} alerte(s) non resolue(s)\n`);
    for (const a of snap.docs) {
      const billId = a.data().metadata?.factureId;
      if (billId) await inspect(String(billId));
    }
  } else {
    for (const arg of args) {
      await inspect(String(arg));
    }
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(2); });
