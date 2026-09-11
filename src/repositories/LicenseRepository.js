/** Lee la licencia instalada desde su ruta privada y distingue ausencia de errores de lectura. */
const fs = require('fs/promises');
const path = require('path');
class LicenseRepository {
  constructor() {
    this.licensePath = process.env.PARIS_LICENSE_PATH || path.join(process.env.ProgramData || 'C:\\ProgramData', 'ParisLicoreria', 'license', 'license.json');
  }
  getLicensePath() { return this.licensePath; }
  async read() {
    try {
      const stat = await fs.stat(this.licensePath);
      if (stat.size > 65536) throw new Error('LICENCIA_FORMATO_INVALIDO');
      return JSON.parse(await fs.readFile(this.licensePath, 'utf8'));
    } catch (error) {
      if (error.code === 'ENOENT') return null;
      if (error instanceof SyntaxError || error.message === 'LICENCIA_FORMATO_INVALIDO') throw new Error('LICENCIA_FORMATO_INVALIDO');
      throw new Error('LICENCIA_NO_SE_PUDO_LEER');
    }
  }
}
module.exports = LicenseRepository;
