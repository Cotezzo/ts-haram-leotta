import { ActionRowBuilder, ButtonBuilder, ButtonStyle, CommandInteraction, Message } from "discord.js";
import { Song } from "../interfaces/Song";
import { getFavourites } from "../service/UserService";
import { formatSchifo } from "../utils/StringFormatUtils";
import { DynamicMessage } from "./DynamicMessage";

export class FavouritesNavigator {
    private UUID: number;
    private dynamicMessage: DynamicMessage;     // Message sent with all the youtube options and interactions
    private page: number;
    private risp: Message | CommandInteraction;
    private songs: Song[];
    private userId: string;

    constructor(){}

    public start = async (risp: Message | CommandInteraction): Promise<void> => {
        this.UUID = Date.now();
        this.songs = [];
        this.page = 0;

        this.risp = risp;
        this.userId = risp.member.user.id;
        this.songs = await getFavourites(this.userId);

        await this.dynamicMessage?.delete();    // ! catch
        this.dynamicMessage = new DynamicMessage(this.UUID);
        await this.dynamicMessage.updateTextChannel(this.risp.channel).updateContent(this.getFavouritesContent()).resend();

        // At this point, the instance is basically new
    }

    public pageFirst = (): Promise<Message> => {
        this.page = 0;
        return this.editdynamicMessage();
    }

    public pageLast = (): Promise<Message> => {
        this.page =  Math.floor(this.songs.length / 10) + (this.songs.length % 10 ? 1 : 0) - 1;
        return this.editdynamicMessage();
    }

    public pageUp = (): Promise<Message> => {
        this.page++;
        return this.editdynamicMessage();
    }

    public pageDown = async (): Promise<Message> => {
        this.page--;
        return this.editdynamicMessage();
    }

    public editdynamicMessage = (): Promise<Message> => this.dynamicMessage.updateContent(this.getFavouritesContent()).edit();
    public resenddynamicMessage = (): Promise<Message> => this.dynamicMessage.updateContent(this.getFavouritesContent()).resend();
    public deleteDynamicMessage = (): Promise<void> => this.dynamicMessage.delete();

    public check = (userId: string, UUID?: number): FavouritesNavigator => {
        if(this.userId == userId && (!UUID || this.UUID == UUID)) return this;
    }

    private getFavouritesContent = (): object => {
        let content: string;
        let pagTot: number = 0;
        
        if (!this.songs.length) content = ("```swift\n                             You don't have favourite songs at the moment.```");
        else{
            pagTot = Math.floor(this.songs.length / 10) + (this.songs.length % 10 ? 1 : 0) - 1;
            content = `\`\`\`swift\nFavourite songs\n\n`;
            const init = this.page * 10;             // Se prima posizione, inizia da 0 (non esiste lens[-1]), altrimenti da lens precedente [cons corrisponde a elemento in lens]
            for (let i = init; i < init + 10; i++) {     //Da lens[precedente] a lens[ora], inserisci i titoli nell'embed
                if (!this.songs[i]) break;
                const num: number = i < 9 ? 2 : i < 99 ? 1 : 0;
                let lengthString: string = this.songs[i].lengthString;
                for (let i = lengthString.length; i < 9 - num; i++) lengthString = ' ' + lengthString;

                const str = formatSchifo(this.songs[i].title.replace(/"/g, '\''), i, 47);
                // const str = this.songs[i].title.replace(/"/g, '\'');
                content += `${" ".repeat(num)}${i + 1}) ${str} ${lengthString}\n`;
            }
            content += `\n\nPage ${this.page+1}/${pagTot+1}                 ${(this.page == pagTot ? `Nothing else to see here. ` : `${this.songs.length - (this.page * 10)} more songs... `)}` + `\`\`\``;
        }

        const component: ActionRowBuilder = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                .setCustomId(`favfirst-${this.UUID}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("877853994255527946")
                .setDisabled(!this.page),

                new ButtonBuilder()
                .setCustomId(`favprev-${this.UUID}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("877853994255527946")
                .setDisabled(!this.page),

                new ButtonBuilder()
                .setCustomId(`favnext-${this.UUID}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("877853994326851634")
                .setDisabled(this.page == pagTot),
            
                new ButtonBuilder()
                .setCustomId(`favlast-${this.UUID}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("877853994326851634")
                .setDisabled(this.page == pagTot),

                new ButtonBuilder()
                .setCustomId(`favreset-${this.UUID}`)
                .setStyle(ButtonStyle.Secondary)
                .setEmoji("✖️"),
            )

        return ({ content, components: [component] });
    }
}