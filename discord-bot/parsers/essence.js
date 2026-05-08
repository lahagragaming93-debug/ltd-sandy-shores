// ============================================================
// Parser : suivi-achat-essence (redistribution)
// Format observé :
//   Redistribution N°XXXXX — [Nom Station]
//   Montant facturé / Prix du litre / Litres consommés
//   Stock avant / Stock après / Niveau %
// ============================================================

import { firstEmbed, getField, getMoney } from './_helpers.js';

export function parseRedistributionEmbed(msg) {
  const e = firstEmbed(msg);
  if (!e) return null;

  const title = e.title || '';
  if (!/redistribution/i.test(title)) return null;

  const idMatch  = title.match(/N[°º]?\s*(\d+)/i);
  const stationMatch = title.match(/[—–-]\s*(.+)$/);
  const id = idMatch ? idMatch[1] : `${msg.id}`;
  const station = (stationMatch ? stationMatch[1] : '').trim();

  const montant     = getMoney(getField(e, 'montant facturé') || getField(e, 'montant'));
  const prixLitre   = getMoney(getField(e, 'prix du litre')   || getField(e, 'prix'));
  const litres      = parseInt(String(getField(e, 'litres consommés') || getField(e, 'litres') || '0').replace(/[^\d]/g, ''), 10) || 0;
  const stockAvant  = parseInt(String(getField(e, 'stock avant') || '0').replace(/[^\d]/g, ''), 10) || 0;
  const stockApres  = parseInt(String(getField(e, 'stock après') || getField(e, 'stock apres') || '0').replace(/[^\d]/g, ''), 10) || 0;
  const niveauStr   = getField(e, 'niveau') || '';
  const niveau      = parseFloat(String(niveauStr).replace(/[^\d.]/g, '')) || 0;

  return {
    id,
    station,
    stationId: slug(station),
    montant,
    prixLitre,
    litres,
    stockAvant,
    stockApres,
    niveau
  };
}

function slug(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
