/* ==== Imports =========================================================================================================================== */
import { ButtonInteraction, ColorResolvable, CommandInteraction, GuildMember, Message, EmbedBuilder, StageChannel, TextBasedChannel, VoiceChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle, Colors } from "discord.js";
import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, DiscordGatewayAdapterCreator, joinVoiceChannel, StreamType, VoiceConnection } from "@discordjs/voice";
import ytdl from "ytdl-core";
// import ytdl from "ytdl-core-discord";
import axios from "axios";
import he from "he";
import { ClassLogger } from "./Logger";
import { DynamicMessage } from "./DynamicMessage";
import { Song } from "../interfaces/Song";
import { SONG_TYPES } from "../globals/SongTypes";


import { promisify } from "util";
import { getFirstYoutubeResults, getYoutubeMixIds, getYoutubePlaylistFull, getYoutubeVideoId } from "../service/YoutubeService";
import { getFavourites } from "../service/UserService";
import { file } from "../utils/Regex";
import { formatSchifo, secondsToString, stringToSeconds } from "../utils/StringFormatUtils";
import { getSoundCloudSong, getSoundCloudStream, getSpotifySongMetadata, getYewtubeSong, getYewtubeStream, YEWTUBE_ROOT } from "../utils/MusicUtils";
import { soundcloudSong, spotifyPlaylistAlbum, spotifySong, yewtubeVideo, youtubeMix, youtubePlaylist, youtubeVideo } from "../service/MusicService";
const wait = promisify(setTimeout);



const logger = new ClassLogger("MusicPlayer");

interface CurrentSong {
    index: number;                  // Index on the songs array of the current song

    startTime?: number;
    pauseTime?: number;
}

/* ==== Class ============================================================================================================================= */
export class MusicPlayer {
    private static MAX_HISTORY = parseInt(process.env.MUSIC_MAX_HISTORY);

    // TODO: on voice channel changed, update this.voiceChannel
    public voiceChannel: VoiceChannel | StageChannel;      // The current voiceChannel the bot is in
    private connection: VoiceConnection;                    // Voice connection events handler
    private player: AudioPlayer;                            // Music player
    private resource: AudioResource<null>;                  // Resource - stream that is being played

    private songQueue: Song[];                              // Array with all the songs and their informations
    private currentSongIndex: number;
    private goNext: boolean;                                // Used for the backSongs command, to avoid skipping songs

    private loop: number;                                   // 0: none, 1: loop one, 2: loop playlist.
    private volume: number;                                 // Float

    private textChannel: TextBasedChannel;                 // Where to log / send all the interfaces
    private queueDynamicMessage: DynamicMessage;            // main player message handler
    private logDynamicMessage: DynamicMessage;              // addsong logging message handler
    private navigatorDynamicMessage: DynamicMessage;        // -queue navigator message handler
    private navPage: number;                                // -queue navigator page
    private UUID: number;                                   // Unique indentifier user to identify ButtonInteractions

    /* ==== Constructor ========== */
    public constructor() {
        this.initializeVariables();
        // Player state change notify
        this.player.on("stateChange", (_, newState) => logger.info("Player state changed to " + newState.status));

        // Player error notify
        this.player.on("error", e => {
            logger.error("Player error: " + e)
            if(e.toString().endsWith("403")) this.goNext = false;
        });

        // On song finish
        this.player.on(AudioPlayerStatus.Idle, async () => {
            const song: Song = this.getCurrentSong();
            if(song && song.type !== SONG_TYPES.YOUTUBE_MIX) {
                if (this.goNext) {                                                                          // If you can skip normally
                    if (this.loop === 2) this.addSong(...this.songQueue.splice(this.currentSongIndex, 1)); // Loop-playlist:  re-queue the last song played
                    if (!this.loop)                                                                         // No loop: normally skip the played song
                        if (this.currentSongIndex === MusicPlayer.MAX_HISTORY) this.songQueue.shift();     // If the history is full, remove the song at the start of the queue
                        else this.currentSongIndex++;                                                      // Else, increment the index          
                }
            }
            this.goNext = true;                                                                         // Set the skipping back to default
            this.tryToPlay();                                                                                // Loop-song: don't skip and play the next (same, index unchanged) song
        });

        logger.info("New instance created and listening on AudioPlayer events");
    }

    private initializeVariables = (): void => {
        this.UUID = Date.now();                                         // Initialize UUID for this session
        this.player = createAudioPlayer();                              // Brand new AudioPlayer

        this.songQueue = [];                                            // New empty songs queue
        this.currentSongIndex = 0;                                      // Set song 0 as the current song
        this.goNext = true;                                             // By default, skip songs normally
        this.volume = 1;                                                // By default, volume is 1
        this.loop = 0;                                                  // By default, don't loop

        this.logDynamicMessage = new DynamicMessage();                  // Create addsong logging interface with the new UUID
        this.queueDynamicMessage = new DynamicMessage(this.UUID);       // Create main player interface with the new UUID
        this.navigatorDynamicMessage = new DynamicMessage(this.UUID);   // Create navigator interface with the new UUID

        this.connection = undefined;
        this.resource = undefined;
        this.textChannel = undefined;
        this.voiceChannel = undefined;
    }

    public reset = async (): Promise<void> => {
        logger.debug("fn:reset started");

        this.songQueue = [];
        this.player?.stop(true);

        try{
            this.connection?.disconnect();
            this.connection?.destroy();
        } catch(e){}

        await this.logDynamicMessage?.delete();
        await this.navigatorDynamicMessage?.delete();
        await this.queueDynamicMessage?.delete();

        this.initializeVariables();
    }


    /* ==== Core =================== */
    /**
     * Adds a song to the songs array.
     * @param {Song} song 
     */
    public addSong = (...songs: Song[]): number => {
        logger.debug(`fn:addSong started [songs: ${songs}]`);

        return this.songQueue.push(...songs)
    }

    public getCurrentSong = () => {
        logger.debug(`fn:getCurrentSong started [currentSongIndex: ${this.currentSongIndex}]`);

        return this.songQueue[this.currentSongIndex];
    }

    /**
     * Function to call wheter the queue is changed, so that the bot can try to connect to the voice channel and play music if it's not doing it.
     * @param {Message | CommandInteraction} risp 
     */
    public tryToPlay = (risp?: Message | CommandInteraction | ButtonInteraction): Promise<any> | void => {
        logger.debug(`fn:tryToPlay started [risp?: ${!!risp}]`);

        if (this.isPlaying()) return this.editQueueDynamicMessage();        // Edit if something is already playing (to avoid play() interface overlap and bugs)

        // If risp is given, update properties
        if(risp){
            if (!(risp.member instanceof GuildMember)) return;              // To avoid errors in the next line
            if (!this.textChannel) this.bindTextChannel(risp.channel);      // Bind new textChannel if it doesn't exist
            this.voiceChannel = risp.member.voice?.channel;                 // If nothing is playing, set the voiceChannel to the new one                                                                         
        }

        // If the connection is in idle (the connection exists but is not playing), play - else connect, if the connection is successfull, play.
        if (this.connection && this.player?.state.status === "idle") return this.play();

        // If the connection is up return - else, instance new connection and play
        const isConnectionDestroyed = this.connection?.state.status == "destroyed";
        if(isConnectionDestroyed) {
            // this.connection.destroy();
            this.connection.disconnect();
            this.connection = undefined;
        } else if (this.connection) return;

        // Instance new connection
        this.connection = joinVoiceChannel({ channelId: this.voiceChannel.id, guildId: this.voiceChannel.guildId, adapterCreator: (this.voiceChannel.guild.voiceAdapterCreator as unknown as DiscordGatewayAdapterCreator) });

        // Listeners
        this.connection.on("error", () => logger.warn("Connection error"))
        logger.info("Listening on connection event 'error'");

        this.connection.on("stateChange", async (_, newState) => {
            logger.info("Connection state changed to " + newState.status);
            /**
            // Handle disconnection
            if (newState.status === VoiceConnectionStatus.Disconnected) {
                if (newState.reason === VoiceConnectionDisconnectReason.WebSocketClose && newState.closeCode === 4014) {
                    /*  If the WebSocket closed with a 4014 code, this means that we should not manually attempt to reconnect, but there is a chance the connection will recover
                        itself if the reason of the disconnect was due to switching voice channels. This is also the same code for the bot being kicked from the voice channel,
                        so we allow 5 seconds to figure out which scenario it is. If the bot has been kicked, we should destroy the voice connection.
                    *\/
                    try {
                        await entersState(this.connection, VoiceConnectionStatus.Connecting, 5_000);    // Probably moved voice channel
                    } catch {
                        this.connection.destroy();                                                      // Probably removed from voice channel
                    }
                } else if (this.connection.rejoinAttempts < 5) {    		                            // Disconnect is recoverable, and we have <5 repeated attempts so we will reconnect.
                    await wait((this.connection.rejoinAttempts + 1) * 5_000);
                    this.connection.rejoin();
                } else this.connection.destroy();                                                       // Disconnect may be recoverable, but we have no more remaining attempts - destroy.			
            } else if (newState.status === VoiceConnectionStatus.Destroyed) logger.warn("Connection destroyed");   // Once destroyed, stop the subscription
            */
        });

        logger.info("Listening on connection event 'stateChange'");

        return this.play();
    }

    /**
     * Grabs the current song and plays it if exists
     */
    private play = async (): Promise<void> => {
        logger.debug(`fn:play started`);

        if (this.isPlaying()) return;                               // If there's a song playing, return

        let song: Song = this.getCurrentSong();                     // Get the current song (the one that should be played)

        logger.debug(`song: ${JSON.stringify(song)}`);

        if (!song) {                                                // If no song is in position (queue is "empty", not counting history)
            this.logDynamicMessage?.delete();                       // Delete remaining interfaces and return
            this.queueDynamicMessage?.delete();                     // Don't clear the object since we still have the history and other options
            return;
        }
        
        try {
            if (song.type === SONG_TYPES.SPOTIFY) {                 // Overwrite TYPE.SPOTIFY song with TYPE.YOUTUBE new song
                song = { requestor: song.requestor, ...await this.getFirstYoutubeResult(song.title) };
                this.songQueue[this.currentSongIndex] = song;
            }

            let stream: string | any;   // string | Readable
            switch (song.type) {
                case SONG_TYPES.YOUTUBE:
                    stream = ytdl(song.url, { begin: song.begin || 0, filter: "audioonly", quality: "highestaudio", highWaterMark: 1048576 * 32 });
                    break;

                case SONG_TYPES.SOUNDCLOUD:
                    stream = await getSoundCloudStream(song.url);
                    break;

                case SONG_TYPES.YEWTUBE:
                    stream = await getYewtubeStream(song.url);
                    break;
    
                case SONG_TYPES.YOUTUBE_MIX:
                    let video;
                    do {
                        if(song.mixQueue.length === 1) song.mixQueue = await getYoutubeMixIds(song.mixQueue.shift(), song.mixId);
                        video = song.mixQueue.shift()
                    } while(song.mixPlayedMap.has(video.id));
                    song.mixPlayedMap.add(video.id);

                    song.url = `https://www.youtube.com/watch?v=${video.id}&list=RD${song.mixId}`;
                    song.title = video.title;
                    song.thumbnail = video.thumbnail;
                    song.lengthSeconds = stringToSeconds(video.lengthString);
                    song.lengthString = video.lengthString;

                    stream = ytdl(song.url, { begin: song.begin || 0, filter: "audioonly", quality: "highestaudio", highWaterMark: 1048576 * 32 });

                    break;
            
                default:
                    stream = song.url;
                    break;
            }
            this.resource = createAudioResource(stream, { inlineVolume: true, inputType: StreamType.Arbitrary }); // Create resource with stream retrieved.
        } catch (e) {                                               // On error
            logger.error("Stream creation error: " + e);
            this.songQueue.splice(this.currentSongIndex, 1);       // Remove the current song (removeSongs cannot be used because is made for user-friendly input)
            return this.play();                                     // And start this function again
        }

        this.setVolume();                                           // Set the volume of the new stream
        this.player.play(this.resource);                            // Actually start the new stream/resource on the player
        this.connection.subscribe(this.player);                     // Apply the player to the connection (??)

        this.textChannel.messages.fetch({ limit: 1 }).then(msg => {                                                 // DynamicMessage update
            if (msg.first().id != this.queueDynamicMessage.message?.id) return this.resendQueueDynamicMessage();    // If the last message isn't the interface, resend it
            this.editQueueDynamicMessage();                                                                         // Else, edit it
        }).catch(e => logger.error("QueueDynamicMessage refresh error: " + e));   // I think the vars change while the embed is generating, so it crashes if the song is undefined... Avoid crashes
    }


    public leave = (): void => {
        logger.debug(`fn:leave started`);
        this.connection?.destroy();
    }

    /* ==== Add Songs ============= */
    public addSongFromUrl = async (risp: Message | CommandInteraction, url: string): Promise<void> => {
        logger.debug(`fn:addSongFromUrl started [url: ${url}]`);

        const oldLen: number = this.songQueue.length;                                               // Queue length before inserting new songs
        const oldDurationSeconds: number = this.getDurationSeconds();                               // Queue duration before inserting new songs
        const requestor: string = risp.member.user.id;                                              // Id of the user who started the procedure

        try {
            if(youtubeMix.test(url)) {
                await this.playMix_(risp, url);
            }

            else if (youtubeVideo.test(url)) {                                                           // Add song from youtube video
                const { title, lengthSeconds, thumbnail } = (await ytdl.getBasicInfo(url)).player_response.videoDetails as any;

                const song: Song = { title, url, thumbnail: thumbnail.thumbnails.pop().url, lengthSeconds: +lengthSeconds, lengthString: secondsToString(+lengthSeconds), type: SONG_TYPES.YOUTUBE, requestor };

                this.addSongLog(risp.channel, song);
                this.addSong(song);
            }

            else if (youtubePlaylist.test(url)) {                                                   // Add songs from youtube playlist
                const playlistId = url.substring(url.lastIndexOf("=") + 1);                         // Get playlist Id from link
                const { items, metadata } = await getYoutubePlaylistFull(playlistId);                      // Get playlist data (video, metadata)

                for (const { title, id, lengthSeconds, lengthString, thumbnail: { thumbnails } } of items)
                    if (lengthSeconds && lengthString)                                              // For every song retrieved, check for the attributes //! I don't remember why
                        this.addSong({ title, url: `https://www.youtube.com/watch?v=${id}`, thumbnail: thumbnails.pop().url, lengthString, lengthSeconds: +lengthSeconds, type: SONG_TYPES.YOUTUBE, requestor });

                this.addPlaylistLog(risp.channel, this.songQueue.length - oldLen, metadata.playlistMetadataRenderer.title, url, secondsToString(this.getDurationSeconds() - oldDurationSeconds), requestor, oldLen, oldDurationSeconds, items[0].thumbnail.thumbnails.pop().url);
            }

            else if (spotifySong.test(url)) {                                                                // TODO: Populate url when the spotify song object gets played
                const ind = url.indexOf("?");
                const spotifySongID = url.substring(url.lastIndexOf("/") + 1, ind >= 0 ? ind : url.length);  // Get song Id from link
                const { song, spotifyUrl } = await getSpotifySongMetadata(spotifySongID);               // Get Spotify metadata
                song.requestor = requestor;
                this.addSongLog(risp.channel, { url: spotifyUrl, ...song });
                this.addSong(song);
            }

            else if (spotifyPlaylistAlbum.test(url)) {                                                      // TODO: Populate url when the spotify song object gets played
                url = url.substring(8);
                const ind = url.indexOf("?");
                const spotifyPlaylistID = url.substring(url.lastIndexOf("/") + 1, ind >= 0 ? ind : url.length);

                const { addedSongs, playlistDuration, playlistTitle, playlistUrl, playlistThumbnail } = await this.getSpotifyPlaylistAlbumMetadata(spotifyPlaylistID, requestor, url.includes("album"));

                await this.addPlaylistLog(risp.channel, addedSongs, playlistTitle, playlistUrl, secondsToString(playlistDuration), requestor, oldLen, oldDurationSeconds, playlistThumbnail);
            }

            // DOING: SOUNDCLOUD
            else if (soundcloudSong.test(url)) {
                const song: Song = await getSoundCloudSong(url);
                song.requestor = requestor;

                this.addSongLog(risp.channel, song);
                this.addSong(song);
            }

            // Youtube 410 error fallback
            else if (yewtubeVideo.test(url)) {
                const song: Song = await getYewtubeSong(url);
                song.requestor = requestor;

                this.addSongLog(risp.channel, song);
                this.addSong(song);
            }

            else if (file.test(url)) {                                                                      // Normal file
                const song: Song = { title: url.substring(url.lastIndexOf('/') + 1), url, type: SONG_TYPES.FILE, lengthString: "unknown", lengthSeconds: 0, requestor };

                this.addSongLog(risp.channel, song);
                this.addSong(song);
            }

            else return;                                                                                    // Nothing
        } catch (e) {
            logger.error(`Couldn't add the song from "${url}" ` + e.message);

            if(e.statusCode === 410)
                this.addSongFromUrl(risp, `${YEWTUBE_ROOT}watch?v=${url.split("=", 2)[1].split("&", 1)[0]}`);

            return; // Error on url request (I guess);
        }

        this.tryToPlay(risp);                                                                               // If the add was successful, try to play something
    }

    public playMix = async (risp: Message | CommandInteraction, url: string): Promise<void> => {
        logger.debug(`fn:playMix started [url: ${url}]`);

        if(!youtubeVideo.test(url)) return;
        await this.playMix_(risp, url);
        this.tryToPlay(risp);
    }

    private playMix_ = async (risp: Message | CommandInteraction, url: string): Promise<void> => {
        logger.debug(`fn:playMix_ started [url: ${url}]`);

        const videoId = getYoutubeVideoId(url);
        const { title, lengthSeconds, thumbnail } = (await ytdl.getBasicInfo(url)).player_response.videoDetails as any;
        const song: Song = { title, url, thumbnail: thumbnail.thumbnails.pop().url, lengthSeconds: +lengthSeconds, lengthString: secondsToString(+lengthSeconds),
            requestor: risp.member.user.id, type: SONG_TYPES.YOUTUBE_MIX };

        try{
            console.log(videoId);
            song.mixQueue = await getYoutubeMixIds(videoId, videoId);
            song.mixPlayedMap = new Set<string>();
            song.mixId = videoId;
            this.addSongMixLog(risp.channel, song);
        } catch (e) {
            console.log(e);
            song.type = SONG_TYPES.YOUTUBE;
            this.addSongLog(risp.channel, song);
        }

        this.addSong(song);
    }

    /* ==== HARDCODED MUSICUTILS ============================================================================ */
    public getYoutubeMixSong = async (risp: Message | CommandInteraction, url: string): Promise<any> => {
        logger.debug(`fn:getYoutubeMixSong started [url: ${url}]`);

        if (!youtubeVideo.test(url)) return;
        const videoId = getYoutubeVideoId(url);
        const { title, lengthSeconds, thumbnail } = (await ytdl.getBasicInfo(url)).player_response.videoDetails as any;
        const song: Song = { title, url, thumbnail: thumbnail.thumbnails.pop().url, lengthSeconds: +lengthSeconds, lengthString: secondsToString(+lengthSeconds),
            type: SONG_TYPES.YOUTUBE_MIX, requestor: risp.member.user.id, mixId: videoId, mixPlayedMap: new Set<string>(), mixQueue: await getYoutubeMixIds(videoId, videoId) };

        this.addSongMixLog(risp.channel, song);
        this.addSong(song);
    }

    /**
     * Retrieves the list of favourites of the user and plays the ith element (or the entire playlist if it is not specified)
     * @param risp
     * @param index
     * @returns {Promise<void>}
     */
    public playUserFavourites = async (risp: Message | CommandInteraction, index: number): Promise<void> => {   // Same concept of AddSongFromUrl (add, tryToPlay)
        logger.debug(`fn:playUserFavourites started [index: ${index}]`);

        const oldLen: number = this.songQueue.length;                                                           // Queue length before inserting new songs
        const oldDurationSeconds: number = this.getDurationSeconds();                                           // Queue duration before inserting new songs
        const requestor: string = risp.member.user.id;

        const songs: Song[] = await getFavourites(risp.member.user.id);                                         // Get favourite songs of the user
        if (!songs.length || index > songs.length) return;

        if (index) {                                                                                            // If the user specified which song to play
            const song: Song = { requestor, ...songs[index - 1] };                                              // Get the song, add requestor Id
            this.addSongLog(risp.channel, song);
            this.addSong(song);
        } else {                                                                                                // Else, add the entire playlist to the queue
            for (const song of songs)                                                                           // For every favourite song
                this.addSong({ requestor, ...song });                                                           // Get the song, add requestor Id

            this.addPlaylistLog(risp.channel, this.songQueue.length - oldLen, "Favourite songs playlist", "", secondsToString(this.getDurationSeconds() - oldDurationSeconds), requestor, oldLen, oldDurationSeconds, "");
        }

        this.tryToPlay(risp);                                                                                   // If the add was successful, try to play something
    }

    /**
     * Given an album or a playlist, returns a list of Song objects with all the metadata of the contained songs.
     * It also returns additional metadata concerning the playlist / album itself.
     * @param query
     * @param requestor
     * @param album
     * @returns {Promise<any>} 
     */
    private getSpotifyPlaylistAlbumMetadata = async (query: string, requestor: string, album = false): Promise<any> => {
        logger.debug(`fn:getSpotifyPlaylistAlbumMetadata started [query: ${query}, album: ${album}]`);

        let addedSongs: number = 0;                                                                                             //Canzoni aggiunte. Se 0, nessuna canzone trovata, query errata, ecc. Errore.
        let playlistDuration: number = 0;
        const { data }: { data: string } = await axios.get(`https://open.spotify.com/${album ? "album" : "playlist"}/${query}`,           //Richiedo info fingendomi browser, estraggo Bearer Auth Token da html
            { "headers": { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36" } });

        const { name, url } = JSON.parse(data.split(`<script type="application/ld+json">`)[1].split("</script>")[0]);   //JSON contenente dati della playlist
        const playlistTitle = name;                                                                                     //Titolo della playlist
        const playlistUrl = url;                                                                                        //URL della playlist
        const playlistThumbnail = data.split(`"og:image" content="`)[1].split(`"`)[0];                                  //Immagine di copertina della playlist
        const AUTHORIZATION = `Bearer ${data.split("accessToken\":\"")[1].split("\"")[0]}`;                             //TOKEN da utilizzare per le chiamate successive

        let nextLink = `https://api.spotify.com/v1/${album ? "albums" : "playlists"}/${query}/tracks`;                  //Preparo primo URL per prendere le canzoni
        while (nextLink) {                                                                                              //Finchè il link esiste
            const responseData: any = (await axios.get(nextLink, {                                                           //Usa TOKEN x fingersi il browser
                "headers": {
                    "authorization": AUTHORIZATION,
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36"
                }
            })).data;                                                                                                   //E prende dati sulle canzoni

            addedSongs = responseData.total;
            nextLink = responseData.next;                                                                               //Link successivo x canzoni dopo (se più di 100)
            this.addSong(...responseData.items.map((item): Song => {                                                    //Converto item di array in oggetti usabili in music, e inserisco
                let title: string, lengthSeconds: number;
                if (album) {
                    title = he.decode(`${item.artists.map(artist => artist.name).join(", ")} - ${item.name}`);
                    lengthSeconds = Math.floor(item.duration_ms / 1000);
                } else {
                    title = he.decode(`${item.track.artists.map(artist => artist.name).join(", ")} - ${item.track.name}`);
                    lengthSeconds = Math.floor(item.track.duration_ms / 1000);
                }
                playlistDuration += lengthSeconds;
                return { title, url: null, lengthSeconds, lengthString: secondsToString(lengthSeconds), type: SONG_TYPES.SPOTIFY, requestor };   //Inizializzo song object
            }));
        }

        return { addedSongs, playlistTitle, playlistUrl, playlistDuration, playlistThumbnail };
    }

    /**
     * Returns a Song object made with the first result of the search on youtube of the given query.
     * Used when a song without url gets to the play function to popolate it.
     * @param {string} query
     * @returns {Promise<Song>}
     */
    private getFirstYoutubeResult = async (query: string): Promise<Song> => {
        logger.debug(`fn:getFirstYoutubeResult started [query: ${query}]`);

        const { title, id, length, thumbnail } = (await getFirstYoutubeResults(query, true)).items[0];    // Get song metadata
        return { title, url: `https://www.youtube.com/watch?v=${id}`, lengthString: length.simpleText, lengthSeconds: stringToSeconds(length.simpleText), type: SONG_TYPES.YOUTUBE, thumbnail: thumbnail.thumbnails.pop().url };
    }

    /* ==== Queue Management ====== */
    /**
     * Skips one (the currently playing) or more songs.
     * @param {number} howMany how many songs to skip (default: 1)
     */
    public skipSongs = (howMany: number = 1, risp?: Message | CommandInteraction | ButtonInteraction): void => {
        logger.debug(`fn:skipSongs started [howMany: ${howMany}, risp?: ${!!risp}]`);

        // if (this.currentSongIndex === MusicPlayer.MAX_HISTORY) this.songQueue.shift();
        logger.debug(`HowMany: ${howMany} - currentIndex: ${this.currentSongIndex}`);
        this.currentSongIndex += howMany - 1;
        if (this.currentSongIndex > MusicPlayer.MAX_HISTORY) this.songQueue.splice(0, this.currentSongIndex - MusicPlayer.MAX_HISTORY);
        // if (howMany > 1) this.songQueue.splice(this.currentSongIndex + 1, howMany - 1);    // Remove extra songs before actually skipping if the user skipped more than 1 song
        logger.debug(`HowMany: ${howMany} - currentIndex: ${this.currentSongIndex}`);
        this.player.unpause();                                                          // It doesn't crash if it's not paused, so try to unpause first
        this.player.stop(true);                                                             // Kills the song that is playing, triggering AudioPlayerStatus.Idle
        
        // this.tryToPlay(risp);
    }

    public skipYoutubeMix = () => {
        logger.debug(`fn:skipYoutubeMix started`);
        if(this.getCurrentSong().type === SONG_TYPES.YOUTUBE_MIX){
            this.currentSongIndex++;
            this.skipSongs();
        }
    }

    /**
     * Goes back in the playlist.
     * @param howMany
     */
    public backSongs = (howMany: number = 1, risp?: Message | CommandInteraction | ButtonInteraction): void => {
        logger.debug(`fn:backSongs started [howMany: ${howMany}, risp?: ${!!risp}]`);

        if (howMany < 1) return;                                            // Check input

        this.goNext = !this.getCurrentSong()
        // this.goNext = false;                                             // Don't let the skip remove songs from the playlist since we are going back
        if (this.loop === 2) {                                              // Loop-Playlist: insert the last howMany of the queue at the currentSong position (without going into history)
            if (howMany < this.songQueue.length - this.currentSongIndex)
                this.songQueue.splice(this.currentSongIndex, 0, ...this.songQueue.splice(-(howMany), howMany));
        } else {
            this.currentSongIndex -= howMany;                               // Go to the previous index
            if (this.currentSongIndex < 0) this.currentSongIndex = 0;       // If you already were at the beginning, stay there
        }

        this.skipSongs(1, risp);                                            // Update the playing song (it won't skip the new song at currentSong position thanks to goNext = false)
    }

    /**
     * Removes elements from the songs queue (this.songs: Song[]).
     * @param {number} index the index (in the songs array) from which start to delete (default: 0)
     * @param {number} howMany how many elements remove (defualt: 1)
     */
     public removeSongs = (index: number = 1, howMany: number = 1): Promise<Message> | void => {
        logger.debug(`fn:removeSongs started [index: ${index}, howMany: ${howMany}]`);

        index -= 1; // Normalize user input
        if (index < 0) return;                                                   // Check input

        if (!index) return this.skipSongs(howMany);                              // If the index is 0, just skip howMany songs
        this.songQueue.splice(this.currentSongIndex + index, howMany);             // Else, remove howMany songs from position index from the queue
        return this.editQueueDynamicMessage();
    }

    public pauseSong = (): Promise<Message> => {
        logger.debug(`fn:pauseSong started`);

        this.player.pause();
        return this.editQueueDynamicMessage();
    }

    public resumeSong = (): Promise<Message> => {
        logger.debug(`fn:resumeSong started`);

        this.player.unpause();
        return this.editQueueDynamicMessage();
    }

    public switchLoop = (): Promise<Message> => {
        logger.debug(`fn:switchLoop started`);

        this.loop = (this.loop + 1) % 3;
        return this.editQueueDynamicMessage();
    }

    public shuffle = (): void => {
        logger.debug(`fn:shuffle started`);

        const offset = this.currentSongIndex + 1;
        for (let i = this.songQueue.length - 1; i > this.currentSongIndex; i--) {
            const j = Math.floor(Math.random() * (i - offset + 1)) + offset;
            [this.songQueue[i], this.songQueue[j]] = [this.songQueue[j], this.songQueue[i]];
        }
    }

    // seek = (seconds: number) => {
    //     console.log(Math.floor(this.resource.playbackDuration / 1000));
    // }

    /* ==== Chat handling ======== */
    /**
     * Checks whenever or not the user is in the same voice channel as the bot.
     */
    public checkVoice = (risp: Message | CommandInteraction | ButtonInteraction): MusicPlayer => {
        if (!(risp.member instanceof GuildMember)) return;
        const vc = risp.member.voice?.channel;
        if (vc && (!this.voiceChannel || this.voiceChannel.id === vc.id)) return this;
    }

    /**
     * Validates a request, used for ButtonInteractions.
     * If the UUID is not provided, the message is not sent from an interaction => return the object.
     */
    public checkUUID = (UUID: number): MusicPlayer => (!UUID || this.UUID === UUID) ? this : undefined;

    public checkVoiceAndUUID = (risp: Message | CommandInteraction | ButtonInteraction, UUID: number): MusicPlayer => this.checkVoice(risp)?.checkUUID(UUID);

    /**
     * Binds the bot log messages to a new textChannel, sending again the interface.
     * @param {TextBasedChannels} textChannel
     */
    bindTextChannel = (textChannel: TextBasedChannel): void => {
        logger.debug(`fn:bindTextChannel started [textChannel: ${textChannel.id}]`);

        this.textChannel = textChannel;                                     // Update this channel
        this.navigatorDynamicMessage.updateTextChannel(textChannel);             // Update interfaces channel
        this.queueDynamicMessage.updateTextChannel(textChannel);
    }


    private addSongMixLog = (channel: TextBasedChannel, song: Song): Promise<Message> => {
        logger.debug(`fn:addSongMixLog started`);
        return this.addSongLog(channel, { title: "Youtube Mix - " + song.title, ...song });
    }

         
    /**
     * Sends an embed with some informations about the added song.
     * @param {TextBasedChannels} channel
     * @param {Song} song
     * @returns {Promise<Message>}
     */
    private addSongLog = (channel: TextBasedChannel, song: Song): Promise<Message> => {
        logger.debug(`fn:addSongLog started`);
        return this.addLog(channel, `Queued [${song.title}](${song.url})`, song.lengthString, song.requestor, this.songQueue.length, this.getDurationSeconds(), song.thumbnail);
    }
    /**
     * Sends an embed with some informations about the added playlist.
     * TO USE AFTER THE PLAYLIST IS ADDED TO THE QUEUE.
     * @returns {Promise<Message>}
     */
    private addPlaylistLog = (channel: TextBasedChannel, howMany: number, title: string, url: string, duration: string, requestor: string, position: number, timeUntilPlaying: number, thumbnail: string): Promise<Message> => {
        logger.debug(`fn:addPlaylistLog started`);
        return this.addLog(channel, `Queued ${howMany} songs from [${title}](${url})`, duration, requestor, position, timeUntilPlaying, thumbnail);
    }

    /**
     * Sends an embed with some informations about the added song or playlist.
     * TO USE BEFORE THE SONG IS ACTUALLY ADDED TO THE QUEUE.
     * @returns {Promise<Message}
     */
    private addLog = (channel: TextBasedChannel, description: string, duration: string, requestor: string, position: number, timeUntilPlaying: number, thumbnail: string): Promise<Message> => {
        if (!this.textChannel) this.bindTextChannel(channel);
        position = position - this.currentSongIndex;
        // return await this.textChannel.send(
        const content = {
            embeds: [new EmbedBuilder()
                .setColor(Number.parseInt(process.env.EMBED_COLOR) as ColorResolvable)
                // .setDescription(`Queued [${song.title}](${song.url})`)
                // .addField(`Song duration: [\`${song.lengthString}\`]`, `Requested by`, true)
                // .addField(`Queued in position [\`${this.songs.length}\`]`, `**Estimated time until playing: [\`${this.getDurationString()}\`]**`, true)
                // .setThumbnail(song.thumbnail)
                .setDescription(description)
                .addFields(
                    {name: `Song duration: [\`${duration}\`]`, value: `By: <@${requestor}>`, inline: true},
                    {name: `Queued in position [\`${position ? position : "now"}\`]`, value: `**Time until playing: [\`${timeUntilPlaying ? secondsToString(timeUntilPlaying) : "none"}\`]**`, inline: true}
                )
                .setThumbnail(thumbnail)
            ]
        }
        // );

        return this.logDynamicMessage.updateTextChannel(this.textChannel).updateContent(content).resend();
    }

    /**
     * Starting from the data in the object, creates a summary of the queue, generating text, images and buttonInteractions.
     * @returns {any} Object to send in chat.
     */
    private getQueueContent = (): any => {
        logger.debug(`fn:getQueueContent started`);

        const paused: boolean = this.player.state.status === "paused";
        const song: Song = this.songQueue[this.currentSongIndex];

        const embed = new EmbedBuilder()
            .setColor(Number.parseInt(process.env.EMBED_COLOR) as ColorResolvable)
            .setTitle("Haram Leotta Music Player")
            .setDescription(`[${song.title}](${song.url})`)
            .setImage(song.thumbnail)
            .addFields(
                { name: `Song duration: [\`${song.lengthString}\`]`, value: `By: <@${song.requestor}>`, inline: true},
                { name: `Queue duration: [\`${this.getDurationString()}\`]`, value: `**Enqueued songs: [\`${this.songQueue.length - this.currentSongIndex}\`]**`, inline: true }
            );

        const component = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`loop-${this.UUID}`)
                    .setStyle(this.loop ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji(this.loop === 1 ? "877873237244125214" : "877867473322541086"),
                // .setEmoji(this.loop === 1 ? "🔂" : "🔁"),

                new ButtonBuilder()
                    .setCustomId(`back-${this.UUID}`)
                    .setStyle(ButtonStyle.Secondary)
                    // .setEmoji("⏮️")
                    .setEmoji("877853994255527946")
                    .setDisabled(this.loop != 2 && !this.currentSongIndex),

                new ButtonBuilder()
                    .setCustomId((paused ? "resume" : "pause") + `-${this.UUID}`)
                    .setStyle(ButtonStyle.Secondary)
                    // .setEmoji(paused ? "▶️" : "⏸️"),
                    .setEmoji(paused ? "877853994305855508" : "877853994259730453"),

                new ButtonBuilder()
                    .setCustomId(`skip-${this.UUID}`)
                    .setStyle(ButtonStyle.Secondary)
                    // .setEmoji("⏭️")
                    .setEmoji("877853994326851634")
                    ,// .setDisabled(!this.loop && !this.songQueue[this.currentSongIndex + 1]),

                new ButtonBuilder()
                    .setCustomId(`clear-${this.UUID}`)
                    .setStyle(ButtonStyle.Secondary)
                    // .setEmoji("⏹️")
                    .setEmoji("877853994293280828")
            );

        return { embeds: [embed], components: [component] };
    }

    /**
     * Starting from the data in the object, creates a view of the songs in the queue, generating text and buttonInteractions.
     * @returns {any} Object to send in chat.
     */
    private getNavigatorContent = (): any => {
        logger.debug(`fn:getNavigatorContent started`);

        let content: string;
        let pagTot: number = 0;

        if (!this.songQueue.length) content = ("```swift\n                             Nothing to see here.```");
        else {
            pagTot = Math.floor(this.songQueue.length / 10) + (this.songQueue.length % 10 ? 1 : 0) - 1;
            content = `\`\`\`swift\n${this.songQueue.length} enqueued songs - Total duration: ${this.getDurationString()}\n\n`;
            const init = this.navPage * 10; // + this.currentSongIndex;
            for (let i = init; i < init + 10; i++) {
                if (!this.songQueue[i]) break;                                                               //Se sono finite le canzoni, chiudi
                // if (start && (!i && lengthString != "LIVE")) lengthString = this.secondsToString(songQueue[0].secsTime - getTimeInSeconds() + start);  //Calcola quanto manca alla fine della prima canzone                
                const num = i < 9 ? 2 : i < 99 ? 1 : 0;
                let lengthString: string = this.songQueue[i].lengthString;
                for (let i = lengthString.length; i < 9 - num; i++) lengthString = ' ' + lengthString;

                const str = formatSchifo(this.songQueue[i].title.replace(/"/g, '\''), i, 47);
                // const str = this.songQueue[i].title.replace(/"/g, '\'');
                content += `${" ".repeat(num)}${i + 1}) ${str} ${lengthString}${i != this.currentSongIndex ? '' : '<'}\n`; // ${i || !start ? '' : '<'}\n`;
            }
            content += `\n\nPage ${this.navPage + 1}/${pagTot + 1}                 ${(this.navPage === pagTot ? `Nothing else to see here. ` : `${this.songQueue.length - (this.navPage * 10)} more songs... `)}` + `\`\`\``;
        }

        const component: ActionRowBuilder = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`navfirst-${this.UUID}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("877853994255527946")
                    .setDisabled(!this.navPage),

                new ButtonBuilder()
                    .setCustomId(`navprev-${this.UUID}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("877853994255527946")
                    .setDisabled(!this.navPage),

                new ButtonBuilder()
                    .setCustomId(`navnext-${this.UUID}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("877853994326851634")
                    .setDisabled(this.navPage === pagTot),

                new ButtonBuilder()
                    .setCustomId(`navlast-${this.UUID}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("877853994326851634")
                    .setDisabled(this.navPage === pagTot),

                new ButtonBuilder()
                    .setCustomId(`navreset-${this.UUID}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("✖️"),
            )

        return { content, components: [component] };
    }

    public editQueueDynamicMessage = (): Promise<Message> => {
        logger.debug(`fn:editQueueDynamicMessage started`);
        return this.queueDynamicMessage.updateContent(this.getQueueContent()).edit();
    }
    public resendQueueDynamicMessage = (): Promise<Message> => {
        logger.debug(`fn:resendQueueDynamicMessage started`);
        return this.queueDynamicMessage.updateContent(this.getQueueContent()).resend();
    }

    public editNavigatorDynamicMessage = (): Promise<Message> => {
        logger.debug(`fn:editNavigatorDynamicMessage started`);
        return this.navigatorDynamicMessage.updateContent(this.getNavigatorContent()).edit();
    }

    public resendNavigatorDynamicMessage = (): Promise<Message> => {
        logger.debug(`fn:resendNavigatorDynamicMessage started`);
        return this.navigatorDynamicMessage.updateContent(this.getNavigatorContent()).resend();
    }

    public navigator = (textChannel: TextBasedChannel): Promise<Message> => {
        this.navPage = 0;
        if (!this.textChannel) this.bindTextChannel(textChannel);
        return this.resendNavigatorDynamicMessage();
    }

    public navPageFirst = (): Promise<Message> => {
        this.navPage = 0;
        return this.editNavigatorDynamicMessage();
    }

    public navPageLast = (): Promise<Message> => {
        this.navPage = Math.floor(this.songQueue.length / 10) + (this.songQueue.length % 10 ? 1 : 0) - 1;
        return this.editNavigatorDynamicMessage();
    }

    public navPageUp = (): Promise<Message> => {
        this.navPage++;
        return this.editNavigatorDynamicMessage();
    }

    public navPageDown = (): Promise<Message> => {
        this.navPage--;
        return this.editNavigatorDynamicMessage();
    }

    public navReset = (): Promise<void> => {
        this.navPage = 0;
        return this.navigatorDynamicMessage.delete();
    }

    /* ==== Utils ================ */
    public isPlaying = (): boolean => this.player.state.status === "playing";

    public setVolume = (volume: number = this.volume) => {
        this.volume = volume;
        this.resource?.volume.setVolume(this.volume);
    }

    /**
     * Gets the total duration in seconds of all the songs that haven't been played yet. 
     * @returns {number} seconds
     */
    private getDurationSeconds = (): number => {
        // let durTot = music.playingSong ? (music.playingSong?.secsTime - ((music.connection.dispatcher.paused ? music.startPause : getTimeInSeconds()) - music.start)) : 0;
        let duration: number = this.songQueue[this.currentSongIndex]?.lengthSeconds ?? 0;
        for (let i = this.currentSongIndex + 1; i < this.songQueue.length; i++)
            duration += this.songQueue[i].lengthSeconds;
        return duration;
    }

    /**
     * Gets the total duration as a string of all the songs that haven't been played yet. 
     * @returns {string} duration
     */
    private getDurationString = (): string => secondsToString(this.getDurationSeconds());
}