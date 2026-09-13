/** Imágenes sintéticas reproducibles: no contienen fotos ni códigos de clientes. */
const jpeg = require('../../src/vendor/jpeg-js');
function image(shade = 160) { return jpeg.encode({ width: 80, height: 60, data: Buffer.alloc(80 * 60 * 4, shade) }, 90).data; }
function barcode() {
  // EAN-13 válido con primer dígito cero: seis grupos L y seis R.
  const code = '0012345678905', patterns = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
  const bars = '101' + [...code.slice(1, 7)].map(n => patterns[Number(n)]).join('') + '01010' + [...code.slice(7)].map(n => patterns[Number(n)].replace(/[01]/g, b => b === '1' ? '0' : '1')).join('') + '101';
  const width = (bars.length + 24) * 4, height = 180, data = Buffer.alloc(width * height * 4, 255);
  for (let i = 0; i < bars.length; i++) if (bars[i] === '1') for (let x = (i + 12) * 4; x < (i + 13) * 4; x++) for (let y = 15; y < 165; y++) { const offset = (y * width + x) * 4; data[offset] = data[offset + 1] = data[offset + 2] = 0; }
  return { code, bars, bytes: jpeg.encode({ width, height, data }, 95).data };
}
module.exports = { image, barcode };
