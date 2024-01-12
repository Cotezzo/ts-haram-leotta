import { Message, User } from "discord.js";
import { HaramLeottaInstance } from "..";
import { Song } from "../interfaces/Song";
import { User as IUser } from "../interfaces/User";
import { UserModel } from "../database/model/UserModel";

const getUser = async (_id: string): Promise<any> => {
    let user = await UserModel.findById(_id);           // Retrieves user
    if (!user) user = new UserModel({ _id });           // Creates it if it doesn't exist
    return user;
}

// Database stuff
export const updatePrefix = (_id: string, prefix: string): Promise<Boolean> => {
    return new Promise(async (resolve, reject) => {
        try {
            const user = await getUser(_id);
            // var user = await UserModel.findById(_id);        // Retrieves user
            // if (!user) user = new UserModel({ _id });        // Creates it if it doesn't exist
            user.prefix = prefix.toLowerCase();                 // Save the new prefix
            await user.save();                                  // Save User to the database

            resolve(true);                                      // Success
        } catch (e) {
            reject(false);                                      // Failure
        }
    })
}

export const getPrefix = (_id: string): Promise<string | undefined> => {
    return new Promise(async (resolve, reject) => {
        try{
            const user: IUser = await UserModel.findById(_id);           // Retrieves user
            const prefix: string = user?.prefix;
            if(!prefix) return resolve(undefined);
            resolve(prefix);
        }catch(e){
            console.log(e);
            resolve(undefined);
        }
    })
}

export const getFavourites = (_id: string): Promise<Song[] | undefined> => {
    return new Promise(async (resolve, reject) => {
        try{
            const user = await getUser(_id);
            resolve(user?.favourites?.map((song: Song): Song => { return { title: song.title, url: song.url, lengthSeconds: song.lengthSeconds, lengthString: song.lengthString, thumbnail: song.thumbnail, type: song.type }}));
        }catch(e){
            console.log(e);
            resolve(undefined);
        }
    })
}

export const addFavourite = (_id: string, { title, url, lengthString, lengthSeconds, thumbnail, type } : Song): Promise<boolean | undefined> => {
    return new Promise(async (resolve, reject) => {
        try{
            const user = await getUser(_id);
            user.favourites.push({ title, url, lengthString, lengthSeconds, thumbnail, type });
            user.save();
            resolve(true);
        }catch(e){
            console.log(e);
            resolve(undefined);
        }
    })
}

export const removeFavourites = (_id: string, index: number, howMany: number = 1): Promise<boolean | undefined> => {
    return new Promise(async (resolve, reject) => {
        try{
            const user = await getUser(_id);
            user.favourites.splice(index, howMany);
            user.save();
            resolve(true);
        }catch(e){
            console.log(e);
            resolve(undefined);
        }
    })
}

// Discord stuff
export const getUserFromMention = (msg: Message, mention): Promise<User | null> => {
    return new Promise(async (resolve, reject) => {
        try {
            if (!mention) return resolve(null);
            if (mention.startsWith('<@') && mention.endsWith('>')) {
                mention = mention.slice(2, -1);
                if (mention.startsWith('!'))
                    mention = mention.slice(1);
                resolve(HaramLeottaInstance.users.cache.get(mention));
            } else                                                                          //Se msg è un normale nome come stringa
                resolve(await getUserFromText(msg, mention));                               //La cerco nel server tramite getUserFromText
        } catch (e) {
            resolve(null);
        }
    })
}

export const getUserFromText = (msg: Message, strQuery: string): Promise<User> => {
    return new Promise((resolve, reject) => {
        msg.guild.members.fetch({ query: strQuery, limit: 1 })                              //Faccio una query a Discord con la stringa da ricercare
            .then(member => resolve(Array.from(member)[0][1].user))                         //Se esiste un utente, lo ritorno
            .catch(e => reject(e))
    })
}