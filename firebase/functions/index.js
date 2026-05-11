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
import { getAuth as getAdminAuth } from 'firebase-admin/auth';
import { defineSecret } from 'firebase-functions/params';

initializeApp();
const db = getFirestore();
const adminAuth = getAdminAuth();

const BOT_TOKEN     = defineSecret('LTD_BOT_INGEST_TOKEN');
const COMPTA_TOKEN  = defineSecret('LTD_COMPTA_EXPORT_TOKEN');

// ----------------------------------------------------------------
// 1. Clôture hebdomadaire — Lundi 00h00 Paris
// ----------------------------------------------------------------
// Cron déplacé du dim 00:00 au lundi 00:00 pour clôturer une semaine
// RP COMPLÈTE (lundi 00:00 → dimanche 23:59:59) et non tronquée.
// === Cloture etape 1 : ventes + depenses (lundi 00:00 Paris) ===
// Inclut aussi le CA carburant (/redistributions). Pas encore la masse
// salariale car les paies arrivent post-cloture (deadline mardi 21h).
// Statut = 'cloturee-partielle' jusqu'a la cloture etape 2.
export const clotureHebdo = onSchedule({
  schedule: '0 0 * * 1',
  timeZone: 'Europe/Paris',
  region:   'europe-west1'
}, async () => {
  console.log('=== Début clôture hebdomadaire (étape 1 : ventes + dépenses) ===');
  const now = new Date();

  // À lundi 00:00, la semaine qui vient de finir = lundi précédent → dimanche 23:59:59
  const fin = new Date(now.getTime() - 1); // lundi 00:00 - 1ms = dim 23:59:59.999
  const debut = new Date(fin);
  debut.setDate(debut.getDate() - 6);
  debut.setHours(0, 0, 0, 0);

  const weekKey = debut.toISOString().slice(0, 10);

  // Agréger (ventes produits + ventes carburant + dépenses)
  const [ventesSnap, redistSnap, depensesSnap] = await Promise.all([
    db.collection('ventes')
      .where('timestamp', '>=', Timestamp.fromDate(debut))
      .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
    db.collection('redistributions')
      .where('timestamp', '>=', Timestamp.fromDate(debut))
      .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
    db.collection('depenses')
      .where('timestamp', '>=', Timestamp.fromDate(debut))
      .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
  ]);

  const caProduits  = ventesSnap.docs.reduce((s, d) => s + (d.data().montant || 0), 0);
  const caCarburant = redistSnap.docs.reduce((s, d) => s + (Number(d.data().montant) || 0), 0);
  const ca          = caProduits + caCarburant;
  const benefice    = ventesSnap.docs.reduce((s, d) => s + (d.data().benefice || 0), 0);
  // Exclure les depenses type='paie' (doublon avec /paies). Sinon les paies
  // sont comptees 2 fois : depenses + masseSalariale.
  const depensesReelles = depensesSnap.docs.filter(d => d.data().type !== 'paie');
  const depTotal    = depensesReelles.reduce((s, d) => s + (d.data().montant || 0), 0);
  const dedu        = depensesReelles
    .filter(d => d.data().deductible !== false)
    .reduce((s, d) => s + (d.data().montant || 0), 0);

  await db.collection('semaines').doc(weekKey).set({
    numero: weekKey,
    dateDebut: Timestamp.fromDate(debut),
    dateFin:   Timestamp.fromDate(fin),
    ca,
    caProduits,
    caCarburant,
    beneficeBrut: benefice,
    depenses: depTotal,
    chargesDeductibles: dedu,
    masseSalariale: 0,             // pas encore connue (sera mise en cloture etape 2)
    benefice: ca - depTotal,       // provisoire (sans masse)
    nbVentes: ventesSnap.size + redistSnap.size,
    nbDepenses: depensesSnap.size,
    statut: 'cloturee-partielle',
    dateCloture: FieldValue.serverTimestamp()
  }, { merge: true });

  console.log('Cloture etape 1 OK', weekKey, { ca, caProduits, caCarburant, depTotal });
});

// === Cloture etape 2 : masse salariale + benefice net (mardi 21:05 Paris) ===
// Fenetre de paie : lundi N+1 00:00 -> mardi N+1 21:00. Au mardi 21:05, on
// recolte toutes les paies effectivement versees pour la semaine N (clos
// dimanche 23:59) et on finalise le doc /semaines.
export const clotureHebdoPaies = onSchedule({
  schedule: '5 21 * * 2',
  timeZone: 'Europe/Paris',
  region:   'europe-west1'
}, async () => {
  console.log('=== Début clôture hebdomadaire (étape 2 : paies) ===');
  const now = new Date();

  // Semaine clos il y a 2 jours (lundi 00:00 -> dimanche 23:59 il y a 2 jours)
  // À mardi 21:05, la semaine N = mardi - 2 jours = dimanche (= dim 23:59 N)
  const fin = new Date(now);
  fin.setHours(0, 0, 0, 0);
  fin.setDate(fin.getDate() - 1);   // lundi 00:00
  fin.setMilliseconds(fin.getMilliseconds() - 1); // dimanche 23:59:59.999
  const debut = new Date(fin);
  debut.setDate(debut.getDate() - 6);
  debut.setHours(0, 0, 0, 0);
  const weekKey = debut.toISOString().slice(0, 10);

  // Fenetre paie : lundi 00:00 (= maintenant - 1 jour 21:05) -> mardi 21:00 (= il y a 5 min)
  const debutFenetrePaie = new Date(fin.getTime() + 1);  // lundi N+1 00:00
  const finFenetrePaie = new Date(debutFenetrePaie);
  finFenetrePaie.setDate(finFenetrePaie.getDate() + 1);  // mardi
  finFenetrePaie.setHours(21, 0, 0, 0);                  // 21:00:00

  const paiesSnap = await db.collection('paies')
    .where('timestamp', '>=', Timestamp.fromDate(debutFenetrePaie))
    .where('timestamp', '<=', Timestamp.fromDate(finFenetrePaie)).get();

  const masse = paiesSnap.docs.reduce((s, d) => s + (d.data().montant || 0), 0);

  // Recharge le doc semaine pour recalculer le benefice net
  const semSnap = await db.collection('semaines').doc(weekKey).get();
  if (!semSnap.exists) {
    console.error('Cloture etape 2 : doc /semaines/' + weekKey + ' introuvable. Etape 1 a echoue ?');
    return;
  }
  const sem = semSnap.data();
  const beneficeNet = (sem.ca || 0) - (sem.depenses || 0) - masse;

  await db.collection('semaines').doc(weekKey).set({
    masseSalariale: masse,
    benefice: beneficeNet,
    statut: 'cloturee',
    dateClotureFinale: FieldValue.serverTimestamp(),
    fenetrePaieDebut: Timestamp.fromDate(debutFenetrePaie),
    fenetrePaieFin: Timestamp.fromDate(finFenetrePaie)
  }, { merge: true });

  console.log('Cloture etape 2 OK', weekKey, { masse, beneficeNet, nbPaies: paiesSnap.size });
});

// ----------------------------------------------------------------
// 2. Génération d'alertes au fil de l'eau
// ----------------------------------------------------------------

// Stock bas / rupture
// Le seuil et le nom sont stockés dans /produits/{id}, pas /stocks/{id}.
// /stocks contient juste la quantité (mise à jour par le bot Discord ou les
// ajustements manuels). On va donc lire le produit en parallèle.
export const alerteStock = onDocumentWritten({
  document: 'stocks/{id}',
  region: 'europe-west1'
}, async (event) => {
  const after = event.data?.after?.data();
  if (!after) return;
  const id = event.params.id;
  const qte = after.quantite ?? 0;

  // Récupère le seuil + nom depuis /produits/{id}
  const prodSnap = await db.collection('produits').doc(id).get();
  const prod = prodSnap.exists ? prodSnap.data() : {};
  const seuil = prod.seuilAlerte ?? after.seuilAlerte ?? 0;
  const nom   = prod.nom || after.nom || id;

  console.log(`[alerteStock] ${id} qte=${qte} seuil=${seuil} (produit=${prodSnap.exists})`);

  // Pas d'alerte tant qu'aucun seuil n'est configure manuellement (par le patron).
  // Couvre rupture ET stock bas — les valeurs par defaut (qte=0 sans seuil) ne
  // doivent pas spammer.
  if (seuil <= 0) return;
  if (qte === 0) {
    await creerAlerte('stock-rupture', `Rupture : ${nom}`, 'danger', { stockId: id });
  } else if (qte <= seuil) {
    await creerAlerte('stock-bas', `Stock bas : ${nom} (${qte}/${seuil})`, 'warn', { stockId: id });
  }
});

// Stations sous seuil — supporte seuil en L (seuilAlerte) ou en % (seuilAlertePct).
// Anti-spam : creerAlerte dédoublonne par stationId tant que l'alerte est non résolue.
// 2026-05-11 : aussi alerte info quand un pompiste modifie manuellement stockActuel
// (sourceMajAuto='modal-manuel-pompiste'), pour traçabilité audit hebdo direction.
export const alerteStation = onDocumentWritten({
  document: 'stations/{id}',
  region: 'europe-west1'
}, async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  if (!after) return;
  const stationId = event.params.id;
  const stockActuel = after.stockActuel || 0;
  const stockMax    = after.stockMax    || 0;
  const seuilL      = after.seuilAlerte    || 0;
  const seuilPct    = after.seuilAlertePct || 0;
  const nom = after.nom || stationId;

  // === Modification manuelle pompiste : alerte info audit ===
  // Sources pompiste :
  //   'modal-manuel-pompiste' (legacy, saisie directe stockActuel)
  //   'modal-bidons-pompiste' (depuis 2026-05-11, saisie en bidons 15L)
  // La direction utilise 'modal-manuel-direction' qui ne fire pas cette branche.
  const isPompisteEdit = before && before.stockActuel !== after.stockActuel && (
    after.sourceMajAuto === 'modal-manuel-pompiste' ||
    after.sourceMajAuto === 'modal-bidons-pompiste'
  );
  if (isPompisteEdit) {
    const auteur = after.derniereModifPar?.nom || after.derniereModifPar?.uid || 'pompiste inconnu';
    const ancien = before.stockActuel || 0;
    const delta  = stockActuel - ancien;
    const sens   = delta >= 0 ? `+${delta}` : `${delta}`;
    // Pas de dedupe (chaque modif manuelle = 1 alerte distincte avec timestamp)
    await db.collection('alertes').add({
      type: 'station-modif-manuelle',
      message: `🛢 ${auteur} a ravitaillé ${nom} : ${ancien.toLocaleString('fr-FR')} L → ${stockActuel.toLocaleString('fr-FR')} L (${sens} L)`,
      gravite: 'info',
      metadata: { stationId, ancien, nouveau: stockActuel, delta, auteur, source: after.sourceMajAuto },
      resolue: false,
      timestamp: FieldValue.serverTimestamp()
    });
  }

  // Seuil en litres absolus (ancien comportement)
  if (seuilL > 0 && stockActuel < seuilL) {
    await creerAlerte('station-bas',
      `Station ${nom} sous ${seuilL} L (actuel: ${stockActuel} L)`,
      'warn', { stationId });
    return;
  }
  // Seuil en pourcentage (nouveau, alimenté par stationsDashboard)
  if (seuilPct > 0 && stockMax > 0) {
    const pct = Math.round((stockActuel / stockMax) * 100);
    if (pct < seuilPct) {
      const gravite = pct < 5 ? 'danger' : 'warn';
      await creerAlerte('station-bas',
        `Station ${nom} à ${pct}% (seuil ${seuilPct}%) — ${stockActuel.toLocaleString('fr-FR')} / ${stockMax.toLocaleString('fr-FR')} L`,
        gravite, { stationId });
    }
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
  // Anti-doublons : si metadata identifie une entité (stationId, stockId,
  // venteId), on dédoublonne par entité tant que l'alerte est non résolue —
  // évite le spam quand stockActuel fluctue. Sinon fallback sur le message.
  const dedupKey = metadata.stationId || metadata.stockId || metadata.venteId || message;
  const dejaSnap = await db.collection('alertes')
    .where('type', '==', type)
    .where('resolue', '==', false)
    .limit(50).get();
  const existe = dejaSnap.docs.find(d => {
    const m = d.data().metadata || {};
    const k = m.stationId || m.stockId || m.venteId || d.data().message;
    return k === dedupKey;
  });
  if (existe) {
    console.log(`[creerAlerte] doublon ignoré : ${type} key=${dedupKey}`);
    return;
  }

  await db.collection('alertes').add({
    type, message, gravite, metadata,
    resolue: false,
    timestamp: FieldValue.serverTimestamp()
  });
  console.log(`[creerAlerte] créée : ${type} "${message}" (gravite=${gravite})`);

  // Notification Discord (best effort, n'arrête pas le flow si échec)
  notifierDiscord(type, message, gravite).catch(e =>
    console.error('Discord webhook error:', e.message));
}

// Envoie l'alerte sur le webhook Discord configuré dans /config/global.discordWebhookAlertes
async function notifierDiscord(type, message, gravite) {
  const cfg = await db.collection('config').doc('global').get();
  const url = cfg.exists ? cfg.data().discordWebhookAlertes : null;
  if (!url) {
    console.log('[notifierDiscord] aucun webhook configuré dans /config/global.discordWebhookAlertes');
    return;
  }
  console.log(`[notifierDiscord] envoi vers webhook (${url.slice(0, 50)}…) — type=${type}`);
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
      case 'bankAccount':     await onBankAccount(payload); break;
      case 'autoRh':          await onAutoRh(payload); break;
      case 'autorankup':      await onAutorankup(payload); break;
      case 'statsbank':       await onStatsbank(payload); break;
      case 'rapportPompiste': await onRapportPompiste(payload); break;
      case 'stationsDashboard': await onStationsDashboard(payload); break;
      case 'dossierEmploye':  await onDossierEmploye(payload); break;
      case 'avertissement':   await onAvertissement(payload); break;
      case 'licenciement':    await onLicenciement(payload); break;
      case 'venteAuto':       await onVenteAuto(payload); break;
      case 'vehicule':        await onVehicule(payload); break;
      case 'stagiaire':       await onStagiaire(payload); break;
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

async function onInventory({ type, item, itemNomBrut, count, source, owner, characterId, properName, name }) {
  // Le parser bot envoie déjà l'ID catalogue résolu dans `item` (ex: "bouteille-eau")
  // et le nom FiveM affiché dans `itemNomBrut`. Filtrage source + whitelist déjà faits.
  if (!item) return;
  const itemId  = slug(item); // idempotent si item est déjà un slug
  const itemNom = itemNomBrut || item;

  const ref = db.collection('stocks').doc(itemId);
  const snap = await ref.get();
  const cur = snap.exists ? (snap.data().quantite || 0) : 0;
  const delta = type === 'inventory-add' ? count : -count;
  await ref.set({
    quantite: cur + delta,
    nom: itemNom,
    derniereMaj: FieldValue.serverTimestamp(),
    par: properName || name || 'bot'
  }, { merge: true });

  await db.collection('mouvementsStock').add({
    type, item: itemId, itemNom,
    quantite: delta,
    par: properName || name || '',
    source: source || '',
    discord: name || '',
    characterId: characterId || '',
    owner: owner || '',
    timestamp: FieldValue.serverTimestamp()
  });

  // Quota pompiste depuis logs FiveM :
  //   - caoutchouc : oui (pas de saisie modal)
  //   - bidon-essence : NON depuis 2026-05-11 (le modal /stations ravitaillement
  //     est devenu source de verite, eviter doublon avec pompisteRavitaillerManuel)
  if (type === 'inventory-add' && characterId && itemId === 'caoutchouc') {
    await majQuotaPompiste(characterId, itemNom, count);
  }
}

async function onService({ employeId, employeIdDiscord, employeNom, action, timestamp }) {
  const t = timestamp ? new Date(timestamp) : new Date();

  // Resolution de la cle Firestore : idPerso > idDiscord > lookup par nom RP.
  // Necessaire car les logs Jessica n'ont ni idPerso ni idDiscord (juste
  // "Prenom Nom a commence son service").
  let key = employeId || employeIdDiscord;
  if (!key && employeNom) {
    // Resolution par nom RP : matching case-insensitive contre tous les users.
    // Firestore == est case-sensitive, donc on fetch all + filtre en code.
    // OK pour ~20 employes ; reviser si LTD passe a >200.
    const parts = employeNom.trim().split(/\s+/);
    if (parts.length >= 2) {
      const norm = (s) => String(s || '').trim().toLowerCase()
        .normalize('NFD').replace(/[̀-ͯ]/g, '');
      const usersSnap = await db.collection('users').get();
      const candidats = [
        // Tentative 1 : prenom = 1er mot, nom = reste
        { prenom: parts[0], nom: parts.slice(1).join(' ') },
        // Tentative 2 : prenom = tous sauf dernier, nom = dernier
        // Utile pour "Luciana Angel Mars" -> prenom="Luciana Angel", nom="MARS"
        ...(parts.length >= 3 ? [{ prenom: parts.slice(0, -1).join(' '), nom: parts.at(-1) }] : [])
      ];
      for (const c of candidats) {
        const match = usersSnap.docs.find(d => {
          const u = d.data();
          return norm(u.prenom) === norm(c.prenom) && norm(u.nom) === norm(c.nom);
        });
        if (match) { key = match.id; break; }
      }
    }
  }
  if (!key) {
    console.log(`[onService] employeNom="${employeNom}" pas resolu -> skip`);
    return;
  }

  if (action === 'start') {
    await db.collection('servicesOuverts').doc(key).set({
      employeId: key, employeNom, debut: Timestamp.fromDate(t)
    });
  } else if (action === 'end') {
    const ref = db.collection('servicesOuverts').doc(key);
    const snap = await ref.get();
    if (snap.exists) {
      const debut = snap.data().debut.toDate();
      const duree = t.getTime() - debut.getTime();
      await db.collection('services').add({
        employeId: key, employeNom,
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

  // 2026-05-11 : verification "vendeur en service".
  // Un employe ne doit emettre des factures que pendant son service. Si pas
  // de doc /servicesOuverts/{vendeurId} → alerte direction (potentielle fraude
  // ou oubli de prise de service).
  let enService = null;
  if (vendeurId) {
    const svcSnap = await db.collection('servicesOuverts').doc(vendeurId).get();
    enService = svcSnap.exists;
  }

  // Idempotent : meme factureId emis par #suivi-facture ET #factures = 1 seul doc
  const docId = p.factureId ? `fac-${p.factureId}` : `fac-msg-${Date.now()}`;
  await db.collection('ventes').doc(docId).set({
    factureId: p.factureId,
    vendeurDiscord: p.vendeurDiscord || '',
    vendeurNom: p.vendeurNom || '',
    vendeurId,
    enServiceAuMomentDeLaVente: enService,
    client: p.clientNom || '',
    montant: Number(p.montant) || 0,
    benefice: p.benefice ?? null,
    raison: p.raison || '',
    paiement: p.paiement || '',
    items: p.items || [],
    stockVerifie: p.stockVerifie ?? null,
    timestamp: FieldValue.serverTimestamp()
  }, { merge: true });

  // Alerte si vendeur identifie mais PAS en service au moment de la vente
  if (vendeurId && enService === false) {
    await db.collection('alertes').add({
      type: 'vente-hors-service',
      message: `⚠ Vente #${p.factureId} (${p.montant}$) par ${p.vendeurNom || vendeurId} HORS SERVICE — devrait être en prise de service.`,
      gravite: 'warn',
      metadata: { factureId: p.factureId, vendeurId, vendeurNom: p.vendeurNom, montant: p.montant },
      resolue: false,
      timestamp: FieldValue.serverTimestamp()
    });
  }
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
  // Fix bug "<@undefined>" : si le bot Discord n'a pas pu résoudre l'utilisateur
  // (cas typique des dépenses automatiques type loyer), on substitue par un libellé clair.
  let utilisateur = p.utilisateur || '';
  if (/^<@!?undefined>$/i.test(utilisateur) || utilisateur === '') {
    utilisateur = 'Système (auto)';
  }

  // 2026-05-11 : detection paie/salaire en doublon avec /paies.
  // FiveM log les paies sur DEUX canaux : #paie (-> /paies) ET #depenses (sortie
  // d'argent) avec raison "Paye ponctuelle de membre" ou "Salaire". On marque
  // alors type='paie' pour que la page Comptabilite exclue ces entries de
  // "Charges non deductibles" (sinon doublon avec masse salariale).
  let type = p.type || 'autre';
  const rawRaison = String(p.raison || '');
  if (/\b(paye|paie|salaire|r[ée]mun[ée]ration)\b/i.test(rawRaison)) {
    type = 'paie';
  }

  await db.collection('depenses').add({
    compteId: p.compteId,
    utilisateur,
    montant: Number(p.montant) || 0,
    soldeAvant: p.soldeAvant,
    soldeApres: p.soldeApres,
    raison: p.raison || '',
    type,
    deductible,
    source: 'discord',
    timestamp: FieldValue.serverTimestamp()
  });
}

// === Banque LTD : transactions xbankaccount sur iban LTDSANDY ===
// Stocke chaque mouvement (entrée ou sortie) avec le solde après transaction.
// Utilisé pour afficher le solde temps réel + audit complet des mouvements.
//
// Cas spécial : si la raison est "Redistribution N°XXXXX" sur une entrée d'argent,
// c'est une VENTE CARBURANT (depuis la migration FiveM de 2026-05). Le N° = ID
// de la pompe côté FiveM. On crée aussi un doc /redistributions pour qu'elle
// apparaisse dans /revenus-carburant. Mapping N° → station via /config.fivemPompesMap.
async function onBankAccount(p) {
  await db.collection('banqueLtd').add({
    type: p.type || 'add',          // 'add' (recette) | 'remove' (sortie)
    iban: p.iban || '',
    accountId: p.accountId || '',
    montant: Number(p.montant) || 0,
    soldeAvant: Number(p.soldeAvant) || 0,
    soldeApres: Number(p.soldeApres) || 0,
    raison: p.raison || '',
    source: 'discord-xbankaccount',
    timestamp: FieldValue.serverTimestamp()
  });

  // Détection vente carburant (raison "Redistribution N°XXXXX" sur entrée)
  if ((p.type || 'add') !== 'add') return;
  const matchRedis = String(p.raison || '').match(/Redistribution\s*N[°º]?\s*(\d+)/i);
  if (!matchRedis) return;
  const fivemPompeId = matchRedis[1];

  // Lookup mapping pompe FiveM → station dans config
  const cfgSnap = await db.collection('config').doc('global').get();
  const cfg = cfgSnap.exists ? cfgSnap.data() : {};
  const mapping = cfg.fivemPompesMap || {};
  const stationId = mapping[fivemPompeId] || '';
  let stationNom = `Station #${fivemPompeId}`;
  let prixLitre = null;
  let stockAvant = null;
  let stockApres = null;
  let litres = null;

  if (stationId) {
    // Lecture + decrement dans une transaction pour eviter les races
    // si plusieurs ventes arrivent quasi-simultanement sur la meme pompe.
    const stationRef = db.collection('stations').doc(stationId);
    await db.runTransaction(async (tx) => {
      const sSnap = await tx.get(stationRef);
      if (!sSnap.exists) return;
      const s = sSnap.data();
      stationNom = s.nom || stationNom;
      prixLitre  = Number(s.prixLitre) || 0;
      stockAvant = Number(s.stockActuel) || 0;
      if (prixLitre > 0) {
        litres = (Number(p.montant) || 0) / prixLitre;
        stockApres = Math.max(0, Math.round((stockAvant - litres) * 100) / 100);
        tx.set(stationRef, {
          stockActuel: stockApres,
          derniereMajAuto: FieldValue.serverTimestamp(),
          sourceMajAuto: 'vente-carburant-auto-decrement'
        }, { merge: true });
      }
    });
  }

  await db.collection('redistributions').add({
    redistributionId: fivemPompeId,        // N° pompe FiveM (pas un id unique de vente)
    fivemPompeId,                          // explicite pour mapping/admin
    station: stationNom,
    stationId: stationId || '',
    montant: Number(p.montant) || 0,
    soldeAvant: Number(p.soldeAvant) || 0,
    soldeApres: Number(p.soldeApres) || 0,
    litres,                                // calcule via montant/prixLitre
    prixLitre,                             // snapshot au moment de la vente
    stockAvant,
    stockApres,
    source: 'banqueLtd-redistribution',
    timestamp: FieldValue.serverTimestamp()
  });
}

// === RH automatisée : embauches + exclusions (#auto-rh) ===
// Stratégie V1 :
//  - Toujours logger l'événement dans /rhEvenements (audit complet)
//  - EXCLUSION : tenter de retrouver l'utilisateur par idDiscord ou idPerso
//    et basculer son statut à 'suspendu' automatiquement
//  - EMBAUCHE : créer une alerte pour rappeler à l'admin de créer le compte
//    (création Firebase Auth manuelle pour l'instant — sécurité)
async function onAutoRh(p) {
  await db.collection('rhEvenements').add({
    type: p.type,
    prenom: p.prenom || '',
    nom: p.nom || '',
    idDiscord: p.idDiscord || '',
    idPerso: p.idPerso || '',
    parQui: p.parQui || '',
    timestamp: FieldValue.serverTimestamp()
  });

  if (p.type === 'exclusion' || p.type === 'depart') {
    // Suspendre auto le compte (exclusion = licenciement, depart = quitté volontairement)
    let userId = null;
    if (p.idDiscord) {
      const s = await db.collection('users').where('idDiscord', '==', p.idDiscord).limit(1).get();
      if (!s.empty) userId = s.docs[0].id;
    }
    if (!userId && p.idPerso) {
      const s = await db.collection('users').where('idPerso', '==', p.idPerso).limit(1).get();
      if (!s.empty) userId = s.docs[0].id;
    }
    if (userId) {
      const motif = p.type === 'depart' ? 'Départ volontaire' : (p.parQui || 'Exclusion');
      await db.collection('users').doc(userId).set({
        statut: 'suspendu',
        suspenduAt: FieldValue.serverTimestamp(),
        suspenduPar: motif,
        suspenduMotif: p.type
      }, { merge: true });
      console.log(`[autoRh] Compte ${userId} suspendu auto (${p.type}, idDiscord=${p.idDiscord})`);
    } else {
      console.log(`[autoRh] ${p.type} : aucun compte trouvé pour idDiscord=${p.idDiscord} idPerso=${p.idPerso}`);
    }
  } else if (p.type === 'embauche') {
    // Créer une alerte pour rappel à l'admin (création de compte manuel)
    await creerAlerte(
      'embauche-a-traiter',
      `🆕 Nouvel employé à intégrer : ${p.prenom} ${p.nom} (Discord:${p.idDiscord}, Perso:${p.idPerso}). Crée son compte via Admin.`,
      'info',
      { idDiscord: p.idDiscord, idPerso: p.idPerso, prenom: p.prenom, nom: p.nom }
    );
  }
}

// === Promotion automatique (#autorankup) ===
// Met à jour le rôle d'un employé existant si on le retrouve.
async function onAutorankup(p) {
  if (!p.nouveauRole) return;

  // Cherche l'employé par idDiscord, puis idPerso, puis nom complet
  let userId = null;
  if (p.idDiscord) {
    const s = await db.collection('users').where('idDiscord', '==', p.idDiscord).limit(1).get();
    if (!s.empty) userId = s.docs[0].id;
  }
  if (!userId && p.idPerso) {
    const s = await db.collection('users').where('idPerso', '==', p.idPerso).limit(1).get();
    if (!s.empty) userId = s.docs[0].id;
  }
  if (!userId && p.prenom && p.nom) {
    const s = await db.collection('users')
      .where('prenom', '==', p.prenom)
      .where('nom', '==', p.nom)
      .limit(1).get();
    if (!s.empty) userId = s.docs[0].id;
  }

  if (!userId) {
    console.log(`[autorankup] Aucun compte pour ${p.prenom} ${p.nom} (${p.idDiscord})`);
    return;
  }

  await db.collection('users').doc(userId).set({
    role: p.nouveauRole,
    promuAt: FieldValue.serverTimestamp(),
    promuPar: p.parQui || 'auto-bot',
    ancienRole: p.ancienRole || null
  }, { merge: true });
  console.log(`[autorankup] ${p.prenom} ${p.nom} : ${p.ancienRole} → ${p.nouveauRole}`);
}

// === Statsbank (récap hebdo officiel FiveM) ===
// Stockage pour comparaison avec nos calculs internes + import impôt estimé.
// Capte aussi le top vendeurs (nouveauté V2).
async function onStatsbank(p) {
  // Doc id = "S{numero}-{annee}" pour idempotence (1 doc par semaine)
  const docId = `S${String(p.numeroSemaine).padStart(2, '0')}-${p.annee}`;
  await db.collection('statsHebdoOfficiels').doc(docId).set({
    numeroSemaine: p.numeroSemaine,
    annee: p.annee,
    periode: p.periode || '',
    ca: p.ca || 0,
    sorties: p.sorties || 0,
    beneficeBrut: p.beneficeBrut || 0,    // peut être négatif (déficit)
    soldeActuel: p.soldeActuel || 0,
    loyers: p.loyers || 0,
    impotEstime: p.impotEstime || 0,
    trancheImpot: p.trancheImpot || null,
    tauxImpot: p.tauxImpot || null,
    nbFactures: p.nbFactures || 0,
    montantFactures: p.montantFactures || 0,
    nbPayes: p.nbPayes || 0,
    montantPayes: p.montantPayes || 0,
    topVendeurs: p.topVendeurs || [],    // [{ nom, nbFactures, montant }, …]
    source: 'discord-statsbank',
    derniereMaj: FieldValue.serverTimestamp()
  }, { merge: true });
  console.log(`[statsbank] ${docId} OK (CA=${p.ca}, bénéfice=${p.beneficeBrut}, ${p.topVendeurs?.length || 0} top vendeurs)`);
}

// === Rapport pompiste quotidien (#pompiste) ===
// NOTE 2026-05-11 : ne MET PLUS A JOUR stockActuel des stations. La source
// de verite stockActuel est maintenant : baseline manuel (modal /stations
// ou script) + decrement automatique via onBankAccount sur chaque vente
// carburant. Le rapport pompiste contenait des valeurs stale qui ecrasaient
// les vraies valeurs in-game. On garde la sauvegarde brute pour audit.
async function onRapportPompiste(p) {
  await db.collection('rapportsPompisteQuotidien').add({
    dateRapport: p.dateRapport || '',
    ca: p.ca || 0,
    nbCommandes: p.nbCommandes || 0,
    niveaux: p.niveaux || [],
    timestamp: FieldValue.serverTimestamp()
  });
}

// === Dashboard stations (#⛽ Station — message édité en place) ===
// NOTE 2026-05-11 : N'ECRIT PLUS stockActuel. Le dashboard in-game contenait
// des valeurs stale qui ecrasaient les vraies valeurs. La source de verite
// stockActuel est maintenant : baseline manuel + decrement via onBankAccount.
// On garde stockMax/prixLitre/derniereRavit/statut/niveauPct car ces infos
// restent utiles (capacite max, prix officiel, dernier ravit etc).
async function onStationsDashboard(p) {
  const stations = Array.isArray(p.stations) ? p.stations : [];
  for (const s of stations) {
    if (!s.stationId) continue;
    const ref = db.collection('stations').doc(s.stationId);
    const snap = await ref.get();
    const cur = snap.exists ? snap.data() : {};
    const patch = {
      nom:           s.nom || cur.nom || s.stationId,
      stockMax:      s.stockMax,
      niveauPct:     s.niveauPct,
      prixLitre:     s.prixLitre,
      derniereRavit: s.derniereRavit,
      statut:        s.statut,
      derniereMajAuto: FieldValue.serverTimestamp(),
      sourceMajAuto:   'stations-dashboard'
    };
    await ref.set(patch, { merge: true });
  }
  console.log(`[stationsDashboard] ${stations.length} stations sync (hors stockActuel)`);
}

// === Dossier employe (forum #Dossiers-Employers, threads) ===
// Stocke chaque fiche dans /dossiersEmployes/{threadId} (audit complet).
// 2026-05-11 : AUTO-CREATION COMPTE. Si aucun /users ne matche le nom+prenom :
//   - Cree Firebase Auth user avec username=prenom.nom (slugifie) + mdp aleatoire
//   - Cree /users avec telephone/iban/pole de la fiche + motDePasseProvisoire=true
//   - Cree une alerte info dans /alertes avec les identifiants a transmettre
// Si un /users existe deja : enrichit avec telephone/iban/pole sans toucher
// aux champs critiques (email/idDiscord/idPerso).
async function onDossierEmploye(p) {
  if (!p?.threadId) return;
  await db.collection('dossiersEmployes').doc(p.threadId).set({
    threadId:        p.threadId,
    threadName:      p.threadName || '',
    parentForumId:   p.parentForumId || '',
    auteurDiscordId: p.auteurDiscordId || '',
    auteurUsername:  p.auteurUsername || '',
    nomPrenom:       p.nomPrenom,
    prenom:          p.prenom,
    nom:             p.nom,
    telephone:       p.telephone || '',
    iban:            p.iban || '',
    cni:             p.cni || '',
    permis:          p.permis || '',
    pole:            p.pole || '',
    derniereMaj:     FieldValue.serverTimestamp()
  }, { merge: true });

  if (!p.nom || !p.prenom) return;
  const usersSnap = await db.collection('users')
    .where('nom', '==', p.nom)
    .where('prenom', '==', p.prenom)
    .get();

  if (usersSnap.size > 1) {
    console.log(`[dossierEmploye] ${usersSnap.size} users matchent ${p.prenom} ${p.nom} — skip (ambigu)`);
    return;
  }

  if (usersSnap.size === 0) {
    // === AUTO-CREATION DU COMPTE ===
    const slug = (s) => String(s || '').toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '');
    let username = `${slug(p.prenom)}.${slug(p.nom)}`;
    if (username.length < 3 || username.length > 30) {
      console.log(`[dossierEmploye] username '${username}' invalide — skip auto-creation`);
      return;
    }
    // Verifier unicite username (un homonyme deja en base)
    const usernameExisting = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!usernameExisting.empty) {
      username = `${username}.${Date.now().toString(36).slice(-4)}`;
    }

    // Generer mot de passe
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    let password = '';
    for (let i = 0; i < 12; i++) password += chars[Math.floor(Math.random() * chars.length)];

    const email = `${username}@ltd-sandy-shores.local`;
    // Devine le role depuis le pole (par defaut vendeur-novice)
    const role = /pompiste/i.test(p.pole || '') ? 'pompiste-novice' : 'vendeur-novice';

    try {
      const userRecord = await adminAuth.createUser({
        email, password, emailVerified: true,
        displayName: `${p.prenom} ${p.nom}`
      });
      await db.collection('users').doc(userRecord.uid).set({
        username, email,
        prenom: p.prenom, nom: p.nom,
        idDiscord: p.auteurDiscordId || '',
        idPerso: '',
        role, statut: 'actif',
        dateEntree: new Date().toISOString().slice(0, 10),
        creePar: 'auto-dossier-employe',
        motDePasseProvisoire: true,
        telephone: p.telephone || '',
        iban: p.iban || '',
        pole: p.pole || '',
        cni: p.cni || '',
        permis: p.permis || '',
        sourceCreationThread: p.threadId
      });
      // Alerte direction avec les credentials a transmettre
      await db.collection('alertes').add({
        type: 'compte-cree-auto',
        message: `🆕 Compte auto-cree pour ${p.prenom} ${p.nom} (depuis fiche Discord). Identifiant: ${username} — Mot de passe initial: ${password}. A transmettre via Discord/in-game.`,
        gravite: 'info',
        metadata: { uid: userRecord.uid, username, password, prenom: p.prenom, nom: p.nom, threadId: p.threadId },
        resolue: false,
        timestamp: FieldValue.serverTimestamp()
      });
      console.log(`[dossierEmploye] AUTO-CREATION : ${p.prenom} ${p.nom} → ${username} (uid=${userRecord.uid})`);
    } catch (err) {
      console.error(`[dossierEmploye] AUTO-CREATION FAIL pour ${p.prenom} ${p.nom} :`, err.message);
      await db.collection('alertes').add({
        type: 'compte-cree-auto-error',
        message: `❌ Echec auto-creation compte pour ${p.prenom} ${p.nom} : ${err.message}`,
        gravite: 'warn',
        metadata: { prenom: p.prenom, nom: p.nom, threadId: p.threadId, error: err.message },
        resolue: false,
        timestamp: FieldValue.serverTimestamp()
      });
    }
    return;
  }

  // === ENRICHISSEMENT du user existant ===
  const userRef = usersSnap.docs[0].ref;
  const enrichPatch = {};
  if (p.telephone) enrichPatch.telephone = p.telephone;
  if (p.iban)      enrichPatch.iban      = p.iban;
  if (p.pole)      enrichPatch.pole      = p.pole;
  if (p.cni)       enrichPatch.cni       = p.cni;
  if (p.permis)    enrichPatch.permis    = p.permis;
  if (Object.keys(enrichPatch).length > 0) {
    enrichPatch.enrichiDepuisDossierAt = FieldValue.serverTimestamp();
    enrichPatch.enrichiDepuisDossierThread = p.threadId;
    await userRef.set(enrichPatch, { merge: true });
    console.log(`[dossierEmploye] /users/${userRef.id} enrichi avec ${Object.keys(enrichPatch).join(', ')}`);
  }
}

// === Avertissement (#logs-avertissement, bot Jessica) ===
// Logge dans /rhEvenements (type='avertissement'). Ne modifie PAS le user
// (c'est juste un signal pour le patron, pas une sanction definitive).
async function onAvertissement(p) {
  await db.collection('rhEvenements').add({
    type:             'avertissement',
    sousType:         p.sousType || 'avertissement',
    memberDiscordId:  p.memberDiscordId || '',
    dureeMinutes:     p.dureeMinutes ?? null,
    debut:            p.debut || '',
    fin:              p.fin || '',
    rawDescription:   p.rawDescription || '',
    timestamp:        FieldValue.serverTimestamp(),
    traitee:          false
  });
  console.log(`[avertissement] ${p.sousType} pour <@${p.memberDiscordId}> (duree=${p.dureeMinutes}min)`);
}

// === Licenciement (#logs-licenciement, bot Jessica) ===
// 1. Logge dans /rhEvenements (type='licenciement') — audit complet.
// 2. Met a jour le user correspondant en statut='exclu' si on le trouve
//    (match par idDiscord d'abord, fallback idPerso). Stocke la date de fin.
async function onLicenciement(p) {
  await db.collection('rhEvenements').add({
    type:             'licenciement',
    sousType:         p.typeLicenciement || 'licenciement',
    memberDiscordId:  p.memberDiscordId || '',
    discordId:        p.discordId || '',
    idPerso:          p.idPerso || '',
    nom:              p.nom || '',
    prenom:           p.prenom || '',
    telephone:        p.telephone || '',
    iban:             p.iban || '',
    dateEmbauche:     p.dateEmbauche || '',
    dateFin:          p.dateFin || '',
    parQui:           p.parQui || '',
    raison:           p.raison || '',
    casierLibere:     p.casierLibere || '',
    rawDescription:   p.rawDescription || '',
    timestamp:        FieldValue.serverTimestamp(),
    traitee:          false
  });

  // Tente de retrouver et suspendre le user
  let userDoc = null;
  if (p.memberDiscordId) {
    const s = await db.collection('users').where('idDiscord', '==', p.memberDiscordId).limit(1).get();
    if (!s.empty) userDoc = s.docs[0];
  }
  if (!userDoc && p.idPerso) {
    const s = await db.collection('users').where('idPerso', '==', p.idPerso).limit(1).get();
    if (!s.empty) userDoc = s.docs[0];
  }
  if (userDoc) {
    await userDoc.ref.set({
      statut:        'exclu',
      dateExclusion: p.dateFin || '',
      raisonExclusion: p.raison || '',
      typeExclusion: p.typeLicenciement || '',
      excluPar:      p.parQui || ''
    }, { merge: true });
    console.log(`[licenciement] /users/${userDoc.id} marque exclu (type=${p.typeLicenciement})`);
  } else {
    console.log(`[licenciement] aucun user matche pour ${p.prenom} ${p.nom} (discord=${p.memberDiscordId} idPerso=${p.idPerso}) — log uniquement`);
  }
}

// === Sortie/retour véhicule LTD (#logs-vehicules) ===
// Stocké dans /sortiesVehicules. Permet d'auditer l'usage des véhicules
// d'entreprise par employé (qui prend quoi, quand). Pas de side-effect
// sur les autres collections.
async function onVehicule(p) {
  let employeId = null;
  if (p.employeDiscord) {
    const u = await db.collection('users').where('idDiscord', '==', p.employeDiscord).limit(1).get();
    if (!u.empty) employeId = u.docs[0].id;
  }
  const ts = p.heureMs ? Timestamp.fromMillis(Number(p.heureMs)) : FieldValue.serverTimestamp();
  await db.collection('sortiesVehicules').add({
    action: p.action || 'autre',
    employeId,
    employeDiscord: p.employeDiscord || '',
    employeNom: p.employeNom || '',
    characterId: p.characterId || '',
    vehiculeId: p.vehiculeId || '',
    markerId: p.markerId || '',
    actionId: p.actionId || '',
    source: p.source || '',
    timestamp: ts
  });
}

// === Nouvel employé / stagiaire (#stagiaire) ===
// Crée un événement RH ET enrichit /users matchant idPerso (priorité)
// puis idDiscord, avec téléphone, IBAN, casier (si renseignés).
async function onStagiaire(p) {
  const dateEmbauche = p.dateEmbauche ? new Date(p.dateEmbauche) : null;

  // 1) Logger l'événement RH (audit)
  await db.collection('rhEvenements').add({
    type: 'embauche-stagiaire',
    employeDiscord: p.employeDiscord || '',
    employeUsername: p.employeUsername || '',
    idPerso: p.idPerso || '',
    nom: p.nom || '',
    prenom: p.prenom || '',
    telephone: p.telephone || null,
    iban: p.iban || null,
    casier: p.casier || null,
    dateEmbauche: dateEmbauche ? Timestamp.fromDate(dateEmbauche) : null,
    recruteurDiscord: p.recruteurDiscord || '',
    traitee: false,
    timestamp: FieldValue.serverTimestamp()
  });

  // 2) Enrichir /users si match idPerso ou idDiscord
  let userRef = null;
  if (p.idPerso) {
    const s = await db.collection('users').where('idPerso', '==', p.idPerso).limit(1).get();
    if (!s.empty) userRef = s.docs[0].ref;
  }
  if (!userRef && p.employeDiscord) {
    const s = await db.collection('users').where('idDiscord', '==', p.employeDiscord).limit(1).get();
    if (!s.empty) userRef = s.docs[0].ref;
  }
  if (userRef) {
    const patch = {};
    if (p.telephone) patch.telephone = p.telephone;
    if (p.iban)      patch.iban      = p.iban;
    if (p.casier)    patch.casier    = p.casier;
    if (dateEmbauche && !isNaN(dateEmbauche.getTime())) {
      patch.dateEmbauche = Timestamp.fromDate(dateEmbauche);
    }
    if (Object.keys(patch).length > 0) {
      await userRef.set(patch, { merge: true });
    }
  }
}

// === Vente-auto (#ventes — distributeur LTD automatique) ===
// Stockée dans /ventes avec source='ventes-auto' pour distinguer.
async function onVenteAuto(p) {
  await db.collection('ventes').add({
    factureId:  p.venteId || '',
    vendeurNom: p.vendeurNom || 'LTD',
    clientNom:  p.clientNom || '',
    typeVente:  p.typeVente || '',
    montant:    Number(p.montant) || 0,
    benefice:   0, // pas calculable sans mapping noms FiveM ↔ catalogue
    paiement:   '',
    raison:     p.articlesBrut || '',
    items:      p.items || [],
    stockVerifie: null,
    source:     'ventes-auto',
    timestamp:  FieldValue.serverTimestamp()
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

// ----------------------------------------------------------------
// migrateUsername — Change l'email Firebase Auth vers le synthetique
// {username}@ltd-sandy-shores.local pour les utilisateurs existants.
// ----------------------------------------------------------------
// Contourne la restriction "Please verify the new email before changing"
// imposee aux clients par Firebase Auth (protection recente). L'Admin SDK
// bypass cette verification.
// Le caller doit etre authentifie et n'agit que sur SON propre compte.
// ----------------------------------------------------------------
export const migrateUsername = onRequest({
  region: 'europe-west1',
  cors: true
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const authHeader = req.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return res.status(401).json({ error: 'Missing Authorization Bearer token' });
    const decoded = await adminAuth.verifyIdToken(idToken);
    const uid = decoded.uid;

    const { username } = req.body || {};
    const cleanUsername = String(username || '').trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,30}$/.test(cleanUsername)) {
      return res.status(400).json({ error: 'Username invalide : 3-30 caracteres, lettres/chiffres/. _ -' });
    }

    // Verification unicite
    const existing = await db.collection('users').where('username', '==', cleanUsername).limit(1).get();
    if (!existing.empty && existing.docs[0].id !== uid) {
      return res.status(409).json({ error: `Username "${cleanUsername}" deja pris` });
    }

    const newEmail = `${cleanUsername}@ltd-sandy-shores.local`;

    // Admin SDK : updateUser bypass le requirement de verification email
    await adminAuth.updateUser(uid, { email: newEmail, emailVerified: true });
    await db.collection('users').doc(uid).set({
      username: cleanUsername,
      email: newEmail,
      motDePasseProvisoire: true,
      usernameDefiniLe: FieldValue.serverTimestamp()
    }, { merge: true });

    return res.status(200).json({ ok: true, username: cleanUsername, email: newEmail });
  } catch (err) {
    console.error('[migrateUsername]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// ----------------------------------------------------------------
// adminResetPassword — Régénère le MDP d'un compte par un admin
// ----------------------------------------------------------------
// Sécurité : caller doit être Patron / Co-Patron / Admin Technique
// (vérifié via le ID token Firebase Auth fourni en header).
// Retourne le nouveau MDP en clair (one-shot) pour transmission RP.
// Met motDePasseProvisoire=true pour forcer un changement à la
// prochaine connexion.
// ----------------------------------------------------------------
export const adminResetPassword = onRequest({
  region: 'europe-west1',
  cors: true
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const authHeader = req.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return res.status(401).json({ error: 'Missing Authorization Bearer token' });
    const decoded = await adminAuth.verifyIdToken(idToken);

    const callerSnap = await db.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists) return res.status(403).json({ error: 'Caller profile not found' });
    const callerRole = callerSnap.data().role;
    const ROLES_ADMIN = ['patron', 'co-patron', 'admin-technique'];
    if (!ROLES_ADMIN.includes(callerRole)) {
      return res.status(403).json({ error: 'Only patron/co-patron/admin-technique can reset passwords' });
    }

    const { targetUid } = req.body || {};
    if (!targetUid) return res.status(400).json({ error: 'Missing targetUid' });

    // Garde-fou : on ne reset pas le patron sauf si caller est patron ou super admin
    const targetSnap = await db.collection('users').doc(targetUid).get();
    if (!targetSnap.exists) return res.status(404).json({ error: 'Target user not found' });
    const targetRole = targetSnap.data().role;
    if (targetRole === 'patron' && callerRole !== 'patron' && callerRole !== 'admin-technique') {
      return res.status(403).json({ error: 'Only patron or admin-technique can reset the patron password' });
    }

    // Génère un nouveau mot de passe aléatoire (12 chars, sans caractères ambigus)
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789ABCDEFGHJKMNPQRSTUVWXYZ';
    let newPassword = '';
    for (let i = 0; i < 12; i++) newPassword += chars[Math.floor(Math.random() * chars.length)];

    // Update Firebase Auth + flag motDePasseProvisoire
    await adminAuth.updateUser(targetUid, { password: newPassword });
    await db.collection('users').doc(targetUid).set({
      motDePasseProvisoire: true,
      mdpRegenereLe: FieldValue.serverTimestamp(),
      mdpRegenerePar: decoded.uid
    }, { merge: true });

    return res.status(200).json({ password: newPassword });
  } catch (err) {
    console.error('[adminResetPassword]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

// ----------------------------------------------------------------
// pompisteRavitaillerManuel — Le pompiste declare avoir mis N bidons.
// ----------------------------------------------------------------
// Le pompiste raisonne en bidons, pas en litres. Cette fonction :
//   1. stockActuel += N * 15 (cap a stockMax)
//   2. cree un doc /redistributions source='manuel-pompiste' (audit)
//   3. incremente /quotasPompiste/{semaine}_{uid}.bidons de N
// Le modal = source de verite quota (pas les logs FiveM inventory-add).
// Atomique via Cloud Function pour bypasser les rules Firestore
// restrictives (quotas/redistributions = canAdmin uniquement).
// ----------------------------------------------------------------
export const pompisteRavitaillerManuel = onRequest({
  region: 'europe-west1',
  cors: true
}, async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const authHeader = req.get('Authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) return res.status(401).json({ error: 'Missing Authorization Bearer token' });
    const decoded = await adminAuth.verifyIdToken(idToken);

    const callerSnap = await db.collection('users').doc(decoded.uid).get();
    if (!callerSnap.exists) return res.status(403).json({ error: 'Caller profile not found' });
    const caller = callerSnap.data();
    const role = caller.role || '';
    const allowed = role === 'patron' || role === 'co-patron' || role === 'admin-technique'
      || role === 'responsable-pompiste' || /^pompiste-/.test(role);
    if (!allowed) return res.status(403).json({ error: 'Ce role ne peut pas ravitailler une station.' });

    const { stationId, bidons } = req.body || {};
    if (!stationId) return res.status(400).json({ error: 'Missing stationId' });
    const nbBidons = Number(bidons);
    if (!Number.isFinite(nbBidons) || nbBidons <= 0 || !Number.isInteger(nbBidons)) {
      return res.status(400).json({ error: 'bidons doit etre un entier > 0' });
    }

    const BIDON_L = 15;
    const litresDemandes = nbBidons * BIDON_L;

    const stRef = db.collection('stations').doc(stationId);
    const stSnap = await stRef.get();
    if (!stSnap.exists) return res.status(404).json({ error: 'Station introuvable' });
    const station = stSnap.data();
    const stockAvant = Number(station.stockActuel || 0);
    const stockMax = Number(station.stockMax || 0);
    const stockApres = stockAvant + litresDemandes;
    const pompisteNom = `${caller.prenom || ''} ${caller.nom || ''}`.trim();

    // Refuse hard si depasse la capacite max (anti-fraude / detection mensonge).
    // On cree aussi une alerte direction avec la tentative pour audit.
    if (stockMax > 0 && stockApres > stockMax) {
      const placeRestante = Math.max(0, stockMax - stockAvant);
      const bidonsMax = Math.floor(placeRestante / BIDON_L);
      await db.collection('alertes').add({
        type: 'pompiste-overflow-tentative',
        message: `🚨 ${pompisteNom} a tenté de ravitailler ${station.nom || stationId} de ${nbBidons} bidons (${litresDemandes} L) alors que la station n'accepte que ${bidonsMax} bidons max (${placeRestante} L libres).`,
        gravite: 'warn',
        metadata: { stationId, pompisteId: decoded.uid, pompisteNom, bidonsTentes: nbBidons, bidonsMax, stockAvant, stockMax },
        resolue: false,
        timestamp: FieldValue.serverTimestamp()
      });
      return res.status(400).json({
        error: `Impossible : la station n'a que ${placeRestante} L libres (${bidonsMax} bidons max). Tu en as saisi ${nbBidons}.`,
        bidonsMax, placeRestante, stockAvant, stockMax
      });
    }
    const litresAjoutes = litresDemandes;

    // 1. Update station
    await stRef.set({
      stockActuel: stockApres,
      derniereModifPar: { uid: decoded.uid, nom: pompisteNom },
      sourceMajAuto: 'modal-bidons-pompiste',
      derniereRedistribution: FieldValue.serverTimestamp()
    }, { merge: true });

    // 2. Audit /redistributions
    await db.collection('redistributions').add({
      station: station.nom || stationId,
      stationId,
      litres: litresAjoutes,
      bidons: nbBidons,
      prixLitre: Number(station.prixLitre || 0),
      montant: 0,                   // pas de vente, juste ravitaillement
      stockAvant,
      stockApres,
      source: 'manuel-pompiste',
      pompisteId: decoded.uid,
      pompisteNom,
      timestamp: FieldValue.serverTimestamp()
    });

    // 3. Incremente quota pompiste
    const wId = currentWeekId();
    const docId = `${wId}_${decoded.uid}`;
    await db.collection('quotasPompiste').doc(docId).set({
      semaine: wId,
      employeId: decoded.uid,
      bidons: FieldValue.increment(nbBidons)
    }, { merge: true });

    return res.status(200).json({
      ok: true, bidons: nbBidons, litresAjoutes, stockApres, stockMax
    });
  } catch (err) {
    console.error('[pompisteRavitaillerManuel]', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
});

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
      case 'banque':   csv = await csvBanque();   break;
      default:
        return res.status(400).type('text/plain').send(
          'Type inconnu. Utilise ?type=resume | depenses | ventes | paies | banque');
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

// === Mouvements bancaires LTD (entrées + sorties combinées) ===
// Combine /banqueLtd (entrées xbankaccount) + /depenses (sorties #depenses)
// Triées par timestamp décroissant. Permet à l'audit IRS de voir TOUS les
// mouvements du compte LTD chronologiquement avec le solde après chaque op.
async function csvBanque() {
  const lines = [csvRow(
    'Date', 'Type', 'Montant', 'Solde avant', 'Solde après', 'Raison', 'Utilisateur', 'Source'
  )];

  // Lire les 2 sources en parallèle
  const [banqueSnap, depensesSnap] = await Promise.all([
    db.collection('banqueLtd').orderBy('timestamp', 'desc').limit(1500).get(),
    db.collection('depenses').orderBy('timestamp', 'desc').limit(500).get()
  ]);

  // Combine en un tableau unifié
  const ops = [];
  for (const d of banqueSnap.docs) {
    const x = d.data();
    if (!x.timestamp) continue;
    ops.push({
      timestamp: x.timestamp,
      type: x.type === 'remove' ? 'Sortie' : 'Entrée',
      montant: Number(x.montant) || 0,
      soldeAvant: Number(x.soldeAvant) || 0,
      soldeApres: Number(x.soldeApres) || 0,
      raison: x.raison || '',
      utilisateur: '',
      source: 'xbankaccount'
    });
  }
  for (const d of depensesSnap.docs) {
    const x = d.data();
    if (!x.timestamp) continue;
    ops.push({
      timestamp: x.timestamp,
      type: 'Sortie',
      montant: Number(x.montant) || 0,
      soldeAvant: Number(x.soldeAvant) || 0,
      soldeApres: Number(x.soldeApres) || 0,
      raison: x.raison || '',
      utilisateur: x.utilisateur || '',
      source: 'depense'
    });
  }

  // Tri chronologique décroissant
  ops.sort((a, b) => {
    const ta = a.timestamp.toMillis ? a.timestamp.toMillis() : 0;
    const tb = b.timestamp.toMillis ? b.timestamp.toMillis() : 0;
    return tb - ta;
  });

  // Génère le CSV (limite à 2000 pour la perf)
  for (const op of ops.slice(0, 2000)) {
    lines.push(csvRow(
      dateIso(op.timestamp),
      op.type,
      op.montant,
      op.soldeAvant,
      op.soldeApres,
      op.raison,
      op.utilisateur,
      op.source
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
