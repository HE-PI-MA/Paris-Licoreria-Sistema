/** Obtiene la huella estable del equipo de forma asíncrona y comparte el cálculo entre solicitudes concurrentes. */
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const run = promisify(execFile);
class MachineFingerprint {
  constructor() { this.productId = 'PARIS_LICORERIA'; this.pending = null; }
  async getMachineGuid() {
    if (process.platform !== 'win32') throw new Error('SISTEMA_OPERATIVO_NO_COMPATIBLE');
    const { stdout } = await run('reg.exe', ['QUERY', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
      { encoding: 'utf8', windowsHide: true, timeout: 10000, maxBuffer: 65536 });
    const match = stdout.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i);
    if (!match) throw new Error('MACHINE_GUID_NO_DISPONIBLE');
    return match[1].trim().toLowerCase();
  }
  async generate() {
    if (!this.pending) {
      this.pending = this.getMachineGuid().then(guid => crypto.createHash('sha256').update(this.productId + ':' + guid, 'utf8').digest('hex'))
        .catch(() => { this.pending = null; throw new Error('MACHINE_GUID_NO_DISPONIBLE'); });
    }
    return this.pending;
  }
}
module.exports = MachineFingerprint;
