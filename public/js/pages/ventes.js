// ============================================================
// Page : Ventes
// ============================================================

import { requireAuth } from '../auth.js';
import { renderShell } from '../layout.js';
import { listenVentesSemaine, listUsers, listProduits } from '../api.js';
import { money, num, datetime, escapeHtml, startOfWeekRP, endOfWeekRP } from '../utils/formatters.js';

const { profile } = await requireAuth('ventes');

const html = `
  <div class="kpi-grid" id="kpis-ventes">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div class="row mb-2 wrap">
    <select id="filtre-vendeur"><option value="">Tous les vendeurs</option></select>
    <select id="filtre-paiement">
      <option value="">Tous paiements</option>
      <option value="especes">Espèces</option>
      <option value="carte">Carte</option>
    </select>
    <input type="text" id="filtre-recherche" placeholder="Rechercher (client, produit…)" style="flex:1;min-width:200px;" />
    <button class="btn" id="btn-export">Exporter CSV</button>
  </div>

  <div class="panel framed">
    <div class="panel-title"><span>Factures de la semaine</span></div>
    <table class="data" id="table-ventes">
      <thead>
        <tr>
          <th>Date</th>
          <th>#Facture</th>
          <th>Vendeur</th>
          <th>Client</th>
          <th class="right">Montant</th>
          <th class="right">Bénéfice</th>
          <th>Paiement</th>
          <th>Raison</th>
          <th class="center">Vérif. stock</th>
        </tr>
      </thead>
      <tbody id="tbody-ventes"><tr><td colspan="9" class="muted text-center">Chargement…</td></tr></tbody>
    </table>
  </div>

  <div class="panel">
    <div class="panel-title"><span>Discordances vente ↔ stock</span></div>
    <div id="discordances">—</div>
  </div>
`;

renderShell(profile, 'ventes', html);

const debut = startOfWeekRP();
const fin   = endOfWeekRP();

const [users, produits] = await Promise.all([
  listUsers().catch(() => []),
  listProduits().catch(() => [])
]);

const usersById = users.reduce((m, u) => (m[u.id] = u, m), {});

const selVendeur = document.getElementById('filtre-vendeur');
users.filter(u => ['vendeur-novice','vendeur-intermediaire','vendeur-experimente'].includes(u.role))
  .forEach(u => {
    const o = document.createElement('option');
    o.value = u.id;
    o.textContent = `${u.prenom} ${u.nom}`;
    selVendeur.appendChild(o);
  });

let ventes = [];

listenVentesSemaine(debut, fin, list => {
  ventes = list;
  renderTable();
  renderKpis();
});

document.getElementById('filtre-vendeur').addEventListener('change', renderTable);
document.getElementById('filtre-paiement').addEventListener('change', renderTable);
document.getElementById('filtre-recherche').addEventListener('input', renderTable);

function renderTable() {
  const v = document.getElementById('filtre-vendeur').value;
  const p = document.getElementById('filtre-paiement').value;
  const r = document.getElementById('filtre-recherche').value.toLowerCase().trim();

  let rows = ventes;
  if (v) rows = rows.filter(x => x.vendeurId === v);
  if (p) rows = rows.filter(x => (x.paiement || '').toLowerCase() === p);
  if (r) rows = rows.filter(x =>
    (x.client || '').toLowerCase().includes(r) ||
    (x.raison || '').toLowerCase().includes(r)
  );

  const tbody = document.getElementById('tbody-ventes');
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="muted text-center">Aucune vente (logs Discord à venir).</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(v => {
    const vendeur = usersById[v.vendeurId];
    const verif = v.stockVerifie === false
      ? '<span class="badge danger">⚠ Discordance</span>'
      : (v.stockVerifie === true ? '<span class="badge ok">OK</span>' : '<span class="badge neutral">—</span>');
    return `
      <tr>
        <td class="mono">${datetime(v.timestamp)}</td>
        <td class="mono">#${escapeHtml(v.factureId || v.id)}</td>
        <td>${vendeur ? escapeHtml(vendeur.prenom + ' ' + vendeur.nom) : escapeHtml(v.vendeurNom || '—')}</td>
        <td>${escapeHtml(v.client || '—')}</td>
        <td class="right mono">${money(v.montant)}</td>
        <td class="right mono ${(v.benefice||0) >= 0 ? '' : 'muted'}">${money(v.benefice || 0)}</td>
        <td><span class="badge neutral">${escapeHtml(v.paiement || '—')}</span></td>
        <td class="muted">${escapeHtml(v.raison || '')}</td>
        <td class="center">${verif}</td>
      </tr>
    `;
  }).join('');
}

function renderKpis() {
  const ca = ventes.reduce((s, v) => s + (v.montant || 0), 0);
  const benefice = ventes.reduce((s, v) => s + (v.benefice || 0), 0);
  const especes = ventes.filter(v => (v.paiement || '').toLowerCase() === 'especes').length;
  const carte = ventes.filter(v => (v.paiement || '').toLowerCase() === 'carte').length;
  const moyenne = ventes.length ? ca / ventes.length : 0;

  document.getElementById('kpis-ventes').innerHTML = `
    <div class="kpi"><div class="label">CA semaine</div><div class="value">${money(ca)}</div><div class="delta">${ventes.length} factures</div></div>
    <div class="kpi"><div class="label">Bénéfice brut</div><div class="value">${money(benefice)}</div><div class="delta">marge produits</div></div>
    <div class="kpi"><div class="label">Panier moyen</div><div class="value">${money(moyenne)}</div><div class="delta">par facture</div></div>
    <div class="kpi"><div class="label">Paiements</div><div class="value mono">${especes}/${carte}</div><div class="delta">espèces / carte</div></div>
  `;

  // Discordances
  const disc = ventes.filter(v => v.stockVerifie === false);
  const div = document.getElementById('discordances');
  if (disc.length === 0) {
    div.innerHTML = `<p class="muted">Aucune discordance détectée.</p>`;
  } else {
    div.innerHTML = `
      <div class="alert warn"><span class="icon">⚠</span>
        <div>${disc.length} vente${disc.length > 1 ? 's' : ''} sans sortie de stock correspondante détectée.</div>
      </div>
      <table class="data mt-2">
        <thead><tr><th>Date</th><th>Facture</th><th>Vendeur</th><th class="right">Montant</th><th>Détails</th></tr></thead>
        <tbody>
          ${disc.map(v => `
            <tr>
              <td>${datetime(v.timestamp)}</td>
              <td>#${escapeHtml(v.factureId || v.id)}</td>
              <td>${escapeHtml(usersById[v.vendeurId]?.prenom + ' ' + usersById[v.vendeurId]?.nom || v.vendeurNom || '—')}</td>
              <td class="right mono">${money(v.montant)}</td>
              <td class="muted">${escapeHtml(v.raison || '')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
}

// === Export CSV ===
document.getElementById('btn-export').addEventListener('click', () => {
  const v = document.getElementById('filtre-vendeur').value;
  const p = document.getElementById('filtre-paiement').value;
  let rows = ventes;
  if (v) rows = rows.filter(x => x.vendeurId === v);
  if (p) rows = rows.filter(x => (x.paiement || '').toLowerCase() === p);

  const lines = [
    'Date;Facture;Vendeur;Client;Montant;Benefice;Paiement;Raison'
  ];
  rows.forEach(x => {
    const vendeur = usersById[x.vendeurId];
    lines.push([
      datetime(x.timestamp),
      x.factureId || x.id,
      vendeur ? `${vendeur.prenom} ${vendeur.nom}` : (x.vendeurNom || ''),
      x.client || '',
      x.montant || 0,
      x.benefice || 0,
      x.paiement || '',
      (x.raison || '').replace(/[;\n\r]/g, ' ')
    ].join(';'));
  });
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventes-semaine-${debut.toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});
