const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");
const LicensePayload = require("./LicensePayload");

class LicenseVerifier {
  constructor() {
    this.publicKeyPath = path.join(
      __dirname,
      "..",
      "config",
      "license-public-key.pem"
    );
  }

  async getPublicKey() {
    try { return await fs.readFile(this.publicKeyPath, "utf8"); }
    catch { throw new Error("CLAVE_PUBLICA_NO_DISPONIBLE"); }
  }

  async verify(license) {
    if (!license || typeof license.firma !== "string") {
      return false;
    }

    let signature;

    try {
      signature = Buffer.from(license.firma, "base64");
    } catch (error) {
      return false;
    }

    if (signature.length !== 64) {
      return false;
    }

    const payload = LicensePayload.serialize(license);
    const publicKey = await this.getPublicKey();

    return crypto.verify(
      null,
      Buffer.from(payload, "utf8"),
      publicKey,
      signature
    );
  }
}

module.exports = LicenseVerifier;
