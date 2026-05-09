// ============================================================
// Page : Banque LTD — historique chronologique des mouvements
// (entrées xbankaccount + sorties #depenses combinées)
// ============================================================

import { requireAuth } from '../auth.js';
import { renderShell } from '../layout.js';
import { listMouvementsBanqueRecents, listDepensesSemaine } from '../api.js';
import { db } from '../firebase-config.js';
import { collection, query, orderBy, limit, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { money, num, datetime, escapeHtml } from '../utils/formatters.js';
import { isDirection, isSuperAdmin } from '../utils/permissions.js';
import { toastError } from '../utils/toast.js';

const { profile } = await requireAuth('banque');

const html = `
  <div class="kpi-grid" id="kpis-banque">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div class="row mb-2" style="flex-wrap:wrap;gap:8px;">
    <select id="filtre-type">
      <option value="">Tous types</option>
      <option value="add">🟢 Entrées (recettes)</option>
      <option value="remove">🔴 Sorties (dépenses)</option>
    </select>
    <input type="text" id="filtre-recherche" placeholder="Filtrer par raison…" style="flex:1;min-width:200px;" />
    <button class="btn" id="btn-recharger">🔄 Recharger</button>
    <button class="btn" id="btn-export">📥 Export CSV</button>
    <span class="spacer"></span>
    <span class="muted mono" id="stats-mvts">—</span>
  </div>

  <div class="panel framed">
    <div class="panel-title">
      <span>🏦 Mouvements bancaires LTD</span>
      <span class="muted" style="font-size:0.75rem;">— combinés : xbankaccount + #depenses, ordre chronologique décroissant</span>
    </div>
    <table class="data" id="table-mvts">
      <thead>
        <tr>
          <th>Date</th>
          <th class="center">Type</th>
          <th class="right">Montant</th>
          <th class="right">Solde avant</th>
          <th class="right">Solde après</th>
          <th>Raison</th>
          <th>Source</th>
        </tr>
      </thead>
      <tbody id="tbody-mvts"><tr><td colspan="7" class="muted text-center">Chargement…</td></tr></tbody>
    </table>
  </div>
`;
renderShell(profile, 'banque', html);

let mouvements = []; // [{ timestamp, type, montant, soldeAvant, soldeApres, raison, source, utilisateur }, …]

async function chargerTout() {
  const tbody = document.getElementById('tbody-mvts');
  tbody.innerHTML = '<tr><td colspan="7" class="muted text-center">Chargement…</td></tr>';
  try {
    // 1. Lire /banqueLtd (entrées xbankaccount)
    const banqueQ = query(collection(db, 'banqueLtd'), orderBy('timestamp', 'desc'), limit(500));
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

    // 2. Lire /depenses (sorties)
    const depQ = query(collection(db, 'depenses'), orderBy('timestamp', 'desc'), limit(500));
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

    // 3. Combine + tri chronologique
    mouvements = [...banqueOps, ...depOps].sort((a, b) => {
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

  // KPIs
  const totalEntrees = mouvements.filter(m => m.type === 'add').reduce((s, m) => s + m.montant, 0);
  const totalSorties = mouvements.filter(m => m.type === 'remove').reduce((s, m) => s + m.montant, 0);
  const soldeActuel = mouvements[0]?.soldeApres ?? 0;
  const dateSolde = mouvements[0]?.timestamp;

  document.getElementById('kpis-banque').innerHTML = `
    <div class="kpi kpi-recette">
      <div class="label">💰 Solde actuel</div>
      <div class="value">${money(soldeActuel)}</div>
      <div class="delta">au ${escapeHtml(datetime(dateSolde) || '—')}</div>
    </div>
    <div class="kpi" style="border-color:var(--color-success);">
      <div class="label">🟢 Total entrées</div>
      <div class="value">${money(totalEntrees)}</div>
      <div class="delta">${mouvements.filter(m => m.type === 'add').length} mouvements</div>
    </div>
    <div class="kpi kpi-depense">
      <div class="label">🔴 Total sorties</div>
      <div class="value">${money(totalSorties)}</div>
      <div class="delta">${mouvements.filter(m => m.type === 'remove').length} mouvements</div>
    </div>
    <div class="kpi" style="border-color:var(--color-info);">
      <div class="label">📊 Net</div>
      <div class="value">${money(totalEntrees - totalSorties)}</div>
      <div class="delta">entrées − sorties (sur la période chargée)</div>
    </div>
  `;

  document.getElementById('stats-mvts').textContent =
    `${visibles.length} affichés / ${mouvements.length} mouvements (${mouvements.length} max)`;

  const tbody = document.getElementById('tbody-mvts');
  if (visibles.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted text-center">Aucun mouvement ne correspond aux filtres.</td></tr>';
    return;
  }

  tbody.innerHTML = visibles.slice(0, 1000).map(m => {
    const isAdd = m.type === 'add';
    const badge = isAdd
      ? '<span class="badge ok">🟢 Entrée</span>'
      : '<span class="badge danger">🔴 Sortie</span>';
    const colorMontant = isAdd ? 'color:var(--color-success);' : 'color:var(--color-danger);';
    return `
      <tr>
        <td class="mono" style="font-size:0.78rem;">${escapeHtml(datetime(m.timestamp) || '—')}</td>
        <td class="center">${badge}</td>
        <td class="right mono" style="${colorMontant};font-weight:bold;">${isAdd ? '+' : '−'}${money(m.montant)}</td>
        <td class="right mono muted">${money(m.soldeAvant)}</td>
        <td class="right mono"><strong>${money(m.soldeApres)}</strong></td>
        <td>${escapeHtml(m.raison || '—')}</td>
        <td><span class="badge neutral">${escapeHtml(m.source)}</span></td>
      </tr>
    `;
  }).join('');
}

document.getElementById('btn-recharger').addEventListener('click', chargerTout);
document.getElementById('filtre-type').addEventListener('change', rendre);
document.getElementById('filtre-recherche').addEventListener('input', rendre);

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
