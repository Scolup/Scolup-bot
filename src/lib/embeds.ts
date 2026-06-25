import { EmbedBuilder } from 'discord.js';

const COLOR = 0x2f3136;
const SUCCESS = 0x57f287;
const ERROR = 0xed4245;

export function baseEmbed() {
  return new EmbedBuilder().setColor(COLOR).setFooter({ text: 'Scolup Bot' }).setTimestamp();
}

export function successEmbed(title: string, desc?: string) {
  return baseEmbed().setColor(SUCCESS).setTitle(title).setDescription(desc || '');
}

export function errorEmbed(title: string, desc?: string) {
  return baseEmbed().setColor(ERROR).setTitle(title).setDescription(desc || '');
}

function decodeEntities(text: string): string {
  let r = text.replace(/&#(\d+);/g, (_, c) => String.fromCharCode(parseInt(c)));
  r = r.replace(/&#x([0-9a-fA-F]+);/g, (_, c) => String.fromCharCode(parseInt(c, 16)));
  const m: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
    '&nbsp;': ' ', '&eacute;': 'é', '&egrave;': 'è', '&agrave;': 'à',
    '&ugrave;': 'ù', '&ccedil;': 'ç', '&ecirc;': 'ê', '&acirc;': 'â',
    '&ocirc;': 'ô', '&ucirc;': 'û', '&iuml;': 'ï', '&euml;': 'ë',
    '&uuml;': 'ü', '&ouml;': 'ö', '&icirc;': 'î', '&oelig;': 'œ',
    '&aelig;': 'æ', '&Eacute;': 'É', '&Egrave;': 'È', '&Agrave;': 'À',
    '&Ccedil;': 'Ç', '&Ecirc;': 'Ê', '&Acirc;': 'Â', '&Ocirc;': 'Ô',
    '&laquo;': '«', '&raquo;': '»', '&hellip;': '…', '&ndash;': '–',
    '&mdash;': '—', '&lsquo;': '‘', '&rsquo;': '’',
    '&ldquo;': '“', '&rdquo;': '”', '&bull;': '•',
    '&deg;': '°', '&euro;': '€',
  };
  for (const [e, c] of Object.entries(m)) r = r.replaceAll(e, c);
  return r;
}

function stripHtml(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, '')).trim();
}

export function notesEmbed(data: any, period: any) {
  const embed = baseEmbed().setTitle(`📊 Notes — ${period.periode}`);
  const disciplines = period.ensembleMatieres?.disciplines?.filter((d: any) => !d.groupeMatiere) || [];
  const notes = data.notes?.filter((n: any) => n.codePeriode === period.codePeriode) || [];

  if (notes.length === 0) {
    embed.setDescription('Aucune note pour cette période.');
    return embed;
  }

  const moyGen = period.ensembleMatieres?.moyenneGenerale;
  const moyClasse = period.ensembleMatieres?.moyenneClasse;
  let header = '';
  if (moyGen) header += `**Moyenne générale : ${moyGen}**`;
  if (moyClasse) header += ` *(classe : ${moyClasse})*`;
  if (header) header += '\n\n';

  const byMatiere = new Map<string, any[]>();
  for (const n of notes) {
    const list = byMatiere.get(n.codeMatiere) || [];
    list.push(n);
    byMatiere.set(n.codeMatiere, list);
  }

  const lines: string[] = [];
  for (const [code, notesList] of byMatiere) {
    const disc = disciplines.find((d: any) => d.codeMatiere === code);
    const name = disc?.discipline || notesList[0]?.libelleMatiere || code;
    const vals = notesList.map((n: any) => `${n.valeur}/${n.noteSur}`).join(', ');
    let line = `**${name}**`;
    if (disc?.moyenne) line += ` — Moy: ${disc.moyenne}`;
    if (disc?.moyenneClasse) line += ` *(classe: ${disc.moyenneClasse})*`;
    line += `\n${vals}`;
    lines.push(line);
  }

  embed.setDescription((header + lines.join('\n\n')).substring(0, 4096));
  return embed;
}

export function edtEmbed(data: any[], label: string) {
  const embed = baseEmbed().setTitle(`📅 EDT — ${label}`);
  if (!data || data.length === 0) {
    embed.setDescription('Aucun cours.');
    return embed;
  }

  const sorted = [...data].sort((a, b) => a.start_date.localeCompare(b.start_date));
  const lines = sorted.map(c => {
    const start = c.start_date.split(' ')[1]?.substring(0, 5) || '';
    const end = c.end_date.split(' ')[1]?.substring(0, 5) || '';
    const status = c.isAnnule ? ' ~~annulé~~' : c.isModifie ? ' *(modifié)*' : '';
    return `\`${start}-${end}\` **${c.matiere}** — ${c.salle || '?'} — ${c.prof || '?'}${status}`;
  });
  embed.setDescription(lines.join('\n'));
  return embed;
}

export function devoirsEmbed(data: any) {
  const embed = baseEmbed().setTitle('📚 Devoirs à faire');
  if (!data || typeof data !== 'object') {
    embed.setDescription('Aucun devoir.');
    return embed;
  }

  const dates = Object.keys(data).sort().slice(0, 7);
  if (dates.length === 0) {
    embed.setDescription('Aucun devoir à venir.');
    return embed;
  }

  for (const date of dates) {
    const devoirs = data[date];
    const lines = devoirs.map((d: any) => {
      const done = d.effectue ? '✅' : '⬜';
      const ctrl = d.interrogation ? ' 🔴' : '';
      return `${done} **${d.matiere}**${ctrl}`;
    });
    embed.addFields({ name: `📆 ${date}`, value: lines.join('\n'), inline: false });
  }
  return embed;
}

export function devoirDetailEmbed(devoir: any) {
  const embed = baseEmbed().setTitle(`📚 ${devoir.matiere || 'Devoir'}`);
  let text = '';
  if (devoir.aFaire?.contenu) {
    text = stripHtml(devoir.aFaire.contenu);
  }
  embed.setDescription(text.substring(0, 4000) || 'Aucun contenu.');
  embed.addFields(
    { name: 'Pour le', value: devoir.date || '?', inline: true },
    { name: 'Donné le', value: devoir.aFaire?.donneLe || '?', inline: true },
    { name: 'Fait', value: devoir.aFaire?.effectue ? '✅ Oui' : '⬜ Non', inline: true },
  );
  if (devoir.aFaire?.documents?.length > 0) {
    embed.addFields({ name: 'Pièces jointes', value: devoir.aFaire.documents.map((d: any) => `📎 ${d.libelle}`).join('\n'), inline: false });
  }
  return embed;
}

export function messagesEmbed(data: any) {
  const embed = baseEmbed().setTitle('✉️ Messages récents');
  const allReceived = data?.messages?.received || [];
  const received = [...allReceived].sort((a: any, b: any) => (b.date || '').localeCompare(a.date || '')).slice(0, 8);
  if (received.length === 0) {
    embed.setDescription('Aucun message.');
    return embed;
  }

  const lines = received.map((m: any) => {
    const read = m.read ? '' : '🔵 ';
    const from = `${m.from?.civilite || ''} ${m.from?.prenom || ''} ${m.from?.nom || ''}`.trim();
    return `${read}**${m.subject}**\n> De: ${from} — ${m.date?.split(' ')[0] || ''}`;
  });
  embed.setDescription(lines.join('\n\n'));

  const pagination = data?.pagination;
  if (pagination) {
    embed.addFields({ name: 'Stats', value: `${pagination.messagesRecusNotReadCount || 0} non lu(s) — ${pagination.messagesRecusCount || 0} total`, inline: false });
  }
  return embed;
}

export function messageDetailEmbed(msg: any) {
  const from = `${msg.from?.civilite || ''} ${msg.from?.prenom || ''} ${msg.from?.nom || ''}`.trim();
  const embed = baseEmbed().setTitle(`✉️ ${msg.subject || '(sans objet)'}`);

  let content = '';
  if (msg.content) {
    content = stripHtml(msg.content);
  }
  embed.setDescription(content.substring(0, 4000) || '(vide)');
  embed.addFields(
    { name: 'De', value: from || '?', inline: true },
    { name: 'Date', value: msg.date || '?', inline: true },
  );
  if (msg.files?.length > 0) {
    embed.addFields({ name: 'Pièces jointes', value: msg.files.map((f: any) => `📎 ${f.libelle}`).join('\n'), inline: false });
  }
  return embed;
}

export function absencesEmbed(data: any) {
  const embed = baseEmbed().setTitle('📋 Vie scolaire');
  const items = data?.absencesRetards?.slice(0, 10) || [];
  if (items.length === 0) {
    embed.setDescription('Aucune absence ni retard.');
    return embed;
  }

  const lines = items.map((a: any) => {
    const icon = a.typeElement === 'Absence' ? '🟥' : '🟧';
    const justif = a.justifie ? '✅' : '❌';
    return `${icon} **${a.typeElement}** — ${a.displayDate || a.date}\nMotif: ${a.motif || 'Non précisé'} | Justifié: ${justif}`;
  });
  embed.setDescription(lines.join('\n\n'));
  return embed;
}

export function timelineEmbed(data: any[]) {
  const embed = baseEmbed().setTitle('🕐 Activité récente');
  if (!data || data.length === 0) {
    embed.setDescription('Aucune activité récente.');
    return embed;
  }

  const items = data.slice(0, 12);
  const lines = items.map((e: any) => {
    const icons: Record<string, string> = { Note: '📊', Messagerie: '✉️', VieScolaire: '📋' };
    const icon = icons[e.typeElement] || '📌';
    return `${icon} **${e.titre}**${e.soustitre ? ` — ${e.soustitre}` : ''}\n> ${e.contenu || ''} *(${e.date})*`;
  });
  embed.setDescription(lines.join('\n\n').substring(0, 4096));
  return embed;
}

export function documentsEmbed(data: any) {
  const embed = baseEmbed().setTitle('📄 Documents');
  const all = [
    ...(data?.notes || []).map((d: any) => ({ ...d, cat: 'Notes' })),
    ...(data?.administratifs || []).map((d: any) => ({ ...d, cat: 'Administratif' })),
    ...(data?.viescolaire || []).map((d: any) => ({ ...d, cat: 'Vie scolaire' })),
  ];

  if (all.length === 0) {
    embed.setDescription('Aucun document disponible.');
    return embed;
  }

  const lines = all.map(d => `📎 **${d.libelle}** *(${d.cat})* — ${d.date || ''}`);
  embed.setDescription(lines.join('\n').substring(0, 4096));
  return embed;
}

export function newMessageDmEmbed(msg: any, content?: string) {
  const from = `${msg.from?.civilite || ''} ${msg.from?.prenom || ''} ${msg.from?.nom || ''}`.trim();
  const embed = baseEmbed()
    .setTitle(`📩 ${msg.subject || '(sans objet)'}`)
    .addFields(
      { name: 'De', value: from || '?', inline: true },
      { name: 'Date', value: msg.date || '', inline: true },
    );
  if (content) {
    const text = stripHtml(content);
    embed.setDescription(text.substring(0, 4000) || '(vide)');
  }
  if (msg.files?.length > 0) {
    embed.addFields({ name: 'Pieces jointes', value: msg.files.map((f: any) => `📎 ${f.libelle}`).join('\n'), inline: false });
  }
  return embed;
}
