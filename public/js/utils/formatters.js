// ============================================================
// Formatters — affichage cohérent dans toute l'application
// ============================================================

const NF_MONEY = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0, maximumFractionDigits: 0
});
const NF_DECIMAL = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 0, maximumFractionDigits: 2
});

export function money(n)   { return (NF_MONEY.format(n ?? 0)) + ' $'; }
export function moneySigned(n) {
  const v = n ?? 0;
  return (v >= 0 ? '+' : '') + NF_MONEY.format(v) + ' $';
}
export function num(n)     { return NF_DECIMAL.format(n ?? 0); }
export function pct(n, decimals = 0) {
  return (n ?? 0).toFixed(decimals) + ' %';
}
export function litres(n)  { return NF_MONEY.format(Math.round(n ?? 0)) + ' L'; }

const NF_DATE = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric'
});
const NF_DATETIME = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit', month: '2-digit', year: 'numeric',
  hour: '2-digit', minute: '2-digit'
});
const NF_TIME = new Intl.DateTimeFormat('fr-FR', {
  hour: '2-digit', minute: '2-digit'
});

export function date(d)     { return d ? NF_DATE.format(toDate(d)) : '—'; }
export function datetime(d) { return d ? NF_DATETIME.format(toDate(d)) : '—'; }
export function time(d)     { return d ? NF_TIME.format(toDate(d)) : '—'; }

export function toDate(d) {
  if (!d) return null;
  if (d instanceof Date) return d;
  if (typeof d.toDate === 'function') return d.toDate(); // Firestore Timestamp
  if (typeof d === 'number') return new Date(d);
  if (typeof d === 'string') return new Date(d);
  return null;
}

// === Semaine RP (lundi 00:00 → dimanche 23:59) ===
// La clôture s'effectue dimanche à 00:00, donc le dimanche appartient à la
// semaine SUIVANTE dans la logique de clôture. On garde ici la semaine ISO
// classique (lundi-dimanche) pour l'affichage et on documente la nuance.

export function startOfWeekRP(d = new Date()) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  const day = date.getDay(); // 0 = dim, 1 = lun
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}
export function endOfWeekRP(d = new Date()) {
  const start = startOfWeekRP(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}
export function weekId(d = new Date()) {
  const start = startOfWeekRP(d);
  return start.toISOString().slice(0, 10); // YYYY-MM-DD du lundi
}

export function durationHM(ms) {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${h}h${m.toString().padStart(2, '0')}`;
}

export function escapeHtml(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
