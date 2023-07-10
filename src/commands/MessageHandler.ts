/* ==== Imports =========================================================================================================================== */
import { Message } from "discord.js";

import { ClassLogger } from "../classes/Logger";

import { MessageCommandHandlerMap } from "../interfaces/CommandHandlers";
import { RedditPost } from "../interfaces/RedditInterfaces";
import { sendPost } from "../service/RedditService";
import { getUserFromMention } from "../service/UserService";
import { applyAlias } from "../utils/LogicUtils";
import { file, urlRegex } from "../utils/Regex";
import { logicHandler } from "./LogicHandler";




const logger = new ClassLogger("MessageHandler");

/* ==== Handler [Core] ==================================================================================================================== */
export const MessageHandler = async (msg: Message): Promise<any> => {
    const args = msg.content.split(/[\n ]+/);                                                       // Command arguments without prefix
    if (!args[0]) return msg.reply("Cazzo vuoi?");                                                  // Prefix only: reject

    const cmdName = args.shift().toLowerCase();
    const commandHandler = commandHandlerMap[cmdName];                                              // Get commandHandler
    if (!commandHandler) return;                                                                    // Command doesn't exist // TODO or not allowed in production enviroment: reject

    logger.log(`${msg.guild.name} - ${msg.author.username}: ${msg.content}`);                       // Log command

    commandHandler(msg, logicHandler[cmdName].fn, ...args)                                       // Call internal command with parameters given directly by users
    .catch((e: Error) => logger.error(`Error during the execution of ${cmdName}: ` + e.stack));   // Catch errors in commands
}

/* ==== Command Handlers ================================================================================================================== */
const commandHandlerMap: MessageCommandHandlerMap = {
    /* ==== NO ARGS ================================================================================================ */
    "ping, invite, info, changelog, coinflip, pacco, sus": (msg, cmd) => msg.reply(cmd()),

    /* ==== GENERIC ARGS =========================================================================================== */
    echo: msg =>  msg.reply(msg.content.substr(5)),                                                         // partial content input
    help: (msg, cmd, command: string = null) => msg.reply(cmd(command)),                                    // 1 word input
    clap: async (msg, cmd, ...args: string[]) => {
        const content: string = cmd(args);
        if(content) return msg.reply(content);
    },                                                                                                            // whole input as array
    prefix: async (msg, cmd, newPrefix: string) => { if (newPrefix) return cmd(msg.author.id, newPrefix).then(content => msg.reply(content)); }, // 1 word input NotNull

    /* ==== IMAGES ================================================================================================= */
    "pic, drip, lessgo": async (msg, cmd, userName: string = null) => {
        const user = userName ? (file.test(userName) ? userName : await getUserFromMention(msg, userName)
        // .catch(e => logger.error("getUserFromMention error: " + e))
        ) : msg.author; // Get user for "username" if exists, or get author
        if (user) return cmd(user).then(content => { logger.info(content); return msg.reply(content) });
    },

    /* ==== INTERNET =============================================================================================== */
    wiki: (msg, cmd, topic: string, language: string) => msg.reply(cmd(topic, language)),
    "weather, giggino": async (msg, cmd, ...args: string[]) => {
        const city = args.join(" ");
        if (city) return cmd(city).then((content: string) => msg.reply(content));
    },
    "tl, translate": async (msg, cmd, toLang: string, ...args: string[]) => {
        const text = args.join(" ");
        if (text) return cmd(text, toLang).then((content: string) => msg.reply(content));
    },
    "r, r/, reddit": (msg, cmd, subreddit: string) => {
        return cmd(msg.channelId, subreddit)
        .then((post: RedditPost) => sendPost(post, msg))
        .catch((e) => {logger.warn(e); return msg.reply("Invalid subreddit.") });
    },

    /* ==== DEEPAI ================================================================================================= */
    genpic: (msg, cmd, ...args: string[]) => cmd(args.join(" ")).then(content => msg.reply(content)),
    "up, anime, colorize, dream, caption": async (msg, cmd, url: string) => { if (urlRegex.test(url)) return cmd(url).then(content => msg.reply(content)) },
    
    /* ==== MUSIC ================================================================================================== */
    "p, play, pm, playmix, mix": (msg, cmd, ...args: string[]) => cmd(msg, args.join(" ")),
    "bind, s, skip, b, back, rm, remove, clear, stop, l, leave, j, join, lp, loop, sh, shuffle, ps, pause, rs, resume, np, nowplaying, q, queue":
    async (msg, cmd, indexORhowMany: string, howMany: string) => {
        const _indexORhowMany = parseInt(indexORhowMany);
        const _howMany = parseInt(howMany);

        // Controlla che i parametri inseriti, se esistono, siano validi
        if ( !(indexORhowMany && isNaN(_indexORhowMany)) && !(howMany && isNaN(_howMany)) ) return cmd(msg, indexORhowMany, howMany);
    },
    "sm, skipmix": async (msg, cmd) => cmd(msg),
    "v, volume": async (msg, cmd, volume: string) => cmd(msg, volume),
    "f, favourites": async (msg, cmd, subCommand: string, indexORhowMany: string, howMany: string) => {
        const _indexORhowMany = parseInt(indexORhowMany);
        const _howMany = parseInt(howMany);
        if ( !(indexORhowMany && isNaN(_indexORhowMany)) && !(howMany && isNaN(_howMany))) return cmd(msg, subCommand, indexORhowMany, howMany);
    }
}

/* ==== Post Processing =================================================================================================================== */
applyAlias(commandHandlerMap);