// ============================================================
// Page : Ressources humaines
// ============================================================

import { requireAuth } from '../auth.js';
import { renderShell } from '../layout.js';
import {
  listUsers, listVentesSemaine, listVentesSemaineIncluantCachees, listServicesSemaine, listQuotasSemaine,
  listPaiesSemaine, getConfig, updateUser, listRedistributionsSemaine
} from '../api.js';
import { ROLE_LABELS, isVendeur, isPompiste, isResponsable, isDirection,
         isSuperAdmin, compteEnFinance, PLAFOND_SALAIRE } from '../utils/permissions.js';
import { salaireEstime, scorePompiste, checkMasseSalariale } from '../utils/paie.js';
import { money, num, pct, datetime, escapeHtml,
         startOfWeekRP, endOfWeekRP, weekId, durationHM } from '../utils/formatters.js';
import { toastSuccess, toastError } from '../utils/toast.js';
import { wrapScroll, makeSortable } from '../utils/sortable-table.js';

const { profile } = await requireAuth('rh');
const editable = isDirection(profile.role) || isSuperAdmin(profile.role) || profile.role === 'drh';

const html = `
  <div class="page-toolbar" style="flex-wrap:wrap;gap:8px;">
    <select id="filtre-semaine" title="Semaine à afficher pour les estimations de salaire">
      <option value="courante">Cette semaine (en cours)</option>
      <option value="precedente">Semaine précédente (à payer)</option>
    </select>
    <span id="badge-semaine" class="muted mono" style="font-size:0.78rem;align-self:center;">—</span>
  </div>

  <div class="kpi-grid" id="kpis-rh">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div class="page-toolbar">
    <select id="filtre-role" title="Filtrer par rôle">
      <option value="">Tous rôles</option>
      ${Object.entries(ROLE_LABELS).map(([k,l]) => `<option value="${k}">${l}</option>`).join('')}
    </select>
    <select id="filtre-statut" title="Filtrer par statut">
      <option value="">Tous statuts</option>
      <option value="actif">Actifs</option>
      <option value="suspendu">Suspendus</option>
    </select>
    <input type="text" id="filtre-recherche" placeholder="🔍 Rechercher (nom, Discord)" style="flex:1;min-width:160px;" />
  </div>

  <div class="panel framed">
    <div class="panel-title"><span id="titre-effectif">Effectif</span></div>
    <div class="table-scroll">
      <table class="data" id="table-rh">
        <thead>
          <tr>
            <th data-sort="nom">Nom</th>
            <th data-sort="role">Rôle</th>
            <th data-sort="discord">ID Discord</th>
            <th class="right" data-sort="heures">Heures</th>
            <th class="right" data-sort="caQuota">CA / Quota</th>
            <th class="right" data-sort="salaire">Salaire estimé</th>
            <th data-sort="statut">Statut</th>
            <th class="center">Actions</th>
          </tr>
        </thead>
        <tbody id="tbody-rh"><tr><td colspan="8" class="muted text-center">Chargement…</td></tr></tbody>
      </table>
    </div>
  </div>

  <div class="panel">
    <div class="panel-title"><span>Activité de la semaine</span></div>
    <div id="activite">—</div>
  </div>

  <!-- Modal détail employé -->
  <div id="modal-employe" class="modal-backdrop hidden">
    <div class="modal" style="max-width: 920px;max-height:92vh;overflow-y:auto;">
      <h3 id="emp-nom">—</h3>
      <div id="emp-content">—</div>
      <div class="row mt-3">
        ${editable ? '<button class="btn btn-primary" id="btn-decide-salaire" title="Décider un salaire fixe (responsables/direction)">💰 Décider salaire</button>' : ''}
        <button class="btn" id="btn-voir-espace" title="Ouvrir l'espace personnel de cet employé (lecture seule, debug)">👁 Voir son espace</button>
        <button class="btn btn-ghost" id="btn-close-emp">Fermer</button>
      </div>
    </div>
  </div>
`;
renderShell(profile, 'rh', html);

makeSortable(document.getElementById('table-rh'));

// === Bornes semaine — courante ou precedente selon le toggle ===
// La semaine RP = lundi 00:00 -> dimanche 23:59. La semaine "precedente" est
// utilisee chaque lundi matin par le patron pour voir les salaires a verser
// suite a la cloture automatique de 00:00 (cron clotureHebdo).
function bornesSemaine(choix) {
  if (choix === 'precedente') {
    const refSemPrec = new Date();
    refSemPrec.setDate(refSemPrec.getDate() - 7);
    return {
      debut: startOfWeekRP(refSemPrec),
      fin:   endOfWeekRP(refSemPrec),
      wId:   weekId(refSemPrec)
    };
  }
  return { debut: startOfWeekRP(), fin: endOfWeekRP(), wId: weekId() };
}

function labelSemaine(debut, fin) {
  const fmt = (d) => d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return `${fmt(debut)} → ${fmt(fin)}`;
}

let users = [], ventes = [], ventesAvecCachees = [], services = [],
    quotas = [], paies = [], config = {}, redistributions = [];
let debut, fin, wId;
let metricsByUser = {};

async function chargerSemaine(choix) {
  ({ debut, fin, wId } = bornesSemaine(choix));
  document.getElementById('badge-semaine').textContent =
    `${choix === 'precedente' ? 'À PAYER · ' : ''}${labelSemaine(debut, fin)}`;
  document.getElementById('titre-effectif').textContent =
    choix === 'precedente'
      ? `Effectif — semaine clôturée (${labelSemaine(debut, fin)})`
      : 'Effectif — semaine en cours';

  document.getElementById('tbody-rh').innerHTML =
    `<tr><td colspan="8" class="muted text-center">Chargement…</td></tr>`;

  [users, ventes, ventesAvecCachees, services, quotas, paies, config, redistributions] = await Promise.all([
    listUsers().catch(() => []),
    listVentesSemaine(debut, fin).catch(() => []),
    listVentesSemaineIncluantCachees(debut, fin).catch(() => []),
    listServicesSemaine(debut, fin).catch(() => []),
    listQuotasSemaine(wId).catch(() => []),
    listPaiesSemaine(debut, fin).catch(() => []),
    getConfig().catch(() => ({})),
    listRedistributionsSemaine(debut, fin).catch(() => [])
  ]);

  calculerMetriques();
  renderKpis();
  renderTable();
  renderActivite();
}

// === Calculer les métriques par employé ===
// caTotal : tout le CA (sert au LTD pour la compta)
// caParticulier : seulement les ventes "particulier" (sert au calcul de la commission vendeur)
//                 Fallback sur v.montant si montantParticulier n'existe pas encore (vente historique)
function calculerMetriques() {
  metricsByUser = {};
  users.forEach(u => {
    const myVentes = ventes.filter(v => v.vendeurId === u.id);
    const ca = myVentes.reduce((s, v) => s + (v.montant || 0), 0);
    const caParticulier = myVentes.reduce((s, v) => s + (v.montantParticulier ?? v.montant ?? 0), 0);
    const benefice = myVentes.reduce((s, v) => s + (v.benefice || 0), 0);

    const myServices = services.filter(s => s.employeId === u.id);
    const heuresMs = myServices.reduce((s, x) => s + (x.duree || 0), 0);

    const myQuota = quotas.find(q => q.employeId === u.id) || { bidons: 0, caoutchoucs: 0 };

    const myPaies = paies.filter(p => p.beneficiaireId === u.id);
    const totalPaie = myPaies.reduce((s, p) => s + (p.montant || 0), 0);

    const employe = {
      role: u.role,
      caGenere: caParticulier, // commission sur particulier seulement
      bidonsRealises: myQuota.bidons || 0,
      caoutchoucsRealises: myQuota.caoutchoucs || 0,
      salaireDecide: u.salaireDecide || 0
    };
    const estime = salaireEstime(employe, config);

    metricsByUser[u.id] = {
      ca, caParticulier, benefice, heuresMs, ventes: myVentes,
      bidons: myQuota.bidons || 0,
      caoutchoucs: myQuota.caoutchoucs || 0,
      salaireEstime: estime,
      totalPaie
    };
  });
}

// === KPIs ===
function renderKpis() {
  // On exclut les rôles techniques (admin-technique) des calculs financiers / masse salariale
  const usersFinance = users.filter(u => compteEnFinance(u.role));
  const caProduits   = ventes.reduce((s, v) => s + (v.montant || 0), 0);
  const caCarburant  = redistributions.reduce((s, r) => s + (Number(r.montant) || 0), 0);
  // TTE : ratio masse salariale sur CA TOTAL (produits + carburant), pour refleter
  // la realite economique et eviter de declarer hors-TTE artificiellement.
  const totalCA = caProduits + caCarburant;
  const totalEstime = usersFinance.reduce((s, u) => s + (metricsByUser[u.id]?.salaireEstime || 0), 0);
  const totalVerse = paies.reduce((s, p) => s + (p.montant || 0), 0);
  const masse = checkMasseSalariale(totalEstime, totalCA);
  const actifs = usersFinance.filter(u => u.statut === 'actif').length;
  const technicians = users.filter(u => isSuperAdmin(u.role) && u.statut === 'actif').length;
  const choix = document.getElementById('filtre-semaine')?.value || 'courante';
  const deltaEstime = choix === 'precedente' ? 'à verser (sem. clôturée)' : 'cette semaine';

  document.getElementById('kpis-rh').innerHTML = `
    <div class="kpi"><div class="label">Effectif actif</div><div class="value">${actifs}</div><div class="delta">/ ${usersFinance.length} comptes${technicians > 0 ? ` <span style="color:var(--color-gold);">+${technicians} tech</span>` : ''}</div></div>
    <div class="kpi"><div class="label">Salaires estimés</div><div class="value">${money(totalEstime)}</div><div class="delta">${deltaEstime}</div></div>
    <div class="kpi"><div class="label">Salaires versés</div><div class="value">${money(totalVerse)}</div><div class="delta">via paie Discord</div></div>
    <div class="kpi"><div class="label">Masse salariale</div><div class="value">${pct(masse.ratio*100,1)}</div><div class="delta ${masse.ok ? 'up' : 'down'}">limite TTE: 90%</div></div>
  `;
}

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
      const cp = m.caParticulier ?? m.ca ?? 0;
      const part = m.ca > 0 && cp < m.ca
        ? ` <span class="muted" style="font-size:0.72rem;">(sur ${money(m.ca)} total)</span>`
        : '';
      progressLabel = `${money(cp)} / ${money(40000)}${part}`;
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
        <td class="actions-cell">
          <button class="btn btn-icon btn-sm btn-ghost" data-detail="${u.id}" title="Voir le détail (heures, ventes, salaire estimé)" data-tooltip="Détail">👁</button>
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

document.getElementById('filtre-semaine').addEventListener('change', (e) => {
  chargerSemaine(e.target.value);
});

// Pre-remplit le champ de recherche depuis ?q=... (lien profond depuis /stocks)
const _qParam = new URLSearchParams(location.search).get('q');
if (_qParam) document.getElementById('filtre-recherche').value = _qParam;

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
    const cp = m.caParticulier ?? m.ca ?? 0;
    const caPro = (m.ca || 0) - cp;
    html += `
      <tr><td>CA total généré</td><td class="right mono">${money(m.ca || 0)}</td></tr>
      <tr><td>↳ CA particulier <span class="muted">(commissionnable)</span></td><td class="right mono">${money(cp)}</td></tr>
      ${caPro > 0 ? `<tr><td>↳ CA pro <span class="muted">(non commissionné)</span></td><td class="right mono">${money(caPro)}</td></tr>` : ''}
      <tr><td>Bénéfice généré pour le LTD</td><td class="right mono">${money(m.benefice || 0)}</td></tr>
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

  // === Table des factures (vendeurs uniquement) ===
  // Affiche TOUTES les factures (manuelles + bot, y compris les cachees en
  // doublon) pour permettre la comparaison "ce que le bot a vu" vs "ce que
  // le vendeur a declare".
  if (isVendeur(u.role)) {
    const mesVentes = ventesAvecCachees
      .filter(v => v.vendeurId === uid)
      .sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));

    if (mesVentes.length === 0) {
      html += `<p class="muted mt-3">Aucune facture cette semaine.</p>`;
    } else {
      const nbBot = mesVentes.filter(v => v.source !== 'manuelle').length;
      const nbMan = mesVentes.filter(v => v.source === 'manuelle').length;
      const nbAnn = mesVentes.filter(v => v.annulee).length;
      const nbCac = mesVentes.filter(v => v.cachee && !v.annulee).length;
      html += `
        <h4 class="mt-3" style="margin-bottom:6px;">📋 Factures de la semaine — comparaison bot / manuelle</h4>
        <p class="muted" style="font-size:0.78rem;margin:0 0 8px;">
          ${mesVentes.length} factures totales · ${nbBot} bot · ${nbMan} manuelles · ${nbCac > 0 ? `<span class="alerte-fort">${nbCac} cachées (doublons)</span>` : '0 cachée'}${nbAnn > 0 ? ` · <span class="alerte-fort">${nbAnn} annulée${nbAnn > 1 ? 's' : ''} IG</span>` : ''}
        </p>
        <div class="table-scroll" style="max-height:380px;">
        <table class="data" style="font-size:0.8rem;">
          <thead><tr>
            <th>Date</th>
            <th class="center">Source</th>
            <th>#Facture</th>
            <th>Client</th>
            <th class="right">Montant</th>
            <th class="right">Bénéf</th>
            <th class="right">Commissionnable</th>
            <th class="center">Statut</th>
          </tr></thead>
          <tbody>
            ${mesVentes.map(v => {
              const date = datetime(v.timestamp);
              const isManuelle = v.source === 'manuelle';
              const source = isManuelle
                ? '<span class="badge ok" title="Déclarée manuellement par le vendeur">📝 Man.</span>'
                : '<span class="badge neutral" title="Remontée automatiquement par le bot Discord">🤖 Bot</span>';
              const cm = v.montantParticulier ?? v.montant ?? 0;
              const benefice = v.benefice != null ? money(v.benefice) : '<span class="muted">—</span>';
              let statut, trClass = '';
              if (v.annulee) {
                const motif = escapeHtml(v.motifAnnulation || 'Annulée');
                statut = `<span class="badge warn" title="${motif}">❌ Annulée</span>`;
                trClass = 'muted';
              } else if (v.cachee) {
                statut = `<span class="badge warn" title="Doublon caché — remplacée par #${v.remplaceeParFactureId || '?'}">⚠ Cachée</span>`;
                trClass = 'muted';
              } else if (cm === 0 && (v.montant || 0) > 0) {
                statut = '<span class="badge neutral" title="Ne compte pas dans la commission (produits pro)">CA pro</span>';
              } else {
                statut = '<span class="badge ok">✓ Compte</span>';
              }
              return `
                <tr class="${trClass}">
                  <td class="mono" style="font-size:0.75rem;">${date}</td>
                  <td class="center">${source}</td>
                  <td class="mono">#${escapeHtml(String(v.factureId || v.id || ''))}</td>
                  <td>${escapeHtml(v.client || '—')}</td>
                  <td class="right mono">${money(v.montant || 0)}</td>
                  <td class="right mono">${benefice}</td>
                  <td class="right mono ${cm > 0 ? '' : 'muted'}">${cm > 0 ? money(cm) : '—'}</td>
                  <td class="center">${statut}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
        </div>
        <p class="muted" style="font-size:0.74rem;margin:4px 0 0;">
          💡 <strong>Comparaison</strong> : si tu vois 2 lignes pour la même vente (1 bot + 1 manuelle avec même montant), la bot est cachée (badge ⚠) — seule la manuelle compte. ${nbCac > 0 ? 'Détecte automatiquement les doublons.' : 'Aucun doublon détecté cette semaine pour cet employé.'}
        </p>
      `;
    }
  }

  // === Bloc salaire ===
  // DRH : montant FIXE 18 000 $ (decision patron) — pas de saisie
  // Responsable Vente : pro-rata CA perso (calcule auto) — pas de saisie
  // Responsable Pompiste : decide manuellement par patron
  // Patron / Co-Patron : decide manuellement
  if (u.role === 'drh') {
    html += `
      <div class="alert info" style="font-size:0.85rem;">
        💼 <strong>Salaire DRH fixe : 18 000 $/semaine</strong> — imposé par le patron, non modifiable.
      </div>
    `;
  } else if (u.role === 'responsable-vente') {
    html += `
      <div class="alert info" style="font-size:0.85rem;">
        🛒 <strong>Salaire calculé automatiquement</strong> selon le CA personnel généré par le Responsable Vente.<br>
        Formule : <code>(CA / 40 000) × 17 000</code>, plafonné à 17 000 $.
      </div>
    `;
  } else if (isResponsable(u.role) || isDirection(u.role)) {
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

// Bouton "Voir son espace" : ouvre employee.html?asUser=UID en mode debug
document.getElementById('btn-voir-espace').addEventListener('click', () => {
  const uid = document.getElementById('modal-employe').dataset.uid;
  if (!uid) return;
  window.location.href = `employee.html?asUser=${encodeURIComponent(uid)}`;
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
function renderActivite() {
  const usersById = users.reduce((m, u) => (m[u.id] = u, m), {});
  const div = document.getElementById('activite');
  if (services.length === 0 && paies.length === 0) {
    div.innerHTML = `<p class="muted">Aucune activité sur cette semaine.</p>`;
    return;
  }
  const parEmp = {};
  services.forEach(s => {
    if (!parEmp[s.employeId]) parEmp[s.employeId] = { duree: 0, sessions: 0 };
    parEmp[s.employeId].duree += s.duree || 0;
    parEmp[s.employeId].sessions += 1;
  });
  const sorted = Object.entries(parEmp).sort((a, b) => b[1].duree - a[1].duree);
  div.innerHTML = `
    <table class="data" id="table-activite">
      <thead><tr>
        <th data-sort="emp">Employé</th>
        <th class="right" data-sort="sessions">Sessions</th>
        <th class="right" data-sort="heures">Heures totales</th>
      </tr></thead>
      <tbody>
        ${sorted.map(([uid, s]) => {
          const u = usersById[uid];
          return `<tr>
            <td>${u ? escapeHtml(u.prenom + ' ' + u.nom) : uid}</td>
            <td class="right mono">${s.sessions}</td>
            <td class="right mono" data-sort-value="${s.duree}">${durationHM(s.duree)}</td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  `;
  const tAct = document.getElementById('table-activite');
  wrapScroll(tAct, 400);
  makeSortable(tAct);
}

// === Chargement initial ===
await chargerSemaine('courante');
