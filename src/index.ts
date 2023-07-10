/* ==== ENVIRONMENT INITIALIZATION - TS will try to process.env vars when importing, so they are needed to start with ===================== */
import dotenv from "dotenv";
dotenv.config();                                                                    // Configure dotenv here - first imported file

/* ==== Imports =========================================================================================================================== */
import { GatewayIntentBits, Options } from 'discord.js';
import { HaramLeotta } from './classes/HaramLeotta';
import { Logger } from "./classes/Logger";

/* ==== Core - Configure process.env globally and create bot instance ===================================================================== */
export const HaramLeottaInstance: HaramLeotta = new HaramLeotta({
    intents: [
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.DirectMessageReactions,
        GatewayIntentBits.DirectMessageTyping,
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildIntegrations,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMessageTyping,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildWebhooks
    ],
    makeCache: Options.cacheWithLimits({ MessageManager: 25, GuildBanManager: 0, BaseGuildEmojiManager: 0, GuildEmojiManager: 0, GuildInviteManager: 0, GuildStickerManager: 0, ReactionManager: 0, ReactionUserManager: 0, ApplicationCommandManager: 0, PresenceManager: 0, StageInstanceManager: 0 })
});
HaramLeottaInstance.init();

process.on("unhandledRejection", error => {
	Logger.error(`Unhandled promise rejection: ${error}`);
});