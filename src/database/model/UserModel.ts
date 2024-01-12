import { mongoose } from '../Mongoose';
import { Song } from '../../interfaces/Song';
import { User } from '../../interfaces/User';

export const UserModel = mongoose.model<User>("User", new mongoose.Schema<User>({
    _id: { type: String, required: true },
    prefix: String,
    favourites: [ new mongoose.Schema<Song>({
        title: { type: String, required: true },
        url: { type: String, required: true },

        type: Number,
        lengthSeconds: Number,
        lengthString: String,
        thumbnail: String
    }) ]})
);