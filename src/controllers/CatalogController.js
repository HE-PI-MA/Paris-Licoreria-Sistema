/** Adaptador HTTP compartido para listados, detalle y escrituras de catálogos y compras; protege los errores internos SQL. */
const { RecordError } = require('../domain/RecordInput');
const safeLog = require('../utils/safeLog');
class CatalogController {
  constructor(service, { label = 'Proveedores', event = 'SUPPLIER_REQUEST_FAILED' } = {}) { Object.assign(this, { service, label, event }); }
  /** Cada módulo puede declarar sus argumentos sin copiar manejo HTTP, errores ni respuestas. */
  arguments(req, method, write) {
    const args = write ? [req.authUser.idUsuario, req.get('x-operation-id')] : [];
    if (method === 'list' || method === 'locations') args.push(req.query);
    else if (method === 'create') args.push(req.body);
    else { args.push(req.params.id); if (write) args.push(req.body); }
    return args;
  }
  respond(res, result, { created }) { return res.status(created ? 201 : 200).json(result); }
  handle(method, { write = false, created = false } = {}) {
    return async (req, res) => {
      try {
        const args = this.arguments(req, method, write);
        return this.respond(res, await this.service[method](...args), { method, created });
      } catch (error) {
        if (error instanceof RecordError) return res.status(error.status).json({ error: error.message, fieldErrors: error.fieldErrors });
        safeLog(this.event, error, req.requestId);
        const setup = ['ER_NO_SUCH_TABLE', 'ER_BAD_FIELD_ERROR', 'ER_TABLEACCESS_DENIED_ERROR', 'ER_COLUMNACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR', 'ER_PROCACCESS_DENIED_ERROR'].includes(error.code);
        return res.status(setup ? 503 : 500).json({ error: setup ? this.label + ' necesita completar su configuración o permisos de base de datos. Comunícate con el administrador.' : 'No se pudo completar la operación. Revisa la conexión e inténtalo nuevamente.', requestId: req.requestId });
      }
    };
  }
}
module.exports = CatalogController;
