/* ==== Imports =========================================================================================================================== */
import { Logger } from "../classes/Logger";
import { Event } from "../interfaces/Event"
import { HaramLeottaInstance } from "..";
import { ActivityType } from "discord.js";

/* ==== Events ============================================================================================================================ */
export const loginEvent: Event = {
    name: "ready",
    fn: async () => {
        HaramLeottaInstance.user.setPresence({ activities: [{ name: "HaramLeotta", type: ActivityType.Listening }], status: 'idle' });
        // await populateStationsPool();
        Logger.info(`========= Bot deployed on version ${process.env.VERSION} =========`);
    }
}