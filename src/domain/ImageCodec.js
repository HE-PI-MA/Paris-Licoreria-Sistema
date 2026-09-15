/** Conversión única de imágenes guardadas: WebP real, tamaño limitado y sin metadatos. */
const sharp = require('sharp');
const { RecordError } = require('./RecordInput');
class ImageCodec {
  static maxInputBytes = 256 * 1024;
  static maxSide = 768;
  static targetBytes = 80 * 1024;
  static maxBytes = 128 * 1024;
  static error() { return new RecordError(422, 'No se pudo usar esa foto. Selecciona otra imagen.', { photoState: 'Usa una foto JPG, PNG o WebP desde el selector del formulario.' }); }
  /** Identifica los bytes, nunca la extensión ni el nombre enviado por el navegador. */
  static mime(bytes) {
    if (!Buffer.isBuffer(bytes)) return null;
    if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP' && bytes.readUInt32LE(4) === bytes.length - 8) return 'image/webp';
    if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) return 'image/jpeg';
    if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
    return null;
  }
  static parse(value) {
    if (typeof value !== 'string' || value.length > 350000) throw this.error();
    const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
    if (!match) throw this.error();
    const bytes = Buffer.from(match[2], 'base64');
    if (!bytes.length || bytes.length > this.maxInputBytes || bytes.toString('base64') !== match[2] || this.mime(bytes) !== match[1]) throw this.error();
    return { bytes, mime: match[1] };
  }
  static async toWebp(value) {
    try {
      const { bytes, mime } = this.parse(value);
      const source = sharp(bytes, { failOn: 'warning', limitInputPixels: this.maxSide ** 2, sequentialRead: true });
      const info = await source.metadata();
      if ('image/' + info.format !== mime || !info.width || !info.height || info.width > this.maxSide || info.height > this.maxSide || (info.pages || 1) !== 1) throw this.error();
      let smallest;
      // Se intenta conservar detalle antes de reducir más la calidad o las dimensiones.
      for (const side of [this.maxSide, 640, 512]) {
        for (const quality of [80, 70, 60, 50]) {
          const output = await source.clone().rotate().resize({ width: side, height: side, fit: 'inside', withoutEnlargement: true })
            .webp({ quality, alphaQuality: 80, effort: 4 }).toBuffer();
          if (this.mime(output) !== 'image/webp') throw this.error();
          if (!smallest || output.length < smallest.length) smallest = output;
          if (output.length <= this.targetBytes) return output;
        }
      }
      if (smallest?.length <= this.maxBytes) return smallest;
      throw this.error();
    } catch (_) { throw this.error(); }
  }
}
module.exports = ImageCodec;
