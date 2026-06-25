import { Schema, model } from 'mongoose';

export interface IAccount {
  discordUserId: string;
  identifiant: string;
  prenom: string;
  nom: string;
  eleveId: number;
  idLogin: number;
  classe: string;
  etablissement: string;
  token: string;
  cn: string;
  cv: string;
  uuid: string;
  notifiedMessageIds: number[];
  createdAt: Date;
}

const accountSchema = new Schema<IAccount>({
  discordUserId: { type: String, required: true, index: true },
  identifiant: { type: String, required: true },
  prenom: String,
  nom: String,
  eleveId: Number,
  idLogin: Number,
  classe: String,
  etablissement: String,
  token: String,
  cn: String,
  cv: String,
  uuid: String,
  notifiedMessageIds: { type: [Number], default: [] },
  createdAt: { type: Date, default: () => new Date() },
});

accountSchema.index({ discordUserId: 1, identifiant: 1 }, { unique: true });

export const Account = model<IAccount>('Account', accountSchema);
