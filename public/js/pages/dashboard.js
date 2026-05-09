// ============================================================
// Page : Dashboard principal (Patron / Co-Patron / DRH)
// ============================================================

import { requireAuth } from '../auth.js';
import { renderShell } from '../layout.js';
import {
  listVentesSemaine, listenStocks, listenStations, listDepensesSemaine,
  listPaiesSemaine, listSemaines, listenAlertesActives, getConfig,
  getDernierSoldeBanque
} from '../api.js';
import { startOfWeekRP, endOfWeekRP, money, num, pct, datetime, escapeHtml } from '../utils/formatters.js';
import { checkMasseSalariale } from '../utils/paie.js';
import { Chart, registerables } from 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/+esm';
Chart.register(...registerables);

// Couleurs western pour les graphiques
const CH_COLORS = {
  blood:    '#8B0000',
  bloodLt:  '#b81b1b',
  sand:     '#D2B48C',
  sandLt:   '#e6d3b3',
  gold:     '#c9a961',
  bone:     '#F5F0E8',
  grid:     'rgba(210, 180, 140, 0.12)'
};
Chart.defaults.color = CH_COLORS.sand;
Chart.defaults.font.family = "'Special Elite', 'Courier New', monospace";
Chart.defaults.borderColor = CH_COLORS.grid;

const { user, profile } = await requireAuth('dashboard');

const html = `
  <div class="kpi-grid" id="kpis">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div style="display:grid;grid-template-columns:2fr 1fr;gap:20px;">
    <div>
      <div class="panel framed">
        <div class="panel-title">
          <span>Ventes — semaine en cours</span>
          <span class="muted mono" id="periode-semaine"></span>
        </div>
        <div id="ventes-resume" style="position:relative;height:240px;">
          <canvas id="chart-ventes"></canvas>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title"><span>Top produits (CA)</span></div>
        <div id="top-produits" style="position:relative;height:240px;">
          <canvas id="chart-top"></canvas>
        </div>
      </div>

      <div class="panel">
        <div class="panel-title"><span>Historique 6 dernières semaines</span></div>
        <div id="historique">—</div>
      </div>
    </div>

    <div>
      <div class="panel">
        <div class="panel-title"><span>Alertes actives</span></div>
        <div id="alertes-list">Aucune alerte</div>
      </div>

      <div class="panel">
        <div class="panel-title"><span>Stations essence</span></div>
        <div id="stations-mini">—</div>
      </div>

      <div class="panel">
        <div class="panel-title"><span>Stocks bas</span></div>
        <div id="stocks-bas">—</div>
      </div>
    </div>
  </div>
`;

renderShell(profile, 'dashboard', html);

// === Période semaine ===
const debut = startOfWeekRP();
const fin   = endOfWeekRP();
document.getElementById('periode-semaine').textContent =
  `${debut.toLocaleDateString('fr-FR')} → ${fin.toLocaleDateString('fr-FR')}`;

// === KPIs ===
async function chargerKpis() {
  const [ventes, depenses, paies, config, soldeBanque] = await Promise.all([
    listVentesSemaine(debut, fin).catch(() => []),
    listDepensesSemaine(debut, fin).catch(() => []),
    listPaiesSemaine(debut, fin).catch(() => []),
    getConfig().catch(() => ({})),
    getDernierSoldeBanque().catch(() => null)
  ]);

  const ca = ventes.reduce((s, v) => s + (v.montant || 0), 0);
  const benefice = ventes.reduce((s, v) => s + (v.benefice || 0), 0);
  const totalDepenses = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const totalPaies = paies.reduce((s, p) => s + (p.montant || 0), 0);
  const beneficeNet = ca - totalDepenses - totalPaies;
  const masse = checkMasseSalariale(totalPaies, ca);

  // Solde banque LTD (dernière dépense connue avec champ soldeApres)
  let soldeKpi = `
    <div class="kpi" title="Aucune donnée de solde encore enregistrée">
      <div class="label">💰 Solde banque LTD</div>
      <div class="value muted">—</div>
      <div class="delta muted">en attente de dépense Discord</div>
    </div>`;
  if (soldeBanque) {
    const dateSolde = datetime(soldeBanque.timestamp);
    soldeKpi = `
      <div class="kpi" title="Solde au moment de la dernière dépense Discord (${escapeHtml(dateSolde)} — « ${escapeHtml(soldeBanque.raison)} »)">
        <div class="label">💰 Solde banque LTD</div>
        <div class="value">${money(soldeBanque.solde)}</div>
        <div class="delta">au ${escapeHtml(dateSolde)}</div>
      </div>`;
  }

  const kpis = document.getElementById('kpis');
  kpis.innerHTML = `
    ${soldeKpi}
    <div class="kpi">
      <div class="label">CA semaine</div>
      <div class="value">${money(ca)}</div>
      <div class="delta">${ventes.length} factures</div>
    </div>
    <div class="kpi">
      <div class="label">Bénéfice brut</div>
      <div class="value">${money(benefice)}</div>
      <div class="delta">marge produits</div>
    </div>
    <div class="kpi">
      <div class="label">Bénéfice net estimé</div>
      <div class="value">${money(beneficeNet)}</div>
      <div class="delta ${beneficeNet >= 0 ? 'up' : 'down'}">
        après dépenses + salaires
      </div>
    </div>
    <div class="kpi">
      <div class="label">Masse salariale</div>
      <div class="value">${pct(masse.ratio * 100, 1)}</div>
      <div class="delta ${masse.ok ? 'up' : 'down'}">
        ${masse.ok ? '≤ 90% (TTE OK)' : '⚠ Dépasse 90%'}
      </div>
    </div>
  `;

  // === Chart 1 — Ventes par jour de la semaine ===
  const joursOrder = ['lundi','mardi','mercredi','jeudi','vendredi','samedi','dimanche'];
  const ventesParJour = Object.fromEntries(joursOrder.map(j => [j, 0]));
  ventes.forEach(v => {
    const t = v.timestamp?.toDate?.() || new Date();
    const j = t.toLocaleDateString('fr-FR', { weekday: 'long' }).toLowerCase();
    if (ventesParJour[j] != null) ventesParJour[j] += (v.montant || 0);
  });
  renderChartVentes(ventesParJour);

  // === Chart 2 — Top produits ===
  const topMap = {};
  ventes.forEach(v => {
    (v.items || []).forEach(it => {
      const k = it.nom || it.produitId || 'Inconnu';
      // Préférer it.total si dispo, sinon estimer à partir de quantite + prix
      topMap[k] = (topMap[k] || 0) + (it.total || (it.quantite ?? 1) * (it.prixUnitaire || 0));
    });
  });
  const top = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  renderChartTop(top);

  // === Historique 6 semaines ===
  const semaines = await listSemaines(6).catch(() => []);
  const histDiv = document.getElementById('historique');
  if (semaines.length === 0) {
    histDiv.innerHTML = `<p class="muted">Première semaine — pas d'historique.</p>`;
  } else {
    histDiv.innerHTML = `
      <table class="data">
        <thead><tr>
          <th>Semaine</th>
          <th class="right">CA</th>
          <th class="right">Dépenses</th>
          <th class="right">Bénéfice net</th>
          <th>Statut</th>
        </tr></thead>
        <tbody>
          ${semaines.map(s => `
            <tr>
              <td>${s.numero || s.dateDebut || '—'}</td>
              <td class="right">${money(s.ca)}</td>
              <td class="right">${money(s.depenses)}</td>
              <td class="right">${money(s.benefice)}</td>
              <td><span class="badge ${s.statut === 'cloturee' ? 'ok' : 'info'}">${s.statut || 'en cours'}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }
}
chargerKpis();

// === Stations mini-bloc ===
listenStations(stations => {
  const div = document.getElementById('stations-mini');
  if (stations.length === 0) {
    div.innerHTML = `<p class="muted">Aucune station configurée. <a href="admin.html">Configurer</a></p>`;
    return;
  }
  div.innerHTML = stations.map(s => {
    const niveau = s.stockMax ? (s.stockActuel / s.stockMax) * 100 : 0;
    const sousAlerte = s.stockActuel < (s.seuilAlerte || 0);
    return `
      <div class="row" style="margin-bottom:8px;gap:10px;">
        <div style="flex:1;">
          <div style="font-family:var(--font-heading);font-size:0.85rem;">
            ${escapeHtml(s.nom)} ${sousAlerte ? '<span class="badge danger">⚠</span>' : ''}
          </div>
          <div class="progress" style="height:14px;">
            <div class="fill" style="width:${Math.min(niveau, 100)}%"></div>
            <div class="label">${num(s.stockActuel || 0)} L</div>
          </div>
        </div>
      </div>
    `;
  }).join('');
});

// === Stocks bas ===
listenStocks(stockMap => {
  // Récupérer les seuils depuis produits
  const div = document.getElementById('stocks-bas');
  const bas = Object.entries(stockMap)
    .filter(([id, s]) => s.seuilAlerte != null && s.quantite <= s.seuilAlerte)
    .slice(0, 8);
  if (bas.length === 0) {
    div.innerHTML = `<p class="muted">Tous les stocks sont OK.</p>`;
    return;
  }
  div.innerHTML = bas.map(([id, s]) => `
    <div class="row" style="margin-bottom:6px;">
      <span class="badge ${s.quantite === 0 ? 'danger' : 'warn'}">${s.quantite === 0 ? 'RUPTURE' : 'BAS'}</span>
      <span>${escapeHtml(s.nom || id)}</span>
      <span class="spacer"></span>
      <span class="mono">${num(s.quantite || 0)}</span>
    </div>
  `).join('');
});

// ============ Charts ============
let chartVentes = null;
let chartTop    = null;

function renderChartVentes(ventesParJour) {
  const ctx = document.getElementById('chart-ventes')?.getContext('2d');
  if (!ctx) return;
  const data = Object.values(ventesParJour);
  const total = data.reduce((s, v) => s + v, 0);
  if (chartVentes) chartVentes.destroy();
  if (total === 0) {
    ctx.canvas.parentElement.innerHTML = '<p class="muted text-center" style="padding-top:80px;">Aucune vente cette semaine.</p>';
    return;
  }
  chartVentes = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(ventesParJour).map(j => j.charAt(0).toUpperCase() + j.slice(1, 3)),
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

function renderChartTop(topArr) {
  const ctx = document.getElementById('chart-top')?.getContext('2d');
  if (!ctx) return;
  if (chartTop) chartTop.destroy();
  if (topArr.length === 0) {
    ctx.canvas.parentElement.innerHTML = '<p class="muted text-center" style="padding-top:80px;">Aucune donnée produit (logs à venir).</p>';
    return;
  }
  chartTop = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: topArr.map(([n]) => n.length > 22 ? n.slice(0, 20) + '…' : n),
      datasets: [{
        data: topArr.map(([, m]) => m),
        backgroundColor: [CH_COLORS.blood, CH_COLORS.bloodLt, CH_COLORS.gold, CH_COLORS.sand, CH_COLORS.sandLt],
        borderWidth: 0
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1a1a',
          titleColor: CH_COLORS.gold,
          bodyColor: CH_COLORS.bone,
          callbacks: { label: (ctx) => money(ctx.raw) }
        }
      },
      scales: {
        x: { beginAtZero: true, grid: { color: CH_COLORS.grid }, ticks: { callback: v => money(v) } },
        y: { grid: { display: false } }
      }
    }
  });
}

// === Alertes ===
listenAlertesActives(alertes => {
  const div = document.getElementById('alertes-list');
  if (alertes.length === 0) {
    div.innerHTML = `<p class="muted">Aucune alerte active.</p>`;
    return;
  }
  div.innerHTML = alertes.slice(0, 8).map(a => `
    <div class="alert ${a.gravite || 'warn'}">
      <span class="icon">⚠</span>
      <div style="flex:1;">
        <div>${escapeHtml(a.message)}</div>
        <div class="muted mono" style="font-size:0.72rem;">${datetime(a.timestamp)}</div>
      </div>
    </div>
  `).join('');
});
