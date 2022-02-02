// import { ClientEvents } from "discord.js";

/* ==== Interfaces ======================================================================================================================== */
export interface Event {
    name: string;
    fn: (...args: any[]) => void;
}