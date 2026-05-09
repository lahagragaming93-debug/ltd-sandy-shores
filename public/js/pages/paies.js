// ============================================================
// Page : Mes paies — historique personnel des paiements reçus
// ============================================================

import { requireAuth, getCurrentUser } from '../auth.js';
import { renderShell } from '../layout.js';
import { listMesPaies } from '../api.js';
import { ROLE_LABELS, PLAFOND_SALAIRE } from '../utils/permissions.js';
import { money, datetime, escapeHtml,
         startOfWeekRP, endOfWeekRP } from '../utils/formatters.js';

const { profile } = await requireAuth('paies');

const html = `
  <div class="kpi-grid" id="kpis-paies">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div class="panel framed">
    <div class="panel-title">
      <span>Historique des paies reçues</span>
      <span class="muted mono" id="paies-count">—</span>
    </div>
    <table class="data" id="table-paies">
      <thead>
        <tr>
          <th>Date</th>
          <th>Payeur</th>
          <th class="right">Montant</th>
          <th>Période</th>
        </tr>
      </thead>
      <tbody id="tbody-paies"><tr><td colspan="4" class="muted text-center">Chargement…</td></tr></tbody>
    </table>
  </div>

  <p class="muted text-center mt-3" style="font-size:0.78rem;">
    Données issues du canal #paie de Discord, mises à jour automatiquement.<br>
    Si tu vois une paie manquante, vérifie que ton ID Discord et ton ID Perso sont bien renseignés sur ton profil.
  </p>
`;
renderShell(profile, 'paies', html);

const me = getCurrentUser();
const paies = await listMesPaies(me.uid, 200).catch(() => []);

// === KPIs ===
const debut7j = startOfWeekRP();
const fin7j = endOfWeekRP();
const moisDebut = new Date();
moisDebut.setDate(1); moisDebut.setHours(0, 0, 0, 0);

const totalSemaine = paies.filter(p => {
  const t = p.timestamp?.toDate?.();
  return t && t >= debut7j && t <= fin7j;
}).reduce((s, p) => s + (p.montant || 0), 0);

const totalMois = paies.filter(p => {
  const t = p.timestamp?.toDate?.();
  return t && t >= moisDebut;
}).reduce((s, p) => s + (p.montant || 0), 0);

const totalAll = paies.reduce((s, p) => s + (p.montant || 0), 0);
const plafond = PLAFOND_SALAIRE[profile.role] || 0;

document.getElementById('kpis-paies').innerHTML = `
  <div class="kpi">
    <div class="label">Cette semaine</div>
    <div class="value">${money(totalSemaine)}</div>
    <div class="delta">${plafond ? `/ ${money(plafond)} plafond` : 'reçu'}</div>
  </div>
  <div class="kpi">
    <div class="label">Ce mois</div>
    <div class="value">${money(totalMois)}</div>
    <div class="delta">${moisDebut.toLocaleDateString('fr-FR', { month: 'long' })}</div>
  </div>
  <div class="kpi">
    <div class="label">Total reçu</div>
    <div class="value">${money(totalAll)}</div>
    <div class="delta">${paies.length} paie${paies.length > 1 ? 's' : ''}</div>
  </div>
  <div class="kpi">
    <div class="label">Rôle</div>
    <div class="value" style="font-size:1.4rem;">${ROLE_LABELS[profile.role] || profile.role}</div>
    <div class="delta">${profile.dateEntree ? `entré ${profile.dateEntree}` : 'actif'}</div>
  </div>
`;

// === Table des paies ===
document.getElementById('paies-count').textContent =
  `${paies.length} paie${paies.length > 1 ? 's' : ''} reçue${paies.length > 1 ? 's' : ''}`;

const tbody = document.getElementById('tbody-paies');
if (paies.length === 0) {
  tbody.innerHTML = `<tr><td colspan="4" class="muted text-center">
    Aucune paie reçue pour le moment.<br>
    <span style="font-size:0.78rem;">Si tu en attends une, vérifie avec la direction que ton compte a bien le bon ID Discord et ID Perso.</span>
  </td></tr>`;
} else {
  tbody.innerHTML = paies.map(p => {
    const t = p.timestamp?.toDate?.();
    const periode = t
      ? `${t.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })} (${t.toLocaleDateString('fr-FR', { weekday: 'long' })})`
      : '—';
    return `
      <tr>
        <td class="mono">${datetime(p.timestamp)}</td>
        <td>${escapeHtml(p.payeurNom || p.payeurDiscord || '—')}</td>
        <td class="right mono">${money(p.montant)}</td>
        <td class="muted">${periode}</td>
      </tr>
    `;
  }).join('');
}
