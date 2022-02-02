/* ==== Imports =========================================================================================================================== */
import { ButtonInteraction, ColorResolvable, CommandInteraction, Message, MessageEmbed, User } from "discord.js";
import axios from "axios";

import { HaramLeottaInstance } from "..";
import { Logger } from "../classes/Logger";
import { Command, Commands } from "../interfaces/CommandLogic";
import { applyAlias, capitalize } from "../utils/LogicUtils";
import { RedditPost, RedditSortBy } from "../interfaces/RedditInterfaces";
import { getPost } from "../service/RedditService";
import { deepAiApi, deepAiShortcut } from "../service/DeepAiService";
import { addFavourite, removeFavourites, updatePrefix } from "../service/UserService";
import { overlap } from "../service/OverlapService";
import { translate, translateNapoli } from "../service/TranslateService";
import { MusicPlayer } from "../classes/MusicPlayer";
import { urlRegex } from "../utils/Regex";
import { deleteMusicPlayer, getMusicPlayer, getOrCreateFavouritesNavigator, getOrCreateMusicPlayer, getOrCreateYoutubeNavigator, rispShortcut, rispShortcutNoCheck } from "../service/MusicService";
import { FavouritesNavigator } from "../classes/FavouritesNavigator";
import { Song } from "../interfaces/Song";
import { SONG_TYPES } from "../globals/SongTypes";


/* ==== Commands Handlers ================================================================================================================= */
const logicHandler: Commands<Command> = {
    /* ==== INFORMATION ================================================================================================ */
    ping: {
        name: "ping", category: "Information", description: "WebSocket ping in milliseconds",
        fn: () => `Pong! (${HaramLeottaInstance.ws.ping}ms)`
    },
    invite: {
        name: "invite", category: "Information", description: "Sends the invite link of the bot. ",
        fn: () => "Inviation link: https://discord.com/api/oauth2/authorize?client_id=803895490483322941&permissions=140227505729&scope=applications.commands%20bot"
    },
    info: {
        name: "info", category: "Information", description: "Lets the bot speak a bit about himself",
        fn: () => { return { embeds: [new MessageEmbed()
            .setColor(process.env.EMBED_COLOR as ColorResolvable)
            .setTitle("HaramLeotta informations")
            .addField("First name", "Haram", true)
            .addField("Middle name", "Ibra", true)
            .addField("Surname", "Leotta", true)
            .addField("Birthday", "December 17st, ‎2020", true)
            .addField("Version", process.env.VERSION, true)
            .setFooter(`Created by Boquobbo#5645            Special Thanks to Depa`)
            .setThumbnail(HaramLeottaInstance.user.avatarURL())
            // .setThumbnail(`https://cdn.discordapp.com/attachments/638334134388785172/807421835946754048/fumocirno3d.gif`)
        ] } }
    },
    changelog: {
        name: "changelog", category: "Information", description: "News and notes about the bot code and functionalities.",
        fn: () => { return { embeds: [new MessageEmbed()
            .setColor(process.env.EMBED_COLOR as ColorResolvable)
            .setTitle("Changelog: ")
            .addField("Youtube major fixes", "Fixed some youtube playing bugs such as 410 error and 403 error; added playlists to query results.")
            .addField("Youtube mix added", "Added automatic youtube mixes and 2 new commands: playmix (pm) and skipmix (sm).")
            .addField("Fix attempt", "Added a fix for destroyed connections and files... I hope is works.")
            .addField("Slash Commands", "Slash commands are in development and are coming soon!")
            // .addField("SoundCloud support", "Ham play now supports SoundCloud song urls!")
            .setFooter("For any suggestion or bug report feel free to DM me - Boquobbo#5645")] } }
    },
    help: {
        name: "help", category: "Information", description: "Shows the list of all commands",
        fn: (cmdName: string) => {
            const embed = new MessageEmbed().setColor(process.env.embedColor as ColorResolvable);

            if(!cmdName || !logicHandler.hasOwnProperty(cmdName))
                return { embeds: [ embed.setTitle("Haram Leotta Commands")
                    .addFields( Object.entries(categories).map( ( [key, value]) => { return { name: `${key} Commands`, value: `\`${value.join(`\`, \``)}\``} } ) ) ] };

            const { name, description, category, aliases, usage } = logicHandler[cmdName];
            embed.setTitle(`Command '${name}' help`)
                .addFields([{ name: "Category", value: category },
                            { name: "Description", value: description },
                            { name: "Usage", value: usage || "Quando ho voglia li metto" },
                            { name: "Aliases", value: aliases || "none" }])
                .setFooter("<> => required argument - [] => optional argument - | => OR")

            return { embeds: [embed] }
        }
    },

    /* ==== MESSAGES =================================================================================================== */
    echo: {
        name: "echo", category: "Messages", description: "Repeats some text. ",
        fn: () => {}
    },
    coinflip: {
        name: "coinflip", category: "Messages", description: "Lets the bot decide for you. ",
        fn: () => Math.floor(Math.random() * 2) ? ":head_bandage:" : ":cross:"
    },
    clap: {
        name: "clap", category: "Messages", description: "Claps some text. ",
        fn: (args: string[]) => {
            if(!args[0]) return;
            const clap = ' :clap_tone5: ';
            return args[1] ? args.join(clap) : [...args[0]].join(clap)  //Se ci sono più parole: :CLAP: parola - se ce n'è una: p :CLAP: a :CLAP: r :CLAP: o :CLAP: l :CLAP: a
        }
    },
    pacco: {
        name: "pacco", category: "Messages", description: "Pacco Amazon 😳",
        fn: () => ":billed_cap:\n:flushed:      :selfie_tone5:\n:coat::package:\n:shorts:\n:hiking_boot:"
    },
    sus: {
        name: "sus", category: "Messages", description: "SUS!! SUSSY BAKA!!!!",
        fn: () => {
            const a = Math.floor(Math.random() * 3);
            return !a ? "https://cdn.discordapp.com/attachments/280489952385695755/788913780934443028/video0.mov"
                : a == 2 ? "https://cdn.discordapp.com/attachments/722780815087501363/787763691658805258/p.mp4"
                : "https://cdn.discordapp.com/attachments/620576156613345310/816641727204950046/video0.mp4";
        }
    },
    prefix: {
        name: "prefix", category: "Messages", description: "Changes the bot activation prefix. ",
        fn: async (userId: string, newPrefix: string) => {
            const desc = await updatePrefix(userId, newPrefix)                             // ! Update prefix.
            .then(() => `Prefix set to \`${newPrefix}\`.`)
            .catch(() => "An error occurred - prefix unchanged.")

            return { embeds: [new MessageEmbed()
                    .setColor(process.env.EMBED_COLOR as ColorResolvable)
                    .setTitle("Prefix Settings")
                    .setDescription(desc)]
            };
        }
    },

    /* ==== IMAGES =========================================================================================== */
    pic: {
        name: "pic", category: "Images", description: "Sends the pic of a user. ",
        fn: async (user: User) => {                                 // Async per fare in modo che funzioni allo stesso modo di drip e lessgo (vedi MessageHandler)
            return { embeds: [ new MessageEmbed()                   //Creo e mando embed
            .setColor(process.env.EMBED_COLOR as ColorResolvable)
            .setAuthor(`${user.tag}`, user.avatarURL())
            .setImage(user.displayAvatarURL({ format: "png", size: 2048 })) ] }
        }
    },
    drip: {
        name: "drip", category: "Images", description: "HE REALLY BE DRIPPIN DOE",
        fn: (query: User | string) =>
            overlap("./images/sample/drip.png",
            [{ path: (query instanceof User) ? query.displayAvatarURL({ format: "png", size: 256 }) : query, xPos: 210, yPos: 80, xRes: 256, yRes: 256, round: true }])
            .then((imageUrl: string) => { return { files: [ imageUrl ] } })
    },
    lessgo: {
        name: "lessgo", category: "Images", description: "LESSGOOOOOOOOO 🧏🏿‍♂️🧏🏿‍♂️🧏🏿‍♂️",
        fn: async (query: User | string) => {
            const path = (query instanceof User) ? query.displayAvatarURL({ format: "png", size: 256 }) : query;
            return overlap("./images/sample/lessgo.png",
            [{ path, xPos: 300, yPos: 180, xRes: 350, yRes: 350, round: true }, { path, xPos: 330, yPos: 75, xRes: 50, yRes: 50, round: true }])
            .then((imageUrl: string) => { return { files: [ imageUrl ] } });
        }
    },

    /* ==== INTERNET ========================================================================================== */
    wiki: {
        name: "wiki", category: "Internet", description: "Sends the Wikipedia link (and embed) of a topic. ",
        fn: (topic: string, language: string = "en") => `https://${language}.wikipedia.org/wiki/${topic}`
    },
    weather: {
        name: "weather", category: "Internet", description: "Checks the weather everywhere in the world. ",
        fn: async (City: string) => {
            const url: string = `https://api.openweathermap.org/data/2.5/weather?q=${City}&appid=${process.env.WEATHER_TOKEN}`;
            const res: any = (await axios.get(url)).data;
            return `Weather of **${City}** (**${res.sys.country}**): **${res.weather[0].main}** (${res.weather[0].description}). \nThe temperature is **${(res.main.temp - 273.15).toFixed(2)}**°C.`    //Parso ed invio i dati
        },
    },
    "tl, translate": {
        name: "translate", category: "Internet", description: "Translates some text in another language. ", aliases: "tl",
        fn: (text: string, toLang: string, fromLang: string = "auto") => translate(text, toLang, fromLang)
    },
    giggino: {
        name: "giggino", category: "Internet", description: "Translates some text in napoletano. ",
        fn: (text: string) => translateNapoli(text)
    },
    "r, r/, reddit": {
        name: "reddit", category: "Internet", description :"Sends a post in hot from a given subreddit, if exists. ", aliases: "r, r/",
        fn: (channelId: string, subreddit: string, sortby: RedditSortBy): Promise<RedditPost> => getPost(channelId, subreddit, sortby)
    },

    /* ==== DEEPAI ============================================================================================ */
    genpic: {
        name: "genpic", category: "DeepAI", description: "Generates a picture using an artificial intelligence. ",
        fn: (query: string = "") => deepAiApi("text2img", query).then((content: string) => deepAiShortcut(query ? `Pic of "${query}"` : "Random generated pic", content))
    },
    up: {
        name: "up", category: "DeepAI", description: "Upscales a picture using articial intelligence. ",
        fn: (image_url: string = "") => deepAiApi("waifu2x", image_url).then((content: string) => deepAiShortcut("Upscaled image", content))
    },
    anime: {
        name: "anime", category: "DeepAI", description: "Toonifies someone from a photo using artificial intelligence. ",
        fn: (image_url: string = "") => deepAiApi("toonify", image_url).then((content: string) => deepAiShortcut("Toonified image", content))
    },
    colorize: {
        name: "colorize", category: "DeepAI", description: "Colorizes a black and white image using artificial intelligence. ",
        fn: (image_url: string = "") => deepAiApi("colorizer", image_url).then((content: string) => deepAiShortcut("Colorized image",  content))
    },
    dream: {
        name: "dream", category: "DeepAI", description: "Deepdream of an image. ",
        fn: (image_url: string = "") => deepAiApi("deepdream", image_url).then((content: string) => deepAiShortcut("Deepdream", content))
    },
    caption: {
        name: "caption", category: "DeepAI", description: "Describes what's in an image. ",
        fn: (imageUrl: string = "") => deepAiApi("neuraltalk", imageUrl).then((caption: string) => deepAiShortcut(capitalize(caption), imageUrl))
    },
    
    /* ==== MUSIC ============================================================================================= */
    "p, play": {
        name: "play", category: "Music", description: "Plays a song in your voice channel, loading the url or searching on YouTube. ", aliases: "p",
        fn: async (risp: Message | CommandInteraction, query: string): Promise<any> => {
            const musicPlayer : MusicPlayer = getOrCreateMusicPlayer(risp.guildId).checkVoice(risp);

            if(urlRegex.test(query)) musicPlayer?.addSongFromUrl(risp, query);
            else if(musicPlayer) getOrCreateYoutubeNavigator(risp.guildId, risp.member.user.id).start(risp, query);
        }
    },
    "pm, playmix, mix": {
        name: "playmix", category: "Music", description: "Plays a mix from a Youtube video url. ", aliases: "p",
        fn: async (risp: Message | CommandInteraction, query: string): Promise<any> => getOrCreateMusicPlayer(risp.guildId).checkVoice(risp)?.playMix(risp, query)
    },
    "s, skip": {
        name: "skip", category: "Music", description: "Skips the currently playing song. ", aliases: "s",
        fn: (risp: Message | CommandInteraction | ButtonInteraction, howMany: number = 1, UUID?: number): void => rispShortcut(risp, UUID)?.skipSongs(howMany)
    },
    "sm, skipmix": {
        name: "skip", category: "Music", description: "Skips the currently playing song. ", aliases: "s",
        fn: (risp: Message | CommandInteraction | ButtonInteraction, howMany: number = 1, UUID?: number): void => rispShortcut(risp, UUID)?.skipYoutubeMix()
    },
    "b, back": {
        name: "back", category: "Music", description: "Goes back to the recently played songs. ", aliases: "b",
        fn: (risp: Message | CommandInteraction | ButtonInteraction, howMany: number = 1, UUID?: number): void => rispShortcut(risp, UUID)?.backSongs(howMany, risp)
    },
    "rm, remove": {
        name: "remove", category: "Music", description: "Removes songs from a particular index. ", aliases: "rm",
        fn: (risp: Message | CommandInteraction, index: number = 0, howMany: number = 1): Promise<any> | void => rispShortcut(risp)?.removeSongs(index, howMany)
    },
    "ps, pause": {
        name: "pause", category: "Music", description: "Pauses the currently playing song. ", aliases: "ps",
        fn: (risp: Message | CommandInteraction | ButtonInteraction, UUID?: number): Promise<any> => rispShortcut(risp, UUID)?.pauseSong()
    },
    "rs, resume": {
        name: "resume", category: "Music", description: "Resumes the currently paused song. ", aliases: "rs",
        fn: (risp: Message | CommandInteraction | ButtonInteraction, UUID?: number): Promise<any> => rispShortcut(risp, UUID)?.resumeSong()
    },
    "clear, stop": {
        name: "clear", category: "Music", description: "Cleares the music queue and kicks the bot from the voice channel. ",
        fn: (risp: Message | CommandInteraction | ButtonInteraction, UUID?: number): Promise<boolean> => rispShortcut(risp, UUID)?.reset().then(() => deleteMusicPlayer(risp.guildId))    // Delete instance, clear memory
    },
    "l, leave": {
        name: "leave", category: "Music", description: "Kicks the bot out from the voice channel, but doesn't clear the current queue and other informations. ", aliases: "l",
        fn: (risp: Message | CommandInteraction): void => rispShortcut(risp)?.leave()
    },
    "j, join": {
        name: "join", category: "Music", description: "The bot will join your voice channel. If there's something in the queue, it will play. ", aliases: "j",
        fn: (risp: Message | CommandInteraction): Promise<void> | void => rispShortcut(risp)?.tryToPlay(risp)
    },
    "lp, loop": {
        name: "loop", category: "Music", description: "Changes the state of the loop of the music queue netween none, loop-song and loop-queue. ", aliases: "lp",
        fn: (risp: Message | CommandInteraction | ButtonInteraction, UUID?: number): Promise<Message> => rispShortcut(risp, UUID)?.switchLoop()
    },
    "sh, shuffle": {
        name: "shuffle", category: "Music", description: "Shuffles the songs in the queue. ", aliases: "sh",
        fn: (risp: Message | CommandInteraction): void => rispShortcut(risp)?.shuffle()
    },
    bind: {
        name: "bind", category: "Music", description: "Binds the music bot to the current channel. ",
        fn: (risp: Message | CommandInteraction): void => rispShortcut(risp)?.bindTextChannel(risp.channel)
    },
    "np, nowplaying": {
        name: "nowplaying", category: "Music", description: "Shows informations about the current song. ", aliases: "np",
        fn: (risp: Message | CommandInteraction): Promise<any> => rispShortcutNoCheck(risp)?.resendQueueDynamicMessage()
    },
    "q, queue": {
        name: "queue", category: "Music", description: "Shows informations about all the songs in the current queue. ", aliases: "q",
        fn: (risp: Message | CommandInteraction): Promise<any> => rispShortcutNoCheck(risp)?.navigator(risp.channel)
    },
    "v, volume": {
        name: "volume", category: "Music", description: "Changes the volume of the music. Default: 1. ", aliases: "v",
        fn: (risp: Message | CommandInteraction, volum: string): void => {
            if(/[0-9]{0,2}(\.[0-9])?/.test(volum)) rispShortcut(risp)?.setVolume(parseFloat(volum));
        }
    },

    "f, favs, favourites": {
        name: "favourites", category: "Music", description: "Allows operations concerning the favourite music playlist, such as add songs or show the list. ", aliases: "f, favs",
        fn: (risp: Message | CommandInteraction, subOperation: string, indexORhowMany: number = 0, howMany: number = 1): Promise<any> => {
            const serverUserFavourites: FavouritesNavigator = getOrCreateFavouritesNavigator(risp.guildId, risp.member.user.id);
            if(!subOperation) return serverUserFavourites.start(risp);
            if(subOperation == "add") {
                const musicPlayer: MusicPlayer = getMusicPlayer(risp.guildId);
                if(musicPlayer) {
                    const song: Song = musicPlayer.getCurrentSong();
                    if(song.type == SONG_TYPES.YOUTUBE_MIX) song.type = SONG_TYPES.YOUTUBE;
                    return addFavourite(risp.member.user.id, song);
                }

            } else if(subOperation == "remove" || subOperation == "rm")
                return removeFavourites(risp.member.user.id, indexORhowMany - 1, howMany);

            else if(subOperation == "play" || subOperation == "p")
                return getOrCreateMusicPlayer(risp.guildId).checkVoice(risp)?.playUserFavourites(risp, indexORhowMany);
        }
    }
};





/* ==== POST PROCESSING - Generates help message and creates synonyms ===================================================================== */
interface categories { [index: string]: string[] }
const categories: categories = {};

for(const { name, category } of Object.values(logicHandler)){
    if(category)
        if(categories[category])    categories[category].push(name);
        else                        categories[category] = [name];
}

applyAlias(logicHandler);
export { logicHandler };