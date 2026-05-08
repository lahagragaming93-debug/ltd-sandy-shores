// ============================================================
// Bot Discord — LTD Sandy Shores
// Lit les embeds des canaux de logs et relaie vers Firebase.
// ============================================================

import 'dotenv/config';
import { Client, GatewayIntentBits, Events, Partials } from 'discord.js';
import fetch from 'node-fetch';

import { parseInventoryEmbed }     from './parsers/inventory.js';
import { parseServiceEmbed }       from './parsers/service.js';
import { parseFactureEmbed }       from './parsers/facture.js';
import { parseRedistributionEmbed } from './parsers/essence.js';
import { parseDepenseEmbed }       from './parsers/depense.js';
import { parsePaieEmbed }          from './parsers/paie.js';
import { parseCoffreEmbed }        from './parsers/coffre.js';

const required = ['DISCORD_TOKEN', 'GUILD_ID', 'INGEST_URL', 'INGEST_TOKEN'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`❌ Variable d'environnement manquante : ${k}`);
    process.exit(1);
  }
}

const CHANNEL_MAP = {
  [process.env.CH_LOGS_IG]:               { type: 'inventory',      parser: parseInventoryEmbed     },
  [process.env.CH_LOGS_SERVICES]:         { type: 'service',        parser: parseServiceEmbed       },
  [process.env.CH_SUIVI_FACTURE]:         { type: 'facture',        parser: parseFactureEmbed       },
  [process.env.CH_SUIVI_ACHAT_ESSENCE]:   { type: 'redistribution', parser: parseRedistributionEmbed },
  [process.env.CH_DEPENSES]:              { type: 'depense',        parser: parseDepenseEmbed       },
  [process.env.CH_PAIE]:                  { type: 'paie',           parser: parsePaieEmbed          },
  [process.env.CH_SUIVI_COFFRE]:          { type: 'coffre',         parser: parseCoffreEmbed        }
};

const RAW_CHANNELS = {
  [process.env.CH_SUIVI_COFFRE_SECONDAIRE]: 'suivi-coffre-secondaire',
  [process.env.CH_ALERTE_COFFRE]:           'alerte-coffre',
  [process.env.CH_REVENU]:                  'revenu',
  [process.env.CH_FACTURES]:                'factures',
  [process.env.CH_STATSBANK]:               'statsbank',
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

client.once(Events.ClientReady, c => {
  console.log(`✅ Bot connecté : ${c.user.tag}`);
  const watched = Object.keys(CHANNEL_MAP).filter(Boolean);
  console.log(`   Canaux surveillés : ${watched.length}`);
  console.log(`   Canaux logs bruts : ${Object.keys(RAW_CHANNELS).filter(Boolean).length}`);
});

client.on(Events.MessageCreate, async (msg) => {
  if (msg.guildId !== process.env.GUILD_ID) return;
  if (msg.author?.bot && !shouldProcessBotMessage(msg)) {
    // On ne veut PAS ignorer les bots — la plupart des logs FiveM viennent d'un bot.
    // Mais on évite la boucle si c'est notre propre bot.
    if (msg.author.id === client.user.id) return;
  }

  const channelId = msg.channelId;

  // Canaux structurés
  const cfg = CHANNEL_MAP[channelId];
  if (cfg) {
    try {
      const payload = cfg.parser(msg);
      if (!payload) return; // pas un embed reconnu
      await sendToFirebase(cfg.type, payload, msg);
    } catch (err) {
      console.error(`Erreur parsing ${cfg.type} (msg ${msg.id}) :`, err.message);
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
    console.error(`Firebase ${res.status} : ${txt}`);
  }
}

// Gestion robuste
process.on('unhandledRejection', e => console.error('unhandledRejection', e));
process.on('SIGTERM', () => { client.destroy(); process.exit(0); });
process.on('SIGINT',  () => { client.destroy(); process.exit(0); });

client.login(process.env.DISCORD_TOKEN);
