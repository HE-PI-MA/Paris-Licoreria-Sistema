const fs = require("fs");
const path = require("path");

class ActivationRepository {
  constructor() {
    const programData = process.env.ProgramData || "C:\\ProgramData";

    this.activationPath = process.env.PARIS_ACTIVATION_PATH || path.join(
      programData,
      "ParisLicoreria",
      "activation",
      "activation.dat"
    );
  }

  getActivationPath() {
    return this.activationPath;
  }

  exists() {
    return fs.existsSync(this.activationPath);
  }

  read() {
    if (!this.exists()) {
      return null;
    }

    try {
      return fs.readFileSync(this.activationPath, "utf8").trim();
    } catch (error) {
      throw new Error("ACTIVACION_NO_SE_PUDO_LEER");
    }
  }

  write(protectedData) {
    if (typeof protectedData !== "string" || !protectedData.trim()) {
      throw new Error("ACTIVACION_DATOS_INVALIDOS");
    }

    const directory = path.dirname(this.activationPath);

    fs.mkdirSync(directory, { recursive: true });

    const temporaryPath = this.activationPath + ".tmp";

    fs.writeFileSync(temporaryPath, protectedData, "utf8");
    fs.renameSync(temporaryPath, this.activationPath);

    return this.activationPath;
  }

  remove() {
    if (this.exists()) {
      fs.unlinkSync(this.activationPath);
    }
  }
}

module.exports = ActivationRepository;
