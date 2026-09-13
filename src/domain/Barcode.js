/** UPC-A y EAN-13 con cero inicial representan las mismas barras. Solo se equiparan códigos con dígito de control válido. */
class Barcode {
  static alternatives(code) {
    const values = [code];
    if (/^\d{12,13}$/.test(code)) {
      const digits = [...code].map(Number), check = digits.pop();
      const sum = digits.reverse().reduce((total, n, index) => total + n * (index % 2 === 0 ? 3 : 1), 0);
      if ((10 - sum % 10) % 10 === check) {
        if (code.length === 12) values.push('0' + code);
        else if (code.startsWith('0')) values.push(code.slice(1));
      }
    }
    return values;
  }
}
module.exports = Barcode;
