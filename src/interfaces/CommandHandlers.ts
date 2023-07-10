/* ==== Imports =========================================================================================================================== */
import { ButtonInteraction, CommandInteraction, Message, SelectMenuInteraction } from "discord.js";

/* ==== Interfaces ======================================================================================================================== */
export interface MessageCommandHandlerMap {
    [command: string]: (msg: Message, cmd: (...args: any[]) => any, ...args: any) => Promise<any>;
};

export interface CommandInteractionHandlerMap {
    [command: string]: (interaction: CommandInteraction, cmd: (...args: any[]) => any, ...args: any) => Promise<any>;
};

export interface ButtonInteractionHandlerMap {
    [command: string]: (interaction: ButtonInteraction, ...args: any[]) => Promise<any>;
};

export interface SelectMenuInteractionHandlerMap {
    [command: string]: (interaction: SelectMenuInteraction, ...args: any[]) => Promise<any>;
};