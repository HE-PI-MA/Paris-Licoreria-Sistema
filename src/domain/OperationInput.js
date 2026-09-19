/** Validaciones de Caja, Ventas, Usuarios y Reportes. Mantiene las reglas fuera de HTTP y SQL. */
const { RecordInput, RecordError } = require('./RecordInput');
const Decimal = require('../../public/js/components/decimal');
class OperationInput extends RecordInput {
  static decimal(value, scale, field, { zero = false, maxUnits = 999999999999999n } = {}) {
    try {
      const units = Decimal.units(String(value), scale);
      if ((!zero && units <= 0n) || (zero && units < 0n) || units > maxUnits) throw new Error();
      return Decimal.text(units, scale);
    } catch (_) { throw new RecordError(422, 'Revisa los campos señalados.', { [field]: `Escribe un monto válido con hasta ${scale} decimales.` }); }
  }
  static cashOpen(body) {
    this.body(body, ['cashId','initialAmount','observation']);
    return { cashId: this.id(body.cashId, 'cashId'), initialAmount: this.decimal(body.initialAmount, 2, 'initialAmount', { zero: true }), observation: this.text(body.observation, 250, 'observation', true) };
  }
  static cashClose(body) {
    this.body(body, ['observation','count']);
    if (!Array.isArray(body.count) || body.count.length < 1 || body.count.length > 50) throw new RecordError(422, 'El cierre requiere el conteo de efectivo.', { count: 'Completa el conteo de denominaciones.' });
    const seen = new Set();
    const count = body.count.map((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !['denominationId','quantity'].includes(key))) throw new RecordError(400, 'El conteo contiene campos no permitidos.');
      const denominationId = this.id(row.denominationId, 'count');
      if (seen.has(denominationId)) throw new RecordError(422, 'Hay denominaciones repetidas.', { count: 'Cada denominación debe aparecer una sola vez.' });
      seen.add(denominationId);
      if (!/^\d{1,7}$/.test(String(row.quantity))) throw new RecordError(422, 'Cantidad de billetes o monedas no válida.', { count: `Revisa la fila ${index + 1}.` });
      return { id_denominacion: denominationId, cantidad: Number(row.quantity) };
    });
    return { observation: this.text(body.observation, 250, 'observation', true), count };
  }
  static sale(body) {
    this.body(body, ['details','payments']);
    if (!Array.isArray(body.details) || body.details.length < 1 || body.details.length > 100) throw new RecordError(422, 'La venta requiere productos.', { details: 'Agrega al menos un producto.' });
    if (!Array.isArray(body.payments) || body.payments.length < 1 || body.payments.length > 2) throw new RecordError(422, 'La venta requiere el pago.', { payments: 'Registra efectivo, QR o ambos.' });
    const presentations = new Set();
    const details = body.details.map((row, index) => {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !['presentationId','quantity'].includes(key))) throw new RecordError(400, 'La venta contiene campos no permitidos.');
      const presentationId = this.id(row.presentationId, 'details');
      if (presentations.has(presentationId)) throw new RecordError(422, 'El mismo producto aparece repetido.', { details: `Une la cantidad de la fila ${index + 1}.` });
      presentations.add(presentationId);
      return { id_presentacion: presentationId, cantidad: this.decimal(row.quantity, 3, 'details') };
    });
    const methods = new Set();
    const payments = body.payments.map(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).some(key => !['method','amount','receipt'].includes(key))) throw new RecordError(400, 'El pago contiene campos no permitidos.');
      const method = String(row.method || '').toUpperCase();
      if (!['EFECTIVO','QR'].includes(method) || methods.has(method)) throw new RecordError(422, 'Método de pago no válido o repetido.', { payments: 'Usa como máximo un registro por método.' });
      methods.add(method);
      const receipt = method === 'QR' ? this.text(row.receipt, 255, 'payments') : '';
      return { metodo_pago: method, monto: this.decimal(row.amount, 2, 'payments'), comprobante_qr: receipt || null };
    });
    return { details, payments };
  }
  static cancellation(body) {
    this.body(body, ['reason','qrRefundReference']);
    return { reason: this.text(body.reason, 250, 'reason'), qrRefundReference: this.text(body.qrRefundReference, 255, 'qrRefundReference', true) };
  }
  static userCreate(body) {
    this.body(body, ['name','surname','username','role','password']);
    return { name: this.text(body.name,80,'name'), surname: this.text(body.surname,80,'surname'), username: this.username(body.username), role: this.role(body.role), password: this.password(body.password,true) };
  }
  static userUpdate(body) {
    this.body(body, ['name','surname','username','role','state','password']);
    return { name: this.text(body.name,80,'name'), surname: this.text(body.surname,80,'surname'), username: this.username(body.username), role: this.role(body.role), state: this.state(body.state), password: this.password(body.password,false) };
  }
  static username(value) {
    const username = this.text(value, 50, 'username');
    if (!/^[A-Za-z0-9._-]{3,50}$/.test(username)) throw new RecordError(422, 'Usuario no válido.', { username: 'Usa de 3 a 50 letras, números, punto, guion o guion bajo.' });
    return username;
  }
  static role(value) {
    const role = String(value || '').toUpperCase();
    if (!['ADMINISTRADOR','ENCARGADO_VENTA'].includes(role)) throw new RecordError(422, 'Rol no válido.', { role: 'Selecciona Administrador o Encargado de venta.' });
    return role;
  }
  static password(value, required) {
    if (!required && (value === undefined || value === null || value === '')) return '';
    if (typeof value !== 'string' || Buffer.byteLength(value,'utf8') > 72 || value.length < 8) throw new RecordError(422, 'Contraseña no válida.', { password: 'Usa al menos 8 caracteres y máximo 72 bytes.' });
    return value;
  }
  static report(query) {
    const now = new Date(), today = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
    const date = (value, field, fallback) => {
      const text = value || fallback, match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
      if (!match) throw new RecordError(400, 'Rango de fechas no válido.', { [field]: 'Usa una fecha válida.' });
      const year=Number(match[1]),month=Number(match[2]),day=Number(match[3]),parsed=new Date(year,month-1,day);
      if (parsed.getFullYear()!==year || parsed.getMonth()!==month-1 || parsed.getDate()!==day) throw new RecordError(400, 'Rango de fechas no válido.', { [field]: 'Usa una fecha válida.' });
      return text;
    };
    const from = date(query.from,'from',today), to = date(query.to,'to',today);
    if (from > to) throw new RecordError(422, 'La fecha inicial no puede ser posterior a la final.');
    return { from, to };
  }
}
module.exports = OperationInput;
