import axios from 'axios';
import { Logger } from '../classes/Logger';
const supportedLanguages = new Set(['af', 'sq', 'am', 'ar', 'hy', 'az', 'eu', 'be', 'bn', 'bs', 'bg', 'ca', 'ceb', 'zh-CN', 'zh-TW', 'co', 'hr', 'cs', 'da', 'nl', 'en', 'eo', 'et', 'fi', 'fr', 'fy', 'gl', 'ka', 'de', 'el', 'gu', 'ht', 'ha', 'haw', 'iw', 'hi', 'hmn', 'hu', 'is', 'ig', 'id', 'ga', 'it', 'ja', 'jv', 'kn', 'kk', 'km', 'rw', 'ko', 'ku', 'ky', 'lo', 'la', 'lv', 'lt', 'lb', 'mk', 'mg', 'ms', 'ml', 'mt', 'mi', 'mr', 'mn', 'my', 'ne', 'no', 'ny', 'or', 'ps', 'fa', 'pl', 'pt', 'pa', 'ro', 'ru', 'sm', 'gd', 'sr', 'st', 'sn', 'sd', 'si', 'sk', 'sl', 'so', 'es', 'su', 'sw', 'sv', 'tl', 'tg', 'ta', 'tt', 'te', 'th', 'tr', 'tk', 'uk', 'ur', 'ug', 'uz', 'vi', 'cy', 'xh', 'yi', 'yo', 'zu']);

/**
 * Translates a given text
 * @param {string} query text to translate
 * @param {string} toLang the language the text will be translated to
 * @param {string} fromLang the original text language
 * @returns {Promise<string>}
 */
const translate = async (query: string, toLang: string, fromLang: string = 'auto') : Promise<string | void> => {
    if(!toLang) return;
    if(!supportedLanguages.has(toLang)) return;     // Returns if toLang is invalid

    return new Promise((resolve, reject) => {
        axios.post(`https://translate.google.it/_/TranslateWebserverUi/data/batchexecute?rpcids=MkEWBc&client=gtx&f.sid=-7075841764636485169&bl=boq_translate-webserver_20210215.17_p0&hl=it&soc-app=1&soc-platform=1&soc-device=1&_reqid=1944506&rt=c`,
                        `f.req=%5B%5B%5B%22MkEWBc%22%2C%22%5B%5B%5C%22${encodeURI(query)}%5C%22%2C%5C%22${fromLang}%5C%22%2C%5C%22${toLang}%5C%22%2Ctrue%5D%2C%5Bnull%5D%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&at=AD08yZm8SCo9gO2LTBwTCjgyWhJQ%3A1613560907885&`,
                        { headers: {'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',}})
            .then(result => {   // Finds the text to output in the... whatever this is supposed to be
                let output: string = '';
                console.log(result.data);
                (JSON.parse(JSON.parse(((result.data as string).substring(7).replace(/[0-9]{2,4}\n\[\[/g,`\n[[`)).split('\n\n')[0])[0][2])[1][0][0][5]).forEach(res => output += res[0]+' ');
                resolve(output);
            }).catch(e => reject(e));
    })
}

const OFFSET = 127397 - 32;                                             //  Distance between special flag characters and normal lowerCase letters (UNICODE)
/**
 * Function copied from the internet that converst flag emojis to normal letters.
 * Loops for each flag element (char?), returns array of c.codePointAt() - OFFSET, returns string from normalized characters in the array.
 * @param {string} flag unicode flag emoji
 * @returns 
 */
const emojiCountryCode = (flag) : string => String.fromCodePoint(...([...flag].map(c => c.codePointAt() - OFFSET)));

/**
 * Translates a given text from italian to napoletano
 * @param {string} query text to translate
 * @returns {Promise<string>}
 */
const translateNapoli = async (query: string) : Promise<string> => {
    // Returns a buffer, so I can properly parse the data (website doesn't return utf-8, but latin1/ascii/iso8859-1/... (synonims))
    return await axios.post("http://www.napoletano.info/italiano-napoletano.asp", "testo=" + escape(query),
                            { responseType: "arraybuffer", headers: { "content-type": "application/x-www-form-urlencoded" }})
        .then(response => response.data)
        .then((resultBuffer: Buffer) => {
            // Finds the text to output in the html
            const str: string = resultBuffer.toString("latin1");        // Converts bytes into string
            const ric: string = "<span class='Stile3'>";
            const a: number = str.indexOf(ric) + ric.length;
            const b: number = str.indexOf("</span>", a)                 // Finds string contained between two strings
            return str.substring(a, b).replace(/ +/g,' ');
        });
}

export { translate };
export { translateNapoli };
export { emojiCountryCode };