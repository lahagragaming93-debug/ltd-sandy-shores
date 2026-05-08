// ============================================================
// Layout commun — sidebar + topbar
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
  { key: 'employee',        href: 'employee.html',      icon: '◉',  label: 'Mon espace',         group: 'Personnel' }
];

export function renderShell(profile, activePageKey, mainContentHtml) {
  const userChip = `
    <div class="user-chip">
      <div>
        <div>${profile.prenom} ${profile.nom}</div>
        <div class="role">${ROLE_LABELS[profile.role] || profile.role}</div>
      </div>
      <button class="btn btn-sm btn-ghost" id="btn-logout">Déconnexion</button>
    </div>`;

  const navByGroup = {};
  NAV_ITEMS
    .filter(item => canAccess(profile.role, item.key))
    .forEach(item => {
      // Pour un employé pur, ne montrer que "Mon espace"
      if (isEmployeeView(profile.role) && item.key !== 'employee') return;
      (navByGroup[item.group] ||= []).push(item);
    });

  const navHtml = Object.entries(navByGroup).map(([group, items]) => `
    <div class="group-title">${group}</div>
    ${items.map(it => `
      <a href="${it.href}" class="${it.key === activePageKey ? 'active' : ''}">
        <span class="nav-icon">${it.icon}</span><span>${it.label}</span>
      </a>`).join('')}
  `).join('');

  document.body.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="logo-placeholder">LTD</div>
          <div class="name">SANDY SHORES</div>
          <div class="subname">Épicerie &amp; Stations</div>
        </div>
        <nav>${navHtml}</nav>
      </aside>
      <header class="topbar">
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

  document.getElementById('btn-logout').addEventListener('click', deconnecter);

  // Compteur d'alertes (top-right)
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
    employee: 'Mon espace'
  };
  return map[key] || 'LTD Sandy Shores';
}
