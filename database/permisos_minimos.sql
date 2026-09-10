-- Ejecutar como administrador SQL DESPUES de crear paris_app@localhost
-- con una contrasena propia mediante la administracion de MySQL.
-- Ajustar nombre de base, cuenta y host a la instalacion.
-- Estos GRANT no eliminan privilegios que la cuenta pudiera tener antes.
-- Emplear una cuenta nueva dedicada; no reutilizar root.
GRANT SELECT ON paris_licoreria.usuario TO 'paris_app'@'localhost';
GRANT SELECT ON paris_licoreria.rol TO 'paris_app'@'localhost';
GRANT SELECT ON paris_licoreria.app_migration TO 'paris_app'@'localhost';
GRANT SELECT, INSERT, UPDATE, DELETE ON paris_licoreria.sesion_web TO 'paris_app'@'localhost';
-- Los modulos operativos aun no existen en la web. Al implementarlos,
-- conceder EXECUTE solo sobre las rutinas necesarias y SELECT sobre sus vistas.
-- No conceder INSERT/UPDATE/DELETE directos sobre el historial.
