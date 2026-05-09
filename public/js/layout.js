// ============================================================
// Layout commun — sidebar + topbar
// Compatible tablette FiveM CEF (responsive + bouton retour)
// ============================================================

import { ROLE_LABELS, canAccess, isEmployeeView } from './utils/permissions.js';
import { deconnecter } from './auth.js';
import { listenAlertesActives } from './api.js';

const NAV_ITEMS = [
  { key: 'dashboard',       href: 'dashboard.html',     icon: '★', label: 'Dashboard',          group: 'Direction' },
  { key: 'stocks_epicerie', href: 'stocks.html',        icon: '◾', label: 'Stocks épicerie',    group: 'Opérations' },
  { key: 'stocks_essence',  href: 'stations.html',      icon: '⛽', label: 'Stations essence',   group: 'Opérations' },
  { key: 'ventes',          href: 'ventes.html',        icon: '$',  label: 'Ventes',             group: 'Opérations' },
  { key: 'comptabilite',    href: 'comptabilite.html',  icon: '☰',  label: 'Comptabilité',       group: 'Finance' },
  { key: 'rh',              href: 'rh.html',            icon: '☆',  label: 'Ressources humaines',group: 'Personnel' },
  { key: 'admin',           href: 'admin.html',         icon: '⚙',  label: 'Administration',     group: 'Système' },
  { key: 'employee',        href: 'employee.html',      icon: '◉',  label: 'Mon espace',         group: 'Personnel' },
  { key: 'paies',           href: 'paies.html',         icon: '$',  label: 'Mes paies',          group: 'Personnel' }
];

export function renderShell(profile, activePageKey, mainContentHtml) {
  const userChip = `
    <div class="user-chip">
      <div>
        <div>${profile.prenom} ${profile.nom}</div>
        <div class="role">${ROLE_LABELS[profile.role] || profile.role}</div>
      </div>
      <button class="btn btn-sm btn-ghost" id="btn-logout" title="Déconnexion">⎋</button>
    </div>`;

  const navByGroup = {};
  NAV_ITEMS
    .filter(item => canAccess(profile.role, item.key))
    .forEach(item => {
      // Pour un employé pur, ne montrer que "Mon espace" et "Mes paies"
      if (isEmployeeView(profile.role) && item.key !== 'employee' && item.key !== 'paies') return;
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
        <div class="alerts-pill" id="alerts-pill" style="display:none;cursor:pointer;">
          <span class="badge danger">⚠ <span id="alerts-count">0</span></span>
        </div>
        ${userChip}
      </header>
      <main class="main">
        ${mainContentHtml}
      </main>
    </div>
    <div id="toast-container"></div>
  `;

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

  // Refermer le drawer après clic sur un lien (mobile/tablette)
  sidebar.querySelectorAll('[data-nav-link]').forEach(a => {
    a.addEventListener('click', () => {
      // Le navigateur va naviguer ; on ferme avant pour éviter le flash
      closeSidebar();
    });
  });

  // Fermer avec Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sidebar.classList.contains('open')) closeSidebar();
  });

  // === Compteur d'alertes (top-right) — temps réel ===
  listenAlertesActives(alertes => {
    const pill  = document.getElementById('alerts-pill');
    const count = document.getElementById('alerts-count');
    if (!pill || !count) return;
    if (alertes.length > 0) {
      count.textContent = alertes.length;
      pill.style.display = 'block';
    } else {
      pill.style.display = 'none';
    }
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
    paies: 'Mes paies'
  };
  return map[key] || 'LTD Sandy Shores';
}
