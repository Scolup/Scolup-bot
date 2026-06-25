# Scolup Bot

Bot Discord qui connecte EcoleDirecte a ton serveur. Notes, emploi du temps, devoirs, messagerie, vie scolaire — tout accessible via une seule commande slash.

## Fonctionnalites

| Module | Description |
|--------|-------------|
| Notes | Notes par periode, moyennes generales et par matiere, moyenne de classe |
| Emploi du temps | EDT du jour, hier, demain ou de la semaine avec navigation |
| Devoirs | Liste des devoirs, detail du contenu, marquer comme fait/non fait |
| Messagerie | Messages recents, lecture du contenu complet, marquer comme lu |
| Vie scolaire | Absences, retards, motifs et justifications |
| Timeline | Activite recente (nouvelles notes, messages, absences) |
| Documents | Bulletins, certificats de scolarite et documents administratifs |

## Commandes

- `/comptes` — Menu interactif pour gerer tes comptes EcoleDirecte (max 3 par utilisateur)
- `/info` — Statistiques du bot, versions, liens utiles

## Connexion EcoleDirecte

Deux methodes pour lier un compte :

- **Via le site** (recommande) — Formulaire web complet avec support 2FA
- **Via Discord** — Modal de connexion rapide directement dans Discord

Les identifiants 2FA (`cn`/`cv`) sont sauvegardes pour ne plus avoir a repondre au QCM.

## Notifications

Le bot verifie les nouveaux messages EcoleDirecte toutes les 30 minutes et envoie une notification en DM avec le contenu du message.

## Stack

```
discord.js 14  ·  TypeScript  ·  MongoDB  ·  Node.js
```

## Installation

```bash
git clone https://github.com/Scolup/Scolup-bot.git
cd Scolup-bot
npm install
```

Creer un fichier `.env` :

```env
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
MONGODB_URI=
ED_API_URL=https://api.scolupdev.qzz.io/ed
WORKER_URL=https://discordauth.scolupdev.qzz.io
```

Lancer :

```bash
npm run dev
```

## Deploiement

Le bot tourne sur [Railway](https://railway.app) en continu.

```bash
npm run build
railway up --service scolup-bot
```

## Liens

- [API EcoleDirecte](https://api.scolupdev.qzz.io/ed) — Backend REST
- [Documentation API](https://docs.scolupdev.qzz.io) — Reference des endpoints
- [Site Discord](https://discord.scolupdev.qzz.io) — Dashboard et connexion OAuth2
- [GitHub](https://github.com/Scolup)

## Licence

Projet prive — non affilie a Aplim ou EcoleDirecte.
