import { ColorResolvable, CommandInteraction, Message, EmbedBuilder, TextChannel } from 'discord.js';
import axios from 'axios';
import he from "he";
import { RedditPost, RedditSortBy, RedditSub } from '../interfaces/RedditInterfaces';
import { Logger } from '../classes/Logger';

const maxSubs: number = parseInt(process.env.REDDIT_MAX_SUBS);

/* ==== LOCAL INTERFACES - Only used here to handle the map ====================================================================================================== */
interface RedditSubsMap<RedditSub> { [subreddit: string]: RedditSub; };
interface ChannelsMap<RedditSubsMap> { [channelId: string]: RedditSubsMap; };

const channelsMap: ChannelsMap<RedditSubsMap<RedditSub>> = {};  // Map to memorize subreddits informations relatively to server channels

/* ==== OBJECT HANDLING - Main function ========================================================================================================================== */
export const getPost = async (channelId: string, subName: string, sortby: RedditSortBy = "hot") : Promise<RedditPost> => {
    subName = subName.toLowerCase();
    return new Promise(async (resolve, reject) => {
        try {
            if (!/^\w+$/.test(subName)) return reject("Invalid subreddit name.");                           // Check if the string is valid
            Logger.info(subName);

            /* ==== RedditSub Instance ========================================================= */
            let subsMap: RedditSubsMap<RedditSub> = channelsMap[channelId]; // Takes the redditSubsMap bind to the channel
            if (!subsMap) {                                                 // Creates a new one and binds it if it doesn't exist
                subsMap = {}
                channelsMap[channelId] = subsMap;
            }

            let sub: RedditSub = subsMap[subName+sortby];                   // Prendo l'oggetto relativo al subName
            if (!sub) sub = { posts: [], after: undefined, lastSearch: 0 }; // Se non esiste, lo creo al momento vuoto - non lo metto in subMap perché non so se sia valido

            /* ==== RedditPost(s) Get ========================================================== */
            if (!sub.posts.length) subsMap[subName+sortby] = await fetchNuoviPost(subName, sortby, sub);    // If the posts queue is empty, fetch new posts
            sub.lastSearch = Date.now();                                                                    // Update last search date
            const post: RedditPost = sub.posts.shift();                                                     // Get latest post

            /* ==== RedditSub Deletion ========================================================= */
            if(maxSubs){                                                                                    // Size == 0: no limit
                const entries = Object.entries(subsMap);                                                    // entries listCoppie chiavi-valori lista
                if(entries.length >  maxSubs){                                                              // If there are more subs than the limit, delete oldest search
                    var mins: [number, string] = [Date.now(), subName];                                     // Minimum starts with now
                    for (const [key, {lastSearch}] of entries)                                              // Loops on subs
                        if(mins[0] > lastSearch) mins = [lastSearch, key];                                  // Finds the oldest one
                    delete subsMap[mins[1]];                                                                // Deletes it
                }
            }

            resolve(post);
        } catch (e) {
            reject(e);
        }
    })
}

/* ==== New Posts Fetch ========================================================================================================================================== */
const fetchNuoviPost = (subName: string, sortBy: RedditSortBy, sub: RedditSub): Promise<RedditSub> => {
    return new Promise((resolve, reject) => {
        const after: string = sub.after ? (`?after=${sub.after}`) : "";
        const url: string = `https://www.reddit.com/r/${subName}/${sortBy}/.json${after}`;  // URL setup

        axios.get(url, { headers: { 'user-agent': '*' } }).then(r => r.data)
        // fetch(url, { headers: { 'user-agent': '*' } }).then(response => response.json()) // Gets subreddit informations and converts response to JSON
            .then((body: any) => {
                const childs: any = body?.data?.children;                                       // Tries to retrieve the posts (contained in children)
                if (!childs || !childs.length) return reject("Invalid subreddit: no posts");    // No posts: invalid subreddit

                /* ==== RedditPosts Parsing ==================================================== */
                const tempPosts: RedditPost[] = [];                                             // Temporary array that contains parsed response posts
                for(const { data } of childs)                                                   // For each child, only gets useful informations from data
                    if(data.subreddit && !data.stickied)                                        // Checks to avoid pinned posts and ghost subreddits
                        tempPosts.push({
                            ups:                        data.ups,
                            num_comments:               data.num_comments,
                            over_18:                    data.over_18,

                            title:                      data.title,
                            subreddit_name_prefixed:    data.subreddit_name_prefixed,
                            permalink:                  data.permalink,
                            url_overridden_by_dest:     data.url_overridden_by_dest,
                            url:                        data.url,
                            selftext:                   data.selftext,
                            post_hint:                  data.post_hint,

                            media:                      data.media?.reddit_video ? { reddit_video: { fallback_url: data.media.reddit_video.fallback_url } } : undefined,
                            media_metadata:             data.media_metadata,                    // Presente solo se c'è un media (???)
                            gallery_data:               data.gallery_data,                      // Presente solo se è una gallery
                            crosspost_parent:           data.crosspost_parent,                  // Presente solo se è un crosspost, altrimenti undefined
                            //html: data.media?.oembed?.html:null});
                        })
            
                if (!tempPosts.length) return reject("Invalid subreddit: no valid posts");      // No item taken, invalid subreddit

                sub.posts = tempPosts;                                                          // Update posts
                sub.after = body.data.after;                                                    // Update after for the next fetch
                resolve(sub);
            })
            .catch(e => reject(e));                                                             // In case of HTTP errors
    })
}

/* ==== Posts Information Parsing ================================================================================================================================ */
export const sendPost = (post: RedditPost, risp: Message | CommandInteraction): Promise<void> => {
    return new Promise((resolve, reject) => {
        try {
            post = JSON.parse(he.decode(JSON.stringify(post)));                                                              // Remove all the html encodings
            post.selftext = he.decode(post.selftext);

            /* ==== Check NSFW ========================================================================= */
            if(post.over_18 && risp.channel instanceof TextChannel && !risp.channel?.nsfw)
                return risp.reply({ embeds: [new EmbedBuilder()
                    .setColor(Number.parseInt(process.env.EMBED_COLOR) as ColorResolvable)
                    .setTitle("This channel is not NSFW.")
                    .setFooter({text: "The post you are trying to view is NSFW. Try again in another channel. "})]});
        
            /* ==== Check Crosspost ==================================================================== */
            if (post.crosspost_parent)                                                                                          // If it's a crosspost, fetch again the post
                resolve(
                    axios.get(`https://www.reddit.com/by_id/${post.crosspost_parent}.json`, { headers: { "user-agent": "*" } })
                // return fetch(`https://www.reddit.com/by_id/${post.crosspost_parent}.json`, { headers: { "user-agent": "*" } })  // Given the id fetch the post
                //     .then(response => response.json())                                                                          // JSON parse
                    .then(async (body: any) => await sendPost(body.data.children[0].data, risp))                                // Send again
                    .catch(e => reject(e))
                );
        
            /* ==== Check Gallery ====================================================================== */
            if (post.gallery_data) {                                            // If there's a data gallery
                risp.reply(`**${post.title}**`);
                for (const { s } of Object.values(post.media_metadata) as any)  // Loops through object properties, print image links
                    try{ risp.channel.send(s.u ?? s.gif); } catch(e){}
                return;                                                         // After looping, exit
            }
        
            /* ==== Post Send ========================================================================== */
            switch (post.post_hint) {
                case "image":
                    risp.reply({ embeds: [new EmbedBuilder()
                        .setColor(Number.parseInt(process.env.EMBED_COLOR))
                       .setAuthor({name: post.subreddit_name_prefixed})
                       .setTitle(`${post.title.substring(0, 256)}`)
                       .setURL(`https://www.reddit.com${post.permalink}`)
                       .setImage(post.url)
                       .setFooter({text: `👍🏿 ${post.ups}     ✉️ ${post.num_comments}`})] });
                    break;
                
                case "link":
                    risp.reply(`**${post.title}**\n${post.url || post.url_overridden_by_dest || ""}`);
                    break;
        
                case "rich:video":
                    var title = `**${post.title}**`;
                    risp.reply(title + "\n" + post.url_overridden_by_dest);
                    break;
        
                case "hosted:video":                                        // Discord ora supporta i video embedded di Reddit
                    risp.reply("https://www.reddit.com" + post.permalink);
                    break;

                //case "self":
                //case undefined:
                default:
                    var title = `**${post.title}**`;
                    const a: string = post.media?.reddit_video?.fallback_url || post.url_overridden_by_dest || "";
                    if(a /* || !post.selftext */) return risp.reply(title + "\n" + a);

                    const embed = new EmbedBuilder()
                        .setColor(Number.parseInt(process.env.EMBED_COLOR))
                        .setAuthor({name: post.subreddit_name_prefixed})
                        // .setTitle(title)
                        // .addField("­", title)
                        // .addField(`­`, post.selftext.substring(0, 1000))
                        .setURL(`https://www.reddit.com${post.permalink}`)
                        .setFooter({text: `👍🏿 ${post.ups}     ✉️ ${post.num_comments}`});
        
                    if(title.length > 255) embed.addFields({name: "­", value: title});
                    else embed.setTitle(title);
        
                    if(!post.selftext) return risp.reply({ embeds: [embed] });
        
                    const tooLong: boolean = title.length + post.selftext.length > 5950 || !!post.media_metadata;
        
                    if(tooLong) risp.reply(title + "\n" + post.selftext.substring(0, 1000));
                    else embed.addFields({name: "­", value: `**${post.selftext.substring(0, 1000)}**`});
        
                    for (let i = 1; i < Math.floor(post.selftext.length / 1000) + 1; i++)
                        if(tooLong) risp.channel.send(post.selftext.substring(0 + (1000 * i), 1000 * (i + 1)));
                        else embed.addFields({name: "­", value: `**${post.selftext.substring(0 + (1000 * i), 1000 * (i + 1))}**`});
                    // risp.channel.send(post.selftext.substring(0 + (1000 * i), 1000 * (i + 1)));
                    if(!tooLong) risp.reply({ embeds: [embed] });

                    break;
            }
        } catch (e) {
            reject(e);
        }
    });
}