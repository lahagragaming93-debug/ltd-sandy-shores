// ============================================================
// Page : Revenus carburant
// ============================================================
// Source : collection /redistributions, alimentée par le parser
// `essence` (canal #suivi-achat-essence) — chaque doc = 1 paiement
// d'un client à une station LTD.
//
// Affiche :
//  - 4 KPIs (CA, transactions, litres, prix moyen/L)
//  - Graphique CA par jour
//  - Tableau récap par station (CA, litres, transactions, prix moyen)
//  - Tableau détaillé chronologique
// ============================================================

import { requireAuth } from '../auth.js';
import { renderShell } from '../layout.js';
import { listRedistributionsSemaine } from '../api.js';
import { money, moneyPrecis, num, datetime, escapeHtml,
         startOfWeekRP, endOfWeekRP } from '../utils/formatters.js';
import { wrapScroll, makeSortable } from '../utils/sortable-table.js';
import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm';
Chart.register(...registerables);

const CH_COLORS = {
  blood:   '#8B0000',
  bloodLt: '#b81b1b',
  sand:    '#D2B48C',
  gold:    '#c9a961',
  bone:    '#F5F0E8',
  grid:    'rgba(210, 180, 140, 0.12)'
};
Chart.defaults.color = CH_COLORS.sand;
Chart.defaults.font.family = "'Special Elite', 'Courier New', monospace";
Chart.defaults.borderColor = CH_COLORS.grid;

const { profile } = await requireAuth('revenus_carburant');

const html = `
  <div class="kpi-grid" id="kpis-carb">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div class="row mb-2 wrap">
    <select id="filtre-periode">
      <option value="semaine">📅 Semaine en cours</option>
      <option value="7j">7 derniers jours</option>
      <option value="30j">30 derniers jours</option>
    </select>
    <select id="filtre-station">
      <option value="">Toutes les stations</option>
    </select>
    <span class="spacer"></span>
    <span class="muted mono" id="stats-carb">—</span>
    <button class="btn" id="btn-export-csv">📥 Export CSV</button>
  </div>

  <div class="panel framed">
    <div class="panel-title"><span>📊 Chiffre d'affaires carburant par jour</span></div>
    <div style="height:260px;position:relative;">
      <canvas id="chart-carb"></canvas>
    </div>
  </div>

  <div class="panel framed">
    <div class="panel-title">
      <span>⛽ Récap par station</span>
      <span class="muted" style="font-size:0.75rem;">— click sur en-tête pour trier</span>
    </div>
    <div class="table-scroll">
      <table class="data" id="table-stations">
        <thead>
          <tr>
            <th data-sort="station">Station</th>
            <th class="right" data-sort="transactions">Transactions</th>
            <th class="right" data-sort="litres">Litres vendus</th>
            <th class="right" data-sort="ca">CA</th>
            <th class="right" data-sort="prixMoyen">Prix moyen / L</th>
          </tr>
        </thead>
        <tbody id="tbody-stations"><tr><td colspan="5" class="muted text-center">Chargement…</td></tr></tbody>
      </table>
    </div>
  </div>

  <div class="panel">
    <div class="panel-title">
      <span>📋 Détail des transactions</span>
      <span class="muted" style="font-size:0.75rem;">— ordre chronologique</span>
    </div>
    <div class="table-scroll">
      <table class="data" id="table-transactions">
        <thead>
          <tr>
            <th data-sort="date">Date</th>
            <th data-sort="station">Station</th>
            <th class="right" data-sort="litres">Litres</th>
            <th class="right" data-sort="prixL">Prix / L</th>
            <th class="right" data-sort="montant">Montant</th>
            <th class="right" data-sort="stockApres">Stock après</th>
            <th data-sort="redistribution">N° lot</th>
          </tr>
        </thead>
        <tbody id="tbody-transactions"><tr><td colspan="7" class="muted text-center">Chargement…</td></tr></tbody>
      </table>
    </div>
  </div>
`;

renderShell(profile, 'revenus_carburant', html);

makeSortable(document.getElementById('table-stations'));
makeSortable(document.getElementById('table-transactions'));

let chartCarb = null;
let dataCache = []; // pour l'export CSV

function periodeRange(key) {
  const fin = endOfWeekRP();
  if (key === 'semaine') return { debut: startOfWeekRP(), fin };
  const now = new Date();
  if (key === '7j') {
    const debut = new Date(now);
    debut.setDate(debut.getDate() - 7);
    debut.setHours(0, 0, 0, 0);
    return { debut, fin: now };
  }
  // 30j
  const debut = new Date(now);
  debut.setDate(debut.getDate() - 30);
  debut.setHours(0, 0, 0, 0);
  return { debut, fin: now };
}

async function recharger() {
  const periode = document.getElementById('filtre-periode').value;
  const { debut, fin } = periodeRange(periode);
  const list = await listRedistributionsSemaine(debut, fin).catch(() => []);
  dataCache = list;

  // Alimente le filtre station (dynamique selon les données chargées)
  const stationsUniques = [...new Set(list.map(r => r.station || r.stationId).filter(Boolean))].sort();
  const selStation = document.getElementById('filtre-station');
  const selected = selStation.value;
  selStation.innerHTML = `<option value="">Toutes les stations</option>` +
    stationsUniques.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  selStation.value = stationsUniques.includes(selected) ? selected : '';

  rendre();
}

function rendre() {
  const stationFilter = document.getElementById('filtre-station').value;
  let rows = dataCache;
  if (stationFilter) rows = rows.filter(r => (r.station || r.stationId) === stationFilter);

  // === KPIs globaux ===
  const ca = rows.reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const litres = rows.reduce((s, r) => s + (Number(r.litres) || 0), 0);
  const prixMoyen = litres > 0 ? ca / litres : 0;

  document.getElementById('kpis-carb').innerHTML = `
    <div class="kpi kpi-recette">
      <div class="label">💚 CA carburant</div>
      <div class="value">${money(ca)}</div>
      <div class="delta">${rows.length} transactions</div>
    </div>
    <div class="kpi">
      <div class="label">⛽ Litres vendus</div>
      <div class="value">${num(litres)} L</div>
      <div class="delta">total période</div>
    </div>
    <div class="kpi">
      <div class="label">💵 Prix moyen / L</div>
      <div class="value">${moneyPrecis(prixMoyen)}</div>
      <div class="delta">pondéré</div>
    </div>
    <div class="kpi">
      <div class="label">🏪 Stations actives</div>
      <div class="value">${new Set(rows.map(r => r.station || r.stationId).filter(Boolean)).size}</div>
      <div class="delta">avec ventes</div>
    </div>
  `;

  document.getElementById('stats-carb').textContent =
    `${rows.length} transactions — ${money(ca)} de CA`;

  // === Récap par station ===
  const parStation = new Map();
  for (const r of rows) {
    const k = r.station || r.stationId || '—';
    if (!parStation.has(k)) parStation.set(k, { transactions: 0, litres: 0, ca: 0 });
    const s = parStation.get(k);
    s.transactions += 1;
    s.litres += Number(r.litres) || 0;
    s.ca += Number(r.montant) || 0;
  }
  const tbodyStations = document.getElementById('tbody-stations');
  if (parStation.size === 0) {
    tbodyStations.innerHTML = `<tr><td colspan="5" class="muted text-center">Aucune transaction sur la période.</td></tr>`;
  } else {
    tbodyStations.innerHTML = [...parStation.entries()]
      .sort((a, b) => b[1].ca - a[1].ca)
      .map(([nom, s]) => {
        const prixM = s.litres > 0 ? s.ca / s.litres : 0;
        return `
          <tr>
            <td><strong>${escapeHtml(nom)}</strong></td>
            <td class="right mono">${num(s.transactions)}</td>
            <td class="right mono">${num(s.litres)} L</td>
            <td class="right mono">${money(s.ca)}</td>
            <td class="right mono">${moneyPrecis(prixM)}</td>
          </tr>`;
      }).join('');
  }

  // === Détail transactions ===
  const tbodyTrans = document.getElementById('tbody-transactions');
  if (rows.length === 0) {
    tbodyTrans.innerHTML = `<tr><td colspan="7" class="muted text-center">Aucune transaction sur la période.</td></tr>`;
  } else {
    tbodyTrans.innerHTML = rows.map(r => `
      <tr>
        <td>${datetime(r.timestamp)}</td>
        <td>${escapeHtml(r.station || r.stationId || '—')}</td>
        <td class="right mono">${num(r.litres || 0)}</td>
        <td class="right mono">${moneyPrecis(r.prixLitre || 0)}</td>
        <td class="right mono">${moneyPrecis(r.montant || 0)}</td>
        <td class="right mono">${num(r.stockApres || 0)} L</td>
        <td class="mono">#${escapeHtml(String(r.id || r.redistributionId || '—'))}</td>
      </tr>
    `).join('');
  }

  // === Graphique CA par jour ===
  renderChart(rows);
}

function renderChart(rows) {
  const ctx = document.getElementById('chart-carb')?.getContext('2d');
  if (!ctx) return;

  // Groupe par jour (date locale FR)
  const parJour = new Map();
  for (const r of rows) {
    const d = r.timestamp?.toDate?.();
    if (!d) continue;
    const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
    parJour.set(key, (parJour.get(key) || 0) + (Number(r.montant) || 0));
  }
  const labels = [...parJour.keys()].sort();
  const data = labels.map(k => parJour.get(k));
  const labelsFR = labels.map(k => {
    const [, m, d] = k.split('-');
    return `${d}/${m}`;
  });

  if (chartCarb) chartCarb.destroy();
  if (data.length === 0) {
    ctx.canvas.parentElement.innerHTML = '<p class="muted text-center" style="padding-top:90px;">Aucune transaction sur la période.</p>';
    return;
  }
  chartCarb = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: labelsFR,
      datasets: [{
        data,
        backgroundColor: CH_COLORS.blood,
        borderColor: CH_COLORS.bloodLt,
        borderWidth: 1,
        hoverBackgroundColor: CH_COLORS.bloodLt
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1a',
          titleColor: CH_COLORS.gold,
          bodyColor: CH_COLORS.bone,
          borderColor: CH_COLORS.blood,
          borderWidth: 1,
          callbacks: { label: (ctx) => money(ctx.raw) }
        }
      },
      scales: {
        y: { beginAtZero: true, grid: { color: CH_COLORS.grid }, ticks: { callback: v => money(v) } },
        x: { grid: { display: false } }
      }
    }
  });
}

document.getElementById('filtre-periode').addEventListener('change', recharger);
document.getElementById('filtre-station').addEventListener('change', rendre);

// === Export CSV ===
document.getElementById('btn-export-csv').addEventListener('click', () => {
  const stationFilter = document.getElementById('filtre-station').value;
  let rows = dataCache;
  if (stationFilter) rows = rows.filter(r => (r.station || r.stationId) === stationFilter);

  const lines = ['Date;Station;Litres;Prix/L;Montant;Stock apres;N° lot'];
  for (const r of rows) {
    lines.push([
      datetime(r.timestamp),
      (r.station || r.stationId || '').replace(/[;\n\r]/g, ' '),
      r.litres || 0,
      r.prixLitre || 0,
      r.montant || 0,
      r.stockApres || 0,
      r.id || r.redistributionId || ''
    ].join(';'));
  }
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `revenus-carburant-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});

recharger();
