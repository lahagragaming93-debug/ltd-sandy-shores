// ============================================================
// Page : Comptabilité — TTE Chap. IV — Secteur 2
// ============================================================

import { requireAuth } from '../auth.js';
import { renderShell } from '../layout.js';
import {
  listVentesSemaine, listDepensesSemaine, listPaiesSemaine, listSemaines,
  ajouterDepense, listUsers
} from '../api.js';
import { money, num, pct, datetime, escapeHtml,
         startOfWeekRP, endOfWeekRP } from '../utils/formatters.js';
import { checkMasseSalariale, primeHebdo, primeMensuelle } from '../utils/paie.js';
import { isDirection } from '../utils/permissions.js';
import { toastSuccess, toastError } from '../utils/toast.js';

const { profile } = await requireAuth('comptabilite');
const editable = isDirection(profile.role);

const html = `
  <div class="kpi-grid" id="kpis-compta">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div class="row mb-2">
    <select id="select-semaine">
      <option value="courante">Semaine en cours</option>
    </select>
    <button class="btn" id="btn-export-csv">Exporter CSV</button>
    <button class="btn" id="btn-export-pdf">Exporter PDF</button>
    <span class="spacer"></span>
    ${editable ? '<button class="btn btn-primary" id="btn-add-depense">+ Ajouter une dépense</button>' : ''}
  </div>

  <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;">
    <div class="panel framed">
      <div class="panel-title"><span>Recettes</span></div>
      <table class="data">
        <tbody id="tbody-recettes">
          <tr><td>Chargement…</td></tr>
        </tbody>
      </table>
    </div>

    <div class="panel framed">
      <div class="panel-title"><span>Dépenses</span></div>
      <table class="data">
        <tbody id="tbody-depenses">
          <tr><td>Chargement…</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div class="panel">
    <div class="panel-title"><span>Charges détaillées</span></div>
    <table class="data" id="table-charges">
      <thead>
        <tr>
          <th>Date</th><th>Raison</th><th>Type</th>
          <th class="right">Montant</th><th>Utilisateur</th>
        </tr>
      </thead>
      <tbody id="tbody-charges"><tr><td colspan="5" class="muted text-center">Chargement…</td></tr></tbody>
    </table>
  </div>

  <div class="panel">
    <div class="panel-title"><span>Conformité TTE</span></div>
    <div id="conformite">—</div>
  </div>

  <!-- Modal ajout dépense -->
  <div id="modal-depense" class="modal-backdrop hidden">
    <div class="modal">
      <h3>Ajouter une dépense</h3>
      <label>Raison</label>
      <input type="text" id="dep-raison" placeholder="Ex : Achat matières premières" required />
      <div class="field-row">
        <div><label>Montant ($)</label><input type="number" id="dep-montant" min="0" required /></div>
        <div>
          <label>Type</label>
          <select id="dep-type">
            <option value="matieres-premieres">Matières premières (déductible)</option>
            <option value="frais-avocat">Frais avocat (déductible, max 30 000 $)</option>
            <option value="entretien-vehicules">Entretien véhicules (déductible)</option>
            <option value="autre-deductible">Autre déductible</option>
            <option value="non-deductible">Non déductible</option>
          </select>
        </div>
      </div>
      <div class="row mt-3">
        <button class="btn btn-primary" id="btn-save-depense">Enregistrer</button>
        <button class="btn btn-ghost" id="btn-cancel-depense">Annuler</button>
      </div>
    </div>
  </div>
`;
renderShell(profile, 'comptabilite', html);

const debut = startOfWeekRP();
const fin   = endOfWeekRP();

const semainesPassees = await listSemaines(6).catch(() => []);
const sel = document.getElementById('select-semaine');
semainesPassees.forEach(s => {
  const o = document.createElement('option');
  o.value = s.id || s.numero;
  o.textContent = `Semaine ${s.numero || s.dateDebut}`;
  sel.appendChild(o);
});

let users = [];
async function chargerTout() {
  const semaineSel = sel.value;
  if (semaineSel !== 'courante') {
    const sm = semainesPassees.find(s => (s.id || s.numero) === semaineSel);
    if (sm) renderSemaineFigee(sm);
    return;
  }

  const [ventes, depenses, paies, u] = await Promise.all([
    listVentesSemaine(debut, fin).catch(() => []),
    listDepensesSemaine(debut, fin).catch(() => []),
    listPaiesSemaine(debut, fin).catch(() => []),
    listUsers().catch(() => [])
  ]);
  users = u;

  const ca = ventes.reduce((s, v) => s + (v.montant || 0), 0);
  const totalDepenses = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const deductibles = depenses.filter(d => d.deductible !== false)
    .reduce((s, d) => s + (d.montant || 0), 0);
  const nonDeductibles = totalDepenses - deductibles;
  const masseSalariale = paies.reduce((s, p) => s + (p.montant || 0), 0);
  const resultatImposable = ca - deductibles;
  const beneficeNet = ca - totalDepenses - masseSalariale;
  const masse = checkMasseSalariale(masseSalariale, ca);

  const pHebdo = primeHebdo(ca);
  const pMensuel = primeMensuelle(beneficeNet);

  // === KPIs ===
  document.getElementById('kpis-compta').innerHTML = `
    <div class="kpi"><div class="label">CA</div><div class="value">${money(ca)}</div><div class="delta">${ventes.length} factures</div></div>
    <div class="kpi"><div class="label">Charges déductibles</div><div class="value">${money(deductibles)}</div><div class="delta">imposable: ${money(resultatImposable)}</div></div>
    <div class="kpi"><div class="label">Masse salariale</div><div class="value">${money(masseSalariale)}</div><div class="delta ${masse.ok ? 'up' : 'down'}">${pct(masse.ratio*100,1)} ${masse.ok ? '✓' : '⚠'}</div></div>
    <div class="kpi"><div class="label">Bénéfice net</div><div class="value">${money(beneficeNet)}</div><div class="delta ${beneficeNet>=0 ? 'up' : 'down'}">après salaires</div></div>
  `;

  // === Recettes ===
  document.getElementById('tbody-recettes').innerHTML = `
    <tr><td>Chiffre d'affaires (ventes)</td><td class="right mono">${money(ca)}</td></tr>
    <tr><td>Autres entrées</td><td class="right mono muted">À saisir manuellement</td></tr>
    <tr style="font-weight:bold;border-top:2px solid var(--color-blood);">
      <td>Total recettes</td><td class="right mono">${money(ca)}</td>
    </tr>
  `;

  // === Dépenses ===
  document.getElementById('tbody-depenses').innerHTML = `
    <tr><td>Charges déductibles</td><td class="right mono">${money(deductibles)}</td></tr>
    <tr><td>Charges non déductibles</td><td class="right mono">${money(nonDeductibles)}</td></tr>
    <tr><td>Salaires versés</td><td class="right mono">${money(masseSalariale)}</td></tr>
    <tr><td>Prime hebdo (Art. 4-1.10)</td><td class="right mono">${money(pHebdo)}</td></tr>
    <tr><td>Prime mensuelle (Art. 4-1.11)</td><td class="right mono">${money(pMensuel)}</td></tr>
    <tr style="font-weight:bold;border-top:2px solid var(--color-blood);">
      <td>Total dépenses</td>
      <td class="right mono">${money(totalDepenses + masseSalariale + pHebdo + pMensuel)}</td>
    </tr>
  `;

  // === Charges détaillées ===
  const usersById = users.reduce((m, u) => (m[u.id] = u, m), {});
  const tbody = document.getElementById('tbody-charges');
  if (depenses.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted text-center">Aucune dépense.</td></tr>`;
  } else {
    tbody.innerHTML = depenses.map(d => {
      const u = usersById[d.utilisateurId];
      return `
        <tr>
          <td>${datetime(d.timestamp)}</td>
          <td>${escapeHtml(d.raison || '')}</td>
          <td><span class="badge ${d.deductible !== false ? 'ok' : 'neutral'}">${d.deductible !== false ? 'Déductible' : 'Non déductible'}</span></td>
          <td class="right mono">${money(d.montant)}</td>
          <td>${u ? escapeHtml(u.prenom + ' ' + u.nom) : escapeHtml(d.utilisateur || '—')}</td>
        </tr>
      `;
    }).join('');
  }

  // === Conformité ===
  const conf = document.getElementById('conformite');
  const alerts = [];
  if (!masse.ok) alerts.push({ t: 'danger', m: `Masse salariale ${pct(masse.ratio*100,1)} > 90 % du CA (TTE).` });
  if (masse.alerte && masse.ok) alerts.push({ t: 'warn', m: `Masse salariale élevée (${pct(masse.ratio*100,1)}). Limite TTE : 90 %.` });
  if (ca === 0) alerts.push({ t: 'info', m: 'Aucune vente enregistrée cette semaine.' });

  conf.innerHTML = alerts.length === 0
    ? `<div class="alert ok"><span class="icon">✓</span><div>Toutes les règles TTE sont respectées.</div></div>`
    : alerts.map(a => `<div class="alert ${a.t}"><span class="icon">⚠</span><div>${escapeHtml(a.m)}</div></div>`).join('');
}

function renderSemaineFigee(s) {
  document.getElementById('kpis-compta').innerHTML = `
    <div class="kpi"><div class="label">CA</div><div class="value">${money(s.ca)}</div><div class="delta">${s.statut || 'figée'}</div></div>
    <div class="kpi"><div class="label">Dépenses</div><div class="value">${money(s.depenses)}</div><div class="delta">total</div></div>
    <div class="kpi"><div class="label">Salaires</div><div class="value">${money(s.masseSalariale)}</div><div class="delta">versés</div></div>
    <div class="kpi"><div class="label">Bénéfice net</div><div class="value">${money(s.benefice)}</div><div class="delta ${s.benefice>=0?'up':'down'}">cloturé</div></div>
  `;
  document.getElementById('tbody-recettes').innerHTML =
    `<tr><td>Semaine cloturée</td><td class="right mono">${money(s.ca)}</td></tr>`;
  document.getElementById('tbody-depenses').innerHTML =
    `<tr><td>Semaine cloturée</td><td class="right mono">${money(s.depenses + (s.masseSalariale||0))}</td></tr>`;
  document.getElementById('tbody-charges').innerHTML =
    `<tr><td colspan="5" class="muted text-center">Détail non disponible — semaine archivée.</td></tr>`;
  document.getElementById('conformite').innerHTML =
    `<p class="muted">Semaine cloturée le ${datetime(s.dateCloture)}.</p>`;
}

sel.addEventListener('change', chargerTout);
chargerTout();

// === Ajout dépense ===
const btnAddDep = document.getElementById('btn-add-depense');
if (btnAddDep) {
  btnAddDep.addEventListener('click', () => {
    document.getElementById('dep-raison').value = '';
    document.getElementById('dep-montant').value = '';
    document.getElementById('modal-depense').classList.remove('hidden');
  });
}
document.getElementById('btn-cancel-depense').addEventListener('click', () => {
  document.getElementById('modal-depense').classList.add('hidden');
});
document.getElementById('btn-save-depense').addEventListener('click', async () => {
  const raison = document.getElementById('dep-raison').value.trim();
  const montant = Number(document.getElementById('dep-montant').value) || 0;
  const type = document.getElementById('dep-type').value;
  const deductible = !type.startsWith('non-');
  if (!raison || !montant) return toastError("Raison et montant obligatoires.");
  try {
    await ajouterDepense({
      raison, montant, type, deductible,
      utilisateur: profile.prenom + ' ' + profile.nom,
      utilisateurId: (await import('../auth.js')).getCurrentUser().uid
    });
    toastSuccess("Dépense enregistrée.");
    document.getElementById('modal-depense').classList.add('hidden');
    chargerTout();
  } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); console.error(e); }
});

// === Exports ===
document.getElementById('btn-export-csv').addEventListener('click', async () => {
  const [ventes, depenses, paies] = await Promise.all([
    listVentesSemaine(debut, fin), listDepensesSemaine(debut, fin), listPaiesSemaine(debut, fin)
  ]);
  const ca = ventes.reduce((s, v) => s + (v.montant || 0), 0);
  const dep = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const dedu = depenses.filter(d => d.deductible !== false).reduce((s, d) => s + (d.montant || 0), 0);
  const masse = paies.reduce((s, p) => s + (p.montant || 0), 0);

  const lines = [
    'Poste;Montant',
    `CA;${ca}`,
    `Charges deductibles;${dedu}`,
    `Charges non deductibles;${dep - dedu}`,
    `Masse salariale;${masse}`,
    `Resultat imposable;${ca - dedu}`,
    `Benefice net;${ca - dep - masse}`
  ];
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `compta-${debut.toISOString().slice(0,10)}.csv`;
  a.click();
});

document.getElementById('btn-export-pdf').addEventListener('click', () => {
  // Impression natif → l'utilisateur peut l'enregistrer en PDF
  window.print();
});
