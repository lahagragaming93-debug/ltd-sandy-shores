/**
 * LTD Sandy Shores — point d'entree du Worker Cloudflare.
 *
 * Adapte du Worker BLA (BLA-Corporate/cloudflare/src/index.js), qui tourne en
 * production. Ce fichier ne contient AUCUNE regle du cabinet ni de LTD : les
 * ~6000 lignes de firebase/functions/index.js (+ lib/ + parsers/) sont
 * importees telles quelles. Le jour ou la facturation Google redemarre, ce
 * dossier se jette et le code metier repart sur Cloud Functions.
 *
 * Ce fichier fait quatre choses :
 *   1. il traduit une Request Cloudflare en couple (req, res) a la maniere
 *      d'Express, la seule chose que le code metier connaisse ;
 *   2. il pose les en-tetes CORS que l'infrastructure Cloud Functions posait
 *      quand une fonction declarait `cors: true` ;
 *   3. il route /<nom> (ou /api/<nom>) vers la bonne fonction ;
 *   4. il declenche les taches planifiees a l'heure de Paris.
 *
 * DIFFERENCES avec le Worker BLA, toutes mesurees sur le depot LTD :
 *   - le module metier est en ESM (« type: module ») : pas de mod.default ;
 *   - six exports sont des declencheurs Firestore (onDocumentCreated /
 *     onDocumentWritten). Un Worker ne peut pas ecouter Firestore : ils sont
 *     charges (le module en a besoin pour s'evaluer) mais jamais declenches.
 *     Liste et consequences dans DEPLOIEMENT.md ;
 *   - aucune fonction puppeteer : la table ECARTEES est vide ;
 *   - aucun alias de chemin : les portails LTD appellent les fonctions par
 *     leur nom exact (URL cloudfunctions.net / run.app), la conversion
 *     camelCase <-> kebab-case du routeur suffit.
 */

import ff from '../../../cloudflare/shim/firebase-functions.js';
import admin from '../../../cloudflare/shim/firebase-admin.js';

// ============================================================
// 1. Chargement PARESSEUX du module metier
// ============================================================
// Le code LTD ne lit aucun process.env au chargement (verifie, contrairement au
// depot BLA), mais on garde le chargement paresseux : `env` n'existe pas au
// moment ou les modules sont evalues, et defineSecret(...).value() doit lire
// l'environnement de la requete. ff._setEnv(env) est pose AVANT le premier
// import, et l'import est mis en cache.

let _metier = null;
let _chargement = null;

async function chargerMetier(env) {
  ff._setEnv(env);
  admin.__configure(env);

  if (_metier) return _metier;
  if (!_chargement) {
    _chargement = (async function () {
      const mod = await import('../../firebase/functions/index.js');
      // Module ESM : les exports nommes sont sur l'espace de noms lui-meme.
      const m = (mod && mod.default) ? mod.default : mod;
      // Les taches planifiees passent un handler ANONYME : on leur rend le nom
      // sous lequel elles sont exportees, par identite de fonction.
      ff._nommerPlanifiees(m);
      _metier = m;
      return m;
    })();
  }
  return await _chargement;
}

// ============================================================
// 2. Fonctions ECARTEES
// ============================================================
// Aucune : le depot LTD n'importe ni puppeteer ni chromium (verifie). La table
// reste pour que le routeur garde la meme forme que le Worker BLA.

const ECARTEES = {};

const MESSAGE_ECARTEE =
  'Cette fonction reste indisponible : %s repose sur un outil que ' +
  'l\'hebergement actuel ne peut pas faire tourner. Les chiffres eux-memes ne ' +
  'sont pas affectes.';

// ============================================================
// 3. Alias de chemin
// ============================================================
// Aucun : pas de rewrite Firebase Hosting cote LTD, les appels visaient les
// adresses nues des fonctions. Le nom exact (et sa forme kebab-case) est deja
// une route.

const ALIAS = {};

/** dashboardKeepAlive -> dashboard-keep-alive */
function versKebab(nom) {
  return String(nom).replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

// ============================================================
// 4. Adaptateur Express : la Request Cloudflare -> req
// ============================================================
// Releve des usages sur le depot LTD (index.js) :
//   req.method (24) · req.body (22) · req.get (21) · req.query (4)
// Aucun req.path, req.params, req.ip, req.headers direct. La surface est
// reproduite entierement (copie du Worker BLA), pas approximee.

/** Cles interdites : `query['__proto__'] = x` empoisonnerait le prototype. */
const CLES_INTERDITES = { '__proto__': 1, 'constructor': 1, 'prototype': 1 };

function lireQuery(url) {
  const q = {};
  for (const [cle, val] of url.searchParams) {
    if (CLES_INTERDITES[cle]) continue;
    if (Object.prototype.hasOwnProperty.call(q, cle)) {
      if (Array.isArray(q[cle])) q[cle].push(val);
      else q[cle] = [q[cle], val];
    } else {
      q[cle] = val;
    }
  }
  return q;
}

/**
 * Analyse du corps, a l'identique du functions-framework de Google :
 *   application/json (et +json)          -> objet
 *   application/x-www-form-urlencoded    -> objet
 *   text/*                               -> chaine
 *   tout le reste, Content-Type absent   -> Buffer brut
 *   corps vide                           -> {}
 */
function lireCorps(octets, typeContenu) {
  if (!octets || octets.byteLength === 0) return { valeur: {}, erreur: null };
  const type = String(typeContenu || '').split(';')[0].trim().toLowerCase();

  if (type === 'application/json' || /\+json$/.test(type)) {
    const txt = new TextDecoder().decode(octets);
    if (!txt.trim()) return { valeur: {}, erreur: null };
    try { return { valeur: JSON.parse(txt), erreur: null }; }
    catch (e) { return { valeur: null, erreur: 'JSON invalide : ' + (e && e.message ? e.message : 'analyse impossible') }; }
  }

  if (type === 'application/x-www-form-urlencoded') {
    const p = new URLSearchParams(new TextDecoder().decode(octets));
    const o = {};
    for (const [cle, val] of p) { if (!CLES_INTERDITES[cle]) o[cle] = val; }
    return { valeur: o, erreur: null };
  }

  if (type.indexOf('text/') === 0) {
    return { valeur: new TextDecoder().decode(octets), erreur: null };
  }

  return { valeur: Buffer.from(octets), erreur: null };
}

async function adapterRequete(request, url, cheminRestant) {
  const entetes = {};
  // Express met toutes les cles d'en-tete en minuscules ; req.get normalise.
  for (const [cle, val] of request.headers) entetes[cle.toLowerCase()] = val;

  const octets = (request.method === 'GET' || request.method === 'HEAD')
    ? null
    : await request.arrayBuffer();
  const corps = lireCorps(octets, entetes['content-type']);

  const req = {
    method: request.method,
    path: cheminRestant || '/',
    url: url.pathname + url.search,
    originalUrl: url.pathname + url.search,
    baseUrl: '',
    query: lireQuery(url),
    headers: entetes,
    body: corps.valeur,
    rawBody: octets ? Buffer.from(octets) : Buffer.alloc(0),
    ip: entetes['cf-connecting-ip'] || '',
    protocol: url.protocol.replace(':', ''),
    secure: url.protocol === 'https:',
    hostname: url.hostname,
    get: function (nom) {
      if (!nom) return undefined;
      const n = String(nom).toLowerCase();
      if (n === 'referer' || n === 'referrer') return entetes['referer'] || entetes['referrer'];
      return entetes[n];
    }
  };
  req.header = req.get;
  return { req: req, erreurCorps: corps.erreur };
}

// ============================================================
// 5. Adaptateur Express : res -> Response
// ============================================================
// Releve des appels du depot LTD : res.status (238) · res.json (5, plus les
// chaines .status().json()) · res.set (4) · res.send (1) · res.type (1).
// Copie exacte du Worker BLA, qui couvre tout cela.

function creerRes() {
  const etat = {
    statut: 200,
    entetes: new Headers(),
    corps: null,
    envoye: false
  };

  function poserEntete(cle, valeur) {
    if (valeur === undefined || valeur === null) return;
    etat.entetes.set(String(cle), String(valeur));
  }

  function finir(corps, typeParDefaut) {
    if (etat.envoye) {
      console.warn('[worker] reponse deja envoyee, second envoi ignore');
      return;
    }
    etat.envoye = true;
    if (typeParDefaut && !etat.entetes.has('content-type')) {
      etat.entetes.set('Content-Type', typeParDefaut);
    }
    etat.corps = corps;
  }

  const res = {
    status: function (n) { etat.statut = Number(n) || 200; return res; },
    sendStatus: function (n) { res.status(n); finir(String(n), 'text/plain; charset=utf-8'); return res; },
    json: function (obj) {
      finir(JSON.stringify(obj === undefined ? null : obj), 'application/json; charset=utf-8');
      return res;
    },
    send: function (corps) {
      if (corps === undefined || corps === null) { finir('', 'text/html; charset=utf-8'); return res; }
      if (typeof corps === 'string') { finir(corps, 'text/html; charset=utf-8'); return res; }
      if (corps instanceof Uint8Array || corps instanceof ArrayBuffer) {
        finir(corps, 'application/octet-stream');
        return res;
      }
      return res.json(corps);
    },
    end: function (corps) {
      if (corps === undefined || corps === null) { finir(null, null); return res; }
      if (typeof corps === 'string') { finir(corps, null); return res; }
      finir(corps, null);
      return res;
    },
    set: function (cle, valeur) {
      if (cle && typeof cle === 'object') {
        for (const k of Object.keys(cle)) poserEntete(k, cle[k]);
      } else {
        poserEntete(cle, valeur);
      }
      return res;
    },
    type: function (t) {
      const s = String(t || '');
      const table = { json: 'application/json; charset=utf-8', html: 'text/html; charset=utf-8', text: 'text/plain; charset=utf-8', pdf: 'application/pdf', csv: 'text/csv; charset=utf-8' };
      etat.entetes.set('Content-Type', table[s] || (s.indexOf('/') === -1 ? 'application/' + s : s));
      return res;
    },
    get: function (cle) { return etat.entetes.get(String(cle)); }
  };
  res.header = res.set;
  res.setHeader = res.set;
  res.getHeader = res.get;

  return { res: res, etat: etat };
}

/** Construit la Response finale a partir de l'etat accumule. */
function versReponse(etat, entetesCors) {
  if (entetesCors) {
    for (const cle of Object.keys(entetesCors)) etat.entetes.set(cle, entetesCors[cle]);
  }
  return new Response(etat.corps, { status: etat.statut, headers: etat.entetes });
}

// ============================================================
// 6. CORS
// ============================================================
// Sur Cloud Functions, `cors: true` branchait le paquet npm `cors` avec
// `origin: true` : il renvoie l'origine appelante et pose `Vary: Origin`.
// botIngest declare `cors: false` : aucun en-tete, comme avant (webhook
// serveur-a-serveur). Le prevol (OPTIONS) est traite ici, avant le handler,
// comme le faisait le middleware — la branche OPTIONS de logSite n'etait
// jamais atteinte en production et ne le sera pas davantage.

const ENTETES_AUTORISES_DEFAUT =
  'Content-Type, Authorization, X-Bot-Token, X-Requested-With, Accept, Origin';
const METHODES_AUTORISEES = 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS';

function entetesCors(request, optionCors) {
  const origine = request.headers.get('Origin');
  const h = {};

  if (optionCors === true || optionCors === '*') {
    h['Access-Control-Allow-Origin'] = origine || '*';
    if (origine) h['Vary'] = 'Origin';
  } else if (Array.isArray(optionCors)) {
    if (origine && optionCors.indexOf(origine) !== -1) {
      h['Access-Control-Allow-Origin'] = origine;
      h['Vary'] = 'Origin';
    } else {
      return h;
    }
  } else if (typeof optionCors === 'string') {
    h['Access-Control-Allow-Origin'] = optionCors;
    h['Vary'] = 'Origin';
  } else {
    // cors: false ou absent : pas d'en-tete, exactement comme avant.
    return h;
  }

  const demandes = request.headers.get('Access-Control-Request-Headers');
  h['Access-Control-Allow-Methods'] = METHODES_AUTORISEES;
  h['Access-Control-Allow-Headers'] = demandes || ENTETES_AUTORISES_DEFAUT;
  h['Access-Control-Max-Age'] = '3600';
  return h;
}

// ============================================================
// 7. Table de routage, construite depuis les exports du metier
// ============================================================

function construireTable(metier) {
  const http = {};      // nom d'export -> handler
  const parChemin = {}; // segment d'URL -> nom d'export
  let declencheursFirestore = 0;

  for (const cle of Object.keys(metier)) {
    const val = metier[cle];
    if (typeof val !== 'function') continue;
    if (val._type === 'firestore') { declencheursFirestore++; continue; }
    if (val._type !== 'http') continue;   // les planifiees sont traitees ailleurs
    http[cle] = val;
    parChemin[cle.toLowerCase()] = cle;   // /botingest
    parChemin[versKebab(cle)] = cle;      // /bot-ingest
  }
  for (const nom of Object.keys(ECARTEES)) {
    parChemin[nom.toLowerCase()] = nom;
    parChemin[versKebab(nom)] = nom;
  }
  for (const alias of Object.keys(ALIAS)) parChemin[alias] = ALIAS[alias];

  return { http: http, parChemin: parChemin, declencheursFirestore: declencheursFirestore };
}

/**
 * Decoupe /api/<segment>/<reste...> (le prefixe /api/ est facultatif) et rend
 * { nom, cheminRestant }.
 */
function resoudre(pathname, parChemin) {
  let p = pathname.replace(/^\/+/, '');
  if (p.toLowerCase().indexOf('api/') === 0) p = p.slice(4);
  if (!p) return null;

  const segments = p.split('/').filter(Boolean);
  if (!segments.length) return null;

  const premier = decodeURIComponent(segments[0]).toLowerCase();
  const nom = parChemin[premier];
  if (!nom) return null;

  const reste = segments.slice(1).map(function (s) { return decodeURIComponent(s); });
  return { nom: nom, cheminRestant: '/' + reste.join('/') };
}

// ============================================================
// 8. Taches planifiees — UN tic par minute, reparti ici
// ============================================================
// Le plan Workers Free plafonne a 5 expressions cron PAR COMPTE et le Worker
// BLA en consomme deja 4 (mesure au deploiement du 22/08/2026, code d'erreur
// 10072). LTD n'a donc qu'UNE expression : « * * * * * ». Ce repartiteur
// reproduit les sept horaires onSchedule du depot, en heure de Paris, a la
// minute pres.
//
// Les gardes travaillent sur event.scheduledTime — l'heure PREVUE du tic —
// jamais sur l'horloge d'arrivee : un tic peut glisser de quelques secondes
// et franchir la minute, ce qui ferait manquer une cloture.
//
// Regle de budget : quand une tache CALENDAIRE est due (cloture, archivage,
// alertes), elle est lancee SEULE — relaisDiscord saute ce tic-la pour lui
// laisser les 50 sous-requetes de l'invocation. Ses curseurs (relaisEssai/
// _curseurs) reprennent exactement ou ils en etaient au tic suivant : rien
// n'est perdu, tout est decale d'une minute au pire.
//
// verifierSortiesExpirees (minute % 5 == 2) et dashboardKeepAlive
// (minute % 10 == 4) sont dephasees pour ne jamais tomber sur la minute 0 ou 5
// des calendaires ni l'une sur l'autre. Leur logique est une fenetre glissante
// (« plus vieux que 30 minutes », « la cellule A1 a-t-elle bouge »), la phase
// leur est indifferente ; seul l'intervalle declare (5 et 10 minutes) compte,
// et il est respecte.

/** Composantes calendaires de Paris pour un instant donne. */
function parisDe(instantMs) {
  return new Date(new Date(instantMs).toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
}

/** Les taches dues sur ce tic, dans l'ordre de lancement. */
function tachesDues(scheduledTimeMs) {
  const p = parisDe(scheduledTimeMs || Date.now());
  const jour = p.getDay(), heure = p.getHours(), minute = p.getMinutes();

  // Calendaires — jamais deux sur le meme tic (minutes 0 et 5, horaires
  // distincts). Quand l'une est due, elle prend l'invocation entiere.
  if (jour === 1 && heure === 0 && minute === 0) return ['clotureHebdo'];                  // '0 0 * * 1' Paris
  if (jour === 2 && heure === 21 && minute === 5) return ['clotureHebdoPaies'];            // '5 21 * * 2' Paris
  if (jour === 0 && heure === 3 && minute === 0) return ['archiveAncienMouvementsBanque']; // '0 3 * * 0' Paris
  if (heure === 9 && minute === 0) return ['cronAlertesEngagements'];                      // '0 9 * * *' Paris

  const dues = ['relaisDiscord'];                       // « every 1 minutes »
  if (minute % 5 === 2) dues.push('verifierSortiesExpirees');   // « toutes les 5 minutes »
  if (minute % 10 === 4) dues.push('dashboardKeepAlive');       // « every 10 minutes »
  return dues;
}

async function lancerTache(metier, nom) {
  const entree = ff._planifiee(nom);
  const handler = entree ? entree.handler : metier[nom];
  if (typeof handler !== 'function') {
    console.error('[cron] tache introuvable : ' + nom);
    return { nom: nom, ok: false, erreur: 'introuvable' };
  }
  const t0 = Date.now();
  try {
    await handler({ scheduleTime: new Date().toISOString(), jobName: nom });
    return { nom: nom, ok: true, ms: Date.now() - t0 };
  } catch (e) {
    console.error('[cron] ' + nom, e);
    return { nom: nom, ok: false, ms: Date.now() - t0, erreur: e && e.message ? e.message : String(e) };
  }
}

// ============================================================
// 9. Reponses de service
// ============================================================

function json(statut, obj, entetes) {
  const h = new Headers(entetes || {});
  h.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(obj), { status: statut, headers: h });
}

// ============================================================
// 10. Le Worker
// ============================================================

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    let metier;
    try {
      metier = await chargerMetier(env);
    } catch (e) {
      console.error('[worker] chargement du module metier', e);
      return json(500, {
        ok: false,
        error: 'Le service n\'a pas pu demarrer. Le cabinet a ete prevenu.',
        detail: e && e.message ? e.message : String(e)
      });
    }

    const table = construireTable(metier);

    // --- racine : signe de vie.
    if (url.pathname === '/' || url.pathname === '/api' || url.pathname === '/api/') {
      return json(200, {
        ok: true,
        service: 'ltd-sandy-api',
        fonctions: Object.keys(table.http).length,
        planifiees: ff._planifiees.length,
        declencheursFirestoreInertes: table.declencheursFirestore
      });
    }

    // --- declenchement manuel d'une tache planifiee, sous jeton.
    if (url.pathname.indexOf('/__cron/') === 0) {
      const attendu = env && env.CRON_TOKEN;
      if (!attendu) return json(503, { ok: false, error: 'Declenchement manuel non configure (secret CRON_TOKEN absent).' });
      const fourni = request.headers.get('X-Cron-Token') || url.searchParams.get('token') || '';
      if (fourni !== attendu) return json(403, { ok: false, error: 'Jeton invalide.' });
      const nom = url.pathname.slice('/__cron/'.length).replace(/\/+$/, '');
      const r = await lancerTache(metier, nom);
      return json(r.ok ? 200 : 500, r);
    }

    // --- routage
    const cible = resoudre(url.pathname, table.parChemin);
    if (!cible) {
      return json(404, {
        ok: false,
        error: 'Adresse inconnue : ' + url.pathname + '. Les fonctions repondent sur /<nom> ou /api/<nom>.'
      });
    }

    const handler = table.http[cible.nom];

    // Le CORS se calcule avant tout le reste, y compris avant un refus :
    // sans en-tete, le navigateur bloque la reponse et le message n'atteint
    // jamais l'ecran.
    const optionCors = (handler && handler._options && handler._options.cors !== undefined)
      ? handler._options.cors
      : undefined;
    const cors = entetesCors(request, optionCors);

    // Prevol : traite ici, avant le code metier, comme le faisait Cloud Functions.
    if (request.method === 'OPTIONS') {
      const h = new Headers(cors);
      h.set('Content-Length', '0');
      return new Response(null, { status: 204, headers: h });
    }

    if (ECARTEES[cible.nom]) {
      return json(503, {
        ok: false,
        error: MESSAGE_ECARTEE.replace('%s', ECARTEES[cible.nom]),
        fonction: cible.nom
      }, cors);
    }

    if (typeof handler !== 'function') {
      return json(404, { ok: false, error: 'Fonction non exposee : ' + cible.nom }, cors);
    }

    let adapte;
    try {
      adapte = await adapterRequete(request, url, cible.cheminRestant);
    } catch (e) {
      return json(400, { ok: false, error: 'Requete illisible.' }, cors);
    }
    if (adapte.erreurCorps) {
      return json(400, { ok: false, error: adapte.erreurCorps }, cors);
    }

    const { res, etat } = creerRes();
    try {
      await handler(adapte.req, res);
    } catch (e) {
      console.error('[worker] ' + cible.nom, e);
      if (!etat.envoye) {
        return json(500, {
          ok: false,
          error: 'Erreur interne.',
          fonction: cible.nom
        }, cors);
      }
    }

    if (!etat.envoye) {
      console.error('[worker] ' + cible.nom + ' : handler termine sans reponse');
      return json(500, { ok: false, error: 'Aucune reponse produite.', fonction: cible.nom }, cors);
    }

    return versReponse(etat, cors);
  },

  /**
   * Cron. Une seule expression (« * * * * * », voir wrangler.toml : plafond de
   * 5 expressions par COMPTE, dont 4 prises par le Worker BLA). Le repartiteur
   * tachesDues() decide, en heure de Paris et sur l'heure PREVUE du tic, ce
   * qui part reellement.
   */
  async scheduled(event, env, ctx) {
    let metier;
    try {
      metier = await chargerMetier(env);
    } catch (e) {
      console.error('[cron] chargement du module metier', e);
      return;
    }

    const taches = tachesDues(event && event.scheduledTime);
    for (const nom of taches) {
      const r = await lancerTache(metier, nom);
      console.log('[cron] ' + JSON.stringify(r));
    }
  }
};
