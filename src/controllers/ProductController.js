/** Productos declara solo sus argumentos y la respuesta JPEG; comparte HTTP y errores con los demás módulos. */
const CatalogController = require('./CatalogController');
class ProductController extends CatalogController {
  constructor(service) { super(service, { label: 'Productos', event: 'PRODUCT_REQUEST_FAILED' }); }
  arguments(req, method, write) {
    const args = write ? [req.authUser.idUsuario, req.get('x-operation-id')] : [];
    const { id, presentationId } = req.params;
    switch (method) {
      case 'options': return [req.params.kind, req.query];
      case 'barcode': return [req.params.code];
      case 'presentations': return [id, req.query];
      case 'presentation': return [id, presentationId];
      case 'savePresentation': return [...args, id, presentationId || null, req.body];
      case 'presentationState': case 'removePresentation': return [...args, id, presentationId, req.body];
      default: return super.arguments(req, method, write);
    }
  }
  respond(res, result, options) {
    return options.method === 'photo' ? res.type('image/jpeg').send(result.bytes) : super.respond(res, result, options);
  }
}
module.exports = ProductController;
