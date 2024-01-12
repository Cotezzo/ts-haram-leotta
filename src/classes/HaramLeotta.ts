/* ==== Imports =========================================================================================================================== */
import { Client } from 'discord.js';

import { loginEvent } from '../events/LoginEvent';
import { toListenEvents } from '../events/ToListenEvents';
import { ClassLogger, Logger } from './Logger';

/* ==== Class - Main class that rapresents the bot itself - On init, logs the bot into Discord and starts listening to the events ========= */
const logger = new ClassLogger("HaramLeotta");

export class HaramLeotta extends Client {
    public init = () => {
        const isProd = process.env.ENVIROMENT == "P" ? true : false;                // Check environment

        Logger.info(`======= Deploy started on enviroment ${isProd ? "PROD" : "TEST"} =======`);
        this.login(isProd ? process.env.PROD_TOKEN : process.env.TEST_TOKEN);       // Bot login
        
        this.once(loginEvent.name, loginEvent.fn.bind(null));//, this));            // On bot login event, execute only once        
        logger.info(`Listening on event '${loginEvent.name}'`);

        for(const event of toListenEvents){                                         // Event Listeners (loop through each event and start listening)
            this.on(event.name, event.fn.bind(null));
            logger.info(`Listening on event '${event.name}'`);
        }
    }
}