import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, version as djsVersion } from 'discord.js';
import { Account } from '../models/Account.js';

export const data = new SlashCommandBuilder()
  .setName('info')
  .setDescription('Informations sur Scolup');

export async function execute(interaction: ChatInputCommandInteraction) {
  const client = interaction.client;
  const totalAccounts = await Account.countDocuments();
  const totalUsers = await Account.distinct('discordUserId').then(r => r.length);
  const uptime = process.uptime();
  const h = Math.floor(uptime / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = Math.floor(uptime % 60);
  const mem = process.memoryUsage();

  const embed = new EmbedBuilder()
    .setColor(0x2f3136)
    .setTitle('Scolup™')
    .setDescription('Bot Discord connecte a EcoleDirecte. Notes, EDT, devoirs, messagerie et plus — tout via /comptes.')
    .addFields(
      { name: 'Serveurs', value: `${client.guilds.cache.size}`, inline: true },
      { name: 'Comptes lies', value: `${totalAccounts}`, inline: true },
      { name: 'Utilisateurs', value: `${totalUsers}`, inline: true },
      { name: 'Uptime', value: `${h}h ${m}m ${s}s`, inline: true },
      { name: 'Ping', value: `${client.ws.ping}ms`, inline: true },
      { name: 'RAM', value: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`, inline: true },
      { name: 'discord.js', value: `v${djsVersion}`, inline: true },
      { name: 'Node.js', value: process.version, inline: true },
      { name: 'TypeScript', value: '6.0', inline: true },
      { name: 'Polling', value: 'Toutes les 30 min', inline: true },
      { name: 'Max comptes/user', value: '3', inline: true },
      { name: 'API', value: 'api.scolupdev.qzz.io', inline: true },
    )
    .addFields(
      { name: 'Liens', value: [
        '[Site](https://discord.scolupdev.qzz.io)',
        '[API Docs](https://docs.scolupdev.qzz.io)',
        '[GitHub](https://github.com/scolup)',
      ].join(' — ') },
      { name: 'Modules disponibles', value: 'Notes (moyennes par periode), Emploi du temps (hier/demain/semaine), Devoirs (detail + marquer fait), Messagerie (lire + marquer lu), Vie scolaire, Timeline, Documents' },
    )
    .setFooter({ text: 'Scolup Bot — non affilie a Aplim ou EcoleDirecte' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
