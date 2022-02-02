/* ==== Imports =========================================================================================================================== */
import { SelectMenuInteraction } from "discord.js";

import { ClassLogger } from "../classes/Logger";

import { SelectMenuInteractionHandlerMap } from "../interfaces/CommandHandlers";
import { applyAlias } from "../utils/LogicUtils";

const logger = new ClassLogger("SelectMenuInteractionHandler");

/* ==== Handler [Core] ==================================================================================================================== */
export const SelectMenuInteractionHandler = async (interaction: SelectMenuInteraction): Promise<void> => {
    const cmdName: string = interaction.customId;
    const cmdParams: string[] = interaction.values[0].split("-");       // For communication and to prevent false calls, some buttons have more informations in the id

    const fn = commandHandlerMap[cmdName];                              // Retrieve command handler
    if(!fn) return;
    
    logger.log(`${interaction.guild.name} - ${interaction.user.username}: [SELECTION: ${interaction.values[0]}]`);

    fn(interaction, cmdName, ...cmdParams)                            // And call it with the other parameters (generally, UUID)
    .catch(e => logger.error(`Error during the execution of ${cmdName}: ` + e.message));
}

/* ==== Command Handlers ================================================================================================================== */
const commandHandlerMap: SelectMenuInteractionHandlerMap = {}

/* ==== Post Processing =================================================================================================================== */
applyAlias(commandHandlerMap);