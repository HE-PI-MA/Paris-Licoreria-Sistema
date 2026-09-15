/** U038: escribe WebP, conserva JPEG anterior y revierte imágenes inválidas en MySQL temporal. */
const { test } = require('node:test'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const sharp = require('sharp'), Codec = require('../src/domain/ImageCodec');
const { database } = require('./support/inventory-mysql-fixture'), { image } = require('./support/media-fixture');
test('U038: formatos reales, compatibilidad, reintento anterior y rollback conjunto', { skip: process.env.PARIS_MYSQL_TEST !== '1', timeout: 60000 }, async () => {
  const db = await database(), repo = new (require('../src/repositories/ProductRepository'))(db.pool), service = new (require('../src/services/ProductService'))(repo);
  const Input = require('../src/domain/ProductInput').ProductInput;
  const key = () => crypto.randomUUID(), fields = { name: 'FOTO FICTICIA', categoryId: 1, unitId: 1, minimum: '0', description: '', state: 'ACTIVO' };
  const jpg = image(), uri = 'data:image/jpeg;base64,' + jpg.toString('base64');
  try {
    const old = await service.create(1, key(), fields);
    const legacy = Buffer.from(require('../src/domain/ProductPhoto').optional({ photo: uri }).photo.slice(23), 'base64');
    await db.owner.query('INSERT INTO producto_imagen(id_producto,contenido,hash) VALUES(?,?,?)', [old.id, legacy, crypto.createHash('sha256').update(legacy).digest('hex')]);
    assert.equal((await service.photo(old.id)).contentType, 'image/jpeg');
    let row = await service.detail(old.id); await service.update(1, key(), old.id, { ...fields, description: 'SOLO TEXTO', version: row.version });
    assert.deepEqual((await service.photo(old.id)).bytes, legacy);
    // Una respuesta JPEG perdida antes de U038 mantiene la misma huella y no repite el alta.
    const oldKey = key(), body = { ...fields, photo: uri }, hash = crypto.createHash('sha256').update(JSON.stringify(['product:create', Input.product(body)])).digest('hex');
    await db.owner.query('INSERT INTO catalogo_operacion(id_usuario,clave,solicitud_hash,resultado) VALUES(?,?,?,?)', [1, oldKey, hash, JSON.stringify(old)]);
    assert.deepEqual(await service.create(1, oldKey, body), old); assert.equal((await service.list({})).total, 1);
    const png = await sharp(jpg).png().toBuffer(); row = await service.detail(old.id);
    await service.update(1, key(), old.id, { ...fields, photo: 'data:image/png;base64,' + png.toString('base64'), version: row.version });
    const photo = await service.photo(old.id); assert.equal(photo.contentType, 'image/webp'); assert.equal((await sharp(photo.bytes).metadata()).format, 'webp'); assert.ok(photo.bytes.length < legacy.length);
    const broken = Buffer.alloc(30); broken.write('RIFF'); broken.writeUInt32LE(22, 4); broken.write('WEBPVP8 ', 8); broken.writeUInt32LE(10, 16);
    assert.equal(Codec.mime(broken), 'image/webp');
    await assert.rejects(service.create(1, key(), { ...fields, categoryId: undefined, categoryName: 'NO QUEDA', photo: 'data:image/webp;base64,' + broken.toString('base64') }), e => e.status === 422);
    assert.equal((await db.owner.query("SELECT COUNT(*) AS n FROM categoria WHERE nombre='NO QUEDA'"))[0][0].n, 0);
    assert.equal((await service.list({})).total, 1); assert.equal((await db.owner.query('SELECT COUNT(*) AS n FROM producto_imagen'))[0][0].n, 1);
    assert.equal((await service.detail(old.id)).stock, '0.000');
  } finally { await db.close(); }
});
