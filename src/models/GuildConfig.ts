import { Schema, model } from 'mongoose';

export interface IGuildConfig {
  guildId: string;
  lang: 'fr' | 'en';
  adminRoleId: string | null;
}

const guildConfigSchema = new Schema<IGuildConfig>({
  guildId: { type: String, required: true, unique: true },
  lang: { type: String, default: 'fr', enum: ['fr', 'en'] },
  adminRoleId: { type: String, default: null },
});

export const GuildConfig = model<IGuildConfig>('GuildConfig', guildConfigSchema);
