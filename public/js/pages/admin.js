// ============================================================
// Page : Administration (Direction, DRH, Responsables)
// Le périmètre des actions est filtré par canManageUser().
// ============================================================

import { requireAuth, creerCompteEmploye, genererMotDePasseProvisoire } from '../auth.js';
import { renderShell } from '../layout.js';
import { listenUsers, updateUser, deleteUser, getConfig, setConfig, getSecrets, setSecrets } from '../api.js';
import { ROLE_LABELS, ROLES, canManageUser, assignableRoles, canEditConfig, isDirection, isSuperAdmin } from '../utils/permissions.js';
import { date, escapeHtml } from '../utils/formatters.js';
import { toastSuccess, toastError } from '../utils/toast.js';
import { confirmCritique } from '../utils/confirmation.js';

const { profile } = await requireAuth('admin');
const myAssignableRoles = assignableRoles(profile.role);
const canCreate         = myAssignableRoles.length > 0;
const canEditCfg        = canEditConfig(profile.role);

// Périmètre lisible affiché à l'utilisateur
function perimetreText(role) {
  if (role === 'patron')                return 'Tu peux gérer TOUS les comptes.';
  if (role === 'co-patron')             return 'Tu peux gérer tous les comptes sauf le Patron.';
  if (role === 'drh')                   return 'Tu peux gérer tous les comptes sauf le Patron et le Co-Patron.';
  if (role === 'responsable-vente')     return 'Tu peux gérer uniquement les vendeurs (Novice / Intermédiaire / Expérimenté).';
  if (role === 'responsable-pompiste')  return 'Tu peux gérer uniquement les pompistes (Novice / Intermédiaire / Expérimenté).';
  return 'Aucun périmètre de gestion.';
}

const html = `
  <div class="alert info mb-2">
    <span class="icon">ℹ</span>
    <span>${perimetreText(profile.role)} Les comptes hors de ton périmètre sont visibles en lecture seule (actions grisées).</span>
  </div>

  <div class="row mb-2" style="flex-wrap:wrap;gap:8px;">
    ${canCreate ? `<button class="btn btn-primary" id="btn-nouveau">+ Créer un compte</button>` : ''}
    ${canEditCfg ? `<button class="btn" id="btn-config-globale">⚙ Configuration globale</button>` : ''}
    ${canEditCfg ? `<button class="btn" id="btn-export-sheets">📊 Export Google Sheets</button>` : ''}
    ${canEditCfg ? `<a href="decouverte-items.html" class="btn">🔍 Découverte items FiveM</a>` : ''}
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
        ${myAssignableRoles.map(k => `<option value="${k}">${ROLE_LABELS[k]}</option>`).join('')}
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

  <!-- Modal édition compte -->
  <div id="modal-edit" class="modal-backdrop hidden">
    <div class="modal" style="max-width:520px;">
      <h3>Modifier le compte</h3>
      <input type="hidden" id="edit-uid" />
      <p class="muted mono" style="font-size:0.75rem;">Email : <span id="edit-email-readonly">—</span> <em>(non modifiable ici)</em></p>
      <div class="field-row">
        <div><label>Prénom RP</label><input type="text" id="edit-prenom" /></div>
        <div><label>NOM RP</label><input type="text" id="edit-nom" style="text-transform:uppercase;" /></div>
      </div>
      <div class="field-row">
        <div><label>ID Discord</label><input type="text" id="edit-id-discord" /></div>
        <div><label>ID Perso (in-game)</label><input type="text" id="edit-id-perso" /></div>
      </div>
      <label>Date d'entrée</label>
      <input type="date" id="edit-date-entree" />
      <div class="row mt-3">
        <button class="btn btn-primary" id="btn-save-edit">Enregistrer</button>
        <button class="btn btn-ghost" id="btn-cancel-edit">Annuler</button>
      </div>
    </div>
  </div>

  <!-- Modal export Google Sheets -->
  <div id="modal-sheets" class="modal-backdrop hidden">
    <div class="modal" style="max-width: 720px;">
      <h3>📊 Export Google Sheets — Comptabilité temps réel</h3>

      <div class="alert info mb-2" style="font-size:0.85rem;">
        <span class="icon">ℹ</span>
        <div>
          La fonction <code>comptaExport</code> sert un CSV temps réel. Tu colles une formule <code>=IMPORTDATA(URL)</code> dans Google Sheets, et le Sheet se met à jour tout seul.<br><br>
          <strong>Le Sheet est en lecture seule</strong> — la modification reste sur le site (autorité de référence).
        </div>
      </div>

      <div id="sheets-token-zone">
        <p class="muted">Chargement…</p>
      </div>

      <div class="row mt-3">
        <button class="btn btn-ghost" id="btn-cancel-sheets">Fermer</button>
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
  // Patron et Admin Technique peuvent éditer leur propre compte (changer leur rôle).
  // Les autres rôles ne peuvent pas se gérer eux-mêmes (évite l'auto-élévation).
  const canManageSelf = profile.role === 'patron' || isSuperAdmin(profile.role);

  tbody.innerHTML = users.map(u => {
    const isSelf       = u.id === profile.id;
    const canManage    = canManageUser(profile.role, u.role) && (!isSelf || canManageSelf);
    // Liste des rôles assignables : intersect avec ce que je peux gérer
    const roleOptions  = myAssignableRoles
      .map(k => `<option value="${k}" ${u.role === k ? 'selected' : ''}>${ROLE_LABELS[k]}</option>`)
      .join('');
    // Si le rôle actuel n'est pas dans mes assignables, l'ajouter en option désactivée
    const currentRoleHtml = !myAssignableRoles.includes(u.role)
      ? `<option value="${u.role}" selected disabled>${ROLE_LABELS[u.role] || u.role} (hors périmètre)</option>`
      : '';
    const roleSelectAttr = canManage ? '' : 'disabled';
    const tooltipHors    = canManage ? '' : 'title="Hors de ton périmètre de gestion"';

    return `
    <tr ${canManage ? '' : 'class="row-readonly"'}>
      <td><strong>${escapeHtml(u.prenom)} ${escapeHtml(u.nom)}</strong></td>
      <td class="mono">${escapeHtml(u.email || '—')}</td>
      <td>
        <select data-role="${u.id}" data-old-role="${u.role}" ${roleSelectAttr} ${tooltipHors}>
          ${currentRoleHtml}${roleOptions}
        </select>
      </td>
      <td class="mono">${escapeHtml(u.idDiscord || '—')}</td>
      <td class="mono">${escapeHtml(u.idPerso || '—')}</td>
      <td>${u.dateEntree || '—'}</td>
      <td>
        <span class="badge ${u.statut === 'actif' ? 'ok' : 'warn'}">${u.statut || 'actif'}</span>
      </td>
      <td class="center">
        <button class="btn btn-sm btn-ghost" data-edit-user="${u.id}" ${canManage ? '' : 'disabled'} ${tooltipHors}>Modifier</button>
        ${u.statut !== 'suspendu'
          ? `<button class="btn btn-sm" data-suspend="${u.id}" ${(canManage && !isSelf) ? '' : 'disabled'} ${isSelf ? 'title="Tu ne peux pas te suspendre toi-même"' : tooltipHors}>Suspendre</button>`
          : `<button class="btn btn-sm" data-reactiver="${u.id}" ${canManage ? '' : 'disabled'} ${tooltipHors}>Réactiver</button>`}
        <button class="btn btn-sm btn-danger" data-delete="${u.id}" ${(canManage && !isSelf) ? '' : 'disabled'} ${isSelf ? 'title="Tu ne peux pas te supprimer toi-même"' : tooltipHors}>×</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-role]').forEach(sel => {
    sel.addEventListener('change', async () => {
      const uid = sel.dataset.role;
      const ancien = sel.dataset.oldRole;
      const nouveau = sel.value;
      // Garde-fou : si quelqu'un bidouille le DOM, refuser un rôle hors périmètre
      if (!canManageUser(profile.role, ancien) || !canManageUser(profile.role, nouveau)) {
        sel.value = ancien;
        toastError("Ce changement de rôle est hors de ton périmètre.");
        return;
      }
      const direction = (r) => r === 'patron' || r === 'co-patron';
      // Confirmation pour tout changement impliquant Patron/Co-Patron
      if (direction(ancien) || direction(nouveau)) {
        const sens = direction(nouveau) && !direction(ancien) ? 'PROMOTION direction'
                   : direction(ancien) && !direction(nouveau) ? 'rétrogradation depuis direction'
                   : 'changement entre rôles direction';
        const ok = await confirmCritique({
          titre: 'Changement de rôle direction',
          message: `<strong>${sens}</strong><br><br>
            Ancien rôle : <strong>${escapeHtml(ROLE_LABELS[ancien] || ancien)}</strong><br>
            Nouveau rôle : <strong>${escapeHtml(ROLE_LABELS[nouveau] || nouveau)}</strong><br><br>
            Ce changement modifie les <strong>droits d'accès complets</strong> de cet utilisateur (admin, comptabilité, configuration globale, suppression de comptes).`,
          btnConfirm: 'Appliquer le changement',
          delaiSec: 3
        });
        if (!ok) {
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
      const ok = await confirmCritique({
        titre: 'Suspendre le compte',
        message: 'La suspension d\'un compte équivaut à un <strong>licenciement</strong>.<br><br>L\'employé perdra immédiatement l\'accès au site (déconnexion forcée à sa prochaine action). Le compte reste consultable et peut être réactivé.',
        btnConfirm: 'Suspendre le compte',
        delaiSec: 3
      });
      if (!ok) return;
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
      const ok = await confirmCritique({
        titre: 'Supprimer définitivement',
        message: 'Cette action <strong>supprime définitivement</strong> le compte de l\'utilisateur du site.<br><br>⚠ Le compte Firebase Auth (login/email) doit être supprimé <strong>séparément</strong> depuis la console Firebase pour libérer l\'email.<br><br>Les données déjà enregistrées (ventes, paies, services) ne sont PAS supprimées (audit TTE).',
        btnConfirm: 'Supprimer le compte',
        delaiSec: 3,
        requireType: 'SUPPRIMER'
      });
      if (!ok) return;
      try {
        await deleteUser(btn.dataset.delete);
        toastSuccess("Compte supprimé. Pense à supprimer l'utilisateur depuis Firebase Auth.");
      } catch (e) { toastError(e?.message || e?.code || "Erreur inattendue."); }
    });
  });

  tbody.querySelectorAll('[data-edit-user]').forEach(btn => {
    btn.addEventListener('click', () => ouvrirEdition(btn.dataset.editUser));
  });
}

// === Édition d'un compte ===
function ouvrirEdition(uid) {
  const u = users.find(x => x.id === uid);
  if (!u) return;
  document.getElementById('edit-uid').value = uid;
  document.getElementById('edit-email-readonly').textContent = u.email || '—';
  document.getElementById('edit-prenom').value = u.prenom || '';
  document.getElementById('edit-nom').value = u.nom || '';
  document.getElementById('edit-id-discord').value = u.idDiscord || '';
  document.getElementById('edit-id-perso').value = u.idPerso || '';
  document.getElementById('edit-date-entree').value = u.dateEntree || '';
  document.getElementById('modal-edit').classList.remove('hidden');
}

document.getElementById('btn-cancel-edit').addEventListener('click', () => {
  document.getElementById('modal-edit').classList.add('hidden');
});

document.getElementById('btn-save-edit').addEventListener('click', async () => {
  const uid = document.getElementById('edit-uid').value;
  const patch = {
    prenom:    document.getElementById('edit-prenom').value.trim(),
    nom:       document.getElementById('edit-nom').value.trim().toUpperCase(),
    idDiscord: document.getElementById('edit-id-discord').value.trim(),
    idPerso:   document.getElementById('edit-id-perso').value.trim(),
    dateEntree:document.getElementById('edit-date-entree').value || null
  };
  if (!patch.prenom || !patch.nom) return toastError("Prénom et NOM obligatoires.");
  try {
    await updateUser(uid, patch);
    toastSuccess("Compte modifié.");
    document.getElementById('modal-edit').classList.add('hidden');
  } catch (e) { toastError(e?.message || e?.code || "Erreur."); console.error(e); }
});

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
  // Garde-fou : refuser la création d'un rôle hors périmètre
  if (!canManageUser(profile.role, data.role)) {
    return toastError("Ce rôle est hors de ton périmètre de création.");
  }
  if (data.role === ROLES.PATRON || data.role === ROLES.CO_PATRON) {
    const ok = await confirmCritique({
      titre: `Créer un compte ${ROLE_LABELS[data.role]}`,
      message: `Tu vas créer un compte avec le rôle <strong>${escapeHtml(ROLE_LABELS[data.role])}</strong>.<br><br>
        Ce compte aura <strong>TOUS les droits</strong> sur la plateforme :
        <ul style="margin:8px 0 8px 20px;">
          <li>Administration (créer, modifier, supprimer des comptes)</li>
          <li>Comptabilité (ajout de dépenses, conformité TTE)</li>
          <li>Configuration globale (quotas, prix essence, webhook)</li>
          <li>Suppression d'autres comptes direction</li>
        </ul>
        Ce choix est <strong>irréversible</strong> sans intervention technique.`,
      btnConfirm: 'Créer ce compte direction',
      delaiSec: 3
    });
    if (!ok) return;
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

// === Export Google Sheets (modale dédiée, direction uniquement) ===
const COMPTA_EXPORT_URL = 'https://europe-west1-ltd-sandy-shores-f3919.cloudfunctions.net/comptaExport';

const btnExportSheets = document.getElementById('btn-export-sheets');
if (btnExportSheets) {
  btnExportSheets.addEventListener('click', async () => {
    const zone = document.getElementById('sheets-token-zone');
    zone.innerHTML = '<p class="muted">Lecture du token…</p>';
    document.getElementById('modal-sheets').classList.remove('hidden');

    let secrets = {};
    try { secrets = await getSecrets(); }
    catch (e) {
      console.error(e);
      zone.innerHTML = `<div class="alert danger">Impossible de lire les secrets : ${escapeHtml(e.message || e.code)}</div>`;
      return;
    }
    renderSheetsZone(zone, secrets.comptaExportToken || null);
  });
}

function renderSheetsZone(zone, token) {
  if (!token) {
    zone.innerHTML = `
      <div class="alert warn mb-2">
        <span class="icon">⚠</span>
        <span>Aucun token configuré. Colle ci-dessous le token généré côté serveur (donné par la direction technique).</span>
      </div>
      <label>Token <code>LTD_COMPTA_EXPORT_TOKEN</code></label>
      <input type="text" id="sheets-token-input" placeholder="64 caractères hexadécimaux" style="font-family:monospace;" />
      <div class="row mt-2">
        <button class="btn btn-primary" id="btn-save-sheets-token">Sauvegarder le token</button>
      </div>
    `;
    document.getElementById('btn-save-sheets-token').addEventListener('click', async () => {
      const v = document.getElementById('sheets-token-input').value.trim();
      if (!/^[a-f0-9]{32,128}$/i.test(v)) return toastError("Token invalide (doit être hex, 32-128 chars).");
      try {
        await setSecrets({ comptaExportToken: v });
        toastSuccess("Token enregistré.");
        renderSheetsZone(zone, v);
      } catch (e) { toastError(e.message || "Erreur."); console.error(e); }
    });
    return;
  }

  // Token présent : afficher les 4 formules à coller dans Google Sheets
  const masque = token.slice(0, 6) + '…' + token.slice(-4);
  const types = [
    { type: 'resume',   label: '📊 Résumé hebdo',     hint: '1 ligne par semaine clôturée (52 max)' },
    { type: 'depenses', label: '💸 Dépenses',          hint: 'Toutes les dépenses (2 000 max)' },
    { type: 'ventes',   label: '💵 Ventes',            hint: 'Toutes les ventes (2 000 max)' },
    { type: 'paies',    label: '💰 Paies',             hint: 'Toutes les paies versées (2 000 max)' }
  ];

  zone.innerHTML = `
    <div class="alert ok mb-2"><span class="icon">✓</span><span>Token configuré (<code>${masque}</code>)</span></div>

    <h4 style="margin-top:12px;">Setup Google Sheets — pas à pas</h4>
    <ol style="font-size:0.88rem;line-height:1.55;">
      <li>Crée un Google Sheet vierge sur <a href="https://sheets.new" target="_blank">sheets.new</a> (s'ouvre dans un nouvel onglet ⚠ depuis tablette FiveM préférable depuis ordi)</li>
      <li>Crée 4 onglets : <code>Résumé</code>, <code>Dépenses</code>, <code>Ventes</code>, <code>Paies</code></li>
      <li>Dans la cellule <code>A1</code> de chaque onglet, colle la formule correspondante ci-dessous</li>
      <li>Sheets remplit automatiquement — refresh ~1h (Google force, pas modifiable)</li>
      <li>Partage le Sheet avec qui tu veux (staff serveur, etc.) en lecture seule</li>
    </ol>

    <div class="alert warn mb-2" style="font-size:0.78rem;">
      <span class="icon">⚠</span>
      <span><strong>Sécurité</strong> : ne diffuse pas le token. Le Sheet final (lecture seule) peut être partagé sans risque, mais quiconque a le token peut télécharger toutes les données compta. Garde-le confidentiel comme un mot de passe.</span>
    </div>

    <h4>Formules à copier-coller</h4>
    ${types.map(t => `
      <div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <strong>${t.label}</strong>
          <span class="muted" style="font-size:0.75rem;">${t.hint}</span>
        </div>
        <div style="display:flex;gap:6px;align-items:stretch;">
          <input type="text" readonly value='=IMPORTDATA("${COMPTA_EXPORT_URL}?type=${t.type}&token=${token}")'
                 class="mono sheets-formula" style="flex:1;font-size:0.78rem;" />
          <button class="btn btn-sm" data-copy="${t.type}">Copier</button>
        </div>
      </div>
    `).join('')}

    <details style="margin-top:14px;">
      <summary style="cursor:pointer;font-family:var(--font-heading);font-size:0.85rem;">🔄 Régénérer le token (en cas de fuite)</summary>
      <div class="alert info mt-2" style="font-size:0.78rem;">
        <span class="icon">ℹ</span>
        <div>
          La régénération passe par Firebase CLI (côté serveur, pas depuis l'app). Procédure :
          <ol style="margin:6px 0 0 18px;padding:0;">
            <li><code>node -e "require('fs').writeFileSync('t.tmp', require('crypto').randomBytes(32).toString('hex'),'utf8')"</code></li>
            <li><code>firebase functions:secrets:set LTD_COMPTA_EXPORT_TOKEN --data-file t.tmp</code></li>
            <li><code>firebase deploy --only functions:comptaExport</code></li>
            <li>Lis le contenu de <code>t.tmp</code>, copie-le ici dans le champ ci-dessus, supprime le fichier</li>
          </ol>
          Toutes les anciennes formules dans Google Sheets cesseront de fonctionner — il faudra les mettre à jour.
        </div>
      </div>
    </details>
  `;

  // Boutons "Copier"
  zone.querySelectorAll('[data-copy]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const formula = btn.previousElementSibling.value;
      try {
        await navigator.clipboard.writeText(formula);
        toastSuccess("Formule copiée dans le presse-papiers.");
      } catch (e) {
        // Fallback : sélection manuelle
        btn.previousElementSibling.select();
        toastError("Copie auto refusée (vieux navigateur). Sélection faite — fais Ctrl+C.");
      }
    });
  });
}

document.getElementById('btn-cancel-sheets').addEventListener('click', () => {
  document.getElementById('modal-sheets').classList.add('hidden');
});
