import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_IMAGES_PER_PRODUCT = 12;

/** Validates real content (not the extension), strips metadata and re-encodes to WebP. */
export async function processImage(input: Buffer): Promise<{ full: Buffer; thumb: Buffer }> {
  const base = sharp(input, { limitInputPixels: 50_000_000 });
  const meta = await base.metadata();
  if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) throw new Error('Formato no admitido (solo JPEG, PNG o WebP).');
  const rotated = () => sharp(input, { limitInputPixels: 50_000_000 }).rotate();
  const [full, thumb] = await Promise.all([
    rotated().resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true }).webp({ quality: 80 }).toBuffer(),
    rotated().resize({ width: 640, height: 640, fit: 'cover' }).webp({ quality: 75 }).toBuffer(),
  ]);
  return { full, thumb };
}
