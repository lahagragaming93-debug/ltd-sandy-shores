// ============================================================
// Layout commun — sidebar + topbar
// Compatible tablette FiveM CEF (responsive + bouton retour)
// ============================================================

import { ROLE_LABELS, canAccess, isEmployeeView } from './utils/permissions.js';
import { deconnecter } from './auth.js';
import { listenAlertesActives, marquerAlerteLue, marquerToutesAlertesLues } from './api.js';

const NAV_ITEMS = [
  { key: 'dashboard',       href: 'dashboard.html',     icon: '★', label: 'Dashboard',          group: 'Direction' },
  { key: 'stocks_epicerie', href: 'stocks.html',        icon: '◾', label: 'Stocks épicerie',    group: 'Opérations' },
  { key: 'stocks_essence',  href: 'stations.html',      icon: '⛽', label: 'Stations essence',   group: 'Opérations' },
  { key: 'ventes',          href: 'ventes.html',        icon: '$',  label: 'Ventes',             group: 'Opérations' },
  { key: 'comptabilite',    href: 'comptabilite.html',  icon: '☰',  label: 'Comptabilité',       group: 'Finance' },
  { key: 'banque',          href: 'banque.html',        icon: '🏦', label: 'Banque LTD',         group: 'Finance' },
  { key: 'revenus_carburant', href: 'revenus-carburant.html', icon: '⛽', label: 'Revenus carburant', group: 'Finance' },
  { key: 'rh',              href: 'rh.html',            icon: '☆',  label: 'Ressources humaines',group: 'Personnel' },
  { key: 'admin',           href: 'admin.html',         icon: '⚙',  label: 'Administration',     group: 'Système' },
  { key: 'employee',        href: 'employee.html',      icon: '◉',  label: 'Mon espace',         group: 'Personnel' },
  { key: 'paies',           href: 'paies.html',         icon: '$',  label: 'Mes paies',          group: 'Personnel' },
  { key: 'guide',           href: 'guide.html',         icon: '📖', label: 'Guide',              group: 'Aide' }
];

// ============================================================
// Helpers d'affichage rôle (badge stylé + initiales)
// ============================================================
const ROLE_DISPLAY = {
  'patron':                  { emoji: '⭐', label: 'PATRON' },
  'co-patron':               { emoji: '★',  label: 'CO-PATRON' },
  'drh':                     { emoji: '📋', label: 'DRH' },
  'responsable-vente':       { emoji: '🛒', label: 'RESP. VENTE' },
  'responsable-pompiste':    { emoji: '⛽', label: 'RESP. POMPISTE' },
  'vendeur-novice':          { emoji: '🌱', label: 'NOVICE' },
  'vendeur-intermediaire':   { emoji: '💼', label: 'INTERMÉDIAIRE' },
  'vendeur-experimente':     { emoji: '⭐', label: 'EXPÉRIMENTÉ' },
  'pompiste-novice':         { emoji: '🌱', label: 'NOVICE' },
  'pompiste-intermediaire':  { emoji: '💼', label: 'INTERMÉDIAIRE' },
  'pompiste-experimente':    { emoji: '⭐', label: 'EXPÉRIMENTÉ' },
  'admin-technique':         { emoji: '🛠', label: 'ADMIN TECH' }
};

export function roleBadgeHtml(role) {
  const d = ROLE_DISPLAY[role] || { emoji: '?', label: (ROLE_LABELS[role] || role || 'INCONNU').toUpperCase() };
  return `<span class="role-badge role-${role}">${d.emoji} ${d.label}</span>`;
}

function initiales(prenom, nom) {
  const p = (prenom || '').trim();
  const n = (nom || '').trim();
  const i1 = p ? p[0] : '';
  const i2 = n ? n[0] : '';
  return (i1 + i2).toUpperCase() || '?';
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ============================================================
// Helpers alertes (icône, URL cible, heure relative)
// ============================================================
function alertIcon(type) {
  if (type === 'stock-rupture')    return '🔴';
  if (type === 'stock-bas')        return '📦';
  if (type === 'station-bas')      return '⛽';
  if (type === 'vente-sans-stock') return '🚨';
  if (type && type.startsWith('masse')) return '💰';
  return '⚠';
}

function alertHref(a) {
  switch (a.type) {
    case 'stock-rupture':
    case 'stock-bas':         return 'stocks.html';
    case 'station-bas':       return 'stations.html';
    case 'vente-sans-stock':  return 'ventes.html';
    default:                  return null; // pas de redirect
  }
}

function relativeTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : (ts instanceof Date ? ts : new Date(ts));
  if (isNaN(d.getTime())) return '';
  const diff = Math.max(0, Date.now() - d.getTime());
  const min  = Math.floor(diff / 60000);
  if (min < 1) return 'à l\'instant';
  if (min < 60) return `il y a ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h} h`;
  const j = Math.floor(h / 24);
  if (j < 7) return `il y a ${j} j`;
  return d.toLocaleDateString('fr-FR');
}

// ============================================================
// renderShell — entrée publique
// ============================================================
export function renderShell(profile, activePageKey, mainContentHtml) {
  const ini = initiales(profile.prenom, profile.nom);
  const userChip = `
    <div class="user-chip" id="user-chip">
      <div class="user-avatar role-${profile.role}" title="${escapeHtml(profile.prenom)} ${escapeHtml(profile.nom)}">${ini}</div>
      <div class="user-meta">
        <div class="user-name">${escapeHtml(profile.prenom)} ${escapeHtml(profile.nom)}</div>
        <div class="user-role">${roleBadgeHtml(profile.role)}</div>
      </div>
      <button class="btn-logout" id="btn-logout" title="Déconnexion" aria-label="Déconnexion">
        <span class="btn-logout-ico">⎋</span>
      </button>
    </div>`;

  const navByGroup = {};
  NAV_ITEMS
    .filter(item => canAccess(profile.role, item.key))
    .forEach(item => {
      // Pour un employé pur, ne montrer que "Mon espace", "Mes paies" et "Guide"
      if (isEmployeeView(profile.role)
          && item.key !== 'employee'
          && item.key !== 'paies'
          && item.key !== 'guide') return;
      (navByGroup[item.group] ||= []).push(item);
    });

  const navHtml = Object.entries(navByGroup).map(([group, items]) => `
    <div class="group-title">${group}</div>
    ${items.map(it => `
      <a href="${it.href}" class="${it.key === activePageKey ? 'active' : ''}" data-nav-link>
        <span class="nav-icon">${it.icon}</span><span>${it.label}</span>
      </a>`).join('')}
  `).join('');

  // Bouton retour : désactivé si pas d'historique navigable (page d'entrée)
  const canGoBack = window.history.length > 1;

  document.body.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <img src="img/logo.png" alt="LTD Sandy Shores" class="brand-logo" />
          <div class="name">SANDY SHORES</div>
          <div class="subname">Épicerie &amp; Stations</div>
        </div>
        <nav>${navHtml}</nav>
      </aside>
      <div class="sidebar-overlay" id="sidebar-overlay"></div>
      <header class="topbar">
        <button class="btn-menu" id="btn-menu" title="Menu" aria-label="Ouvrir le menu">☰</button>
        <button class="btn-back" id="btn-back" title="Retour" aria-label="Page précédente" ${canGoBack ? '' : 'disabled'}>←</button>
        <h1 id="page-title">${getPageTitle(activePageKey)}</h1>
        <div class="spacer"></div>

        <!-- Cloche d'alertes -->
        <div class="alerts-wrapper" id="alerts-wrapper">
          <button class="btn-alerts" id="btn-alerts" title="Alertes" aria-label="Voir les alertes">
            <span class="btn-alerts-ico">🔔</span>
            <span class="btn-alerts-badge" id="alerts-count" hidden>0</span>
          </button>
          <div class="alerts-dropdown hidden" id="alerts-dropdown" role="menu">
            <div class="alerts-dropdown-header">
              <strong>Alertes actives</strong>
              <span class="muted" id="alerts-dropdown-count">—</span>
              <button type="button" class="btn-mark-all-read" id="btn-mark-all-read" title="Tout marquer lu">Tout marquer lu</button>
            </div>
            <ul class="alerts-dropdown-list" id="alerts-dropdown-list">
              <li class="alerts-empty">Chargement…</li>
            </ul>
          </div>
        </div>

        ${userChip}
      </header>
      <main class="main">
        ${profile.bloque ? `
          <div class="alert" style="background:rgba(220,40,40,0.20);border:2px solid var(--color-blood);font-weight:bold;margin-bottom:12px;">
            🔒 <strong>COMPTE BLOQUÉ — 3 avertissements actifs.</strong>
            Tu peux consulter le site mais aucune écriture, déclaration ou ravitaillement n'est possible.
            Contacte la direction pour qu'elle retire un avertissement et débloque ton compte.
          </div>
        ` : ''}
        ${mainContentHtml}
      </main>
    </div>
    <div id="toast-container"></div>
  `;

  // Si le compte est bloque, on grise visuellement les boutons d'action
  // sensibles. La protection reelle est cote Cloud Functions + Firestore
  // rules — c'est juste de l'UX pour eviter les clics qui echoueraient.
  if (profile.bloque) {
    setTimeout(() => {
      document.querySelectorAll('button.btn-primary, button.btn-danger').forEach(b => {
        if (b.id === 'btn-logout' || b.id === 'btn-menu' || b.id === 'btn-back') return;
        b.disabled = true;
        b.title = 'Compte bloqué (3 avertissements actifs)';
        b.style.opacity = '0.5';
        b.style.cursor = 'not-allowed';
      });
    }, 50);
  }

  // === Déconnexion ===
  document.getElementById('btn-logout').addEventListener('click', deconnecter);

  // === Bouton retour ===
  document.getElementById('btn-back').addEventListener('click', () => {
    if (window.history.length > 1) {
      window.history.back();
    }
  });

  // === Menu hamburger (responsive : ouvre/ferme sidebar) ===
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const btnMenu = document.getElementById('btn-menu');

  const openSidebar  = () => { sidebar.classList.add('open'); overlay.classList.add('open'); };
  const closeSidebar = () => { sidebar.classList.remove('open'); overlay.classList.remove('open'); };

  btnMenu.addEventListener('click', () => {
    if (sidebar.classList.contains('open')) closeSidebar(); else openSidebar();
  });
  overlay.addEventListener('click', closeSidebar);

  sidebar.querySelectorAll('[data-nav-link]').forEach(a => {
    a.addEventListener('click', () => closeSidebar());
  });

  // === Cloche d'alertes : ouverture/fermeture du dropdown ===
  const btnAlerts      = document.getElementById('btn-alerts');
  const alertsDropdown = document.getElementById('alerts-dropdown');
  const alertsWrapper  = document.getElementById('alerts-wrapper');

  const openAlerts  = () => alertsDropdown.classList.remove('hidden');
  const closeAlerts = () => alertsDropdown.classList.add('hidden');

  btnAlerts.addEventListener('click', (e) => {
    e.stopPropagation();
    if (alertsDropdown.classList.contains('hidden')) openAlerts(); else closeAlerts();
  });
  // Click outside ferme
  document.addEventListener('click', (e) => {
    if (!alertsWrapper.contains(e.target)) closeAlerts();
  });

  // Fermer Sidebar OU Alertes avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (sidebar.classList.contains('open')) closeSidebar();
    if (!alertsDropdown.classList.contains('hidden')) closeAlerts();
  });

  // === Compteur + dropdown d'alertes — temps réel ===
  const badge       = document.getElementById('alerts-count');
  const dropList    = document.getElementById('alerts-dropdown-list');
  const dropCount   = document.getElementById('alerts-dropdown-count');

  // "Tout marquer lu" : un seul commit en lot
  const btnMarkAllRead = document.getElementById('btn-mark-all-read');
  if (btnMarkAllRead) {
    btnMarkAllRead.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        await marquerToutesAlertesLues();
      } catch (err) {
        console.error('marquerToutesAlertesLues:', err);
      }
    });
  }

  listenAlertesActives(alertes => {
    if (!badge) return;
    // Le badge ne compte que les NON-lues (alertes lu=true sont visibles
    // dans le dropdown mais grisees, plus dans le compteur).
    const nonLues = alertes.filter(a => !a.lu);
    if (nonLues.length > 0) {
      badge.textContent = nonLues.length > 99 ? '99+' : nonLues.length;
      badge.hidden = false;
      btnAlerts.classList.add('has-alerts');
    } else {
      badge.hidden = true;
      btnAlerts.classList.remove('has-alerts');
    }
    dropCount.textContent = `${alertes.length} alerte${alertes.length > 1 ? 's' : ''}${nonLues.length < alertes.length ? ` (${nonLues.length} non lue${nonLues.length > 1 ? 's' : ''})` : ''}`;
    btnMarkAllRead.hidden = nonLues.length === 0;

    if (alertes.length === 0) {
      dropList.innerHTML = `<li class="alerts-empty">✓ Aucune alerte active. Tout va bien.</li>`;
      return;
    }

    // Limiter à 30 alertes affichées (le scroll se fera dans le dropdown)
    const items = alertes.slice(0, 30);
    dropList.innerHTML = items.map(a => {
      const href  = alertHref(a);
      const ico   = alertIcon(a.type);
      const grav  = a.gravite || 'warn';
      const heure = relativeTime(a.timestamp);
      const luCls = a.lu ? ' alert-lu' : '';
      const btnLu = a.lu ? '' : `<button type="button" class="alert-mark-read" data-mark-read="${a.id}" title="Marquer lu" aria-label="Marquer lu">✓</button>`;
      const inner = `
        <span class="alert-ico">${ico}</span>
        <div class="alert-body">
          <div class="alert-msg">${escapeHtml(a.message || a.type)}</div>
          <div class="alert-meta">
            <span class="alert-type alert-type-${escapeHtml(grav)}">${escapeHtml(a.type)}</span>
            <span class="alert-time">${heure}</span>
          </div>
        </div>
        ${btnLu}
        ${href ? '<span class="alert-arrow">→</span>' : ''}
      `;
      return href
        ? `<li><a class="alert-item alert-grav-${escapeHtml(grav)}${luCls}" href="${href}" data-alert-link>${inner}</a></li>`
        : `<li><div class="alert-item alert-grav-${escapeHtml(grav)}${luCls}">${inner}</div></li>`;
    }).join('');

    // Fermer le dropdown au clic sur une alerte (avant la navigation)
    dropList.querySelectorAll('[data-alert-link]').forEach(a => {
      a.addEventListener('click', () => closeAlerts());
    });
    // "Marquer lu" individuel : ne pas naviguer, juste mettre lu=true
    dropList.querySelectorAll('[data-mark-read]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = btn.getAttribute('data-mark-read');
        try { await marquerAlerteLue(id); }
        catch (err) { console.error('marquerAlerteLue:', err); }
      });
    });
  });
}

function getPageTitle(key) {
  const map = {
    dashboard: 'Tableau de bord',
    stocks_epicerie: 'Stocks épicerie',
    stocks_essence: 'Stations essence',
    ventes: 'Ventes',
    comptabilite: 'Comptabilité',
    rh: 'Ressources humaines',
    admin: 'Administration',
    employee: 'Mon espace',
    paies: 'Mes paies',
    guide: 'Guide d\'utilisation',
    banque: 'Banque LTD'
  };
  return map[key] || 'LTD Sandy Shores';
}
