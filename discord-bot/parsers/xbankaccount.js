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

  // Le title doit ressembler à "xbankaccount - <op>"
  // Variantes observées : addmoney / removemoney / withdraw / deposit
  // (Faab'Hook utilise withdraw au lieu de removemoney sur certains contextes)
  const title = (e.title || '').toLowerCase();
  if (!title.includes('xbankaccount')) return null;

  // Détecte le type d'opération
  let type;
  if (title.includes('addmoney') || title.includes('deposit'))    type = 'add';
  else if (title.includes('removemoney') || title.includes('withdraw')) type = 'remove';
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

  // Champs émetteur / destinataire :
  //  - Pour les paiements de facture (cancel embed), Faab'Hook fournit
  //    fromPropername / toPropername explicitement.
  //  - Pour les withdraw simples, il n'y a que name/properName du CALLER
  //    (= celui qui paye = LTD). Le destinataire (HDM, Dynasty 8…) n'est
  //    PAS dans l'embed et doit être identifié autrement (mapping facture-id
  //    via /config/global.fournisseurs).
  const fromDiscord    = (getField(e, 'fromDiscord')    || '').trim();
  const fromName       = (getField(e, 'fromName')       || '').trim();
  const fromPropername = (getField(e, 'fromPropername') || '').trim();
  const toDiscord      = (getField(e, 'toDiscord')      || '').trim();
  const toName         = (getField(e, 'toName')         || '').trim();
  const toPropername   = (getField(e, 'toPropername')   || '').trim();
  // Caller (qui a effectué la commande) — utile pour audit
  const callerName       = (getField(e, 'name')       || '').trim();
  const callerProperName = (getField(e, 'properName') || '').trim();
  const callerDiscord    = (getField(e, 'discord')    || '').trim();

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
