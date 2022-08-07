import axios from "axios";
import { YT_RESULT_TYPES } from "../globals/SongTypes";
import { shortYoutubeVideo } from "./MusicService";

const cookie = "__Secure-3PSID=NAicbd0CIiVdc3Zb4yaAeZICNbRn46Sle13dKnyk3CNeiPtArQrATvJRXSsPl36noEtV6w.;";

const getYoutubeInitData = async (url: string): Promise<any> => {
    //axios.get(encodeURI(url) + '&sp=EgIQAQ%253D%253D').then(page => {
    // axios.get(url + '&sp=EgIQAQ%253D%253D').then(page => {
    const { data }: { data: string } = await axios.get(url, { headers: { cookie }});

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
    const { data }: { data: string } = await axios.get(`https://www.youtube.com/watch?v=${videoId}&list=RD${mixId}`, { headers: { cookie }})

    const contents =  JSON.parse(data.split('var ytInitialData =')[1].split("</script>")[0].slice(0, -1)).contents;

    return contents.twoColumnWatchNextResults.playlist.playlist.contents.map(({ playlistPanelVideoRenderer: e }) => {
        return { id: e.videoId, title: e.title.simpleText, thumbnail: e.thumbnail.thumbnails.pop().url, lengthString: e.lengthText.simpleText }
    });
}

export const getYoutubeVideoId = (url: string): string =>
    shortYoutubeVideo.test(url) ? url.split("/").pop().split("?", 1)[0] : url.split("=", 2)[1].split("&", 1)[0];

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