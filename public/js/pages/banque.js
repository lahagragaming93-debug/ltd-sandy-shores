// ============================================================
// Page : Banque LTD — historique chronologique des mouvements
// (entrées xbankaccount + sorties #depenses combinées)
// ============================================================

import { requireAuth } from '../auth.js';
import { renderShell } from '../layout.js';
import { listMouvementsBanqueRecents, listDepensesSemaine } from '../api.js';
import { db } from '../firebase-config.js';
import { collection, query, orderBy, limit, getDocs, where, Timestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { money, moneyPrecis, num, datetime, escapeHtml } from '../utils/formatters.js';
import { isDirection, isSuperAdmin } from '../utils/permissions.js';
import { toastError } from '../utils/toast.js';
import { wrapScroll, makeSortable } from '../utils/sortable-table.js';
import { renderPeriodFilter, getPeriode, getPeriodeLabel, attachPeriodFilter } from '../utils/period-filter.js';

const { profile } = await requireAuth('banque');

const html = `
  <div class="kpi-grid" id="kpis-banque">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div class="page-toolbar" style="flex-wrap:wrap;gap:8px;">
    ${renderPeriodFilter('semaine')}
    <select id="filtre-type" title="Filtrer par type de mouvement">
      <option value="">Tous types</option>
      <option value="add">Entrées</option>
      <option value="remove">Sorties</option>
    </select>
    <input type="text" id="filtre-recherche" placeholder="Filtrer par raison…" style="flex:1;min-width:160px;" />
    <button class="btn" id="btn-recharger" title="Recharger les données" data-tooltip="Recharger">Recharger</button>
    <button class="btn" id="btn-export" title="Exporter en CSV" data-tooltip="Export CSV">Exporter CSV</button>
    <span class="spacer"></span>
    <span class="muted mono" id="stats-mvts">—</span>
  </div>

  <div class="panel framed">
    <div class="panel-title">
      <span>Mouvements bancaires LTD</span>
      <span class="muted" style="font-size:0.75rem;">— combinés : xbankaccount + #depenses, ordre chronologique décroissant</span>
    </div>
    <div class="table-scroll">
      <table class="data" id="table-mvts">
        <thead>
          <tr>
            <th data-sort="date">Date</th>
            <th class="center" data-sort="type">Type</th>
            <th class="right" data-sort="montant">Montant</th>
            <th class="right" data-sort="soldeAvant">Solde avant</th>
            <th class="right" data-sort="soldeApres">Solde après</th>
            <th data-sort="raison">Raison</th>
            <th data-sort="source">Source</th>
          </tr>
        </thead>
        <tbody id="tbody-mvts"><tr><td colspan="7" class="muted text-center">Chargement…</td></tr></tbody>
      </table>
    </div>
  </div>
`;
renderShell(profile, 'banque', html);

makeSortable(document.getElementById('table-mvts'));

let mouvements = []; // [{ timestamp, type, montant, soldeAvant, soldeApres, raison, source, utilisateur }, …]
let soldeLive = { montant: 0, date: null }; // toujours le solde courant, indépendant du filtre période

async function chargerTout() {
  const tbody = document.getElementById('tbody-mvts');
  tbody.innerHTML = '<tr><td colspan="7" class="muted text-center">Chargement…</td></tr>';
  try {
    const { debut, fin } = getPeriode();

    // 0. Solde courant = dernier mouvement /banqueLtd quelle que soit la période
    //    (sinon "Solde actuel" deviendrait incohérent quand on filtre une période passée)
    const liveSnap = await getDocs(query(collection(db, 'banqueLtd'), orderBy('timestamp', 'desc'), limit(1)));
    if (!liveSnap.empty) {
      const x = liveSnap.docs[0].data();
      soldeLive = { montant: Number(x.soldeApres) || 0, date: x.timestamp };
    }

    // 1. Lire /banqueLtd filtré par période (ou tout si "Depuis ouverture")
    const banqueQ = (debut && fin)
      ? query(collection(db, 'banqueLtd'),
          where('timestamp', '>=', Timestamp.fromDate(debut)),
          where('timestamp', '<=', Timestamp.fromDate(fin)),
          orderBy('timestamp', 'desc'),
          limit(5000))
      : query(collection(db, 'banqueLtd'), orderBy('timestamp', 'desc'), limit(5000));
    const banqueSnap = await getDocs(banqueQ);
    const banqueOps = banqueSnap.docs.map(d => {
      const x = d.data();
      return {
        id: d.id,
        timestamp: x.timestamp,
        type: x.type === 'remove' ? 'remove' : 'add',
        montant: Number(x.montant) || 0,
        soldeAvant: Number(x.soldeAvant) || 0,
        soldeApres: Number(x.soldeApres) || 0,
        raison: x.raison || '',
        source: 'xbankaccount',
        utilisateur: ''
      };
    });

    // 2. Lire /depenses filtré par période (ou tout si "Depuis ouverture")
    const depQ = (debut && fin)
      ? query(collection(db, 'depenses'),
          where('timestamp', '>=', Timestamp.fromDate(debut)),
          where('timestamp', '<=', Timestamp.fromDate(fin)),
          orderBy('timestamp', 'desc'),
          limit(5000))
      : query(collection(db, 'depenses'), orderBy('timestamp', 'desc'), limit(5000));
    const depSnap = await getDocs(depQ);
    const depOps = depSnap.docs.map(d => {
      const x = d.data();
      return {
        id: d.id,
        timestamp: x.timestamp,
        type: 'remove',
        montant: Number(x.montant) || 0,
        soldeAvant: Number(x.soldeAvant) || 0,
        soldeApres: Number(x.soldeApres) || 0,
        raison: x.raison || '',
        source: 'depense',
        utilisateur: x.utilisateur || ''
      };
    });

    // 3. Déduplication banque ↔ dépenses
    //    FiveM log CHAQUE paiement sur 2 canaux : xbankaccount (#logs-ig →
    //    /banqueLtd) ET #depenses (→ /depenses). Une seule sortie d'argent
    //    réelle = 2 docs Firestore. Sans dédup, totaux × 2.
    //
    //    Stratégie : pour chaque dépense (source=depense), on cherche un
    //    mouvement banqueLtd correspondant (même montant + type=remove +
    //    timestamp à ±120s) et on le retire. On garde la dépense car elle
    //    porte des métadonnées plus riches (raison textuelle, utilisateur,
    //    fournisseur classifié, etc.).
    //
    //    Clé de matching identique à crossRefBanqueDepense() côté Cloud Fn.
    const DEDUP_WINDOW_MS = 120 * 1000;
    const banqueRemovesByMontant = new Map(); // montant → [{ms, op, used}]
    for (const op of banqueOps) {
      if (op.type !== 'remove') continue;
      const ms = op.timestamp?.toMillis ? op.timestamp.toMillis() : 0;
      if (!ms) continue;
      if (!banqueRemovesByMontant.has(op.montant)) banqueRemovesByMontant.set(op.montant, []);
      banqueRemovesByMontant.get(op.montant).push({ ms, op, used: false });
    }
    const idsBanqueADedupliquer = new Set();
    let nbDoublons = 0;
    for (const dep of depOps) {
      const ms = dep.timestamp?.toMillis ? dep.timestamp.toMillis() : 0;
      if (!ms) continue;
      const candidats = banqueRemovesByMontant.get(dep.montant) || [];
      // On prend le candidat libre le plus proche temporellement (< 120s)
      let best = null;
      let bestDelta = Infinity;
      for (const c of candidats) {
        if (c.used) continue;
        const delta = Math.abs(c.ms - ms);
        if (delta <= DEDUP_WINDOW_MS && delta < bestDelta) {
          best = c;
          bestDelta = delta;
        }
      }
      if (best) {
        best.used = true;
        idsBanqueADedupliquer.add(best.op.id);
        nbDoublons++;
      }
    }
    const banqueOpsDedupes = banqueOps.filter(op => !idsBanqueADedupliquer.has(op.id));
    if (nbDoublons > 0) {
      console.log(`[banque] dédup : ${nbDoublons} doublon(s) banqueLtd↔depenses supprimé(s) (${banqueOps.length} banque + ${depOps.length} dép → ${banqueOpsDedupes.length + depOps.length} uniques)`);
    }

    // 4. Combine + tri chronologique
    mouvements = [...banqueOpsDedupes, ...depOps].sort((a, b) => {
      const ta = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
      const tb = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
      return tb - ta;
    });

    rendre();
  } catch (e) {
    console.error(e);
    tbody.innerHTML = `<tr><td colspan="7" class="alert danger">Erreur : ${escapeHtml(e.message || e.code)}</td></tr>`;
  }
}

function rendre() {
  const filtreType = document.getElementById('filtre-type').value;
  const filtreRech = document.getElementById('filtre-recherche').value.toLowerCase().trim();

  let visibles = mouvements;
  if (filtreType) visibles = visibles.filter(m => m.type === filtreType);
  if (filtreRech) visibles = visibles.filter(m => (m.raison || '').toLowerCase().includes(filtreRech));

  // KPIs : "Solde actuel" = live (indépendant du filtre)
  //        "Total entrées / sorties / Net" = sur la période sélectionnée
  const nbAdd    = mouvements.filter(m => m.type === 'add').length;
  const nbRemove = mouvements.filter(m => m.type === 'remove').length;
  const totalEntrees = mouvements.filter(m => m.type === 'add').reduce((s, m) => s + m.montant, 0);
  const totalSorties = mouvements.filter(m => m.type === 'remove').reduce((s, m) => s + m.montant, 0);
  const periodeLabel = getPeriodeLabel();

  document.getElementById('kpis-banque').innerHTML = `
    <div class="kpi kpi-bank">
      <div class="label">Solde actuel</div>
      <div class="value">${money(soldeLive.montant)}</div>
      <div class="delta">au ${escapeHtml(datetime(soldeLive.date) || '—')} · live, indépendant du filtre</div>
    </div>
    <div class="kpi kpi-recette">
      <div class="label">Entrées <span class="muted" style="font-size:0.7rem;">(${escapeHtml(periodeLabel)})</span></div>
      <div class="value">${money(totalEntrees)}</div>
      <div class="delta">${nbAdd} mouvements</div>
    </div>
    <div class="kpi kpi-depense">
      <div class="label">Sorties <span class="muted" style="font-size:0.7rem;">(${escapeHtml(periodeLabel)})</span></div>
      <div class="value">${money(totalSorties)}</div>
      <div class="delta">${nbRemove} mouvements</div>
    </div>
    <div class="kpi ${(totalEntrees - totalSorties) >= 0 ? 'kpi-positive' : 'kpi-negative'}" style="border-color:var(--color-info);">
      <div class="label">Net <span class="muted" style="font-size:0.7rem;">(${escapeHtml(periodeLabel)})</span></div>
      <div class="value">${money(totalEntrees - totalSorties)}</div>
      <div class="delta">entrées − sorties sur la période</div>
    </div>
  `;

  document.getElementById('stats-mvts').textContent =
    `${visibles.length} affichés / ${mouvements.length} mouvements (${escapeHtml(periodeLabel)})`;

  const tbody = document.getElementById('tbody-mvts');
  if (visibles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted text-center">Aucun mouvement ne correspond aux filtres.</td></tr>';
    return;
  }

  tbody.innerHTML = visibles.slice(0, 1000).map(m => {
    const isAdd = m.type === 'add';
    const badge = isAdd
      ? '<span class="badge ok">Entrée</span>'
      : '<span class="badge danger">Sortie</span>';
    const colorMontant = isAdd ? 'color:var(--color-success);' : 'color:var(--color-danger);';
    return `
      <tr>
        <td class="mono" style="font-size:0.78rem;">${escapeHtml(datetime(m.timestamp) || '—')}</td>
        <td class="center">${badge}</td>
        <td class="right mono" style="${colorMontant};font-weight:bold;">${isAdd ? '+' : '−'}${moneyPrecis(m.montant)}</td>
        <td class="right mono muted">${moneyPrecis(m.soldeAvant)}</td>
        <td class="right mono"><strong>${moneyPrecis(m.soldeApres)}</strong></td>
        <td>${escapeHtml(m.raison || '—')}</td>
        <td><span class="badge neutral">${escapeHtml(m.source)}</span></td>
      </tr>
    `;
  }).join('');
}

document.getElementById('btn-recharger').addEventListener('click', chargerTout);
document.getElementById('filtre-type').addEventListener('change', rendre);
document.getElementById('filtre-recherche').addEventListener('input', rendre);
// Recharge depuis Firestore quand la période change (= autres bornes timestamp).
attachPeriodFilter(chargerTout);

document.getElementById('btn-export').addEventListener('click', () => {
  const lines = ['Date;Type;Montant;Solde avant;Solde après;Raison;Source;Utilisateur'];
  for (const m of mouvements) {
    lines.push([
      datetime(m.timestamp) || '',
      m.type === 'add' ? 'Entrée' : 'Sortie',
      m.montant,
      m.soldeAvant,
      m.soldeApres,
      (m.raison || '').replace(/;/g, ','),
      m.source,
      (m.utilisateur || '').replace(/;/g, ',')
    ].join(';'));
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `banque-ltd-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
});

chargerTout();
