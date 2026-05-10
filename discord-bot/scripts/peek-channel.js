// ============================================================
// Outil debug : dump des N derniers messages d'un salon Discord
// ============================================================
// Usage :
//   cd discord-bot
//   node scripts/peek-channel.js <channelId> [count]
//
// Exemples :
//   node scripts/peek-channel.js 1390358941741088798
//   node scripts/peek-channel.js 1390358941741088798 200
//
// Nécessite DISCORD_TOKEN dans .env (le même que le bot).
// Écrit la sortie dans peek-<channelId>.json (gitignore le pattern).
// ============================================================

import 'dotenv/config';
import { writeFileSync } from 'fs';
import { Client, GatewayIntentBits, Partials } from 'discord.js';

const channelId = process.argv[2];
const count = parseInt(process.argv[3] || '50', 10);

if (!channelId) {
  console.error('Usage: node scripts/peek-channel.js <channelId> [count]');
  process.exit(1);
}
if (!process.env.DISCORD_TOKEN) {
  console.error('DISCORD_TOKEN manquant dans .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Message, Partials.Channel]
});

client.once('ready', async () => {
  console.log(`Connecte en tant que ${client.user.tag}`);
  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel) {
      console.error(`Salon ${channelId} introuvable ou bot sans permission.`);
      process.exit(2);
    }
    console.log(`Salon : #${channel.name} type=${channel.type} (guild: ${channel.guild?.name || '?'})`);

    // Si categorie : lister les enfants
    // Discord ChannelType : 4 = GuildCategory
    if (channel.type === 4) {
      const children = channel.children?.cache;
      console.log(`\n--- ${children?.size || 0} salons dans cette categorie ---`);
      if (children) {
        for (const child of children.values()) {
          console.log(`  [${child.type}] ${child.id}  #${child.name}  (msgs=${child.messages ? 'oui' : 'non'})`);
        }
      }
      const out = { categorie: channel.name, children: [...(children?.values() || [])].map(c => ({
        id: c.id, name: c.name, type: c.type, parentId: c.parentId
      })) };
      writeFileSync(`peek-${channelId}.json`, JSON.stringify(out, null, 2), 'utf-8');
      console.log(`\nDump categorie -> peek-${channelId}.json`);
      process.exit(0);
    }

    // Si forum : lister les threads actifs
    if (channel.type === 15) {
      const active = await channel.threads.fetchActive();
      const archived = await channel.threads.fetchArchived({ limit: 30 });
      console.log(`\n--- Forum : ${active.threads.size} threads actifs, ${archived.threads.size} archives (max 30) ---`);
      const all = [...active.threads.values(), ...archived.threads.values()];
      for (const t of all) {
        console.log(`  [thread] ${t.id}  ${t.name}  msg=${t.messageCount || '?'} archived=${t.archived}`);
      }
      const out = { forum: channel.name, threads: all.map(t => ({
        id: t.id, name: t.name, messageCount: t.messageCount, archived: t.archived,
        createdAt: t.createdAt?.toISOString()
      })) };
      writeFileSync(`peek-${channelId}.json`, JSON.stringify(out, null, 2), 'utf-8');
      console.log(`\nDump forum -> peek-${channelId}.json`);
      process.exit(0);
    }

    if (!channel.messages?.fetch) {
      console.error(`Type ${channel.type} non supporte (pas de messages.fetch).`);
      process.exit(2);
    }

    console.log(`Recuperation des ${count} derniers messages...`);

    // fetch limit max = 100 par appel ; on pagine si besoin
    const all = [];
    let beforeId = undefined;
    while (all.length < count) {
      const batchSize = Math.min(100, count - all.length);
      const opts = { limit: batchSize };
      if (beforeId) opts.before = beforeId;
      const batch = await channel.messages.fetch(opts);
      if (batch.size === 0) break;
      for (const msg of batch.values()) all.push(msg);
      beforeId = batch.last().id;
    }

    const dump = all.map(m => ({
      id: m.id,
      timestamp: m.createdAt.toISOString(),
      author: {
        username: m.author?.username,
        bot: m.author?.bot,
        id: m.author?.id
      },
      content: m.content,
      embeds: (m.embeds || []).map(e => ({
        title: e.title,
        description: e.description,
        url: e.url,
        color: e.color,
        timestamp: e.timestamp,
        footer: e.footer,
        author: e.author,
        thumbnail: e.thumbnail?.url,
        image: e.image?.url,
        fields: (e.fields || []).map(f => ({
          name: f.name,
          value: f.value,
          inline: f.inline
        }))
      })),
      attachments: [...(m.attachments?.values() || [])].map(a => ({
        name: a.name, url: a.url, contentType: a.contentType
      }))
    }));

    const outFile = `peek-${channelId}.json`;
    writeFileSync(outFile, JSON.stringify(dump, null, 2), 'utf-8');
    console.log(`\nOK : ${dump.length} messages ecrits dans ${outFile}`);

    // Aperçu console : 3 premiers messages
    console.log('\n--- APERCU 3 plus recents ---');
    for (const m of dump.slice(0, 3)) {
      console.log(`\n[${m.timestamp}] ${m.author.username}${m.author.bot ? ' (BOT)' : ''}`);
      if (m.content) console.log(`  contenu: ${m.content.slice(0, 200)}`);
      for (const e of m.embeds) {
        console.log(`  embed: title="${e.title || ''}" desc="${(e.description || '').slice(0, 100)}"`);
        for (const f of e.fields.slice(0, 5)) {
          console.log(`    field "${f.name}" = "${String(f.value).slice(0, 80)}"`);
        }
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Erreur :', err.message);
    process.exit(3);
  }
});

client.on('error', (e) => console.error('Discord error:', e.message));
client.login(process.env.DISCORD_TOKEN);
