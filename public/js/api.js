// ============================================================
// API Firestore — wrapper léger pour le frontend
// ============================================================

import { db } from './firebase-config.js';
import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, Timestamp, writeBatch,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export { Timestamp, serverTimestamp };

// ----- Utilisateurs -----
const MAX_USERS = 200;
export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}
export async function setUserDoc(uid, data) {
  await setDoc(doc(db, 'users', uid), data, { merge: true });
}
export async function listUsers() {
  const snap = await getDocs(query(collection(db, 'users'), orderBy('nom'), limit(MAX_USERS)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export function listenUsers(cb) {
  return onSnapshot(query(collection(db, 'users'), orderBy('nom'), limit(MAX_USERS)), s => {
    cb(s.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
export async function updateUser(uid, patch) {
  await updateDoc(doc(db, 'users', uid), patch);
}
export async function deleteUser(uid) {
  await deleteDoc(doc(db, 'users', uid));
}

// ----- Produits & stocks -----
const MAX_PRODUITS = 500;
export async function listProduits() {
  const snap = await getDocs(query(collection(db, 'produits'), orderBy('nom'), limit(MAX_PRODUITS)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function setProduit(id, data) {
  // Audit trail : si prixAchat ou prixVente change, on log dans /historiquePrix
  if (data.prixAchat != null || data.prixVente != null) {
    const before = await getDoc(doc(db, 'produits', id));
    const beforeData = before.exists() ? before.data() : {};
    const ancien = { prixAchat: beforeData.prixAchat ?? null, prixVente: beforeData.prixVente ?? null };
    const nouveau = {
      prixAchat: data.prixAchat ?? beforeData.prixAchat ?? null,
      prixVente: data.prixVente ?? beforeData.prixVente ?? null
    };
    if (ancien.prixAchat !== nouveau.prixAchat || ancien.prixVente !== nouveau.prixVente) {
      await addDoc(collection(db, 'historiquePrix'), {
        produitId: id,
        ancien, nouveau,
        timestamp: serverTimestamp()
      });
    }
  }
  await setDoc(doc(db, 'produits', id), data, { merge: true });
}
export async function listStocks() {
  const snap = await getDocs(collection(db, 'stocks'));
  const map = {};
  snap.docs.forEach(d => { map[d.id] = d.data(); });
  return map;
}
export function listenStocks(cb) {
  return onSnapshot(collection(db, 'stocks'), s => {
    const map = {};
    s.docs.forEach(d => { map[d.id] = d.data(); });
    cb(map);
  });
}
export async function ajusterStock(produitId, delta, raison, parUid) {
  const ref = doc(db, 'stocks', produitId);
  const snap = await getDoc(ref);
  const current = snap.exists() ? (snap.data().quantite || 0) : 0;
  const nouveau = current + delta;
  await setDoc(ref, {
    quantite: nouveau,
    derniereMaj: serverTimestamp(),
    par: parUid
  }, { merge: true });
  await addDoc(collection(db, 'mouvementsStock'), {
    type: 'ajustement-manuel',
    item: produitId,
    quantite: delta,
    par: parUid,
    raison: raison || '',
    timestamp: serverTimestamp()
  });
}

// ----- Ventes -----
export async function listVentesSemaine(dateDebut, dateFin) {
  const q = query(collection(db, 'ventes'),
    where('timestamp', '>=', Timestamp.fromDate(dateDebut)),
    where('timestamp', '<=', Timestamp.fromDate(dateFin)),
    orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export function listenVentesSemaine(dateDebut, dateFin, cb) {
  const q = query(collection(db, 'ventes'),
    where('timestamp', '>=', Timestamp.fromDate(dateDebut)),
    where('timestamp', '<=', Timestamp.fromDate(dateFin)),
    orderBy('timestamp', 'desc'));
  return onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
}

// ----- Mouvements de stock -----
export async function listMouvementsRecents(n = 50) {
  const q = query(collection(db, 'mouvementsStock'),
    orderBy('timestamp', 'desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ----- Stations essence -----
export async function listStations() {
  const snap = await getDocs(query(collection(db, 'stations'), orderBy('nom')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export function listenStations(cb) {
  return onSnapshot(query(collection(db, 'stations'), orderBy('nom')), s => {
    cb(s.docs.map(d => ({ id: d.id, ...d.data() })));
  });
}
export async function setStation(id, data) {
  await setDoc(doc(db, 'stations', id), data, { merge: true });
}

// ----- Redistributions essence -----
export async function listRedistributionsSemaine(dateDebut, dateFin) {
  const q = query(collection(db, 'redistributions'),
    where('timestamp', '>=', Timestamp.fromDate(dateDebut)),
    where('timestamp', '<=', Timestamp.fromDate(dateFin)),
    orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ----- Services (heures travail) -----
export async function listServicesSemaine(dateDebut, dateFin) {
  const q = query(collection(db, 'services'),
    where('debut', '>=', Timestamp.fromDate(dateDebut)),
    where('debut', '<=', Timestamp.fromDate(dateFin)),
    orderBy('debut', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ----- Quotas pompistes -----
export async function getQuotaPompiste(employeId, weekId) {
  const snap = await getDoc(doc(db, 'quotasPompiste', `${weekId}_${employeId}`));
  return snap.exists() ? snap.data() : { bidons: 0, caoutchoucs: 0 };
}
export async function listQuotasSemaine(weekId) {
  const snap = await getDocs(query(collection(db, 'quotasPompiste'),
    where('semaine', '==', weekId)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ----- Dépenses -----
export async function listDepensesSemaine(dateDebut, dateFin) {
  const q = query(collection(db, 'depenses'),
    where('timestamp', '>=', Timestamp.fromDate(dateDebut)),
    where('timestamp', '<=', Timestamp.fromDate(dateFin)),
    orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function ajouterDepense(data) {
  await addDoc(collection(db, 'depenses'), {
    ...data,
    timestamp: serverTimestamp()
  });
}

// Solde temps réel du compte bancaire LTD.
// 2 sources combinées :
//   1. /banqueLtd : transactions xbankaccount (entrées + sorties FiveM)
//   2. /depenses  : sorties via #depenses (peut contenir aussi un soldeApres)
// On retourne la plus récente des 2, car la vérité c'est "le dernier mouvement
// quel qu'il soit". Avec banqueLtd actif, on aura la précision la plus fine.
export async function getDernierSoldeBanque() {
  // Helper : extrait le doc le plus récent avec soldeApres valide
  async function lireDerniereSource(coll) {
    const q = query(collection(db, coll), orderBy('timestamp', 'desc'), limit(10));
    const snap = await getDocs(q);
    for (const d of snap.docs) {
      const data = d.data();
      if (data.soldeApres != null && data.soldeApres !== '' && Number.isFinite(Number(data.soldeApres))) {
        return {
          solde: Number(data.soldeApres),
          timestamp: data.timestamp,
          raison: data.raison || '',
          source: coll,
          type: data.type || ''
        };
      }
    }
    return null;
  }

  const [banque, depense] = await Promise.all([
    lireDerniereSource('banqueLtd').catch(() => null),
    lireDerniereSource('depenses').catch(() => null)
  ]);

  // Garder la plus récente des 2
  if (!banque) return depense;
  if (!depense) return banque;
  const tsBanque  = banque.timestamp?.toMillis ? banque.timestamp.toMillis() : 0;
  const tsDepense = depense.timestamp?.toMillis ? depense.timestamp.toMillis() : 0;
  return tsBanque >= tsDepense ? banque : depense;
}

// Historique complet des mouvements bancaires LTD (pour audit IRS)
export async function listMouvementsBanqueRecents(n = 50) {
  const q = query(collection(db, 'banqueLtd'), orderBy('timestamp', 'desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Liste tous les noms d'items uniques vus dans /mouvementsStock (outil de découverte
// pour aider au mapping nom FiveM → catalogue commercial). Les noms sont déjà
// agrégés et comptés (combien de fois vu, premier passage, dernier passage).
export async function listItemsFiveMUniques(maxLignes = 2000) {
  const q = query(
    collection(db, 'mouvementsStock'),
    orderBy('timestamp', 'desc'),
    limit(maxLignes)
  );
  const snap = await getDocs(q);
  const map = {}; // nomBrut -> { count, premierVu, dernierVu, slug, exemple }
  for (const d of snap.docs) {
    const data = d.data();
    const nomBrut = data.itemNom || data.item || '';
    if (!nomBrut) continue;
    if (!map[nomBrut]) {
      map[nomBrut] = {
        nomFivem: nomBrut,
        slug: data.item || '',
        count: 0,
        premierVu: data.timestamp,
        dernierVu: data.timestamp,
        exempleSource: data.source || '',
        exempleQuantite: data.quantite || 0
      };
    }
    map[nomBrut].count++;
    // Update bornes (timestamp desc → premier doc = plus récent)
    if (data.timestamp) {
      if (!map[nomBrut].dernierVu || data.timestamp.toMillis?.() > map[nomBrut].dernierVu.toMillis?.()) {
        map[nomBrut].dernierVu = data.timestamp;
      }
      if (!map[nomBrut].premierVu || data.timestamp.toMillis?.() < map[nomBrut].premierVu.toMillis?.()) {
        map[nomBrut].premierVu = data.timestamp;
      }
    }
  }
  // Convertit en array trié par fréquence décroissante
  return Object.values(map).sort((a, b) => b.count - a.count);
}

// ----- Paies -----
export async function listPaiesSemaine(dateDebut, dateFin) {
  const q = query(collection(db, 'paies'),
    where('timestamp', '>=', Timestamp.fromDate(dateDebut)),
    where('timestamp', '<=', Timestamp.fromDate(dateFin)),
    orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// Paies reçues par UN employé (utilisé par /paies.html)
export async function listMesPaies(uid, n = 100) {
  const q = query(collection(db, 'paies'),
    where('beneficiaireId', '==', uid),
    orderBy('timestamp', 'desc'),
    limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ----- Semaines (clôturées) -----
export async function listSemaines(n = 6) {
  const q = query(collection(db, 'semaines'),
    orderBy('dateDebut', 'desc'), limit(n));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}
export async function getSemaineCourante(weekId) {
  const snap = await getDoc(doc(db, 'semaines', weekId));
  return snap.exists() ? snap.data() : null;
}

// ----- Alertes -----
export function listenAlertesActives(cb) {
  const q = query(collection(db, 'alertes'),
    where('resolue', '==', false), orderBy('timestamp', 'desc'));
  return onSnapshot(q, s => cb(s.docs.map(d => ({ id: d.id, ...d.data() }))));
}
export async function resoudreAlerte(id) {
  await updateDoc(doc(db, 'alertes', id), { resolue: true, resolueAt: serverTimestamp() });
}

// ----- Configuration -----
export async function getConfig() {
  const snap = await getDoc(doc(db, 'config', 'global'));
  return snap.exists() ? snap.data() : {
    quotaBidons: 1700,
    quotaCaoutchoucs: 800,
    prixEssence: 5,
    seuilAlerteEssence: 1000
  };
}
export async function setConfig(patch) {
  await setDoc(doc(db, 'config', 'global'), patch, { merge: true });
}

// ----- Secrets (tokens, accessibles direction uniquement via rules) -----
export async function getSecrets() {
  const snap = await getDoc(doc(db, 'config', 'secrets'));
  return snap.exists() ? snap.data() : {};
}
export async function setSecrets(patch) {
  await setDoc(doc(db, 'config', 'secrets'), patch, { merge: true });
}

// ----- Helpers d'écriture brute -----
export {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit, onSnapshot, writeBatch
};
