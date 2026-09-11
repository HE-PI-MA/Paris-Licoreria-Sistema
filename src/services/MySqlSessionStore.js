/** Guarda las sesiones y su expiración en MySQL, compartidas entre instancias. */
const { Store } = require('express-session');
const safeLog = require('../utils/safeLog');

class MySqlSessionStore extends Store {
  constructor(pool) {
    super();
    this.pool = pool;
    // Limpieza acotada; no mantiene vivo el proceso después del cierre del servidor.
    this.cleanup = setInterval(() => {
      this.pool.execute('DELETE FROM sesion_web WHERE expires_at <= ? LIMIT 1000', [Date.now()])
        .catch(error => safeLog('SESSION_CLEANUP_FAILED', error));
    }, 15 * 60 * 1000);
    this.cleanup.unref();
  }
  expiration(session) {
    const expiry = new Date(session.cookie?.expires).getTime();
    return Number.isFinite(expiry) ? expiry : Date.now() + 8 * 60 * 60 * 1000;
  }
  get(sid, done) {
    this.pool.execute('SELECT data FROM sesion_web WHERE sid = ? AND expires_at > ?', [sid, Date.now()])
      .then(([rows]) => done(null, rows.length ? JSON.parse(rows[0].data) : null))
      .catch(done);
  }
  set(sid, value, done = () => {}) {
    let serialized;
    try { serialized = JSON.stringify(value); } catch (error) { return done(error); }
    this.pool.execute('INSERT INTO sesion_web (sid, expires_at, data) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE expires_at = ?, data = ?',
      [sid, this.expiration(value), serialized, this.expiration(value), serialized])
      .then(() => done()).catch(done);
  }
  touch(sid, value, done = () => {}) {
    this.pool.execute('UPDATE sesion_web SET expires_at = ? WHERE sid = ?', [this.expiration(value), sid])
      .then(() => done()).catch(done);
  }
  destroy(sid, done = () => {}) {
    this.pool.execute('DELETE FROM sesion_web WHERE sid = ?', [sid]).then(() => done()).catch(done);
  }
  close() { clearInterval(this.cleanup); }
}
module.exports = MySqlSessionStore;
