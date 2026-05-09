// ============================================================
// Parser : xbankaccount (script bancaire FiveM)
// Format observé dans #logs-ig :
//   Title: "xbankaccount - addmoney" ou "xbankaccount - removemoney"
//   Description: "Ajout/Retrait d'argent dans un compte"
//   Champs : iban, accountId, before, amount, after, reason
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
  const before     = getMoney(getField(e, 'before'));
  const amount     = getMoney(getField(e, 'amount'));
  const after      = getMoney(getField(e, 'after'));
  const reason     = getField(e, 'reason') || '';

  // Sécurité : si on n'a pas de chiffres cohérents, on skip
  if (!Number.isFinite(after) || !Number.isFinite(amount)) return null;

  return {
    type,         // 'add' (recette) | 'remove' (sortie)
    iban,
    accountId,
    soldeAvant: before,
    soldeApres: after,
    montant: amount,
    raison: reason
  };
}
