/** Traduce HTTP a SupplierService y devuelve errores legibles sin exponer datos internos de MySQL. */
const { RecordError } = require('../domain/RecordInput');
const safeLog = require('../utils/safeLog');
class SupplierController {
  constructor(service) { this.service = service; }
  handle(method, { write = false, created = false } = {}) {
    return async (req, res) => {
      try {
        const args = write ? [req.authUser.idUsuario, req.get('x-operation-id')] : [];
        if (method === 'list') args.push(req.query);
        else if (method === 'create') args.push(req.body);
        else { args.push(req.params.id); if (write) args.push(req.body); }
        return res.status(created ? 201 : 200).json(await this.service[method](...args));
      } catch (error) {
        if (error instanceof RecordError) return res.status(error.status).json({ error: error.message, fieldErrors: error.fieldErrors });
        safeLog('SUPPLIER_REQUEST_FAILED', error, req.requestId);
        const setup = ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_TABLEACCESS_DENIED_ERROR', 'ER_COLUMNACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR'].includes(error.code);
        return res.status(setup ? 503 : 500).json({ error: setup ? 'Proveedores necesita completar su configuración o permisos de base de datos. Comunícate con el administrador.' : 'No se pudo completar la operación. Revisa la conexión e inténtalo nuevamente.', requestId: req.requestId });
      }
    };
  }
}
module.exports = SupplierController;
