// ============================================================
// Page : Stocks épicerie
// ============================================================

import { requireAuth, getCurrentUser } from '../auth.js';
import { renderShell } from '../layout.js';
import {
  listProduits, setProduit, deleteProduit, listenStocks, ajusterStock, listMouvementsRecents
} from '../api.js';
import { CATALOGUE, CATEGORIES, CATEGORY_LABELS } from '../data/produits.js';
import { money, num, datetime, escapeHtml } from '../utils/formatters.js';
import { isDirection, canCreateProduit } from '../utils/permissions.js';
import { toastSuccess, toastError } from '../utils/toast.js';
import { confirmCritique } from '../utils/confirmation.js';
import { wrapScroll, makeSortable } from '../utils/sortable-table.js';

const { profile } = await requireAuth('stocks_epicerie');
const editable = isDirection(profile.role) || profile.role === 'responsable-vente' || profile.role === 'drh';
const canCreate = canCreateProduit(profile.role);

const html = `
  <div class="row mb-2 wrap">
    <select id="filtre-categorie">
      <option value="">Toutes les catégories</option>
      ${Object.entries(CATEGORY_LABELS).map(([k, l]) =>
        `<option value="${k}">${l}</option>`).join('')}
    </select>
    <select id="filtre-alerte">
      <option value="">Tous les niveaux</option>
      <option value="rupture">⚠ Ruptures</option>
      <option value="bas">⚠ Sous seuil</option>
      <option value="ok">OK</option>
    </select>
    <input type="text" id="filtre-recherche" placeholder="Rechercher un produit…" style="flex:1;min-width:200px;" />
    ${canCreate ? `
      <button class="btn btn-primary" id="btn-nouveau-produit">+ Ajouter un produit</button>
    ` : ''}
    ${editable ? `
      <button class="btn" id="btn-init-catalogue">Réinitialiser depuis catalogue</button>
    ` : ''}
  </div>

  <div class="panel framed">
    <div class="panel-title">
      <span>Inventaire épicerie</span>
      <span class="muted mono" id="stats-stock">—</span>
    </div>
    <div class="table-scroll" id="table-scroll-stocks">
      <table class="data sortable" id="table-stocks">
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
        <tbody id="tbody-stocks"><tr><td colspan="9" class="muted text-center">Chargement…</td></tr></tbody>
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
        <div><label>Prix achat ($)</label><input type="number" id="new-produit-prix-achat" min="0" step="1" value="0" /></div>
        <div><label>Prix vente ($)</label><input type="number" id="new-produit-prix-vente" min="0" step="1" value="0" /></div>
        <div><label>Seuil alerte</label><input type="number" id="new-produit-seuil" min="0" step="1" value="5" /></div>
      </div>
      <label>Stock initial <span class="muted" style="font-size:0.75rem;">— optionnel</span></label>
      <input type="number" id="new-produit-stock" min="0" step="1" value="0" />
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
        <div><label>Prix achat ($)</label><input type="number" id="edit-prix-achat" min="0" step="1" /></div>
        <div><label>Prix vente ($)</label><input type="number" id="edit-prix-vente" min="0" step="1" /></div>
        <div><label>Seuil alerte</label><input type="number" id="edit-seuil" min="0" step="1" /></div>
      </div>
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
  document.querySelectorAll('#table-stocks thead th[data-sort]').forEach(th => {
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
    document.getElementById('tbody-stocks').innerHTML = `
      <tr><td colspan="9" class="muted text-center">
        Catalogue vide. Cliquer sur "Réinitialiser depuis catalogue" pour pré-remplir.
      </td></tr>`;
  }
}
await chargerProduits();

listenStocks(s => { stocks = s; renderTable(); });

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

  const tbody = document.getElementById('tbody-stocks');
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" class="muted text-center">Aucun produit.</td></tr>`;
  } else {
    tbody.innerHTML = rows.map(({ p, qte, seuil, statut }) => {
      const marge = (p.prixVente || 0) - (p.prixAchat || 0);
      const cls = statut === 'rupture' ? 'alert-out' : (statut === 'bas' ? 'alert-low' : '');
      const badge = statut === 'rupture'
        ? '<span class="badge danger">RUPTURE</span>'
        : (statut === 'bas' ? '<span class="badge warn">BAS</span>' : '<span class="badge ok">OK</span>');
      return `
        <tr class="${cls}">
          <td>${escapeHtml(p.nom)}</td>
          <td><span class="muted">${CATEGORY_LABELS[p.categorie] || p.categorie}</span></td>
          <td class="right mono">${num(qte)}</td>
          <td class="right mono">${money(p.prixAchat || 0)}</td>
          <td class="right mono">${money(p.prixVente || 0)}</td>
          <td class="right mono ${marge >= 0 ? '' : 'muted'}">${money(marge)}</td>
          <td class="right mono">${num(seuil)}</td>
          <td class="center">${badge}</td>
          ${editable ? `<td class="center">
            <button class="btn btn-sm btn-ghost" data-edit="${p.id}">Modifier</button>
            ${canCreate ? `<button class="btn btn-sm btn-danger" data-delete-produit="${p.id}" title="Supprimer ce produit du catalogue">×</button>` : ''}
          </td>` : ''}
        </tr>
      `;
    }).join('');

    // Wire edit buttons
    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => ouvrirEdition(btn.dataset.edit));
    });

    // Wire delete buttons (direction + DRH uniquement)
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
            ⚠ Si ce produit a encore des stocks ou apparaît dans les logs FiveM, il sera <strong>recréé automatiquement</strong> par le bot. Pour ça utilise plutôt le mapping des items.`,
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

  // Stats
  const ruptures = rows.filter(r => r.statut === 'rupture').length;
  const bas = rows.filter(r => r.statut === 'bas').length;
  document.getElementById('stats-stock').textContent =
    `${rows.length} produits — ${ruptures} ruptures, ${bas} sous seuil`;
}

document.getElementById('filtre-categorie').addEventListener('change', renderTable);
document.getElementById('filtre-alerte').addEventListener('change', renderTable);
document.getElementById('filtre-recherche').addEventListener('input', renderTable);

// Tri par colonne (click sur en-tête)
document.querySelectorAll('#table-stocks thead th[data-sort]').forEach(th => {
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

// === Initialisation depuis catalogue ===
const btnInit = document.getElementById('btn-init-catalogue');
if (btnInit) {
  btnInit.addEventListener('click', async () => {
    const ok = await confirmCritique({
      titre: 'Réinitialiser depuis le catalogue',
      message: 'Cette action va <strong>écraser les noms, catégories, prix de vente et seuils</strong> de tous les produits existants avec les valeurs par défaut du catalogue.<br><br>✓ Les prix d\'achat existants seront <strong>préservés</strong>.<br>⚠ Les produits hors catalogue ne seront pas supprimés.',
      btnConfirm: 'Réinitialiser le catalogue',
      delaiSec: 3
    });
    if (!ok) return;
    try {
      const existants = produits.reduce((m, p) => (m[p.id] = p, m), {});
      for (const item of CATALOGUE) {
        const ex = existants[item.id] || {};
        await setProduit(item.id, {
          nom: item.nom,
          categorie: item.categorie,
          prixVente: ex.prixVente ?? item.prixVente,
          prixAchat: ex.prixAchat ?? 0,
          seuilAlerte: ex.seuilAlerte ?? 0
        });
      }
      toastSuccess(`${CATALOGUE.length} produits initialisés.`);
      await chargerProduits();
      renderTable();
    } catch (err) {
      toastError("Erreur d'initialisation.");
      console.error(err);
    }
  });
}

// === Derniers mouvements ===
async function chargerMouvements() {
  const mvts = await listMouvementsRecents(20).catch(() => []);
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
        <th data-sort="source">Source</th>
        <th data-sort="raison">Raison</th>
      </tr></thead>
      <tbody>
        ${mvts.map(m => `
          <tr>
            <td>${datetime(m.timestamp)}</td>
            <td><span class="badge ${m.type?.includes('add') ? 'ok' : 'warn'}">${m.type}</span></td>
            <td>${escapeHtml(m.item || '—')}</td>
            <td class="right mono">${num(m.quantite || 0)}</td>
            <td>${escapeHtml(m.par || m.source || '—')}</td>
            <td class="muted">${escapeHtml(m.raison || '')}</td>
          </tr>
        `).join('')}
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
      await setProduit(id, { nom, categorie, prixAchat, prixVente, seuilAlerte });
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
