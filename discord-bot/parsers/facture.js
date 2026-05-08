// ============================================================
// Parser : suivi-facture
// Format observé :
//   Facture #ID — Payée
//   Émetteur: @Discord — Prénom NOM (vendeur)
//   Destinataire: @Discord — Prénom NOM (client)
//   Montant: X $
//   Raison: ...
//   Paiement: Espèces / Carte
// ============================================================

import { firstEmbed, getField, getMoney } from './_helpers.js';

export function parseFactureEmbed(msg) {
  const e = firstEmbed(msg);
  if (!e) return null;

  const title = (e.title || '') + ' ' + (e.description || '');
  if (!/facture/i.test(title)) return null;

  const idMatch = title.match(/#?(\d{3,})/);
  const factureId = idMatch ? idMatch[1] : `${msg.id}`;

  const emetteur     = getField(e, 'émetteur')     || getField(e, 'emetteur')     || getField(e, 'vendeur') || '';
  const destinataire = getField(e, 'destinataire') || getField(e, 'client')       || '';

  const { discord: vendeurDiscord, nom: vendeurNom } = parseUserField(emetteur);
  const { discord: clientDiscord, nom: clientNom }    = parseUserField(destinataire);

  const montantField = getField(e, 'montant') || '';
  const montant = getMoney(montantField);
  const raison = getField(e, 'raison') || '';
  const paiement = (getField(e, 'paiement') || '').toLowerCase().includes('carte') ? 'carte' : 'especes';

  // Tenter de détecter des items (raison souvent : "5 x Bonbon, 2 x Cola Zero")
  const items = parseItems(raison);

  return {
    factureId,
    vendeurDiscord,
    vendeurNom,
    clientDiscord,
    clientNom,
    montant,
    raison,
    paiement,
    items
  };
}

function parseUserField(s) {
  const discord = ((s || '').match(/<@!?(\d+)>/) || [])[1] || '';
  // "Prénom NOM" après un tiret
  const nomMatch = (s || '').match(/[—–-]\s*([A-ZÀ-Ÿ][a-zà-ÿ\-']+\s+[A-ZÀ-Ÿ][A-ZÀ-Ÿ\-']+)/);
  return { discord, nom: nomMatch ? nomMatch[1] : (s || '').replace(/<@!?\d+>/g, '').trim() };
}

function parseItems(raison) {
  if (!raison) return [];
  const re = /(\d+)\s*[x×]\s*([^,;\n]+)/gi;
  const out = [];
  let m;
  while ((m = re.exec(raison))) {
    out.push({
      quantite: parseInt(m[1], 10),
      nom: m[2].trim()
    });
  }
  return out;
}
