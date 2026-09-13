-- Ejecutar como administrador SQL DESPUES de crear paris_app@localhost
-- con una contrasena propia mediante la administracion de MySQL.
-- Ajustar nombre de base, cuenta y host a la instalacion.
-- Estos GRANT no eliminan privilegios que la cuenta pudiera tener antes.
-- Emplear una cuenta nueva dedicada; no reutilizar root.
GRANT SELECT ON paris_licoreria.usuario TO 'paris_app'@'localhost';
GRANT SELECT ON paris_licoreria.rol TO 'paris_app'@'localhost';
GRANT SELECT ON paris_licoreria.app_migration TO 'paris_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON paris_licoreria.sesion_web TO 'paris_app'@'localhost';
-- U012: catálogo. Ejecutar después de scripts/setup-products.js.
GRANT SELECT, INSERT, UPDATE, DELETE ON paris_licoreria.producto TO 'paris_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON paris_licoreria.presentacion_producto TO 'paris_app'@'localhost';
GRANT SELECT ON paris_licoreria.categoria TO 'paris_app'@'localhost';
GRANT SELECT ON paris_licoreria.unidad_medida TO 'paris_app'@'localhost';
GRANT SELECT, INSERT ON paris_licoreria.detalle_compra TO 'paris_app'@'localhost';
GRANT SELECT ON paris_licoreria.detalle_venta TO 'paris_app'@'localhost';
GRANT SELECT ON paris_licoreria.vw_stock_producto TO 'paris_app'@'localhost';
GRANT SELECT, INSERT, UPDATE ON paris_licoreria.catalogo_operacion TO 'paris_app'@'localhost';
-- U023: ejecutar después de scripts/setup-suppliers.js con una cuenta de instalación.
GRANT SELECT, INSERT, UPDATE, DELETE ON paris_licoreria.proveedor TO 'paris_app'@'localhost';
GRANT SELECT, INSERT ON paris_licoreria.compra TO 'paris_app'@'localhost';
-- U025: la compra y los catálogos nuevos se guardan en una sola transacción de la aplicación.
GRANT SELECT, INSERT ON paris_licoreria.lote_producto TO 'paris_app'@'localhost';
GRANT SELECT, INSERT ON paris_licoreria.lote_ubicacion TO 'paris_app'@'localhost';
-- U026: permite registrar una ubicación nueva dentro de la misma compra.
GRANT SELECT, INSERT ON paris_licoreria.ubicacion TO 'paris_app'@'localhost';
GRANT SELECT ON paris_licoreria.vw_compras_totales TO 'paris_app'@'localhost';
-- No conceder UPDATE/DELETE sobre el historial de compras ni sobre los lotes para esta etapa.
