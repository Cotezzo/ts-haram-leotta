import axios from "axios";
import he from "he";
import { Readable } from "stream";

import { SONG_TYPES, YT_RESULT_TYPES } from "../globals/SongTypes";
import { Song } from "../interfaces/Song";
import { secondsToString } from "./StringFormatUtils";

/* ==== YOUTUBE - PUBLIC ====================================================================================== */
const getYoutubeInitData = async (url: string): Promise<any> => {
    //axios.get(encodeURI(url) + '&sp=EgIQAQ%253D%253D').then(page => {
    // axios.get(url + '&sp=EgIQAQ%253D%253D').then(page => {
    const { data }: { data: string } = await axios.get(url);

    // Ricava JSON principale di YouTube
    const initData = JSON.parse(data.split('var ytInitialData =')[1].split("</script>")[0].slice(0, -1));

    // Ricava API key (se esiste)
    const innerTubeApiKey: string[] = data.split("innertubeApiKey");
    const apiToken: string = innerTubeApiKey.length > 0 ? innerTubeApiKey[1].trim().split(",")[0].split('"')[2] : null;

    // Ricava context (se esiste)
    const innerTubeContext: string[] = data.split('INNERTUBE_CONTEXT');
    const context: string = innerTubeContext.length > 0 ? JSON.parse(innerTubeContext[1].trim().slice(2, -2)) : null;

    return { initData, apiToken, context };
};

// Funzione che, data una keyword, la cerca su youtube e restituisce i risultati
export const getFirstYoutubeResults = async (keyword: string, withPlaylist: boolean = false): Promise<any> => {
    // Get URL with cleaned input
    const endpoint = `https://www.youtube.com/results?search_query=${encodeURIComponent(keyword.replace(/[^a-zA-Z0-9 ]/g, ""))}`;
    const { initData, apiToken, context } = await getYoutubeInitData(endpoint);

    const contents = initData.contents.twoColumnSearchResultsRenderer.primaryContents.sectionListRenderer.contents;

    //const index = sectionListRenderer.contents.length>2?2:1;
    const index = contents.length - 1;  // Fix per sfasamento dovuto alla presenza di pubblicità
    const contToken = contents[index].continuationItemRenderer.continuationEndpoint.continuationCommand.token;
    //const contToken = sectionListRenderer.contents[sectionListRenderer.contents.length-1].continuationItemRenderer.continuationEndpoint.continuationCommand.token;

    // Array contenente lista di item da ritornare - risultati della ricerca: video, playlist...
    const items = getResultsFromContents(contents[index - 1].itemSectionRenderer.contents, withPlaylist);

    return { items, nextPage: { nextPageToken: apiToken, nextPageContext: { context, continuation: contToken } } };
};

// Funzione legata a quella appena sopra - permette di ottenere i risultati successivi alla query già effettuata - come se si girasse pagina
export const getNextYoutubeResults = async (nextPage: any, withPlaylist: boolean = false): Promise<any> => {
    const endpoint = `https://www.youtube.com/youtubei/v1/search?key=${nextPage.nextPageToken}`;
    const { data }: any = await axios.post(encodeURI(endpoint), nextPage.nextPageContext);

    const continuationItems = data.onResponseReceivedCommands[0].appendContinuationItemsAction.continuationItems;

    // Array contenente lista di item da ritornare - risultati della ricerca: video, playlist...
    const items = getResultsFromContents(continuationItems[0].itemSectionRenderer.contents, withPlaylist);

    nextPage.nextPageContext.continuation = continuationItems[1]?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;

    return { items, nextPage };
};

export const getYoutubePlaylistFull = async (playlistId: string): Promise<any> => {
    const endpoint = `https://www.youtube.com/playlist?list=${playlistId}`;
    const { initData, apiToken, context } = await getYoutubeInitData(endpoint);
    /*------------------------------------------------GET ALL VIDEOS (100+)------------------------------------------------*/
    const items = [];
    let continuation = null;
    do{
        if(continuation==null)                                          //La prima volta prendo i primi 101 elementi della playlist
            items.push(...getResultsFromPlaylistContents(initData.contents.twoColumnBrowseResultsRenderer.tabs[0].tabRenderer.content.sectionListRenderer.contents[0].itemSectionRenderer.contents[0].playlistVideoListRenderer.contents));
        else {                                                              //Se continuation è valorizzata, chiedi gli elementi successivi
            const { data }: any = await axios.post(`https://www.youtube.com/youtubei/v1/browse?key=${apiToken}`,
                { context, continuation }, { headers: { "content-type": "application/json" } });
            items.push(...getResultsFromPlaylistContents(data.onResponseReceivedActions[0].appendContinuationItemsAction.continuationItems));
        }
        continuation = items[items.length-1]?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
    } while(continuation);

    return { items, metadata: initData.metadata };                          //Ritorno la lista di tutti i video e dati relativi alla playlist
};

export const getYoutubeMixIds = async (videoId: string, mixId: string): Promise<string[]> => {
    const { data }: { data: string } = await axios.get(`https://www.youtube.com/watch?v=${videoId}&list=RD${mixId}`)

    const contents =  JSON.parse(data.split('var ytInitialData =')[1].split("</script>")[0].slice(0, -1)).contents;
    return contents.twoColumnWatchNextResults.playlist.playlist.contents.map(({ playlistPanelVideoRenderer: e }) => {
        return { id: e.videoId, title: e.title.simpleText, thumbnail: e.thumbnail.thumbnails.pop().url, lengthString: e.lengthText.simpleText }
    });
}

export const getYoutubeVideoId = (url: string): string => url.split("=", 2)[1].split("&", 1)[0];


/* ==== YOUTUBE - PRIVATE ===================================================================================== */
const getResultsFromContents = (contents, withPlaylist: boolean): any[] => {
    const results = [];
    for(const item of contents) {
        const videoRender = item.videoRenderer;
        const playListRender = item.playlistRenderer;

        // Se si tratta di un video, aggiungilo
        if (videoRender?.videoId)
            results.push({ id: videoRender.videoId, type: YT_RESULT_TYPES.VIDEO, thumbnail: videoRender.thumbnail, title: videoRender.title.runs[0].text, length: videoRender.lengthText });
        
        // Se si tratta di una playlist, aggiungila se il flag withPlaylist è true
        else if (withPlaylist && playListRender?.playlistId)
            results.push({ id: playListRender.playlistId, type: YT_RESULT_TYPES.PLAYLIST, thumbnail: playListRender.thumbnails, title: playListRender.title.simpleText, length: playListRender.videoCount });
    }
    return results;
}

const getResultsFromPlaylistContents = contents => {
    const results = [];
    for(const item of contents) {
        const videoRender = item.playlistVideoRenderer;
        if (videoRender?.videoId)
            results.push({ id: videoRender.videoId, type: YT_RESULT_TYPES.VIDEO, thumbnail: videoRender.thumbnail, title: videoRender.title.runs[0].text,
            lengthSeconds: videoRender.lengthSeconds, lengthString: videoRender.lengthText?.simpleText });
    }
    return results;
}


/* ==== SPOTIFY =============================================================================================== */
export const getSpotifySongMetadata = async (query: string): Promise<any> => {
    const firstData: string = (await axios.get(`https://open.spotify.com/track/${query}`)).data as string;                  //HTML orribile

    const songJSON: any = JSON.parse(firstData.split(`<script type="application/ld+json">`)[1].split("</script>")[0]);      //Estraggo JSON
    const spotifyUrl: string = songJSON.url;                                                                                //Link di Spotify
    const thumbnail: string = firstData.split(`"og:image" content="`)[1].split(`"`)[0];                                     //Copertina della canzone

    const songMetadata: any = JSON.parse(firstData.split("Spotify.Entity = ")[1].split("};")[0] + "}");                     //Metadata della canzone
    const title: string = he.decode(songMetadata.artists.map(artist => artist.name).join(", ") + "-" + songMetadata.name)
    const lengthSeconds: number = Math.floor(songMetadata.duration_ms / 1000);                                              //Tempo in secondi

    return { song: { title, lengthSeconds, lengthString: secondsToString(lengthSeconds), type: SONG_TYPES.SPOTIFY, thumbnail }, spotifyUrl };
}

export const getSpotifyPlaylistAlbumMetadata = async (query: string, requestor: string, album = false) => {
    let addedSongs: number = 0;                                                                                             //Canzoni aggiunte. Se 0, nessuna canzone trovata, query errata, ecc. Errore.
    let playlistDuration: number = 0;
    const { data }: { data: string } = await axios.get(`https://open.spotify.com/${album ? "album" : "playlist"}/${query}`,           //Richiedo info fingendomi browser, estraggo Bearer Auth Token da html
        { "headers": { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.90 Safari/537.36" } });

    const { name, url } = JSON.parse(data.split(`<script type="application/ld+json">`)[1].split("</script>")[0]);   //JSON contenente dati della playlist
    const playlistTitle = name;                                                                                     //Titolo della playlist
    const playlistUrl = url;                                                                                        //URL della playlist
    const playlistThumbnail = data.split(`"og:image" content="`)[1].split(`"`)[0];                                  //Immagine di copertina della playlist
    const AUTHORIZATION = `Bearer ${data.split("accessToken\":\"")[1].split("\"")[0]}`;                             //TOKEN da utilizzare per le chiamate successive

    const results = [];
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
        results.push(responseData.items);
    }

    return results;
}

/* ==== SOUNDCLOUD ============================================================================================ */
export const getSoundCloudStream = (url: string): Promise<string> => {
    return new Promise(async (resolve, reject) => {
        const rawData: string = await axios.get(url).then((res: any) => res.data).catch(e => reject(e));

        const initialData: any = JSON.parse(rawData.split("<script>window.__sc_hydration = ", 2)[1].split(";<", 1)[0]);                                             // Extract JSON metadata
        const usefulData: any = initialData[initialData.length - 1].data;                                                                                           // Extract useful data

        const songUrl: string = usefulData.media.transcodings[0].url;                                                                                               // Get info used for the playlist url
        const trackAuthorization: string = usefulData.track_authorization;
        const clientId: string = "US4P8VHRqazZTuv4RddkNN7cqCqUQkQy";    // getClientId();
        const playlistUrl: string = await axios.get(`${songUrl}?client_id=${clientId}&track_authorization=${trackAuthorization}`).then((res: any) => res.data.url).catch(e => reject(e));
        const playlistData: string = await axios.get(playlistUrl).then((res: any) => res.data).catch(e => reject(e));
        // Get playlist.m3u8
        const stream: string = playlistData.substring(playlistData.lastIndexOf(",") + 2, playlistData.lastIndexOf("#") - 1).replace(/media\/[^\/]+/, "media/0");    // Get last link, and set start to 0
        resolve(stream);
    });
}

export const getSoundCloudSong = (url: string): Promise<Song> => {
    return new Promise(async (resolve, reject) => {
        try {
            const rawData: string = await axios.get(url).then((res: any) => res.data).catch(e => reject(e));

            const initialData: any = JSON.parse(rawData.split("<script>window.__sc_hydration = ", 2)[1].split(";<", 1)[0]);                                          // Extract JSON metadata
            // TODO: search thumbnail
            const usefulData: any = initialData[initialData.length - 1].data;                                                                                          // Extract useful data

            const lengthSeconds: number = Math.floor(usefulData.duration / 1000);
            const lengthString: string = secondsToString(lengthSeconds);
            const title: string = usefulData.title;
            const thumbnail: string = usefulData.user.avatar_url;

            resolve({ url, type: SONG_TYPES.SOUNDCLOUD, lengthSeconds, lengthString, title, thumbnail });
        } catch (e) {
            reject(e);
        }
    });
}


/* ==== YEWTUBE =============================================================================================== */
export const YEWTUBE_ROOT = "https://yewtu.be/";
export const getYewtubeSong = async (url: string): Promise<Song> => {
    // Ricava informazioni riguardo il video - getInfo di ytdl lancia errore
    const videoId: string = getYoutubeVideoId(url); // url.split("=", 2)[1].split("&", 1)[0];
    const page: string = (await axios.get(`${YEWTUBE_ROOT}watch?v=${videoId}`)).data as string;

    const lengthSeconds: number = parseInt(page.split('"length_seconds": ', 2)[1].split(",", 1)[0]);
    const title: string = page.split('"title": "', 2)[1].split('"', 1)[0];

    return { title, url: videoId, thumbnail: `${YEWTUBE_ROOT}vi/${videoId}/maxres.jpg`, lengthSeconds, lengthString: secondsToString(lengthSeconds), type: SONG_TYPES.YEWTUBE };
}

export const getYewtubeStream = async (videoId: string): Promise<Readable> => {
    const url = `${YEWTUBE_ROOT}latest_version?id=${videoId}&itag=22&local=true`;
    console.log(url);

    const readable = new Readable({ read() { } });
    readable.push((await axios.get(url, {
            "headers": {
                "accept": "*/*",
                "accept-language": "it-IT,it;q=0.9,en-US;q=0.8,en;q=0.7",
                "Referer": `${YEWTUBE_ROOT}watch?v=${videoId}`
            },
            responseType: "arraybuffer" }
        )).data);
    readable.push(null);
    return readable;
}