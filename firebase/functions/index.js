// ============================================================
// Cloud Functions — LTD Sandy Shores
// ============================================================
// Tâches :
//  - Clôture automatique chaque dimanche à 00 h 00 (heure Paris)
//  - Génération d'alertes (stocks, masse salariale)
//  - Helper HTTP pour le bot Discord (validation token + ingestion)
// ============================================================

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onRequest }  from 'firebase-functions/v2/https';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';

initializeApp();
const db = getFirestore();

const BOT_TOKEN = defineSecret('LTD_BOT_INGEST_TOKEN');

// ----------------------------------------------------------------
// 1. Clôture hebdomadaire — Dimanche 00h00 Paris
// ----------------------------------------------------------------
export const clotureHebdo = onSchedule({
  schedule: '0 0 * * 0',
  timeZone: 'Europe/Paris',
  region:   'europe-west1'
}, async () => {
  console.log('=== Début clôture hebdomadaire ===');
  const now = new Date();

  // La semaine qui se termine = lundi précédent → dimanche 23:59:59 (de la veille)
  const fin = new Date(now);
  fin.setSeconds(fin.getSeconds() - 1); // dim 23:59:59
  fin.setHours(23, 59, 59, 999);
  fin.setDate(fin.getDate() - 1);
  const debut = new Date(fin);
  debut.setDate(debut.getDate() - 6);
  debut.setHours(0, 0, 0, 0);

  const weekKey = debut.toISOString().slice(0, 10);

  // Agréger
  const [ventesSnap, depensesSnap, paiesSnap] = await Promise.all([
    db.collection('ventes')
      .where('timestamp', '>=', Timestamp.fromDate(debut))
      .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
    db.collection('depenses')
      .where('timestamp', '>=', Timestamp.fromDate(debut))
      .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
    db.collection('paies')
      .where('timestamp', '>=', Timestamp.fromDate(debut))
      .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
  ]);

  const ca       = ventesSnap.docs.reduce((s, d) => s + (d.data().montant || 0), 0);
  const benefice = ventesSnap.docs.reduce((s, d) => s + (d.data().benefice || 0), 0);
  const depTotal = depensesSnap.docs.reduce((s, d) => s + (d.data().montant || 0), 0);
  const dedu     = depensesSnap.docs
    .filter(d => d.data().deductible !== false)
    .reduce((s, d) => s + (d.data().montant || 0), 0);
  const masse    = paiesSnap.docs.reduce((s, d) => s + (d.data().montant || 0), 0);
  const beneficeNet = ca - depTotal - masse;

  await db.collection('semaines').doc(weekKey).set({
    numero: weekKey,
    dateDebut: Timestamp.fromDate(debut),
    dateFin:   Timestamp.fromDate(fin),
    ca, beneficeBrut: benefice,
    depenses: depTotal,
    chargesDeductibles: dedu,
    masseSalariale: masse,
    benefice: beneficeNet,
    nbVentes: ventesSnap.size,
    nbDepenses: depensesSnap.size,
    statut: 'cloturee',
    dateCloture: FieldValue.serverTimestamp()
  });

  // Purge des semaines > 6 (TTE Art. 4-1.1 — conservation min. 6 sem.)
  const allSnap = await db.collection('semaines').orderBy('dateDebut', 'desc').get();
  const aSupprimer = allSnap.docs.slice(6);
  for (const d of aSupprimer) await d.ref.delete();

  console.log('Clôture OK', weekKey, { ca, masse, beneficeNet });
});

// ----------------------------------------------------------------
// 2. Génération d'alertes au fil de l'eau
// ----------------------------------------------------------------

// Stock bas / rupture
export const alerteStock = onDocumentWritten({
  document: 'stocks/{id}',
  region: 'europe-west1'
}, async (event) => {
  const after = event.data?.after?.data();
  if (!after) return;
  const seuil = after.seuilAlerte ?? 0;
  const qte = after.quantite || 0;
  if (qte === 0) {
    await creerAlerte('stock-rupture', `Rupture : ${after.nom || event.params.id}`, 'danger', { stockId: event.params.id });
  } else if (qte <= seuil && seuil > 0) {
    await creerAlerte('stock-bas', `Stock bas : ${after.nom || event.params.id} (${qte}/${seuil})`, 'warn', { stockId: event.params.id });
  }
});

// Stations < seuil
export const alerteStation = onDocumentWritten({
  document: 'stations/{id}',
  region: 'europe-west1'
}, async (event) => {
  const after = event.data?.after?.data();
  if (!after) return;
  const seuil = after.seuilAlerte || 0;
  if ((after.stockActuel || 0) < seuil && seuil > 0) {
    await creerAlerte('station-bas',
      `Station ${after.nom} sous ${seuil} L (actuel: ${after.stockActuel} L)`,
      'warn', { stationId: event.params.id });
  }
});

// Vente sans sortie de stock corrélée
export const alerteVenteSansStock = onDocumentCreated({
  document: 'ventes/{id}',
  region: 'europe-west1'
}, async (event) => {
  const v = event.data?.data();
  if (!v) return;
  if (v.stockVerifie === false) {
    await creerAlerte('vente-sans-stock',
      `Vente #${v.factureId} (${v.montant} $) sans sortie de stock corrélée.`,
      'warn', { venteId: event.params.id });
  }
});

async function creerAlerte(type, message, gravite = 'warn', metadata = {}) {
  // Anti-doublons : pas de nouvelle alerte si une identique non résolue existe.
  const dejaSnap = await db.collection('alertes')
    .where('type', '==', type)
    .where('resolue', '==', false)
    .limit(20).get();
  const existe = dejaSnap.docs.find(d => d.data().message === message);
  if (existe) return;

  await db.collection('alertes').add({
    type, message, gravite, metadata,
    resolue: false,
    timestamp: FieldValue.serverTimestamp()
  });
}

// ----------------------------------------------------------------
// 3. Endpoint HTTP pour le bot Discord — ingestion sécurisée
// ----------------------------------------------------------------
// Le bot envoie des évènements parsés ; cette fonction valide le
// token puis route vers le bon parser/écriture Firestore.
// ----------------------------------------------------------------

export const botIngest = onRequest({
  region: 'europe-west1',
  cors: false,
  invoker: 'public',          // webhook : invocation libre, sécurité par token x-bot-token
  secrets: [BOT_TOKEN]
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  const token = req.get('x-bot-token');
  if (!token || token !== BOT_TOKEN.value()) return res.status(401).send('Unauthorized');

  const { type, payload } = req.body || {};
  if (!type || !payload) return res.status(400).send('Missing type/payload');

  try {
    switch (type) {
      case 'inventory':       await onInventory(payload); break;
      case 'service':         await onService(payload); break;
      case 'facture':         await onFacture(payload); break;
      case 'redistribution':  await onRedistribution(payload); break;
      case 'depense':         await onDepense(payload); break;
      case 'paie':            await onPaie(payload); break;
      case 'coffre':          await onCoffre(payload); break;
      case 'logBrut':         await onLogBrut(payload); break;
      default:                return res.status(400).send('Unknown type');
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('botIngest error', err);
    res.status(500).send(err.message || 'Internal error');
  }
});

// === Handlers ===

async function onInventory({ type, item, count, source, owner, characterId, properName, name }) {
  // Mise à jour du stock
  if (item) {
    const ref = db.collection('stocks').doc(slug(item));
    const snap = await ref.get();
    const cur = snap.exists ? (snap.data().quantite || 0) : 0;
    const delta = type === 'inventory-add' ? count : -count;
    await ref.set({
      quantite: cur + delta,
      nom: item,
      derniereMaj: FieldValue.serverTimestamp(),
      par: properName || name || 'bot'
    }, { merge: true });
  }

  await db.collection('mouvementsStock').add({
    type, item: slug(item || ''), itemNom: item,
    quantite: type === 'inventory-add' ? count : -count,
    par: properName || name || '',
    source: source || '',
    discord: name || '',
    characterId: characterId || '',
    owner: owner || '',
    timestamp: FieldValue.serverTimestamp()
  });

  // Comptage quota pompiste si bidon ou caoutchouc et ajout
  if (type === 'inventory-add' && characterId &&
      (slug(item) === 'bidon-essence' || slug(item) === 'caoutchouc')) {
    await majQuotaPompiste(characterId, item, count);
  }
}

async function onService({ employeId, employeIdDiscord, employeNom, action, timestamp }) {
  const t = timestamp ? new Date(timestamp) : new Date();
  if (action === 'start') {
    await db.collection('servicesOuverts').doc(employeId).set({
      employeId, employeNom, debut: Timestamp.fromDate(t)
    });
  } else if (action === 'end') {
    const ref = db.collection('servicesOuverts').doc(employeId);
    const snap = await ref.get();
    if (snap.exists) {
      const debut = snap.data().debut.toDate();
      const duree = t.getTime() - debut.getTime();
      await db.collection('services').add({
        employeId, employeNom,
        debut: Timestamp.fromDate(debut),
        fin: Timestamp.fromDate(t),
        duree
      });
      await ref.delete();
    }
  }
}

async function onFacture(p) {
  // p = { factureId, vendeurDiscord, vendeurNom, clientNom, montant, raison, paiement, items? }
  const benefice = p.benefice ?? null;
  await db.collection('ventes').add({
    factureId: p.factureId,
    vendeurDiscord: p.vendeurDiscord || '',
    vendeurNom: p.vendeurNom || '',
    vendeurId: p.vendeurId || null,    // résolu par le bot si possible
    client: p.clientNom || '',
    montant: Number(p.montant) || 0,
    benefice,
    raison: p.raison || '',
    paiement: p.paiement || '',
    items: p.items || [],
    stockVerifie: p.stockVerifie ?? null,
    timestamp: FieldValue.serverTimestamp()
  });
}

async function onRedistribution(p) {
  await db.collection('redistributions').add({
    redistributionId: p.id,
    station: p.station,
    stationId: p.stationId || slug(p.station),
    litres: p.litres,
    prixLitre: p.prixLitre,
    montant: p.montant,
    stockAvant: p.stockAvant,
    stockApres: p.stockApres,
    niveau: p.niveau,
    timestamp: FieldValue.serverTimestamp()
  });
  // Mettre à jour le stock de la station
  const sRef = db.collection('stations').doc(p.stationId || slug(p.station));
  await sRef.set({
    nom: p.station,
    stockActuel: p.stockApres,
    derniereRedistribution: FieldValue.serverTimestamp()
  }, { merge: true });
}

async function onDepense(p) {
  const deductible = !!(p.deductible ?? false);
  await db.collection('depenses').add({
    compteId: p.compteId,
    utilisateur: p.utilisateur,
    montant: Number(p.montant) || 0,
    soldeAvant: p.soldeAvant,
    soldeApres: p.soldeApres,
    raison: p.raison || '',
    type: p.type || 'autre',
    deductible,
    source: 'discord',
    timestamp: FieldValue.serverTimestamp()
  });
}

async function onPaie(p) {
  await db.collection('paies').add({
    payeurDiscord: p.payeurDiscord,
    payeurNom: p.payeurNom,
    payeurIdPerso: p.payeurIdPerso,
    beneficiaireDiscord: p.beneficiaireDiscord,
    beneficiaireNom: p.beneficiaireNom,
    beneficiaireIdPerso: p.beneficiaireIdPerso,
    beneficiaireId: p.beneficiaireId || null,
    montant: Number(p.montant) || 0,
    timestamp: FieldValue.serverTimestamp()
  });
}

async function onCoffre(p) {
  // Snapshot inventaire — on remplace
  await db.collection('coffres').doc(p.coffreId).set({
    coffreId: p.coffreId,
    itemsDistincts: p.itemsDistincts,
    items: p.items,
    miseAJour: FieldValue.serverTimestamp()
  });
}

async function onLogBrut(p) {
  // Stockage générique pour les canaux non parsés (suivi-coffre-secondaire,
  // alerte-coffre, revenu, factures, statsbank, logs-licenciement, logs-avertissement).
  await db.collection('logsBruts').add({
    canal: p.canal,
    contenu: p.contenu,
    auteur: p.auteur || '',
    timestamp: FieldValue.serverTimestamp()
  });
}

// === Quota pompiste ===
async function majQuotaPompiste(idPerso, item, qte) {
  // Trouver l'employé via idPerso
  const usnap = await db.collection('users').where('idPerso', '==', idPerso).limit(1).get();
  if (usnap.empty) return;
  const employeId = usnap.docs[0].id;

  const wId = currentWeekId();
  const docId = `${wId}_${employeId}`;
  const ref = db.collection('quotasPompiste').doc(docId);
  const snap = await ref.get();
  const cur = snap.exists ? snap.data() : {
    semaine: wId, employeId, bidons: 0, caoutchoucs: 0
  };
  const champ = slug(item) === 'bidon-essence' ? 'bidons' : 'caoutchoucs';
  cur[champ] = (cur[champ] || 0) + qte;
  await ref.set(cur, { merge: true });
}

// === Helpers ===
function slug(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
function currentWeekId() {
  const d = new Date();
  d.setHours(0,0,0,0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
