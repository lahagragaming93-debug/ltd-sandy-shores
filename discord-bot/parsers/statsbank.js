// ============================================================
// Parser : #statsbank (récap hebdo officiel FiveM)
// Format observé :
//   "Semaine 19 2026 (4-10 mai) | CA: 332799$ | Sorties: 165600$ |
//    Bénéfice brut: 167199$ | Solde actuel: 167199$ |
//    Factures: 1 (260) | Payes: 0 | Loyers: 750$ |
//    Impôt estimé (tranche 4, 36%): 60192$"
// ============================================================

import { firstEmbed, getMoney } from './_helpers.js';

export function parseStatsbankEmbed(msg) {
  const e = firstEmbed(msg);
  let texte;
  if (e) {
    texte = `${e.title || ''} ${e.description || ''}`;
    (e.fields || []).forEach(f => texte += ` ${f.name}: ${f.value}`);
  } else {
    texte = msg.content || '';
  }

  // Doit contenir au moins "Semaine" + "CA"
  if (!/semaine/i.test(texte) || !/CA\s*:/i.test(texte)) return null;

  // Numéro de semaine + année
  const matchSem = texte.match(/semaine\s+(\d+)(?:\s+(\d{4}))?/i);
  if (!matchSem) return null;
  const numeroSemaine = parseInt(matchSem[1], 10);
  const annee = matchSem[2] ? parseInt(matchSem[2], 10) : new Date().getFullYear();

  // Période texte (ex. "4-10 mai")
  const matchPeriode = texte.match(/\(([^)]+)\)/);
  const periode = matchPeriode ? matchPeriode[1].trim() : '';

  // Champs financiers (extracteur générique)
  const lire = (regex) => {
    const m = texte.match(regex);
    return m ? getMoney(m[1]) : 0;
  };

  const ca           = lire(/ca\s*:?\s*([\d\s.,]+)\s*\$/i);
  const sorties      = lire(/sorties\s*:?\s*([\d\s.,]+)\s*\$/i);
  const beneficeBrut = lire(/b[ée]n[ée]fice\s+brut\s*:?\s*([\d\s.,]+)\s*\$/i);
  const soldeActuel  = lire(/solde\s+actuel\s*:?\s*([\d\s.,]+)\s*\$/i);
  const loyers       = lire(/loyers?\s*:?\s*([\d\s.,]+)\s*\$/i);
  const impotEstime  = lire(/imp[oô]t\s+estim[ée]\s*\([^)]*\)\s*:?\s*([\d\s.,]+)\s*\$/i);

  // Tranche d'impôt (ex. "tranche 4, 36%")
  const matchTranche = texte.match(/tranche\s+(\d+)\s*,?\s*(\d+)\s*%/i);
  const trancheImpot = matchTranche ? parseInt(matchTranche[1], 10) : null;
  const tauxImpot    = matchTranche ? parseInt(matchTranche[2], 10) : null;

  // Factures: "1 (260)" → nb=1, montant=260
  const matchFact = texte.match(/factures?\s*:?\s*(\d+)\s*\(([\d.,]+)\)?/i);
  const nbFactures      = matchFact ? parseInt(matchFact[1], 10) : 0;
  const montantFactures = matchFact ? getMoney(matchFact[2]) : 0;

  // Payes: similaire
  const matchPayes = texte.match(/payes?\s*:?\s*(\d+)(?:\s*\(([\d.,]+)\))?/i);
  const nbPayes      = matchPayes ? parseInt(matchPayes[1], 10) : 0;
  const montantPayes = matchPayes && matchPayes[2] ? getMoney(matchPayes[2]) : 0;

  return {
    numeroSemaine,
    annee,
    periode,
    ca,
    sorties,
    beneficeBrut,
    soldeActuel,
    loyers,
    impotEstime,
    trancheImpot,
    tauxImpot,
    nbFactures,
    montantFactures,
    nbPayes,
    montantPayes
  };
}
