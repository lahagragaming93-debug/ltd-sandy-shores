// ============================================================
// Page : Stations essence (8 stations)
// ============================================================

import { requireAuth } from '../auth.js';
import { renderShell } from '../layout.js';
import { listenStations, setStation, listRedistributionsSemaine,
         getConfig, setConfig, doc, deleteDoc } from '../api.js';
import { db } from '../firebase-config.js';
import { money, moneyPrecis, num, datetime, escapeHtml, startOfWeekRP, endOfWeekRP } from '../utils/formatters.js';
import { isDirection, isSuperAdmin, isPompiste } from '../utils/permissions.js';
import { toastSuccess, toastError } from '../utils/toast.js';
import { confirmCritique, infoModal } from '../utils/confirmation.js';
import { wrapScroll, makeSortable } from '../utils/sortable-table.js';

const { profile } = await requireAuth('stocks_essence');
// fullEdit  = peut TOUT modifier (prix, capacite, seuil, N° pompe, supprimer, ajouter une station)
// stockOnly = peut UNIQUEMENT toucher stockActuel (pompiste qui ravitaille)
// 2026-05-13 : DRH ajoute dans fullEdit (alignement Direction sur demande patron).
const fullEdit  = isDirection(profile.role) || isSuperAdmin(profile.role) || profile.role === 'drh';
const stockOnly = !fullEdit && (profile.role === 'responsable-pompiste' || isPompiste(profile.role));
const editable  = fullEdit || stockOnly;

const html = `
  <div class="kpi-grid" id="kpis-essence">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div class="page-toolbar">
    ${fullEdit ? '<button class="btn btn-primary btn-icon" id="btn-ajouter-station" title="Ajouter une station essence" data-tooltip="Ajouter station">➕</button>' : ''}
    ${fullEdit ? '<button class="btn btn-icon" id="btn-config-essence" title="Configuration quotas et prix essence" data-tooltip="Configuration">⚙</button>' : ''}
    ${stockOnly ? '<button class="btn btn-primary btn-compact" id="btn-declarer-caoutchoucs" title="Déclarer le nombre de caoutchoucs fabriqués">📦 Déclarer caoutchoucs</button>' : ''}
    <span class="spacer"></span>
    <span class="muted mono" id="stations-count">—</span>
  </div>

  ${stockOnly ? `
    <!-- Modal declaration caoutchoucs -->
    <div id="modal-caoutchoucs" class="modal-backdrop hidden">
      <div class="modal" style="max-width:480px;">
        <h3>📦 Déclarer des caoutchoucs fabriqués</h3>
        <div class="alert info mb-2" style="font-size:0.82rem;">
          <span class="icon">ℹ</span>
          <span>Saisis le <strong>nombre de caoutchoucs</strong> que tu viens de fabriquer et de poser dans le coffre dédié. Le site met à jour ton quota immédiatement.</span>
        </div>
        <label>Nombre de caoutchoucs fabriqués</label>
        <input type="number" id="caou-nb" min="1" max="500" step="1" placeholder="ex: 50" />
        <div class="muted mt-1" id="caou-preview" style="font-size:0.82rem;">—</div>
        <div class="row mt-3">
          <button class="btn btn-primary" id="btn-save-caoutchoucs">Valider la déclaration</button>
          <button class="btn btn-ghost" id="btn-cancel-caoutchoucs">Annuler</button>
        </div>
      </div>
    </div>
  ` : ''}

  <div class="panel framed">
    <div class="panel-title"><span>Stations</span></div>
    <div id="stations-grid">Chargement…</div>
  </div>

  <div class="panel">
    <div class="panel-title"><span>Redistributions de la semaine</span></div>
    <div id="redistributions">Chargement…</div>
  </div>

  <!-- Modal station -->
  <div id="modal-station" class="modal-backdrop hidden">
    <div class="modal">
      <h3 id="modal-station-title">Station</h3>
      ${stockOnly ? `
        <div class="alert info mb-2" style="font-size:0.82rem;">
          <span class="icon">ℹ</span>
          <span>Saisis le <strong>nombre de bidons</strong> que tu viens de mettre dans la station (1 bidon = 15 L). Le site met automatiquement à jour le stock, l'historique et ton quota.</span>
        </div>

        <div class="panel" style="margin:0 0 12px 0;background:rgba(0,0,0,0.18);">
          <div class="row between"><span class="muted">Station</span><strong id="ro-nom">—</strong></div>
          <div class="row between"><span class="muted">Stock actuel</span><strong id="ro-stock-actuel">—</strong></div>
          <div class="row between"><span class="muted">Capacité max</span><strong id="ro-stock-max">—</strong></div>
        </div>

        <label>Bidons ajoutés <span class="muted" style="font-size:0.75rem;">— 1 bidon = 15 L</span></label>
        <input type="number" id="st-bidons" min="1" step="1" placeholder="ex: 5" />
        <div class="muted mt-1" id="bidons-preview" style="font-size:0.82rem;">—</div>

        <input type="hidden" id="st-id" />
      ` : `
        <input type="hidden" id="st-id" />
        <label>Nom</label>
        <input type="text" id="st-nom" required />
        <div class="field-row">
          <div><label>Stock actuel (L)</label><input type="number" id="st-stock-actuel" min="0" /></div>
          <div><label>Capacité max (L)</label><input type="number" id="st-stock-max" min="0" /></div>
          <div><label>Seuil alerte (L)</label><input type="number" id="st-seuil" min="0" /></div>
        </div>
        <label>Prix au litre ($)</label>
        <input type="number" id="st-prix" step="0.1" min="0" />
        <label>N° pompe FiveM <span class="muted" style="font-size:0.75rem;">— identifiant in-game qui apparaît dans "Redistribution N°XXXXX" (#logs-ig)</span></label>
        <input type="text" id="st-fivem-pompe" placeholder="ex: 16060" />
      `}
      <div class="row mt-3">
        <button class="btn btn-primary" id="btn-save-station">${stockOnly ? '⛽ Valider le ravitaillement' : '💾 Enregistrer'}</button>
        ${fullEdit ? '<button class="btn btn-icon btn-danger" id="btn-delete-station" style="display:none;" title="Supprimer la station" data-tooltip="Supprimer">🗑</button>' : ''}
        <button class="btn btn-ghost" id="btn-cancel-station">Annuler</button>
      </div>
    </div>
  </div>

  <!-- Modal config essence -->
  <div id="modal-config" class="modal-backdrop hidden">
    <div class="modal" style="max-width:560px;">
      <h3>Configuration essence</h3>

      <div class="alert info mb-2" style="font-size:0.82rem;">
        <span class="icon">ℹ</span>
        <span>Effet immédiat sur le calcul des paies pompistes (bidons + caoutchoucs) et vendeurs (CA hebdo). Le prix au litre et le seuil d'alerte se modifient station par station.</span>
      </div>

      <label>Quota bidons / pompiste / semaine</label>
      <input type="number" id="cfg-quota-bidons" min="0" />
      <label>Quota caoutchoucs / pompiste / semaine</label>
      <input type="number" id="cfg-quota-caoutchoucs" min="0" />
      <label>Quota CA / vendeur / semaine ($)</label>
      <input type="number" id="cfg-quota-ca-vendeur" min="0" step="1000" />

      <div class="row mt-3" style="flex-wrap:wrap; gap:8px;">
        <button class="btn btn-primary" id="btn-save-config">Enregistrer config</button>
        <button class="btn btn-ghost" id="btn-cancel-config">Fermer</button>
      </div>
    </div>
  </div>
`;
renderShell(profile, 'stocks_essence', html);

let stations = [];
let config = await getConfig().catch(() => ({}));

listenStations(s => {
  console.log('[stations] listener fired —', s.length, 'stations');
  stations = s;
  renderStations();
});

function renderStations() {
  const grid = document.getElementById('stations-grid');
  if (stations.length === 0) {
    grid.innerHTML = `<p class="muted">Aucune station configurée. ${editable ? 'Ajoute la première avec le bouton ci-dessus.' : ''}</p>`;
    document.getElementById('stations-count').textContent = '0 stations';
    miseAJourKpis(stations);
    return;
  }
  document.getElementById('stations-count').textContent = `${stations.length} station${stations.length > 1 ? 's' : ''}`;

  grid.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px;">
      ${stations.map(s => {
        const niveau = s.stockMax ? (s.stockActuel / s.stockMax) * 100 : 0;
        const sousAlerte = s.stockActuel < (s.seuilAlerte || 0);
        const cls = sousAlerte ? 'alert-out' : '';
        return `
          <div class="panel" style="margin:0;${sousAlerte ? 'border-color:var(--color-blood);' : ''}">
            <div class="row between">
              <h4 style="margin:0;color:var(--color-sand-light);">${escapeHtml(s.nom)}</h4>
              ${sousAlerte ? '<span class="badge danger">⚠ ALERTE</span>' : '<span class="badge ok">OK</span>'}
            </div>
            <div class="progress mt-2" style="height:22px;">
              <div class="fill" style="width:${Math.min(niveau, 100)}%"></div>
              <div class="label">${num(s.stockActuel || 0)} / ${num(s.stockMax || 0)} L</div>
            </div>
            <div class="row between mt-2 muted mono" style="font-size:0.8rem;">
              <span>Prix : ${moneyPrecis(s.prixLitre || 0)}/L</span>
              <span>Seuil : ${num(s.seuilAlerte || 0)} L</span>
            </div>
            ${editable ? `
              <button class="btn btn-sm mt-2" data-edit="${s.id}">Modifier / redistribuer</button>
            ` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;

  grid.querySelectorAll('[data-edit]').forEach(b => {
    b.addEventListener('click', () => ouvrirStation(b.dataset.edit));
  });

  miseAJourKpis(stations);
}

function miseAJourKpis(stations) {
  const totalActuel = stations.reduce((s, x) => s + (x.stockActuel || 0), 0);
  const totalMax = stations.reduce((s, x) => s + (x.stockMax || 0), 0);
  const enAlerte = stations.filter(x => x.stockActuel < (x.seuilAlerte || 0)).length;
  const niveau = totalMax ? (totalActuel / totalMax) * 100 : 0;
  document.getElementById('kpis-essence').innerHTML = `
    <div class="kpi"><div class="label">Stations</div><div class="value">${stations.length}</div><div class="delta">configurées</div></div>
    <div class="kpi"><div class="label">Stock total</div><div class="value">${num(totalActuel)} L</div><div class="delta">${num(totalMax)} L max (${niveau.toFixed(0)}%)</div></div>
    <div class="kpi"><div class="label">Stations en alerte</div><div class="value">${enAlerte}</div><div class="delta ${enAlerte ? 'down' : 'up'}">sous seuil</div></div>
    <div class="kpi"><div class="label">Quota bidon/sem</div><div class="value">${num(config.quotaBidons || 1700)}</div><div class="delta">par pompiste</div></div>
  `;
}

// === Modal station ===
const modal = document.getElementById('modal-station');

if (fullEdit) {
  document.getElementById('btn-ajouter-station').addEventListener('click', () => {
    document.getElementById('st-id').value = '';
    document.getElementById('st-nom').value = '';
    document.getElementById('st-stock-actuel').value = 0;
    document.getElementById('st-stock-max').value = 30000;
    document.getElementById('st-seuil').value = 1000;
    document.getElementById('st-prix').value = 5;
    document.getElementById('st-fivem-pompe').value = '';
    document.getElementById('modal-station-title').textContent = 'Nouvelle station';
    const delBtn = document.getElementById('btn-delete-station');
    if (delBtn) delBtn.style.display = 'none';
    modal.classList.remove('hidden');
  });
}

function ouvrirStation(id) {
  const s = stations.find(x => x.id === id);
  if (!s) return;
  document.getElementById('st-id').value = id;
  document.getElementById('modal-station-title').textContent = s.nom;

  if (stockOnly) {
    document.getElementById('ro-nom').textContent = s.nom || '—';
    document.getElementById('ro-stock-actuel').textContent = `${num(s.stockActuel || 0)} L`;
    document.getElementById('ro-stock-max').textContent = `${num(s.stockMax || 0)} L`;
    document.getElementById('st-bidons').value = '';
    document.getElementById('bidons-preview').textContent = '—';
  } else {
    document.getElementById('st-nom').value = s.nom || '';
    document.getElementById('st-stock-actuel').value = s.stockActuel || 0;
    document.getElementById('st-stock-max').value = s.stockMax || 0;
    document.getElementById('st-seuil').value = s.seuilAlerte || 0;
    document.getElementById('st-prix').value = s.prixLitre || 0;
    document.getElementById('st-fivem-pompe').value = s.fivemPompeId || '';
    const delBtn = document.getElementById('btn-delete-station');
    if (delBtn) delBtn.style.display = 'inline-block';
  }
  modal.classList.remove('hidden');
}

// Preview live + barriere overflow : 1 bidon = 15 L, refuser si depasse stockMax.
const BIDON_L = 15;
if (stockOnly) {
  document.getElementById('st-bidons').addEventListener('input', (e) => {
    const id = document.getElementById('st-id').value;
    const s = stations.find(x => x.id === id);
    if (!s) return;
    const n = parseInt(e.target.value, 10);
    const preview = document.getElementById('bidons-preview');
    if (!Number.isFinite(n) || n <= 0) {
      preview.textContent = '—';
      preview.style.color = '';
      return;
    }
    const ajout = n * BIDON_L;
    const stockFinal = (s.stockActuel || 0) + ajout;
    const stockMax = s.stockMax || 0;
    if (stockMax > 0 && stockFinal > stockMax) {
      const placeRestante = Math.max(0, stockMax - (s.stockActuel || 0));
      const bidonsMax = Math.floor(placeRestante / BIDON_L);
      preview.style.color = 'var(--color-blood, #d33)';
      preview.innerHTML = `⛔ Impossible : ${n} bidons = ${num(ajout)} L mais la station n'accepte que <strong>${bidonsMax} bidons max</strong> (${num(placeRestante)} L libres).`;
    } else {
      preview.style.color = '';
      preview.textContent = `${n} bidon${n > 1 ? 's' : ''} = ${num(ajout)} L → stock final : ${num(stockFinal)} L / ${num(stockMax)} L`;
    }
  });
}

document.getElementById('btn-cancel-station').addEventListener('click', () => modal.classList.add('hidden'));

document.getElementById('btn-save-station').addEventListener('click', async () => {
  const id = document.getElementById('st-id').value || ('station_' + Date.now());

  // Cas pompiste : saisie en bidons. La Cloud Function fait atomiquement :
  // (1) maj stockActuel station, (2) doc /redistributions audit, (3) increment quota.
  if (stockOnly) {
    if (!id) return toastError("Station introuvable.");
    const bidons = parseInt(document.getElementById('st-bidons').value, 10);
    if (!Number.isFinite(bidons) || bidons <= 0) {
      return toastError("Indique un nombre de bidons > 0.");
    }
    // Pre-check overflow cote client (la function refusera aussi server-side).
    const s = stations.find(x => x.id === id);
    if (s && s.stockMax > 0) {
      const stockFinal = (s.stockActuel || 0) + bidons * BIDON_L;
      if (stockFinal > s.stockMax) {
        const placeRestante = Math.max(0, s.stockMax - (s.stockActuel || 0));
        const bidonsMax = Math.floor(placeRestante / BIDON_L);
        await infoModal({
          titre: 'Ravitaillement impossible',
          message: `La station <strong>${escapeHtml(s.nom)}</strong> ne peut pas recevoir <strong>${bidons} bidons</strong> (${num(bidons * BIDON_L)} L).<br><br>
            Stock actuel : <strong>${num(s.stockActuel || 0)} L</strong><br>
            Capacité max : <strong>${num(s.stockMax)} L</strong><br>
            Place restante : <strong>${num(placeRestante)} L</strong> = <strong>${bidonsMax} bidons max</strong>.<br><br>
            Vérifie le nombre que tu viens de mettre. Si tu confirmes avoir mis ${bidons} bidons, contacte la direction.`,
          type: 'danger'
        });
        return;
      }
    }
    try {
      const { auth } = await import('../firebase-config.js');
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch('https://europe-west1-ltd-sandy-shores-f3919.cloudfunctions.net/pompisteRavitaillerManuel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({ stationId: id, bidons })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      const msg = `Ravitaillement enregistré : ${bidons} bidon${bidons > 1 ? 's' : ''} (+${num(json.litresAjoutes)} L). Stock à ${num(json.stockApres)} L.${json.capped ? ' ⚠ plafonné capacité max.' : ''}`;
      toastSuccess(msg);
      modal.classList.add('hidden');
      // listenStations va re-rendre automatiquement, mais on prepare un refresh
      // du tableau redistributions
      chargerRedistributions();
    } catch (e) {
      console.error('[stations] ravitaillement pompiste FAIL', id, e);
      toastError("Échec : " + (e?.message || e?.code || "erreur inattendue."));
    }
    return;
  }

  // Cas fullEdit : modif silencieuse direction (pas d'alerte)
  // Le tag source 'modal-manuel-direction' override un eventuel tag 'pompiste'
  // anterieur pour eviter que le trigger reste arme.

  // Cas fullEdit : patch complet
  const lirePrix = (sel) => {
    const v = (document.getElementById(sel).value || '').toString().replace(',', '.');
    return Number(v);
  };
  const fivemPompeId = (document.getElementById('st-fivem-pompe').value || '').trim();
  const data = {
    nom: document.getElementById('st-nom').value.trim(),
    stockActuel: Number(document.getElementById('st-stock-actuel').value) || 0,
    stockMax: Number(document.getElementById('st-stock-max').value) || 0,
    seuilAlerte: Number(document.getElementById('st-seuil').value) || 0,
    prixLitre: lirePrix('st-prix') || 0,
    fivemPompeId,
    sourceMajAuto: 'modal-manuel-direction'    // override tag pompiste si present
  };
  if (!data.nom) return toastError("Nom obligatoire.");
  try {
    await setStation(id, data);
    if (fivemPompeId) {
      await setConfig({ fivemPompesMap: { [fivemPompeId]: id } });
    }
    const idx = stations.findIndex(x => x.id === id);
    if (idx >= 0) {
      stations[idx] = { ...stations[idx], ...data };
    } else {
      stations.push({ id, ...data });
    }
    renderStations();
    toastSuccess(`Station "${data.nom}" enregistrée${fivemPompeId ? ` (N°pompe ${fivemPompeId})` : ''}.`);
    modal.classList.add('hidden');
  } catch (e) {
    console.error('[stations] save FAIL', id, e);
    toastError("Échec : " + (e?.message || e?.code || "erreur inattendue. Voir console F12."));
  }
});

const btnDel = document.getElementById('btn-delete-station');
if (btnDel) {
  btnDel.addEventListener('click', async () => {
    const id = document.getElementById('st-id').value;
    if (!id) return;
    const ok = await confirmCritique({
      titre: 'Supprimer cette station',
      message: `La station <strong>${escapeHtml(id)}</strong> sera définitivement retirée du site.<br><br>L'historique de redistributions associé reste consultable mais aucune nouvelle redistribution n'y sera attachée.`,
      btnConfirm: 'Supprimer la station',
      delaiSec: 3,
      requireType: 'SUPPRIMER'
    });
    if (!ok) return;
    try {
      await deleteDoc(doc(db, 'stations', id));
      toastSuccess("Station supprimée.");
      modal.classList.add('hidden');
    } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); }
  });
}

// === Modal declaration caoutchoucs (pompiste) ===
if (stockOnly) {
  const modalCaou = document.getElementById('modal-caoutchoucs');
  const inputCaou = document.getElementById('caou-nb');
  const previewCaou = document.getElementById('caou-preview');
  const quotaC = config.quotaCaoutchoucs || 800;

  document.getElementById('btn-declarer-caoutchoucs').addEventListener('click', () => {
    inputCaou.value = '';
    previewCaou.textContent = `Quota hebdo : ${num(quotaC)} caoutchoucs.`;
    previewCaou.style.color = '';
    modalCaou.classList.remove('hidden');
  });

  inputCaou.addEventListener('input', () => {
    const n = parseInt(inputCaou.value, 10);
    if (!Number.isFinite(n) || n <= 0) {
      previewCaou.textContent = `Quota hebdo : ${num(quotaC)} caoutchoucs.`;
      previewCaou.style.color = '';
      return;
    }
    if (n > 500) {
      previewCaou.style.color = 'var(--color-blood, #d33)';
      previewCaou.textContent = `⛔ Maximum 500 par déclaration. Saisis ${n} en plusieurs fois.`;
      return;
    }
    previewCaou.style.color = '';
    previewCaou.textContent = `+${num(n)} caoutchouc${n > 1 ? 's' : ''} ajoutés à ton quota hebdo (${num(quotaC)} max).`;
  });

  document.getElementById('btn-cancel-caoutchoucs').addEventListener('click', () => {
    modalCaou.classList.add('hidden');
  });

  document.getElementById('btn-save-caoutchoucs').addEventListener('click', async () => {
    const n = parseInt(inputCaou.value, 10);
    if (!Number.isFinite(n) || n <= 0) return toastError("Indique un nombre > 0.");
    if (n > 500) return toastError("Maximum 500 par déclaration.");
    try {
      const { auth } = await import('../firebase-config.js');
      const idToken = await auth.currentUser.getIdToken();
      const resp = await fetch('https://europe-west1-ltd-sandy-shores-f3919.cloudfunctions.net/pompisteDeclarerCaoutchoucs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + idToken },
        body: JSON.stringify({ caoutchoucs: n })
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(json.error || `HTTP ${resp.status}`);
      toastSuccess(`Déclaration enregistrée : ${n} caoutchouc${n > 1 ? 's' : ''} ajoutés à ton quota.`);
      modalCaou.classList.add('hidden');
    } catch (e) {
      toastError(e?.message || "Erreur inattendue.");
    }
  });
}

// === Modal config (reserve fullEdit) ===
if (fullEdit) {
document.getElementById('btn-config-essence').addEventListener('click', () => {
  document.getElementById('cfg-quota-bidons').value = config.quotaBidons ?? 1700;
  document.getElementById('cfg-quota-caoutchoucs').value = config.quotaCaoutchoucs ?? 800;
  document.getElementById('cfg-quota-ca-vendeur').value = config.quotaCAVendeur ?? 30000;
  document.getElementById('modal-config').classList.remove('hidden');
});
document.getElementById('btn-cancel-config').addEventListener('click', () => {
  document.getElementById('modal-config').classList.add('hidden');
});
document.getElementById('btn-save-config').addEventListener('click', async () => {
  if (!fullEdit) return toastError("Direction uniquement.");
  const patch = {
    quotaBidons: Number(document.getElementById('cfg-quota-bidons').value) || 1700,
    quotaCaoutchoucs: Number(document.getElementById('cfg-quota-caoutchoucs').value) || 800,
    quotaCAVendeur: Number(document.getElementById('cfg-quota-ca-vendeur').value) || 30000
  };
  try {
    await setConfig(patch);
    config = { ...config, ...patch };
    toastSuccess("Configuration enregistrée.");
    document.getElementById('modal-config').classList.add('hidden');
    miseAJourKpis(stations);
  } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); }
});
} // fin if (fullEdit) — bloc Modal config

// === Redistributions de la semaine ===
const debut = startOfWeekRP();
const fin   = endOfWeekRP();
async function chargerRedistributions() {
  const list = await listRedistributionsSemaine(debut, fin).catch(() => []);
  const div = document.getElementById('redistributions');
  if (list.length === 0) {
    div.innerHTML = `<p class="muted">Aucune redistribution cette semaine (logs Discord à venir).</p>`;
    return;
  }
  div.innerHTML = `
    <table class="data" id="table-redistributions">
      <thead><tr>
        <th data-sort="date">Date</th>
        <th data-sort="source">Source</th>
        <th data-sort="station">Station</th>
        <th data-sort="pompiste">Pompiste</th>
        <th class="right" data-sort="litres">Litres</th>
        <th class="right" data-sort="prix">Prix/L</th>
        <th class="right" data-sort="montant">Montant</th>
        <th class="right" data-sort="stockAvant">Stock avant</th>
        <th class="right" data-sort="stockApres">Stock après</th>
      </tr></thead>
      <tbody>
        ${list.map(r => {
          const manuel = r.source === 'manuel-pompiste';
          const sourceLabel = manuel
            ? `<span class="badge" style="background:rgba(255,180,0,0.15);color:var(--color-gold);">manuel</span>`
            : `<span class="muted" style="font-size:0.8rem;">FiveM</span>`;
          const pompiste = manuel
            ? escapeHtml(r.pompisteNom || '—')
            : '<span class="muted">—</span>';
          const litresStr = manuel && r.bidons
            ? `${num(r.litres)} <span class="muted" style="font-size:0.75rem;">(${r.bidons} bidon${r.bidons > 1 ? 's' : ''})</span>`
            : num(r.litres);
          return `
            <tr>
              <td>${datetime(r.timestamp)}</td>
              <td>${sourceLabel}</td>
              <td>${escapeHtml(r.station || r.stationId || '—')}</td>
              <td>${pompiste}</td>
              <td class="right mono">${litresStr}</td>
              <td class="right mono">${moneyPrecis(r.prixLitre)}</td>
              <td class="right mono">${money(r.montant)}</td>
              <td class="right mono muted">${r.stockAvant != null ? num(r.stockAvant) + ' L' : '—'}</td>
              <td class="right mono">${r.stockApres != null ? num(r.stockApres) + ' L' : '—'}</td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
  const tRedis = document.getElementById('table-redistributions');
  wrapScroll(tRedis, 400);
  makeSortable(tRedis);
}
chargerRedistributions();
