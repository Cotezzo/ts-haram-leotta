import { DataResolver } from 'discord.js';
import Jimp from 'jimp';
import { OverlapOptions } from '../interfaces/OverlapOptions';

/**
 * Overlaps different images, given their path and some options
 * @param {string} inputPath link of the first image
 * @param {string} outputPath name or path of the image (always inside ./img/ folder, automatically translates to png)
 * @param {options[]} optionsArray options for every image to add over the first one
 * @returns {Promise<void>}
 */
export const overlap = async (inputPath: string, optionsArray: OverlapOptions[]) : Promise<any> => {
    const firstInputImage = await Jimp.read(inputPath);                                                 // Reads the input image
    for(const {path, xPos, yPos, xRes, yRes, round} of optionsArray){                                   // For each set of options
            const nthInputImage = await Jimp.read(path);                                                // Reads the input image;
            nthInputImage.resize(xRes || nthInputImage.getWidth(), yRes || nthInputImage.getHeight());  // Resize the image
            if(round) nthInputImage.circle({ radius: xRes/2, x: xRes/2, y: yRes/2 });                   // Round the image
            firstInputImage.composite(nthInputImage, xPos || 0, yPos || 0);                             // Composite the two images (base, nth)
    }
    const buffer = await firstInputImage.getBufferAsync(firstInputImage.getMIME());                     // Convert image as buffer
    return await DataResolver.resolveFileAsBuffer(buffer);                                              // Return the Discord resolved image
}