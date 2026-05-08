// ============================================================
// Parser : logs-services
// Format : "Service commencé/terminé" + Prénom NOM + timestamp
// ============================================================

import { firstEmbed } from './_helpers.js';

export function parseServiceEmbed(msg) {
  const text = embedText(msg) || msg.content || '';
  if (!text) return null;

  let action = null;
  if (/service\s+commenc[ée]/i.test(text)) action = 'start';
  else if (/service\s+termin[ée]/i.test(text)) action = 'end';
  else return null;

  // Récupère un nom (Prénom NOM) — heuristique
  const m = text.match(/([A-ZÀ-Ÿ][a-zà-ÿ\-']+)\s+([A-ZÀ-Ÿ][A-ZÀ-Ÿ\-']+)/);
  const employeNom = m ? `${m[1]} ${m[2]}` : '';

  // ID Discord ou character ID si présent
  const idDiscord = (text.match(/<@!?(\d+)>/) || [])[1] ||
                    (text.match(/discord:?\s*(\d{15,21})/i) || [])[1] || '';
  const idPerso = (text.match(/character[_ ]?id:?\s*([\w-]+)/i) || [])[1] || '';

  return {
    action,
    employeNom,
    employeIdDiscord: idDiscord,
    employeId: idPerso, // résolu côté Functions via /users (idPerso)
    timestamp: msg.createdTimestamp
  };
}

function embedText(msg) {
  const e = firstEmbed(msg);
  if (!e) return '';
  const parts = [e.title, e.description];
  if (e.fields) e.fields.forEach(f => parts.push(`${f.name}: ${f.value}`));
  return parts.filter(Boolean).join('\n');
}
