// ============================================================
// Parser : xbankaccount (script bancaire FiveM)
// Format observé dans #logs-ig :
//   Title: "xbankaccount - addmoney" ou "xbankaccount - removemoney"
//   Description: "Ajout/Retrait d'argent dans un compte"
//   Champs : iban, accountId, before, amount, after, reason
//   Pour les paiements de facture (Paiement facture N°XXX), l'embed contient
//   aussi : fromDiscord/Name/Propername (émetteur), toDiscord/Name/Propername
//   (destinataire). On capte ces champs pour identifier le compte cible (HDM,
//   Dynasty 8, etc.) — cross-référencé avec /depenses côté handler.
// IMPORTANT : on filtre uniquement iban == LTDSANDY (compte de l'entreprise).
// Tous les autres comptes (joueurs, autres entreprises) sont ignorés.
// ============================================================

import { firstEmbed, getField, getMoney } from './_helpers.js';

// IBAN du compte LTD (à modifier ici si jamais le compte change)
const IBAN_LTD = 'LTDSANDY';

export function parseXbankaccountEmbed(msg) {
  const e = firstEmbed(msg);
  if (!e) return null;

  // Le title doit ressembler à "xbankaccount - addmoney" ou "xbankaccount - removemoney"
  const title = (e.title || '').toLowerCase();
  if (!title.includes('xbankaccount')) return null;

  // Détecte le type d'opération
  let type;
  if (title.includes('addmoney'))    type = 'add';
  else if (title.includes('removemoney')) type = 'remove';
  else return null; // autres types ignorés

  // Filtre IBAN : uniquement le compte LTD
  const iban = (getField(e, 'iban') || '').trim();
  if (iban !== IBAN_LTD) return null;

  // Extraction des champs
  const accountId  = getField(e, 'accountId') || getField(e, 'account id') || '';
  // precise=true : conserve les centimes pour audit comptable exact
  const before     = getMoney(getField(e, 'before'), true);
  const amount     = getMoney(getField(e, 'amount'), true);
  const after      = getMoney(getField(e, 'after'),  true);
  const reason     = getField(e, 'reason') || '';

  // Champs émetteur / destinataire (présents sur paiements de facture)
  const fromDiscord    = (getField(e, 'fromDiscord')    || '').trim();
  const fromName       = (getField(e, 'fromName')       || '').trim();
  const fromPropername = (getField(e, 'fromPropername') || '').trim();
  const toDiscord      = (getField(e, 'toDiscord')      || '').trim();
  const toName         = (getField(e, 'toName')         || '').trim();
  const toPropername   = (getField(e, 'toPropername')   || '').trim();

  // Sécurité : si on n'a pas de chiffres cohérents, on skip
  if (!Number.isFinite(after) || !Number.isFinite(amount)) return null;

  return {
    type,         // 'add' (recette) | 'remove' (sortie)
    iban,
    accountId,
    soldeAvant: before,
    soldeApres: after,
    montant: amount,
    raison: reason,
    fromDiscord, fromName, fromPropername,
    toDiscord, toName, toPropername
  };
}
