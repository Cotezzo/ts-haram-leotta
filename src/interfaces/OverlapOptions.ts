export interface OverlapOptions {
    path: string;               // Image link

    xPos: number | undefined;   // Image top left position
    yPos: number | undefined;   // Image top left position

    xRes: number | undefined;   // New image resolution 
    yRes: number | undefined;   // New image resolution

    round: boolean | undefined; // Round the image
}