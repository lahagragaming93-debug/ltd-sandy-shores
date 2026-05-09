// ============================================================
// Page : Stocks épicerie
// ============================================================

import { requireAuth, getCurrentUser } from '../auth.js';
import { renderShell } from '../layout.js';
import {
  listProduits, setProduit, listenStocks, ajusterStock, listMouvementsRecents
} from '../api.js';
import { CATALOGUE, CATEGORY_LABELS } from '../data/produits.js';
import { money, num, datetime, escapeHtml } from '../utils/formatters.js';
import { isDirection } from '../utils/permissions.js';
import { toastSuccess, toastError } from '../utils/toast.js';
import { confirmCritique } from '../utils/confirmation.js';

const { profile } = await requireAuth('stocks_epicerie');
const editable = isDirection(profile.role) || profile.role === 'responsable-vente';

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
    ${editable ? `
      <button class="btn btn-primary" id="btn-init-catalogue">Réinitialiser depuis catalogue</button>
    ` : ''}
  </div>

  <div class="panel framed">
    <div class="panel-title">
      <span>Inventaire épicerie</span>
      <span class="muted mono" id="stats-stock">—</span>
    </div>
    <table class="data" id="table-stocks">
      <thead>
        <tr>
          <th>Produit</th>
          <th>Catégorie</th>
          <th class="right">Stock</th>
          <th class="right">Prix achat</th>
          <th class="right">Prix vente</th>
          <th class="right">Marge</th>
          <th class="right">Seuil alerte</th>
          <th class="center">Statut</th>
          ${editable ? '<th class="center">Actions</th>' : ''}
        </tr>
      </thead>
      <tbody id="tbody-stocks"><tr><td colspan="9" class="muted text-center">Chargement…</td></tr></tbody>
    </table>
  </div>

  <div class="panel">
    <div class="panel-title"><span>Derniers mouvements de stock</span></div>
    <div id="mouvements">Chargement…</div>
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
          </td>` : ''}
        </tr>
      `;
    }).join('');

    // Wire edit buttons
    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', () => ouvrirEdition(btn.dataset.edit));
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
          seuilAlerte: ex.seuilAlerte ?? 5
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
    <table class="data">
      <thead><tr>
        <th>Date</th><th>Type</th><th>Item</th>
        <th class="right">Quantité</th><th>Source</th><th>Raison</th>
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
}
chargerMouvements();
