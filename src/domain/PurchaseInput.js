/** Valida una compra completa. Las referencias existentes llevan versión; los registros nuevos contienen solo sus datos permitidos. */
const { ProductInput, ProductError: RecordError } = require('./ProductInput');
const SupplierInput = require('./SupplierInput');
class PurchaseInput extends ProductInput {
  static reference(value) { return { id: this.id(value.id), version: this.version(value.version) }; }
  static date(value) {
    if (!value) return null;
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1000-01-01' || value > '9999-12-31' ||
      Number.isNaN(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0,10) !== value) {
      throw new RecordError(422, 'Fecha de vencimiento no válida.', { expiresOn: 'Escribe una fecha válida o deja el campo vacío.' });
    }
    return value;
  }
  static purchase(body) {
    this.body(body, ['supplier', 'locationId', 'observation', 'lines']);
    this.body(body.supplier, body.supplier?.id ? ['id', 'version'] : ['name', 'phone']);
    let supplier;
    try { supplier = body.supplier.id ? this.reference(body.supplier) : SupplierInput.supplier({ ...body.supplier, state: 'ACTIVO' }); }
    catch(error) {
      if(error instanceof RecordError)throw new RecordError(error.status,error.message,Object.fromEntries(Object.entries(error.fieldErrors).map(([name,message])=>[name==='name'?'supplierText':name,message])));
      throw error;
    }
    if (!Array.isArray(body.lines) || !body.lines.length || body.lines.length > 50) throw new RecordError(422, 'Agrega entre 1 y 50 productos a la compra.');
    const lines = body.lines.map((line, index) => {
      try {
        this.body(line, ['product', 'presentation', 'quantity', 'cost', 'lotCode', 'expiresOn']);
        this.body(line.product, line.product?.id ? ['id', 'version'] : ['clientKey', 'name', 'categoryId', 'unitId']);
        const product = line.product.id ? this.reference(line.product) : {
          clientKey: this.key(line.product.clientKey), ...this.product({ name: this.text(line.product.name,120,'name').toLocaleUpperCase('es'),
            categoryId: line.product.categoryId, unitId: line.product.unitId, minimum: '0', description: '', state: 'ACTIVO' }) };
        this.body(line.presentation, line.presentation?.id ? ['id', 'version'] : ['name', 'factor', 'barcode', 'price']);
        if (line.presentation.id && !product.id) throw new RecordError(422, 'Un producto nuevo necesita su propia presentación.');
        const presentation = line.presentation.id ? this.reference(line.presentation) : this.presentation({ ...line.presentation,
          name: this.text(line.presentation.name,80,'name').toLocaleUpperCase('es'), state: 'ACTIVO' });
        return { product, presentation, quantity: this.decimal(line.quantity,3,'quantity',true), cost: this.decimal(line.cost,2,'cost'),
          lotCode: this.text(line.lotCode,80,'lotCode',true) || null, expiresOn: this.date(line.expiresOn) };
      } catch (error) {
        if (error instanceof RecordError) throw new RecordError(error.status, 'Producto ' + (index + 1) + ': ' + error.message + ' Revisa esa fila antes de guardar.');
        throw error;
      }
    });
    return { supplier, locationId: this.id(body.locationId,'locationId'), observation: this.text(body.observation,250,'observation',true), lines };
  }
  static list(query) {
    this.body(query, ['term','page','pageSize','sort','direction']);
    return super.page({ ...query, sort: query.sort || 'date', direction: query.direction || 'desc' }, ['date','supplier','total']);
  }
}
module.exports = PurchaseInput;
