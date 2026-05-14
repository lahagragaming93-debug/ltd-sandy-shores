// ============================================================
// Page : Mon espace (Dashboard employé) — lecture seule
// ============================================================

import { requireAuth, getCurrentUser } from '../auth.js';
import { renderShell } from '../layout.js';
import {
  listVentesSemaine, listVentesSemaineIncluantCachees, listServicesSemaine, listAllServicesEmploye,
  getQuotaPompiste, getConfig, listenAvertissements, getUserDoc
} from '../api.js';
import { ROLE_LABELS, isVendeur, isPompiste, isDirection, isSuperAdmin, PLAFOND_SALAIRE,
         CA_PLAFOND_VENDEUR, COMMISSION_VENDEUR } from '../utils/permissions.js';
import { salaireVendeur, salairePompiste, scorePompiste } from '../utils/paie.js';
import { money, num, pct, datetime, escapeHtml,
         startOfWeekRP, endOfWeekRP, weekId, durationHM } from '../utils/formatters.js';
import { wrapScroll, makeSortable } from '../utils/sortable-table.js';
import { ouvrirModalNouvelleVente } from '../utils/vente-modal.js';

const { profile: callerProfile } = await requireAuth('employee');

// === Mode "Voir l'espace de X" : direction/DRH/admin-technique peut consulter
// l'espace personnel de n'importe quel employe (lecture seule) via ?asUser=UID
// Pour debugger ou verifier ce qu'un employe voit en cas de probleme.
// On utilise roleReel pour bypass le mode "Voir le site comme..." (preexistant
// qui peut modifier callerProfile.role si l'admin teste un autre role).
const urlParams = new URLSearchParams(location.search);
const asUserId = urlParams.get('asUser');
const callerRoleReel = callerProfile.roleReel || callerProfile.role;
const canVoirComme = (r) => isDirection(r) || isSuperAdmin(r) || r === 'drh';

let profile = callerProfile;
let viewedUserId = getCurrentUser().uid;
let modeVoirComme = false;

if (asUserId && asUserId !== viewedUserId && canVoirComme(callerRoleReel)) {
  try {
    const target = await getUserDoc(asUserId);
    if (target) {
      profile = target;
      viewedUserId = asUserId;
      modeVoirComme = true;
    } else {
      console.warn('[employee] asUser=', asUserId, 'introuvable');
    }
  } catch (e) {
    console.error('[employee] erreur chargement profil cible:', e);
  }
}
const debut = startOfWeekRP();
const fin   = endOfWeekRP();
const wId   = weekId();

const html = `
  ${modeVoirComme ? `
    <div class="alert" style="background:rgba(70,130,200,0.18);border:2px solid #4a90e2;margin-bottom:12px;font-size:0.95rem;">
      🔍 <strong>Mode débug</strong> — Tu consultes l'espace personnel de
      <strong>${escapeHtml(profile.prenom)} ${escapeHtml(profile.nom)}</strong>
      (${ROLE_LABELS[profile.role] || profile.role}).
      Données en temps réel. <strong>Lecture seule</strong> — aucune action n'est possible depuis cette vue.
      <a href="rh.html" style="margin-left:10px;color:var(--color-bone);text-decoration:underline;">← Retour aux RH</a>
    </div>
  ` : ''}

  <div class="panel framed mb-3" style="text-align:center;">
    <h2 style="margin:0;">${modeVoirComme ? '👁 Espace de' : 'Salut'} <span style="color:var(--color-blood-light);">${escapeHtml(profile.prenom)}${modeVoirComme ? ' ' + escapeHtml(profile.nom) : ''}</span>${modeVoirComme ? '' : ' !'}</h2>
    <div class="muted" style="margin-top:6px;">
      ${ROLE_LABELS[profile.role]} · Semaine du ${debut.toLocaleDateString('fr-FR')} au ${fin.toLocaleDateString('fr-FR')}
    </div>
    ${!modeVoirComme ? `
      <div class="row center mt-3" style="gap:10px;justify-content:center;">
        <button class="btn btn-primary" id="btn-declarer-vente" style="font-size:1.05rem;">📝 Déclarer une vente</button>
      </div>
    ` : ''}
  </div>

  <!-- Bloc ventes IG non declarees (vendeurs uniquement) — affiche apres
       5 min sans declaration. La cloche direction reste alimentee. -->
  <div id="bloc-non-declarees"></div>

  <div class="kpi-grid" id="kpis-emp">
    <div class="kpi"><div class="label">Chargement…</div><div class="value">—</div></div>
  </div>

  <div id="bloc-averts"></div>

  <div class="panel framed" id="panel-detail">
    <div class="panel-title"><span>Détail de ta semaine</span></div>
    <div id="detail">Chargement…</div>
  </div>

  <div class="panel">
    <div class="panel-title"><span>Heures de service</span></div>
    <div id="services">—</div>
  </div>

  <p class="muted text-center mt-3" style="font-size:0.78rem;">
    Données mises à jour en continu via les logs Discord.<br>
    Compteurs remis à zéro à la clôture (lundi 00 h 00, juste après dimanche 23 h 59).
  </p>
`;
renderShell(profile, 'employee', html);

const me = getCurrentUser(); // utilisateur connecte (toujours soi-meme, jamais l'employe vise)
const config = await getConfig().catch(() => ({}));

const [allVentes, ventesAvecCachees, allServices, allMyServices, quota] = await Promise.all([
  listVentesSemaine(debut, fin).catch(() => []),
  listVentesSemaineIncluantCachees(debut, fin).catch(() => []),
  listServicesSemaine(debut, fin).catch(() => []),
  listAllServicesEmploye(viewedUserId).catch(() => []),
  // Charge le quota pour TOUS les roles (les non-pompistes peuvent aussi
  // produire des bidons/caoutchoucs en bossant a la station - bonus info).
  getQuotaPompiste(viewedUserId, wId).catch(() => ({ bidons: 0, caoutchoucs: 0 }))
]);

// === Ventes IG (bot Discord) non encore declarees par l'employe ===
// Filtre :
//  - vendeur=moi
//  - source != manuelle (= vente bot in-game)
//  - non cachee
//  - PAS modifiee par admin (modifiePar absent) — sinon admin a deja regularise
//  - age entre 5 min et 24h : on laisse 5 min de battement avant d'alerter
//    (le vendeur peut declarer juste apres la facture in-game sans message)
const il_y_a_24h  = Date.now() - 24 * 3600 * 1000;
const il_y_a_5min = Date.now() - 5 * 60 * 1000;
const nonDeclarees = ventesAvecCachees.filter(v => {
  const ts = v.timestamp?.toMillis?.() || 0;
  return v.vendeurId === viewedUserId &&
         v.source !== 'manuelle' &&
         !v.cachee &&
         !v.modifiePar &&
         ts >= il_y_a_24h &&
         ts <= il_y_a_5min;
}).sort((a, b) => (b.timestamp?.toMillis?.() || 0) - (a.timestamp?.toMillis?.() || 0));

function renderNonDeclarees() {
  const bloc = document.getElementById('bloc-non-declarees');
  if (!isVendeur(profile.role) || nonDeclarees.length === 0) {
    bloc.innerHTML = '';
    return;
  }
  bloc.innerHTML = `
    <div class="panel framed mb-2" style="border-color:var(--color-warning, #f0a020);">
      <div class="panel-title">
        <span>📌 ${nonDeclarees.length} vente${nonDeclarees.length > 1 ? 's' : ''} in-game à déclarer</span>
        <span class="muted" style="font-size:0.78rem;">— moins de 24h</span>
      </div>
      <p class="muted" style="font-size:0.82rem;margin:0 0 8px;">
        Le bot Discord a remonté ${nonDeclarees.length > 1 ? 'ces factures' : 'cette facture'} mais tu n'as pas encore déclaré le détail des produits. <strong>Déclare maintenant</strong> pour que ta commission soit calculée correctement.
      </p>
      <table class="data" style="font-size:0.85rem;">
        <thead><tr>
          <th>Date</th>
          <th>#Facture</th>
          <th>Client</th>
          <th class="right">Montant</th>
          <th>Détail (raison)</th>
          <th class="center">Action</th>
        </tr></thead>
        <tbody>
          ${nonDeclarees.map(v => {
            const dt = v.timestamp?.toDate?.()
              ? v.timestamp.toDate().toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })
              : '?';
            return `
              <tr>
                <td class="mono" style="font-size:0.78rem;">${dt}</td>
                <td class="mono">#${escapeHtml(String(v.factureId || ''))}</td>
                <td>${escapeHtml(v.client || '—')}</td>
                <td class="right mono"><strong>${money(v.montant || 0)}</strong></td>
                <td class="muted" style="font-size:0.78rem;">${escapeHtml((v.raison || '').slice(0, 50))}</td>
                <td class="center">
                  ${modeVoirComme
                    ? '<span class="muted" style="font-size:0.78rem;">— vue admin —</span>'
                    : `<button class="btn btn-primary btn-sm" data-declarer-bot="${v.id}">📝 Déclarer</button>`}
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  bloc.querySelectorAll('[data-declarer-bot]').forEach(btn => {
    btn.addEventListener('click', () => {
      ouvrirModalNouvelleVente({
        role: profile.role,
        factureBotIdPreset: btn.dataset.declarerBot,
        onSuccess: () => window.location.reload()
      });
    });
  });
}
renderNonDeclarees();

const myVentes = allVentes.filter(v => v.vendeurId === viewedUserId);
const myServices = allServices.filter(s => s.employeId === viewedUserId);
const heuresMs = myServices.reduce((s, x) => s + (x.duree || 0), 0);

// Cumul depuis embauche (tous services) + heures aujourd'hui
const cumulMs = allMyServices.reduce((s, x) => s + (x.duree || 0), 0);
const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
const heuresJourMs = allMyServices.reduce((s, x) => {
  const d = x.debut?.toDate?.();
  return d && d >= startOfDay ? s + (x.duree || 0) : s;
}, 0);

const plafondSalaire = PLAFOND_SALAIRE[profile.role] || 0;

if (isVendeur(profile.role)) {
  const ca = myVentes.reduce((s, v) => s + (v.montant || 0), 0);
  const caParticulier = myVentes.reduce((s, v) => s + (v.montantParticulier ?? v.montant ?? 0), 0);
  const caPro = ca - caParticulier;
  const benefice = myVentes.reduce((s, v) => s + (v.benefice || 0), 0);
  const salaireEst = salaireVendeur(profile.role, caParticulier);
  const progressionCA = Math.min(100, (caParticulier / CA_PLAFOND_VENDEUR) * 100);
  const commission = COMMISSION_VENDEUR[profile.role] * 100;
  // Quota CA hebdo : si non atteint a la cloture dimanche 23h59, avert auto.
  const quotaCA = Number(config.quotaCAVendeur ?? 30000);
  const pctQuotaCA = quotaCA > 0 ? Math.min(100, (caParticulier / quotaCA) * 100) : 0;

  document.getElementById('kpis-emp').innerHTML = `
    <div class="kpi"><div class="label">Ton CA</div><div class="value">${money(ca)}</div><div class="delta">${myVentes.length} ventes${caPro > 0 ? ` · ${money(caPro)} hors commission` : ''}</div></div>
    <div class="kpi"><div class="label">CA commissionnable</div><div class="value">${money(caParticulier)}</div><div class="delta">base du salaire</div></div>
    <div class="kpi"><div class="label">Quota CA hebdo</div><div class="value">${pct(pctQuotaCA, 0)}</div><div class="delta ${caParticulier >= quotaCA ? 'up' : 'down'}">${money(caParticulier)} / ${money(quotaCA)}</div></div>
    <div class="kpi"><div class="label">Salaire estimé</div><div class="value">${money(salaireEst)}</div><div class="delta">${commission}% · plafond ${money(plafondSalaire)}</div></div>
  `;

  document.getElementById('detail').innerHTML = `
    <div class="row" style="gap:14px;flex-direction:column;align-items:stretch;">
      <div>
        <div class="muted mono mb-1">Quota CA hebdo (sur CA commissionnable — avert auto si non atteint à la clôture)</div>
        <div class="progress" style="height:24px;">
          <div class="fill" style="width:${pctQuotaCA}%;${caParticulier >= quotaCA ? 'background:var(--color-cactus,#5a8);' : ''}"></div>
          <div class="label">${money(caParticulier)} / ${money(quotaCA)} (${pct(pctQuotaCA, 0)})</div>
        </div>
      </div>
      <div>
        <div class="muted mono mb-1">Progression vers plafond CA (${money(CA_PLAFOND_VENDEUR)} — au-delà, plus de commission)</div>
        <div class="progress" style="height:24px;">
          <div class="fill" style="width:${progressionCA}%"></div>
          <div class="label">${money(caParticulier)} / ${money(CA_PLAFOND_VENDEUR)}</div>
        </div>
      </div>
      <div>
        <div class="muted mono mb-1">Salaire estimé / plafond</div>
        <div class="progress" style="height:24px;">
          <div class="fill" style="width:${plafondSalaire ? (salaireEst/plafondSalaire)*100 : 0}%"></div>
          <div class="label">${money(salaireEst)} / ${money(plafondSalaire)}</div>
        </div>
      </div>
    </div>

    <div class="table-scroll" style="max-height:400px;margin-top:12px;">
      <table class="data" id="table-mes-ventes">
        <thead><tr>
          <th data-sort="date">Date</th>
          <th data-sort="client">Client</th>
          <th class="right" data-sort="montant">Montant</th>
          <th class="right" data-sort="benefice">Bénéfice</th>
        </tr></thead>
        <tbody>
          ${myVentes.length === 0 ? '<tr><td colspan="4" class="muted text-center">Aucune vente cette semaine.</td></tr>' :
            myVentes.map(v => `
              <tr>
                <td>${datetime(v.timestamp)}</td>
                <td>${escapeHtml(v.client || '—')}</td>
                <td class="right mono">${money(v.montant)}</td>
                <td class="right mono">${money(v.benefice || 0)}</td>
              </tr>
            `).join('')}
        </tbody>
      </table>
    </div>
  `;
  if (myVentes.length > 0) makeSortable(document.getElementById('table-mes-ventes'));
} else if (isPompiste(profile.role)) {
  const bidons = quota?.bidons || 0;
  const caoutchoucs = quota?.caoutchoucs || 0;
  const qB = config.quotaBidons || 1700;
  const qC = config.quotaCaoutchoucs || 800;
  const score = scorePompiste(bidons, caoutchoucs, qB, qC);
  const salaireEst = salairePompiste(profile.role, bidons, caoutchoucs, qB, qC);
  const pctB = Math.min(100, (bidons / qB) * 100);
  const pctC = Math.min(100, (caoutchoucs / qC) * 100);

  document.getElementById('kpis-emp').innerHTML = `
    <div class="kpi"><div class="label">Bidons</div><div class="value">${num(bidons)}</div><div class="delta">/ ${num(qB)} (${pct(pctB,0)})</div></div>
    <div class="kpi"><div class="label">Caoutchoucs</div><div class="value">${num(caoutchoucs)}</div><div class="delta">/ ${num(qC)} (${pct(pctC,0)})</div></div>
    <div class="kpi"><div class="label">Score global</div><div class="value">${pct(score,1)}</div><div class="delta">moyenne des 2</div></div>
    <div class="kpi"><div class="label">Salaire estimé</div><div class="value">${money(salaireEst)}</div><div class="delta">/ ${money(plafondSalaire)} max</div></div>
  `;

  document.getElementById('detail').innerHTML = `
    <div style="display:grid;gap:14px;">
      <div>
        <div class="muted mono mb-1">Bidons d'essence ravitaillés</div>
        <div class="progress" style="height:24px;">
          <div class="fill" style="width:${pctB}%"></div>
          <div class="label">${num(bidons)} / ${num(qB)} bidons</div>
        </div>
      </div>
      <div>
        <div class="muted mono mb-1">Caoutchoucs produits</div>
        <div class="progress" style="height:24px;">
          <div class="fill" style="width:${pctC}%"></div>
          <div class="label">${num(caoutchoucs)} / ${num(qC)} unités</div>
        </div>
      </div>
      <div>
        <div class="muted mono mb-1">Salaire estimé / plafond</div>
        <div class="progress" style="height:24px;">
          <div class="fill" style="width:${plafondSalaire ? (salaireEst/plafondSalaire)*100 : 0}%"></div>
          <div class="label">${money(salaireEst)} / ${money(plafondSalaire)}</div>
        </div>
      </div>
    </div>
  `;
} else {
  // Direction / Resp / DRH / Admin Tech : salaire FIXE, mais peuvent aussi
  // vendre / ravitailler. On affiche leurs stats personnelles a titre INFO
  // (sans impact sur leur paye fixe).
  const ca = myVentes.reduce((s, v) => s + (v.montant || 0), 0);
  const benefice = myVentes.reduce((s, v) => s + (v.benefice || 0), 0);
  const bidons = quota?.bidons ?? 0;
  const caoutchoucs = quota?.caoutchoucs ?? 0;
  const aFaitDeLaCo = ca > 0 || bidons > 0 || caoutchoucs > 0;

  document.getElementById('kpis-emp').innerHTML = `
    <div class="kpi"><div class="label">Plafond salaire</div><div class="value">${money(plafondSalaire)}</div><div class="delta">salaire fixe (TTE)</div></div>
    <div class="kpi"><div class="label">Heures cette semaine</div><div class="value">${durationHM(heuresMs)}</div><div class="delta">${myServices.length} sessions</div></div>
    <div class="kpi"><div class="label">${aFaitDeLaCo ? '🎁 CA bonus généré' : 'Statut'}</div><div class="value">${aFaitDeLaCo ? money(ca) : ROLE_LABELS[profile.role]}</div><div class="delta">${aFaitDeLaCo ? myVentes.length + ' ventes (info, sans impact paye)' : (profile.statut || 'actif')}</div></div>
    <div class="kpi"><div class="label">Date d'entrée</div><div class="value mono" style="font-size:1.2rem;">${profile.dateEntree || '—'}</div><div class="delta">au LTD</div></div>
  `;

  // Section activite annexe (ventes + quotas pompiste si presents)
  let detailHtml = `
    <p class="muted mb-2">
      En tant que ${ROLE_LABELS[profile.role]}, ton salaire est <strong>fixé</strong> par la direction (${money(plafondSalaire)} max).
      ${aFaitDeLaCo ? "Tes ventes et ravitaillements ci-dessous comptent pour le CA global du LTD mais <strong>n'impactent pas ta paye</strong>." : "Utilise les autres modules pour piloter l'activité."}
    </p>
  `;
  if (aFaitDeLaCo) {
    detailHtml += `
      <div class="kpi-grid mb-2">
        ${ca > 0 ? `<div class="kpi"><div class="label">💵 CA généré</div><div class="value">${money(ca)}</div><div class="delta">${myVentes.length} ventes</div></div>` : ''}
        ${benefice !== 0 ? `<div class="kpi"><div class="label">📈 Bénéfice généré</div><div class="value">${money(benefice)}</div><div class="delta">pour le LTD</div></div>` : ''}
        ${bidons > 0 ? `<div class="kpi"><div class="label">🛢 Bidons d'essence</div><div class="value">${num(bidons)}</div><div class="delta">produits cette semaine</div></div>` : ''}
        ${caoutchoucs > 0 ? `<div class="kpi"><div class="label">🪖 Caoutchoucs</div><div class="value">${num(caoutchoucs)}</div><div class="delta">produits cette semaine</div></div>` : ''}
      </div>
      ${myVentes.length > 0 ? `
        <div class="table-scroll" style="max-height:300px;">
          <table class="data">
            <thead><tr><th>Date</th><th>Client</th><th class="right">Montant</th><th class="right">Bénéfice</th></tr></thead>
            <tbody>
              ${myVentes.map(v => `
                <tr>
                  <td class="mono">${datetime(v.timestamp)}</td>
                  <td>${escapeHtml(v.client || '—')}</td>
                  <td class="right mono">${money(v.montant)}</td>
                  <td class="right mono ${(v.benefice||0) >= 0 ? '' : 'muted'}">${money(v.benefice || 0)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      ` : ''}
    `;
  }
  document.getElementById('detail').innerHTML = detailHtml;
}

// === Bouton "Declarer une vente" ===
// Bloque si compte bloque (>= 3 averts), sinon ouvre le modal.
const btnVente = document.getElementById('btn-declarer-vente');
if (btnVente) {
  btnVente.addEventListener('click', () => {
    if ((profile.avertsActifs || 0) >= 3 && !['patron', 'co-patron', 'admin-technique'].includes(profile.role)) {
      alert('Compte bloqué (3 avertissements actifs). Contacte la direction pour qu\'elle retire un avertissement avant de pouvoir déclarer une vente.');
      return;
    }
    ouvrirModalNouvelleVente({
      role: profile.role,
      onSuccess: () => {
        // Recharge la page pour rafraichir le tableau "Mes ventes" + KPIs.
        // Le listener sorties_en_cours se mettra a jour tout seul.
        window.location.reload();
      }
    });
  });
}

// === Sorties en cours non regularisees (anti-vol 30min) ===
// Bloc retire de l'espace employe sur demande patron 2026-05-14 :
// les alertes etaient persistantes et difficiles a faire disparaitre.
// La cloche direction continue de recevoir les alertes via la cron
// `verifierSortiesExpirees` cote serveur. L'employe est juste pas notifie ici.

// === Avertissements (temps reel) ===
// Affiche UNIQUEMENT les avertissements actifs (les retires sont caches).
// 3 actifs = compte bloque (banniere rouge).
listenAvertissements(viewedUserId, (list) => {
  const div = document.getElementById('bloc-averts');
  const actifs = list.filter(a => a.actif);
  const n = actifs.length;
  if (n === 0) { div.innerHTML = ''; return; }

  const banniere = n >= 3 ? `
    <div class="alert" style="background:rgba(220,40,40,0.18);border:2px solid var(--color-blood);font-weight:bold;margin-bottom:8px;">
      🔒 <strong>COMPTE BLOQUÉ</strong> — tu as ${n} avertissements actifs (max 3). Tu peux consulter le site mais aucune écriture ni déclaration n'est possible. Contacte la direction pour qu'elle retire un avertissement.
    </div>` : n === 2 ? `
    <div class="alert" style="background:rgba(220,140,40,0.18);border:1px solid #d88;margin-bottom:8px;">
      ⚠ <strong>${n} avertissements actifs</strong> — au prochain, ton compte sera bloqué.
    </div>` : `
    <div class="alert" style="background:rgba(220,180,40,0.12);border:1px solid #c93;margin-bottom:8px;">
      ⚠ <strong>1 avertissement actif</strong> — fais attention.
    </div>`;

  const detail = `
    <div class="panel mb-3" style="margin:0 0 12px 0;">
      <div class="panel-title"><span>⚠ Mes avertissements actifs</span><span class="muted mono">${n} actif${n > 1 ? 's' : ''}</span></div>
      <table class="data" style="margin-top:6px;">
        <thead><tr><th>Date</th><th>Motif</th><th>Source</th></tr></thead>
        <tbody>${actifs.map(a => {
          const d = a.dateCreation?.toDate ? a.dateCreation.toDate() : null;
          const dateStr = d ? d.toLocaleDateString('fr-FR') : '—';
          const source = a.auto ? '<span class="badge info">auto</span>' : '<span class="badge">manuel</span>';
          return `<tr>
            <td class="mono" style="font-size:0.8rem;">${dateStr}</td>
            <td>${escapeHtml(a.motif || '')}</td>
            <td>${source}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;

  div.innerHTML = banniere + detail;
});

// === Heures de service : 3 KPIs (jour / semaine / cumul depuis embauche) ===
const sDiv = document.getElementById('services');
const heuresStatsHtml = `
  <div class="kpi-grid mb-2">
    <div class="kpi"><div class="label">⏱ Aujourd'hui</div><div class="value">${durationHM(heuresJourMs)}</div><div class="delta">depuis 00h00</div></div>
    <div class="kpi"><div class="label">📅 Semaine en cours</div><div class="value">${durationHM(heuresMs)}</div><div class="delta">${myServices.length} sessions</div></div>
    <div class="kpi"><div class="label">🗂 Cumul depuis embauche</div><div class="value">${durationHM(cumulMs)}</div><div class="delta">${allMyServices.length} sessions total</div></div>
  </div>
`;
if (myServices.length === 0) {
  sDiv.innerHTML = heuresStatsHtml + `<p class="muted">Aucune session enregistrée cette semaine.</p>`;
} else {
  // Le tableau detaille reste sur la semaine en cours (pas trop long)
  sDiv.innerHTML = heuresStatsHtml + `
    <div class="table-scroll" style="max-height:400px;">
      <table class="data" id="table-mes-services">
        <thead><tr>
          <th data-sort="debut">Début</th>
          <th data-sort="fin">Fin</th>
          <th class="right" data-sort="duree">Durée</th>
        </tr></thead>
        <tbody>
          ${myServices.map(s => `
            <tr>
              <td>${datetime(s.debut)}</td>
              <td>${datetime(s.fin)}</td>
              <td class="right mono" data-sort-value="${s.duree || 0}">${durationHM(s.duree || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p class="muted mono mt-2" style="font-size:0.78rem;">
      Total semaine : ${durationHM(heuresMs)} ${heuresMs >= 7*3600*1000 ? '✓ ≥ 7h' : '— moins de 7h (info uniquement, non bloquant)'}
    </p>
  `;
  makeSortable(document.getElementById('table-mes-services'));
}
