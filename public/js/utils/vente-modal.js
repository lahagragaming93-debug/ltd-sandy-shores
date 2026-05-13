// ============================================================
// Modal Declaration de vente — utilisable employe (creation) + admin (edition).
// ============================================================
// Source de verite : la Cloud Function declarerVente / modifierVente.
// Le prixAchat affiche cote client est INDICATIF — recalcul serveur.
// ============================================================

import { listProduits } from '../api.js';
import { money, escapeHtml } from './formatters.js';
import { toastSuccess, toastError } from './toast.js';
import { auth } from '../firebase-config.js';

const FUNCTIONS_BASE = 'https://europe-west1-ltd-sandy-shores-f3919.cloudfunctions.net';

const MODAL_HTML = `
  <div id="modal-vente" class="modal-backdrop hidden">
    <div class="modal" style="max-width:780px;max-height:92vh;overflow-y:auto;">
      <h3 id="modal-vente-title">📝 Déclarer une vente</h3>

      <div class="alert info mb-2" style="font-size:0.82rem;">
        <span class="icon">ℹ</span>
        <span id="modal-vente-info">
          Saisis chaque produit vendu et la quantité. Le <strong>prix de vente</strong>
          et le <strong>bénéfice</strong> sont calculés automatiquement depuis le catalogue.
          La vente sera <strong>verrouillée</strong> après validation.
        </span>
      </div>

      <input type="hidden" id="vente-id" />
      <input type="hidden" id="vente-mode" value="create" />

      <label>Lignes de produits</label>
      <div id="vente-lignes" style="display:flex;flex-direction:column;gap:6px;"></div>
      <button class="btn btn-ghost mt-1" id="btn-vente-add-ligne" type="button" style="width:fit-content;">+ Ajouter un produit</button>

      <!-- Champs admin (caches en mode create employe) -->
      <div id="vente-admin-fields" class="hidden">
        <div class="field-row mt-3">
          <div>
            <label>Montant encaissé ($)<span class="muted" style="font-size:0.75rem;"> — laisser vide = prix catalogue</span></label>
            <input type="number" id="vente-montant" min="0" step="0.01" placeholder="auto" />
          </div>
          <div>
            <label>Moyen de paiement</label>
            <select id="vente-paiement">
              <option value="">— défaut (espèces) —</option>
              <option value="especes">Espèces</option>
              <option value="carte">Carte / Virement</option>
              <option value="autre">Autre</option>
            </select>
          </div>
        </div>

        <label class="mt-2">Nom du client</label>
        <input type="text" id="vente-client" placeholder="Client comptoir (par défaut)" maxlength="120" />
      </div>

      <div id="vente-motif-bloc" class="hidden mt-2">
        <label>Motif de modification<span style="color:var(--color-blood-light);">*</span></label>
        <input type="text" id="vente-motif" placeholder="ex: correction prix unitaire, ajout ligne oubliée, etc." maxlength="240" />
      </div>

      <div class="panel mt-3" style="margin:0;background:rgba(0,0,0,0.18);">
        <div class="row between"><span class="muted">Prix de vente total (catalogue)</span><strong id="vente-ca">$0</strong></div>
        <div class="row between"><span class="muted">Coût total (prix achat)</span><strong id="vente-cout">$0</strong></div>
        <div class="row between" style="border-top:1px solid rgba(255,255,255,0.1);padding-top:6px;margin-top:4px;">
          <span class="muted"><strong>Bénéfice pour le LTD</strong></span>
          <strong id="vente-benefice" style="font-size:1.1rem;">$0</strong>
        </div>
      </div>

      <div class="row mt-3">
        <button class="btn btn-primary" id="btn-vente-valider" type="button">Valider la vente</button>
        <button class="btn btn-ghost" id="btn-vente-annuler" type="button">Annuler</button>
      </div>
    </div>
  </div>
`;

let produitsCache = null;
let modalInjected = false;
let onSuccessCb = null;

function injectModalIfNeeded() {
  if (modalInjected) return;
  const div = document.createElement('div');
  div.innerHTML = MODAL_HTML;
  document.body.appendChild(div.firstElementChild);
  modalInjected = true;
  document.getElementById('btn-vente-annuler').addEventListener('click', () => fermerModal());
  document.getElementById('btn-vente-add-ligne').addEventListener('click', () => ajouterLigne());
  document.getElementById('btn-vente-valider').addEventListener('click', () => soumettre());
  const elMontant = document.getElementById('vente-montant');
  if (elMontant) elMontant.addEventListener('input', recalculer);
}

function fermerModal() {
  document.getElementById('modal-vente').classList.add('hidden');
}

function optionsProduits() {
  // Tri alpha, regroupement par categorie (optgroup) pour faciliter la recherche
  const groupes = {};
  for (const p of (produitsCache || [])) {
    const cat = p.categorie || 'divers';
    (groupes[cat] = groupes[cat] || []).push(p);
  }
  const order = Object.keys(groupes).sort();
  return order.map(cat => `
    <optgroup label="${escapeHtml(cat)}">
      ${groupes[cat].sort((a, b) => (a.nom || '').localeCompare(b.nom || '')).map(p => {
        const cout = Number(p.prixAchat || 0);
        const vente = Number(p.prixVente || 0);
        return `<option value="${escapeHtml(p.id)}" data-achat="${cout}" data-vente="${vente}" data-nom="${escapeHtml(p.nom || p.id)}">
          ${escapeHtml(p.nom || p.id)}${vente ? ` — ${money(vente)}` : ''}
        </option>`;
      }).join('')}
    </optgroup>
  `).join('');
}

function ajouterLigne(preset = null) {
  const wrap = document.getElementById('vente-lignes');
  const idx = wrap.children.length;
  const row = document.createElement('div');
  row.className = 'row vente-ligne';
  row.style.cssText = 'gap:8px;align-items:flex-end;';
  row.innerHTML = `
    <div style="flex:1;min-width:200px;">
      ${idx === 0 ? '<label style="font-size:0.78rem;">Produit</label>' : ''}
      <select class="vente-prod" style="width:100%;">
        <option value="">— Choisir un produit —</option>
        ${optionsProduits()}
      </select>
    </div>
    <div style="width:90px;">
      ${idx === 0 ? '<label style="font-size:0.78rem;">Quantité</label>' : ''}
      <input type="number" class="vente-qte" min="1" step="1" value="1" />
    </div>
    <div style="width:120px;text-align:right;">
      ${idx === 0 ? '<label style="font-size:0.78rem;">Total ligne</label>' : ''}
      <div class="vente-total-ligne mono" style="padding:8px 0;">$0</div>
    </div>
    <button class="btn btn-danger btn-vente-del" type="button" title="Supprimer la ligne" style="padding:6px 10px;">×</button>
  `;
  wrap.appendChild(row);
  if (preset) {
    row.querySelector('.vente-prod').value = preset.produitId || '';
    row.querySelector('.vente-qte').value = preset.quantite || 1;
  }
  row.querySelector('.vente-prod').addEventListener('change', recalculer);
  row.querySelector('.vente-qte').addEventListener('input', recalculer);
  row.querySelector('.btn-vente-del').addEventListener('click', () => { row.remove(); recalculer(); });
  recalculer();
}

function recalculer() {
  let coutTotal = 0;
  let prixVenteTotal = 0;
  document.querySelectorAll('.vente-ligne').forEach(row => {
    const sel = row.querySelector('.vente-prod');
    const opt = sel.selectedOptions[0];
    const qte = Number(row.querySelector('.vente-qte').value) || 0;
    const achat = opt ? Number(opt.dataset.achat || 0) : 0;
    const vente = opt ? Number(opt.dataset.vente || 0) : 0;
    const totalLigne = vente * qte;
    row.querySelector('.vente-total-ligne').textContent = money(totalLigne);
    coutTotal += achat * qte;
    prixVenteTotal += totalLigne;
  });
  // En mode edit, si l'admin saisit un montant, prend le sien. Sinon prixVenteTotal.
  const montantSaisi = Number(document.getElementById('vente-montant')?.value) || 0;
  const montantEffectif = montantSaisi > 0 ? montantSaisi : prixVenteTotal;
  document.getElementById('vente-ca').textContent = money(prixVenteTotal);
  document.getElementById('vente-cout').textContent = money(coutTotal);
  const benefice = montantEffectif - coutTotal;
  const el = document.getElementById('vente-benefice');
  el.textContent = money(benefice);
  el.style.color = benefice >= 0 ? 'var(--color-cactus,#5a8)' : 'var(--color-blood-light)';
}

async function soumettre() {
  const mode = document.getElementById('vente-mode').value;
  const venteId = document.getElementById('vente-id').value;
  const clientNom = document.getElementById('vente-client')?.value.trim() || '';
  const moyenPaiement = document.getElementById('vente-paiement')?.value || '';
  const montantSaisi = Number(document.getElementById('vente-montant')?.value);
  const montantEncaisse = Number.isFinite(montantSaisi) && montantSaisi > 0 ? montantSaisi : null;
  const motifModification = document.getElementById('vente-motif').value.trim();

  if (mode === 'edit' && !motifModification) {
    return toastError("Motif de modification obligatoire.");
  }

  const lignes = [];
  let erreur = null;
  document.querySelectorAll('.vente-ligne').forEach(row => {
    const pid = row.querySelector('.vente-prod').value;
    const qte = Number(row.querySelector('.vente-qte').value);
    if (!pid) { erreur = "Sélectionne un produit dans toutes les lignes."; return; }
    if (!Number.isFinite(qte) || qte <= 0) { erreur = "Quantité invalide dans une ligne."; return; }
    lignes.push({ produitId: pid, quantite: qte });
  });
  if (erreur) return toastError(erreur);
  if (lignes.length === 0) return toastError("Ajoute au moins une ligne de produit.");

  const btn = document.getElementById('btn-vente-valider');
  btn.disabled = true; btn.textContent = 'Envoi…';

  try {
    const idToken = await auth.currentUser.getIdToken();
    const url = mode === 'edit'
      ? `${FUNCTIONS_BASE}/modifierVente`
      : `${FUNCTIONS_BASE}/declarerVente`;
    const body = mode === 'edit'
      ? { venteId, clientNom, moyenPaiement, montantEncaisse: montantEncaisse || 0, lignes, motifModification }
      : { lignes, clientNom: clientNom || undefined, moyenPaiement: moyenPaiement || undefined, montantEncaisse: montantEncaisse || undefined };

    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
      body: JSON.stringify(body)
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) throw new Error(json.error || `HTTP ${resp.status}`);

    const msg = mode === 'edit'
      ? `Vente modifiée : ${money(json.montant)} (bénéfice ${money(json.benefice)}).`
      : `Vente #${json.factureId} enregistrée : ${money(json.montant)} encaissés, bénéfice ${money(json.benefice)}.`;
    toastSuccess(msg);
    fermerModal();
    if (typeof onSuccessCb === 'function') onSuccessCb(json);
  } catch (e) {
    console.error('[vente-modal]', e);
    toastError("Échec : " + (e?.message || "erreur inattendue."));
  } finally {
    btn.disabled = false;
    btn.textContent = mode === 'edit' ? 'Enregistrer la modification' : 'Valider la vente';
  }
}

// ============================================================
// API publique
// ============================================================

export async function ouvrirModalNouvelleVente({ onSuccess } = {}) {
  injectModalIfNeeded();
  if (!produitsCache) produitsCache = await listProduits().catch(() => []);
  onSuccessCb = onSuccess || null;

  document.getElementById('modal-vente-title').textContent = '📝 Déclarer une vente';
  document.getElementById('vente-mode').value = 'create';
  document.getElementById('vente-id').value = '';
  document.getElementById('vente-client').value = '';
  document.getElementById('vente-paiement').value = '';
  document.getElementById('vente-montant').value = '';
  document.getElementById('vente-motif').value = '';
  document.getElementById('vente-motif-bloc').classList.add('hidden');
  // Mode employe : on cache les champs admin (montant/client/paiement)
  document.getElementById('vente-admin-fields').classList.add('hidden');
  document.getElementById('btn-vente-valider').textContent = 'Valider la vente';
  document.getElementById('vente-lignes').innerHTML = '';
  ajouterLigne();
  recalculer();
  document.getElementById('modal-vente').classList.remove('hidden');
}

export async function ouvrirModalModifierVente(vente, { onSuccess } = {}) {
  injectModalIfNeeded();
  if (!produitsCache) produitsCache = await listProduits().catch(() => []);
  onSuccessCb = onSuccess || null;

  document.getElementById('modal-vente-title').textContent = `✏ Modifier la vente #${vente.factureId || vente.id}`;
  document.getElementById('vente-mode').value = 'edit';
  document.getElementById('vente-id').value = vente.id;
  document.getElementById('vente-client').value = vente.client || '';
  document.getElementById('vente-paiement').value = (vente.paiement || '').toLowerCase();
  document.getElementById('vente-montant').value = vente.montant || '';
  document.getElementById('vente-motif').value = '';
  document.getElementById('vente-motif-bloc').classList.remove('hidden');
  // Mode admin : on affiche les champs montant/client/paiement
  document.getElementById('vente-admin-fields').classList.remove('hidden');
  document.getElementById('btn-vente-valider').textContent = 'Enregistrer la modification';
  document.getElementById('vente-lignes').innerHTML = '';

  const lignesSource = Array.isArray(vente.lignes) && vente.lignes.length > 0
    ? vente.lignes
    : (Array.isArray(vente.items) ? vente.items.map(i => ({ produitId: i.id || i.produitId, quantite: i.quantite })) : []);

  if (lignesSource.length === 0) {
    ajouterLigne();
  } else {
    for (const l of lignesSource) ajouterLigne({ produitId: l.produitId, quantite: l.quantite });
  }
  recalculer();
  document.getElementById('modal-vente').classList.remove('hidden');
}
