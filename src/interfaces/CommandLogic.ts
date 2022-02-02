/* ==== Interfaces ======================================================================================================================== */
export interface Command {
	fn(...args: any[]): any;                // Logic associated with the command

    name: string;
    aliases?: string;
    category?: string;
	description?: string;
	usage?: string;

    // cooldown?: number;
    // userPermissions?: string | string[];
}

export interface Commands<Command> {
    [command: string]: Command;
};