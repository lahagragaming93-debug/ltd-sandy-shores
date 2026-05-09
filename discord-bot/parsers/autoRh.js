// ============================================================
// Parser : #auto-rh (embauches + exclusions)
// Format observé :
//   "Exclusion: Prénom NOM (Discord:xxx, ID perso:xxx) exclu par X"
//   "Nouvel employé: Prénom NOM (Discord:xxx, ID perso:xxx)"
// ============================================================

import { firstEmbed } from './_helpers.js';

export function parseAutoRhEmbed(msg) {
  // Concatène title + description + fields pour parser au plus large
  const e = firstEmbed(msg);
  let texte;
  if (e) {
    texte = `${e.title || ''} ${e.description || ''}`;
    (e.fields || []).forEach(f => texte += ` ${f.name}: ${f.value}`);
  } else {
    texte = msg.content || '';
  }

  // Détection du type
  let type;
  if (/exclusion|licenci|exclu(?:\s|$)/i.test(texte)) type = 'exclusion';
  else if (/nouvel?\s+employ|embauche|nouveau\s+memb/i.test(texte)) type = 'embauche';
  else return null;

  // Extraction des IDs (les plus fiables)
  const idDiscord = (texte.match(/discord\s*:\s*(\d+)/i) || [])[1] || '';
  const idPerso   = (texte.match(/(?:id\s*)?perso\s*:\s*(\d+)/i) || [])[1] || '';

  // Si aucun ID, pas exploitable
  if (!idDiscord && !idPerso) return null;

  // Extraction du nom (avant la parenthèse)
  // Pattern : "[type] : Prénom Nom (Discord:..."
  const matchNom = texte.match(/(?:nouvel?\s+employ[ée]?|exclusion|exclu)\s*:?\s*([^()]+?)\s*\(/i);
  const fullName = (matchNom ? matchNom[1] : '').trim();
  const parts = fullName.split(/\s+/);
  const prenom = parts[0] || '';
  const nom = parts.slice(1).join(' ').toUpperCase() || '';

  // "exclu par X" ou "embauché par X"
  const matchPar = texte.match(/(?:exclu|embauch[ée])\s+par\s+([\p{L}\s]+?)(?:\s*[|\n]|$)/iu);
  const parQui = matchPar ? matchPar[1].trim() : '';

  return { type, prenom, nom, idDiscord, idPerso, parQui };
}
