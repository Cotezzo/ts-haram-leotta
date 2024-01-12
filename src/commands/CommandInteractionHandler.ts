/* ==== Imports =========================================================================================================================== */
import { CommandInteraction, InteractionResponse, Message, User } from "discord.js";

import { ClassLogger } from "../classes/Logger";

import { CommandInteractionHandlerMap } from "../interfaces/CommandHandlers";
import { RedditSortBy } from "../interfaces/RedditInterfaces";
import { sendPost } from "../service/RedditService";
import { applyAlias } from "../utils/LogicUtils";
import { logicHandler } from "./LogicHandler";

const logger = new ClassLogger("CommandInteractionHandler");

/* ==== Handler [Core] ==================================================================================================================== */
export const CommandInteractionHandler = async (interaction: CommandInteraction): Promise<void> => {
    const cmdName: string = interaction.commandName;

    const fn = commandHandlerMap[cmdName];
    if(!fn) return;

    const params = {};
    for (const option of interaction.options.data)          // Get all the options from the interaction
        params[option.name] = option.user ?? option.value;  // Assign them to the params object

    logger.log(`${interaction.guild?.name} - ${interaction.user.username}: ${cmdName} ${JSON.stringify(params)}`);
    
        fn(interaction, logicHandler[cmdName].fn, params)
        .catch(e => logger.error(`Error during the execution of ${cmdName}: ` + e.message));
}

/* ==== Command Handlers ================================================================================================================== */
const commandHandlerMap: CommandInteractionHandlerMap = {
    /* ==== NO ARGS ================================================================================================ */
    "ping, invite, info, changelog, coinflip, pacco, sus": (interaction, cmd) => interaction.reply(cmd()),

    /* ==== GENERIC ARGS =========================================================================================== */
    echo: (interaction, _, { text }: { text: string }): Promise<InteractionResponse<boolean>> => interaction.reply(text),                          // whole input
    help: (interaction, cmd, { command = null }: { command: string }): Promise<any> => interaction.reply(cmd(command)),   // 1 property input
    clap: (interaction, cmd, { text }: { text: string }): Promise<any> => interaction.reply(cmd(text.split(" "))),        // whole input as array
    prefix: async (interaction, cmd, { prefix }: { prefix: string }): Promise<Message> => { if(prefix) return cmd(interaction.member.user.id, prefix).then(content => interaction.reply(content)) },

    /* ==== IMAGES ================================================================================================= */
    "pic, drip, lessgo": (interaction, cmd, { user = null }: { user: User }): Promise<Message> => cmd(user || interaction.user).then(content => interaction.reply(content)),
    
    /* ==== INTERNET =============================================================================================== */
    wiki: (interaction, cmd, { topic, language="en" }: { topic: string, language: string }): Promise<any> => interaction.reply(cmd(topic, language)),
    weather: (interaction, cmd, { city }: { city: string }): Promise<Message> => cmd(city).then(content => interaction.reply(content)),
    "translate, giggino": async (interaction, cmd, { text, language = "it" }: { text: string, language: string }): Promise<Message> =>
        cmd(text, language).then(content => interaction.reply(content))
        .catch(() => interaction.reply({ content: "Invalid language. ", ephemeral: true })),
    reddit: (interaction, cmd, { subreddit, sortby = "hot" }: { subreddit: string, sortby: RedditSortBy }): Promise<any> => {
        if(!/^\w+$/.test(subreddit)) return interaction.reply({ content: "Invalid subreddit. ", ephemeral: true });
        
        // return sendPost(await cmd(interaction.channelId, subreddit.replace(/ /g, ""), sortby), interaction)    // Try to get and send post
        return cmd(interaction.channelId, subreddit.replace(/ /g, ""), sortby).then(content => sendPost(content, interaction))
        .catch(() => interaction.reply({ content: "Invalid subreddit. ", ephemeral: true }));
    },
}

/* ==== Post Processing =================================================================================================================== */
applyAlias(commandHandlerMap);