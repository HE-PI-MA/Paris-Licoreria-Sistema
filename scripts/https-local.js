/** Prepara y arranca HTTPS local con mkcert. No lee ni modifica .env; nunca copia la clave de la CA. */
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), net = require('node:net');
const { execFileSync, spawn } = require('node:child_process'), { X509Certificate, createPrivateKey } = require('node:crypto');
class LocalHttps {
  constructor({ env = process.env, platform = process.platform, interfaces = () => os.networkInterfaces(), run = execFileSync } = {}) {
    this.env = env; this.platform = platform; this.interfaces = interfaces; this.run = run;
    const parent = platform === 'win32' ? env.LOCALAPPDATA : path.join(os.homedir(), '.local', 'share');
    if (!parent || !path.isAbsolute(parent)) throw new Error('No se encuentra la carpeta privada del usuario.');
    this.folder = path.join(parent, 'ParisLicoreria', 'https');
    this.root = path.resolve(__dirname, '..');
  }
  address(ip) {
    if (net.isIP(ip) !== 4 || !Object.values(this.interfaces()).flat().some(item => item?.address === ip && !item.internal)) {
      throw new Error('Indica la IPv4 de esta computadora en la red local. Compruebala con ipconfig.');
    }
    return ip;
  }
  command(args, capture = false) {
    try { return this.run('mkcert', args, { encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit' }); }
    catch (error) { throw new Error(error.code === 'ENOENT' ? 'Instala mkcert: winget install -e --id FiloSottile.mkcert . Abre otra PowerShell y repite el comando.' : 'mkcert no pudo completar la preparacion. Revisa su mensaje.'); }
  }
  privateFolder() {
    fs.mkdirSync(this.folder, { recursive: true, mode: 0o700 });
    if (this.platform === 'win32') {
      const info = this.run('whoami.exe', ['/user', '/fo', 'csv', '/nh'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
      const sid = info.match(/S-1-5-\d+(?:-\d+)+/)?.[0];
      if (!sid) throw new Error('No se pudo proteger la carpeta de certificados del usuario.');
      this.run('icacls.exe', [this.folder, '/inheritance:r', '/grant:r', '*' + sid + ':(OI)(CI)F', '*S-1-5-18:(OI)(CI)F'], { stdio: 'pipe' });
    } else fs.chmodSync(this.folder, 0o700);
  }
  files(ip) { return { cert: path.join(this.folder, 'servidor-' + ip + '.pem'), key: path.join(this.folder, 'servidor-' + ip + '-key.pem') }; }
  prepare(ip) {
    this.address(ip); this.command(['-version'], true); this.privateFolder();
    this.command(['-install']);
    const { cert, key } = this.files(ip);
    this.command(['-cert-file', cert, '-key-file', key, ip, 'localhost', '127.0.0.1', '::1']);
    const ca = this.command(['-CAROOT'], true).trim();
    fs.copyFileSync(path.join(ca, 'rootCA.pem'), path.join(this.folder, 'Paris-Licoreria-CA.crt'));
    this.check(ip);
    const temporary = path.join(this.folder, 'config.json.tmp');
    fs.writeFileSync(temporary, JSON.stringify({ ip }) + '\n', { mode: 0o600 }); fs.renameSync(temporary, path.join(this.folder, 'config.json'));
    console.log('HTTPS local preparado. Copia al celular SOLO este certificado publico:');
    console.log(path.join(this.folder, 'Paris-Licoreria-CA.crt'));
    console.log('En Android instalalo como Certificado de CA desde Ajustes / Seguridad. Nunca copies archivos que digan key.');
    console.log('Despues ejecuta node scripts/https-local.js');
  }
  check(preparedIp) {
    const config = path.join(this.folder, 'config.json');
    if (!preparedIp && !fs.existsSync(config)) throw new Error('Primero ejecuta node scripts/https-local.js --preparar TU_IP_LOCAL');
    const ip = preparedIp || JSON.parse(fs.readFileSync(config, 'utf8')).ip; this.address(ip);
    const { cert, key } = this.files(ip), certificate = new X509Certificate(fs.readFileSync(cert));
    if (!certificate.checkIP(ip) || Date.parse(certificate.validFrom) > Date.now() || Date.parse(certificate.validTo) <= Date.now() || !certificate.checkPrivateKey(createPrivateKey(fs.readFileSync(key)))) {
      throw new Error('El certificado no corresponde a esta IP, vencio o no coincide con su clave. Repite --preparar con la IP actual.');
    }
    return { HOST: '0.0.0.0', PORT: '3100', PUBLIC_ORIGIN: 'https://' + ip + ':3100', TLS_CERT_PATH: cert, TLS_KEY_PATH: key };
  }
  start() {
    const config = this.check();
    console.log('Celular y computadora: ' + config.PUBLIC_ORIGIN + '/login');
    const child = spawn(process.execPath, [path.join(this.root, 'server.js')], { cwd: this.root, env: { ...this.env, ...config }, stdio: 'inherit' });
    // La consola entrega Ctrl+C también al hijo; espera su cierre y liberación de MySQL.
    const waitForChild = () => {};
    process.on('SIGINT', waitForChild);
    child.on('error', () => { process.removeListener('SIGINT', waitForChild); console.error('No se pudo iniciar el servidor HTTPS.'); process.exitCode = 1; });
    child.on('exit', code => { process.removeListener('SIGINT', waitForChild); process.exitCode = code ?? 1; });
  }
  main(args) {
    if (args.length === 2 && args[0] === '--preparar') return this.prepare(args[1]);
    if (args.length === 1 && args[0] === '--comprobar') { console.log('HTTPS preparado: ' + this.check().PUBLIC_ORIGIN); return; }
    if (args.length) throw new Error('Uso: node scripts/https-local.js [--preparar IP | --comprobar]');
    this.start();
  }
}
if (require.main === module) { try { new LocalHttps().main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
module.exports = LocalHttps;
