// ============================================================
// Page : Avertissements — poser et retirer les avertissements des équipes
// ============================================================
// POURQUOI UNE PAGE A PART. Les avertissements vivaient dans l'Administration,
// dont le patron avait retiré l'accès au responsable vente et au chef d'équipe le
// 2026-07-01. Leur rouvrir cette page pour un simple avertissement leur rendrait
// aussi la création de comptes, les permissions et les salaires. Cette page ne
// fait donc QUE ça — et la règle serveur (canAvertir dans firestore.rules) reste
// la vraie barrière : le front n'est qu'un confort d'affichage.
//
// Rappel de la mécanique : 3 avertissements ACTIFS bloquent le compte (consultation
// possible, plus aucune écriture). En retirer un débloque immédiatement. Un
// avertissement n'est jamais supprimé, seulement désactivé : l'audit est conservé.

import { requireAuth, getCurrentUser } from '../auth.js';
import { renderShell } from '../layout.js';
import { listUsers, listAvertissements, creerAvertissement, retirerAvertissement,
         listenAvertissementsActifs } from '../api.js';
import { ROLE_LABELS, canAvertir } from '../utils/permissions.js';
import { datetime, escapeHtml } from '../utils/formatters.js';
import { confirmAction } from '../utils/confirmation.js';

const { profile } = await requireAuth('avertissements');
const moi = getCurrentUser();

const html = `
  <div class="alert info mb-2" style="font-size:0.84rem;">
    <span><strong>3 avertissements actifs = compte bloqué.</strong> L'employé peut consulter le site mais ne peut plus rien déclarer.
    En retirer un le débloque immédiatement. Un avertissement retiré reste tracé, il n'est jamais effacé.</span>
  </div>

  <div class="panel framed">
    <div class="panel-title">
      <span>Employés</span>
      <span class="muted mono" id="avert-count">—</span>
    </div>
    <div class="table-scroll">
      <table class="data" id="table-avert">
        <thead>
          <tr><th>Employé</th><th>Rôle</th><th class="num">Avertissements actifs</th><th>État</th><th></th></tr>
        </thead>
        <tbody id="avert-body">
          <tr><td colspan="5" class="muted text-center">Chargement…</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <div id="modal-avert" class="modal-backdrop hidden">
    <div class="modal" style="max-width:680px;">
      <h3>Avertissements de <span id="avert-nom">—</span></h3>
      <div class="row mb-2">
        <button class="btn btn-primary btn-sm" id="btn-nouveau">+ Nouvel avertissement</button>
        <span class="spacer"></span>
        <span class="muted mono" id="avert-actifs">—</span>
      </div>
      <div id="bloc-nouveau" class="hidden" style="background:rgba(0,0,0,0.18);padding:10px;border-radius:6px;margin-bottom:10px;">
        <label>Motif</label>
        <textarea id="avert-motif" rows="2" placeholder="ex : quota non atteint, absence non justifiée"></textarea>
        <div class="row mt-2">
          <button class="btn btn-primary btn-sm" id="btn-creer">Créer l'avertissement</button>
          <button class="btn btn-ghost btn-sm" id="btn-annuler">Annuler</button>
        </div>
      </div>
      <div class="table-scroll" style="max-height:320px;">
        <table class="data">
          <thead><tr><th>Date</th><th>Motif</th><th>Par</th><th>État</th><th></th></tr></thead>
          <tbody id="avert-liste"><tr><td colspan="5" class="muted text-center">Chargement…</td></tr></tbody>
        </table>
      </div>
      <div class="row mt-2"><span class="spacer"></span><button class="btn btn-ghost" id="btn-fermer">Fermer</button></div>
    </div>
  </div>
`;

renderShell('avertissements', html);

const $ = (id) => document.getElementById(id);
let employes = [];
let actifsParEmploye = {};
let cible = null;

// On n'affiche que les employés que CE responsable a le droit d'avertir : lui
// montrer des lignes qu'il ne peut pas actionner ne ferait que le frustrer.
function visibles() {
  return employes
    .filter((u) => u.actif !== false && u.id !== moi.uid && canAvertir(profile.role, u.role))
    .sort((a, b) => (b._n || 0) - (a._n || 0) || String(a.nom || '').localeCompare(String(b.nom || '')));
}

function ligne(u) {
  const n = u._n || 0;
  const etat = n >= 3
    ? '<span class="badge danger">Compte bloqué</span>'
    : (n > 0 ? '<span class="badge warn">' + n + ' actif' + (n > 1 ? 's' : '') + '</span>' : '<span class="badge">À jour</span>');
  return '<tr>'
    + '<td>' + escapeHtml(((u.prenom || '') + ' ' + (u.nom || '')).trim() || u.id) + '</td>'
    + '<td class="muted">' + escapeHtml(ROLE_LABELS[u.role] || u.role || '—') + '</td>'
    + '<td class="num">' + n + '</td>'
    + '<td>' + etat + '</td>'
    + '<td><button class="btn btn-sm" data-uid="' + escapeHtml(u.id) + '">Gérer</button></td>'
    + '</tr>';
}

function rendre() {
  const list = visibles();
  const body = $('avert-body');
  body.innerHTML = list.length
    ? list.map(ligne).join('')
    : '<tr><td colspan="5" class="muted text-center">Aucun employé dans votre périmètre.</td></tr>';
  $('avert-count').textContent = list.length + ' employé' + (list.length > 1 ? 's' : '');
  body.querySelectorAll('button[data-uid]').forEach((b) => {
    b.addEventListener('click', () => ouvrir(b.getAttribute('data-uid')));
  });
}

async function ouvrir(uid) {
  cible = employes.filter((u) => u.id === uid)[0];
  if (!cible) return;
  $('avert-nom').textContent = ((cible.prenom || '') + ' ' + (cible.nom || '')).trim() || uid;
  $('modal-avert').classList.remove('hidden');
  $('bloc-nouveau').classList.add('hidden');
  await recharger();
}

async function recharger() {
  const liste = await listAvertissements(cible.id);
  const actifs = liste.filter((a) => a.actif);
  $('avert-actifs').textContent = actifs.length + ' actif' + (actifs.length > 1 ? 's' : '') + ' / 3';
  $('avert-liste').innerHTML = liste.length ? liste.map((a) => {
    const retrait = a.actif
      ? '<button class="btn btn-sm btn-ghost" data-retirer="' + escapeHtml(a.id) + '">Retirer</button>'
      : '';
    return '<tr' + (a.actif ? '' : ' style="opacity:.55"') + '>'
      + '<td class="mono" style="font-size:.78rem">' + escapeHtml(datetime(a.dateCreation) || '—') + '</td>'
      + '<td>' + escapeHtml(a.motif || '—') + (a.auto ? ' <span class="badge">auto</span>' : '') + '</td>'
      + '<td class="muted">' + escapeHtml(a.parQuiNom || '—') + '</td>'
      + '<td>' + (a.actif ? '<span class="badge warn">Actif</span>' : '<span class="badge">Retiré</span>') + '</td>'
      + '<td>' + retrait + '</td></tr>';
  }).join('') : '<tr><td colspan="5" class="muted text-center">Aucun avertissement.</td></tr>';

  $('avert-liste').querySelectorAll('button[data-retirer]').forEach((b) => {
    b.addEventListener('click', async () => {
      const ok = await confirmAction({
        titre: 'Retirer cet avertissement',
        message: "L'avertissement sera marqué comme retiré, l'audit est conservé. Si l'employé était bloqué et repasse sous 3 avertissements actifs, son compte est <strong>débloqué immédiatement</strong>.",
        btnConfirm: 'Retirer l\'avertissement'
      });
      if (!ok) return;
      await retirerAvertissement(b.getAttribute('data-retirer'), moi.uid, profile.prenom + ' ' + profile.nom);
      await recharger();
    });
  });
}

$('btn-nouveau').addEventListener('click', () => {
  $('bloc-nouveau').classList.remove('hidden');
  $('avert-motif').value = '';
  $('avert-motif').focus();
});
$('btn-annuler').addEventListener('click', () => $('bloc-nouveau').classList.add('hidden'));
$('btn-fermer').addEventListener('click', () => $('modal-avert').classList.add('hidden'));

$('btn-creer').addEventListener('click', async () => {
  const motif = $('avert-motif').value.trim();
  if (!motif) { $('avert-motif').focus(); return; }
  const btn = $('btn-creer');
  btn.disabled = true;
  try {
    await creerAvertissement({
      employeId: cible.id,
      employeNom: ((cible.prenom || '') + ' ' + (cible.nom || '')).trim(),
      motif: motif,
      parQui: moi.uid,
      parQuiNom: (profile.prenom || '') + ' ' + (profile.nom || '')
    });
    $('bloc-nouveau').classList.add('hidden');
    await recharger();
  } catch (e) {
    // Le refus vient de la regle serveur : on le dit franchement plutot que de
    // laisser croire a un bug d'affichage.
    alert("Avertissement refusé : " + (e && e.message ? e.message : 'droits insuffisants') + '.');
  } finally {
    btn.disabled = false;
  }
});

(async () => {
  employes = await listUsers();
  rendre();
  // Compteurs en temps reel : un avertissement pose ailleurs se voit ici sans rechargement.
  listenAvertissementsActifs((tous) => {
    actifsParEmploye = {};
    tous.forEach((a) => { actifsParEmploye[a.employeId] = (actifsParEmploye[a.employeId] || 0) + 1; });
    employes.forEach((u) => { u._n = actifsParEmploye[u.id] || 0; });
    rendre();
  });
})();
