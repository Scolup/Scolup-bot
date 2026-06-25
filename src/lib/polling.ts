import { Client } from 'discord.js';
import { Account } from '../models/Account.js';
import * as ed from './ed.js';
import { newMessageDmEmbed } from './embeds.js';

const INTERVAL = 30 * 60 * 1000;

export function startPolling(client: Client) {
  setInterval(() => checkAllMessages(client), INTERVAL);
  setTimeout(() => checkAllMessages(client), 30_000);
}

async function checkAllMessages(client: Client) {
  const accounts = await Account.find({}).lean();

  for (const account of accounts) {
    try {
      let token = account.token;
      if (account.cn && account.cv) {
        const refresh = await ed.loginWith2fa(account.identifiant, '', account.cn, account.cv, account.uuid);
        if (refresh.code === 200) {
          token = refresh.token;
          await Account.updateOne({ _id: account._id }, { token });
        }
      }

      const res = await ed.getMessages(token, account.eleveId);
      if (res.token) await Account.updateOne({ _id: account._id }, { token: res.token });

      const received = res.data?.messages?.received || [];
      const notified = new Set(account.notifiedMessageIds || []);
      const newMessages = received.filter((m: any) => !m.read && !notified.has(m.id));

      if (newMessages.length > 0) {
        const user = await client.users.fetch(account.discordUserId).catch(() => null);
        if (user) {
          for (const msg of newMessages.slice(0, 3)) {
            try {
              const detail = await ed.getMessageDetail(token, account.eleveId, msg.id);
              const content = detail.data?.content || '';
              if (detail.token) token = detail.token;
              await user.send({ embeds: [newMessageDmEmbed(msg, content)] });
            } catch {
              await user.send({ embeds: [newMessageDmEmbed(msg)] }).catch(() => {});
            }
          }
        }

        const newIds = newMessages.map((m: any) => m.id);
        const allNotified = [...(account.notifiedMessageIds || []), ...newIds].slice(-100);
        await Account.updateOne({ _id: account._id }, { notifiedMessageIds: allNotified, token });
      }
    } catch {}
  }
}
