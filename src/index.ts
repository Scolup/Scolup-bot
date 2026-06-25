import 'dotenv/config';
import { Client, GatewayIntentBits, REST, Routes, Events, ActivityType, PresenceUpdateStatus } from 'discord.js';
import mongoose from 'mongoose';
import * as comptes from './commands/comptes.js';
import * as info from './commands/info.js';
import { startPolling } from './lib/polling.js';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Bot connecte en tant que ${c.user.tag}`);
  console.log(`${c.guilds.cache.size} serveur(s)`);

  c.user.setPresence({
    status: PresenceUpdateStatus.DoNotDisturb,
    activities: [{ name: 'scolup.com (soon)', type: ActivityType.Watching }],
  });

  startPolling(client);
});

client.on(Events.InteractionCreate, async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      if (interaction.commandName === 'comptes') return await comptes.execute(interaction);
      if (interaction.commandName === 'info') return await info.execute(interaction);
    }

    if (interaction.isModalSubmit() && interaction.customId === 'login_modal') {
      return await comptes.handleLoginSubmit(interaction);
    }

    if (interaction.isStringSelectMenu()) {
      const id = interaction.customId;
      if (id === 'comptes:actions_select') return await comptes.handleAccountSelect(interaction);
      if (id.startsWith('comptes:action_select:')) return await comptes.handleActionSelect(interaction);
      if (id.startsWith('comptes:notes_period_select:')) return await comptes.handleNotesPeriodSelect(interaction);
      if (id.startsWith('comptes:devoir_detail_select:')) return await comptes.handleDevoirDetailSelect(interaction);
      if (id.startsWith('comptes:message_read_select:')) return await comptes.handleMessageReadSelect(interaction);
      if (id.startsWith('2fa_answer_')) return;
    }

    if (interaction.isButton()) {
      const id = interaction.customId;
      if (id.startsWith('comptes:delete_confirm:')) return await comptes.handleDeleteConfirm(interaction);
      if (id.startsWith('comptes:')) return await comptes.handleComponent(interaction);
    }
  } catch (err) {
    console.error('Interaction error:', err);
  }
});

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('MongoDB connecte');

  const rest = new REST().setToken(process.env.DISCORD_TOKEN!);
  await rest.put(
    Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!),
    { body: [comptes.data.toJSON(), info.data.toJSON()] },
  );
  console.log('Commandes slash enregistrees');

  await client.login(process.env.DISCORD_TOKEN!);
}

main().catch(console.error);
