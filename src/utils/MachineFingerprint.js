const crypto = require("crypto");
const { execFileSync } = require("child_process");

class MachineFingerprint {
  constructor() {
    this.productId = "PARIS_LICORERIA";
  }

  getMachineGuid() {
    if (process.platform !== "win32") {
      throw new Error("SISTEMA_OPERATIVO_NO_COMPATIBLE");
    }

    const output = execFileSync(
      "reg.exe",
      [
        "QUERY",
        "HKLM\\SOFTWARE\\Microsoft\\Cryptography",
        "/v",
        "MachineGuid"
      ],
      { encoding: "utf8", windowsHide: true }
    );

    const match = output.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i);

    if (!match || !match[1]) {
      throw new Error("MACHINE_GUID_NO_DISPONIBLE");
    }

    return match[1].trim().toLowerCase();
  }

  generate() {
    const machineGuid = this.getMachineGuid();
    const source = `${this.productId}:${machineGuid}`;

    return crypto
      .createHash("sha256")
      .update(source, "utf8")
      .digest("hex");
  }

  getDisplayId() {
    const fingerprint = this.generate().toUpperCase();

    return [
      fingerprint.slice(0, 8),
      fingerprint.slice(8, 16),
      fingerprint.slice(16, 24)
    ].join("-");
  }
}

module.exports = MachineFingerprint;
