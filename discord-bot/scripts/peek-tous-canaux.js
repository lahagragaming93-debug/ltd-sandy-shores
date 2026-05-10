// ============================================================
// Inventaire de TOUS les canaux Discord ou le bot a acces
// ============================================================
// Produit un rapport markdown : peek-tous-canaux.md
//   - Section 1 : canaux deja mappes (CHANNEL_MAP) avec parser structure
//   - Section 2 : canaux deja mappes en RAW (logsBruts)
//   - Section 3 : canaux NON mappes (potentielles sources de donnees)
//
// Pour chaque canal non mappe : type, parent (categorie), echantillon
// du dernier message (title + description + 1er embed champs).
//
// Usage :
//   cd discord-bot
//   node scripts/peek-tous-canaux.js
// ============================================================

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { Client, GatewayIntentBits, Partials, ChannelType } from 'discord.js';

if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN manquant dans .env');
  process.exit(1);
}

// Construit l'index des canaux deja mappes a partir des variables d'env CH_*
function buildMappedIndex() {
  const structures = new Map(); // channelId -> nom_du_parser
  const raws       = new Map(); // channelId -> nom_raw
  // CHANNEL_MAP de index.js (canaux structures)
  const STRUCT = {
    CH_SUIVI_COFFRE:           'coffre',
    CH_LOGS_SERVICES:          'service',
    CH_SUIVI_SERVICE_VENDEUR:  'service',
    CH_SUIVI_FACTURE:          'facture',
    CH_SUIVI_ACHAT_ESSENCE:    'redistribution (essence)',
    CH_DEPENSES:               'depense',
    CH_PAIE:                   'paie',
    CH_LOGS_IG:                'bankAccount + inventory',
    CH_AUTO_RH:                'autoRh',
    CH_AUTORANKUP:             'autorankup',
    CH_STATSBANK:              'statsbank',
    CH_POMPISTE:               'rapportPompiste',
    CH_VENTES:                 'venteAuto',
    CH_STATIONS_DASHBOARD:     'stationsDashboard',
    CH_DOSSIERS_EMPLOYES:      'dossierEmploye (forum)',
    CH_LOGS_AVERTISSEMENT:     'avertissement',
    CH_LOGS_LICENCIEMENT:      'licenciement'
  };
  const RAW = {
    CH_SUIVI_COFFRE_SECONDAIRE: 'suivi-coffre-secondaire',
    CH_ALERTE_COFFRE:           'alerte-coffre',
    CH_REVENU:                  'revenu',
    CH_FACTURES:                'factures'
  };
  for (const [k, v] of Object.entries(STRUCT)) {
    if (process.env[k]) structures.set(process.env[k], v);
  }
  for (const [k, v] of Object.entries(RAW)) {
    if (process.env[k]) raws.set(process.env[k], v);
  }
  return { structures, raws };
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
  partials: [Partials.Message, Partials.Channel]
});

function escapeMd(s) {
  return String(s || '').replace(/[`|]/g, '\\$&').slice(0, 300);
}

function summarizeMessage(m) {
  if (!m) return '_(canal vide ou sans permission lecture)_';
  const lines = [];
  if (m.author) lines.push(`Auteur: ${m.author.username}${m.author.bot ? ' [BOT]' : ''}`);
  const e = m.embeds?.[0];
  if (e) {
    if (e.title)       lines.push(`Title: \`${escapeMd(e.title)}\``);
    if (e.description) lines.push(`Description: \`${escapeMd(e.description)}\``);
    if (e.fields?.length) {
      const fs = e.fields.slice(0, 6).map(f => `${f.name}=${escapeMd(f.value).slice(0, 60)}`).join(' | ');
      lines.push(`Fields: ${fs}`);
    }
  } else if (m.content) {
    lines.push(`Content: \`${escapeMd(m.content)}\``);
  } else {
    lines.push('_(message sans embed ni contenu textuel)_');
  }
  return lines.map(l => `      ${l}`).join('\n');
}

const TYPE_LABELS = {
  [ChannelType.GuildText]:         'TEXT',
  [ChannelType.GuildAnnouncement]: 'ANNOUNCE',
  [ChannelType.GuildForum]:        'FORUM',
  [ChannelType.GuildVoice]:        'VOICE',
  [ChannelType.GuildStageVoice]:   'STAGE',
  [ChannelType.PublicThread]:      'THREAD-PUB',
  [ChannelType.PrivateThread]:     'THREAD-PRIV',
  [ChannelType.GuildCategory]:     'CATEGORY'
};
const PEEKABLE = new Set([ChannelType.GuildText, ChannelType.GuildAnnouncement]);
const FORUM    = new Set([ChannelType.GuildForum]);

client.once('ready', async () => {
  console.log(`Connecte : ${client.user.tag}`);
  const { structures, raws } = buildMappedIndex();
  console.log(`  ${structures.size} canaux mappes en parser structure`);
  console.log(`  ${raws.size} canaux mappes en raw`);

  const out = [];
  out.push(`# Inventaire des canaux Discord — LTD Sandy Shores`);
  out.push(``);
  out.push(`Genere le ${new Date().toISOString()} par peek-tous-canaux.js`);
  out.push(``);

  for (const [, guild] of client.guilds.cache) {
    out.push(`## Serveur : ${guild.name} (${guild.id})`);
    out.push(``);

    const channels = await guild.channels.fetch();
    // Tri : par nom de categorie parente puis nom du canal
    const sorted = [...channels.values()].filter(Boolean).sort((a, b) => {
      const pa = a.parent?.name || '~';
      const pb = b.parent?.name || '~';
      if (pa !== pb) return pa.localeCompare(pb);
      return (a.name || '').localeCompare(b.name || '');
    });

    const structuresList = [];
    const rawList        = [];
    const nonMappedList  = [];
    const skipList       = []; // categories, vocal

    for (const ch of sorted) {
      if (ch.type === ChannelType.GuildCategory) { skipList.push(ch); continue; }
      if (ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice) {
        skipList.push(ch); continue;
      }
      if (structures.has(ch.id)) structuresList.push(ch);
      else if (raws.has(ch.id))  rawList.push(ch);
      else                       nonMappedList.push(ch);
    }

    // === Section 1 : structures ===
    out.push(`### ✅ Canaux DEJA mappes (parser structure) — ${structuresList.length}`);
    out.push(``);
    for (const ch of structuresList) {
      const parser = structures.get(ch.id);
      out.push(`- **#${ch.name}** (${ch.id}) [${TYPE_LABELS[ch.type] || ch.type}] — Cat: ${ch.parent?.name || '_aucune_'} → \`${parser}\``);
    }
    out.push(``);

    // === Section 2 : raw ===
    out.push(`### 📦 Canaux DEJA mappes en RAW (logsBruts) — ${rawList.length}`);
    out.push(``);
    for (const ch of rawList) {
      const label = raws.get(ch.id);
      out.push(`- **#${ch.name}** (${ch.id}) [${TYPE_LABELS[ch.type] || ch.type}] — Cat: ${ch.parent?.name || '_aucune_'} → raw:\`${label}\``);
    }
    out.push(``);

    // === Section 3 : non mappes ===
    out.push(`### 🆕 Canaux NON mappes — ${nonMappedList.length}`);
    out.push(``);
    out.push(`Pour chaque canal : echantillon du dernier message (titre + description + champs).`);
    out.push(`Si vide ou sans permission, indique 'canal vide'.`);
    out.push(``);

    let okPeek = 0, errPeek = 0;
    for (const ch of nonMappedList) {
      const typeLabel = TYPE_LABELS[ch.type] || `T${ch.type}`;
      const cat = ch.parent?.name || '_aucune_';
      out.push(`- **#${ch.name}** (${ch.id}) [${typeLabel}] — Cat: ${cat}`);

      if (FORUM.has(ch.type)) {
        try {
          const active = await ch.threads.fetchActive();
          out.push(`    _(forum, ${active.threads.size} threads actifs)_`);
        } catch (e) {
          out.push(`    _(forum, threads inaccessibles : ${e.message})_`);
        }
        continue;
      }
      if (!PEEKABLE.has(ch.type)) {
        out.push(`    _(type non lisible)_`);
        continue;
      }

      try {
        const msgs = await ch.messages.fetch({ limit: 1 });
        const last = msgs.first();
        out.push(summarizeMessage(last));
        okPeek++;
      } catch (e) {
        out.push(`    _(erreur fetch : ${e.message})_`);
        errPeek++;
      }
    }
    out.push(``);
    out.push(`> Peek OK : ${okPeek} / Erreurs : ${errPeek}`);
    out.push(``);

    // === Skip ===
    out.push(`### ⏸ Ignores (categories / vocal) — ${skipList.length}`);
    out.push(``);
    for (const ch of skipList) {
      out.push(`- #${ch.name} (${ch.id}) [${TYPE_LABELS[ch.type] || ch.type}]`);
    }
    out.push(``);
  }

  const path = 'peek-tous-canaux.md';
  writeFileSync(path, out.join('\n'), 'utf-8');
  console.log(`\nRapport ecrit : ${path}`);
  process.exit(0);
});

client.login(process.env.DISCORD_TOKEN);
