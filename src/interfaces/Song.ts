export interface Song {
    title: string;
    url?: string;

    begin?: number;

    lengthSeconds?: number;
    lengthString?: string;
    // ! isLiveContent?: boolean;
    type: number;

    thumbnail?: string;
    requestor?: string;

    // postProcessing?: any;

    // YOUTUBE_MIX UTILS
    mixId?: string;
    mixPlayedMap?: Set<string>;
    mixQueue?: string[];    // video ids
}