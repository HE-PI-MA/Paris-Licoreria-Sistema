const fs = require('fs/promises');
const path = require('path');
const crypto = require('crypto');
class ActivationRepository {
  constructor() {
    this.activationPath = process.env.PARIS_ACTIVATION_PATH || path.join(process.env.ProgramData || 'C:\\ProgramData', 'ParisLicoreria', 'activation', 'activation.dat');
  }
  getActivationPath() { return this.activationPath; }
  async read() {
    try {
      const stat = await fs.stat(this.activationPath);
      if (stat.size > 65536) throw new Error('ACTIVACION_DATOS_INVALIDOS');
      return (await fs.readFile(this.activationPath, 'utf8')).trim();
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      throw new Error('ACTIVACION_NO_SE_PUDO_LEER');
    }
  }
  async write(data) {
    if (typeof data !== 'string' || !data.trim() || data.length > 65536) throw new Error('ACTIVACION_DATOS_INVALIDOS');
    await fs.mkdir(path.dirname(this.activationPath), { recursive: true });
    const temporary = this.activationPath + '.' + crypto.randomUUID() + '.tmp';
    try {
      await fs.writeFile(temporary, data, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
      await fs.rename(temporary, this.activationPath);
    } finally { await fs.rm(temporary, { force: true }); }
  }
}
module.exports = ActivationRepository;
