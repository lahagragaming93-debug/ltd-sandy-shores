// ============================================================
// Page : Administration (Patron / Co-Patron uniquement)
// ============================================================

import { requireAuth, creerCompteEmploye, genererMotDePasseProvisoire } from '../auth.js';
import { renderShell } from '../layout.js';
import { listenUsers, updateUser, deleteUser, getConfig, setConfig } from '../api.js';
import { ROLE_LABELS, ROLES } from '../utils/permissions.js';
import { date, escapeHtml } from '../utils/formatters.js';
import { toastSuccess, toastError } from '../utils/toast.js';

const { profile } = await requireAuth('admin');

const html = `
  <div class="row mb-2">
    <button class="btn btn-primary" id="btn-nouveau">+ Créer un compte</button>
    <button class="btn" id="btn-config-globale">⚙ Configuration globale</button>
  </div>

  <div class="panel framed">
    <div class="panel-title"><span>Comptes utilisateurs</span></div>
    <table class="data" id="table-users">
      <thead>
        <tr>
          <th>Nom</th><th>Email</th><th>Rôle</th>
          <th>ID Discord</th><th>ID Perso</th><th>Entrée</th>
          <th>Statut</th><th class="center">Actions</th>
        </tr>
      </thead>
      <tbody id="tbody-users"><tr><td colspan="8" class="muted text-center">Chargement…</td></tr></tbody>
    </table>
  </div>

  <!-- Modal création compte -->
  <div id="modal-new" class="modal-backdrop hidden">
    <div class="modal" style="max-width:520px;">
      <h3>Créer un compte</h3>
      <div class="field-row">
        <div><label>Prénom RP</label><input type="text" id="new-prenom" required /></div>
        <div><label>NOM RP</label><input type="text" id="new-nom" required style="text-transform:uppercase;" /></div>
      </div>
      <label>Email</label>
      <input type="email" id="new-email" required />
      <div class="field-row">
        <div><label>ID Discord</label><input type="text" id="new-id-discord" /></div>
        <div><label>ID Perso (in-game)</label><input type="text" id="new-id-perso" /></div>
      </div>
      <label>Rôle</label>
      <select id="new-role">
        ${Object.entries(ROLE_LABELS).map(([k,l]) => `<option value="${k}">${l}</option>`).join('')}
      </select>
      <label>Mot de passe provisoire</label>
      <div class="row">
        <input type="text" id="new-mdp" style="flex:1;" />
        <button class="btn btn-sm" id="btn-gen-mdp" type="button">Générer</button>
      </div>
      <div class="row mt-3">
        <button class="btn btn-primary" id="btn-creer">Créer</button>
        <button class="btn btn-ghost" id="btn-cancel-new">Annuler</button>
      </div>
      <div class="alert info mt-3 hidden" id="alert-credentials">
        <span class="icon">ℹ</span>
        <div>
          Compte créé. <strong>Transmettre à l'employé :</strong>
          <div class="mono mt-1">Email: <span id="cred-email"></span></div>
          <div class="mono">Mot de passe: <span id="cred-mdp"></span></div>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal config globale -->
  <div id="modal-config" class="modal-backdrop hidden">
    <div class="modal" style="max-width: 580px;">
      <h3>Configuration globale</h3>
      <div class="field-row">
        <div><label>Quota bidons / pompiste / sem</label><input type="number" id="cfg-bidons" /></div>
        <div><label>Quota caoutchoucs / pompiste / sem</label><input type="number" id="cfg-caoutchoucs" /></div>
      </div>
      <div class="field-row">
        <div><label>Prix essence par défaut ($/L)</label><input type="number" id="cfg-prix" step="0.1" /></div>
        <div><label>Seuil alerte essence (L)</label><input type="number" id="cfg-seuil" /></div>
      </div>
      <label>Webhook Discord pour alertes (optionnel)</label>
      <input type="url" id="cfg-webhook" placeholder="https://discord.com/api/webhooks/..." />
      <p class="muted" style="font-size:0.75rem;margin-top:4px;">
        Crée un webhook Discord (paramètres canal → Intégrations → Webhooks) et colle l'URL ici.
        Toutes les alertes (rupture stock, masse > 90 %, etc.) seront postées dans ce canal.
      </p>
      <div class="row mt-3">
        <button class="btn btn-primary" id="btn-save-cfg">Enregistrer</button>
        <button class="btn btn-ghost" id="btn-cancel-cfg">Annuler</button>
      </div>
    </div>
  </div>
`;
renderShell(profile, 'admin', html);

let users = [];
listenUsers(list => {
  users = list;
  renderUsers();
});

function renderUsers() {
  const tbody = document.getElementById('tbody-users');
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted text-center">Aucun compte.</td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr>
      <td><strong>${escapeHtml(u.prenom)} ${escapeHtml(u.nom)}</strong></td>
      <td class="mono">${escapeHtml(u.email || '—')}</td>
      <td>
        <select data-role="${u.id}" data-old-role="${u.role}">
          ${Object.entries(ROLE_LABELS).map(([k,l]) =>
            `<option value="${k}" ${u.role === k ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </td>
      <td class="mono">${escapeHtml(u.idDiscord || '—')}</td>
      <td class="mono">${escapeHtml(u.idPerso || '—')}</td>
      <td>${u.dateEntree || '—'}</td>
      <td>
        <span class="badge ${u.statut === 'actif' ? 'ok' : 'warn'}">${u.statut || 'actif'}</span>
      </td>
      <td class="center">
        ${u.statut !== 'suspendu'
          ? `<button class="btn btn-sm" data-suspend="${u.id}">Suspendre</button>`
          : `<button class="btn btn-sm" data-reactiver="${u.id}">Réactiver</button>`}
        <button class="btn btn-sm btn-danger" data-delete="${u.id}" ${u.id === profile.id ? 'disabled' : ''}>×</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('[data-role]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const uid = sel.dataset.role;
      const ancien = sel.dataset.oldRole;
      const nouveau = sel.value;
      const direction = (r) => r === 'patron' || r === 'co-patron';
      // Confirmation pour tout changement impliquant Patron/Co-Patron
      if (direction(ancien) || direction(nouveau)) {
        const sens = direction(nouveau) && !direction(ancien) ? 'PROMOTION direction'
                   : direction(ancien) && !direction(nouveau) ? 'rétrogradation depuis direction'
                   : 'changement entre rôles direction';
        if (!confirm(`${sens} : ${ancien} → ${nouveau}\n\nCe changement modifie les droits d'accès complets de cet utilisateur. Confirmer ?`)) {
          sel.value = ancien;
          return;
        }
      }
      try {
        await updateUser(uid, { role: nouveau });
        sel.dataset.oldRole = nouveau;
        toastSuccess("Rôle mis à jour.");
      } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); console.error(e); }
    });
  });
  tbody.querySelectorAll('[data-suspend]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm("Suspendre ce compte (équivalent licenciement) ?")) return;
      try {
        await updateUser(btn.dataset.suspend, { statut: 'suspendu' });
        toastSuccess("Compte suspendu.");
      } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); }
    });
  });
  tbody.querySelectorAll('[data-reactiver]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await updateUser(btn.dataset.reactiver, { statut: 'actif' });
        toastSuccess("Compte réactivé.");
      } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); }
    });
  });
  tbody.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm("Supprimer DÉFINITIVEMENT ce compte ?\n(Le compte Firebase Auth doit être supprimé séparément depuis la console.)")) return;
      try {
        await deleteUser(btn.dataset.delete);
        toastSuccess("Compte supprimé. Pense à supprimer l'utilisateur depuis Firebase Auth.");
      } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); }
    });
  });
}

// === Création de compte ===
document.getElementById('btn-nouveau').addEventListener('click', () => {
  ['new-prenom','new-nom','new-email','new-id-discord','new-id-perso','new-mdp'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('new-role').value = 'vendeur-novice';
  document.getElementById('new-mdp').value = genererMotDePasseProvisoire();
  document.getElementById('alert-credentials').classList.add('hidden');
  document.getElementById('modal-new').classList.remove('hidden');
});
document.getElementById('btn-cancel-new').addEventListener('click', () => {
  document.getElementById('modal-new').classList.add('hidden');
});
document.getElementById('btn-gen-mdp').addEventListener('click', () => {
  document.getElementById('new-mdp').value = genererMotDePasseProvisoire();
});

document.getElementById('btn-creer').addEventListener('click', async () => {
  const data = {
    prenom: document.getElementById('new-prenom').value.trim(),
    nom: document.getElementById('new-nom').value.trim(),
    email: document.getElementById('new-email').value.trim(),
    idDiscord: document.getElementById('new-id-discord').value.trim(),
    idPerso: document.getElementById('new-id-perso').value.trim(),
    role: document.getElementById('new-role').value,
    motDePasse: document.getElementById('new-mdp').value,
    creePar: profile.prenom + ' ' + profile.nom
  };
  if (!data.prenom || !data.nom || !data.email || !data.motDePasse) {
    return toastError("Champs prénom, nom, email et mot de passe obligatoires.");
  }
  if (data.role === ROLES.PATRON || data.role === ROLES.CO_PATRON) {
    if (!confirm(`Créer un compte ${data.role.toUpperCase()} ?\n\nCe compte aura TOUS les droits sur la plateforme (admin, comptabilité, suppression de comptes, configuration globale).\n\nCe choix est irréversible sans intervention technique.`)) {
      return;
    }
  }
  if (data.motDePasse.length < 8) return toastError("Mot de passe ≥ 8 caractères.");
  try {
    await creerCompteEmploye(data);
    toastSuccess("Compte créé.");
    document.getElementById('cred-email').textContent = data.email;
    document.getElementById('cred-mdp').textContent = data.motDePasse;
    document.getElementById('alert-credentials').classList.remove('hidden');
  } catch (err) {
    console.error(err);
    toastError(err.message || "Erreur lors de la création.");
  }
});

// === Configuration globale ===
document.getElementById('btn-config-globale').addEventListener('click', async () => {
  const c = await getConfig().catch(() => ({}));
  document.getElementById('cfg-bidons').value = c.quotaBidons ?? 1700;
  document.getElementById('cfg-caoutchoucs').value = c.quotaCaoutchoucs ?? 800;
  document.getElementById('cfg-prix').value = c.prixEssence ?? 5;
  document.getElementById('cfg-seuil').value = c.seuilAlerteEssence ?? 1000;
  document.getElementById('cfg-webhook').value = c.discordWebhookAlertes ?? '';
  document.getElementById('modal-config').classList.remove('hidden');
});
document.getElementById('btn-cancel-cfg').addEventListener('click', () => {
  document.getElementById('modal-config').classList.add('hidden');
});
document.getElementById('btn-save-cfg').addEventListener('click', async () => {
  const quotaBidons = Number(document.getElementById('cfg-bidons').value);
  const quotaCaoutchoucs = Number(document.getElementById('cfg-caoutchoucs').value);
  const prixEssence = Number(document.getElementById('cfg-prix').value);
  const seuilAlerteEssence = Number(document.getElementById('cfg-seuil').value);

  // Validation : tous strictement positifs (sinon division par zéro dans calcul paie)
  if (!Number.isFinite(quotaBidons)      || quotaBidons <= 0)      return toastError("Quota bidons doit être > 0.");
  if (!Number.isFinite(quotaCaoutchoucs) || quotaCaoutchoucs <= 0) return toastError("Quota caoutchoucs doit être > 0.");
  if (!Number.isFinite(prixEssence)      || prixEssence < 0)       return toastError("Prix essence doit être ≥ 0.");
  if (!Number.isFinite(seuilAlerteEssence)|| seuilAlerteEssence < 0) return toastError("Seuil doit être ≥ 0.");

  const discordWebhookAlertes = document.getElementById('cfg-webhook').value.trim();
  if (discordWebhookAlertes && !/^https:\/\/discord\.com\/api\/webhooks\//.test(discordWebhookAlertes)) {
    return toastError("URL webhook invalide (doit commencer par https://discord.com/api/webhooks/).");
  }

  try {
    await setConfig({ quotaBidons, quotaCaoutchoucs, prixEssence, seuilAlerteEssence, discordWebhookAlertes });
    toastSuccess("Configuration enregistrée.");
    document.getElementById('modal-config').classList.add('hidden');
  } catch (e) { toastError(e.message || "Erreur."); console.error(e); }
});
