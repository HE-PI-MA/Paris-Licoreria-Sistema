-- Proveedores: agrega NIT opcional sin reemplazar filas ni tablas existentes.
-- Un solo ALTER atómico en MySQL 8; varios proveedores sin NIT conservan NULL.
ALTER TABLE proveedor
    ADD COLUMN nit VARCHAR(30) NULL,
    ADD UNIQUE KEY uq_proveedor_nit (nit);
