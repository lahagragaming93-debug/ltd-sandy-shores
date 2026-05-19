// ============================================================
// Calcul des paies — version backend (ESM)
// ============================================================
// Miroir backend de public/js/utils/paie.js et public/js/utils/permissions.js.
// Utilisée par snapshotPaiesEstimees (figeage des estimations à la cloture)
// et par le script de backfill W18.
//
// DECISION DESIGN (2026-05-18) :
//  - Duplication pragmatique de la logique de calcul (pas de bundling shared).
//  - Si tu modifies les commissions / plafonds / formules ici, mets a jour
//    public/js/utils/paie.js et public/js/utils/permissions.js en parallele.
//  - Tests d'integration : le script scripts/backfill-snapshot-paies-w18.mjs
//    compare la valeur calculee avec celle affichee sur /rh (semaine en
//    cours) pour s'assurer qu'on n'a pas dérivé.
// ============================================================

// === Plafonds salaire (TTE Chap. IV - Secteur 2) ===
export const PLAFOND_SALAIRE = {
  'patron':                   20000,
  'co-patron':                20000,
  'drh':                      18000,
  'responsable-vente':        17000,
  'responsable-pompiste':     17000,
  'vendeur-novice':           13000,
  'vendeur-intermediaire':    14000,
  'vendeur-experimente':      15000,
  'pompiste-novice':          13000,
  'pompiste-intermediaire':   14000,
  'pompiste-experimente':     15000,
  'admin-technique':          0
};

export const DRH_SALAIRE_FIXE = 18000;
export const CA_PLAFOND_RESP_VENTE = 40000;
export const CA_PLAFOND_VENDEUR = 40000;

export const COMMISSION_VENDEUR = {
  'vendeur-novice':         0.325,
  'vendeur-intermediaire':  0.350,
  'vendeur-experimente':    0.375
};

const DIRECTION = ['patron', 'co-patron'];
const SUPER_ADMINS = ['admin-technique'];
const VENDEURS = ['vendeur-novice', 'vendeur-intermediaire', 'vendeur-experimente'];
const POMPISTES = ['pompiste-novice', 'pompiste-intermediaire', 'pompiste-experimente'];

export function isVendeur(role)      { return VENDEURS.includes(role); }
export function isPompiste(role)     { return POMPISTES.includes(role); }
export function isResponsable(role)  { return role === 'responsable-vente' || role === 'responsable-pompiste'; }
export function isDirection(role)    { return DIRECTION.includes(role); }
export function isSuperAdmin(role)   { return SUPER_ADMINS.includes(role); }
// admin-technique exclu des calculs financiers (cf. permissions.js)
export function compteEnFinance(role) { return !isSuperAdmin(role); }

// ============================================================
// Formules salaire
// ============================================================

function salaireVendeur(role, caGenere) {
  if (!isVendeur(role)) return 0;
  const commission = COMMISSION_VENDEUR[role] ?? 0;
  const plafondSalaire = PLAFOND_SALAIRE[role] ?? 0;
  const caRetenu = Math.min(caGenere || 0, CA_PLAFOND_VENDEUR);
  const brut = caRetenu * commission;
  return Math.min(Math.round(brut), plafondSalaire);
}

function salairePompiste(role, bidons, caoutchoucs, quotaBidons = 1700, quotaCaoutchoucs = 800) {
  if (!isPompiste(role)) return 0;
  const plafond = PLAFOND_SALAIRE[role] ?? 0;
  // Quota a 0 = dimension desactivee. Le plafond se redistribue sur les
  // dimensions actives uniquement. Si toutes a 0 : salaire = 0.
  const scores = [];
  if (quotaBidons > 0)      scores.push(Math.min(1, (bidons      ?? 0) / quotaBidons));
  if (quotaCaoutchoucs > 0) scores.push(Math.min(1, (caoutchoucs ?? 0) / quotaCaoutchoucs));
  if (scores.length === 0) return 0;
  const moyenne = scores.reduce((s, x) => s + x, 0) / scores.length;
  return Math.round(moyenne * plafond);
}

function salaireResponsableVente(caGenere) {
  const plafond = PLAFOND_SALAIRE['responsable-vente'] ?? 17000;
  const ratio = Math.min(1, (caGenere || 0) / CA_PLAFOND_RESP_VENTE);
  return Math.min(Math.round(ratio * plafond), plafond);
}

function salaireResponsablePompiste(salaireDecide) {
  const plafond = PLAFOND_SALAIRE['responsable-pompiste'] ?? 17000;
  const v = (salaireDecide != null && salaireDecide > 0) ? salaireDecide : plafond;
  return Math.min(Math.round(v), plafond);
}

function salaireDirection(role, salaireDecide) {
  if (role === 'drh') return DRH_SALAIRE_FIXE;
  if (!isDirection(role)) return 0;
  const plafond = PLAFOND_SALAIRE[role] ?? 0;
  const v = (salaireDecide != null && salaireDecide > 0) ? salaireDecide : plafond;
  return Math.min(Math.round(v), plafond);
}

// ============================================================
// API publique : calculerPaieEstimee
// ============================================================
//
// Calcule l'estimation hebdomadaire pour UN utilisateur.
//
// Inputs :
//  - user             : { id, role, prenom, nom, salaireDecide?, statut? }
//  - ventes           : Array<{ vendeurId, montant, montantParticulier?, benefice? }>
//                       deja filtre (cachee:false). Caller responsable du filtre.
//  - redistributions  : Array<{ ... }> (CA carburant — pas utilise pour les
//                       individus actuellement, mais accepte pour signature
//                       stable / extensions futures).
//  - quota            : { bidons, caoutchoucs } - quota pompiste de la semaine
//  - cfg              : { quotaBidons, quotaCaoutchoucs }
//
// Retourne :
//  {
//    montantEstime,    // $ a verser
//    ca,               // CA total de ses ventes
//    caParticulier,    // sous-total particulier (commissionnable)
//    bidons,           // quota pompiste rempli
//    caoutchoucs,      // quota pompiste rempli
//    formule           // libelle court de la formule appliquee (pour audit)
//  }
//
// Conventions :
//  - admin-technique : montantEstime = 0 (rôle technique non rémunéré).
//  - role inconnu    : montantEstime = 0.
//  - direction & responsable-pompiste : fallback sur PLAFOND si salaireDecide
//    null/0 (sinon ils n'apparaissent pas dans la masse salariale).
// ============================================================
export function calculerPaieEstimee({ user, ventes = [], redistributions = [], quota = null, cfg = {} } = {}) {
  if (!user) return { montantEstime: 0, ca: 0, caParticulier: 0, bidons: 0, caoutchoucs: 0, formule: 'no-user' };

  const role = user.role || '';
  const quotaBidons = cfg.quotaBidons ?? 1700;
  const quotaCaoutchoucs = cfg.quotaCaoutchoucs ?? 800;

  // CA personnel = ventes attribuees a cet utilisateur
  const myVentes = ventes.filter(v => v.vendeurId === user.id);
  const ca = myVentes.reduce((s, v) => s + (Number(v.montant) || 0), 0);
  const caParticulier = myVentes.reduce(
    (s, v) => s + (v.montantParticulier ?? v.montant ?? 0), 0
  );

  // Quota pompiste
  const bidons = quota?.bidons || 0;
  const caoutchoucs = quota?.caoutchoucs || 0;

  let montantEstime = 0;
  let formule = '';

  if (isVendeur(role)) {
    montantEstime = salaireVendeur(role, caParticulier);
    formule = `vendeur (CA particulier × commission)`;
  } else if (isPompiste(role)) {
    montantEstime = salairePompiste(role, bidons, caoutchoucs, quotaBidons, quotaCaoutchoucs);
    formule = `pompiste (moyenne quota bidons/caoutchoucs)`;
  } else if (role === 'responsable-vente') {
    montantEstime = salaireResponsableVente(caParticulier);
    formule = `responsable-vente ((CA / 40000) × 17000)`;
  } else if (role === 'responsable-pompiste') {
    montantEstime = salaireResponsablePompiste(user.salaireDecide);
    formule = `responsable-pompiste (salaire decide ou plafond)`;
  } else if (role === 'drh') {
    montantEstime = DRH_SALAIRE_FIXE;
    formule = `drh (fixe 18 000)`;
  } else if (isDirection(role)) {
    montantEstime = salaireDirection(role, user.salaireDecide);
    formule = `direction (salaire decide ou plafond)`;
  } else if (isSuperAdmin(role)) {
    montantEstime = 0;
    formule = `admin-technique (non remunere)`;
  } else {
    montantEstime = 0;
    formule = `role-inconnu:${role}`;
  }

  return {
    montantEstime,
    ca,
    caParticulier,
    bidons,
    caoutchoucs,
    formule
  };
}

// ============================================================
// snapshotPaiesEstimees — appele a la cloture (manuelle ou cron)
// ============================================================
//
// Cree un doc /paiesEstimees/{weekKey}_{userId} par utilisateur actif au
// moment de la cloture, avec son estimation figee.
//
// Inputs :
//   - db          : Firestore admin instance
//   - FieldValue  : firestore.FieldValue (pour serverTimestamp)
//   - Timestamp   : firestore.Timestamp (pour les bornes de date)
//   - weekKey     : string YYYY-MM-DD (lundi de la semaine cloturee)
//   - debut, fin  : Date (bornes UTC de la semaine cloturee)
//
// Sortie :
//   { created, skipped, errors, total } : compteurs (pour log)
//
// Garanties :
//   - Idempotent : id deterministe {weekKey}_{userId}, skip si exists.
//   - Inclut TOUS les users actifs ayant compteEnFinance(role) (exclut
//     admin-technique, qui touche 0).
//   - Plante en silence si un user pose probleme : on log et on continue,
//     l'objectif est de NE PAS faire echouer la cloture.
// ============================================================
export async function snapshotPaiesEstimees({ db, FieldValue, Timestamp, weekKey, debut, fin }) {
  const result = { weekKey, created: 0, skipped: 0, errors: 0, total: 0 };

  if (!db || !FieldValue || !Timestamp) {
    console.error('[snapshotPaiesEstimees] arguments manquants', { hasDb: !!db });
    return result;
  }
  if (!weekKey || !debut || !fin) {
    console.error('[snapshotPaiesEstimees] weekKey/debut/fin requis', { weekKey });
    return result;
  }

  try {
    const [usersSnap, ventesSnap, quotasSnap, cfgSnap, redistSnap] = await Promise.all([
      db.collection('users').where('statut', '==', 'actif').get(),
      db.collection('ventes')
        .where('timestamp', '>=', Timestamp.fromDate(debut))
        .where('timestamp', '<=', Timestamp.fromDate(fin)).get(),
      db.collection('quotasPompiste').where('semaine', '==', weekKey).get(),
      db.collection('config').doc('global').get(),
      db.collection('redistributions')
        .where('timestamp', '>=', Timestamp.fromDate(debut))
        .where('timestamp', '<=', Timestamp.fromDate(fin)).get()
    ]);

    // Filtre les ventes "cachees" (doublons bot vs manuelle) cote serveur.
    const ventes = ventesSnap.docs.map(d => ({ id: d.id, ...d.data() })).filter(v => !v.cachee);
    const redistributions = redistSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const quotaByUser = {};
    quotasSnap.docs.forEach(d => {
      const q = d.data();
      if (q.employeId) quotaByUser[q.employeId] = q;
    });
    const cfg = cfgSnap.exists ? cfgSnap.data() : {};

    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .filter(u => compteEnFinance(u.role || ''));
    result.total = users.length;

    for (const user of users) {
      try {
        const snapId = `${weekKey}_${user.id}`;
        const ref = db.collection('paiesEstimees').doc(snapId);
        const existing = await ref.get();
        if (existing.exists) {
          result.skipped++;
          continue;
        }

        const calc = calculerPaieEstimee({
          user,
          ventes,
          redistributions,
          quota: quotaByUser[user.id] || null,
          cfg
        });

        await ref.set({
          userId: user.id,
          weekKey,
          role: user.role || '',
          prenom: user.prenom || '',
          nom: user.nom || '',
          idDiscord: user.idDiscord || '',
          montantEstime: calc.montantEstime,
          ca: calc.ca,
          caParticulier: calc.caParticulier,
          bidons: calc.bidons,
          caoutchoucs: calc.caoutchoucs,
          formule: calc.formule,
          paye: false,
          datePaiement: null,
          paieMatcheeId: null,
          paieMatcheeMontant: null,
          dateDebutSemaine: Timestamp.fromDate(debut),
          dateFinSemaine: Timestamp.fromDate(fin),
          createdAt: FieldValue.serverTimestamp()
        });
        result.created++;
      } catch (errUser) {
        result.errors++;
        console.error('[snapshotPaiesEstimees] erreur user', user.id, errUser?.message || errUser);
      }
    }

    console.log('[snapshotPaiesEstimees] OK', result);
    return result;
  } catch (err) {
    console.error('[snapshotPaiesEstimees] erreur globale', err?.message || err);
    result.errors++;
    return result;
  }
}
