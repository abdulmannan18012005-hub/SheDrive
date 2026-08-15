const sharp = require('sharp');
const fs = require('fs');

const sourceImage = 'assets/ICON.jpeg';
const densities = [
  { name: 'mipmap-mdpi', size: 48 },
  { name: 'mipmap-hdpi', size: 72 },
  { name: 'mipmap-xhdpi', size: 96 },
  { name: 'mipmap-xxhdpi', size: 144 },
  { name: 'mipmap-xxxhdpi', size: 192 },
];

async function generateIcons() {
  try {
    for (const density of densities) {
      const outputPath = `android/app/src/main/res/${density.name}/ic_launcher.png`;
      const roundOutputPath = `android/app/src/main/res/${density.name}/ic_launcher_round.png`;
      
      await sharp(sourceImage)
        .resize(density.size, density.size, { fit: 'cover', position: 'center' })
        .png({ quality: 90 })
        .toFile(outputPath);
      
      await sharp(sourceImage)
        .resize(density.size, density.size, { fit: 'cover', position: 'center' })
        .png({ quality: 90 })
        .toFile(roundOutputPath);
      
      console.log(`Generated ${density.name} icons (${density.size}x${density.size})`);
    }
    
    // Also generate adaptive icon foreground (512x512)
    await sharp(sourceImage)
      .resize(512, 512, { fit: 'cover', position: 'center' })
      .png({ quality: 90 })
      .toFile('android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_foreground.png');
    
    console.log('Generated adaptive icon foreground (512x512)');
    console.log('All icons generated successfully!');
  } catch (error) {
    console.error('Error generating icons:', error);
  }
}

generateIcons();
