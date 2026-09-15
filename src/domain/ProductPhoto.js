/** Valida la foto opcional. Conserva la normalización JPEG histórica para reintentos; el repositorio guarda WebP. */
const jpeg = require('../vendor/jpeg-js');
const ImageCodec = require('./ImageCodec');
class ProductPhoto {
  static maxBytes = ImageCodec.maxInputBytes;
  static optional(body, cache = new Map()) {
    if (body.photo === undefined) return {};
    if (body.photo === null) return { photo: null };
    if (cache.has(body.photo)) return { photo: cache.get(body.photo) };
    try {
      const value = body.photo;
      const { bytes, mime } = ImageCodec.parse(value);
      // PNG y WebP se decodifican completamente antes de escribir, en ImageCodec.toWebp.
      if (mime !== 'image/jpeg') { cache.set(value, value); return { photo: value }; }
      const raw = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, tolerantDecoding: false, maxResolutionInMP: 1, maxMemoryUsageInMB: 32 });
      if (!raw.width || !raw.height || raw.width > 768 || raw.height > 768) throw new Error();
      const clean = jpeg.encode({ width: raw.width, height: raw.height, data: raw.data }, 75).data;
      if (clean.length > this.maxBytes) throw new Error();
      const photo = 'data:image/jpeg;base64,' + clean.toString('base64');
      cache.set(value, photo);
      return { photo };
    } catch (_) { throw ImageCodec.error(); }
  }
}
module.exports = ProductPhoto;
