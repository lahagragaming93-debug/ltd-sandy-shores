// ============================================================
// Page : Stocks épicerie
// ============================================================

import { requireAuth, getCurrentUser } from '../auth.js';
import { renderShell } from '../layout.js';
import {
  listProduits, setProduit, deleteProduit, listenStocks, ajusterStock, listMouvementsRecents,
  listUsers
} from '../api.js';
import { CATEGORIES, CATEGORY_LABELS } from '../data/produits.js';
import { money, moneyPrecis, num, datetime, escapeHtml } from '../utils/formatters.js';
import { isDirection, isSuperAdmin, canCreateProduit } from '../utils/permissions.js';
import { toastSuccess, toastError } from '../utils/toast.js';
import { confirmCritique } from '../utils/confirmation.js';
import { wrapScroll, makeSortable } from '../utils/sortable-table.js';

const { profile } = await requireAuth('stocks_epicerie');
// 2026-05-11 : restreint a Direction + Admin Technique (audit inventaire hebdo).
// 2026-05-13 : DRH re-autorise sur demande du patron (alignement Direction).
//              Responsable Vente reste exclu de la modification.
const editable = isDirection(profile.role) || isSuperAdmin(profile.role) || profile.role === 'drh';
const canCreate = canCreateProduit(profile.role);

const html = `
  <div class="page-toolbar">
    <select id="filtre-categorie" title="Filtrer par catégorie">
      <option value="">Toutes catégories</option>
      ${Object.entries(CATEGORY_LABELS).map(([k, l]) =>
        `<option value="${k}">${l}</option>`).join('')}
    </select>
    <select id="filtre-alerte" title="Filtrer par niveau">
      <option value="">Tous niveaux</option>
      <option value="rupture">⚠ Ruptures</option>
      <option value="bas">⚠ Sous seuil</option>
      <option value="ok">OK</option>
    </select>
    <input type="text" id="filtre-recherche" placeholder="🔍 Rechercher…" style="flex:1;min-width:160px;" />
    ${canCreate ? `
      <button class="btn btn-primary btn-icon" id="btn-nouveau-produit" title="Ajouter un produit au catalogue" data-tooltip="Ajouter produit">➕</button>
    ` : ''}
  </div>

  <!-- Section 1 : Vente LTD (particuliers) -->
  <div class="panel framed">
    <div class="panel-title">
      <span>🛒 Vente LTD — particuliers <span class="muted" style="font-size:0.78rem;">(commission vendeur)</span></span>
      <span class="muted mono" id="stats-stock-particulier">—</span>
    </div>
    <div class="table-scroll">
      <table class="data sortable" id="table-stocks-particulier">
        <thead>
          <tr>
            <th data-sort="nom">Produit <span class="sort-arrow"></span></th>
            <th data-sort="categorie">Catégorie <span class="sort-arrow"></span></th>
            <th class="right" data-sort="qte">Stock <span class="sort-arrow"></span></th>
            <th class="right" data-sort="prixAchat">Prix achat <span class="sort-arrow"></span></th>
            <th class="right" data-sort="prixVente">Prix vente <span class="sort-arrow"></span></th>
            <th class="right" data-sort="marge">Marge <span class="sort-arrow"></span></th>
            <th class="right" data-sort="seuil">Seuil alerte <span class="sort-arrow"></span></th>
            <th class="center" data-sort="statut">Statut <span class="sort-arrow"></span></th>
            ${editable ? '<th class="center">Actions</th>' : ''}
          </tr>
        </thead>
        <tbody id="tbody-stocks-particulier"><tr><td colspan="9" class="muted text-center">Chargement…</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Section 2 : Vente fournisseur (pros) -->
  <div class="panel framed" style="border-color:var(--color-info, #4a90e2);">
    <div class="panel-title">
      <span>🏢 Vente fournisseur — professionnels <span class="muted" style="font-size:0.78rem;">(CA LTD uniquement, pas de commission)</span></span>
      <span class="muted mono" id="stats-stock-pro">—</span>
    </div>
    <div class="table-scroll">
      <table class="data sortable" id="table-stocks-pro">
        <thead>
          <tr>
            <th data-sort="nom">Produit <span class="sort-arrow"></span></th>
            <th data-sort="categorie">Catégorie <span class="sort-arrow"></span></th>
            <th class="right" data-sort="qte">Stock <span class="sort-arrow"></span></th>
            <th class="right" data-sort="prixAchat">Prix achat <span class="sort-arrow"></span></th>
            <th class="right" data-sort="prixVente">Prix vente <span class="sort-arrow"></span></th>
            <th class="right" data-sort="marge">Marge <span class="sort-arrow"></span></th>
            <th class="right" data-sort="seuil">Seuil alerte <span class="sort-arrow"></span></th>
            <th class="center" data-sort="statut">Statut <span class="sort-arrow"></span></th>
            ${editable ? '<th class="center">Actions</th>' : ''}
          </tr>
        </thead>
        <tbody id="tbody-stocks-pro"><tr><td colspan="9" class="muted text-center">Chargement…</td></tr></tbody>
      </table>
    </div>
  </div>

  <div class="panel">
    <div class="panel-title"><span>Derniers mouvements de stock</span></div>
    <div id="mouvements">Chargement…</div>
  </div>

  <!-- Modale création produit -->
  <div id="modal-nouveau" class="modal-backdrop hidden">
    <div class="modal" style="max-width:560px;">
      <h3>+ Ajouter un produit au catalogue</h3>
      <div class="alert info mb-2" style="font-size:0.82rem;">
        <span class="icon">ℹ</span>
        <span>L'<strong>identifiant</strong> du produit est généré automatiquement à partir du nom (slug). Il sert de clé technique : il ne sera plus modifiable après création. Le nom, lui, reste éditable.</span>
      </div>
      <label>Nom du produit *</label>
      <input type="text" id="new-produit-nom" placeholder="Ex. Bouteille d'eau" />
      <label>Identifiant technique (auto) <span class="muted" style="font-size:0.75rem;">— modifiable</span></label>
      <input type="text" id="new-produit-id" placeholder="bouteille-eau" style="font-family:var(--font-mono);font-size:0.85rem;" />
      <label>Catégorie</label>
      <select id="new-produit-categorie">
        ${Object.entries(CATEGORY_LABELS).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}
      </select>
      <div class="field-row">
        <div><label>Prix achat ($)</label><input type="number" id="new-produit-prix-achat" min="0" step="0.01" value="0" /></div>
        <div><label>Prix vente ($)</label><input type="number" id="new-produit-prix-vente" min="0" step="0.01" value="0" /></div>
        <div><label>Seuil alerte</label><input type="number" id="new-produit-seuil" min="0" step="1" value="5" /></div>
      </div>
      <label>Stock initial <span class="muted" style="font-size:0.75rem;">— optionnel</span></label>
      <input type="number" id="new-produit-stock" min="0" step="1" value="0" />
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:8px;">
        <input type="checkbox" id="new-produit-pour-pro" />
        <span>🏢 Vendu aux <strong>professionnels uniquement</strong>
          <span class="muted" style="font-size:0.78rem;display:block;">Le CA entre en compta LTD mais ne génère pas de commission vendeur</span>
        </span>
      </label>
      <div class="row mt-3">
        <button class="btn btn-primary" id="btn-creer-produit">Créer le produit</button>
        <button class="btn btn-ghost" id="btn-cancel-nouveau">Annuler</button>
      </div>
    </div>
  </div>

  <!-- Modale édition produit -->
  <div id="modal-edit" class="modal-backdrop hidden">
    <div class="modal">
      <h3>Modifier le produit</h3>
      <input type="hidden" id="edit-id" />
      <label>Nom</label><input type="text" id="edit-nom" />
      <div class="field-row">
        <div><label>Prix achat ($)</label><input type="number" id="edit-prix-achat" min="0" step="0.01" /></div>
        <div><label>Prix vente ($)</label><input type="number" id="edit-prix-vente" min="0" step="0.01" /></div>
        <div><label>Seuil alerte</label><input type="number" id="edit-seuil" min="0" step="1" /></div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:6px;">
        <input type="checkbox" id="edit-pour-pro" />
        <span>🏢 Vendu aux <strong>professionnels uniquement</strong>
          <span class="muted" style="font-size:0.78rem;display:block;">Pas de commission vendeur ; CA compté pour le LTD</span>
        </span>
      </label>
      <label>Ajustement manuel du stock</label>
      <div class="field-row">
        <div><input type="number" id="edit-delta" placeholder="+/− unités" /></div>
        <div><input type="text" id="edit-raison" placeholder="Justification (obligatoire si ajustement)" /></div>
      </div>
      <div class="row mt-3">
        <button class="btn btn-primary" id="btn-save">Enregistrer</button>
        <button class="btn btn-ghost" id="btn-cancel">Annuler</button>
      </div>
    </div>
  </div>
`;

renderShell(profile, 'stocks_epicerie', html);

let produits = [];
let stocks = {};
let sortState = { key: 'nom', dir: 'asc' };

const STATUT_ORDER = { rupture: 0, bas: 1, ok: 2 };

function sortRows(rows) {
  const { key, dir } = sortState;
  const sign = dir === 'asc' ? 1 : -1;
  const cmpStr = (a, b) => String(a || '').localeCompare(String(b || ''), 'fr', { sensitivity: 'base' });
  const cmpNum = (a, b) => (a || 0) - (b || 0);

  return [...rows].sort((r1, r2) => {
    let res;
    switch (key) {
      case 'nom':       res = cmpStr(r1.p.nom, r2.p.nom); break;
      case 'categorie': res = cmpStr(CATEGORY_LABELS[r1.p.categorie] || r1.p.categorie, CATEGORY_LABELS[r2.p.categorie] || r2.p.categorie); break;
      case 'qte':       res = cmpNum(r1.qte, r2.qte); break;
      case 'prixAchat': res = cmpNum(r1.p.prixAchat, r2.p.prixAchat); break;
      case 'prixVente': res = cmpNum(r1.p.prixVente, r2.p.prixVente); break;
      case 'marge':     res = cmpNum((r1.p.prixVente || 0) - (r1.p.prixAchat || 0), (r2.p.prixVente || 0) - (r2.p.prixAchat || 0)); break;
      case 'seuil':     res = cmpNum(r1.seuil, r2.seuil); break;
      case 'statut':    res = STATUT_ORDER[r1.statut] - STATUT_ORDER[r2.statut]; break;
      default:          res = 0;
    }
    if (res === 0) res = cmpStr(r1.p.nom, r2.p.nom); // tie-breaker stable par nom
    return res * sign;
  });
}

function updateSortArrows() {
  document.querySelectorAll('#table-stocks-particulier thead th[data-sort], #table-stocks-pro thead th[data-sort]').forEach(th => {
    const arrow = th.querySelector('.sort-arrow');
    if (!arrow) return;
    if (th.dataset.sort === sortState.key) {
      arrow.textContent = sortState.dir === 'asc' ? ' ▲' : ' ▼';
      th.classList.add('sorted');
    } else {
      arrow.textContent = '';
      th.classList.remove('sorted');
    }
  });
}

async function chargerProduits() {
  produits = await listProduits().catch(() => []);
  if (produits.length === 0 && editable) {
    document.getElementById('tbody-stocks-particulier').innerHTML = `
      <tr><td colspan="9" class="muted text-center">
        Catalogue vide. Utilise "+ Ajouter un produit" pour commencer.
      </td></tr>`;
  }
}
await chargerProduits();

listenStocks(s => { stocks = s; renderTable(); });

function ligneProduit({ p, qte, seuil, statut }) {
  const marge = (p.prixVente || 0) - (p.prixAchat || 0);
  const cls = qte < 0 ? 'alert-out' : (statut === 'rupture' ? 'alert-out' : (statut === 'bas' ? 'alert-low' : ''));
  const badge = qte < 0
    ? `<span class="badge danger" title="Stock négatif — incohérence">⚠ ${num(qte)}</span>`
    : (statut === 'rupture'
        ? '<span class="badge danger">RUPTURE</span>'
        : (statut === 'bas' ? '<span class="badge warn">BAS</span>' : '<span class="badge ok">OK</span>'));
  return `
    <tr class="${cls}">
      <td>${escapeHtml(p.nom)}</td>
      <td><span class="muted">${CATEGORY_LABELS[p.categorie] || p.categorie}</span></td>
      <td class="right mono ${qte < 0 ? 'alerte-fort' : ''}">${num(qte)}</td>
      <td class="right mono">${moneyPrecis(p.prixAchat || 0)}</td>
      <td class="right mono">${moneyPrecis(p.prixVente || 0)}</td>
      <td class="right mono ${marge >= 0 ? '' : 'muted'}">${moneyPrecis(marge)}</td>
      <td class="right mono">${num(seuil)}</td>
      <td class="center">${badge}</td>
      ${editable ? `<td class="actions-cell">
        <button class="btn btn-icon btn-sm btn-ghost" data-edit="${p.id}" title="Modifier le produit (prix, seuil, stock)" data-tooltip="Modifier">✏</button>
        ${canCreate ? `<button class="btn btn-icon btn-sm btn-danger" data-delete-produit="${p.id}" title="Supprimer du catalogue" data-tooltip="Supprimer">🗑</button>` : ''}
      </td>` : ''}
    </tr>
  `;
}

function wireActions(tbody) {
  tbody.querySelectorAll('[data-edit]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirEdition(btn.dataset.edit));
  });
  tbody.querySelectorAll('[data-delete-produit]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.deleteProduit;
      const p = produits.find(x => x.id === id);
      const stock = stocks[id]?.quantite || 0;
      const ok = await confirmCritique({
        titre: 'Supprimer un produit du catalogue',
        message: `Le produit <strong>${escapeHtml(p?.nom || id)}</strong> sera supprimé du catalogue.<br><br>
          • Stock actuel : <strong>${stock}</strong> unités (le stock est conservé en base mais ne sera plus visible)<br>
          • Les ventes passées avec ce produit restent dans l'historique<br>
          • L'historique des prix (audit) reste consultable<br><br>
          ⚠ Si ce produit a encore des stocks ou apparaît dans les logs FiveM, il sera <strong>recréé automatiquement</strong> par le bot.`,
        btnConfirm: 'Supprimer le produit',
        delaiSec: 3,
        requireType: 'SUPPRIMER'
      });
      if (!ok) return;
      try {
        await deleteProduit(id);
        toastSuccess(`Produit "${p?.nom || id}" supprimé.`);
        await chargerProduits();
        renderTable();
      } catch (e) {
        console.error(e);
        toastError(e?.message || e?.code || "Erreur à la suppression.");
      }
    });
  });
}

function renderTable() {
  const cat = document.getElementById('filtre-categorie').value;
  const niveau = document.getElementById('filtre-alerte').value;
  const recherche = document.getElementById('filtre-recherche').value.toLowerCase().trim();

  let rows = produits.map(p => {
    const stock = stocks[p.id] || { quantite: 0 };
    const qte = stock.quantite || 0;
    const seuil = p.seuilAlerte ?? 0;
    let statut = 'ok';
    if (qte === 0) statut = 'rupture';
    else if (qte <= seuil) statut = 'bas';
    return { p, qte, seuil, statut };
  });

  if (cat) rows = rows.filter(r => r.p.categorie === cat);
  if (niveau) rows = rows.filter(r => r.statut === niveau);
  if (recherche) rows = rows.filter(r => r.p.nom.toLowerCase().includes(recherche));

  rows = sortRows(rows);
  updateSortArrows();

  const rowsPart = rows.filter(r => !r.p.pourPro);
  const rowsPro  = rows.filter(r =>  r.p.pourPro);

  const tbodyPart = document.getElementById('tbody-stocks-particulier');
  const tbodyPro  = document.getElementById('tbody-stocks-pro');

  tbodyPart.innerHTML = rowsPart.length === 0
    ? `<tr><td colspan="9" class="muted text-center">Aucun produit "particulier".</td></tr>`
    : rowsPart.map(ligneProduit).join('');
  tbodyPro.innerHTML = rowsPro.length === 0
    ? `<tr><td colspan="9" class="muted text-center">Aucun produit "professionnel".</td></tr>`
    : rowsPro.map(ligneProduit).join('');

  wireActions(tbodyPart);
  wireActions(tbodyPro);

  // Stats compactes par section
  const statTxt = (list) => {
    const out = list.filter(r => r.statut === 'rupture').length;
    const low = list.filter(r => r.statut === 'bas').length;
    const neg = list.filter(r => r.qte < 0).length;
    const parts = [`${list.length} réf.`];
    if (neg > 0) parts.push(`<span class="alerte-fort">${neg} négatif${neg>1?'s':''}</span>`);
    if (out > 0) parts.push(`${out} rupture${out>1?'s':''}`);
    if (low > 0) parts.push(`${low} bas`);
    return parts.join(' · ');
  };
  document.getElementById('stats-stock-particulier').innerHTML = statTxt(rowsPart);
  document.getElementById('stats-stock-pro').innerHTML = statTxt(rowsPro);
}

document.getElementById('filtre-categorie').addEventListener('change', renderTable);
document.getElementById('filtre-alerte').addEventListener('change', renderTable);
document.getElementById('filtre-recherche').addEventListener('input', renderTable);

// Tri par colonne (click sur en-tête) — appliqué aux 2 tables
document.querySelectorAll('#table-stocks-particulier thead th[data-sort], #table-stocks-pro thead th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (sortState.key === key) {
      sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
    } else {
      sortState = { key, dir: 'asc' };
    }
    renderTable();
  });
});

// === Édition produit ===
function ouvrirEdition(id) {
  const p = produits.find(x => x.id === id);
  if (!p) return;
  document.getElementById('edit-id').value = id;
  document.getElementById('edit-nom').value = p.nom || '';
  document.getElementById('edit-prix-achat').value = p.prixAchat || 0;
  document.getElementById('edit-prix-vente').value = p.prixVente || 0;
  document.getElementById('edit-seuil').value = p.seuilAlerte || 0;
  document.getElementById('edit-pour-pro').checked = !!p.pourPro;
  document.getElementById('edit-delta').value = '';
  document.getElementById('edit-raison').value = '';
  document.getElementById('modal-edit').classList.remove('hidden');
}

document.getElementById('btn-cancel').addEventListener('click', () => {
  document.getElementById('modal-edit').classList.add('hidden');
});

document.getElementById('btn-save').addEventListener('click', async () => {
  const id = document.getElementById('edit-id').value;
  const p = produits.find(x => x.id === id);
  if (!p) return;
  const patch = {
    nom: document.getElementById('edit-nom').value.trim(),
    prixAchat: Number(document.getElementById('edit-prix-achat').value) || 0,
    prixVente: Number(document.getElementById('edit-prix-vente').value) || 0,
    seuilAlerte: Number(document.getElementById('edit-seuil').value) || 0,
    pourPro: document.getElementById('edit-pour-pro').checked,
    categorie: p.categorie
  };
  const delta = Number(document.getElementById('edit-delta').value);
  const raison = document.getElementById('edit-raison').value.trim();

  try {
    await setProduit(id, patch);
    if (delta && Number.isFinite(delta) && delta !== 0) {
      if (!raison) return toastError("Justification obligatoire pour ajustement.");
      await ajusterStock(id, delta, raison, getCurrentUser().uid);
    }
    toastSuccess("Produit enregistré.");
    document.getElementById('modal-edit').classList.add('hidden');
    await chargerProduits();
    renderTable();
    chargerMouvements();
  } catch (err) {
    toastError(err.message || "Erreur d'enregistrement.");
    console.error(err);
  }
});

// === Derniers mouvements ===
async function chargerMouvements() {
  const [mvts, users] = await Promise.all([
    listMouvementsRecents(20).catch(() => []),
    listUsers().catch(() => [])
  ]);
  // Index pour matching rapide : par idDiscord, idPerso, et par nom RP complet
  const byDiscord = {};
  const byPerso   = {};
  const byNom     = {};
  for (const u of users) {
    if (u.idDiscord) byDiscord[u.idDiscord] = u;
    if (u.idPerso)   byPerso[u.idPerso] = u;
    const nomComplet = `${u.prenom || ''} ${u.nom || ''}`.trim().toLowerCase();
    if (nomComplet) byNom[nomComplet] = u;
  }
  function resolveUser(m) {
    if (m.discord && byDiscord[m.discord]) return byDiscord[m.discord];
    if (m.characterId && byPerso[m.characterId]) return byPerso[m.characterId];
    const raw = (m.par || '').trim().toLowerCase();
    return byNom[raw] || null;
  }

  const div = document.getElementById('mouvements');
  if (mvts.length === 0) {
    div.innerHTML = `<p class="muted">Aucun mouvement (logs Discord à venir).</p>`;
    return;
  }
  div.innerHTML = `
    <table class="data" id="table-mouvements">
      <thead><tr>
        <th data-sort="date">Date</th>
        <th data-sort="type">Type</th>
        <th data-sort="item">Item</th>
        <th class="right" data-sort="qte">Quantité</th>
        <th data-sort="source">Employé</th>
        <th data-sort="raison">Raison</th>
      </tr></thead>
      <tbody>
        ${mvts.map(m => {
          const u = resolveUser(m);
          const sourceCell = u
            ? `<a href="rh.html?q=${encodeURIComponent(u.prenom + ' ' + u.nom)}" class="user-link" title="Voir le profil employé">${escapeHtml(u.prenom + ' ' + u.nom)}</a>`
            : `<span class="muted" title="Employé non lié à un compte du site">${escapeHtml(m.par || m.source || '—')}</span>`;
          return `
          <tr>
            <td>${datetime(m.timestamp)}</td>
            <td><span class="badge ${m.type?.includes('add') ? 'ok' : 'warn'}">${m.type}</span></td>
            <td>${escapeHtml(m.item || '—')}</td>
            <td class="right mono">${num(m.quantite || 0)}</td>
            <td>${sourceCell}</td>
            <td class="muted">${escapeHtml(m.raison || '')}</td>
          </tr>
        `;
        }).join('')}
      </tbody>
    </table>
  `;
  const tMvts = document.getElementById('table-mouvements');
  wrapScroll(tMvts, 400);
  makeSortable(tMvts);
}
chargerMouvements();

// === Création d'un nouveau produit (direction + DRH) ===
function slugify(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const btnNouveauProduit = document.getElementById('btn-nouveau-produit');
if (btnNouveauProduit) {
  const modalNouveau = document.getElementById('modal-nouveau');
  const inputNom     = document.getElementById('new-produit-nom');
  const inputId      = document.getElementById('new-produit-id');

  // Auto-slug du nom vers l'ID tant que l'user n'a pas modifié l'ID manuellement
  let idTouchedByUser = false;
  inputNom.addEventListener('input', () => {
    if (!idTouchedByUser) inputId.value = slugify(inputNom.value);
  });
  inputId.addEventListener('input', () => { idTouchedByUser = true; });

  btnNouveauProduit.addEventListener('click', () => {
    inputNom.value = '';
    inputId.value = '';
    idTouchedByUser = false;
    document.getElementById('new-produit-categorie').value = 'divers';
    document.getElementById('new-produit-prix-achat').value = 0;
    document.getElementById('new-produit-prix-vente').value = 0;
    document.getElementById('new-produit-seuil').value = 5;
    document.getElementById('new-produit-stock').value = 0;
    document.getElementById('new-produit-pour-pro').checked = false;
    modalNouveau.classList.remove('hidden');
    setTimeout(() => inputNom.focus(), 50);
  });

  document.getElementById('btn-cancel-nouveau').addEventListener('click', () => {
    modalNouveau.classList.add('hidden');
  });

  document.getElementById('btn-creer-produit').addEventListener('click', async () => {
    const nom        = inputNom.value.trim();
    const id         = (inputId.value || '').trim() || slugify(nom);
    const categorie  = document.getElementById('new-produit-categorie').value;
    const prixAchat  = Number(document.getElementById('new-produit-prix-achat').value) || 0;
    const prixVente  = Number(document.getElementById('new-produit-prix-vente').value) || 0;
    const seuilAlerte= Number(document.getElementById('new-produit-seuil').value) || 0;
    const stockInit  = Number(document.getElementById('new-produit-stock').value) || 0;
    const pourPro    = document.getElementById('new-produit-pour-pro').checked;

    if (!nom)          return toastError("Nom obligatoire.");
    if (!/^[a-z0-9-]+$/.test(id)) return toastError("Identifiant invalide (lettres minuscules, chiffres, tirets uniquement).");
    if (produits.find(p => p.id === id)) {
      return toastError(`Un produit avec l'ID "${id}" existe déjà — choisis un autre identifiant ou modifie le produit existant.`);
    }
    if (prixVente > 0 && prixAchat > prixVente) {
      const ok = await confirmCritique({
        titre: 'Marge négative',
        message: `Le prix d'achat (<strong>${prixAchat} $</strong>) est supérieur au prix de vente (<strong>${prixVente} $</strong>). Le produit sera vendu à perte.<br><br>Confirmer quand même ?`,
        btnConfirm: 'Créer quand même',
        delaiSec: 3
      });
      if (!ok) return;
    }

    try {
      await setProduit(id, { nom, categorie, prixAchat, prixVente, seuilAlerte, pourPro });
      // Stock initial : ajustement avec raison "création"
      if (stockInit > 0) {
        const me = getCurrentUser();
        await ajusterStock(id, stockInit, 'Création produit (stock initial)', me?.uid || profile.id);
      }
      toastSuccess(`Produit "${nom}" créé.`);
      modalNouveau.classList.add('hidden');
      // Re-charge la liste + re-render pour refléter le nouveau produit
      // (le listener listenStocks ne se déclenchera que si on a posé un stock initial)
      await chargerProduits();
      renderTable();
    } catch (e) {
      console.error(e);
      toastError(e?.message || e?.code || "Erreur à la création.");
    }
  });
}
