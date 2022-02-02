/* ==== Imports ================================================================================== */
import deepai from 'deepai';
import { ColorResolvable, MessageEmbed } from 'discord.js';
import { DeepAiOperation } from '../interfaces/DeepAiInterfaces';

/* ==== Setup ==================================================================================== */
deepai.setApiKey(process.env.DEEPAI_TOKEN);     // Sets up the API key to make authorized requests

/**
 * Uses a function of DeepAI.com given the name and the parameters.
 * Calls the API with the operation to perform, waits for the response, and returns the output.
 * @param {operation} operation the name of the operation to perform
 * @param {string} query the text | image link in input
 * @returns {Promise<string>} Image url output | Text output
 */
export const deepAiApi = async (operation: DeepAiOperation, query: string) : Promise<string> => {
    const response = await deepai.callStandardApi(operation, { text: query, image: query });
    return response.output_url??response.output;
}

export const deepAiShortcut = (title: string, image: string) => {
    return { embeds: [new MessageEmbed()
        .setColor(process.env.EMBED_COLOR as ColorResolvable)
        .setTitle(title)
        .setURL(image)
        .setImage(image)
        .setFooter("Powered by deepai.org")
    ] }
};