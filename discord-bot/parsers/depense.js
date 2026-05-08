// ============================================================
// Parser : dépenses
// Format observé :
//   SORTIE D'ARGENT
//   Compte ID / Utilisateur / Montant / Solde avant / Solde après / Raison
// ============================================================

import { firstEmbed, getField, getMoney } from './_helpers.js';

const RAISONS_DEDUCTIBLES = [
  /matières?\s+premières?/i,
  /avocat/i,
  /entretien.+v[ée]hicule/i
];

export function parseDepenseEmbed(msg) {
  const e = firstEmbed(msg);
  if (!e) return null;

  const title = ((e.title || '') + ' ' + (e.description || '')).toLowerCase();
  if (!title.includes("sortie") && !title.includes("dépense") && !title.includes("depense")) return null;

  const compteId    = getField(e, 'compte id') || getField(e, 'compte') || '';
  const utilisateur = getField(e, 'utilisateur') || '';
  const montant     = getMoney(getField(e, 'montant'));
  const soldeAvant  = getMoney(getField(e, 'solde avant'));
  const soldeApres  = getMoney(getField(e, 'solde après') || getField(e, 'solde apres'));
  const raison      = getField(e, 'raison') || '';

  const deductible = RAISONS_DEDUCTIBLES.some(re => re.test(raison));

  let type = 'autre';
  if (/matières?\s+premières?/i.test(raison)) type = 'matieres-premieres';
  else if (/avocat/i.test(raison)) type = 'frais-avocat';
  else if (/entretien.+v[ée]hicule/i.test(raison)) type = 'entretien-vehicules';
  else if (deductible) type = 'autre-deductible';
  else type = 'non-deductible';

  return {
    compteId,
    utilisateur,
    montant,
    soldeAvant,
    soldeApres,
    raison,
    deductible,
    type
  };
}
