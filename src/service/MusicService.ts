/* ==== Imports =========================================================================================================================== */
import { ButtonInteraction, CommandInteraction, Message } from "discord.js";
import { FavouritesNavigator } from "../classes/FavouritesNavigator";
import { MusicPlayer } from "../classes/MusicPlayer";
import { YoutubeNavigator } from "../classes/YoutubeNavigator";
import { logicHandler } from "../commands/LogicHandler";
import { YT_RESULT_TYPES } from "../globals/SongTypes";

/* ==== Interfaces ======================================================================================================================== */
interface MusicPlayerMap<MusicPlayer> { [guildId: string]: MusicPlayer; }
interface YoutubeNavigatorMap<YoutubeNavigator> { [serverIduserId: string]: YoutubeNavigator; }
interface FavouritesNavigatorMap<FavouritesNavigator> { [guildId: string]: FavouritesNavigator; }

/* ==== Maps ============================================================================================================================== */
const musicPlayerMap: MusicPlayerMap<MusicPlayer> = {};
const youtubeNavigatorMap: YoutubeNavigatorMap<YoutubeNavigator> = {};
const favouritesNavigatorMap: FavouritesNavigatorMap<FavouritesNavigator> = {};

/* ==== Constants ========================================================================================================================= */
export const youtubePlaylist = /^https:\/\/(www.)?youtube.com\/playlist\?list=([0-9a-zA-Z_-]{18,41})$/;  //18
export const spotifyPlaylistAlbum = /^https:\/\/open.spotify.com\/(playlist|album)\/.{22}(\?.*)?$/;
export const spotifySong = /^https:\/\/open.spotify.com\/track\/.{22}(\?.*)?$/;
export const youtubeMix = /^https:\/\/((www.youtube.com\/watch)|(youtu.be\/))+.*list=RD.+/;
export const youtubeVideo = /^https:\/\/((www.youtube.com\/watch\?v=)|(youtu.be\/))+.*/;
export const soundcloudSong = /^https:\/\/soundcloud.com\/.+\/.+$/;
export const yewtubeVideo = /^https:\/\/yewtu.be\/.*/;
export const shortYoutubeVideo = /^https:\/\/(youtu.be\/)+.*/;


/* ==== MusicPlayer - Queue =============================================================================================================== */
export const getMusicPlayer = (guildId: string): MusicPlayer => musicPlayerMap[guildId];
export const deleteMusicPlayer = (guildId: string): boolean => delete musicPlayerMap[guildId];

export const getOrCreateMusicPlayer = (guildId: string): MusicPlayer => {
    if(!musicPlayerMap[guildId]) musicPlayerMap[guildId] = new MusicPlayer();
    return musicPlayerMap[guildId];
}

export const rispShortcut = (risp: Message | CommandInteraction | ButtonInteraction, UUID: number = null) => {
    if(risp instanceof ButtonInteraction) risp.deferUpdate();
    return getMusicPlayer(risp.guildId)?.checkVoiceAndUUID(risp, UUID);
}

export const rispShortcutNoCheck = (risp: Message | CommandInteraction | ButtonInteraction) => {
    if(risp instanceof ButtonInteraction) risp.deferUpdate();
    return getMusicPlayer(risp.guildId);
}

export const queueShortcut = (risp: ButtonInteraction, UUID: number) => {
    risp.deferUpdate();
    return getMusicPlayer(risp.guildId)?.checkUUID(UUID);
}

/* ==== YoutubeNavigator ================================================================================================================== */
export const getYoutubeNavigator = (searcherId: string): YoutubeNavigator => youtubeNavigatorMap[searcherId];
export const deleteYoutubeNavigator = (interaction: Message | ButtonInteraction): boolean => delete youtubeNavigatorMap[interaction.guildId + interaction.member.user.id];
export const getOrCreateYoutubeNavigator = (guildId: string, userId: string): YoutubeNavigator => {
    const id: string = guildId + userId;
    if(!youtubeNavigatorMap[id]) youtubeNavigatorMap[id] = new YoutubeNavigator();
    return youtubeNavigatorMap[id];
}
export const checkYoutube = (msg: Message): Promise<void> => {
    const searcherId: string = msg.guildId + msg.member.user.id;
    const youtuberNavigator: YoutubeNavigator = youtubeNavigatorMap[searcherId]?.check(msg.member.user.id);
    if(!youtuberNavigator) return null;

    const index: number = parseInt(msg.content);
    if(isNaN(index) || index < 1 || index > youtuberNavigator.videos.length) return null;

    youtuberNavigator.deleteDynamicMessage().then(() => deleteYoutubeNavigator(msg));
    const result = youtuberNavigator.videos[index-1];
    
    // In base al tipo di risultato, crea un url differente
    return logicHandler["p"].fn(msg, (result.type === YT_RESULT_TYPES.PLAYLIST ? "https://www.youtube.com/playlist?list=" : "https://www.youtube.com/watch?v=") + result.id);
}

export const youtubeNavigatorShortcut = (risp: ButtonInteraction, UUID: number) => {
    risp.deferUpdate();
    return getYoutubeNavigator(risp.guildId + risp.member.user.id)?.check(risp.member.user.id, UUID);
}

/* ==== FavouritesNavigator ============================================================================================================= */
export const getFavouritesNavigator = (searcherId: string): FavouritesNavigator => favouritesNavigatorMap[searcherId];
export const deleteFavouritesNavigator = (interaction: Message | ButtonInteraction): boolean => delete favouritesNavigatorMap[interaction.guildId + interaction.member.user.id];
export const getOrCreateFavouritesNavigator = (guildId: string, userId: string): FavouritesNavigator => {
    const id: string = guildId + userId;
    if(!favouritesNavigatorMap[id]) favouritesNavigatorMap[id] = new FavouritesNavigator();
    return favouritesNavigatorMap[id];
}

export const favouritesNavigatorShortcut = (risp: ButtonInteraction, UUID: number) => {
    risp.deferUpdate();
    return getFavouritesNavigator(risp.guildId + risp.member.user.id)?.check(risp.member.user.id, UUID);
}