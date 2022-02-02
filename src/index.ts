/* ==== ENVIRONMENT INITIALIZATION - TS will try to process.env vars when importing, so they are needed to start with ===================== */
import dotenv from "dotenv";
dotenv.config();                                                                    // Configure dotenv here - first imported file

/* ==== Imports =========================================================================================================================== */
import { Options } from 'discord.js';
import { HaramLeotta } from './classes/HaramLeotta';
import { Logger } from "./classes/Logger";

/* ==== Core - Configure process.env globally and create bot instance ===================================================================== */
export const HaramLeottaInstance: HaramLeotta = new HaramLeotta({
    intents: [ 'DIRECT_MESSAGES', 'DIRECT_MESSAGE_REACTIONS', 'DIRECT_MESSAGE_TYPING', 'GUILDS', 'GUILD_EMOJIS_AND_STICKERS', 'GUILD_INTEGRATIONS', 'GUILD_INVITES', 'GUILD_MESSAGES', 'GUILD_MESSAGE_REACTIONS', 'GUILD_MESSAGE_TYPING', 'GUILD_VOICE_STATES', 'GUILD_WEBHOOKS' ],
    makeCache: Options.cacheWithLimits({ MessageManager: 25, GuildBanManager: 0, BaseGuildEmojiManager: 0, GuildEmojiManager: 0, GuildInviteManager: 0, GuildStickerManager: 0, ReactionManager: 0, ReactionUserManager: 0, ApplicationCommandManager: 0, PresenceManager: 0, StageInstanceManager: 0 })
});
HaramLeottaInstance.init();

process.on("unhandledRejection", error => {
	Logger.error(`Unhandled promise rejection: ${error}`);
});