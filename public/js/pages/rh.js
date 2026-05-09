// ============================================================
// Page : Ressources humaines
// ============================================================

import { requireAuth } from '../auth.js';
import { renderShell } from '../layout.js';
import {
  listUsers, listVentesSemaine, listServicesSemaine, listQuotasSemaine,
  listPaiesSemaine, getConfig, updateUser
} from '../api.js';
import { ROLE_LABELS, isVendeur, isPompiste, isResponsable, isDirection,
         isSuperAdmin, compteEnFinance, PLAFOND_SALAIRE } from '../utils/permissions.js';
import { salaireEstime, scorePompiste, checkMasseSalariale } from '../utils/paie.js';
import { money, num, pct, datetime, escapeHtml,
         startOfWeekRP, endOfWeekRP, weekId, durationHM } from '../utils/formatters.js';
import { toastSuccess, toastError } from '../utils/toast.js';

const { profile } = await requireAuth('rh');
const editable = isDirection(profile.role) || profile.role === 'drh';

const html = `
  <div class="kpi-grid" id="kpis-rh">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div class="row mb-2 wrap">
    <select id="filtre-role">
      <option value="">Tous les rôles</option>
      ${Object.entries(ROLE_LABELS).map(([k,l]) => `<option value="${k}">${l}</option>`).join('')}
    </select>
    <select id="filtre-statut">
      <option value="">Tous statuts</option>
      <option value="actif">Actifs</option>
      <option value="suspendu">Suspendus</option>
    </select>
    <input type="text" id="filtre-recherche" placeholder="Rechercher (nom, prénom, ID Discord)" style="flex:1;min-width:200px;" />
  </div>

  <div class="panel framed">
    <div class="panel-title"><span>Effectif</span></div>
    <table class="data" id="table-rh">
      <thead>
        <tr>
          <th>Nom</th>
          <th>Rôle</th>
          <th>ID Discord</th>
          <th class="right">Heures</th>
          <th class="right">CA / Quota</th>
          <th class="right">Salaire estimé</th>
          <th>Statut</th>
          <th class="center">Actions</th>
        </tr>
      </thead>
      <tbody id="tbody-rh"><tr><td colspan="8" class="muted text-center">Chargement…</td></tr></tbody>
    </table>
  </div>

  <div class="panel">
    <div class="panel-title"><span>Activité de la semaine</span></div>
    <div id="activite">—</div>
  </div>

  <!-- Modal détail employé -->
  <div id="modal-employe" class="modal-backdrop hidden">
    <div class="modal" style="max-width: 640px;">
      <h3 id="emp-nom">—</h3>
      <div id="emp-content">—</div>
      <div class="row mt-3">
        ${editable ? '<button class="btn btn-primary" id="btn-decide-salaire">Décider salaire (resp./direction)</button>' : ''}
        <button class="btn btn-ghost" id="btn-close-emp">Fermer</button>
      </div>
    </div>
  </div>
`;
renderShell(profile, 'rh', html);

const debut = startOfWeekRP();
const fin   = endOfWeekRP();
const wId   = weekId();

const [users, ventes, services, quotas, paies, config] = await Promise.all([
  listUsers().catch(() => []),
  listVentesSemaine(debut, fin).catch(() => []),
  listServicesSemaine(debut, fin).catch(() => []),
  listQuotasSemaine(wId).catch(() => []),
  listPaiesSemaine(debut, fin).catch(() => []),
  getConfig().catch(() => ({}))
]);

// === Calculer les métriques par employé ===
const metricsByUser = {};
users.forEach(u => {
  const myVentes = ventes.filter(v => v.vendeurId === u.id);
  const ca = myVentes.reduce((s, v) => s + (v.montant || 0), 0);
  const benefice = myVentes.reduce((s, v) => s + (v.benefice || 0), 0);

  const myServices = services.filter(s => s.employeId === u.id);
  const heuresMs = myServices.reduce((s, x) => s + (x.duree || 0), 0);

  const myQuota = quotas.find(q => q.employeId === u.id) || { bidons: 0, caoutchoucs: 0 };

  const myPaies = paies.filter(p => p.beneficiaireId === u.id);
  const totalPaie = myPaies.reduce((s, p) => s + (p.montant || 0), 0);

  const employe = {
    role: u.role,
    caGenere: ca,
    beneficeGenere: benefice,
    bidonsRealises: myQuota.bidons || 0,
    caoutchoucsRealises: myQuota.caoutchoucs || 0,
    salaireDecide: u.salaireDecide || 0
  };
  const estime = salaireEstime(employe, config);

  metricsByUser[u.id] = {
    ca, benefice, heuresMs, ventes: myVentes,
    bidons: myQuota.bidons || 0,
    caoutchoucs: myQuota.caoutchoucs || 0,
    salaireEstime: estime,
    totalPaie
  };
});

// === KPIs ===
// On exclut les rôles techniques (admin-technique) des calculs financiers / masse salariale
const usersFinance = users.filter(u => compteEnFinance(u.role));
const totalCA = ventes.reduce((s, v) => s + (v.montant || 0), 0);
const totalEstime = usersFinance.reduce((s, u) => s + (metricsByUser[u.id]?.salaireEstime || 0), 0);
const totalVerse = paies.reduce((s, p) => s + (p.montant || 0), 0);
const masse = checkMasseSalariale(totalEstime, totalCA);
const actifs = usersFinance.filter(u => u.statut === 'actif').length;
const technicians = users.filter(u => isSuperAdmin(u.role) && u.statut === 'actif').length;

document.getElementById('kpis-rh').innerHTML = `
  <div class="kpi"><div class="label">Effectif actif</div><div class="value">${actifs}</div><div class="delta">/ ${usersFinance.length} comptes${technicians > 0 ? ` <span style="color:var(--color-gold);">+${technicians} tech</span>` : ''}</div></div>
  <div class="kpi"><div class="label">Salaires estimés</div><div class="value">${money(totalEstime)}</div><div class="delta">cette semaine</div></div>
  <div class="kpi"><div class="label">Salaires versés</div><div class="value">${money(totalVerse)}</div><div class="delta">via paie Discord</div></div>
  <div class="kpi"><div class="label">Masse salariale</div><div class="value">${pct(masse.ratio*100,1)}</div><div class="delta ${masse.ok ? 'up' : 'down'}">limite TTE: 90%</div></div>
`;

// === Filtres + render table ===
function renderTable() {
  const fr = document.getElementById('filtre-role').value;
  const fs = document.getElementById('filtre-statut').value;
  const fq = document.getElementById('filtre-recherche').value.toLowerCase().trim();

  // Exclut les rôles techniques (admin-technique) du tableau effectif
  let rows = users.filter(u => compteEnFinance(u.role));
  if (fr) rows = rows.filter(u => u.role === fr);
  if (fs) rows = rows.filter(u => (u.statut || 'actif') === fs);
  if (fq) rows = rows.filter(u =>
    `${u.prenom} ${u.nom}`.toLowerCase().includes(fq) ||
    (u.idDiscord || '').toLowerCase().includes(fq) ||
    (u.idPerso || '').toLowerCase().includes(fq)
  );

  const tbody = document.getElementById('tbody-rh');
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted text-center">Aucun employé.</td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(u => {
    const m = metricsByUser[u.id] || {};
    const heures = durationHM(m.heuresMs || 0);
    const heuresOK = (m.heuresMs || 0) >= 7 * 3600 * 1000;
    const heuresMark = heuresOK ? '' : '<span class="muted">⚠</span> ';
    const plafond = PLAFOND_SALAIRE[u.role] || 0;
    const ratio = plafond ? (m.salaireEstime / plafond) * 100 : 0;

    let progressLabel = '—';
    if (isVendeur(u.role)) {
      progressLabel = `${money(m.ca || 0)} / ${money(40000)}`;
    } else if (isPompiste(u.role)) {
      const score = scorePompiste(m.bidons, m.caoutchoucs, config.quotaBidons, config.quotaCaoutchoucs);
      progressLabel = `${pct(score, 0)}`;
    } else if (isResponsable(u.role) || isDirection(u.role) || u.role === 'drh') {
      progressLabel = `Décidé`;
    }

    return `
      <tr>
        <td><strong>${escapeHtml(u.prenom)} ${escapeHtml(u.nom)}</strong></td>
        <td><span class="badge neutral">${ROLE_LABELS[u.role] || u.role}</span></td>
        <td class="mono">${escapeHtml(u.idDiscord || '—')}</td>
        <td class="right mono">${heuresMark}${heures}</td>
        <td class="right mono">${progressLabel}</td>
        <td class="right mono">${money(m.salaireEstime || 0)} <span class="muted" style="font-size:0.7rem;">/ ${money(plafond)}</span></td>
        <td><span class="badge ${u.statut === 'actif' ? 'ok' : 'warn'}">${u.statut || 'actif'}</span></td>
        <td class="center">
          <button class="btn btn-sm btn-ghost" data-detail="${u.id}">Détail</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('[data-detail]').forEach(b => {
    b.addEventListener('click', () => ouvrirDetail(b.dataset.detail));
  });
}
['filtre-role', 'filtre-statut', 'filtre-recherche'].forEach(id => {
  document.getElementById(id).addEventListener('input', renderTable);
});
renderTable();

function ouvrirDetail(uid) {
  const u = users.find(x => x.id === uid);
  if (!u) return;
  const m = metricsByUser[uid] || {};

  document.getElementById('emp-nom').textContent = `${u.prenom} ${u.nom} — ${ROLE_LABELS[u.role]}`;
  let html = `
    <p class="muted">
      ID Discord: <span class="mono">${escapeHtml(u.idDiscord || '—')}</span> ·
      ID Perso: <span class="mono">${escapeHtml(u.idPerso || '—')}</span> ·
      Entrée: ${u.dateEntree || '—'}
    </p>
    <table class="data">
      <tbody>
        <tr><td>Heures de service</td><td class="right mono">${durationHM(m.heuresMs || 0)}</td></tr>
        <tr><td>Salaires versés</td><td class="right mono">${money(m.totalPaie || 0)}</td></tr>
        <tr><td>Salaire estimé (semaine)</td><td class="right mono">${money(m.salaireEstime || 0)}</td></tr>
        <tr><td>Plafond TTE</td><td class="right mono">${money(PLAFOND_SALAIRE[u.role] || 0)}</td></tr>
  `;
  if (isVendeur(u.role)) {
    html += `
      <tr><td>CA généré</td><td class="right mono">${money(m.ca || 0)}</td></tr>
      <tr><td>Bénéfice généré</td><td class="right mono">${money(m.benefice || 0)}</td></tr>
      <tr><td>Nombre de ventes</td><td class="right mono">${(m.ventes || []).length}</td></tr>
    `;
  }
  if (isPompiste(u.role)) {
    const score = scorePompiste(m.bidons, m.caoutchoucs, config.quotaBidons, config.quotaCaoutchoucs);
    html += `
      <tr><td>Bidons réalisés</td><td class="right mono">${m.bidons || 0} / ${config.quotaBidons || 1700}</td></tr>
      <tr><td>Caoutchoucs réalisés</td><td class="right mono">${m.caoutchoucs || 0} / ${config.quotaCaoutchoucs || 800}</td></tr>
      <tr><td>Score global</td><td class="right mono">${pct(score, 1)}</td></tr>
    `;
  }
  html += `</tbody></table>`;

  if (isResponsable(u.role) || isDirection(u.role) || u.role === 'drh') {
    html += `
      <label>Salaire décidé (max ${money(PLAFOND_SALAIRE[u.role])}) — pour ${ROLE_LABELS[u.role]}</label>
      <input type="number" id="emp-salaire-decide" min="0" value="${u.salaireDecide || PLAFOND_SALAIRE[u.role]}" />
    `;
  }

  document.getElementById('emp-content').innerHTML = html;
  document.getElementById('modal-employe').dataset.uid = uid;
  document.getElementById('modal-employe').classList.remove('hidden');
}

document.getElementById('btn-close-emp').addEventListener('click', () => {
  document.getElementById('modal-employe').classList.add('hidden');
});

const btnDecide = document.getElementById('btn-decide-salaire');
if (btnDecide) {
  btnDecide.addEventListener('click', async () => {
    const uid = document.getElementById('modal-employe').dataset.uid;
    const input = document.getElementById('emp-salaire-decide');
    if (!input) return toastError("Pas de champ salaire pour ce rôle.");
    const v = Number(input.value) || 0;
    const u = users.find(x => x.id === uid);
    if (!u) return;
    const plaf = PLAFOND_SALAIRE[u.role] || 0;
    if (v > plaf) return toastError(`Plafond TTE: ${money(plaf)}.`);
    try {
      await updateUser(uid, { salaireDecide: v });
      toastSuccess("Salaire décidé enregistré.");
    } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); }
  });
}

// === Activité de la semaine ===
const usersById = users.reduce((m, u) => (m[u.id] = u, m), {});
const div = document.getElementById('activite');
if (services.length === 0 && paies.length === 0) {
  div.innerHTML = `<p class="muted">Aucune activité encore (logs à venir).</p>`;
} else {
  const parEmp = {};
  services.forEach(s => {
    if (!parEmp[s.employeId]) parEmp[s.employeId] = { duree: 0, sessions: 0 };
    parEmp[s.employeId].duree += s.duree || 0;
    parEmp[s.employeId].sessions += 1;
  });
  const sorted = Object.entries(parEmp).sort((a, b) => b[1].duree - a[1].duree);
  div.innerHTML = `
    <table class="data">
      <thead><tr><th>Employé</th><th class="right">Sessions</th><th class="right">Heures totales</th></tr></thead>
      <tbody>
        ${sorted.map(([uid, s]) => {
          const u = usersById[uid];
          return `<tr>
            <td>${u ? escapeHtml(u.prenom + ' ' + u.nom) : uid}</td>
            <td class="right mono">${s.sessions}</td>
            <td class="right mono">${durationHM(s.duree)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
}
