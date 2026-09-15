/** U038: conversión real, límites, formato servido y compatibilidad con fotos previas. */
const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const sharp = require('sharp'), Codec = require('../src/domain/ImageCodec'), Repository = require('../src/repositories/ProductPhotoRepository');
const { image } = require('./support/media-fixture');
const uri = (mime, bytes) => 'data:image/' + mime + ';base64,' + bytes.toString('base64');
test('U038: JPEG, PNG y WebP terminan como WebP pequeño sin metadatos', async () => {
  const jpg = image(), png = await sharp(jpg).png().toBuffer(), webp = await sharp(jpg).webp().toBuffer();
  for (const [mime, bytes] of [['jpeg', jpg], ['png', png], ['webp', webp]]) {
    const marked = await sharp(bytes).withMetadata({ orientation: 6 }).toFormat(mime).toBuffer();
    const output = await Codec.toWebp(uri(mime, marked)), meta = await sharp(output).metadata();
    assert.equal(Codec.mime(output), 'image/webp'); assert.equal(meta.format, 'webp');
    assert.ok(meta.width <= 768 && meta.height <= 768); assert.ok(output.length <= 128 * 1024);
    for (const field of ['exif', 'icc', 'xmp', 'iptc', 'orientation']) assert.equal(meta[field], undefined);
  }
  assert.ok((await Codec.toWebp(uri('jpeg', jpg))).length < jpg.length);
});
test('U038: rechaza archivos falsos, truncados, animados y dimensiones o bytes excesivos', async () => {
  const large = await sharp({ create: { width: 769, height: 10, channels: 3, background: 'red' } }).png().toBuffer();
  const small = await sharp(image()).webp().toBuffer();
  const frames = Buffer.alloc(4 * 8 * 16, 255);
  for (let i = 0; i < 8 * 16; i++) { frames[i * 4 + 1] = 0; frames[i * 4 + (i < 64 ? 2 : 0)] = 0; }
  const animated = await sharp(frames, { raw: { width: 8, height: 16, channels: 4, pageHeight: 8 } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
  assert.equal((await sharp(animated).metadata()).pages, 2);
  for (const value of [uri('png', large), uri('webp', small.subarray(0, -1)), uri('jpeg', small), uri('webp', animated), uri('png', Buffer.from('<svg/>')), uri('png', Buffer.alloc(300000)), 'data:image/webp;base64,AAAA']) {
    await assert.rejects(Codec.toWebp(value), e => e.status === 422 && Boolean(e.fieldErrors.photoState));
  }
});
test('U038: el repositorio almacena bytes WebP y hash de esos bytes; conservar o quitar no convierte', async () => {
  const calls = [], c = { query: async (...args) => calls.push(args) }, repo = new Repository();
  await repo.save(c, 7, undefined); assert.equal(calls.length, 0);
  await repo.save(c, 7, uri('jpeg', image()));
  const values = calls[0][1]; assert.equal(Codec.mime(values[1]), 'image/webp'); assert.equal(values[2], crypto.createHash('sha256').update(values[1]).digest('hex'));
  await repo.save(c, 7, null); assert.match(calls[1][0], /^DELETE/);
  const count = calls.length;
  await assert.rejects(repo.save(c, 7, 'data:image/webp;base64,AAAA'), e => e.status === 422); assert.equal(calls.length, count);
});
test('U038: el servicio distingue JPEG antiguo y WebP nuevo sin cambiar los bytes', async () => {
  let bytes = image();
  const service = new (require('../src/services/ProductService'))({ photos: { read: async () => ({ bytes }) } });
  assert.equal((await service.photo(1)).contentType, 'image/jpeg');
  bytes = await Codec.toWebp(uri('jpeg', bytes)); const result = await service.photo(1);
  assert.equal(result.contentType, 'image/webp'); assert.deepEqual(result.bytes, bytes);
});
