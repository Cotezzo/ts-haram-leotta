/* ==== Imports =========================================================================================================================== */
import { Message, TextBasedChannel } from "discord.js";
import { ClassLogger } from "./Logger";

const logger = new ClassLogger("DynamicMessage");

/* ==== Class ============================================================================================================================= */
export class DynamicMessage {
    message: Message;
    messageContent: any;
    textChannel: TextBasedChannel;
    UUID?: number;

    constructor(UUID?: number){
        // this.textChannel = textChannel;
        this.UUID = UUID;
    }

    check = (UUID?: number): DynamicMessage => (!UUID || this.UUID == UUID) ? this : undefined;
    
    updateTextChannel = (textChannel: TextBasedChannel): DynamicMessage => {
        this.textChannel = textChannel;
        return this;
    }

    updateContent = (messageContent: any): DynamicMessage => {
        this.messageContent = messageContent;
        return this;
    }

    /**
     * Creates and sends the embed + components of the music player DynamicMessage.
     * @param {TextBasedChannel} channel 
     * @returns {Promise<Message>}
     */
    create = async (): Promise<Message> => {
        if(!this.messageContent) {
            logger.warn("messageContent is undefined");
            return;
        }

        this.message = await this.textChannel?.send(this.messageContent);
        return this.message;
    }

    /**
     * Refreshes the already present DynamicMessage with new data. If there is no DynamicMessage, creates a new one.
     * @returns {Promise<Message>}
     */
    edit = async (): Promise<Message> => {
        try{
            if(this.message?.editable) return await this.message.edit(this.messageContent);
        }catch(e){
            logger.error("Edit error: " + e.message);
        }

        return await this.create();
    }

    /**
     * Deletes the DynamicMessage message if exists.
     */
    delete = async (): Promise<void> => {
        try{
            if(this.message?.deletable) await this.message.delete(); 
        }catch(e){
            logger.error("Delete error: " + e.message);
        }
    }

    /**
     * Deletes the old DynamicMessage if exists, then sends a new one.
     * @returns {Promise<Message>}
     */
    resend = async (): Promise<Message> => {
        try{
            await this.delete();
            // if(this.message?.deletable) await this.message.delete();
        }catch(e){
            logger.error("Resend error: " + e.message);
        }

        return await this.create();
    }
}
