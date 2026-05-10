// ============================================================
// Rattrape les anciennes redistributions essence (#suivi-achat-essence)
// ============================================================
// Le canal #suivi-achat-essence n'a pas fetchOnStartup : tous les
// messages anterieurs au demarrage du bot ne sont pas dans la base.
// Ce script :
//   1. Se connecte avec le DISCORD_TOKEN du bot
//   2. Fetch les N derniers messages du canal (paginated, par 100)
//   3. Parse chaque message via parseRedistributionEmbed
//   4. POST vers botIngest (pipeline normal) pour ecrire dans
//      /redistributions Firestore + sync stations.
//
// IMPORTANT : pour eviter les doublons cote Firestore, le handler
// onRedistribution utilise add() (pas set), donc relancer ce script
// CREE des doublons. A lancer une seule fois pour le rattrapage initial.
// ============================================================
// Usage :
//   cd discord-bot
//   node scripts/rattraper-redistributions.js              dry-run, 200 derniers
//   node scripts/rattraper-redistributions.js --apply      execute, 200 derniers
//   node scripts/rattraper-redistributions.js --apply --limit 500
// ============================================================

import 'dotenv/config';
import fetch from 'node-fetch';
import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { parseRedistributionEmbed } from '../parsers/essence.js';

const CHANNEL_ID = process.env.CH_SUIVI_ACHAT_ESSENCE;
const APPLY      = process.argv.includes('--apply');
const limitArgIdx = process.argv.indexOf('--limit');
const TOTAL_LIMIT = limitArgIdx > 0 ? Math.max(1, parseInt(process.argv[limitArgIdx + 1], 10) || 200) : 200;

const required = ['DISCORD_TOKEN', 'INGEST_URL', 'INGEST_TOKEN', 'CH_SUIVI_ACHAT_ESSENCE'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`Variable d'environnement manquante : ${k}`);
    process.exit(1);
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel]
});

async function fetchHistory(channel, totalLimit) {
  const all = [];
  let before;
  while (all.length < totalLimit) {
    const remaining = totalLimit - all.length;
    const opts = { limit: Math.min(100, remaining) };
    if (before) opts.before = before;
    const batch = await channel.messages.fetch(opts);
    if (batch.size === 0) break;
    for (const m of batch.values()) all.push(m);
    before = batch.last()?.id;
    if (batch.size < opts.limit) break; // fin de l'historique
  }
  return all;
}

async function postToIngest(type, payload, msg) {
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
    headers: { 'Content-Type': 'application/json', 'x-bot-token': process.env.INGEST_TOKEN },
    body: JSON.stringify({ type, payload: enriched })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`POST ${type} -> ${res.status} ${txt}`);
  }
}

client.once('ready', async () => {
  console.log(`Connecte en tant que ${client.user.tag}`);
  console.log(`Mode : ${APPLY ? 'APPLY (POST botIngest)' : 'DRY-RUN'}`);
  console.log(`Canal cible : ${CHANNEL_ID}, max ${TOTAL_LIMIT} messages\n`);

  try {
    const ch = await client.channels.fetch(CHANNEL_ID);
    if (!ch) throw new Error(`Canal ${CHANNEL_ID} introuvable`);
    console.log(`Canal trouve : #${ch.name}`);

    const messages = await fetchHistory(ch, TOTAL_LIMIT);
    console.log(`${messages.length} messages recuperes (du plus recent au plus ancien)\n`);

    let parsed = 0, skipped = 0, posted = 0, errors = 0;
    for (const m of messages) {
      try {
        const payload = parseRedistributionEmbed(m);
        if (!payload) {
          skipped++;
          continue;
        }
        parsed++;
        const tag = `#${payload.id} ${payload.station || '???'}`.padEnd(35);
        const date = new Date(m.createdTimestamp).toISOString().slice(0, 16).replace('T', ' ');
        console.log(`  ${date}  ${tag}  ${payload.litres} L @ ${payload.prixLitre}$ = ${payload.montant}$`);

        if (APPLY) {
          await postToIngest('redistribution', payload, m);
          posted++;
        }
      } catch (err) {
        console.error(`  ERREUR sur msg ${m.id} : ${err.message}`);
        errors++;
      }
    }

    console.log(`\nResume : ${messages.length} messages, ${parsed} redistributions parsees, ${skipped} ignores (autres types), ${posted} postees, ${errors} erreurs`);
    if (!APPLY && parsed > 0) {
      console.log(`\nDry-run termine. Relance avec --apply pour ecrire dans /redistributions.`);
      console.log(`ATTENTION : ce script ECRIT systematiquement (add). Relancer = creer des doublons.`);
    }
    process.exit(errors > 0 ? 1 : 0);
  } catch (err) {
    console.error('Erreur fatale :', err.message);
    process.exit(2);
  }
});

client.login(process.env.DISCORD_TOKEN);
