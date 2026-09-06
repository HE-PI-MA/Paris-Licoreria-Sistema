const fs = require("fs");
const path = require("path");

class LicenseRepository {
  constructor() {
    const programData = process.env.ProgramData || "C:\\ProgramData";

    this.licensePath = process.env.PARIS_LICENSE_PATH || path.join(
      programData,
      "ParisLicoreria",
      "license",
      "license.json"
    );
  }

  getLicensePath() {
    return this.licensePath;
  }

  exists() {
    return fs.existsSync(this.licensePath);
  }

  read() {
    if (!this.exists()) {
      return null;
    }

    try {
      const content = fs.readFileSync(this.licensePath, "utf8");
      return JSON.parse(content);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error("LICENCIA_FORMATO_INVALIDO");
      }

      throw new Error("LICENCIA_NO_SE_PUDO_LEER");
    }
  }
}

module.exports = LicenseRepository;
