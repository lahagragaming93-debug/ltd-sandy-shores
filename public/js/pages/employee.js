// ============================================================
// Page : Mon espace (Dashboard employé) — lecture seule
// ============================================================

import { requireAuth, getCurrentUser } from '../auth.js';
import { renderShell } from '../layout.js';
import {
  listVentesSemaine, listServicesSemaine, listAllServicesEmploye, getQuotaPompiste, getConfig
} from '../api.js';
import { ROLE_LABELS, isVendeur, isPompiste, PLAFOND_SALAIRE,
         CA_PLAFOND_VENDEUR, COMMISSION_VENDEUR } from '../utils/permissions.js';
import { salaireVendeur, salairePompiste, scorePompiste } from '../utils/paie.js';
import { money, num, pct, datetime, escapeHtml,
         startOfWeekRP, endOfWeekRP, weekId, durationHM } from '../utils/formatters.js';
import { wrapScroll, makeSortable } from '../utils/sortable-table.js';

const { profile } = await requireAuth('employee');
const debut = startOfWeekRP();
const fin   = endOfWeekRP();
const wId   = weekId();

const html = `
  <div class="panel framed mb-3" style="text-align:center;">
    <h2 style="margin:0;">Salut <span style="color:var(--color-blood-light);">${escapeHtml(profile.prenom)}</span> !</h2>
    <div class="muted" style="margin-top:6px;">
      ${ROLE_LABELS[profile.role]} · Semaine du ${debut.toLocaleDateString('fr-FR')} au ${fin.toLocaleDateString('fr-FR')}
    </div>
  </div>

  <div class="kpi-grid" id="kpis-emp">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div class="panel framed" id="panel-detail">
    <div class="panel-title"><span>Détail de ta semaine</span></div>
    <div id="detail">Chargement…</div>
  </div>

  <div class="panel">
    <div class="panel-title"><span>Heures de service</span></div>
    <div id="services">—</div>
  </div>

  <p class="muted text-center mt-3" style="font-size:0.78rem;">
    Données mises à jour en continu via les logs Discord.<br>
    Le compteur est remis à zéro chaque dimanche à 00 h 00.
  </p>
`;
renderShell(profile, 'employee', html);

const me = getCurrentUser();
const config = await getConfig().catch(() => ({}));

const [allVentes, allServices, allMyServices, quota] = await Promise.all([
  listVentesSemaine(debut, fin).catch(() => []),
  listServicesSemaine(debut, fin).catch(() => []),
  listAllServicesEmploye(me.uid).catch(() => []),
  // Charge le quota pour TOUS les roles (les non-pompistes peuvent aussi
  // produire des bidons/caoutchoucs en bossant a la station - bonus info).
  getQuotaPompiste(me.uid, wId).catch(() => ({ bidons: 0, caoutchoucs: 0 }))
]);

const myVentes = allVentes.filter(v => v.vendeurId === me.uid);
const myServices = allServices.filter(s => s.employeId === me.uid);
const heuresMs = myServices.reduce((s, x) => s + (x.duree || 0), 0);

// Cumul depuis embauche (tous services) + heures aujourd'hui
const cumulMs = allMyServices.reduce((s, x) => s + (x.duree || 0), 0);
const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
const heuresJourMs = allMyServices.reduce((s, x) => {
  const d = x.debut?.toDate?.();
  return d && d >= startOfDay ? s + (x.duree || 0) : s;
}, 0);

const plafondSalaire = PLAFOND_SALAIRE[profile.role] || 0;

if (isVendeur(profile.role)) {
  const ca = myVentes.reduce((s, v) => s + (v.montant || 0), 0);
  const benefice = myVentes.reduce((s, v) => s + (v.benefice || 0), 0);
  const salaireEst = salaireVendeur(profile.role, ca, benefice);
  const progressionCA = Math.min(100, (ca / CA_PLAFOND_VENDEUR) * 100);
  const commission = COMMISSION_VENDEUR[profile.role] * 100;

  document.getElementById('kpis-emp').innerHTML = `
    <div class="kpi"><div class="label">Ton CA</div><div class="value">${money(ca)}</div><div class="delta">${myVentes.length} ventes</div></div>
    <div class="kpi"><div class="label">Bénéfice généré</div><div class="value">${money(benefice)}</div><div class="delta">commission ${commission}%</div></div>
    <div class="kpi"><div class="label">Progression CA</div><div class="value">${pct(progressionCA, 1)}</div><div class="delta">vers 40 000 $ plafond</div></div>
    <div class="kpi"><div class="label">Salaire estimé</div><div class="value">${money(salaireEst)}</div><div class="delta">/ ${money(plafondSalaire)} max</div></div>
  `;

  document.getElementById('detail').innerHTML = `
    <div class="row" style="gap:14px;flex-direction:column;align-items:stretch;">
      <div>
        <div class="muted mono mb-1">Progression vers plafond CA (40 000 $)</div>
        <div class="progress" style="height:24px;">
          <div class="fill" style="width:${progressionCA}%"></div>
          <div class="label">${money(ca)} / ${money(CA_PLAFOND_VENDEUR)}</div>
        </div>
      </div>
      <div>
        <div class="muted mono mb-1">Salaire estimé / plafond</div>
        <div class="progress" style="height:24px;">
          <div class="fill" style="width:${plafondSalaire ? (salaireEst/plafondSalaire)*100 : 0}%"></div>
          <div class="label">${money(salaireEst)} / ${money(plafondSalaire)}</div>
        </div>
      </div>
    </div>

    <div class="table-scroll" style="max-height:400px;margin-top:12px;">
      <table class="data" id="table-mes-ventes">
        <thead><tr>
          <th data-sort="date">Date</th>
          <th data-sort="client">Client</th>
          <th class="right" data-sort="montant">Montant</th>
          <th class="right" data-sort="benefice">Bénéfice</th>
        </tr></thead>
        <tbody>
          ${myVentes.length === 0 ? '<tr><td colspan="4" class="muted text-center">Aucune vente cette semaine.</td></tr>' :
            myVentes.map(v => `
              <tr>
                <td>${datetime(v.timestamp)}</td>
                <td>${escapeHtml(v.client || '—')}</td>
                <td class="right mono">${money(v.montant)}</td>
                <td class="right mono">${money(v.benefice || 0)}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>
  `;
  if (myVentes.length > 0) makeSortable(document.getElementById('table-mes-ventes'));
} else if (isPompiste(profile.role)) {
  const bidons = quota?.bidons || 0;
  const caoutchoucs = quota?.caoutchoucs || 0;
  const qB = config.quotaBidons || 1700;
  const qC = config.quotaCaoutchoucs || 800;
  const score = scorePompiste(bidons, caoutchoucs, qB, qC);
  const salaireEst = salairePompiste(profile.role, bidons, caoutchoucs, qB, qC);
  const pctB = Math.min(100, (bidons / qB) * 100);
  const pctC = Math.min(100, (caoutchoucs / qC) * 100);

  document.getElementById('kpis-emp').innerHTML = `
    <div class="kpi"><div class="label">Bidons</div><div class="value">${num(bidons)}</div><div class="delta">/ ${num(qB)} (${pct(pctB,0)})</div></div>
    <div class="kpi"><div class="label">Caoutchoucs</div><div class="value">${num(caoutchoucs)}</div><div class="delta">/ ${num(qC)} (${pct(pctC,0)})</div></div>
    <div class="kpi"><div class="label">Score global</div><div class="value">${pct(score,1)}</div><div class="delta">moyenne des 2</div></div>
    <div class="kpi"><div class="label">Salaire estimé</div><div class="value">${money(salaireEst)}</div><div class="delta">/ ${money(plafondSalaire)} max</div></div>
  `;

  document.getElementById('detail').innerHTML = `
    <div style="display:grid;gap:14px;">
      <div>
        <div class="muted mono mb-1">Bidons d'essence ravitaillés</div>
        <div class="progress" style="height:24px;">
          <div class="fill" style="width:${pctB}%"></div>
          <div class="label">${num(bidons)} / ${num(qB)} bidons</div>
        </div>
      </div>
      <div>
        <div class="muted mono mb-1">Caoutchoucs produits</div>
        <div class="progress" style="height:24px;">
          <div class="fill" style="width:${pctC}%"></div>
          <div class="label">${num(caoutchoucs)} / ${num(qC)} unités</div>
        </div>
      </div>
      <div>
        <div class="muted mono mb-1">Salaire estimé / plafond</div>
        <div class="progress" style="height:24px;">
          <div class="fill" style="width:${plafondSalaire ? (salaireEst/plafondSalaire)*100 : 0}%"></div>
          <div class="label">${money(salaireEst)} / ${money(plafondSalaire)}</div>
        </div>
      </div>
    </div>
  `;
} else {
  // Direction / Resp / DRH / Admin Tech : salaire FIXE, mais peuvent aussi
  // vendre / ravitailler. On affiche leurs stats personnelles a titre INFO
  // (sans impact sur leur paye fixe).
  const ca = myVentes.reduce((s, v) => s + (v.montant || 0), 0);
  const benefice = myVentes.reduce((s, v) => s + (v.benefice || 0), 0);
  const bidons = quota?.bidons ?? 0;
  const caoutchoucs = quota?.caoutchoucs ?? 0;
  const aFaitDeLaCo = ca > 0 || bidons > 0 || caoutchoucs > 0;

  document.getElementById('kpis-emp').innerHTML = `
    <div class="kpi"><div class="label">Plafond salaire</div><div class="value">${money(plafondSalaire)}</div><div class="delta">salaire fixe (TTE)</div></div>
    <div class="kpi"><div class="label">Heures cette semaine</div><div class="value">${durationHM(heuresMs)}</div><div class="delta">${myServices.length} sessions</div></div>
    <div class="kpi"><div class="label">${aFaitDeLaCo ? '🎁 CA bonus généré' : 'Statut'}</div><div class="value">${aFaitDeLaCo ? money(ca) : ROLE_LABELS[profile.role]}</div><div class="delta">${aFaitDeLaCo ? myVentes.length + ' ventes (info, sans impact paye)' : (profile.statut || 'actif')}</div></div>
    <div class="kpi"><div class="label">Date d'entrée</div><div class="value mono" style="font-size:1.2rem;">${profile.dateEntree || '—'}</div><div class="delta">au LTD</div></div>
  `;

  // Section activite annexe (ventes + quotas pompiste si presents)
  let detailHtml = `
    <p class="muted mb-2">
      En tant que ${ROLE_LABELS[profile.role]}, ton salaire est <strong>fixé</strong> par la direction (${money(plafondSalaire)} max).
      ${aFaitDeLaCo ? "Tes ventes et ravitaillements ci-dessous comptent pour le CA global du LTD mais <strong>n'impactent pas ta paye</strong>." : "Utilise les autres modules pour piloter l'activité."}
    </p>
  `;
  if (aFaitDeLaCo) {
    detailHtml += `
      <div class="kpi-grid mb-2">
        ${ca > 0 ? `<div class="kpi"><div class="label">💵 CA généré</div><div class="value">${money(ca)}</div><div class="delta">${myVentes.length} ventes</div></div>` : ''}
        ${benefice !== 0 ? `<div class="kpi"><div class="label">📈 Bénéfice généré</div><div class="value">${money(benefice)}</div><div class="delta">pour le LTD</div></div>` : ''}
        ${bidons > 0 ? `<div class="kpi"><div class="label">🛢 Bidons d'essence</div><div class="value">${num(bidons)}</div><div class="delta">produits cette semaine</div></div>` : ''}
        ${caoutchoucs > 0 ? `<div class="kpi"><div class="label">🪖 Caoutchoucs</div><div class="value">${num(caoutchoucs)}</div><div class="delta">produits cette semaine</div></div>` : ''}
      </div>
      ${myVentes.length > 0 ? `
        <div class="table-scroll" style="max-height:300px;">
          <table class="data">
            <thead><tr><th>Date</th><th>Client</th><th class="right">Montant</th><th class="right">Bénéfice</th></tr></thead>
            <tbody>
              ${myVentes.map(v => `
                <tr>
                  <td class="mono">${datetime(v.timestamp)}</td>
                  <td>${escapeHtml(v.client || '—')}</td>
                  <td class="right mono">${money(v.montant)}</td>
                  <td class="right mono ${(v.benefice||0) >= 0 ? '' : 'muted'}">${money(v.benefice || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    `;
  }
  document.getElementById('detail').innerHTML = detailHtml;
}

// === Heures de service : 3 KPIs (jour / semaine / cumul depuis embauche) ===
const sDiv = document.getElementById('services');
const heuresStatsHtml = `
  <div class="kpi-grid mb-2">
    <div class="kpi"><div class="label">⏱ Aujourd'hui</div><div class="value">${durationHM(heuresJourMs)}</div><div class="delta">depuis 00h00</div></div>
    <div class="kpi"><div class="label">📅 Semaine en cours</div><div class="value">${durationHM(heuresMs)}</div><div class="delta">${myServices.length} sessions</div></div>
    <div class="kpi"><div class="label">🗂 Cumul depuis embauche</div><div class="value">${durationHM(cumulMs)}</div><div class="delta">${allMyServices.length} sessions total</div></div>
  </div>
`;
if (myServices.length === 0) {
  sDiv.innerHTML = heuresStatsHtml + `<p class="muted">Aucune session enregistrée cette semaine.</p>`;
} else {
  // Le tableau detaille reste sur la semaine en cours (pas trop long)
  sDiv.innerHTML = heuresStatsHtml + `
    <div class="table-scroll" style="max-height:400px;">
      <table class="data" id="table-mes-services">
        <thead><tr>
          <th data-sort="debut">Début</th>
          <th data-sort="fin">Fin</th>
          <th class="right" data-sort="duree">Durée</th>
        </tr></thead>
        <tbody>
          ${myServices.map(s => `
            <tr>
              <td>${datetime(s.debut)}</td>
              <td>${datetime(s.fin)}</td>
              <td class="right mono" data-sort-value="${s.duree || 0}">${durationHM(s.duree || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p class="muted mono mt-2" style="font-size:0.78rem;">
      Total semaine : ${durationHM(heuresMs)} ${heuresMs >= 7*3600*1000 ? '✓ ≥ 7h' : '— moins de 7h (info uniquement, non bloquant)'}
    </p>
  `;
  makeSortable(document.getElementById('table-mes-services'));
}
