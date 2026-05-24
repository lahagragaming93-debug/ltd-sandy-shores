// ============================================================
// Page : Comptabilité — TTE Chap. IV — Secteur 2
// Refonte visuelle : KPIs colorés, salaires détaillés, templates rapides,
// récap Discord copiable.
// ============================================================

import { requireAuth, getCurrentUser } from '../auth.js';
import { renderShell, roleBadgeHtml } from '../layout.js';
import {
  listVentesSemaine, listDepensesSemaine, listPaiesSemaine, listSemaines,
  ajouterDepense, listUsers, listStatsHebdoOfficielles, listRedistributionsSemaine,
  listServicesSemaine, listQuotasSemaine, listQuotasVendeurSemaine, getConfig, listSubventionsSemaine
} from '../api.js';
import { money, num, pct, datetime, escapeHtml,
         startOfWeekRP, endOfWeekRP, weekId } from '../utils/formatters.js';
import { checkMasseSalariale, primeHebdo, primeMensuelle, salaireEstime,
         fabricationsFromQuotaDoc } from '../utils/paie.js';
import { isDirection, isVendeur, isPompiste, isResponsable, isSuperAdmin, compteEnFinance, ROLE_LABELS, PLAFOND_SALAIRE, DRH_SALAIRE_FIXE } from '../utils/permissions.js';
import { toastSuccess, toastError } from '../utils/toast.js';
import { wrapScroll, makeSortable } from '../utils/sortable-table.js';

const { profile } = await requireAuth('comptabilite');
const editable = isDirection(profile.role) || isSuperAdmin(profile.role);

const html = `
  <!-- KPIs colorés -->
  <div class="kpi-grid compta-kpis" id="kpis-compta">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <!-- Toolbar -->
  <div class="page-toolbar">
    <select id="select-semaine" title="Choisir la semaine" style="min-width:200px;">
      <option value="courante">Semaine en cours</option>
    </select>
    <button class="btn" id="btn-export-csv" title="Exporter en CSV" data-tooltip="Export CSV">Exporter CSV</button>
    <button class="btn" id="btn-export-pdf" title="Imprimer / Exporter en PDF" data-tooltip="Imprimer PDF">Imprimer</button>
    ${editable ? '<button class="btn" id="btn-refresh-dashboard" title="Rafraîchir le doc comptabilité (Dashboard + Dépenses + Ventes + Paies + résumé)" data-tooltip="Rafraîchir doc comptabilité">Recharger</button>' : ''}
    ${editable ? '<button class="btn" id="btn-cloturer-semaine" title="Clôturer la semaine précédente (dispo après dim 23h59)" data-tooltip="Clôturer la semaine précédente">Clôturer</button>' : ''}
    <span class="spacer"></span>
    ${editable ? '<button class="btn btn-primary" id="btn-add-depense" title="Ajouter une dépense" data-tooltip="Ajouter dépense">+ Ajouter</button>' : ''}
  </div>

  ${editable ? `
  <!-- Modal clôture semaine -->
  <div id="modal-cloture" class="modal-backdrop hidden">
    <div class="modal" style="max-width:580px;">
      <h3>Clôturer la semaine précédente</h3>
      <div class="alert ok" style="font-size:0.9rem;margin:8px 0;background:rgba(46,160,67,0.08);border-left:3px solid var(--color-green, #2ea043);">
        <strong>Semaine ciblée :</strong> <span id="cloture-semaine-cible" class="mono">—</span><br>
        <span class="muted" style="font-size:0.8rem;">Le bouton clôture toujours la <strong>dernière semaine terminée</strong> (lun → dim qui vient de finir), jamais la semaine en cours.</span>
      </div>
      <p class="muted" style="font-size:0.85rem;">
        Cette action fige les chiffres de la semaine ciblée dans <code>/semaines</code>.
        Les paies versées depuis lundi 00h00 sont aussi capturées. Le Dashboard sera rafraîchi.
      </p>
      <details style="font-size:0.78rem;margin:8px 0;">
        <summary class="muted" style="cursor:pointer;">Pourquoi pas avant dimanche 23h59 ?</summary>
        <p class="muted" style="margin-top:6px;">Tant que la semaine n'est pas finie, ses chiffres bougent encore (ventes en cours). On attend dim 23h59 pour avoir une semaine complète.</p>
      </details>
      <label style="display:flex;align-items:flex-start;gap:8px;cursor:pointer;margin-top:12px;">
        <input type="checkbox" id="cloture-confirmation-irs" style="margin-top:4px;" />
        <span><strong>Je confirme avoir soumis ma déclaration fiscale sur le site IRS</strong>
        <br><span class="muted" style="font-size:0.78rem;">(Art. 4-3.3 — déclaration à soumettre avant mardi 21h)</span></span>
      </label>
      <label class="mt-2">Note de clôture <span class="muted" style="font-size:0.75rem;">— optionnel</span></label>
      <input type="text" id="cloture-note" placeholder="Ex : Semaine standard, RAS." />
      <div class="row mt-3">
        <button class="btn btn-primary" id="btn-confirm-cloture" disabled>Clôturer définitivement</button>
        <button class="btn btn-ghost" id="btn-cancel-cloture">Annuler</button>
      </div>
    </div>
  </div>
  ` : ''}

  <!-- Bandeau conformité TTE (gauge masse salariale) -->
  <div class="panel mb-2" id="conformite-panel">
    <div class="panel-title"><span>Conformité TTE — Masse salariale</span></div>
    <div id="masse-gauge"></div>
  </div>

  <!-- Recettes / Dépenses (cartes en colonnes) -->
  <div class="compta-grid">
    <div class="panel framed compta-recettes">
      <div class="panel-title"><span>Recettes</span></div>
      <table class="data">
        <tbody id="tbody-recettes"><tr><td>Chargement…</td></tr></tbody>
      </table>
    </div>

    <div class="panel framed compta-depenses">
      <div class="panel-title"><span>Dépenses</span></div>
      <table class="data">
        <tbody id="tbody-depenses"><tr><td>Chargement…</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Salaires & paies (NOUVEAU) -->
  <div class="panel framed">
    <div class="panel-title">
      <span>Salaires & paies de la semaine</span>
      <button class="btn btn-sm" id="btn-copy-recap" title="Copier un récap formaté pour Discord" data-tooltip="Copier récap Discord">Copier récap</button>
    </div>
    <div id="salaires-zone"><p class="muted">Chargement…</p></div>
  </div>

  <!-- Comparaison Statsbank officiel vs nos calculs -->
  <div class="panel framed" id="panel-statsbank" style="border-color:var(--color-info);">
    <div class="panel-title">
      <span>Comparaison cross-source — Officiel FiveM vs nos calculs</span>
      <span class="muted" style="font-size:0.75rem;" id="statsbank-info">—</span>
    </div>
    <p class="muted" style="font-size:0.82rem;margin:4px 0 8px;">
      Les chiffres calculés par <strong>le serveur FiveM lui-même</strong> (canal <code>#statsbank</code>) sont stockés dans <code>statsHebdoOfficiels</code> et comparés avec nos calculs internes (<code>/semaines</code>). Tout écart est mis en évidence — utile pour audit IRS et détection d'anomalies.
    </p>
    <div id="statsbank-zone"><p class="muted">Chargement…</p></div>
  </div>

  <!-- Charges détaillées -->
  <div class="panel">
    <div class="panel-title">
      <span>Charges détaillées</span>
      <span class="muted" style="font-size:0.75rem;">— les lignes marquées "à classifier" attendent validation patron</span>
    </div>
    <div class="table-scroll">
      <table class="data" id="table-charges">
        <thead>
          <tr>
            <th data-sort="date">Date</th>
            <th data-sort="raison">Raison</th>
            <th data-sort="fournisseur">Fournisseur</th>
            <th data-sort="type">Type / Dédu</th>
            <th class="right" data-sort="montant">Montant</th>
            <th data-sort="utilisateur">Utilisateur</th>
            ${editable ? '<th class="center">Action</th>' : ''}
          </tr>
        </thead>
        <tbody id="tbody-charges"><tr><td colspan="${editable ? 7 : 6}" class="muted text-center">Chargement…</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Modal reclassification dépense -->
  <div id="modal-reclasser" class="modal-backdrop hidden">
    <div class="modal" style="max-width:600px;">
      <h3>Reclassifier la dépense</h3>
      <p class="muted" style="font-size:0.82rem;margin:0 0 12px;" id="reclasser-info">—</p>

      <label>Catégorie</label>
      <select id="reclasser-categorie">
        <option value="matieres-premieres">Matières premières (déductible)</option>
        <option value="frais-avocat">Frais avocat (déductible, max 30 000 $)</option>
        <option value="frais-comptabilite">Frais comptabilité (déductible, max 8 000 $)</option>
        <option value="entretien-vehicules">Entretien véhicules (déductible)</option>
        <option value="location-vehicule">Location véhicule (déductible)</option>
        <option value="achat-vehicule">Achat véhicule (déductible)</option>
        <option value="frais-vehicule">Frais véhicule / essence (déductible)</option>
        <option value="loyer">Loyer (déductible)</option>
        <option value="nourriture-employes">Nourriture employés (déductible jusqu'à 750 $/employé)</option>
        <option value="don-verse">Don versé (déductible 20% si > 50k)</option>
        <option value="subvention">Subvention reçue (non imposable)</option>
        <option value="autre-deductible">Autre déductible</option>
        <option value="decoration-locaux">Décoration locaux (non déductible)</option>
        <option value="non-deductible">Non déductible (autre)</option>
      </select>

      <div class="row" style="gap:8px;margin-top:8px;">
        <label style="flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="radio" name="reclasser-deductible" value="true" id="reclasser-dedu-oui" checked />
          Déductible
        </label>
        <label style="flex:1;display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="radio" name="reclasser-deductible" value="false" id="reclasser-dedu-non" />
          Non déductible
        </label>
      </div>

      <label class="mt-2">Justification (audit IRS) <span class="muted" style="font-size:0.75rem;">— optionnel</span></label>
      <input type="text" id="reclasser-raison" placeholder="Ex : Achat fournisseur matière 1ère pour revente" />

      <label class="mt-2">Note interne <span class="muted" style="font-size:0.75rem;">— optionnel, audit interne</span></label>
      <input type="text" id="reclasser-note" placeholder="Ex : confirmé avec patron Yootool" />

      <div style="border-top:1px solid var(--color-border, #ccc);margin-top:12px;padding-top:12px;">
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
          <input type="checkbox" id="reclasser-memoriser" />
          <strong>Mémoriser ce fournisseur</strong>
          <span class="muted" style="font-size:0.75rem;">— toutes les futures dépenses similaires seront auto-classées</span>
        </label>
        <div id="reclasser-memoriser-form" class="hidden" style="margin-top:8px;padding:8px;background:rgba(255,200,80,0.08);border-radius:4px;">
          <label style="font-size:0.8rem;"><strong>Ajouter à un pattern existant</strong> (recommandé si tu as déjà créé un fournisseur)</label>
          <select id="memoriser-pattern-existant">
            <option value="">— Créer un NOUVEAU pattern —</option>
          </select>

          <div id="memoriser-nouveau-fields">
            <label style="font-size:0.8rem;margin-top:8px;">Label fournisseur</label>
            <input type="text" id="memoriser-label" placeholder="Ex : HDM (Heavy Duty Motors)" />
            <label style="font-size:0.8rem;margin-top:4px;">Type de match</label>
            <select id="memoriser-matchtype">
              <option value="account-id-cible">Account ID compte cible (ex: 67978 pour HDM — recommandé)</option>
              <option value="compte-cible">Nom du compte cible (ex: HDM, Dynasty 8)</option>
              <option value="boutique-id">Numéro de boutique (ex: 263)</option>
              <option value="facture-id">Numéro de facture (ex: 1910769)</option>
              <option value="raison-regex">Regex sur la raison (ex: ^achat essence$)</option>
            </select>
          </div>

          <label style="font-size:0.8rem;margin-top:4px;">Valeur à matcher <span class="muted" style="font-size:0.7rem;">— sera ajoutée au pattern</span></label>
          <input type="text" id="memoriser-matchvalue" placeholder="Auto-rempli depuis la dépense" />
        </div>
      </div>

      <div class="row mt-3">
        <button class="btn btn-primary" id="btn-save-reclasser">Valider la classification</button>
        <button class="btn btn-ghost" id="btn-cancel-reclasser">Annuler</button>
      </div>
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

// v1.11.1 (perf CEF) : on lance listSemaines en parallele des 10 autres
// queries de chargerTout() via Promise.all (au lieu d'awaiter en sequence
// ce qui ajoutait ~150 ms sur tablette in-game). Le select se peuple a
// la fin du premier chargerTout().
const semainesPromise = listSemaines(6).catch(() => []);
let semainesPassees = [];
const sel = document.getElementById('select-semaine');

let users = [];
let dataCache = null; // pour le bouton "Copier récap"

async function chargerTout() {
  const semaineSel = sel.value;
  if (semaineSel !== 'courante') {
    const sm = semainesPassees.find(s => (s.id || s.numero) === semaineSel);
    if (sm) renderSemaineFigee(sm);
    return;
  }

  const [smList, ventes, depenses, paies, u, redistributions, services, quotas, quotasV, cfg, subventions] = await Promise.all([
    semainesPromise,
    listVentesSemaine(debut, fin).catch(() => []),
    listDepensesSemaine(debut, fin).catch(() => []),
    listPaiesSemaine(debut, fin).catch(() => []),
    listUsers().catch(() => []),
    listRedistributionsSemaine(debut, fin).catch(() => []),
    listServicesSemaine(debut, fin).catch(() => []),
    listQuotasSemaine(weekId()).catch(() => []),
    listQuotasVendeurSemaine(weekId()).catch(() => []),
    getConfig().catch(() => ({})),
    listSubventionsSemaine(debut, fin).catch(() => [])
  ]);
  // Peuple le select des semaines passees au premier passage (idempotent
  // grace au check children.length : on ne re-injecte pas les options).
  if (sel.children.length <= 1 && smList.length > 0) {
    semainesPassees = smList;
    smList.forEach(s => {
      const o = document.createElement('option');
      o.value = s.id || s.numero;
      o.textContent = `Semaine ${s.numero || s.dateDebut}`;
      sel.appendChild(o);
    });
  }
  users = u;
  // Cache les patterns fournisseurs pour la modale Reclasser
  window._cfgFournisseurs = cfg.fournisseurs || [];

  const ca = ventes.reduce((s, v) => s + (v.montant || 0), 0);
  const caCarburant = redistributions.reduce((s, r) => s + (Number(r.montant) || 0), 0);
  // CA carburant POMPISTE (sert au denominateur du ratio TTE) : exclut les
  // ventes NPC automatiques (source banqueLtd-redistribution) qui ne sont
  // liees a aucun employe. Avant le fix, ces ventes gonflaient le denominateur
  // et le ratio TTE paraissait artificiellement bas (= faux optimisme).
  const caCarburantPompiste = redistributions
    .filter(r => r.source === 'manuel-pompiste')
    .reduce((s, r) => s + (Number(r.montant) || 0), 0);
  // Subventions : recette NON IMPOSABLE (TTE Art. 4-2.16). Comptee dans le
  // benefice net (tresorerie reelle) mais PAS dans le resultat imposable.
  const totalSubventions = subventions.reduce((s, b) => s + (Number(b.montant) || 0), 0);
  const caTotal = ca + caCarburant;
  const caTotalTTE = ca + caCarburantPompiste;
  // Exclure les depenses type='paie' (doublon avec /paies attribuees a la
  // semaine precedente via fenetre post-cloture).
  const depensesHorsPaie = depenses.filter(d => d.type !== 'paie');
  const totalDepenses = depensesHorsPaie.reduce((s, d) => s + (d.montant || 0), 0);
  // Strict : on ne compte deductible QUE si le champ vaut explicitement true.
  // Anciennement : `!== false` qui traitait undefined/null comme deductible
  // (= optimiste vis-a-vis du fisc, risque d'audit IRS). Une depense sans
  // classification doit etre reclassifiee via la modale "Reclasser" avant
  // d'etre comptee comme deductible.
  const deductiblesDepenses = depensesHorsPaie.filter(d => d.deductible === true)
    .reduce((s, d) => s + (d.montant || 0), 0);
  const nonDeductibles = totalDepenses - deductiblesDepenses;

  // === Masse salariale PRÉVISIONNELLE ===
  // Au lieu de juste les paies versées, on calcule en continu le salaire
  // estimé de chaque user actif (Direction = fixe au plafond, Vendeur/Pompiste
  // = variable selon CA/quotas/heures). Ainsi le patron voit en temps réel
  // ce qu'il devra verser lundi-mardi prochain — pas seulement ce qu'il a
  // déjà versé.
  const masseVersee = paies.reduce((s, p) => s + (p.montant || 0), 0);
  let masseEstimee = 0;
  for (const usr of users.filter(x => compteEnFinance(x.role) && x.statut === 'actif')) {
    const myV = ventes.filter(v => v.vendeurId === usr.id);
    const myCaParticulier = myV.reduce((s, v) => s + (v.montantParticulier ?? v.montant ?? 0), 0);
    const q = quotas.find(qu => qu.employeId === usr.id) || { bidons: 0, caoutchoucs: 0 };
    const qv = quotasV.find(qu => qu.employeId === usr.id) || {};
    masseEstimee += salaireEstime({
      role: usr.role,
      caGenere: myCaParticulier,
      bidonsRealises: q.bidons,
      caoutchoucsRealises: q.caoutchoucs,
      fabrications: fabricationsFromQuotaDoc(qv),
      salaireDecide: usr.salaireDecide
    }, cfg);
  }
  // On utilise le MAX des 2 pour le contrôle TTE (sinon on peut tricher
  // en sous-payant). En pratique masseEstimee >= masseVersee tant que la
  // semaine n'est pas finie.
  const masseSalariale = Math.max(masseEstimee, masseVersee);
  // Charges deductibles TOTALES = depenses deductibles + masse salariale
  // (les salaires sont fiscalement deductibles, donc on les integre dans
  // la base de calcul du resultat imposable pour rester coherent).
  const deductibles = deductiblesDepenses + masseSalariale;
  const resultatImposable = caTotal - deductibles;
  // Benefice net inclut les subventions recues (tresorerie reelle).
  // Le resultat imposable, lui, ne les inclut pas (Art. 4-2.16 non imposable).
  const beneficeNet = caTotal + totalSubventions - totalDepenses - masseSalariale;
  // Ratio TTE base sur le CA OPERATIONNEL POMPISTE (exclut NPC auto).
  const masse = checkMasseSalariale(masseSalariale, caTotalTTE);

  const pHebdo = primeHebdo(caTotal);
  const pMensuel = primeMensuelle(beneficeNet);

  dataCache = { ca, caCarburant, caTotal, deductibles, deductiblesDepenses, nonDeductibles, masseSalariale, beneficeNet, paies, debut, fin, totalSubventions, subventions };

  // === KPIs colorés ===
  document.getElementById('kpis-compta').innerHTML = `
    <div class="kpi kpi-recette">
      <div class="label">CA produits</div>
      <div class="value">${money(ca)}</div>
      <div class="delta">${ventes.length} factures</div>
    </div>
    <div class="kpi kpi-recette">
      <div class="label">CA carburant</div>
      <div class="value">${money(caCarburant)}</div>
      <div class="delta">${redistributions.length} ventes essence</div>
    </div>
    ${totalSubventions > 0 ? `
    <div class="kpi kpi-recette" title="Subventions reçues — non imposable (TTE Art. 4-2.16). Comptée dans le bénéfice net mais hors résultat imposable.">
      <div class="label">Subventions reçues</div>
      <div class="value">${money(totalSubventions)}</div>
      <div class="delta">${subventions.length} virement(s) — non imposable</div>
    </div>
    ` : ''}
    <div class="kpi kpi-depense" title="Charges deductibles totales = depenses deductibles (${money(deductiblesDepenses)}) + masse salariale estimee (${money(masseSalariale)}). Les salaires sont fiscalement deductibles.">
      <div class="label">Charges déductibles</div>
      <div class="value">${money(deductibles)}</div>
      <div class="delta">dont ${money(masseSalariale)} salaires · imposable: ${money(resultatImposable)}</div>
    </div>
    <div class="kpi kpi-salaire" title="Prévisionnel = somme des salaires estimés (Direction fixe + Vendeur/Pompiste selon CA/quotas en temps réel). Versé = paies réellement déjà payées.">
      <div class="label">Masse salariale</div>
      <div class="value">${money(masseSalariale)}</div>
      <div class="delta ${masse.ok ? 'up' : 'down'}">${pct(masse.ratio*100, 1)} ${masse.ok ? '' : 'HORS TTE'} · ${money(masseVersee)} déjà versé</div>
    </div>
    <div class="kpi ${beneficeNet >= 0 ? 'kpi-benefice' : 'kpi-perte'}">
      <div class="label">${beneficeNet >= 0 ? 'Bénéfice net' : 'Perte'}</div>
      <div class="value">${money(beneficeNet)}</div>
      <div class="delta ${beneficeNet >= 0 ? 'up' : 'down'}">après salaires</div>
    </div>
  `;

  // === Recettes ===
  // Les subventions sont affichees a part (non imposable) — incluses dans le
  // total tresorerie mais le resultat imposable reste base sur le CA seul.
  document.getElementById('tbody-recettes').innerHTML = `
    <tr><td>Chiffre d'affaires (ventes produits)</td><td class="right mono">${money(ca)}</td></tr>
    <tr><td>Chiffre d'affaires (ventes carburant)</td><td class="right mono">${money(caCarburant)}</td></tr>
    <tr class="row-total"><td>Total CA imposable</td><td class="right mono">${money(caTotal)}</td></tr>
    ${totalSubventions > 0 ? `
      <tr><td colspan="2" style="padding-top:8px;"><strong>Subventions reçues</strong> <span class="muted" style="font-size:0.78rem;">— non imposable (TTE Art. 4-2.16)</span></td></tr>
      ${subventions.map(s => `
        <tr>
          <td><span class="muted">${datetime(s.timestamp)}</span> ${escapeHtml(s.raison || 'Subvention')}</td>
          <td class="right mono">${money(s.montant)}</td>
        </tr>
      `).join('')}
      <tr class="row-total"><td>Total trésorerie (CA + subventions)</td><td class="right mono">${money(caTotal + totalSubventions)}</td></tr>
    ` : ''}
  `;

  // === Dépenses ===
  // NB : "Charges deductibles (hors salaires)" = uniquement les /depenses
  // marquees deductible. La ligne "Salaires versés" est detaillee a part pour
  // visibilite, mais entre dans le calcul du resultat imposable (cf. KPI
  // "Charges deductibles" qui agrege les deux).
  document.getElementById('tbody-depenses').innerHTML = `
    <tr><td>Charges déductibles (hors salaires)</td><td class="right mono">${money(deductiblesDepenses)}</td></tr>
    <tr><td>Charges non déductibles</td><td class="right mono">${money(nonDeductibles)}</td></tr>
    <tr><td>Salaires versés (déductibles)</td><td class="right mono">${money(masseSalariale)}</td></tr>
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
  // Le tableau affiche uniquement les VRAIES dépenses (hors paies en doublon).
  // Chaque ligne montre :
  //   - Date, Raison
  //   - Fournisseur identifié (via /config/global.fournisseurs) ou "—"
  //   - Type + badge déductibilité + indicateur validation patron
  //   - Bouton reclassifier (direction uniquement)
  const usersById = users.reduce((m, u) => (m[u.id] = u, m), {});
  const tbody = document.getElementById('tbody-charges');
  const colspan = editable ? 7 : 6;
  if (depensesHorsPaie.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${colspan}" class="muted text-center">Aucune dépense saisie cette semaine.</td></tr>`;
  } else {
    tbody.innerHTML = depensesHorsPaie.map(d => {
      const u = usersById[d.utilisateurId];
      const isValide = d.valideParPatron === true;
      const isAClassifier = d.type === 'a-classifier' || (!d.fournisseurLabel && !isValide);
      const fournisseur = d.fournisseurLabel
        ? `<span class="badge ok" title="${escapeHtml(d.raisonClassification || '')}">${escapeHtml(d.fournisseurLabel)}</span>`
        : '<span class="muted">—</span>';
      const typeBadge = d.deductible !== false
        ? '<span class="badge ok">Déductible</span>'
        : '<span class="badge neutral">Non déductible</span>';
      const statutValid = isValide
        ? '<span class="badge ok" title="Validé par patron">Validé</span>'
        : isAClassifier
          ? '<span class="badge warn" title="À classifier — suggestion auto en attente de validation patron">À classifier</span>'
          : '<span class="badge neutral" title="Suggestion auto, pas encore validée">Suggestion</span>';
      const actionBtn = editable
        ? `<td class="center"><button class="btn btn-sm" data-reclasser-id="${d.id}">Reclasser</button></td>`
        : '';
      return `
        <tr>
          <td>${datetime(d.timestamp)}</td>
          <td>${escapeHtml(d.raison || '')}</td>
          <td>${fournisseur}</td>
          <td>${typeBadge} ${statutValid} <span class="muted" style="font-size:0.72rem;">${escapeHtml(d.type || '')}</span></td>
          <td class="right mono">${money(d.montant)}</td>
          <td>${u ? escapeHtml(u.prenom + ' ' + u.nom) : escapeHtml(d.utilisateur || '—')}</td>
          ${actionBtn}
        </tr>
      `;
    }).join('');

    // Branchement du bouton Reclassifier
    if (editable) {
      tbody.querySelectorAll('[data-reclasser-id]').forEach(btn => {
        btn.addEventListener('click', () => {
          const depenseId = btn.dataset.reclasserId;
          const dep = depensesHorsPaie.find(x => x.id === depenseId);
          if (dep) ouvrirModalReclasser(dep);
        });
      });
    }
  }

  // === Conformité (gauge) ===
  // Gauge : on passe caTotalTTE pour rester coherent avec le ratio affiche.
  renderGaugeMasse(masse, masseSalariale, caTotalTTE);
}

// ============================================================
// MODAL — Reclassifier une dépense (validation patron)
// ============================================================
let depenseEnCoursReclasser = null;
function ouvrirModalReclasser(dep) {
  depenseEnCoursReclasser = dep;
  const info = document.getElementById('reclasser-info');
  const compteCibleInfo = dep.compteCibleNom
    ? `<br>Compte cible identifié : <strong>${escapeHtml(dep.compteCibleNom)}</strong>${dep.compteCibleAccountId ? ` <span class="mono muted">(ID ${escapeHtml(dep.compteCibleAccountId)})</span>` : ''}`
    : '';
  info.innerHTML = `
    <strong>${escapeHtml(dep.raison || '')}</strong><br>
    <span class="muted">Montant : <strong>${money(dep.montant || 0)}</strong> · par ${escapeHtml(dep.utilisateur || '—')} · ${datetime(dep.timestamp)}</span>
    ${compteCibleInfo}
    ${dep.fournisseurLabel ? `<br>Suggestion auto : <strong>${escapeHtml(dep.fournisseurLabel)}</strong> (${escapeHtml(dep.raisonClassification || '')})` : ''}
  `;
  document.getElementById('reclasser-categorie').value = dep.type || 'a-classifier';
  document.getElementById(dep.deductible !== false ? 'reclasser-dedu-oui' : 'reclasser-dedu-non').checked = true;
  document.getElementById('reclasser-raison').value = dep.raisonClassification || '';
  document.getElementById('reclasser-note').value = dep.noteAudit || '';
  document.getElementById('reclasser-memoriser').checked = false;
  document.getElementById('reclasser-memoriser-form').classList.add('hidden');

  // Remplit le select "Ajouter à un pattern existant" avec les patterns en cfg
  const selectExistant = document.getElementById('memoriser-pattern-existant');
  selectExistant.innerHTML = '<option value="">— Créer un NOUVEAU pattern —</option>';
  const patternsExistants = (window._cfgFournisseurs || []);
  for (const p of patternsExistants) {
    const valueTronquee = String(p.matchValue || '').length > 40
      ? String(p.matchValue).slice(0, 40) + '…'
      : String(p.matchValue || '');
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = `${p.label} (${p.matchType}=${valueTronquee})`;
    opt.dataset.matchType = p.matchType;
    opt.dataset.categorie = p.categorie;
    opt.dataset.deductible = p.deductible ? '1' : '0';
    selectExistant.appendChild(opt);
  }
  selectExistant.value = ''; // par défaut, nouveau pattern

  // Pré-remplissage du formulaire mémoriser : on privilégie le compte cible
  // identifié (plus stable que boutiqueId/factureId pour les paiements de
  // facture, et permet d'auto-classer toutes les futures factures du même
  // destinataire).
  const memLabel = document.getElementById('memoriser-label');
  const memType  = document.getElementById('memoriser-matchtype');
  const memValue = document.getElementById('memoriser-matchvalue');
  memLabel.value = dep.fournisseurLabel || dep.compteCibleNom || '';
  if (dep.compteCibleAccountId) {
    // Phase 3 — le plus fiable : accountId unique du destinataire
    memType.value = 'account-id-cible';
    memValue.value = dep.compteCibleAccountId;
  } else if (dep.compteCibleNom) {
    memType.value = 'compte-cible';
    memValue.value = dep.compteCibleNom;
  } else if (dep.boutiqueId) {
    memType.value = 'boutique-id';
    memValue.value = dep.boutiqueId;
  } else if (dep.factureId) {
    memType.value = 'facture-id';
    memValue.value = dep.factureId;
  } else {
    memType.value = 'raison-regex';
    memValue.value = '';
  }

  document.getElementById('modal-reclasser').classList.remove('hidden');
}

document.getElementById('btn-cancel-reclasser')?.addEventListener('click', () => {
  document.getElementById('modal-reclasser').classList.add('hidden');
  depenseEnCoursReclasser = null;
});

document.getElementById('reclasser-memoriser')?.addEventListener('change', (e) => {
  document.getElementById('reclasser-memoriser-form').classList.toggle('hidden', !e.target.checked);
});

// Quand on choisit un pattern existant dans le select, masquer les champs
// "nouveau pattern" (Label + Type match) car on hérite du pattern existant.
document.getElementById('memoriser-pattern-existant')?.addEventListener('change', (e) => {
  const ajouterAExistant = !!e.target.value;
  document.getElementById('memoriser-nouveau-fields').style.display = ajouterAExistant ? 'none' : '';
});

document.getElementById('btn-save-reclasser')?.addEventListener('click', async () => {
  if (!depenseEnCoursReclasser) return;
  const categorie = document.getElementById('reclasser-categorie').value;
  const deductible = document.getElementById('reclasser-dedu-oui').checked;
  const raisonClassification = document.getElementById('reclasser-raison').value.trim();
  const noteAudit = document.getElementById('reclasser-note').value.trim();
  const memoriser = document.getElementById('reclasser-memoriser').checked;

  const payload = {
    depenseId: depenseEnCoursReclasser.id,
    categorie,
    deductible,
    raisonClassification,
    noteAudit
  };

  if (memoriser) {
    const patternExistantId = document.getElementById('memoriser-pattern-existant').value;
    const matchValue = document.getElementById('memoriser-matchvalue').value.trim();
    if (!matchValue) {
      toastError('Valeur à matcher requise pour mémoriser');
      return;
    }
    if (patternExistantId) {
      // Mode "ajouter au pattern existant" : on indique juste l'id + la nouvelle valeur
      payload.memoriserPattern = {
        action: 'ajouter-au-pattern',
        patternIdExistant: patternExistantId,
        matchValue
      };
    } else {
      // Mode "créer un nouveau pattern"
      const label = document.getElementById('memoriser-label').value.trim();
      const matchType = document.getElementById('memoriser-matchtype').value;
      if (!label) {
        toastError('Label requis pour créer un nouveau pattern');
        return;
      }
      payload.memoriserPattern = {
        id: label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        label,
        matchType,
        matchValue
      };
    }
  }

  try {
    const { auth } = await import('../firebase-config.js');
    const idToken = await auth.currentUser.getIdToken();
    const url = `https://europe-west1-ltd-sandy-shores-f3919.cloudfunctions.net/reclasserDepense`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify(payload)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json.error || `HTTP ${resp.status}`);
    toastSuccess('Dépense reclassifiée');
    document.getElementById('modal-reclasser').classList.add('hidden');
    depenseEnCoursReclasser = null;
    await chargerTout();
  } catch (e) {
    toastError(e.message || 'Erreur reclassification');
  }
});

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
    if (u.role === 'drh') {
      // DRH : salaire FIXE 18 000 \$ (decision patron 2026-05-14)
      estime = DRH_SALAIRE_FIXE;
      source = '<span class="badge ok">fixe imposé</span>';
    } else if (isDirection(u.role) || u.role === 'responsable-pompiste' || u.role === 'responsable-vente') {
      // Patron / Co-Patron / Resp Pompiste : salaire decide
      // Si salaireDecide est 0 (saisi par erreur) on bascule au plafond pour ne pas
      // afficher 0 \$ en compta — l'utilisateur peut toujours l'editer en RH.
      const decide = u.salaireDecide;
      estime = (decide != null && decide > 0) ? decide : plafond;
      source = (decide != null && decide > 0)
        ? '<span class="badge ok">décidé</span>'
        : '<span class="badge warn">plafond par défaut</span>';
    } else {
      estime = null; // vendeurs/pompistes : calcule en RH selon CA/quotas
      source = '<span class="badge neutral">auto (RH)</span>';
    }
    const reste = (estime ?? 0) - verse;
    const restoLabel = estime == null
      ? '<span class="muted">— voir RH</span>'
      : (reste > 0
          ? `<span class="reste-a-verser">${money(reste)}</span>`
          : (reste < 0
              ? `<span class="reste-trop">+${money(-reste)} en trop</span>`
              : '<span class="reste-ok">Versé</span>'));
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
      if (u.role === 'drh') return s + DRH_SALAIRE_FIXE;
      if (isDirection(u.role) || u.role === 'responsable-pompiste' || u.role === 'responsable-vente') {
        const decide = u.salaireDecide;
        return s + ((decide != null && decide > 0) ? decide : PLAFOND_SALAIRE[u.role] || 0);
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
      <span>
        <strong>Direction / Responsables</strong> : salaire fixe (décidé via RH).<br>
        <strong>Vendeurs / Pompistes</strong> : calcul automatique selon CA / quotas — détail par employé dans <a href="rh.html">Ressources humaines</a>.<br>
        Le bouton <strong>Copier récap</strong> en haut à droite prépare un message formaté à coller dans <code>#paie</code>.
      </span>
    </div>
    ${sectionGroupe('Direction', direction)}
    ${sectionGroupe('Responsables', respo)}
    ${sectionGroupe('Vendeurs', vendeurs, false)}
    ${sectionGroupe('Pompistes', pompistes, false)}
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
    ? '<span class="badge danger">HORS TTE</span> masse salariale supérieure à 90 % du CA'
    : (masse.alerte
        ? '<span class="badge warn">ATTENTION</span> masse salariale entre 85 % et 90 %'
        : '<span class="badge ok">OK</span> masse salariale dans les limites TTE');
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

async function renderSemaineFigee(s) {
  // KPIs depuis le snapshot fige
  document.getElementById('kpis-compta').innerHTML = `
    <div class="kpi kpi-recette"><div class="label">CA</div><div class="value">${money(s.ca)}</div><div class="delta">${s.statut || 'figée'}</div></div>
    <div class="kpi kpi-recette"><div class="label">CA carburant</div><div class="value">${money(s.caCarburant || 0)}</div><div class="delta">inclus dans CA</div></div>
    <div class="kpi kpi-depense"><div class="label">Dépenses (hors salaires)</div><div class="value">${money(s.depenses)}</div><div class="delta">${s.chargesDeductibles ? money(s.chargesDeductibles) + ' déductibles' : ''}</div></div>
    <div class="kpi kpi-salaire"><div class="label">Salaires</div><div class="value">${money(s.masseSalariale)}</div><div class="delta">versés post-cloture</div></div>
    <div class="kpi ${s.benefice >= 0 ? 'kpi-benefice' : 'kpi-perte'}"><div class="label">${s.benefice >= 0 ? 'Bénéfice' : 'Perte'}</div><div class="value">${money(s.benefice)}</div><div class="delta ${s.benefice>=0?'up':'down'}">cloturé</div></div>
  `;

  // Recettes : split produits / carburant
  document.getElementById('tbody-recettes').innerHTML = `
    <tr><td>CA produits</td><td class="right mono">${money(s.caProduits || (s.ca - (s.caCarburant || 0)))}</td></tr>
    <tr><td>CA carburant</td><td class="right mono">${money(s.caCarburant || 0)}</td></tr>
    <tr class="row-total"><td>Total recettes</td><td class="right mono">${money(s.ca)}</td></tr>
  `;

  // Recharge dynamiquement les paies + depenses pour afficher les details.
  // /paies utilise la fenetre post-cloture (mardi 21h max) via listPaiesSemaine.
  const debut = s.dateDebut?.toDate?.() || new Date(s.dateDebut);
  const fin   = s.dateFin?.toDate?.()   || new Date(s.dateFin);
  const [paiesDetail, depensesDetail] = await Promise.all([
    listPaiesSemaine(debut, fin).catch(() => []),
    listDepensesSemaine(debut, fin).catch(() => [])
  ]);
  const depHorsPaie = depensesDetail.filter(d => d.type !== 'paie');
  const totDep = depHorsPaie.reduce((sum, d) => sum + (d.montant || 0), 0);

  document.getElementById('tbody-depenses').innerHTML = `
    <tr><td>Charges (hors salaires)</td><td class="right mono">${money(totDep)}</td></tr>
    <tr><td>Salaires versés</td><td class="right mono">${money(s.masseSalariale || 0)}</td></tr>
    <tr class="row-total"><td>Total dépenses + salaires</td><td class="right mono">${money(totDep + (s.masseSalariale || 0))}</td></tr>
  `;

  // Detail des salaires
  if (paiesDetail.length === 0) {
    document.getElementById('salaires-zone').innerHTML =
      `<p class="muted">Aucune paie versée pour cette semaine (fenêtre post-cloture vide).</p>`;
  } else {
    const usersById = users.reduce((m, u) => (m[u.id] = u, m), {});
    document.getElementById('salaires-zone').innerHTML = `
      <table class="data" style="margin-top:6px;">
        <thead><tr>
          <th>Date</th><th>Bénéficiaire</th><th class="right">Montant</th>
        </tr></thead>
        <tbody>
          ${paiesDetail.map(p => {
            const u = usersById[p.beneficiaireId];
            const nom = u ? `${u.prenom} ${u.nom}` : (p.beneficiaireNom || p.beneficiaireDiscord || '—');
            return `<tr>
              <td class="mono">${datetime(p.timestamp)}</td>
              <td>${escapeHtml(nom)}</td>
              <td class="right mono">${money(p.montant)}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  // Detail des charges (depenses hors paies)
  if (depHorsPaie.length === 0) {
    document.getElementById('tbody-charges').innerHTML =
      `<tr><td colspan="5" class="muted text-center">Aucune dépense cette semaine.</td></tr>`;
  } else {
    const usersById = users.reduce((m, u) => (m[u.id] = u, m), {});
    document.getElementById('tbody-charges').innerHTML = depHorsPaie.map(d => {
      const u = usersById[d.utilisateurId];
      return `
        <tr>
          <td>${datetime(d.timestamp)}</td>
          <td>${escapeHtml(d.raison || '')}</td>
          <td><span class="badge ${d.deductible !== false ? 'ok' : 'neutral'}">${d.deductible !== false ? 'Déductible' : 'Non déductible'}</span></td>
          <td class="right mono">${money(d.montant)}</td>
          <td>${escapeHtml(u ? (u.prenom + ' ' + u.nom) : (d.utilisateur || '—'))}</td>
        </tr>
      `;
    }).join('');
  }

  // Gauge masse salariale
  const masseRatio = s.ca > 0 ? (s.masseSalariale / s.ca) : 0;
  renderGaugeMasse({ ratio: masseRatio, ok: masseRatio <= 0.9, alerte: masseRatio > 0.85 && masseRatio <= 0.9 }, s.masseSalariale, s.ca);
}

sel.addEventListener('change', chargerTout);
chargerTout();

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
    let estime;
    if (u.role === 'drh') estime = DRH_SALAIRE_FIXE;
    else {
      const decide = u.salaireDecide;
      estime = (decide != null && decide > 0) ? decide : (PLAFOND_SALAIRE[u.role] ?? 0);
    }
    const reste = estime - verse;
    if (reste <= 0) return `✓ ${u.prenom} ${u.nom} — déjà versé (${estime} $)`;
    return `• ${u.prenom} ${u.nom} — **${reste} $** à verser (estimé ${estime} $)`;
  };

  let total = 0;
  const restant = (u) => {
    const estime = u.role === 'drh'
      ? DRH_SALAIRE_FIXE
      : ((u.salaireDecide != null && u.salaireDecide > 0) ? u.salaireDecide : (PLAFOND_SALAIRE[u.role] ?? 0));
    return Math.max(0, estime - (verseParUser[u.id] || 0));
  };
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
  const [ventes, depenses, paies, redistributions, subv] = await Promise.all([
    listVentesSemaine(debut, fin), listDepensesSemaine(debut, fin), listPaiesSemaine(debut, fin),
    listRedistributionsSemaine(debut, fin).catch(() => []),
    listSubventionsSemaine(debut, fin).catch(() => [])
  ]);
  const ca = ventes.reduce((s, v) => s + (v.montant || 0), 0);
  const caCarburant = redistributions.reduce((s, r) => s + (Number(r.montant) || 0), 0);
  const caTotal = ca + caCarburant;
  const totalSubv = subv.reduce((s, b) => s + (Number(b.montant) || 0), 0);
  const dep = depenses.reduce((s, d) => s + (d.montant || 0), 0);
  const dedu = depenses.filter(d => d.deductible !== false).reduce((s, d) => s + (d.montant || 0), 0);
  const masse = paies.reduce((s, p) => s + (p.montant || 0), 0);

  const lines = [
    'Poste;Montant',
    `CA produits;${ca}`,
    `CA carburant;${caCarburant}`,
    `CA total;${caTotal}`,
    `Subventions recues (non imposable);${totalSubv}`,
    `Charges deductibles;${dedu}`,
    `Charges non deductibles;${dep - dedu}`,
    `Masse salariale;${masse}`,
    `Resultat imposable;${caTotal - dedu}`,
    `Benefice net (avec subventions);${caTotal + totalSubv - dep - masse}`
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
                         Math.abs(ec) < 100 ? '<span class="badge ok">Cohérent</span>' :
                         Math.abs(ec) < 1000 ? '<span class="badge warn">Léger écart</span>' :
                         '<span class="badge danger">Gros écart</span>';
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
      <strong>Si « Cohérent »</strong> partout : nos calculs internes sont validés par le serveur FiveM officiel. Audit IRS bétonné.<br>
      <strong>Si « Gros écart »</strong> : il y a un écart significatif (> 1 000 $). Investigue : ventes manquantes, dépenses non parsées, paies non versées, etc.
    </p>
  `;
  makeSortable(document.getElementById('table-statsbank'));
}
chargerStatsbank();


// ============================================================
// Bouton 🔄 Rafraîchir doc comptabilité (Dashboard + 4 feuilles data)
// ============================================================
document.getElementById("btn-refresh-dashboard")?.addEventListener("click", async () => {
  const btn = document.getElementById("btn-refresh-dashboard");
  btn.disabled = true;
  const ancien = btn.textContent;
  btn.textContent = "…";
  try {
    const { auth } = await import("../firebase-config.js");
    const idToken = await auth.currentUser.getIdToken();
    const resp = await fetch("https://europe-west1-ltd-sandy-shores-f3919.cloudfunctions.net/refreshDashboardNow", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken },
      body: "{}"
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json.error || `HTTP ${resp.status}`);
    toastSuccess(`Dashboard rafraîchi (${json.rowCount} lignes)`);
  } catch (e) {
    toastError(e.message || "Erreur refresh Dashboard");
  } finally {
    btn.disabled = false;
    btn.textContent = ancien;
  }
});

// ============================================================
// Bouton 🔒 Clôturer la semaine
// ============================================================
function isPostDimancheSoir() {
  // Clôture possible uniquement à partir de lundi 00h00 (en France)
  // = dimanche soir 23h59 passé
  const now = new Date();
  const day = now.getDay(); // 0=dim, 1=lun, ...
  if (day === 0) {
    // Dimanche : OK uniquement après 23h59
    return now.getHours() === 23 && now.getMinutes() >= 59;
  }
  return day >= 1; // lundi à samedi : OK
}

document.getElementById("btn-cloturer-semaine")?.addEventListener("click", () => {
  if (!isPostDimancheSoir()) {
    toastError("Patience : la semaine en cours n'est pas terminée. Attends dimanche 23h59 pour clôturer.");
    return;
  }
  // Calcule la semaine cible = derniere semaine terminee (lun-dim avant aujourdhui)
  const refSemPrec = new Date();
  refSemPrec.setDate(refSemPrec.getDate() - 7);
  const debutCible = startOfWeekRP(refSemPrec);
  const finCible = endOfWeekRP(refSemPrec);
  const fmt = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  document.getElementById("cloture-semaine-cible").textContent =
    `lun ${fmt(debutCible)} → dim ${fmt(finCible)}`;

  document.getElementById("modal-cloture").classList.remove("hidden");
  document.getElementById("cloture-confirmation-irs").checked = false;
  document.getElementById("cloture-note").value = "";
  document.getElementById("btn-confirm-cloture").disabled = true;
});

document.getElementById("cloture-confirmation-irs")?.addEventListener("change", (e) => {
  document.getElementById("btn-confirm-cloture").disabled = !e.target.checked;
});

document.getElementById("btn-cancel-cloture")?.addEventListener("click", () => {
  document.getElementById("modal-cloture").classList.add("hidden");
});

document.getElementById("btn-confirm-cloture")?.addEventListener("click", async () => {
  const confirmationIRS = document.getElementById("cloture-confirmation-irs").checked;
  const noteCloture = document.getElementById("cloture-note").value.trim();
  if (!confirmationIRS) {
    toastError("Tu dois confirmer avoir fait la déclaration IRS");
    return;
  }
  const btn = document.getElementById("btn-confirm-cloture");
  btn.disabled = true; btn.textContent = "Clôture en cours…";
  try {
    const { auth } = await import("../firebase-config.js");
    const idToken = await auth.currentUser.getIdToken();
    const resp = await fetch("https://europe-west1-ltd-sandy-shores-f3919.cloudfunctions.net/cloturerSemaine", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + idToken },
      body: JSON.stringify({ confirmationIRS, noteCloture })
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json.error || `HTTP ${resp.status}`);
    toastSuccess(json.message || `Semaine clôturée (CA ${json.ca}$, bénéfice net ${json.beneficeNet}$).`);
    document.getElementById("modal-cloture").classList.add("hidden");
    setTimeout(() => window.location.reload(), 1500);
  } catch (e) {
    toastError(e.message || "Erreur clôture");
    btn.disabled = false; btn.textContent = "Clôturer définitivement";
  }
});

