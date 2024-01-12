import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, Message } from "discord.js";
import { YT_RESULT_TYPES } from "../globals/SongTypes";
import { getFirstYoutubeResults, getNextYoutubeResults } from "../service/YoutubeService";
import { formatSchifo } from "../utils/StringFormatUtils";
import { DynamicMessage } from "./DynamicMessage";
import { Logger } from "./Logger";

export class YoutubeNavigator {
    private UUID: number;
    public dynamicMessage: DynamicMessage;                             // Message sent with all the youtube options and interactions

    public videos: { title: string; id: string; length: string; type: number }[];   // YT_RESULT_TYPES
    private pageLengths: number[];                                      // pageLengths.length: the number of pages
    private pageScrollIndex: number;
    private nextPage: object;

    private userId: string;

    private risp: Message | CommandInteraction;
    private query: string;

    constructor() {}

    public start = async (risp: Message | CommandInteraction, query: string): Promise<void> => {
        this.UUID = Date.now();
        this.videos = [];
        this.pageLengths = [];
        this.pageScrollIndex = 0;
        this.nextPage = null;

        this.risp = risp;
        this.query = query;
        this.userId = risp.member.user.id;

        await this.searchProcedure();
        await this.dynamicMessage?.delete();    // ! catch
        this.dynamicMessage = new DynamicMessage(this.UUID);
        await this.dynamicMessage.updateTextChannel(this.risp.channel).updateContent(this.getYoutubeContent()).resend();

        // At this point, the instance is basically new
    }

    private searchProcedure = async (): Promise<any> => {
        let result: any;

        try {
            if (!this.videos.length)                                    result = await getFirstYoutubeResults(this.query, true);    // First search
            else if (this.pageScrollIndex == this.pageLengths.length)   result = await getNextYoutubeResults(this.nextPage, true);  // Further search
            else return;

            this.nextPage = result.nextPage;                        // Setup parameters for the next research
            // Update pageLengths array. First add: add items length. Further add: sum the last length with the items length.
            // this.pageLengths.push( ( this.pageScrollIndex ? this.pageLengths.splice(-1) : 0 ) + result.items.length);
            this.pageLengths.push((this.pageLengths[this.pageLengths.length - 1] ?? 0) + result.items.length);

            // Aggiungi il video alla lista, modificando la lunghezza in base al tipo di risultato
            for (const { title, id, length, type } of result.items) this.videos.push({ type, title, id, length: type === YT_RESULT_TYPES.PLAYLIST ? `Playlist [${length}]` : (length?.simpleText ?? "LIVE") });    // Add all the results to the array
        } catch (e) { 
            Logger.error("YoutubeNavigator.searchProcedure error: " + e);
        }
    }

    public pageUp = (): Promise<Message> => {
        this.pageScrollIndex++;
        return this.pageUpdate();
    }

    public pageDown = (): Promise<Message> => {
        this.pageScrollIndex--;
        return this.pageUpdate();
    }

    private pageUpdate = (): Promise<Message> => this.searchProcedure().then(() => this.dynamicMessage.updateContent(this.getYoutubeContent()).edit());

    public check = (userId: string, UUID?: number): YoutubeNavigator => {
        if (this.userId == userId && (!UUID || this.UUID == UUID)) return this;
    }

    public deleteDynamicMessage = (): Promise<void> => this.dynamicMessage.delete();

    private getYoutubeContent = (): object => {
        const afterExists = (this.pageLengths[this.pageScrollIndex] - this.pageLengths[this.pageScrollIndex - 1] || (!this.pageScrollIndex && this.pageLengths.length));
        var content: string = `\`\`\`swift\nResults for '${this.query}'\n\n`;
        const firstLinkIndex = this.pageLengths[this.pageScrollIndex - 1] ?? 0;             // Se prima posizione, inizia da 0 (non esiste lens[-1]), altrimenti da lens precedente [cons corrisponde a elemento in lens]
        for (let i = firstLinkIndex; i < this.pageLengths[this.pageScrollIndex]; i++) {     //Da lens[precedente] a lens[ora], inserisci i titoli nell'embed
            const num: number = i < 9 ? 2 : i < 99 ? 1 : 0;
            var lengthString: string = this.videos[i].length;
            for (let i = lengthString.length; i < 9 - num; i++) lengthString = ' ' + lengthString;
            //lengthString = " ".repeat(12 - lengthString.length - num) + lengthString;
            const str = formatSchifo(this.videos[i].title.replace(/"/g, '\''), i, 47);
            // const str = this.urls[i].title.replace(/"/g, '\'');
            content += `${" ".repeat(num)}${i + 1}) ${str} ${lengthString}\n`;
        }
        content += (afterExists ? `\n\nChoose a video just with '<n>'` : 'No results found. ') + `\`\`\``; //Specie di footer per dare istruzioni

        const component: ActionRowBuilder = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(`prev-${this.UUID}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("877853994255527946")
                    .setDisabled(!this.pageScrollIndex),

                new ButtonBuilder()
                    .setCustomId(`next-${this.UUID}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("877853994326851634")
                    .setDisabled(!afterExists),

                new ButtonBuilder()
                    .setCustomId(`reset-${this.UUID}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setEmoji("✖️"),
            )

        return ({ content, components: [component] });
    }
}