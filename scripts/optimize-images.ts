import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const PUBLIC_DIR = path.resolve(process.cwd(), 'public');

export async function optimizeAllImages() {
  if (!fs.existsSync(PUBLIC_DIR)) return;

  const files = fs.readdirSync(PUBLIC_DIR);
  
  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const baseName = path.basename(file, ext);
    const filePath = path.join(PUBLIC_DIR, file);

    // Process source JPEG and PNG files
    if (['.jpg', '.jpeg', '.png'].includes(ext) && !file.includes('_mobile') && !file.includes('_thumb')) {
      try {
        const imageBuffer = fs.readFileSync(filePath);
        const metadata = await sharp(imageBuffer).metadata();
        const width = metadata.width || 1200;

        // 1. Generate ultra-optimized AVIF
        const avifPath = path.join(PUBLIC_DIR, `${baseName}.avif`);
        await sharp(imageBuffer)
          .avif({ quality: 80, effort: 4 })
          .toFile(avifPath);

        // 2. Generate ultra-optimized WebP
        const webpPath = path.join(PUBLIC_DIR, `${baseName}.webp`);
        await sharp(imageBuffer)
          .webp({ quality: 85, effort: 4 })
          .toFile(webpPath);

        // 3. Generate responsive multi-breakpoint AVIF & WebP (360w, 480w, 768w, 1080w, 1440w)
        if (baseName.includes('landing') || baseName.includes('poster') || baseName.includes('photo')) {
          const responsiveWidths = [360, 480, 768, 1080, 1440];

          for (const targetWidth of responsiveWidths) {
            const actualWidth = Math.min(targetWidth, width);
            
            // AVIF responsive
            const resAvifPath = path.join(PUBLIC_DIR, `${baseName}_${targetWidth}w.avif`);
            await sharp(imageBuffer)
              .resize({ width: actualWidth, withoutEnlargement: true })
              .avif({ quality: targetWidth <= 480 ? 65 : targetWidth <= 768 ? 72 : 80, effort: 4 })
              .toFile(resAvifPath);

            // WebP responsive
            const resWebpPath = path.join(PUBLIC_DIR, `${baseName}_${targetWidth}w.webp`);
            await sharp(imageBuffer)
              .resize({ width: actualWidth, withoutEnlargement: true })
              .webp({ quality: targetWidth <= 480 ? 70 : targetWidth <= 768 ? 78 : 85, effort: 4 })
              .toFile(resWebpPath);
          }

          // Legacy mobile aliases for backward compatibility (points to 480w optimized)
          const mobileAvifPath = path.join(PUBLIC_DIR, `${baseName}_mobile.avif`);
          const mobileWebpPath = path.join(PUBLIC_DIR, `${baseName}_mobile.webp`);
          if (fs.existsSync(path.join(PUBLIC_DIR, `${baseName}_480w.avif`))) {
            fs.copyFileSync(path.join(PUBLIC_DIR, `${baseName}_480w.avif`), mobileAvifPath);
          }
          if (fs.existsSync(path.join(PUBLIC_DIR, `${baseName}_480w.webp`))) {
            fs.copyFileSync(path.join(PUBLIC_DIR, `${baseName}_480w.webp`), mobileWebpPath);
          }
        }

        // 4. Compress the raw JPEG file if it exceeds 250KB
        if ((ext === '.jpg' || ext === '.jpeg') && imageBuffer.length > 250000) {
          const compressedJpgBuffer = await sharp(imageBuffer)
            .jpeg({ quality: 70, progressive: true, mozjpeg: true })
            .toBuffer();
          fs.writeFileSync(filePath, compressedJpgBuffer);
        }
      } catch (err) {
        console.error(`Error optimizing image ${file}:`, err);
      }
    }
  }
}

// Check if executed directly from CLI
const isDirectExecution = process.argv[1]?.endsWith('optimize-images.ts') || process.argv[1]?.endsWith('optimize-images.js');

if (isDirectExecution) {
  optimizeAllImages().then(() => {
    console.log('✅ Image optimization complete: Ultra-optimized AVIF, WebP, and responsive assets generated.');
  }).catch((err) => {
    console.error('Image optimization failed:', err);
  });
}
