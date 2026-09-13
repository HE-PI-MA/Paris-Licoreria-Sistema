/** Fotografía opcional: JPEG pequeño, decodificado y reescrito sin metadatos ni nombres de archivo del cliente. */
const jpeg = require('../vendor/jpeg-js');
const { RecordError } = require('./RecordInput');
class ProductPhoto {
  static maxBytes = 256 * 1024;
  static optional(body, cache = new Map()) {
    if (body.photo === undefined) return {};
    if (body.photo === null) return { photo: null };
    if (cache.has(body.photo)) return { photo: cache.get(body.photo) };
    try {
      const value = body.photo;
      if (typeof value !== 'string' || value.length > 350000 || !/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error();
      const encoded = value.slice(23), bytes = Buffer.from(encoded, 'base64');
      if (bytes.length > this.maxBytes || bytes.toString('base64') !== encoded) throw new Error();
      const raw = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true, tolerantDecoding: false, maxResolutionInMP: 1, maxMemoryUsageInMB: 32 });
      if (!raw.width || !raw.height || raw.width > 768 || raw.height > 768) throw new Error();
      const clean = jpeg.encode({ width: raw.width, height: raw.height, data: raw.data }, 75).data;
      if (clean.length > this.maxBytes) throw new Error();
      const photo = 'data:image/jpeg;base64,' + clean.toString('base64');
      cache.set(value, photo);
      return { photo };
    } catch (_) { throw new RecordError(422, 'No se pudo usar esa foto. Selecciona otra imagen.', { photoState: 'Usa una foto JPG, PNG o WebP desde el selector del formulario.' }); }
  }
}
module.exports = ProductPhoto;
