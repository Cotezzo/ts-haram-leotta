export const japTest = /[^一-龯ぁ-ゔゞァ-・ヽヾ゛゜ー～「」　]/g;                                     //emoji: \u00a9\u00ae\u2000-\u3300\ud83c\ud000-\udfff\ud83d\ud000-\udfff\ud83e\ud000-\udfff
export const japBrack = /[^【】]/g;

export const formatSchifo = (str: string, i: number, max: number) => {
    const num = (i + 1).toString().length - 1;
    str = str.length > (max - 1) ? str.substring(0, max) + '…' : str;
    let bo = false;
    let a = str.replace(japTest, '').length;
    let b = str.replace(japBrack, '').length;
    while (str.length + a + b - Math.floor(a / 6) + num > max) {
        bo = true;
        const cha = str.slice(-1);
        str = str.slice(0, -1);
        if (!japTest.test(cha))
            a = str.replace(japTest, '').length;
        else if (!japBrack.test(cha))
            b = str.replace(japBrack, '').length;
    }
    if (bo) str += '…';
    for (let i = str.length + a + b - Math.floor(a / 5) + num; i < 50; i++) str += ' ';
    return str;
}

export const secondsToString = (ss: number): string => {
    let mm = Math.floor(ss / 60);
    ss = ss % 60;
    let hh = Math.floor(mm / 60);
    mm = mm % 60;
    return `${hh ? `${hh}:` : ''}${mm ? (mm > 9 ? `${mm}:` : (hh ? `0${mm}:` : `${mm}:`)) : hh ? `00:` : `0:`}${(ss < 10) ? `0${ss}` : ss}`;
}

export const stringToSeconds = (str: string): number => {
    let arr = str.split(':');
    if (arr[2]) return +arr[0] * 60 * 60 + +arr[1] * 60 + +arr[2];
    if (arr[1]) return +arr[0] * 60 + +arr[1];
    return +arr[0];
}