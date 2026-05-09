// ============================================================
// Bot Discord — LTD Sandy Shores
// Lit les embeds des canaux de logs et relaie vers Firebase.
// ============================================================

import 'dotenv/config';
import { Client, GatewayIntentBits, Events, Partials } from 'discord.js';
import fetch from 'node-fetch';

import { parseInventoryEmbed }       from './parsers/inventory.js';
import { parseServiceEmbed }         from './parsers/service.js';
import { parseFactureEmbed }         from './parsers/facture.js';
import { parseRedistributionEmbed }  from './parsers/essence.js';
import { parseDepenseEmbed }         from './parsers/depense.js';
import { parsePaieEmbed }            from './parsers/paie.js';
import { parseCoffreEmbed }          from './parsers/coffre.js';
import { parseXbankaccountEmbed }    from './parsers/xbankaccount.js';
import { parseAutoRhEmbed }          from './parsers/autoRh.js';
import { parseAutorankupEmbed }      from './parsers/autorankup.js';
import { parseStatsbankEmbed }       from './parsers/statsbank.js';
import { parseRapportPompisteEmbed } from './parsers/rapportPompiste.js';
import { parseVenteAutoEmbed }       from './parsers/venteAuto.js';

const required = ['DISCORD_TOKEN', 'GUILD_ID', 'INGEST_URL', 'INGEST_TOKEN'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`❌ Variable d'environnement manquante : ${k}`);
    process.exit(1);
  }
}

// Un canal peut avoir SOIT un parser unique { type, parser },
// SOIT une liste ordonnée de parsers à essayer dans l'ordre (premier qui retourne
// un payload non-null gagne). Permet de gérer plusieurs types d'embeds sur le
// même canal (ex. #logs-ig reçoit inventory + xbankaccount).
const CHANNEL_MAP = {
  [process.env.CH_LOGS_IG]: [
    { type: 'bankAccount',    parser: parseXbankaccountEmbed }, // testé en 1er (filtre IBAN LTDSANDY)
    { type: 'inventory',      parser: parseInventoryEmbed     }
  ],
  [process.env.CH_LOGS_SERVICES]:         { type: 'service',        parser: parseServiceEmbed       },
  [process.env.CH_SUIVI_SERVICE_VENDEUR]: { type: 'service',        parser: parseServiceEmbed       },
  [process.env.CH_SUIVI_FACTURE]:         { type: 'facture',        parser: parseFactureEmbed       },
  [process.env.CH_SUIVI_ACHAT_ESSENCE]:   { type: 'redistribution', parser: parseRedistributionEmbed },
  [process.env.CH_DEPENSES]:              { type: 'depense',        parser: parseDepenseEmbed       },
  [process.env.CH_PAIE]:                  { type: 'paie',           parser: parsePaieEmbed          },
  [process.env.CH_SUIVI_COFFRE]:          { type: 'coffre',         parser: parseCoffreEmbed        },
  // Nouveaux canaux (à configurer dans Railway via variables d'env CH_*)
  [process.env.CH_AUTO_RH]:               { type: 'autoRh',         parser: parseAutoRhEmbed        },
  [process.env.CH_AUTORANKUP]:            { type: 'autorankup',     parser: parseAutorankupEmbed    },
  [process.env.CH_STATSBANK]:             { type: 'statsbank',      parser: parseStatsbankEmbed     },
  [process.env.CH_POMPISTE]:              { type: 'rapportPompiste',parser: parseRapportPompisteEmbed },
  [process.env.CH_VENTES]:                { type: 'venteAuto',      parser: parseVenteAutoEmbed     }
};

const RAW_CHANNELS = {
  [process.env.CH_SUIVI_COFFRE_SECONDAIRE]: 'suivi-coffre-secondaire',
  [process.env.CH_ALERTE_COFFRE]:           'alerte-coffre',
  [process.env.CH_REVENU]:                  'revenu',  // doublon xbankaccount, garde en raw pour audit
  [process.env.CH_FACTURES]:                'factures',
  // CH_STATSBANK : déplacé en parser structuré (CHANNEL_MAP ci-dessus)
  [process.env.CH_LOGS_LICENCIEMENT]:       'logs-licenciement',
  [process.env.CH_LOGS_AVERTISSEMENT]:      'logs-avertissement'
};

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Bot connecté : ${c.user.tag}`);
  const watched = Object.keys(CHANNEL_MAP).filter(Boolean);
  const raw     = Object.keys(RAW_CHANNELS).filter(Boolean);
  console.log(`   Canaux surveillés : ${watched.length}`);
  console.log(`   Canaux logs bruts : ${raw.length}`);

  // Diagnostic : lister les canaux effectivement visibles
  try {
    const guild = await c.guilds.fetch(process.env.GUILD_ID);
    console.log(`\n📡 Diagnostic accès canaux sur "${guild.name}":`);
    const channels = await guild.channels.fetch();
    const allIds = new Set([...watched, ...raw]);
    let okCount = 0, koCount = 0;
    for (const id of allIds) {
      const ch = channels.get(id);
      const cfg = CHANNEL_MAP[id];
      const role = Array.isArray(cfg)
        ? cfg.map(c => c.type).join('|')
        : (cfg?.type || (RAW_CHANNELS[id] ? `raw:${RAW_CHANNELS[id]}` : '?'));
      if (ch) {
        const me = guild.members.me;
        const perms = ch.permissionsFor(me);
        const canView = perms?.has('ViewChannel');
        const canRead = perms?.has('ReadMessageHistory');
        if (canView && canRead) {
          console.log(`  ✓ #${ch.name.padEnd(28)} → ${role}`);
          okCount++;
        } else {
          console.log(`  ⚠ #${ch.name.padEnd(28)} → ${role}  (View=${canView}, ReadHist=${canRead})`);
          koCount++;
        }
      } else {
        console.log(`  ✗ ${id} INTROUVABLE → ${role}`);
        koCount++;
      }
    }
    console.log(`\n   Résumé : ${okCount} OK / ${koCount} problématique(s)\n`);
  } catch (e) {
    console.error('Erreur diagnostic :', e.message);
  }
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.guildId !== process.env.GUILD_ID) return;
  if (msg.author?.bot && !shouldProcessBotMessage(msg)) {
    if (msg.author.id === client.user.id) return;
  }

  const channelId = msg.channelId;
  const channelName = msg.channel?.name || channelId;
  const author = msg.author?.username || 'inconnu';
  const isBot = msg.author?.bot ? '🤖' : '👤';
  const nbEmbeds = msg.embeds?.length || 0;
  console.log(`[MSG] #${channelName} ${isBot}${author} embeds=${nbEmbeds} content="${(msg.content || '').slice(0, 60)}"`);

  // Canaux structurés (mono-parser ou liste de parsers)
  const cfg = CHANNEL_MAP[channelId];
  if (cfg) {
    const candidates = Array.isArray(cfg) ? cfg : [cfg];
    let matched = false;
    for (const c of candidates) {
      try {
        const payload = c.parser(msg);
        if (payload) {
          await sendToFirebase(c.type, payload, msg);
          matched = true;
          break;
        }
      } catch (err) {
        console.error(`Erreur parsing ${c.type} (msg ${msg.id}) :`, err.message);
      }
    }
    if (!matched) {
      const types = candidates.map(c => c.type).join('|');
      console.log(`  └─ aucun parser n'a reconnu (essayés: ${types})`);
    }
    return;
  }

  // Canaux logs bruts
  if (RAW_CHANNELS[channelId]) {
    try {
      const contenu = embedsToText(msg);
      if (!contenu) return;
      await sendToFirebase('logBrut', {
        canal: RAW_CHANNELS[channelId],
        contenu,
        auteur: msg.author?.username || ''
      }, msg);
    } catch (err) {
      console.error('logBrut error', err.message);
    }
  }
});

function shouldProcessBotMessage(msg) {
  // Toujours traiter les messages d'autres bots (logs FiveM)
  return msg.author.id !== client.user?.id;
}

function embedsToText(msg) {
  if (!msg.embeds || msg.embeds.length === 0) return msg.content || '';
  return msg.embeds.map(e => {
    const lines = [];
    if (e.title) lines.push(e.title);
    if (e.description) lines.push(e.description);
    (e.fields || []).forEach(f => lines.push(`${f.name}: ${f.value}`));
    return lines.join('\n');
  }).join('\n---\n');
}

async function sendToFirebase(type, payload, msg) {
  const enriched = {
    ...payload,
    _meta: {
      messageId: msg.id,
      channelId: msg.channelId,
      timestamp: msg.createdTimestamp
    }
  };
  const res = await fetch(process.env.INGEST_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-bot-token':  process.env.INGEST_TOKEN
    },
    body: JSON.stringify({ type, payload: enriched })
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(`  └─ Firebase ${res.status} : ${txt.slice(0, 120)}`);
  } else {
    console.log(`  └─ Firebase ✓ (${type})`);
  }
}

// Gestion robuste
process.on('unhandledRejection', e => console.error('unhandledRejection', e));
process.on('SIGTERM', () => { client.destroy(); process.exit(0); });
process.on('SIGINT',  () => { client.destroy(); process.exit(0); });

client.login(process.env.DISCORD_TOKEN);
