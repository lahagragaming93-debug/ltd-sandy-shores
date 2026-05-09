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

const BOT_TOKEN     = defineSecret('LTD_BOT_INGEST_TOKEN');
const COMPTA_TOKEN  = defineSecret('LTD_COMPTA_EXPORT_TOKEN');

// ----------------------------------------------------------------
// 1. Clôture hebdomadaire — Lundi 00h00 Paris
// ----------------------------------------------------------------
// Cron déplacé du dim 00:00 au lundi 00:00 pour clôturer une semaine
// RP COMPLÈTE (lundi 00:00 → dimanche 23:59:59) et non tronquée.
export const clotureHebdo = onSchedule({
  schedule: '0 0 * * 1',
  timeZone: 'Europe/Paris',
  region:   'europe-west1'
}, async () => {
  console.log('=== Début clôture hebdomadaire ===');
  const now = new Date();

  // À lundi 00:00, la semaine qui vient de finir = lundi précédent → dimanche 23:59:59
  const fin = new Date(now.getTime() - 1); // lundi 00:00 - 1ms = dim 23:59:59.999
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

  // Aucune purge : TTE exige MINIMUM 6 semaines, on garde tout l'historique.
  // Le dashboard limite l'affichage à 6 mais la base conserve tout pour audit.
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

  // Notification Discord (best effort, n'arrête pas le flow si échec)
  notifierDiscord(type, message, gravite).catch(e =>
    console.error('Discord webhook error:', e.message));
}

// Envoie l'alerte sur le webhook Discord configuré dans /config/global.discordWebhookAlertes
async function notifierDiscord(type, message, gravite) {
  const cfg = await db.collection('config').doc('global').get();
  const url = cfg.exists ? cfg.data().discordWebhookAlertes : null;
  if (!url) return;
  const color = gravite === 'danger' ? 0xa02020 : (gravite === 'warn' ? 0xc97f1a : 0x4a6b8a);
  const emoji = gravite === 'danger' ? '🔴' : (gravite === 'warn' ? '⚠️' : 'ℹ️');
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{
        title: `${emoji} LTD Sandy Shores — ${type}`,
        description: message,
        color,
        timestamp: new Date().toISOString(),
        footer: { text: 'Plateforme LTD' }
      }]
    })
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
  // Résolution automatique de l'uid Firebase du vendeur via son ID Discord
  let vendeurId = p.vendeurId || null;
  if (!vendeurId && p.vendeurDiscord) {
    const usnap = await db.collection('users').where('idDiscord', '==', p.vendeurDiscord).limit(1).get();
    if (!usnap.empty) vendeurId = usnap.docs[0].id;
  }
  await db.collection('ventes').add({
    factureId: p.factureId,
    vendeurDiscord: p.vendeurDiscord || '',
    vendeurNom: p.vendeurNom || '',
    vendeurId,
    client: p.clientNom || '',
    montant: Number(p.montant) || 0,
    benefice: p.benefice ?? null,
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
  // Résolution automatique de l'uid Firebase via idPerso ou idDiscord
  const resolveUid = async (idPerso, idDiscord) => {
    if (idPerso) {
      const s = await db.collection('users').where('idPerso', '==', idPerso).limit(1).get();
      if (!s.empty) return s.docs[0].id;
    }
    if (idDiscord) {
      const s = await db.collection('users').where('idDiscord', '==', idDiscord).limit(1).get();
      if (!s.empty) return s.docs[0].id;
    }
    return null;
  };
  const beneficiaireId = p.beneficiaireId || await resolveUid(p.beneficiaireIdPerso, p.beneficiaireDiscord);
  const payeurId       = p.payeurId       || await resolveUid(p.payeurIdPerso,       p.payeurDiscord);

  await db.collection('paies').add({
    payeurDiscord: p.payeurDiscord,
    payeurNom: p.payeurNom,
    payeurIdPerso: p.payeurIdPerso,
    payeurId,
    beneficiaireDiscord: p.beneficiaireDiscord,
    beneficiaireNom: p.beneficiaireNom,
    beneficiaireIdPerso: p.beneficiaireIdPerso,
    beneficiaireId,
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
// Atomique via FieldValue.increment() — résiste aux events parallèles.
async function majQuotaPompiste(idPerso, item, qte) {
  const usnap = await db.collection('users').where('idPerso', '==', idPerso).limit(1).get();
  if (usnap.empty) return;
  const employeId = usnap.docs[0].id;

  const wId = currentWeekId();
  const docId = `${wId}_${employeId}`;
  const ref = db.collection('quotasPompiste').doc(docId);
  const champ = slug(item) === 'bidon-essence' ? 'bidons' : 'caoutchoucs';

  await ref.set({
    semaine: wId,
    employeId,
    [champ]: FieldValue.increment(qte)
  }, { merge: true });
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

// ----------------------------------------------------------------
// 4. Export comptabilité CSV pour Google Sheets (IMPORTDATA)
// ----------------------------------------------------------------
// Endpoint HTTP public, protégé par token query param (?token=xxx).
// Retourne du CSV utilisable directement par =IMPORTDATA(URL) dans Sheets.
// 4 types : ?type=resume | depenses | ventes | paies
// ----------------------------------------------------------------

export const comptaExport = onRequest({
  region: 'europe-west1',
  cors: true,                  // Sheets fait des requêtes cross-origin
  invoker: 'public',           // accès public, sécurité par token
  secrets: [COMPTA_TOKEN]
}, async (req, res) => {
  // Auth via query param
  const token = req.query.token;
  if (!token || token !== COMPTA_TOKEN.value()) {
    return res.status(401).type('text/plain').send('Unauthorized');
  }

  const type = (req.query.type || 'resume').toString();

  // Headers utiles pour Sheets
  res.set('Cache-Control', 'no-cache, max-age=0');
  res.type('text/csv; charset=utf-8');

  try {
    // Précharge le map idDiscord -> nom (utilisé pour résoudre les <@xxx>)
    // Sauf pour "resume" qui n'en a pas besoin (perf).
    const usersByDiscord = (type === 'resume') ? {} : await loadUsersByDiscordMap();

    let csv;
    switch (type) {
      case 'resume':   csv = await csvResume();   break;
      case 'depenses': csv = await csvDepenses(usersByDiscord); break;
      case 'ventes':   csv = await csvVentes(usersByDiscord);   break;
      case 'paies':    csv = await csvPaies(usersByDiscord);    break;
      default:
        return res.status(400).type('text/plain').send(
          'Type inconnu. Utilise ?type=resume | depenses | ventes | paies');
    }
    // BOM UTF-8 pour qu'Excel/Sheets gèrent les accents
    res.send('﻿' + csv);
  } catch (err) {
    console.error('comptaExport error', type, err);
    res.status(500).type('text/plain').send('Erreur : ' + err.message);
  }
});

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}
function csvRow(...cells) {
  return cells.map(csvEscape).join(',');
}
// Format français avec 'h' minuscule pour l'heure : Google Sheets ne le
// reconnaît PAS comme date, donc l'affiche en texte lisible (au lieu de
// le convertir en série numérique style 46151.29367).
function pad(n) { return String(n).padStart(2, '0'); }
function tsToDate(ts) {
  if (!ts) return null;
  const d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  return isNaN(d.getTime()) ? null : d;
}
function dateIso(ts) {
  const d = tsToDate(ts);
  if (!d) return '';
  // Format Europe/Paris (UTC+1/+2 selon DST). Approximation sans dépendance.
  // Pour un export plus précis on utiliserait Intl.DateTimeFormat avec timeZone.
  const fr = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(d);
  const get = (t) => fr.find(p => p.type === t)?.value || '00';
  return `${get('day')}/${get('month')}/${get('year')} ${get('hour')}h${get('minute')}:${get('second')}`;
}
function dateOnly(ts) {
  const d = tsToDate(ts);
  if (!d) return '';
  const fr = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(d);
  const get = (t) => fr.find(p => p.type === t)?.value || '00';
  // Format yyyy-MM-dd reste trié alphabétiquement et est lisible
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// Résolution d'un libellé utilisateur depuis ce qui peut être :
//  - une mention Discord '<@123456789>' ou '<@undefined>'
//  - un ID Discord brut '123456789'
//  - directement un nom 'Andrew BEAUCHAMP'
// usersByDiscord : map { discordId -> 'Prénom NOM' }
function resolveUserLabel(raw, usersByDiscord) {
  if (!raw) return '';
  const s = String(raw).trim();
  // <@undefined> ou <@!undefined> : le bot n'a pas pu résoudre côté Discord
  if (/^<@!?undefined>$/i.test(s)) return '— (non résolu)';
  // <@123> ou <@!123> : extraire l'ID et chercher dans users
  const m = s.match(/^<@!?(\d+)>$/);
  if (m) {
    const did = m[1];
    return usersByDiscord[did] || `Discord #${did}`;
  }
  // ID Discord brut (15-21 chiffres)
  if (/^\d{15,21}$/.test(s)) {
    return usersByDiscord[s] || `Discord #${s}`;
  }
  // Sinon : nom déjà en clair
  return s;
}

async function loadUsersByDiscordMap() {
  const snap = await db.collection('users').limit(500).get();
  const map = {};
  for (const d of snap.docs) {
    const u = d.data();
    if (u.idDiscord) {
      const label = `${u.prenom || ''} ${u.nom || ''}`.trim() || u.email || d.id;
      map[String(u.idDiscord)] = label;
    }
  }
  return map;
}

// Primes TTE — calculées à partir du CA et du bénéfice net (mêmes tranches que paie.js)
function primeHebdoFromCa(ca) {
  if (ca >= 600000) return 15000;
  if (ca >= 400000) return 10000;
  if (ca >= 200000) return 5000;
  return 0;
}
function primeMensuelleFromBenefice(b) {
  if (b >= 2000000) return 60000;
  if (b >= 1000000) return 40000;
  if (b >=  500000) return 20000;
  return 0;
}

async function csvResume() {
  const snap = await db.collection('semaines').orderBy('numero', 'desc').limit(52).get();
  const lines = [csvRow(
    'Semaine', 'Date début', 'Date fin',
    'CA', 'Bénéfice brut', 'Dépenses totales', 'Charges déductibles',
    'Masse salariale', 'Prime hebdo (Art. 4-1.10)', 'Prime mensuelle (Art. 4-1.11)',
    'Bénéfice net', 'Nb ventes', 'Nb dépenses', 'Statut'
  )];
  for (const d of snap.docs) {
    const s = d.data();
    const ca = s.ca || 0;
    const beneficeNet = s.benefice || 0;
    lines.push(csvRow(
      s.numero,
      dateOnly(s.dateDebut),
      dateOnly(s.dateFin),
      ca,
      s.beneficeBrut || 0,
      s.depenses || 0,
      s.chargesDeductibles || 0,
      s.masseSalariale || 0,
      primeHebdoFromCa(ca),
      primeMensuelleFromBenefice(beneficeNet),
      beneficeNet,
      s.nbVentes || 0,
      s.nbDepenses || 0,
      s.statut || ''
    ));
  }
  return lines.join('\n');
}

async function csvDepenses(usersByDiscord) {
  const snap = await db.collection('depenses').orderBy('timestamp', 'desc').limit(2000).get();
  const lines = [csvRow('Date', 'Raison', 'Montant', 'Type', 'Déductible', 'Utilisateur')];
  for (const d of snap.docs) {
    const x = d.data();
    lines.push(csvRow(
      dateIso(x.timestamp),
      x.raison || '',
      x.montant || 0,
      x.type || '',
      x.deductible !== false ? 'oui' : 'non',
      resolveUserLabel(x.utilisateur, usersByDiscord)
    ));
  }
  return lines.join('\n');
}

async function csvVentes(usersByDiscord) {
  const snap = await db.collection('ventes').orderBy('timestamp', 'desc').limit(2000).get();
  const lines = [csvRow('Date', 'N° Facture', 'Vendeur', 'Client', 'Montant', 'Bénéfice', 'Paiement', 'Raison')];
  for (const d of snap.docs) {
    const v = d.data();
    // Pour les ventes, on a souvent vendeurNom directement ; sinon fallback résolution
    const vendeur = v.vendeurNom || resolveUserLabel(v.vendeurDiscord, usersByDiscord);
    lines.push(csvRow(
      dateIso(v.timestamp),
      v.factureId || '',
      vendeur,
      v.clientNom || '',
      v.montant || 0,
      v.benefice || 0,
      v.paiement || '',
      v.raison || ''
    ));
  }
  return lines.join('\n');
}

async function csvPaies(usersByDiscord) {
  const snap = await db.collection('paies').orderBy('timestamp', 'desc').limit(2000).get();
  const lines = [csvRow('Date', 'Payeur', 'Bénéficiaire', 'Montant', 'Période')];
  for (const d of snap.docs) {
    const p = d.data();
    const payeur       = p.payeurNom       || resolveUserLabel(p.payeurDiscord,       usersByDiscord);
    const beneficiaire = p.beneficiaireNom || resolveUserLabel(p.beneficiaireDiscord, usersByDiscord);
    lines.push(csvRow(
      dateIso(p.timestamp),
      payeur,
      beneficiaire,
      p.montant || 0,
      p.periode || ''
    ));
  }
  return lines.join('\n');
}
