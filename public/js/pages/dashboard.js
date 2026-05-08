// ============================================================
// Page : Dashboard principal (Patron / Co-Patron / DRH)
// ============================================================

import { requireAuth } from '../auth.js';
import { renderShell } from '../layout.js';
import {
  listVentesSemaine, listenStocks, listenStations, listDepensesSemaine,
  listPaiesSemaine, listSemaines, listenAlertesActives, getConfig
} from '../api.js';
import { startOfWeekRP, endOfWeekRP, money, num, pct, datetime, escapeHtml } from '../utils/formatters.js';
import { checkMasseSalariale } from '../utils/paie.js';

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
        <div id="ventes-resume">Chargement…</div>
      </div>

      <div class="panel">
        <div class="panel-title"><span>Top produits (CA)</span></div>
        <div id="top-produits">—</div>
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
  const [ventes, depenses, paies, config] = await Promise.all([
    listVentesSemaine(debut, fin).catch(() => []),
    listDepensesSemaine(debut, fin).catch(() => []),
    listPaiesSemaine(debut, fin).catch(() => []),
    getConfig().catch(() => ({}))
  ]);

  const ca = ventes.reduce((s, v) => s + (v.montant || 0), 0);
  const benefice = ventes.reduce((s, v) => s + (v.benefice || 0), 0);
  const totalDepenses = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const totalPaies = paies.reduce((s, p) => s + (p.montant || 0), 0);
  const beneficeNet = ca - totalDepenses - totalPaies;
  const masse = checkMasseSalariale(totalPaies, ca);

  const kpis = document.getElementById('kpis');
  kpis.innerHTML = `
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

  // === Résumé ventes ===
  const ventesParJour = {};
  ventes.forEach(v => {
    const t = v.timestamp?.toDate?.() || new Date();
    const j = t.toLocaleDateString('fr-FR', { weekday: 'long' });
    ventesParJour[j] = (ventesParJour[j] || 0) + (v.montant || 0);
  });
  const maxJour = Math.max(...Object.values(ventesParJour), 1);

  const ventesResume = document.getElementById('ventes-resume');
  if (ventes.length === 0) {
    ventesResume.innerHTML = `<p class="muted">Aucune vente cette semaine.</p>`;
  } else {
    ventesResume.innerHTML = `
      <div style="display:grid;gap:6px;">
        ${Object.entries(ventesParJour).map(([j, m]) => `
          <div class="row">
            <div style="width:90px;font-family:var(--font-heading);font-size:0.8rem;text-transform:capitalize;">${j}</div>
            <div class="progress" style="flex:1;">
              <div class="fill" style="width:${(m/maxJour)*100}%"></div>
              <div class="label">${money(m)}</div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // === Top produits ===
  const topMap = {};
  ventes.forEach(v => {
    (v.items || []).forEach(it => {
      const k = it.nom || it.produitId || 'Inconnu';
      topMap[k] = (topMap[k] || 0) + (it.total || 0);
    });
  });
  const top = Object.entries(topMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topDiv = document.getElementById('top-produits');
  if (top.length === 0) {
    topDiv.innerHTML = `<p class="muted">Aucune donnée produit (logs à venir).</p>`;
  } else {
    topDiv.innerHTML = `
      <table class="data">
        <thead><tr><th>Produit</th><th class="right">CA</th></tr></thead>
        <tbody>
          ${top.map(([n, m]) => `
            <tr><td>${escapeHtml(n)}</td><td class="right">${money(m)}</td></tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

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
