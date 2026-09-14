/** Certificados con comandos simulados: no instala autoridades ni modifica la red del equipo de prueba. */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const LocalHttps = require('../scripts/https-local');
test('U034: HTTPS usa la IP del equipo y guarda solo certificados fuera de Git', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'paris-https-test-')), calls = [], ip = '192.0.2.10';
  const env = { LOCALAPPDATA: temp }, interfaces = () => ({ test: [{ address: ip, internal: false }] });
  const ca = path.join(temp, 'ca'); fs.mkdirSync(ca); fs.writeFileSync(path.join(ca, 'rootCA.pem'), 'PUBLIC'); fs.writeFileSync(path.join(ca, 'rootCA-key.pem'), 'PRIVATE-TEST-ONLY');
  const helper = new LocalHttps({ env, platform: 'win32', interfaces, run: (command, args) => {
    calls.push([command, args]);
    if (command === 'whoami.exe') return '"test","S-1-5-21-1-2-3-1001"';
    if (args[0] === '-CAROOT') return ca + '\n';
    return '';
  } });
  try {
    assert.throws(() => helper.address('203.0.113.9')); assert.throws(() => helper.address('127.0.0.1')); assert.throws(() => helper.address('192.0.2.10 & command'));
    assert.throws(() => helper.main(['--other'])); assert.throws(() => helper.check(), /Primero/);
    // La comprobación criptográfica se valida además con certificados efímeros en la revisión local.
    helper.check = actual => { assert.equal(actual, ip); return {}; };
    helper.prepare(ip);
    assert.equal(fs.readFileSync(path.join(helper.folder, 'Paris-Licoreria-CA.crt'), 'utf8'), 'PUBLIC');
    assert.equal(fs.existsSync(path.join(helper.folder, 'rootCA-key.pem')), false);
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(helper.folder, 'config.json'))), { ip });
    assert.ok(calls.some(([cmd, args]) => cmd === 'icacls.exe' && args.includes('/inheritance:r')));
    assert.ok(calls.some(([cmd, args]) => cmd === 'mkcert' && args.includes(ip) && args.includes('-key-file')));
    assert.deepEqual(env, { LOCALAPPDATA: temp });
    const absent = new LocalHttps({ env, platform: 'win32', interfaces, run: () => { const e = new Error(); e.code = 'ENOENT'; throw e; } });
    assert.throws(() => absent.prepare(ip), /winget install/);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
