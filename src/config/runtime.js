/** Valida la configuración del servidor, secretos, origen HTTPS y proxies antes de aceptar peticiones. */
const net = require('net');
class ConfigurationError extends Error { constructor(message) { super(message); this.name = 'ConfigurationError'; } }
function runtime(env = process.env) {
  const production = env.NODE_ENV === 'production';
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32 || env.SESSION_SECRET.includes('cambiar_por')) {
    throw new ConfigurationError('SESSION_SECRET debe contener una clave privada de al menos 32 caracteres.');
  }
  const port = Number(env.PORT || 3100);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigurationError('PORT no es valido.');
  const origin = env.PUBLIC_ORIGIN ? new URL(env.PUBLIC_ORIGIN) : null;
  if (origin && (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash)) {
    throw new ConfigurationError('PUBLIC_ORIGIN debe ser solamente el origen: protocolo, dominio y puerto.');
  }
  const proxies = (env.TRUST_PROXY || '').split(',').map(v => v.trim()).filter(Boolean);
  for (const proxy of proxies) {
    if (proxy === 'loopback') continue;
    const [address, mask, extra] = proxy.split('/');
    const version = net.isIP(address);
    if (!version || extra || (mask !== undefined && (!/^\d+$/.test(mask) || Number(mask) <= 0 || Number(mask) > (version === 4 ? 32 : 128)))) {
      throw new ConfigurationError('TRUST_PROXY debe contener loopback o direcciones/CIDR concretos del proxy.');
    }
  }
  const tls = !!env.TLS_CERT_PATH && !!env.TLS_KEY_PATH;
  if (!!env.TLS_CERT_PATH !== !!env.TLS_KEY_PATH) throw new ConfigurationError('Configure ambos archivos TLS.');
  if (production && (origin?.protocol !== 'https:' || (!tls && proxies.length === 0))) {
    throw new ConfigurationError('Produccion requiere PUBLIC_ORIGIN=https://... y TLS directo o TRUST_PROXY explicito.');
  }
  return { production, port, origin: origin?.origin, proxies, tls,
    host: env.HOST || '127.0.0.1', sessionSecret: env.SESSION_SECRET };
}
module.exports = runtime;
