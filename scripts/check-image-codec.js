/** Comprobación local del conversor; no lee la configuración ni accede a la base de datos. */
async function check() {
  const sharp = require('sharp');
  if (sharp.versions.sharp !== '0.35.4') throw new Error('Falta la versión del conversor indicada por U038.');
  const input = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#dfab3d' } }).png().toBuffer();
  const Codec = require('../src/domain/ImageCodec'), output = await Codec.toWebp('data:image/png;base64,' + input.toString('base64'));
  if (Codec.mime(output) !== 'image/webp' || (await sharp(output).metadata()).format !== 'webp') throw new Error('El conversor WebP no está disponible.');
}
if (require.main === module) check().then(() => console.log('CONVERSIÓN WEBP U038 DISPONIBLE.')).catch(() => { console.error('Falta preparar el conversor WebP U038. Repite el instalador del parche.'); process.exitCode = 1; });
module.exports = { check };
