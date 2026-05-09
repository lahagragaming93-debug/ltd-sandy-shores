// ============================================================
// Page : Stations essence (8 stations)
// ============================================================

import { requireAuth } from '../auth.js';
import { renderShell } from '../layout.js';
import { listenStations, setStation, listRedistributionsSemaine,
         getConfig, setConfig, doc, deleteDoc } from '../api.js';
import { db } from '../firebase-config.js';
import { money, num, datetime, escapeHtml, startOfWeekRP, endOfWeekRP } from '../utils/formatters.js';
import { isDirection } from '../utils/permissions.js';
import { toastSuccess, toastError } from '../utils/toast.js';

const { profile } = await requireAuth('stocks_essence');
const editable = isDirection(profile.role) || profile.role === 'responsable-pompiste';

const html = `
  <div class="kpi-grid" id="kpis-essence">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div class="row mb-2">
    ${editable ? '<button class="btn btn-primary" id="btn-ajouter-station">+ Ajouter une station</button>' : ''}
    <button class="btn" id="btn-config-essence">⚙ Configuration</button>
    <span class="spacer"></span>
    <span class="muted mono" id="stations-count">—</span>
  </div>

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
      <div class="row mt-3">
        <button class="btn btn-primary" id="btn-save-station">Enregistrer</button>
        ${editable ? '<button class="btn btn-danger" id="btn-delete-station" style="display:none;">Supprimer</button>' : ''}
        <button class="btn btn-ghost" id="btn-cancel-station">Annuler</button>
      </div>
    </div>
  </div>

  <!-- Modal config essence -->
  <div id="modal-config" class="modal-backdrop hidden">
    <div class="modal">
      <h3>Configuration essence</h3>
      <label>Quota bidons / pompiste / semaine</label>
      <input type="number" id="cfg-quota-bidons" min="0" />
      <label>Quota caoutchoucs / pompiste / semaine</label>
      <input type="number" id="cfg-quota-caoutchoucs" min="0" />
      <label>Prix essence par défaut ($/L)</label>
      <input type="number" id="cfg-prix-essence" step="0.1" min="0" />
      <label>Seuil alerte essence par défaut (L)</label>
      <input type="number" id="cfg-seuil-essence" min="0" />
      <div class="row mt-3">
        <button class="btn btn-primary" id="btn-save-config">Enregistrer</button>
        <button class="btn btn-ghost" id="btn-cancel-config">Annuler</button>
      </div>
    </div>
  </div>
`;
renderShell(profile, 'stocks_essence', html);

let stations = [];
let config = await getConfig().catch(() => ({}));

listenStations(s => { stations = s; renderStations(); });

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
              <span>Prix : ${money(s.prixLitre || 0)}/L</span>
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

if (editable) {
  document.getElementById('btn-ajouter-station').addEventListener('click', () => {
    document.getElementById('st-id').value = '';
    document.getElementById('st-nom').value = '';
    document.getElementById('st-stock-actuel').value = 0;
    document.getElementById('st-stock-max').value = 30000;
    document.getElementById('st-seuil').value = config.seuilAlerteEssence || 1000;
    document.getElementById('st-prix').value = config.prixEssence || 5;
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
  document.getElementById('st-nom').value = s.nom || '';
  document.getElementById('st-stock-actuel').value = s.stockActuel || 0;
  document.getElementById('st-stock-max').value = s.stockMax || 0;
  document.getElementById('st-seuil').value = s.seuilAlerte || 0;
  document.getElementById('st-prix').value = s.prixLitre || 0;
  document.getElementById('modal-station-title').textContent = s.nom;
  const delBtn = document.getElementById('btn-delete-station');
  if (delBtn) delBtn.style.display = 'inline-block';
  modal.classList.remove('hidden');
}

document.getElementById('btn-cancel-station').addEventListener('click', () => modal.classList.add('hidden'));

document.getElementById('btn-save-station').addEventListener('click', async () => {
  const id = document.getElementById('st-id').value || ('station_' + Date.now());
  const data = {
    nom: document.getElementById('st-nom').value.trim(),
    stockActuel: Number(document.getElementById('st-stock-actuel').value) || 0,
    stockMax: Number(document.getElementById('st-stock-max').value) || 0,
    seuilAlerte: Number(document.getElementById('st-seuil').value) || 0,
    prixLitre: Number(document.getElementById('st-prix').value) || 0
  };
  if (!data.nom) return toastError("Nom obligatoire.");
  try {
    await setStation(id, data);
    toastSuccess("Station enregistrée.");
    modal.classList.add('hidden');
  } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); console.error(e); }
});

const btnDel = document.getElementById('btn-delete-station');
if (btnDel) {
  btnDel.addEventListener('click', async () => {
    const id = document.getElementById('st-id').value;
    if (!id) return;
    if (!confirm("Supprimer cette station ?")) return;
    try {
      await deleteDoc(doc(db, 'stations', id));
      toastSuccess("Station supprimée.");
      modal.classList.add('hidden');
    } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); }
  });
}

// === Modal config ===
document.getElementById('btn-config-essence').addEventListener('click', () => {
  document.getElementById('cfg-quota-bidons').value = config.quotaBidons ?? 1700;
  document.getElementById('cfg-quota-caoutchoucs').value = config.quotaCaoutchoucs ?? 800;
  document.getElementById('cfg-prix-essence').value = config.prixEssence ?? 5;
  document.getElementById('cfg-seuil-essence').value = config.seuilAlerteEssence ?? 1000;
  document.getElementById('modal-config').classList.remove('hidden');
});
document.getElementById('btn-cancel-config').addEventListener('click', () => {
  document.getElementById('modal-config').classList.add('hidden');
});
document.getElementById('btn-save-config').addEventListener('click', async () => {
  if (!isDirection(profile.role)) return toastError("Direction uniquement.");
  const patch = {
    quotaBidons: Number(document.getElementById('cfg-quota-bidons').value) || 1700,
    quotaCaoutchoucs: Number(document.getElementById('cfg-quota-caoutchoucs').value) || 800,
    prixEssence: Number(document.getElementById('cfg-prix-essence').value) || 5,
    seuilAlerteEssence: Number(document.getElementById('cfg-seuil-essence').value) || 1000
  };
  try {
    await setConfig(patch);
    config = { ...config, ...patch };
    toastSuccess("Configuration enregistrée.");
    document.getElementById('modal-config').classList.add('hidden');
    miseAJourKpis(stations);
  } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); }
});

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
    <table class="data">
      <thead><tr>
        <th>Date</th><th>Station</th>
        <th class="right">Litres</th><th class="right">Prix/L</th><th class="right">Montant</th>
        <th class="right">Stock après</th>
      </tr></thead>
      <tbody>
        ${list.map(r => `
          <tr>
            <td>${datetime(r.timestamp)}</td>
            <td>${escapeHtml(r.station || r.stationId || '—')}</td>
            <td class="right mono">${num(r.litres)}</td>
            <td class="right mono">${money(r.prixLitre)}</td>
            <td class="right mono">${money(r.montant)}</td>
            <td class="right mono">${num(r.stockApres)} L</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}
chargerRedistributions();
