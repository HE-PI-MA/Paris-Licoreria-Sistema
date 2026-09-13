/** Aritmética decimal exacta compartida por navegador y servidor: cantidades, conversiones y centavos sin coma flotante. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ParisUI.Decimal = factory();
})(typeof window === 'undefined' ? globalThis : window, () => {
  'use strict';
  class Decimal {
    static units(value, scale) {
      if (!new RegExp('^\\d+(?:\\.\\d{1,' + scale + '})?$').test(String(value))) throw new TypeError('Decimal no válido.');
      const [whole, fraction = ''] = String(value).split('.');
      return BigInt(whole + fraction.padEnd(scale, '0'));
    }
    static text(value, scale) {
      const digits = value.toString().padStart(scale + 1, '0');
      return digits.slice(0, -scale) + '.' + digits.slice(-scale);
    }
    static multiply(quantity, amount, scale) {
      return this.text((this.units(quantity, 3) * this.units(amount, scale) + 500n) / 1000n, scale);
    }
    static total(lines) { return this.text(lines.reduce((sum, line) => sum + this.units(this.multiply(line.quantity, line.cost, 2), 2), 0n), 2); }
    static format(value, scale = 2) {
      const [whole, fraction] = this.text(this.units(value, scale), scale).split('.');
      return whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + fraction;
    }
  }
  return Decimal;
});
