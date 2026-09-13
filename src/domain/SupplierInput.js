/** Valida los datos de Proveedores y conserva teléfono/NIT como texto, incluidos sus ceros iniciales. */
const { RecordInput, RecordError } = require('./RecordInput');
class SupplierInput extends RecordInput {
  static supplier(body, update = false) {
    this.body(body, ['name', 'contact', 'phone', 'address', 'nit', 'state', ...(update ? ['version'] : [])]);
    const upper = (key, length, optional = true) => this.text(this.text(body[key], length, key, optional).toLocaleUpperCase('es'), length, key, optional);
    const phone = this.text(body.phone, 30, 'phone', true), nit = this.text(body.nit, 30, 'nit', true);
    if (phone && (!/^[+0-9() .-]+$/.test(phone) || phone.replace(/\D/g, '').length < 6)) {
      throw new RecordError(422, 'Revisa el teléfono.', { phone: 'Escribe al menos 6 dígitos; puedes incluir +, espacios, paréntesis o guiones.' });
    }
    if (nit && !/^\d{1,30}$/.test(nit)) throw new RecordError(422, 'Revisa el NIT.', { nit: 'Escribe solo los números del NIT o deja el campo vacío.' });
    return { name: upper('name', 120, false), contact: upper('contact', 100), phone,
      address: upper('address', 200), nit: nit || null, state: this.state(body.state) };
  }
  static list(query) {
    this.body(query, ['term', 'state', 'sort', 'direction', 'page', 'pageSize']);
    return this.page(query, ['name', 'contact', 'phone', 'state']);
  }
}
module.exports = SupplierInput;
