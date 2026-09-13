/** Una imagen por producto. Participa en la transacción del catálogo o de la compra; no crea archivos huérfanos. */
const crypto = require('node:crypto');
class ProductPhotoRepository {
  constructor(pool) { this.pool = pool; }
  async save(c, productId, photo) {
    if (photo === undefined) return;
    if (photo === null) { await c.query('DELETE FROM producto_imagen WHERE id_producto=?', [productId]); return; }
    const bytes = Buffer.from(photo.slice(23), 'base64'), hash = crypto.createHash('sha256').update(bytes).digest('hex');
    await c.query('INSERT INTO producto_imagen(id_producto,contenido,hash) VALUES(?,?,?) ON DUPLICATE KEY UPDATE contenido=?,hash=?', [productId, bytes, hash, bytes, hash]);
  }
  async read(productId) {
    const [[row]] = await this.pool.query('SELECT contenido AS bytes FROM producto_imagen WHERE id_producto=?', [productId]);
    return row;
  }
}
module.exports = ProductPhotoRepository;
