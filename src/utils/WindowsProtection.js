/** Protege y recupera la activación con DPAPI de Windows; ejecuta PowerShell sin bloquear el hilo de Node. */
const { execFile } = require("child_process");
const { promisify } = require("util");
const run = promisify(execFile);

class WindowsProtection {
  constructor() {
    this.entropy = "PARIS_LICORERIA_ACTIVATION_V1";
  }

  ensureWindows() {
    if (process.platform !== "win32") {
      throw new Error("SISTEMA_OPERATIVO_NO_COMPATIBLE");
    }
  }

  async runPowerShell(script, variables = {}) {
    this.ensureWindows();

    const env = {};
    for (const key of ["SystemRoot", "WINDIR", "PATH", "TEMP", "TMP", "USERPROFILE", "PSModulePath"]) {
      if (process.env[key]) env[key] = process.env[key];
    }

    for (const [key, value] of Object.entries(variables)) {
      env[key] = String(value);
    }

    try {
      const result = await run(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          "Add-Type -AssemblyName System.Security; " + script
        ],
        {
          encoding: "utf8",
          windowsHide: true,
          timeout: 10000,
          maxBuffer: 1024 * 1024,
          env
        }
      );
      return result.stdout.trim();
    } catch (error) {
      throw new Error("WINDOWS_PROTECTION_ERROR");
    }
  }

  async protect(value) {
    const input = Buffer.from(String(value), "utf8").toString("base64");

    const script = [
      "$data=[Convert]::FromBase64String($env:PARIS_DPAPI_INPUT)",
      "$entropy=[Text.Encoding]::UTF8.GetBytes($env:PARIS_DPAPI_ENTROPY)",
      "$protected=[System.Security.Cryptography.ProtectedData]::Protect($data,$entropy,[System.Security.Cryptography.DataProtectionScope]::LocalMachine)",
      "[Console]::Out.Write([Convert]::ToBase64String($protected))"
    ].join("; ");

    return this.runPowerShell(script, {
      PARIS_DPAPI_INPUT: input,
      PARIS_DPAPI_ENTROPY: this.entropy
    });
  }

  async unprotect(protectedValue) {
    const script = [
      "$protected=[Convert]::FromBase64String($env:PARIS_DPAPI_INPUT)",
      "$entropy=[Text.Encoding]::UTF8.GetBytes($env:PARIS_DPAPI_ENTROPY)",
      "$data=[System.Security.Cryptography.ProtectedData]::Unprotect($protected,$entropy,[System.Security.Cryptography.DataProtectionScope]::LocalMachine)",
      "[Console]::Out.Write([Convert]::ToBase64String($data))"
    ].join("; ");

    const output = await this.runPowerShell(script, {
      PARIS_DPAPI_INPUT: String(protectedValue),
      PARIS_DPAPI_ENTROPY: this.entropy
    });

    return Buffer.from(output, "base64").toString("utf8");
  }
}

module.exports = WindowsProtection;
