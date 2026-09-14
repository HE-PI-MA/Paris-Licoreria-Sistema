/** UPC-A y EAN-13 con cero inicial representan las mismas barras. Solo se equiparan códigos con dígito de control válido. */
class Barcode {
  static valid(code) {
    if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(code)) return false;
    const digits = [...code].map(Number), check = digits.pop();
    return (10 - digits.reverse().reduce((sum, n, i) => sum + n * (i % 2 ? 1 : 3), 0) % 10) % 10 === check;
  }
  static alternatives(code) {
    const values = [code];
    if (/^\d{12,13}$/.test(code)) {
      if (this.valid(code)) {
        if (code.length === 12) values.push('0' + code);
        else if (code.startsWith('0')) values.push(code.slice(1));
      }
    }
    return values;
  }
}
module.exports = Barcode;
