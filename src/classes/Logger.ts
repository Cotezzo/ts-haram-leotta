/* ==== Consts ============================================================================================================================ */
const RESET_COLOR = "\x1b[0m";

/* ==== Classes =========================================================================================================================== */
export class Logger {
    public static debug = (text: string): void => Logger.print("DBG", "\x1b[35m", text);
    public static log = (text: string): void => Logger.print("LOG", "\x1b[32m", text);
    public static info = (text: string): void => Logger.print("INF", "\x1b[36m", text);
    public static warn = (text: string): void => Logger.print("WRN", "\x1b[33m", text);
    public static error = (text: string): void => Logger.print("ERR", "\x1b[31m", text);
    
    private static print = (level: string, color: string, text: string): void =>
        console.log(`[\x1b[90m${new Date().toLocaleTimeString()}${RESET_COLOR}] [${color}${level}${RESET_COLOR}] ${text}`);
}

export class ClassLogger {
    private className: string;
    private isProd: boolean;
    
    constructor(className: string){
        this.className = className;
        this.isProd = process.env.ENVIROMENT === "P";
    }

    private a = (): string => `[\x1b[1m${this.className}${RESET_COLOR}] `;
    public debug =  (text: string): void => { if(!this.isProd) Logger.debug(this.a() + text); }
    public log =    (text: string): void => Logger.log(this.a() + text);
    public info =   (text: string): void => Logger.info(this.a() + text);
    public warn =   (text: string): void => Logger.warn(this.a() + text);
    public error =  (text: string): void => Logger.error(this.a() + text);
}

/*
    Bright: "\x1b[1m",
    Dim: "\x1b[2m",
    Underscore: "\x1b[4m",
    Blink: "\x1b[5m",
    Reverse: "\x1b[7m",
    Hidden: "\x1b[8m",
    Reset: "\x1b[0m",       // Reset coloured text

    FgRed: "\x1b[31m",
    FgGreen: "\x1b[32m",
    FgYellow: "\x1b[33m",
    FgCyan: "\x1b[36m",
    FgWhite: "\x1b[37m",

"\x1b[NUMEROm"


FG  BG

30	40	Black
31	41	Red
32	42	Green
33	43	Yellow
34	44	Blue
35	45	Magenta
36	46	Cyan
37	47	White
90	100	Bright Black (Gray)
91	101	Bright Red
92	102	Bright Green
93	103	Bright Yellow
94	104	Bright Blue
95	105	Bright Magenta
96	106	Bright Cyan
97	107	Bright White
*/