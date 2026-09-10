-- ============================================================
-- PARÍS LICORERÍA V2
-- DATOS INICIALES
-- ============================================================


SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;


-- ROLES
INSERT INTO rol (nombre, descripcion)
VALUES
('ADMINISTRADOR', 'Propietario y administrador general del sistema'),
('ENCARGADO_VENTA', 'Usuario encargado de ventas y caja');


-- UNIDADES DE MEDIDA
INSERT INTO unidad_medida (nombre, abreviatura)
VALUES
('Unidad', 'und'),
('Kilogramo', 'kg'),
('Gramo', 'g'),
('Mililitro', 'ml');


-- CATEGORÍAS
INSERT INTO categoria (nombre, descripcion, estado)
VALUES
('Bebidas alcohólicas', 'Cervezas, vinos, licores y otras bebidas alcohólicas', 'ACTIVO'),
('Gaseosas', 'Bebidas gaseosas y refrescos', 'ACTIVO'),
('Dulces', 'Dulces y golosinas', 'ACTIVO'),
('Galletas', 'Galletas y productos similares', 'ACTIVO'),
('Limpieza', 'Productos de limpieza', 'ACTIVO'),
('Otros', 'Otros productos comercializados', 'ACTIVO');


-- UBICACIONES
INSERT INTO ubicacion (nombre, descripcion, estado)
VALUES
('Almacén', 'Área principal de almacenamiento', 'ACTIVO'),
('Estante', 'Productos exhibidos en estantes', 'ACTIVO'),
('Refrigerador', 'Productos conservados en frío', 'ACTIVO'),
('Vitrina', 'Productos exhibidos en vitrina', 'ACTIVO');


-- DENOMINACIONES EN BOLIVIANOS
INSERT INTO denominacion (valor, tipo, estado)
VALUES
(200.00, 'BILLETE', 'ACTIVO'),
(100.00, 'BILLETE', 'ACTIVO'),
(50.00, 'BILLETE', 'ACTIVO'),
(20.00, 'BILLETE', 'ACTIVO'),
(10.00, 'BILLETE', 'ACTIVO'),
(5.00, 'MONEDA', 'ACTIVO'),
(2.00, 'MONEDA', 'ACTIVO'),
(1.00, 'MONEDA', 'ACTIVO'),
(0.50, 'MONEDA', 'ACTIVO'),
(0.20, 'MONEDA', 'ACTIVO'),
(0.10, 'MONEDA', 'ACTIVO');

