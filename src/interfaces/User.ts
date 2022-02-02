import { Song } from "./Song";

export interface User {
	_id: string;
    prefix?: string;
    favourites: Song[];
}