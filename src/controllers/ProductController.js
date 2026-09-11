/** Traduce solicitudes HTTP del catálogo a ProductService y expone únicamente errores controlados. */
const { ProductError } = require('../domain/ProductInput');
const safeLog = require('../utils/safeLog');
class ProductController {
  constructor(service) { this.service = service; }
  handle(method, { write = false, created = false } = {}) {
    return async (req, res) => {
      try {
        const args = write ? [req.authUser.idUsuario, req.get('x-operation-id')] : [];
        const { id, presentationId } = req.params;
        switch (method) {
          case 'list': args.push(req.query); break;
          case 'options': args.push(req.params.kind, req.query); break;
          case 'detail': args.push(id); break;
          case 'presentations': args.push(id, req.query); break;
          case 'presentation': args.push(id, presentationId); break;
          case 'create': args.push(req.body); break;
          case 'savePresentation': args.push(id, presentationId || null, req.body); break;
          case 'presentationState': case 'removePresentation': args.push(id, presentationId, req.body); break;
          default: args.push(id, req.body);
        }
        return res.status(created ? 201 : 200).json(await this.service[method](...args));
      } catch (error) {
        if (error instanceof ProductError) return res.status(error.status).json({ error: error.message, fieldErrors: error.fieldErrors });
        safeLog('PRODUCT_REQUEST_FAILED', error, req.requestId);
        const setup = ['ER_NO_SUCH_TABLE','ER_TABLEACCESS_DENIED_ERROR','ER_COLUMNACCESS_DENIED_ERROR','ER_DBACCESS_DENIED_ERROR','ER_PROCACCESS_DENIED_ERROR'].includes(error.code);
        return res.status(setup ? 503 : 500).json({ error: setup ? 'Productos necesita completar su configuración o permisos de base de datos. Comunícate con el administrador.' : 'No se pudo completar la operación. Revisa la conexión e inténtalo nuevamente.', requestId: req.requestId });
      }
    };
  }
}
module.exports = ProductController;
