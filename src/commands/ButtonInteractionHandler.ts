/* ==== Imports =========================================================================================================================== */
import { ButtonInteraction, Message } from "discord.js";

import { ClassLogger } from "../classes/Logger";

import { ButtonInteractionHandlerMap } from "../interfaces/CommandHandlers";
import { deleteFavouritesNavigator, deleteYoutubeNavigator, favouritesNavigatorShortcut, queueShortcut, youtubeNavigatorShortcut } from "../service/MusicService";
import { applyAlias } from "../utils/LogicUtils";
import { logicHandler } from "./LogicHandler";


const logger = new ClassLogger("ButtonInteractionHandler");

/* ==== Handler [Core] ==================================================================================================================== */
export const ButtonInteractionHandler = async (interaction: ButtonInteraction): Promise<void> => {
    const cmdParams: string[] = interaction.customId.split("-");    // For communication and to prevent false calls, some buttons have more informations in the id.
    const cmdName: string = cmdParams[0];                           // The first one is always the cmdName

    const fn = commandHandlerMap[cmdName];                          // Retrieve command handler
    if(!fn) return;
    
    logger.log(`${interaction.guild.name} - ${interaction.user.username}: [BUTTON: ${interaction.customId}]`);

    fn(interaction, ...cmdParams)                                   // And call it with the other parameters (generally, UUID)
    .catch(e => logger.error(`Error during the execution of ${cmdName}: ` + e.message));
}

/* ==== Command Handlers ================================================================================================================== */
const commandHandlerMap: ButtonInteractionHandlerMap = {
    /* ==== MusicPlayer ========== */
    loop: async (interaction, UUID: string): Promise<Message> => logicHandler["loop"].fn(interaction, +UUID),
    back: async (interaction, UUID: string) => logicHandler["back"].fn(interaction, 1, +UUID),
    skip: async (interaction, UUID: string) => logicHandler["skip"].fn(interaction, 1, +UUID),
    pause: async (interaction, UUID: string) => logicHandler["pause"].fn(interaction, +UUID),
    resume: async (interaction, UUID: string) => logicHandler["resume"].fn(interaction, +UUID),
    clear: async (interaction, UUID: string) => logicHandler["clear"].fn(interaction, +UUID),

    // Le logiche chiamate qua sotto vengono usate ESCLUSIVAMENTE in interfaccia (ButtonInteraction), quindi non sono implementate come comandi o come logica.
    // Sono tutte async in quando le shortcut potrebbero tornare undefiend, uccidendo il .catch
    // Queue
    navreset: async (interaction, UUID: string): Promise<void> => queueShortcut(interaction, +UUID)?.navReset(),
    navfirst: async (interaction, UUID: string): Promise<any> => queueShortcut(interaction, +UUID)?.navPageFirst(),
    navlast: async (interaction, UUID: string): Promise<any> => queueShortcut(interaction, +UUID)?.navPageLast(),
    navnext: async (interaction, UUID: string): Promise<any> => queueShortcut(interaction, +UUID)?.navPageUp(),
    navprev: async (interaction, UUID: string): Promise<any> => queueShortcut(interaction, +UUID)?.navPageDown(),

    /* ==== YoutubeNavigator ===== */
    reset: async (interaction, UUID: string): Promise<boolean> => youtubeNavigatorShortcut(interaction, +UUID)?.deleteDynamicMessage().then(() => deleteYoutubeNavigator(interaction)),
    next: async (interaction, UUID: string): Promise<Message> => youtubeNavigatorShortcut(interaction, +UUID)?.pageUp(),
    prev: async (interaction, UUID: string): Promise<Message> => youtubeNavigatorShortcut(interaction, +UUID)?.pageDown(),

    /* ==== FavouritesNavigator == */
    favreset: async (interaction, UUID: string): Promise<boolean> => favouritesNavigatorShortcut(interaction, +UUID)?.deleteDynamicMessage().then(() => deleteFavouritesNavigator(interaction)),
    favfirst: async (interaction, UUID: string): Promise<Message> => favouritesNavigatorShortcut(interaction, +UUID)?.pageFirst(),
    favlast: async (interaction, UUID: string): Promise<Message> => favouritesNavigatorShortcut(interaction, +UUID)?.pageLast(),
    favnext: async (interaction, UUID: string): Promise<Message> => favouritesNavigatorShortcut(interaction, +UUID)?.pageUp(),
    favprev: async (interaction, UUID: string): Promise<Message> => favouritesNavigatorShortcut(interaction, +UUID)?.pageDown()
}

/* ==== Post Processing =================================================================================================================== */
applyAlias(commandHandlerMap);