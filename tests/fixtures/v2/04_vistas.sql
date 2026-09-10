-- ============================================================
-- PARÍS LICORERÍA V2
-- 14 VISTAS OPERATIVAS Y DE REPORTE
-- ============================================================



-- El vencimiento se considera alcanzado desde fecha_vencimiento <= CURRENT_DATE.
CREATE OR REPLACE VIEW vw_stock_lote_ubicacion AS
SELECT
    lu.id_lote_ubicacion,
    p.id_producto,
    p.nombre AS producto,
    um.nombre AS unidad_base,
    um.abreviatura,
    pp.id_presentacion AS presentacion_compra_id,
    pp.nombre_presentacion AS presentacion_compra,
    lp.id_lote,
    lp.codigo_lote,
    c.fecha_hora AS fecha_ingreso,
    lp.fecha_vencimiento,
    u.id_ubicacion,
    u.nombre AS ubicacion,
    lu.cantidad_actual AS stock_fisico,
    CASE
        WHEN lp.fecha_vencimiento IS NULL
             OR lp.fecha_vencimiento > CURRENT_DATE
        THEN lu.cantidad_actual
        ELSE 0
    END AS stock_disponible,
    CASE
        WHEN lp.fecha_vencimiento IS NOT NULL
             AND lp.fecha_vencimiento <= CURRENT_DATE
        THEN lu.cantidad_actual
        ELSE 0
    END AS stock_vencido,
    CASE
        WHEN lp.fecha_vencimiento IS NOT NULL
             AND lp.fecha_vencimiento <= CURRENT_DATE THEN 'VENCIDO'
        WHEN lp.fecha_vencimiento IS NOT NULL
             AND lp.fecha_vencimiento <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY)
             THEN 'PROXIMO_A_VENCER'
        ELSE 'VIGENTE'
    END AS estado_vencimiento,
    dc.costo_unitario,
    pp.factor_conversion
FROM lote_ubicacion lu
INNER JOIN lote_producto lp ON lp.id_lote = lu.id_lote
INNER JOIN detalle_compra dc ON dc.id_detalle_compra = lp.id_detalle_compra
INNER JOIN compra c ON c.id_compra = dc.id_compra
INNER JOIN presentacion_producto pp ON pp.id_presentacion = dc.id_presentacion
INNER JOIN producto p ON p.id_producto = pp.id_producto
INNER JOIN unidad_medida um ON um.id_unidad_medida = p.id_unidad_medida
INNER JOIN ubicacion u ON u.id_ubicacion = lu.id_ubicacion;

CREATE OR REPLACE VIEW vw_stock_producto AS
SELECT
    p.id_producto,
    p.nombre AS producto,
    c.nombre AS categoria,
    um.nombre AS unidad_base,
    um.abreviatura,
    p.stock_minimo,
    COALESCE(SUM(lu.cantidad_actual), 0) AS stock_fisico,
    COALESCE(SUM(
        CASE
            WHEN lp.fecha_vencimiento IS NULL
                 OR lp.fecha_vencimiento > CURRENT_DATE
            THEN lu.cantidad_actual ELSE 0
        END
    ), 0) AS stock_disponible,
    COALESCE(SUM(
        CASE
            WHEN lp.fecha_vencimiento IS NOT NULL
                 AND lp.fecha_vencimiento <= CURRENT_DATE
            THEN lu.cantidad_actual ELSE 0
        END
    ), 0) AS stock_vencido,
    CASE
        WHEN COALESCE(SUM(
            CASE
                WHEN lp.fecha_vencimiento IS NULL
                     OR lp.fecha_vencimiento > CURRENT_DATE
                THEN lu.cantidad_actual ELSE 0
            END
        ), 0) = 0 THEN 'AGOTADO'
        WHEN COALESCE(SUM(
            CASE
                WHEN lp.fecha_vencimiento IS NULL
                     OR lp.fecha_vencimiento > CURRENT_DATE
                THEN lu.cantidad_actual ELSE 0
            END
        ), 0) <= p.stock_minimo THEN 'STOCK BAJO'
        ELSE 'DISPONIBLE'
    END AS estado_stock
FROM producto p
INNER JOIN categoria c ON c.id_categoria = p.id_categoria
INNER JOIN unidad_medida um ON um.id_unidad_medida = p.id_unidad_medida
LEFT JOIN presentacion_producto pp ON pp.id_producto = p.id_producto
LEFT JOIN detalle_compra dc ON dc.id_presentacion = pp.id_presentacion
LEFT JOIN lote_producto lp ON lp.id_detalle_compra = dc.id_detalle_compra
LEFT JOIN lote_ubicacion lu ON lu.id_lote = lp.id_lote
GROUP BY p.id_producto, p.nombre, c.nombre, um.nombre, um.abreviatura,
         p.stock_minimo;

CREATE OR REPLACE VIEW vw_stock_fisico_producto AS
SELECT id_producto, producto, categoria, unidad_base, abreviatura,
       stock_fisico
FROM vw_stock_producto;

CREATE OR REPLACE VIEW vw_stock_disponible_producto AS
SELECT id_producto, producto, categoria, unidad_base, abreviatura,
       stock_minimo, stock_disponible, estado_stock
FROM vw_stock_producto;

CREATE OR REPLACE VIEW vw_stock_vencido_producto AS
SELECT id_producto, producto, categoria, unidad_base, abreviatura,
       stock_vencido
FROM vw_stock_producto
WHERE stock_vencido > 0;

CREATE OR REPLACE VIEW vw_productos_stock_bajo AS
SELECT id_producto, producto, categoria, unidad_base, abreviatura,
       stock_minimo, stock_disponible, estado_stock
FROM vw_stock_producto
WHERE stock_disponible <= stock_minimo;

CREATE OR REPLACE VIEW vw_lotes_proximos_vencer AS
SELECT id_lote_ubicacion, id_producto, producto, unidad_base, abreviatura,
       id_lote, codigo_lote, fecha_ingreso, fecha_vencimiento,
       id_ubicacion, ubicacion, stock_fisico,
       DATEDIFF(fecha_vencimiento, CURRENT_DATE) AS dias_restantes
FROM vw_stock_lote_ubicacion
WHERE fecha_vencimiento > CURRENT_DATE
  AND fecha_vencimiento <= DATE_ADD(CURRENT_DATE, INTERVAL 30 DAY)
  AND stock_fisico > 0;

CREATE OR REPLACE VIEW vw_compras_totales AS
SELECT
    c.id_compra,
    c.fecha_hora,
    pr.id_proveedor,
    pr.nombre AS proveedor,
    u.id_usuario,
    CONCAT(u.nombre, ' ', u.apellido) AS usuario,
    COALESCE(SUM(ROUND(dc.cantidad * dc.costo_unitario, 2)), 0) AS total_compra
FROM compra c
INNER JOIN proveedor pr ON pr.id_proveedor = c.id_proveedor
INNER JOIN usuario u ON u.id_usuario = c.id_usuario
LEFT JOIN detalle_compra dc ON dc.id_compra = c.id_compra
GROUP BY c.id_compra, c.fecha_hora, pr.id_proveedor, pr.nombre,
         u.id_usuario, u.nombre, u.apellido;

CREATE OR REPLACE VIEW vw_ventas_totales AS
SELECT
    v.id_venta,
    v.fecha_hora,
    v.estado,
    v.motivo_anulacion,
    sc.id_sesion_caja,
    u.id_usuario,
    CONCAT(u.nombre, ' ', u.apellido) AS usuario,
    COALESCE(SUM(ROUND(dv.cantidad * dv.precio_unitario, 2)), 0) AS total_venta
FROM venta v
INNER JOIN sesion_caja sc ON sc.id_sesion_caja = v.id_sesion_caja
INNER JOIN usuario u ON u.id_usuario = sc.id_usuario
LEFT JOIN detalle_venta dv ON dv.id_venta = v.id_venta
GROUP BY v.id_venta, v.fecha_hora, v.estado, v.motivo_anulacion,
         sc.id_sesion_caja, u.id_usuario, u.nombre, u.apellido;

CREATE OR REPLACE VIEW vw_pagos_venta AS
SELECT v.id_venta, v.fecha_hora, v.estado, p.id_pago,
       p.metodo_pago, p.monto, p.comprobante_qr
FROM venta v
INNER JOIN pago p ON p.id_venta = v.id_venta;

CREATE OR REPLACE VIEW vw_productos_mas_vendidos AS
SELECT
    p.id_producto,
    p.nombre AS producto,
    um.abreviatura AS unidad_base,
    pp.id_presentacion,
    pp.nombre_presentacion,
    SUM(dv.cantidad) AS cantidad_presentaciones,
    SUM(ROUND(dv.cantidad * pp.factor_conversion, 3)) AS cantidad_base_vendida,
    SUM(ROUND(dv.cantidad * dv.precio_unitario, 2)) AS ingreso_generado
FROM detalle_venta dv
INNER JOIN venta v ON v.id_venta = dv.id_venta
INNER JOIN presentacion_producto pp ON pp.id_presentacion = dv.id_presentacion
INNER JOIN producto p ON p.id_producto = pp.id_producto
INNER JOIN unidad_medida um ON um.id_unidad_medida = p.id_unidad_medida
WHERE v.estado = 'VIGENTE'
GROUP BY p.id_producto, p.nombre, um.abreviatura,
         pp.id_presentacion, pp.nombre_presentacion;

CREATE OR REPLACE VIEW vw_efectivo_esperado_sesion AS
SELECT
    sc.id_sesion_caja,
    sc.id_usuario,
    sc.fecha_hora_apertura,
    sc.fecha_hora_cierre,
    sc.monto_inicial,
    sc.estado,
    sc.monto_inicial + COALESCE(SUM(
        CASE
            WHEN v.estado = 'VIGENTE' AND pg.metodo_pago = 'EFECTIVO'
            THEN pg.monto ELSE 0
        END
    ), 0) AS efectivo_esperado
FROM sesion_caja sc
LEFT JOIN venta v ON v.id_sesion_caja = sc.id_sesion_caja
LEFT JOIN pago pg ON pg.id_venta = v.id_venta
GROUP BY sc.id_sesion_caja, sc.id_usuario, sc.fecha_hora_apertura,
         sc.fecha_hora_cierre, sc.monto_inicial, sc.estado;

CREATE OR REPLACE VIEW vw_efectivo_contado_arqueo AS
SELECT
    ac.id_arqueo,
    ac.id_sesion_caja,
    ac.fecha_hora,
    COALESCE(SUM(d.valor * da.cantidad), 0) AS efectivo_contado
FROM arqueo_caja ac
LEFT JOIN detalle_arqueo da ON da.id_arqueo = ac.id_arqueo
LEFT JOIN denominacion d ON d.id_denominacion = da.id_denominacion
GROUP BY ac.id_arqueo, ac.id_sesion_caja, ac.fecha_hora;

CREATE OR REPLACE VIEW vw_diferencias_caja AS
SELECT
    sc.id_sesion_caja,
    CONCAT(u.nombre, ' ', u.apellido) AS usuario,
    sc.fecha_hora_apertura,
    sc.fecha_hora_cierre,
    ee.efectivo_esperado,
    ec.efectivo_contado,
    ec.efectivo_contado - ee.efectivo_esperado AS diferencia,
    CASE
        WHEN ec.efectivo_contado - ee.efectivo_esperado = 0 THEN 'CUADRA'
        WHEN ec.efectivo_contado - ee.efectivo_esperado > 0 THEN 'SOBRANTE'
        ELSE 'FALTANTE'
    END AS resultado
FROM sesion_caja sc
INNER JOIN usuario u ON u.id_usuario = sc.id_usuario
INNER JOIN vw_efectivo_esperado_sesion ee
    ON ee.id_sesion_caja = sc.id_sesion_caja
INNER JOIN vw_efectivo_contado_arqueo ec
    ON ec.id_sesion_caja = sc.id_sesion_caja;

