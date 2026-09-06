const fs = require("fs");
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

  getPublicKey() {
    if (!fs.existsSync(this.publicKeyPath)) {
      throw new Error("CLAVE_PUBLICA_NO_DISPONIBLE");
    }

    return fs.readFileSync(this.publicKeyPath, "utf8");
  }

  verify(license) {
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
    const publicKey = this.getPublicKey();

    return crypto.verify(
      null,
      Buffer.from(payload, "utf8"),
      publicKey,
      signature
    );
  }
}

module.exports = LicenseVerifier;
