// ============================================================
// Page : Comptabilité — TTE Chap. IV — Secteur 2
// Refonte visuelle : KPIs colorés, salaires détaillés, templates rapides,
// récap Discord copiable.
// ============================================================

import { requireAuth, getCurrentUser } from '../auth.js';
import { renderShell, roleBadgeHtml } from '../layout.js';
import {
  listVentesSemaine, listDepensesSemaine, listPaiesSemaine, listSemaines,
  ajouterDepense, listUsers, listStatsHebdoOfficielles, listRedistributionsSemaine
} from '../api.js';
import { money, num, pct, datetime, escapeHtml,
         startOfWeekRP, endOfWeekRP } from '../utils/formatters.js';
import { checkMasseSalariale, primeHebdo, primeMensuelle } from '../utils/paie.js';
import { isDirection, isVendeur, isPompiste, isResponsable, isSuperAdmin, compteEnFinance, ROLE_LABELS, PLAFOND_SALAIRE } from '../utils/permissions.js';
import { toastSuccess, toastError } from '../utils/toast.js';
import { wrapScroll, makeSortable } from '../utils/sortable-table.js';

const { profile } = await requireAuth('comptabilite');
const editable = isDirection(profile.role);

// === Templates de dépenses fréquentes ===
const TEMPLATES_DEPENSES = [
  { label: '🏭 Matières premières', raison: 'Achat matières premières', type: 'matieres-premieres' },
  { label: '⚖ Frais avocat',        raison: 'Honoraires avocat',         type: 'frais-avocat' },
  { label: '🚗 Entretien véhicule', raison: 'Entretien véhicule LTD',    type: 'entretien-vehicules' },
  { label: '💰 Loyer / Charges',    raison: 'Loyer hebdomadaire',        type: 'autre-deductible' },
  { label: '📦 Autre',              raison: '',                          type: 'autre-deductible' }
];

const html = `
  <!-- KPIs colorés -->
  <div class="kpi-grid compta-kpis" id="kpis-compta">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <!-- Toolbar -->
  <div class="row mb-2" style="flex-wrap:wrap;gap:8px;">
    <select id="select-semaine" style="min-width:200px;">
      <option value="courante">📅 Semaine en cours</option>
    </select>
    <button class="btn" id="btn-export-csv">📥 Exporter CSV</button>
    <button class="btn" id="btn-export-pdf">🖨 Imprimer / PDF</button>
    <span class="spacer"></span>
    ${editable ? '<button class="btn btn-primary" id="btn-add-depense">+ Ajouter une dépense</button>' : ''}
  </div>

  <!-- Templates de dépenses fréquentes (uniquement si éditable) -->
  ${editable ? `
    <div class="panel mb-2" id="templates-panel">
      <div class="panel-title"><span>⚡ Dépenses rapides</span><span class="muted" style="font-size:0.75rem;">— pré-remplit le formulaire</span></div>
      <div class="row" style="flex-wrap:wrap;gap:6px;">
        ${TEMPLATES_DEPENSES.map((t, i) =>
          `<button class="btn btn-sm" data-template="${i}">${t.label}</button>`
        ).join('')}
      </div>
    </div>
  ` : ''}

  <!-- Bandeau conformité TTE (gauge masse salariale) -->
  <div class="panel mb-2" id="conformite-panel">
    <div class="panel-title"><span>📜 Conformité TTE — Masse salariale</span></div>
    <div id="masse-gauge"></div>
  </div>

  <!-- Recettes / Dépenses (cartes en colonnes) -->
  <div class="compta-grid">
    <div class="panel framed compta-recettes">
      <div class="panel-title"><span>💚 Recettes</span></div>
      <table class="data">
        <tbody id="tbody-recettes"><tr><td>Chargement…</td></tr></tbody>
      </table>
    </div>

    <div class="panel framed compta-depenses">
      <div class="panel-title"><span>❤ Dépenses</span></div>
      <table class="data">
        <tbody id="tbody-depenses"><tr><td>Chargement…</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Salaires & paies (NOUVEAU) -->
  <div class="panel framed">
    <div class="panel-title">
      <span>💰 Salaires & paies de la semaine</span>
      <button class="btn btn-sm" id="btn-copy-recap" title="Copie un récap formaté pour le coller dans Discord">📋 Copier récap Discord</button>
    </div>
    <div id="salaires-zone"><p class="muted">Chargement…</p></div>
  </div>

  <!-- Comparaison Statsbank officiel vs nos calculs -->
  <div class="panel framed" id="panel-statsbank" style="border-color:var(--color-info);">
    <div class="panel-title">
      <span>🔍 Comparaison cross-source — Officiel FiveM vs nos calculs</span>
      <span class="muted" style="font-size:0.75rem;" id="statsbank-info">—</span>
    </div>
    <p class="muted" style="font-size:0.82rem;margin:4px 0 8px;">
      Les chiffres calculés par <strong>le serveur FiveM lui-même</strong> (canal <code>#statsbank</code>) sont stockés dans <code>statsHebdoOfficiels</code> et comparés avec nos calculs internes (<code>/semaines</code>). Tout écart est mis en évidence — utile pour audit IRS et détection d'anomalies.
    </p>
    <div id="statsbank-zone"><p class="muted">Chargement…</p></div>
  </div>

  <!-- Charges détaillées -->
  <div class="panel">
    <div class="panel-title"><span>📋 Charges détaillées</span></div>
    <div class="table-scroll">
      <table class="data" id="table-charges">
        <thead>
          <tr>
            <th data-sort="date">Date</th>
            <th data-sort="raison">Raison</th>
            <th data-sort="type">Type</th>
            <th class="right" data-sort="montant">Montant</th>
            <th data-sort="utilisateur">Utilisateur</th>
          </tr>
        </thead>
        <tbody id="tbody-charges"><tr><td colspan="5" class="muted text-center">Chargement…</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Modal ajout dépense -->
  <div id="modal-depense" class="modal-backdrop hidden">
    <div class="modal" style="max-width:540px;">
      <h3 id="modal-depense-title">Ajouter une dépense</h3>
      <label>Raison</label>
      <input type="text" id="dep-raison" placeholder="Ex : Achat matières premières" required />
      <div class="field-row">
        <div><label>Montant ($)</label><input type="number" id="dep-montant" min="0" required placeholder="0" /></div>
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
        <button class="btn btn-primary" id="btn-save-depense">Enregistrer la dépense</button>
        <button class="btn btn-ghost" id="btn-cancel-depense">Annuler</button>
      </div>
    </div>
  </div>
`;
renderShell(profile, 'comptabilite', html);

makeSortable(document.getElementById('table-charges'));

const debut = startOfWeekRP();
const fin   = endOfWeekRP();

const semainesPassees = await listSemaines(6).catch(() => []);
const sel = document.getElementById('select-semaine');
semainesPassees.forEach(s => {
  const o = document.createElement('option');
  o.value = s.id || s.numero;
  o.textContent = `📁 Semaine ${s.numero || s.dateDebut}`;
  sel.appendChild(o);
});

let users = [];
let dataCache = null; // pour le bouton "Copier récap"

async function chargerTout() {
  const semaineSel = sel.value;
  if (semaineSel !== 'courante') {
    const sm = semainesPassees.find(s => (s.id || s.numero) === semaineSel);
    if (sm) renderSemaineFigee(sm);
    return;
  }

  const [ventes, depenses, paies, u, redistributions] = await Promise.all([
    listVentesSemaine(debut, fin).catch(() => []),
    listDepensesSemaine(debut, fin).catch(() => []),
    listPaiesSemaine(debut, fin).catch(() => []),
    listUsers().catch(() => []),
    listRedistributionsSemaine(debut, fin).catch(() => [])
  ]);
  users = u;

  const ca = ventes.reduce((s, v) => s + (v.montant || 0), 0);
  const caCarburant = redistributions.reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const caTotal = ca + caCarburant;
  // Exclure les depenses type='paie' (doublon avec /paies attribuees a la
  // semaine precedente via fenetre post-cloture). Sinon les paies sont
  // comptees 2 fois : une en "Charges non deductibles", une en "Masse salariale".
  const depensesHorsPaie = depenses.filter(d => d.type !== 'paie');
  const totalDepenses = depensesHorsPaie.reduce((s, d) => s + (d.montant || 0), 0);
  const deductibles = depensesHorsPaie.filter(d => d.deductible !== false)
    .reduce((s, d) => s + (d.montant || 0), 0);
  const nonDeductibles = totalDepenses - deductibles;
  const masseSalariale = paies.reduce((s, p) => s + (p.montant || 0), 0);
  const resultatImposable = caTotal - deductibles;
  const beneficeNet = caTotal - totalDepenses - masseSalariale;
  const masse = checkMasseSalariale(masseSalariale, caTotal);

  const pHebdo = primeHebdo(caTotal);
  const pMensuel = primeMensuelle(beneficeNet);

  dataCache = { ca, caCarburant, caTotal, deductibles, nonDeductibles, masseSalariale, beneficeNet, paies, debut, fin };

  // === KPIs colorés ===
  document.getElementById('kpis-compta').innerHTML = `
    <div class="kpi kpi-recette">
      <div class="label">💚 CA produits</div>
      <div class="value">${money(ca)}</div>
      <div class="delta">${ventes.length} factures</div>
    </div>
    <div class="kpi kpi-recette">
      <div class="label">⛽ CA carburant</div>
      <div class="value">${money(caCarburant)}</div>
      <div class="delta">${redistributions.length} ventes essence</div>
    </div>
    <div class="kpi kpi-depense">
      <div class="label">❤ Charges déductibles</div>
      <div class="value">${money(deductibles)}</div>
      <div class="delta">imposable: ${money(resultatImposable)}</div>
    </div>
    <div class="kpi kpi-salaire">
      <div class="label">💰 Masse salariale</div>
      <div class="value">${money(masseSalariale)}</div>
      <div class="delta ${masse.ok ? 'up' : 'down'}">${pct(masse.ratio*100, 1)} ${masse.ok ? '✓' : '⚠ HORS TTE'}</div>
    </div>
    <div class="kpi ${beneficeNet >= 0 ? 'kpi-benefice' : 'kpi-perte'}">
      <div class="label">${beneficeNet >= 0 ? '📈 Bénéfice net' : '📉 Perte'}</div>
      <div class="value">${money(beneficeNet)}</div>
      <div class="delta ${beneficeNet >= 0 ? 'up' : 'down'}">après salaires</div>
    </div>
  `;

  // === Recettes ===
  document.getElementById('tbody-recettes').innerHTML = `
    <tr><td>Chiffre d'affaires (ventes produits)</td><td class="right mono">${money(ca)}</td></tr>
    <tr><td>Chiffre d'affaires (ventes carburant)</td><td class="right mono">${money(caCarburant)}</td></tr>
    <tr class="row-total"><td>Total recettes</td><td class="right mono">${money(caTotal)}</td></tr>
  `;

  // === Dépenses ===
  document.getElementById('tbody-depenses').innerHTML = `
    <tr><td>Charges déductibles</td><td class="right mono">${money(deductibles)}</td></tr>
    <tr><td>Charges non déductibles</td><td class="right mono">${money(nonDeductibles)}</td></tr>
    <tr><td>Salaires versés</td><td class="right mono">${money(masseSalariale)}</td></tr>
    <tr><td>Prime hebdo (Art. 4-1.10)</td><td class="right mono ${pHebdo > 0 ? 'gold' : 'muted'}">${money(pHebdo)}</td></tr>
    <tr><td>Prime mensuelle (Art. 4-1.11)</td><td class="right mono ${pMensuel > 0 ? 'gold' : 'muted'}">${money(pMensuel)}</td></tr>
    <tr class="row-total">
      <td>Total dépenses</td>
      <td class="right mono">${money(totalDepenses + masseSalariale + pHebdo + pMensuel)}</td>
    </tr>
  `;

  // === Salaires détaillés (NOUVEAU) ===
  renderSalaires(users, paies);

  // === Charges détaillées ===
  // Le tableau affiche uniquement les VRAIES dépenses (hors paies en doublon)
  const usersById = users.reduce((m, u) => (m[u.id] = u, m), {});
  const tbody = document.getElementById('tbody-charges');
  if (depensesHorsPaie.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="muted text-center">Aucune dépense saisie cette semaine.</td></tr>`;
  } else {
    tbody.innerHTML = depensesHorsPaie.map(d => {
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

  // === Conformité (gauge) ===
  renderGaugeMasse(masse, masseSalariale, caTotal);
}

// ============================================================
// SALAIRES — récap par employé (direction/resp = décidé, vendeurs/pompistes = ce qui a été versé)
// ============================================================
function renderSalaires(users, paies) {
  // Groupe les paies par bénéficiaire
  const verseParUser = {};
  for (const p of paies) {
    const id = p.beneficiaireId || p.beneficiairePerso || p.beneficiaireDiscord;
    if (!id) continue;
    verseParUser[id] = (verseParUser[id] || 0) + (p.montant || 0);
    // On indexe aussi par nom (fallback)
    if (p.beneficiaireNom) verseParUser[p.beneficiaireNom] = (verseParUser[p.beneficiaireNom] || 0) + (p.montant || 0);
  }

  // Filtre les utilisateurs actifs ET exclut les rôles techniques (admin-technique)
  const actifs = users.filter(u => u.statut !== 'suspendu' && compteEnFinance(u.role));

  // Catégorisation
  const direction  = actifs.filter(u => isDirection(u.role) || u.role === 'drh');
  const respo      = actifs.filter(u => isResponsable(u.role));
  const vendeurs   = actifs.filter(u => isVendeur(u.role));
  const pompistes  = actifs.filter(u => isPompiste(u.role));

  function ligneEmploye(u) {
    const verse = verseParUser[u.id] || verseParUser[u.idPerso] || verseParUser[u.idDiscord] || 0;
    const plafond = PLAFOND_SALAIRE[u.role] || 0;
    let estime, source;
    if (isDirection(u.role) || u.role === 'drh' || isResponsable(u.role)) {
      estime = u.salaireDecide ?? plafond;
      source = u.salaireDecide ? '<span class="badge ok">décidé</span>' : '<span class="badge warn">plafond par défaut</span>';
    } else {
      estime = null; // calculé en RH selon CA/quotas
      source = '<span class="badge neutral">auto (RH)</span>';
    }
    const reste = (estime ?? 0) - verse;
    const restoLabel = estime == null
      ? '<span class="muted">— voir RH</span>'
      : (reste > 0
          ? `<span class="reste-a-verser">${money(reste)}</span>`
          : (reste < 0
              ? `<span class="reste-trop">+${money(-reste)} en trop</span>`
              : '<span class="reste-ok">✓ Versé</span>'));
    return `
      <tr>
        <td>
          <strong>${escapeHtml(u.prenom)} ${escapeHtml(u.nom)}</strong><br>
          ${roleBadgeHtml(u.role)}
        </td>
        <td class="right mono">${estime == null ? '<span class="muted">auto</span>' : money(estime)}</td>
        <td class="right mono">${money(verse)}</td>
        <td class="right">${restoLabel}</td>
        <td>${source}</td>
      </tr>
    `;
  }

  const sectionGroupe = (titre, list, totalEstime = true) => {
    if (list.length === 0) return '';
    const totEst = list.reduce((s, u) => {
      if (isDirection(u.role) || u.role === 'drh' || isResponsable(u.role)) {
        return s + (u.salaireDecide ?? PLAFOND_SALAIRE[u.role] ?? 0);
      }
      return s;
    }, 0);
    const totVerse = list.reduce((s, u) => s + (verseParUser[u.id] || verseParUser[u.idPerso] || verseParUser[u.idDiscord] || 0), 0);
    return `
      <h4 class="salaires-group-title">${titre} <span class="muted" style="font-size:0.75rem;">(${list.length})</span></h4>
      <table class="data salaires-table">
        <thead>
          <tr>
            <th>Employé</th>
            <th class="right">Salaire estimé</th>
            <th class="right">Versé cette semaine</th>
            <th class="right">Reste</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>${list.map(ligneEmploye).join('')}</tbody>
        <tfoot>
          <tr class="row-total">
            <td>Total ${list.length} pers.</td>
            <td class="right mono">${totalEstime ? money(totEst) : '—'}</td>
            <td class="right mono">${money(totVerse)}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    `;
  };

  document.getElementById('salaires-zone').innerHTML = `
    <div class="alert info mb-2" style="font-size:0.8rem;">
      <span class="icon">ℹ</span>
      <span>
        <strong>Direction / Responsables</strong> : salaire fixe (décidé via RH).<br>
        <strong>Vendeurs / Pompistes</strong> : calcul automatique selon CA / quotas — détail par employé dans <a href="rh.html">Ressources humaines</a>.<br>
        Le bouton <strong>📋 Copier récap Discord</strong> en haut à droite prépare un message formaté à coller dans <code>#paie</code>.
      </span>
    </div>
    ${sectionGroupe('👑 Direction', direction)}
    ${sectionGroupe('🛒⛽ Responsables', respo)}
    ${sectionGroupe('💵 Vendeurs', vendeurs, false)}
    ${sectionGroupe('🚗 Pompistes', pompistes, false)}
  `;
}

// ============================================================
// GAUGE masse salariale
// ============================================================
function renderGaugeMasse(masse, masseSalariale, ca) {
  const target = document.getElementById('masse-gauge');
  const ratio = masse.ratio * 100;
  const fillPct = Math.min(100, ratio);
  const cls = !masse.ok ? 'gauge-danger' : (masse.alerte ? 'gauge-warn' : 'gauge-ok');
  const status = !masse.ok
    ? '🔴 HORS TTE — masse salariale supérieure à 90 % du CA'
    : (masse.alerte
        ? '🟠 Attention — masse salariale entre 85 % et 90 %'
        : '🟢 OK — masse salariale dans les limites TTE');
  target.innerHTML = `
    <div class="gauge-row">
      <div class="gauge-bar">
        <div class="gauge-fill ${cls}" style="width:${fillPct}%"></div>
        <div class="gauge-marker" style="left:90%"><span>90 %</span></div>
      </div>
      <div class="gauge-value mono">${pct(ratio, 1)}</div>
    </div>
    <div class="gauge-status mt-1">${status}</div>
    <div class="muted mt-1" style="font-size:0.78rem;">${money(masseSalariale)} de salaires versés sur ${money(ca)} de CA</div>
  `;
}

function renderSemaineFigee(s) {
  document.getElementById('kpis-compta').innerHTML = `
    <div class="kpi kpi-recette"><div class="label">💚 CA</div><div class="value">${money(s.ca)}</div><div class="delta">${s.statut || 'figée'}</div></div>
    <div class="kpi kpi-depense"><div class="label">❤ Dépenses</div><div class="value">${money(s.depenses)}</div><div class="delta">total</div></div>
    <div class="kpi kpi-salaire"><div class="label">💰 Salaires</div><div class="value">${money(s.masseSalariale)}</div><div class="delta">versés</div></div>
    <div class="kpi ${s.benefice >= 0 ? 'kpi-benefice' : 'kpi-perte'}"><div class="label">${s.benefice >= 0 ? '📈 Bénéfice' : '📉 Perte'}</div><div class="value">${money(s.benefice)}</div><div class="delta ${s.benefice>=0?'up':'down'}">cloturé</div></div>
  `;
  document.getElementById('tbody-recettes').innerHTML =
    `<tr><td>Semaine cloturée</td><td class="right mono">${money(s.ca)}</td></tr>`;
  document.getElementById('tbody-depenses').innerHTML =
    `<tr><td>Semaine cloturée</td><td class="right mono">${money(s.depenses + (s.masseSalariale||0))}</td></tr>`;
  document.getElementById('salaires-zone').innerHTML =
    `<p class="muted">Détail des salaires non disponible pour les semaines archivées.</p>`;
  document.getElementById('tbody-charges').innerHTML =
    `<tr><td colspan="5" class="muted text-center">Détail non disponible — semaine archivée.</td></tr>`;
  document.getElementById('masse-gauge').innerHTML =
    `<p class="muted">Semaine cloturée le ${datetime(s.dateCloture)}.</p>`;
}

sel.addEventListener('change', chargerTout);
chargerTout();

// ============================================================
// Templates de dépenses fréquentes
// ============================================================
document.querySelectorAll('[data-template]').forEach(btn => {
  btn.addEventListener('click', () => {
    const t = TEMPLATES_DEPENSES[Number(btn.dataset.template)];
    document.getElementById('modal-depense-title').textContent = `Ajouter une dépense — ${t.label}`;
    document.getElementById('dep-raison').value = t.raison;
    document.getElementById('dep-montant').value = '';
    document.getElementById('dep-type').value = t.type;
    document.getElementById('modal-depense').classList.remove('hidden');
    setTimeout(() => document.getElementById('dep-montant').focus(), 50);
  });
});

// === Ajout dépense (bouton classique) ===
const btnAddDep = document.getElementById('btn-add-depense');
if (btnAddDep) {
  btnAddDep.addEventListener('click', () => {
    document.getElementById('modal-depense-title').textContent = 'Ajouter une dépense';
    document.getElementById('dep-raison').value = '';
    document.getElementById('dep-montant').value = '';
    document.getElementById('modal-depense').classList.remove('hidden');
    setTimeout(() => document.getElementById('dep-raison').focus(), 50);
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
      utilisateurId: getCurrentUser().uid
    });
    toastSuccess(`Dépense "${raison}" enregistrée (${money(montant)}).`);
    document.getElementById('modal-depense').classList.add('hidden');
    chargerTout();
  } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); console.error(e); }
});

// ============================================================
// Bouton "Copier récap Discord"
// ============================================================
document.getElementById('btn-copy-recap').addEventListener('click', async () => {
  if (!users || users.length === 0) {
    return toastError("Données non chargées encore.");
  }
  const fmtDate = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  const verseParUser = {};
  for (const p of (dataCache?.paies || [])) {
    const id = p.beneficiaireId || p.beneficiairePerso || p.beneficiaireDiscord;
    if (id) verseParUser[id] = (verseParUser[id] || 0) + (p.montant || 0);
  }

  const actifs = users.filter(u => u.statut !== 'suspendu' && compteEnFinance(u.role));
  const direction = actifs.filter(u => isDirection(u.role) || u.role === 'drh');
  const respo     = actifs.filter(u => isResponsable(u.role));

  const ligne = (u) => {
    const verse = verseParUser[u.id] || 0;
    const estime = u.salaireDecide ?? PLAFOND_SALAIRE[u.role] ?? 0;
    const reste = estime - verse;
    if (reste <= 0) return `✓ ${u.prenom} ${u.nom} — déjà versé (${estime} $)`;
    return `• ${u.prenom} ${u.nom} — **${reste} $** à verser (estimé ${estime} $)`;
  };

  let total = 0;
  const restant = (u) => Math.max(0, (u.salaireDecide ?? PLAFOND_SALAIRE[u.role] ?? 0) - (verseParUser[u.id] || 0));
  [...direction, ...respo].forEach(u => total += restant(u));

  const txt = `📋 **RÉCAP SALAIRES — semaine ${fmtDate(debut)} au ${fmtDate(fin)}**
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

👑 **DIRECTION**
${direction.length ? direction.map(ligne).join('\n') : '_(aucun)_'}

🛒⛽ **RESPONSABLES**
${respo.length ? respo.map(ligne).join('\n') : '_(aucun)_'}

💵🚗 **VENDEURS / POMPISTES**
_Calcul automatique selon CA / quotas — voir RH sur le site pour le détail individuel._

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**TOTAL Direction + Responsables à verser : ${total} $**

_Source : LTD Sandy Shores — Comptabilité_`;

  try {
    await navigator.clipboard.writeText(txt);
    toastSuccess("Récap copié — tu peux le coller dans #paie sur Discord.");
  } catch (e) {
    console.error(e);
    toastError("Copie auto refusée. Voir console (F12) pour le texte.");
    console.log(txt);
  }
});

// === Exports ===
document.getElementById('btn-export-csv').addEventListener('click', async () => {
  const [ventes, depenses, paies, redistributions] = await Promise.all([
    listVentesSemaine(debut, fin), listDepensesSemaine(debut, fin), listPaiesSemaine(debut, fin),
    listRedistributionsSemaine(debut, fin).catch(() => [])
  ]);
  const ca = ventes.reduce((s, v) => s + (v.montant || 0), 0);
  const caCarburant = redistributions.reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const caTotal = ca + caCarburant;
  const dep = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const dedu = depenses.filter(d => d.deductible !== false).reduce((s, d) => s + (d.montant || 0), 0);
  const masse = paies.reduce((s, p) => s + (p.montant || 0), 0);

  const lines = [
    'Poste;Montant',
    `CA produits;${ca}`,
    `CA carburant;${caCarburant}`,
    `CA total;${caTotal}`,
    `Charges deductibles;${dedu}`,
    `Charges non deductibles;${dep - dedu}`,
    `Masse salariale;${masse}`,
    `Resultat imposable;${caTotal - dedu}`,
    `Benefice net;${caTotal - dep - masse}`
  ];
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `compta-${debut.toISOString().slice(0,10)}.csv`;
  a.click();
});

document.getElementById('btn-export-pdf').addEventListener('click', () => {
  window.print();
});

// ============================================================
// Comparaison Statsbank officiel vs nos calculs internes
// ============================================================
async function chargerStatsbank() {
  const zone = document.getElementById('statsbank-zone');
  const info = document.getElementById('statsbank-info');
  let stats = [];
  try {
    stats = await listStatsHebdoOfficielles(10);
  } catch (e) {
    zone.innerHTML = `<p class="alert warn">Impossible de lire les stats officielles. Le bot doit avoir parsé au moins un récap dans #statsbank (1 par semaine).</p>`;
    return;
  }
  if (stats.length === 0) {
    zone.innerHTML = `<p class="muted">Aucune stat officielle reçue pour l'instant. Le canal <code>#statsbank</code> du serveur FiveM publie 1 récap par semaine — rendez-vous lundi prochain.</p>`;
    info.textContent = '0 récap officiel';
    return;
  }
  info.textContent = `${stats.length} récap${stats.length > 1 ? 's' : ''} reçu${stats.length > 1 ? 's' : ''}`;

  // Charge nos /semaines pour comparaison
  const nosSemaines = await listSemaines(20).catch(() => []);
  const nosSemParId = nosSemaines.reduce((m, s) => {
    m[s.numero || s.id] = s;
    return m;
  }, {});

  // Pour chaque stat officielle, on essaie de matcher avec une /semaines
  // Match par dateDebut ou par numéro de semaine ISO de l'année
  const lignes = stats.map(off => {
    // Cherche match par numéro ISO ou par recouvrement temporel
    const match = nosSemaines.find(s => {
      const num = s.numero || s.id || '';
      return num.includes(`S${String(off.numeroSemaine).padStart(2, '0')}`) ||
             num.includes(`-${off.annee}`);
    }) || nosSemaines[0]; // fallback : la dernière semaine

    const ecartCa = match ? (off.ca - (match.ca || 0)) : null;
    const ecartSorties = match ? (off.sorties - (match.depenses || 0)) : null;
    const ecartBenefice = match ? (off.beneficeBrut - (match.beneficeBrut || 0)) : null;

    return { off, match, ecartCa, ecartSorties, ecartBenefice };
  });

  zone.innerHTML = `
    <table class="data" id="table-statsbank" style="font-size:0.85rem;">
      <thead>
        <tr>
          <th data-sort="semaine">Semaine FiveM</th>
          <th class="right" data-sort="caOff">CA officiel</th>
          <th class="right" data-sort="caInterne">Notre CA</th>
          <th class="right" data-sort="ecart">Écart CA</th>
          <th class="right" data-sort="solde">Solde actuel</th>
          <th class="right" data-sort="impot">Impôt estimé</th>
          <th class="center" data-sort="statut">Statut</th>
        </tr>
      </thead>
      <tbody>
        ${lignes.map(l => {
          const ec = l.ecartCa;
          const ecartCls = ec === null ? 'muted' :
                           Math.abs(ec) < 100 ? '' :
                           Math.abs(ec) < 1000 ? 'gold' : 'alerte-fort';
          const statut = ec === null ? '<span class="badge neutral">Pas de match</span>' :
                         Math.abs(ec) < 100 ? '<span class="badge ok">✓ Cohérent</span>' :
                         Math.abs(ec) < 1000 ? '<span class="badge warn">⚠ Léger écart</span>' :
                         '<span class="badge danger">🚨 Gros écart</span>';
          return `
            <tr>
              <td><strong>S${String(l.off.numeroSemaine).padStart(2,'0')}-${l.off.annee}</strong>${l.off.periode ? `<br><small class="muted">${escapeHtml(l.off.periode)}</small>` : ''}</td>
              <td class="right mono">${money(l.off.ca)}</td>
              <td class="right mono ${l.match ? '' : 'muted'}">${l.match ? money(l.match.ca || 0) : '—'}</td>
              <td class="right mono ${ecartCls}">${ec === null ? '—' : (ec >= 0 ? '+' : '') + money(ec)}</td>
              <td class="right mono">${money(l.off.soldeActuel)}</td>
              <td class="right mono" style="color:var(--color-warning);">${money(l.off.impotEstime)}<br><small class="muted">tr. ${l.off.trancheImpot || '?'} (${l.off.tauxImpot || '?'}%)</small></td>
              <td class="center">${statut}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
    <p class="muted mt-2" style="font-size:0.78rem;">
      💡 <strong>Si « Cohérent »</strong> partout : nos calculs internes sont validés par le serveur FiveM officiel. Audit IRS bétonné.<br>
      ⚠ <strong>Si « Gros écart »</strong> : il y a un écart significatif (> 1 000 $). Investigue : ventes manquantes, dépenses non parsées, paies non versées, etc.
    </p>
  `;
  makeSortable(document.getElementById('table-statsbank'));
}
chargerStatsbank();
