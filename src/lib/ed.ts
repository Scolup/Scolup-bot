const API = process.env.ED_API_URL || 'https://api.scolupdev.qzz.io/ed';

async function edFetch(path: string, token: string) {
  const res = await fetch(`${API}${path}`, { headers: { 'x-ed-token': token } });
  return res.json() as Promise<any>;
}

async function edPost(path: string, body: any, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['x-ed-token'] = token;
  const res = await fetch(`${API}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  return res.json() as Promise<any>;
}

async function edPut(path: string, body: any, token: string) {
  const res = await fetch(`${API}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-ed-token': token },
    body: JSON.stringify(body),
  });
  return res.json() as Promise<any>;
}

export async function login(identifiant: string, motdepasse: string, uuid: string) {
  return edPost('/auth/login', { identifiant, motdepasse, uuid });
}

export async function get2faQuestion(xToken: string) {
  return edPost('/auth/2fa/question', {}, xToken);
}

export async function answer2fa(xToken: string, choix: string) {
  return edPost('/auth/2fa/answer', { choix }, xToken);
}

export async function loginWith2fa(identifiant: string, motdepasse: string, cn: string, cv: string, uuid: string) {
  return edPost('/auth/2fa/login', { identifiant, motdepasse, cn, cv, uuid });
}

export async function renewToken(identifiant: string, uuid: string, accesstoken: string) {
  return edPost('/auth/renew', { identifiant, uuid, accesstoken });
}

export async function getNotes(token: string, eleveId: number) {
  return edFetch(`/notes/${eleveId}`, token);
}

export async function getEdt(token: string, eleveId: number, dateDebut: string, dateFin: string) {
  return edFetch(`/emploi-du-temps/${eleveId}?dateDebut=${dateDebut}&dateFin=${dateFin}`, token);
}

export async function getDevoirs(token: string, eleveId: number) {
  return edFetch(`/cahier-de-textes/${eleveId}`, token);
}

export async function getDevoirDetail(token: string, eleveId: number, date: string) {
  return edFetch(`/cahier-de-textes/${eleveId}/${date}`, token);
}

export async function marquerDevoir(token: string, eleveId: number, effectues: number[], nonEffectues: number[]) {
  return edPut(`/cahier-de-textes/${eleveId}/effectuer`, { effectues, nonEffectues }, token);
}

export async function getMessages(token: string, eleveId: number, anneeMessages = '') {
  const q = anneeMessages ? `?anneeMessages=${anneeMessages}` : '';
  return edFetch(`/messagerie/${eleveId}${q}`, token);
}

export async function getMessageDetail(token: string, eleveId: number, messageId: number, anneeMessages = '') {
  const q = anneeMessages ? `?anneeMessages=${anneeMessages}` : '';
  return edFetch(`/messagerie/${eleveId}/${messageId}${q}`, token);
}

export async function marquerMessageLu(token: string, eleveId: number, ids: number[], lu: boolean, anneeMessages = '') {
  return edPut(`/messagerie/${eleveId}/lire`, { ids, lu, anneeMessages }, token);
}

export async function getVieScolaire(token: string, eleveId: number) {
  return edFetch(`/vie-scolaire/${eleveId}`, token);
}

export async function getTimeline(token: string, eleveId: number) {
  return edFetch(`/timeline/${eleveId}`, token);
}

export async function getDocuments(token: string) {
  return edFetch('/documents', token);
}

export function getDateString(offset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

export function getWeekRange(): { start: string; end: string } {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return { start: monday.toISOString().split('T')[0], end: friday.toISOString().split('T')[0] };
}

export function getCurrentSchoolYear(): string {
  const now = new Date();
  const year = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}`;
}
