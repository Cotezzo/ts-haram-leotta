/* ==== Imports =========================================================================================================================== */
import { Interaction, Message, MessageReaction, VoiceState } from "discord.js";

import { ButtonInteractionHandler } from "../commands/ButtonInteractionHandler";

import { logicHandler } from "../commands/LogicHandler";
import { Event } from "../interfaces/Event"
import { dictFlagsLangs, flagRegex } from "../utils/Regex";
import { emojiCountryCode } from "../service/TranslateService";
import { ClassLogger } from "../classes/Logger";
import { getPrefix } from "../service/UserService";
import { checkYoutube, getMusicPlayer } from "../service/MusicService";
import { MusicPlayer } from "../classes/MusicPlayer";
import { HaramLeottaInstance } from "..";
import { CommandInteractionHandler } from "../commands/CommandInteractionHandler";
import { SelectMenuInteractionHandler } from "../commands/SelectMenuInteractionHandler";
import { MessageHandler } from "../commands/MessageHandler";

const logger = new ClassLogger("ReactionHandler");

/* ==== Events ============================================================================================================================ */
export const toListenEvents: Event[] = [
    {   // On server built-in commands interaction (first call)
        name: "interactionCreate",
        fn: (interaction: Interaction) => {
            if(interaction.isCommand()) return CommandInteractionHandler(interaction);                          // Handle command and output
            if(interaction.isButton()) return ButtonInteractionHandler(interaction);                            // Handle buttons call (new reactions)
            if(interaction.isSelectMenu()) return SelectMenuInteractionHandler(interaction);                    // Handle menu call (scroll list)
        }
    },
    {   // Event triggered on every text message
        name: "messageCreate",
        fn: async (msg: Message) => {
            if(msg.author.bot) return;                                                                          // Bot message: reject
            if(checkYoutube(msg)?.catch(e => logger.error("YoutubeNavigator selection error: " + e))) return;   // Check if the user is choosing a track from the YoutubeNavigator
            const PREFIX: string = await getPrefix(msg.author.id) || process.env.PREFIX;                        // Get user prefix
            
            const lowerCaseContent = msg.content.toLowerCase();
            if (!lowerCaseContent.startsWith(PREFIX)){                                                          // No prefix: reject - Start searching for insults
                
                // Controlla prima l'intero messaggio
                switch(lowerCaseContent){
                    case "bot di merda":        return msg.channel.send(`Ma tu sei una merda`);
                    case "baba":                return msg.channel.send(`boey`);
                    case "good bot":            return msg.channel.send(`: )`);
                    case "bad bot":             return msg.channel.send(`: (`);
                    case "per il meme":         return msg.channel.send(`<@192312520567029760>`);
                }

                return lowerCaseContent.split(/[\n ]+/).some(word => {                                                 //Ciclo per ogni parola, per non controllare tutto il contenuto ogni volta
                    switch(word){
                        case "grazie":              return msg.channel.send(`grazie al cazzo`);
                        case "coglione":            return msg.channel.send(`Ma coglione a chi, figlio di puttana?`);
                        case "zitto": case "taci":  return msg.channel.send(`Chiudi quella cazzo di bocca, ti prego...`);
                        case "bot":                 return msg.channel.send(`Cazzo vuoi?`);
                        case "suca":                return msg.channel.send(`melo`);
                        case "lol":                 return msg.channel.send(`Cazzo ridi che domani muori`);
                        case "beasty":              return msg.channel.send(`per il meme`);

                        //Se contiene una parola haram, react "🇭🇦🇷🅰️🇲"
                        case "mortadella": case "pork": case "madonna": case "boobs": case "hamburger": case "gesù": case "bacon":
                        case "salume": case "santa": case "christmas": case "natale": case "sex": case "pig": case "porco": case "maiale":
                        case "prosciutto": case "salame": case "haram": case "sesso": case "porchetta": case "speck": case "pancetta": case "dio":
                            msg.react('🇭').catch(() => {});
                            msg.react('🇦').catch(() => {});
                            msg.react('🇷').catch(() => {});
                            msg.react('🅰️').catch(() => {});
                            msg.react('🇲').catch(() => {});
                    }
                });
            }
            
            msg.content = msg.content.substring(PREFIX.length + (msg.content.charAt(PREFIX.length) == " " ? 1 : 0));

            MessageHandler(msg);                                                                                // Handle command and output
        }
    },
    {
        name: "messageReactionAdd",
        fn: (msgReaction: MessageReaction) => {
            const emoji = msgReaction.emoji.name;
            if (flagRegex.test(emoji)) {

                logger.info(`- ${msgReaction.message.guild.name} - Translation request (${msgReaction.message.content}) to ${emoji}`);

                // Translate
                const toLang = dictFlagsLangs[emojiCountryCode(emoji)];
                if(!toLang) return;
                logicHandler["translate"].fn(msgReaction.message.content.replace(/[\n ]+/, " "), toLang)
                .then((text: string) => msgReaction.message.reply(emoji + " " + text))
                .catch((e: Error) => logger.error("Translation error: " + e.message));
            }
            // if( emoji == "🏴‍☠️") msgReaction.message.reply(emoji + " " + (await logicHandler["giggino"].fn(msgReaction.message.content.replace(/[\n ]+/, " "))).substring(2));
        }
    },
    // {
    //     name: "voiceStateUpdate",
    //     fn: (oldState: VoiceState, newState: VoiceState) => {
    //         const guildId: string = oldState.guild.id;
    //         const musicPlayer : MusicPlayer = getMusicPlayer(guildId);

    //         if(oldState.member.id === HaramLeottaInstance.user.id && musicPlayer && musicPlayer?.voiceChannel.id !== newState.channelId)
    //             musicPlayer.voiceChannel = newState.channel;
    //     }
    // },
    {
        name: "voiceStateUpdate",
        fn: (oldState: VoiceState, newState: VoiceState) => {
            if(oldState.id !== HaramLeottaInstance.user.id) return;

            const musicPlayer : MusicPlayer = getMusicPlayer(oldState.guild.id);

            if(!musicPlayer) return;
            
            if(!newState.channelId) return musicPlayer?.reset();
            if(musicPlayer.voiceChannel && newState.channelId !== musicPlayer.voiceChannel.id) musicPlayer.voiceChannel = newState.channel;
        }
    }
];