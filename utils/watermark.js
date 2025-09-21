const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

exports.applyWatermark = async (inputPath, outputPath) => {
  try {
    // Path to your transparent watermark image
    const watermarkPath = path.join(__dirname, 'water.png');

    // Create a temporary output path if input and output are the same
    let finalOutputPath = outputPath;
    if (inputPath === outputPath) {
      finalOutputPath = path.join(path.dirname(outputPath), `temp_${path.basename(outputPath)}`);
    }

    // Apply watermark (overlay full transparent image)
    await sharp(inputPath)
      .composite([
        {
          input: watermarkPath,
          blend: 'over' // 'over' keeps transparency
        }
      ])
      .toFile(finalOutputPath);

    // Replace original if necessary
    if (inputPath === outputPath) {
      fs.renameSync(finalOutputPath, outputPath);
    }

    return true;
  } catch (error) {
    console.error('Error applying watermark:', error);
    throw error;
  }
};
