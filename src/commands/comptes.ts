import {
  SlashCommandBuilder,
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
  type MessageComponentInteraction,
} from 'discord.js';
import { randomUUID } from 'crypto';
import { Account } from '../models/Account.js';
import * as ed from '../lib/ed.js';
import * as embeds from '../lib/embeds.js';
import { cacheSet, cacheGet } from '../lib/cache.js';

const WORKER_URL = process.env.WORKER_URL || '';

export const data = new SlashCommandBuilder()
  .setName('comptes')
  .setDescription('Gérer tes comptes EcoleDirecte');

function backButton(customId: string, label = '◀ Retour') {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(ButtonStyle.Secondary),
  );
}

async function getValidToken(account: any): Promise<string> {
  let token = account.token;
  if (account.cn && account.cv) {
    try {
      const refresh = await ed.loginWith2fa(account.identifiant, '', account.cn, account.cv, account.uuid);
      if (refresh.code === 200) {
        token = refresh.token;
        await Account.updateOne({ _id: account._id }, { token });
      }
    } catch {}
  }
  return token;
}

async function updateToken(accountId: any, newToken: string) {
  if (newToken) await Account.updateOne({ _id: accountId }, { token: newToken });
}

// --- Entry ---

export async function execute(interaction: ChatInputCommandInteraction) {
  const accounts = await Account.find({ discordUserId: interaction.user.id }).lean();
  if (accounts.length === 0) return showNoAccounts(interaction);
  return showAccountList(interaction, accounts);
}

export async function handleComponent(interaction: MessageComponentInteraction) {
  const parts = interaction.customId.split(':');
  const action = parts[1];
  const userId = interaction.user.id;

  switch (action) {
    case 'list': {
      const accounts = await Account.find({ discordUserId: userId }).lean();
      if (accounts.length === 0) return showNoAccounts(interaction as any);
      return showAccountList(interaction as any, accounts);
    }
    case 'add': return showAddOptions(interaction as ButtonInteraction);
    case 'login_modal': return showLoginModal(interaction as ButtonInteraction);
    case 'actions': return showActionsMenu(interaction, parts[2]);
    case 'notes': return handleNotes(interaction, parts[2]);
    case 'edt': return handleEdt(interaction, parts[2], parts[3] || '0');
    case 'devoirs': return handleDevoirs(interaction, parts[2]);
    case 'messages': return handleMessages(interaction, parts[2]);
    case 'absences': return handleAbsences(interaction, parts[2]);
    case 'timeline': return handleTimeline(interaction, parts[2]);
    case 'documents': return handleDocuments(interaction, parts[2]);
    case 'delete': return handleDelete(interaction, parts[2]);
    case 'devoir_toggle': return handleDevoirToggle(interaction, parts[2], parts[3]);
    case 'msg_read_toggle': return handleMsgReadToggle(interaction, parts[2], parts[3]);
  }
}

// --- Views ---

async function replyOrUpdate(interaction: ChatInputCommandInteraction | MessageComponentInteraction, opts: any) {
  if (interaction.replied || interaction.deferred) await interaction.editReply(opts);
  else if ('update' in interaction && typeof interaction.update === 'function') await (interaction as any).update(opts);
  else await interaction.reply({ ...opts, ephemeral: true });
}

async function showNoAccounts(interaction: ChatInputCommandInteraction | MessageComponentInteraction) {
  await replyOrUpdate(interaction, {
    embeds: [embeds.baseEmbed().setTitle('Tes comptes EcoleDirecte').setDescription('Aucun compte lie.\nClique ci-dessous pour en ajouter un.')],
    components: [new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('comptes:add').setLabel('Ajouter un compte').setStyle(ButtonStyle.Primary),
    )],
  });
}

async function showAccountList(interaction: ChatInputCommandInteraction | MessageComponentInteraction, accounts: any[]) {
  await replyOrUpdate(interaction, {
    embeds: [embeds.baseEmbed().setTitle('Tes comptes EcoleDirecte').setDescription(`${accounts.length}/3 compte(s) lie(s).\nChoisis un compte pour voir tes donnees.`)],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId('comptes:actions_select').setPlaceholder('Choisis un compte')
          .addOptions(accounts.map(a => ({ label: `${a.prenom} ${a.nom}`, description: `${a.classe} — ${a.identifiant}`, value: a._id!.toString() }))),
      ),
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('comptes:add').setLabel('Ajouter un compte').setStyle(ButtonStyle.Secondary).setDisabled(accounts.length >= 3),
      ),
    ],
  });
}

export async function handleAccountSelect(interaction: StringSelectMenuInteraction) {
  return showActionsMenu(interaction, interaction.values[0]);
}

async function showAddOptions(interaction: ButtonInteraction) {
  const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('comptes:login_modal').setLabel('Connexion rapide (Discord)').setStyle(ButtonStyle.Secondary),
  );
  if (WORKER_URL) {
    try {
      const res = await fetch(`${WORKER_URL}/link/create`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ discordUserId: interaction.user.id, discordUsername: interaction.user.username }),
      });
      const { linkCode } = await res.json() as any;
      row1.addComponents(new ButtonBuilder().setLabel('Connexion via le site').setStyle(ButtonStyle.Link).setURL(`https://discord.scolupdev.qzz.io/link/${linkCode}`));
      pollLinkCode(interaction, linkCode, interaction.user.id);
    } catch {}
  }
  await interaction.update({
    embeds: [embeds.baseEmbed().setTitle('Ajouter un compte').setDescription('**Via le site** *(recommande)* — formulaire complet avec 2FA\n**Via Discord** — connexion rapide dans un popup')],
    components: [row1, backButton('comptes:list')],
  });
}

async function showActionsMenu(interaction: MessageComponentInteraction, accountId: string) {
  const account = await Account.findById(accountId).lean();
  if (!account) { await interaction.update({ embeds: [embeds.errorEmbed('Compte introuvable')], components: [backButton('comptes:list')] }); return; }

  await interaction.update({
    embeds: [embeds.baseEmbed().setTitle(`${account.prenom} ${account.nom}`).setDescription(`${account.classe}\n\nChoisis une action :`)],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(`comptes:action_select:${accountId}`).setPlaceholder('Que veux-tu voir ?')
          .addOptions([
            { label: 'Notes', value: 'notes', description: 'Notes, moyennes et competences' },
            { label: 'Emploi du temps', value: 'edt', description: 'EDT du jour' },
            { label: 'Devoirs', value: 'devoirs', description: 'Devoirs a faire' },
            { label: 'Messages', value: 'messages', description: 'Messages recents' },
            { label: 'Vie scolaire', value: 'absences', description: 'Absences et retards' },
            { label: 'Timeline', value: 'timeline', description: 'Activite recente' },
            { label: 'Documents', value: 'documents', description: 'Documents disponibles' },
            { label: 'Supprimer ce compte', value: 'delete', description: 'Delier ce compte' },
          ]),
      ),
      backButton('comptes:list'),
    ],
  });
}

export async function handleActionSelect(interaction: StringSelectMenuInteraction) {
  const accountId = interaction.customId.split(':')[2];
  const action = interaction.values[0];
  switch (action) {
    case 'notes': return handleNotes(interaction, accountId);
    case 'edt': return handleEdt(interaction, accountId, '0');
    case 'devoirs': return handleDevoirs(interaction, accountId);
    case 'messages': return handleMessages(interaction, accountId);
    case 'absences': return handleAbsences(interaction, accountId);
    case 'timeline': return handleTimeline(interaction, accountId);
    case 'documents': return handleDocuments(interaction, accountId);
    case 'delete': return handleDelete(interaction, accountId);
  }
}

// --- Notes with period selector ---

async function handleNotes(interaction: MessageComponentInteraction, accountId: string) {
  await interaction.deferUpdate();
  const account = await Account.findById(accountId).lean();
  if (!account) return;
  try {
    const token = await getValidToken(account);
    const res = await ed.getNotes(token, account.eleveId);
    await updateToken(account._id, res.token);
    const periods = res.data?.periodes?.filter((p: any) => !p.annuel) || [];
    if (periods.length === 0) { await interaction.editReply({ embeds: [embeds.errorEmbed('Aucune periode')], components: [backButton(`comptes:actions:${accountId}`)] }); return; }
    cacheSet(`notes:${accountId}`, res.data);
    await interaction.editReply({
      embeds: [embeds.baseEmbed().setTitle('Notes').setDescription('Choisis la periode :')],
      components: [
        new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId(`comptes:notes_period_select:${accountId}`).setPlaceholder('Periode')
            .addOptions(periods.map((p: any) => ({ label: p.periode, value: p.codePeriode, description: `${p.dateDebut} → ${p.dateFin}` }))),
        ),
        backButton(`comptes:actions:${accountId}`),
      ],
    });
  } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message)], components: [backButton(`comptes:actions:${accountId}`)] }); }
}

export async function handleNotesPeriodSelect(interaction: StringSelectMenuInteraction) {
  const accountId = interaction.customId.split(':')[2];
  const data = cacheGet(`notes:${accountId}`);
  if (!data) { await interaction.update({ embeds: [embeds.errorEmbed('Donnees expirees')], components: [backButton(`comptes:notes:${accountId}`)] }); return; }
  const period = data.periodes?.find((p: any) => p.codePeriode === interaction.values[0]);
  if (!period) return;
  await interaction.update({ embeds: [embeds.notesEmbed(data, period)], components: [backButton(`comptes:notes:${accountId}`)] });
}

// --- EDT with nav ---

async function handleEdt(interaction: MessageComponentInteraction, accountId: string, offset: string) {
  await interaction.deferUpdate();
  const account = await Account.findById(accountId).lean();
  if (!account) return;
  try {
    const token = await getValidToken(account);
    let dateDebut: string, dateFin: string, label: string;
    if (offset === 'week') { const r = ed.getWeekRange(); dateDebut = r.start; dateFin = r.end; label = 'Cette semaine'; }
    else { const off = parseInt(offset); const d = ed.getDateString(off); dateDebut = d; dateFin = d; label = off === 0 ? "Aujourd'hui" : off === -1 ? 'Hier' : off === 1 ? 'Demain' : d; }
    const res = await ed.getEdt(token, account.eleveId, dateDebut, dateFin);
    await updateToken(account._id, res.token);
    await interaction.editReply({
      embeds: [embeds.edtEmbed(res.data || [], label)],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`comptes:edt:${accountId}:-1`).setLabel('Hier').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`comptes:edt:${accountId}:0`).setLabel("Aujourd'hui").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(`comptes:edt:${accountId}:1`).setLabel('Demain').setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(`comptes:edt:${accountId}:week`).setLabel('Semaine').setStyle(ButtonStyle.Secondary),
        ),
        backButton(`comptes:actions:${accountId}`),
      ],
    });
  } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message)], components: [backButton(`comptes:actions:${accountId}`)] }); }
}

// --- Devoirs with detail + toggle done ---

async function handleDevoirs(interaction: MessageComponentInteraction, accountId: string) {
  await interaction.deferUpdate();
  const account = await Account.findById(accountId).lean();
  if (!account) return;
  try {
    const token = await getValidToken(account);
    const res = await ed.getDevoirs(token, account.eleveId);
    await updateToken(account._id, res.token);
    cacheSet(`devoirs:${accountId}`, res.data);

    const allDevoirs: any[] = [];
    if (res.data && typeof res.data === 'object') {
      for (const [date, list] of Object.entries(res.data)) {
        for (const d of list as any[]) allDevoirs.push({ ...d, date });
      }
    }

    const components: any[] = [];
    if (allDevoirs.length > 0) {
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(`comptes:devoir_detail_select:${accountId}`).setPlaceholder('Voir le detail...')
          .addOptions(allDevoirs.slice(0, 25).map((d, i) => ({
            label: `${d.matiere}`.substring(0, 100), value: `${i}`,
            description: `${d.date} — ${d.effectue ? 'Fait' : 'A faire'}`.substring(0, 100),
          }))),
      ));
    }
    components.push(backButton(`comptes:actions:${accountId}`));
    await interaction.editReply({ embeds: [embeds.devoirsEmbed(res.data)], components });
  } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message)], components: [backButton(`comptes:actions:${accountId}`)] }); }
}

export async function handleDevoirDetailSelect(interaction: StringSelectMenuInteraction) {
  const accountId = interaction.customId.split(':')[2];
  await interaction.deferUpdate();
  const account = await Account.findById(accountId).lean();
  if (!account) return;
  const cached = cacheGet(`devoirs:${accountId}`);
  if (!cached) { await interaction.editReply({ embeds: [embeds.errorEmbed('Donnees expirees')], components: [backButton(`comptes:devoirs:${accountId}`)] }); return; }

  const allDevoirs: any[] = [];
  for (const [date, list] of Object.entries(cached)) { for (const d of list as any[]) allDevoirs.push({ ...d, date }); }
  const devoir = allDevoirs[parseInt(interaction.values[0])];
  if (!devoir) { await interaction.editReply({ embeds: [embeds.errorEmbed('Introuvable')], components: [backButton(`comptes:devoirs:${accountId}`)] }); return; }

  try {
    const token = await getValidToken(account);
    const res = await ed.getDevoirDetail(token, account.eleveId, devoir.date);
    await updateToken(account._id, res.token);
    const matieres = res.data?.matieres || [];
    const matiere = matieres.find((m: any) => m.codeMatiere === devoir.codeMatiere) || matieres[0];
    if (!matiere) { await interaction.editReply({ embeds: [embeds.errorEmbed('Detail non trouve')], components: [backButton(`comptes:devoirs:${accountId}`)] }); return; }

    const toggleLabel = devoir.effectue ? 'Marquer non fait' : 'Marquer comme fait';
    const toggleStyle = devoir.effectue ? ButtonStyle.Secondary : ButtonStyle.Success;

    await interaction.editReply({
      embeds: [embeds.devoirDetailEmbed({ ...matiere, date: devoir.date })],
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId(`comptes:devoir_toggle:${accountId}:${devoir.idDevoir}`).setLabel(toggleLabel).setStyle(toggleStyle),
        ),
        backButton(`comptes:devoirs:${accountId}`),
      ],
    });
  } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message)], components: [backButton(`comptes:devoirs:${accountId}`)] }); }
}

async function handleDevoirToggle(interaction: MessageComponentInteraction, accountId: string, devoirId: string) {
  await interaction.deferUpdate();
  const account = await Account.findById(accountId).lean();
  if (!account) return;
  try {
    const token = await getValidToken(account);
    const cached = cacheGet(`devoirs:${accountId}`);
    const allDevoirs: any[] = [];
    if (cached) { for (const [date, list] of Object.entries(cached)) { for (const d of list as any[]) allDevoirs.push({ ...d, date }); } }
    const devoir = allDevoirs.find((d: any) => String(d.idDevoir) === devoirId);
    const wasDone = devoir?.effectue ?? false;

    if (wasDone) {
      await ed.marquerDevoir(token, account.eleveId, [], [parseInt(devoirId)]);
    } else {
      await ed.marquerDevoir(token, account.eleveId, [parseInt(devoirId)], []);
    }

    await interaction.editReply({
      embeds: [embeds.successEmbed(wasDone ? 'Devoir marque non fait' : 'Devoir marque comme fait', 'Retourne aux devoirs pour voir la mise a jour.')],
      components: [backButton(`comptes:devoirs:${accountId}`)],
    });
  } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message)], components: [backButton(`comptes:devoirs:${accountId}`)] }); }
}

// --- Messages with year selector + read detail + mark read ---

async function handleMessages(interaction: MessageComponentInteraction, accountId: string) {
  await interaction.deferUpdate();
  const account = await Account.findById(accountId).lean();
  if (!account) return;
  try {
    const token = await getValidToken(account);
    const annee = ed.getCurrentSchoolYear();
    const res = await ed.getMessages(token, account.eleveId, annee);
    await updateToken(account._id, res.token);
    cacheSet(`messages:${accountId}`, res.data);
    const allReceived = res.data?.messages?.received || [];
    const received = [...allReceived].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')).slice(0, 25);

    const components: any[] = [];
    if (received.length > 0) {
      components.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
        new StringSelectMenuBuilder().setCustomId(`comptes:message_read_select:${accountId}`).setPlaceholder('Lire un message...')
          .addOptions(received.map((m: any) => ({
            label: `${m.subject || '(sans objet)'}`.substring(0, 100), value: `${m.id}`,
            description: `De: ${m.from?.nom || '?'} — ${m.date?.split(' ')[0] || ''}`.substring(0, 100),
          }))),
      ));
    }
    components.push(backButton(`comptes:actions:${accountId}`));
    await interaction.editReply({ embeds: [embeds.messagesEmbed(res.data)], components });
  } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message)], components: [backButton(`comptes:actions:${accountId}`)] }); }
}

export async function handleMessageReadSelect(interaction: StringSelectMenuInteraction) {
  const accountId = interaction.customId.split(':')[2];
  await interaction.deferUpdate();
  const account = await Account.findById(accountId).lean();
  if (!account) return;
  try {
    const token = await getValidToken(account);
    const res = await ed.getMessageDetail(token, account.eleveId, parseInt(interaction.values[0]));
    await updateToken(account._id, res.token);

    const isUnread = !res.data?.read;

    const components: any[] = [];
    if (isUnread) {
      components.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`comptes:msg_read_toggle:${accountId}:${interaction.values[0]}`).setLabel('Marquer comme lu').setStyle(ButtonStyle.Success),
      ));
    }
    components.push(backButton(`comptes:messages:${accountId}`));

    await interaction.editReply({ embeds: [embeds.messageDetailEmbed(res.data)], components });
  } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message)], components: [backButton(`comptes:messages:${accountId}`)] }); }
}

async function handleMsgReadToggle(interaction: MessageComponentInteraction, accountId: string, messageId: string) {
  await interaction.deferUpdate();
  const account = await Account.findById(accountId).lean();
  if (!account) return;
  try {
    const token = await getValidToken(account);
    await ed.marquerMessageLu(token, account.eleveId, [parseInt(messageId)], true);
    await interaction.editReply({
      embeds: [embeds.successEmbed('Message marque comme lu')],
      components: [backButton(`comptes:messages:${accountId}`)],
    });
  } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message)], components: [backButton(`comptes:messages:${accountId}`)] }); }
}

// --- Simple data views ---

async function handleAbsences(interaction: MessageComponentInteraction, accountId: string) {
  await interaction.deferUpdate();
  const account = await Account.findById(accountId).lean();
  if (!account) return;
  try {
    const token = await getValidToken(account);
    const res = await ed.getVieScolaire(token, account.eleveId);
    await updateToken(account._id, res.token);
    await interaction.editReply({ embeds: [embeds.absencesEmbed(res.data)], components: [backButton(`comptes:actions:${accountId}`)] });
  } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message)], components: [backButton(`comptes:actions:${accountId}`)] }); }
}

async function handleTimeline(interaction: MessageComponentInteraction, accountId: string) {
  await interaction.deferUpdate();
  const account = await Account.findById(accountId).lean();
  if (!account) return;
  try {
    const token = await getValidToken(account);
    const res = await ed.getTimeline(token, account.eleveId);
    await updateToken(account._id, res.token);
    await interaction.editReply({ embeds: [embeds.timelineEmbed(res.data || [])], components: [backButton(`comptes:actions:${accountId}`)] });
  } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message)], components: [backButton(`comptes:actions:${accountId}`)] }); }
}

async function handleDocuments(interaction: MessageComponentInteraction, accountId: string) {
  await interaction.deferUpdate();
  const account = await Account.findById(accountId).lean();
  if (!account) return;
  try {
    const token = await getValidToken(account);
    const res = await ed.getDocuments(token);
    await updateToken(account._id, res.token);
    await interaction.editReply({ embeds: [embeds.documentsEmbed(res.data)], components: [backButton(`comptes:actions:${accountId}`)] });
  } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message)], components: [backButton(`comptes:actions:${accountId}`)] }); }
}

async function handleDelete(interaction: MessageComponentInteraction, accountId: string) {
  const account = await Account.findById(accountId).lean();
  if (!account) return;
  await interaction.update({
    embeds: [embeds.baseEmbed().setTitle('Supprimer le compte').setDescription(`Es-tu sur de vouloir supprimer **${account.prenom} ${account.nom}** ?`)],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(new ButtonBuilder().setCustomId(`comptes:delete_confirm:${accountId}`).setLabel('Confirmer la suppression').setStyle(ButtonStyle.Danger)),
      backButton(`comptes:actions:${accountId}`),
    ],
  });
}

export async function handleDeleteConfirm(interaction: ButtonInteraction) {
  const accountId = interaction.customId.split(':')[2];
  const account = await Account.findByIdAndDelete(accountId).lean();
  await interaction.update({
    embeds: [embeds.successEmbed('Compte supprime', account ? `${account.prenom} ${account.nom} a ete delie.` : 'Supprime.')],
    components: [backButton('comptes:list')],
  });
}

// --- Login Modal ---

async function showLoginModal(interaction: ButtonInteraction) {
  await interaction.showModal(new ModalBuilder().setCustomId('login_modal').setTitle('Connexion EcoleDirecte').addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('identifiant').setLabel('Identifiant').setStyle(TextInputStyle.Short).setRequired(true)),
    new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('motdepasse').setLabel('Mot de passe').setStyle(TextInputStyle.Short).setRequired(true)),
  ));
}

export async function handleLoginSubmit(interaction: ModalSubmitInteraction) {
  const identifiant = interaction.fields.getTextInputValue('identifiant');
  const motdepasse = interaction.fields.getTextInputValue('motdepasse');
  const uuid = randomUUID();
  await interaction.deferReply({ ephemeral: true });

  const existing = await Account.countDocuments({ discordUserId: interaction.user.id });
  if (existing >= 3) { await interaction.editReply({ embeds: [embeds.errorEmbed('Limite atteinte', '3 comptes max.')] }); return; }

  try {
    const res = await ed.login(identifiant, motdepasse, uuid);
    if (res.code === 505) { await interaction.editReply({ embeds: [embeds.errorEmbed('Identifiants invalides')] }); return; }
    if (res.code === 200) return saveAccount(interaction, res, identifiant, uuid);
    if (res.code === 250) {
      const xToken = res.xToken;
      if (!xToken) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', 'Pas de token 2FA.')] }); return; }
      const qaRes = await ed.get2faQuestion(xToken);
      if (!qaRes?.questionDecoded) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur 2FA')] }); return; }

      const selectId = `2fa_answer_${Date.now()}`;
      await interaction.editReply({
        embeds: [embeds.baseEmbed().setTitle('Question de securite').setDescription(`**${qaRes.questionDecoded}**`)],
        components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
          new StringSelectMenuBuilder().setCustomId(selectId).setPlaceholder('Choisis ta reponse')
            .addOptions(qaRes.propositionsDecoded.slice(0, 25).map((p: string, i: number) => ({ label: p.substring(0, 100), value: qaRes.propositions[i] }))),
        )],
      });
      const collector = interaction.channel?.createMessageComponentCollector({ filter: i => i.user.id === interaction.user.id && i.customId === selectId, time: 60_000, max: 1 });
      collector?.on('collect', async (i) => {
        await i.deferUpdate();
        try {
          const ansRes = await ed.answer2fa(xToken, (i as StringSelectMenuInteraction).values[0]);
          if (!ansRes?.cn || !ansRes?.cv) { await interaction.editReply({ embeds: [embeds.errorEmbed('Mauvaise reponse')], components: [] }); return; }
          const finalRes = await ed.loginWith2fa(identifiant, motdepasse, ansRes.cn, ansRes.cv, uuid);
          if (finalRes.code !== 200) { await interaction.editReply({ embeds: [embeds.errorEmbed('Echec connexion')], components: [] }); return; }
          finalRes._cn = ansRes.cn; finalRes._cv = ansRes.cv;
          await saveAccount(interaction, finalRes, identifiant, uuid);
        } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message)], components: [] }); }
      });
      return;
    }
    await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur inconnue', `Code: ${res.code}`)] });
  } catch (err: any) { await interaction.editReply({ embeds: [embeds.errorEmbed('Erreur', err.message || 'Connexion impossible.')] }); }
}

async function saveAccount(interaction: ModalSubmitInteraction, res: any, identifiant: string, uuid: string) {
  const acc = res.data?.accounts?.[0];
  if (!acc) { await interaction.editReply({ embeds: [embeds.errorEmbed('Aucun compte dans la reponse.')] }); return; }
  await Account.findOneAndUpdate(
    { discordUserId: interaction.user.id, identifiant },
    { discordUserId: interaction.user.id, identifiant, prenom: acc.prenom, nom: acc.nom, eleveId: acc.id, idLogin: acc.idLogin, classe: acc.profile?.classe?.libelle || '', etablissement: acc.nomEtablissement || '', token: res.token, cn: res._cn || '', cv: res._cv || '', uuid },
    { upsert: true },
  );
  await interaction.editReply({ embeds: [embeds.successEmbed('Connecte !', `**${acc.prenom} ${acc.nom}**\n${acc.profile?.classe?.libelle || ''}\n\nUtilise \`/comptes\` pour acceder a tes donnees.`)], components: [] });
}

// --- Web login polling ---

async function pollLinkCode(interaction: ButtonInteraction, linkCode: string, userId: string) {
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 3000));
    try {
      const res = await fetch(`${WORKER_URL}/link/status/${linkCode}`);
      if (!res.ok) return;
      const data = await res.json() as any;
      if (data.status === 'completed') {
        if (await Account.countDocuments({ discordUserId: userId }) >= 3) return;
        await Account.findOneAndUpdate(
          { discordUserId: userId, identifiant: data.identifiant },
          { discordUserId: userId, identifiant: data.identifiant, prenom: data.account.prenom, nom: data.account.nom, eleveId: data.account.id, idLogin: data.account.idLogin, classe: data.account.classe || '', etablissement: data.account.etablissement || '', token: data.token, cn: data.cn || '', cv: data.cv || '', uuid: data.uuid },
          { upsert: true },
        );
        await interaction.editReply({ embeds: [embeds.successEmbed('Connecte via le site !', `**${data.account.prenom} ${data.account.nom}**\n${data.account.classe}`)], components: [] });
        return;
      }
    } catch {}
  }
}
