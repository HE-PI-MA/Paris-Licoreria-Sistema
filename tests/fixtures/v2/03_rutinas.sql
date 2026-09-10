-- ============================================================
-- PARÍS LICORERÍA V2
-- TRIGGERS Y PROCEDIMIENTOS TRANSACCIONALES
-- Compatible con MySQL Community Server 8.0.44
-- ============================================================



DELIMITER //

-- ------------------------------------------------------------
-- Protecciones de unidad base y asignación inicial de inventario
-- ------------------------------------------------------------

CREATE TRIGGER trg_producto_bu_unidad_base
BEFORE UPDATE ON producto
FOR EACH ROW
BEGIN
    IF NEW.id_unidad_medida <> OLD.id_unidad_medida
       AND EXISTS (
           SELECT 1
           FROM presentacion_producto pp
           WHERE pp.id_producto = OLD.id_producto
       ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede cambiar la unidad base de un producto con presentaciones';
    END IF;
END//

CREATE TRIGGER trg_presentacion_bu_conversion
BEFORE UPDATE ON presentacion_producto
FOR EACH ROW
BEGIN
    IF (NEW.id_producto <> OLD.id_producto
        OR NEW.factor_conversion <> OLD.factor_conversion)
       AND (
           EXISTS (
               SELECT 1 FROM detalle_compra dc
               WHERE dc.id_presentacion = OLD.id_presentacion
           )
           OR EXISTS (
               SELECT 1 FROM detalle_venta dv
               WHERE dv.id_presentacion = OLD.id_presentacion
           )
       ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Producto y factor no pueden cambiar después de usar la presentación';
    END IF;
END//

CREATE TRIGGER trg_detalle_compra_bu_lotes
BEFORE UPDATE ON detalle_compra
FOR EACH ROW
BEGIN
    IF (NEW.id_presentacion <> OLD.id_presentacion OR NEW.cantidad <> OLD.cantidad)
       AND EXISTS (
           SELECT 1 FROM lote_producto lp
           WHERE lp.id_detalle_compra = OLD.id_detalle_compra
       ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede cambiar cantidad o presentación de una compra con lotes';
    END IF;
END//

CREATE TRIGGER trg_lote_producto_bi_conversion
BEFORE INSERT ON lote_producto
FOR EACH ROW
BEGIN
    DECLARE v_maximo DECIMAL(18,3);
    DECLARE v_registrado DECIMAL(18,3);

    SELECT ROUND(dc.cantidad * pp.factor_conversion, 3)
      INTO v_maximo
      FROM detalle_compra dc
      INNER JOIN presentacion_producto pp
        ON pp.id_presentacion = dc.id_presentacion
     WHERE dc.id_detalle_compra = NEW.id_detalle_compra;

    SELECT COALESCE(SUM(lp.cantidad_inicial), 0)
      INTO v_registrado
      FROM lote_producto lp
     WHERE lp.id_detalle_compra = NEW.id_detalle_compra;

    IF ROUND(v_registrado + NEW.cantidad_inicial, 3) > v_maximo THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Los lotes superan cantidad comprada por factor_conversion';
    END IF;
END//

CREATE TRIGGER trg_lote_producto_bu_conversion
BEFORE UPDATE ON lote_producto
FOR EACH ROW
BEGIN
    DECLARE v_maximo DECIMAL(18,3);
    DECLARE v_registrado DECIMAL(18,3);

    IF NEW.id_detalle_compra <> OLD.id_detalle_compra THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede cambiar el detalle de compra de un lote';
    END IF;

    SELECT ROUND(dc.cantidad * pp.factor_conversion, 3)
      INTO v_maximo
      FROM detalle_compra dc
      INNER JOIN presentacion_producto pp
        ON pp.id_presentacion = dc.id_presentacion
     WHERE dc.id_detalle_compra = NEW.id_detalle_compra;

    SELECT COALESCE(SUM(lp.cantidad_inicial), 0)
      INTO v_registrado
      FROM lote_producto lp
     WHERE lp.id_detalle_compra = NEW.id_detalle_compra
       AND lp.id_lote <> OLD.id_lote;

    IF ROUND(v_registrado + NEW.cantidad_inicial, 3) > v_maximo THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Los lotes superan cantidad comprada por factor_conversion';
    END IF;
END//

CREATE TRIGGER trg_lote_ubicacion_bi_cantidad
BEFORE INSERT ON lote_ubicacion
FOR EACH ROW
BEGIN
    DECLARE v_inicial DECIMAL(18,3);
    DECLARE v_asignado DECIMAL(18,3);

    SELECT cantidad_inicial INTO v_inicial
      FROM lote_producto
     WHERE id_lote = NEW.id_lote;

    SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_asignado
      FROM lote_ubicacion
     WHERE id_lote = NEW.id_lote;

    IF ROUND(v_asignado + NEW.cantidad_actual, 3) > v_inicial THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La distribución por ubicaciones supera la cantidad inicial del lote';
    END IF;
END//

CREATE TRIGGER trg_lote_ubicacion_bu_cantidad
BEFORE UPDATE ON lote_ubicacion
FOR EACH ROW
BEGIN
    DECLARE v_inicial DECIMAL(18,3);
    DECLARE v_otras_ubicaciones DECIMAL(18,3);

    IF NEW.id_lote <> OLD.id_lote OR NEW.id_ubicacion <> OLD.id_ubicacion THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Lote y ubicación son inmutables; registre un movimiento controlado';
    END IF;

    SELECT cantidad_inicial INTO v_inicial
      FROM lote_producto
     WHERE id_lote = NEW.id_lote;

    SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_otras_ubicaciones
      FROM lote_ubicacion
     WHERE id_lote = NEW.id_lote
       AND id_lote_ubicacion <> OLD.id_lote_ubicacion;

    IF ROUND(v_otras_ubicaciones + NEW.cantidad_actual, 3) > v_inicial THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La existencia física supera la cantidad inicial del lote';
    END IF;
END//

-- ------------------------------------------------------------
-- Venta, trazabilidad, pagos y protección de inventario
-- ------------------------------------------------------------

CREATE TRIGGER trg_venta_bi_sesion_abierta
BEFORE INSERT ON venta
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM sesion_caja sc
         WHERE sc.id_sesion_caja = NEW.id_sesion_caja
           AND sc.estado = 'ABIERTA'
           AND sc.fecha_hora_cierre IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La venta requiere una sesión de caja ABIERTA';
    END IF;
END//

CREATE TRIGGER trg_venta_bu_historial
BEFORE UPDATE ON venta
FOR EACH ROW
BEGIN
    IF NEW.id_sesion_caja <> OLD.id_sesion_caja
       OR NEW.fecha_hora <> OLD.fecha_hora THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La sesión y fecha de una venta son inmutables';
    END IF;

    IF OLD.estado = 'ANULADA' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Una venta anulada es inmutable';
    END IF;

    IF OLD.estado = 'VIGENTE' AND NEW.estado = 'ANULADA'
       AND COALESCE(@paris_anulando_venta, 0) <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Use sp_anular_venta para devolver el inventario';
    END IF;
END//

CREATE TRIGGER trg_dvl_bi_integridad
BEFORE INSERT ON detalle_venta_lote
FOR EACH ROW
BEGIN
    DECLARE v_producto_venta INT UNSIGNED;
    DECLARE v_producto_lote INT UNSIGNED;
    DECLARE v_requerido DECIMAL(18,3);
    DECLARE v_asignado DECIMAL(18,3);
    DECLARE v_disponible DECIMAL(18,3);
    DECLARE v_vencimiento DATE;
    DECLARE v_estado_venta VARCHAR(20);
    DECLARE v_estado_sesion VARCHAR(20);

    SELECT pp.id_producto,
           ROUND(dv.cantidad * pp.factor_conversion, 3),
           v.estado,
           sc.estado
      INTO v_producto_venta, v_requerido, v_estado_venta, v_estado_sesion
      FROM detalle_venta dv
      INNER JOIN presentacion_producto pp
        ON pp.id_presentacion = dv.id_presentacion
      INNER JOIN venta v
        ON v.id_venta = dv.id_venta
      INNER JOIN sesion_caja sc
        ON sc.id_sesion_caja = v.id_sesion_caja
     WHERE dv.id_detalle_venta = NEW.id_detalle_venta;

    SELECT pp.id_producto, lu.cantidad_actual, lp.fecha_vencimiento
      INTO v_producto_lote, v_disponible, v_vencimiento
      FROM lote_ubicacion lu
      INNER JOIN lote_producto lp
        ON lp.id_lote = lu.id_lote
      INNER JOIN detalle_compra dc
        ON dc.id_detalle_compra = lp.id_detalle_compra
      INNER JOIN presentacion_producto pp
        ON pp.id_presentacion = dc.id_presentacion
     WHERE lu.id_lote_ubicacion = NEW.id_lote_ubicacion;

    IF v_estado_venta <> 'VIGENTE' OR v_estado_sesion <> 'ABIERTA' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Solo se consume inventario para ventas vigentes en caja abierta';
    END IF;

    IF v_producto_venta <> v_producto_lote THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El lote no pertenece al producto vendido';
    END IF;

    IF v_vencimiento IS NOT NULL AND v_vencimiento <= CURRENT_DATE THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede vender un lote vencido';
    END IF;

    IF NEW.cantidad_base > v_disponible THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Stock insuficiente en el lote seleccionado';
    END IF;

    SELECT COALESCE(SUM(cantidad_base), 0)
      INTO v_asignado
      FROM detalle_venta_lote
     WHERE id_detalle_venta = NEW.id_detalle_venta;

    IF ROUND(v_asignado + NEW.cantidad_base, 3) > v_requerido THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La asignación de lotes supera la cantidad base vendida';
    END IF;
END//

CREATE TRIGGER trg_dvl_ai_descontar_stock
AFTER INSERT ON detalle_venta_lote
FOR EACH ROW
BEGIN
    UPDATE lote_ubicacion
       SET cantidad_actual = cantidad_actual - NEW.cantidad_base
     WHERE id_lote_ubicacion = NEW.id_lote_ubicacion;
END//

CREATE TRIGGER trg_dvl_bu_inmutable
BEFORE UPDATE ON detalle_venta_lote
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'DETALLE_VENTA_LOTE es histórico e inmutable';
END//

CREATE TRIGGER trg_dvl_bd_inmutable
BEFORE DELETE ON detalle_venta_lote
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'DETALLE_VENTA_LOTE no se elimina; anule la venta';
END//

CREATE TRIGGER trg_pago_bi_total
BEFORE INSERT ON pago
FOR EACH ROW
BEGIN
    DECLARE v_total_venta DECIMAL(18,2);
    DECLARE v_total_pagado DECIMAL(18,2);
    DECLARE v_estado_venta VARCHAR(20);
    DECLARE v_estado_sesion VARCHAR(20);

    SELECT v.estado, sc.estado,
           COALESCE(SUM(ROUND(dv.cantidad * dv.precio_unitario, 2)), 0)
      INTO v_estado_venta, v_estado_sesion, v_total_venta
      FROM venta v
      INNER JOIN sesion_caja sc
        ON sc.id_sesion_caja = v.id_sesion_caja
      LEFT JOIN detalle_venta dv
        ON dv.id_venta = v.id_venta
     WHERE v.id_venta = NEW.id_venta
     GROUP BY v.id_venta, v.estado, sc.estado;

    IF v_estado_venta <> 'VIGENTE' OR v_estado_sesion <> 'ABIERTA' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Solo se agregan pagos a ventas vigentes en caja abierta';
    END IF;

    SELECT COALESCE(SUM(monto), 0) INTO v_total_pagado
      FROM pago
     WHERE id_venta = NEW.id_venta;

    IF ROUND(v_total_pagado + NEW.monto, 2) > v_total_venta THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Los pagos no pueden superar el total de la venta';
    END IF;
END//

CREATE TRIGGER trg_pago_bu_inmutable
BEFORE UPDATE ON pago
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Los pagos confirmados son históricos e inmutables';
END//

CREATE TRIGGER trg_pago_bd_inmutable
BEFORE DELETE ON pago
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Los pagos confirmados no se eliminan';
END//

-- ------------------------------------------------------------
-- Ajustes y arqueos
-- ------------------------------------------------------------

CREATE TRIGGER trg_ajuste_bi_stock
BEFORE INSERT ON ajuste_inventario
FOR EACH ROW
BEGIN
    DECLARE v_disponible DECIMAL(18,3);
    DECLARE v_vencimiento DATE;

    SELECT lu.cantidad_actual, lp.fecha_vencimiento
      INTO v_disponible, v_vencimiento
      FROM lote_ubicacion lu
      INNER JOIN lote_producto lp ON lp.id_lote = lu.id_lote
     WHERE lu.id_lote_ubicacion = NEW.id_lote_ubicacion;

    IF NEW.cantidad > v_disponible THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El ajuste no puede superar la existencia física';
    END IF;

    IF NEW.tipo_ajuste = 'VENCIDO'
       AND (v_vencimiento IS NULL OR v_vencimiento > CURRENT_DATE) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El ajuste VENCIDO requiere un lote vencido';
    END IF;
END//

CREATE TRIGGER trg_ajuste_ai_descontar_stock
AFTER INSERT ON ajuste_inventario
FOR EACH ROW
BEGIN
    UPDATE lote_ubicacion
       SET cantidad_actual = cantidad_actual - NEW.cantidad
     WHERE id_lote_ubicacion = NEW.id_lote_ubicacion;
END//

CREATE TRIGGER trg_ajuste_bu_inmutable
BEFORE UPDATE ON ajuste_inventario
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Los ajustes confirmados son históricos e inmutables';
END//

CREATE TRIGGER trg_ajuste_bd_inmutable
BEFORE DELETE ON ajuste_inventario
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Los ajustes confirmados no se eliminan';
END//

CREATE TRIGGER trg_arqueo_bi_sesion_cerrada
BEFORE INSERT ON arqueo_caja
FOR EACH ROW
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM sesion_caja sc
         WHERE sc.id_sesion_caja = NEW.id_sesion_caja
           AND sc.estado = 'CERRADA'
           AND sc.fecha_hora_cierre IS NOT NULL
           AND NEW.fecha_hora >= sc.fecha_hora_cierre
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El arqueo requiere una sesión cerrada y una fecha coherente';
    END IF;
END//

-- ------------------------------------------------------------
-- Procedimiento: compra e ingreso en unidad base
-- ------------------------------------------------------------

CREATE PROCEDURE sp_registrar_compra(
    IN p_id_proveedor INT UNSIGNED,
    IN p_id_usuario INT UNSIGNED,
    IN p_fecha_hora DATETIME,
    IN p_observacion VARCHAR(250),
    IN p_detalles JSON,
    OUT p_id_compra INT UNSIGNED
)
BEGIN
    DECLARE v_orden INT;
    DECLARE v_id_presentacion INT UNSIGNED;
    DECLARE v_cantidad DECIMAL(15,3);
    DECLARE v_costo DECIMAL(15,2);
    DECLARE v_codigo_lote VARCHAR(80);
    DECLARE v_fecha_vencimiento DATE;
    DECLARE v_id_ubicacion INT UNSIGNED;
    DECLARE v_factor DECIMAL(15,3);
    DECLARE v_cantidad_base DECIMAL(18,3);
    DECLARE v_id_detalle INT UNSIGNED;
    DECLARE v_id_lote INT UNSIGNED;
    DECLARE v_count INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS tmp_compra_detalle;
        SET p_id_compra = NULL;
        RESIGNAL;
    END;

    SET p_id_compra = NULL;

    IF p_detalles IS NULL OR JSON_TYPE(p_detalles) <> 'ARRAY'
       OR JSON_LENGTH(p_detalles) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La compra requiere al menos un detalle JSON';
    END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_compra_detalle;
    CREATE TEMPORARY TABLE tmp_compra_detalle (
        orden INT NOT NULL PRIMARY KEY,
        id_presentacion INT UNSIGNED NULL,
        cantidad DECIMAL(15,3) NULL,
        costo_unitario DECIMAL(15,2) NULL,
        codigo_lote VARCHAR(80) NULL,
        fecha_vencimiento DATE NULL,
        id_ubicacion INT UNSIGNED NULL,
        procesado BOOLEAN NOT NULL DEFAULT FALSE
    ) ENGINE=InnoDB;

    INSERT INTO tmp_compra_detalle (
        orden, id_presentacion, cantidad, costo_unitario,
        codigo_lote, fecha_vencimiento, id_ubicacion
    )
    SELECT jt.orden, jt.id_presentacion, jt.cantidad, jt.costo_unitario,
           jt.codigo_lote, jt.fecha_vencimiento, jt.id_ubicacion
      FROM JSON_TABLE(
          p_detalles,
          '$[*]' COLUMNS (
              orden FOR ORDINALITY,
              id_presentacion INT PATH '$.id_presentacion',
              cantidad DECIMAL(15,3) PATH '$.cantidad',
              costo_unitario DECIMAL(15,2) PATH '$.costo_unitario',
              codigo_lote VARCHAR(80) PATH '$.codigo_lote' NULL ON EMPTY,
              fecha_vencimiento DATE PATH '$.fecha_vencimiento' NULL ON EMPTY,
              id_ubicacion INT PATH '$.id_ubicacion'
          )
      ) AS jt;

    IF EXISTS (
        SELECT 1 FROM tmp_compra_detalle
         WHERE id_presentacion IS NULL
            OR cantidad IS NULL OR cantidad <= 0
            OR costo_unitario IS NULL OR costo_unitario < 0
            OR id_ubicacion IS NULL
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Detalle de compra inválido';
    END IF;

    START TRANSACTION;

    SELECT COUNT(*) INTO v_count
      FROM proveedor
     WHERE id_proveedor = p_id_proveedor AND estado = 'ACTIVO';
    IF v_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Proveedor inexistente o inactivo';
    END IF;

    SELECT COUNT(*) INTO v_count
      FROM usuario
     WHERE id_usuario = p_id_usuario AND estado = 'ACTIVO';
    IF v_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Usuario inexistente o inactivo';
    END IF;

    INSERT INTO compra (id_proveedor, id_usuario, fecha_hora, observacion)
    VALUES (p_id_proveedor, p_id_usuario,
            COALESCE(p_fecha_hora, CURRENT_TIMESTAMP), p_observacion);
    SET p_id_compra = LAST_INSERT_ID();

    WHILE EXISTS (SELECT 1 FROM tmp_compra_detalle WHERE procesado = FALSE) DO
        SELECT MIN(orden) INTO v_orden
          FROM tmp_compra_detalle
         WHERE procesado = FALSE;

        SELECT id_presentacion, cantidad, costo_unitario,
               codigo_lote, fecha_vencimiento, id_ubicacion
          INTO v_id_presentacion, v_cantidad, v_costo,
               v_codigo_lote, v_fecha_vencimiento, v_id_ubicacion
          FROM tmp_compra_detalle
         WHERE orden = v_orden;

        SELECT COUNT(*) INTO v_count
          FROM presentacion_producto pp
          INNER JOIN producto p ON p.id_producto = pp.id_producto
          INNER JOIN ubicacion u ON u.id_ubicacion = v_id_ubicacion
         WHERE pp.id_presentacion = v_id_presentacion
           AND pp.estado = 'ACTIVO'
           AND p.estado = 'ACTIVO'
           AND u.estado = 'ACTIVO';

        IF v_count <> 1 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Presentación, producto o ubicación inexistente/inactiva';
        END IF;

        SELECT pp.factor_conversion INTO v_factor
          FROM presentacion_producto pp
         WHERE pp.id_presentacion = v_id_presentacion
         FOR UPDATE;

        SET v_cantidad_base = ROUND(v_cantidad * v_factor, 3);
        IF v_cantidad_base <= 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'La conversión de compra produjo una cantidad base inválida';
        END IF;

        INSERT INTO detalle_compra (
            id_compra, id_presentacion, cantidad, costo_unitario
        ) VALUES (
            p_id_compra, v_id_presentacion, v_cantidad, v_costo
        );
        SET v_id_detalle = LAST_INSERT_ID();

        INSERT INTO lote_producto (
            id_detalle_compra, codigo_lote,
            fecha_vencimiento, cantidad_inicial
        ) VALUES (
            v_id_detalle, NULLIF(TRIM(v_codigo_lote), ''),
            v_fecha_vencimiento, v_cantidad_base
        );
        SET v_id_lote = LAST_INSERT_ID();

        INSERT INTO lote_ubicacion (id_lote, id_ubicacion, cantidad_actual)
        VALUES (v_id_lote, v_id_ubicacion, v_cantidad_base);

        UPDATE tmp_compra_detalle SET procesado = TRUE WHERE orden = v_orden;
    END WHILE;

    COMMIT;
    DROP TEMPORARY TABLE IF EXISTS tmp_compra_detalle;
END//

-- ------------------------------------------------------------
-- Procedimiento: venta completa, pagos y FIFO atómicos
-- ------------------------------------------------------------

CREATE PROCEDURE sp_registrar_venta(
    IN p_id_sesion_caja INT UNSIGNED,
    IN p_detalles JSON,
    IN p_pagos JSON,
    OUT p_id_venta INT UNSIGNED
)
BEGIN
    DECLARE v_orden INT;
    DECLARE v_id_presentacion INT UNSIGNED;
    DECLARE v_cantidad DECIMAL(15,3);
    DECLARE v_id_producto INT UNSIGNED;
    DECLARE v_factor DECIMAL(15,3);
    DECLARE v_precio DECIMAL(15,2);
    DECLARE v_requerido DECIMAL(18,3);
    DECLARE v_restante DECIMAL(18,3);
    DECLARE v_id_detalle_venta INT UNSIGNED;
    DECLARE v_id_lote_ubicacion INT UNSIGNED;
    DECLARE v_disponible_lote DECIMAL(18,3);
    DECLARE v_tomar DECIMAL(18,3);
    DECLARE v_estado_sesion VARCHAR(20);
    DECLARE v_total_venta DECIMAL(18,2);
    DECLARE v_total_pago DECIMAL(18,2);
    DECLARE v_metodo VARCHAR(20);
    DECLARE v_monto DECIMAL(15,2);
    DECLARE v_comprobante VARCHAR(255);
    DECLARE v_count INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS tmp_venta_detalle;
        DROP TEMPORARY TABLE IF EXISTS tmp_venta_pago;
        SET p_id_venta = NULL;
        RESIGNAL;
    END;

    SET p_id_venta = NULL;

    IF p_detalles IS NULL OR JSON_TYPE(p_detalles) <> 'ARRAY'
       OR JSON_LENGTH(p_detalles) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La venta requiere al menos un detalle JSON';
    END IF;

    IF p_pagos IS NULL OR JSON_TYPE(p_pagos) <> 'ARRAY'
       OR JSON_LENGTH(p_pagos) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La venta requiere al menos un pago JSON';
    END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_venta_detalle;
    DROP TEMPORARY TABLE IF EXISTS tmp_venta_pago;

    CREATE TEMPORARY TABLE tmp_venta_detalle (
        orden INT NOT NULL PRIMARY KEY,
        id_presentacion INT UNSIGNED NULL,
        cantidad DECIMAL(15,3) NULL,
        procesado BOOLEAN NOT NULL DEFAULT FALSE
    ) ENGINE=InnoDB;

    CREATE TEMPORARY TABLE tmp_venta_pago (
        orden INT NOT NULL PRIMARY KEY,
        metodo_pago VARCHAR(20) NULL,
        monto DECIMAL(15,2) NULL,
        comprobante_qr VARCHAR(255) NULL,
        procesado BOOLEAN NOT NULL DEFAULT FALSE
    ) ENGINE=InnoDB;

    INSERT INTO tmp_venta_detalle (orden, id_presentacion, cantidad)
    SELECT jt.orden, jt.id_presentacion, jt.cantidad
      FROM JSON_TABLE(
          p_detalles,
          '$[*]' COLUMNS (
              orden FOR ORDINALITY,
              id_presentacion INT PATH '$.id_presentacion',
              cantidad DECIMAL(15,3) PATH '$.cantidad'
          )
      ) AS jt;

    INSERT INTO tmp_venta_pago (orden, metodo_pago, monto, comprobante_qr)
    SELECT jt.orden, UPPER(jt.metodo_pago), jt.monto, jt.comprobante_qr
      FROM JSON_TABLE(
          p_pagos,
          '$[*]' COLUMNS (
              orden FOR ORDINALITY,
              metodo_pago VARCHAR(20) PATH '$.metodo_pago',
              monto DECIMAL(15,2) PATH '$.monto',
              comprobante_qr VARCHAR(255) PATH '$.comprobante_qr' NULL ON EMPTY
          )
      ) AS jt;

    IF EXISTS (
        SELECT 1 FROM tmp_venta_detalle
         WHERE id_presentacion IS NULL OR cantidad IS NULL OR cantidad <= 0
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Detalle de venta inválido';
    END IF;

    IF EXISTS (
        SELECT 1 FROM tmp_venta_pago
         WHERE metodo_pago NOT IN ('EFECTIVO', 'QR')
            OR monto IS NULL OR monto <= 0
            OR (metodo_pago = 'QR'
                AND (comprobante_qr IS NULL OR TRIM(comprobante_qr) = ''))
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Pago inválido o QR sin comprobante';
    END IF;

    START TRANSACTION;

    SELECT COUNT(*) INTO v_count
      FROM sesion_caja
     WHERE id_sesion_caja = p_id_sesion_caja;
    IF v_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La sesión de caja no existe';
    END IF;

    SELECT estado INTO v_estado_sesion
      FROM sesion_caja
     WHERE id_sesion_caja = p_id_sesion_caja
     FOR UPDATE;

    IF v_estado_sesion <> 'ABIERTA' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede vender en una sesión CERRADA';
    END IF;

    INSERT INTO venta (id_sesion_caja, fecha_hora, estado, motivo_anulacion)
    VALUES (p_id_sesion_caja, CURRENT_TIMESTAMP, 'VIGENTE', NULL);
    SET p_id_venta = LAST_INSERT_ID();

    WHILE EXISTS (SELECT 1 FROM tmp_venta_detalle WHERE procesado = FALSE) DO
        SELECT orden, id_presentacion, cantidad
          INTO v_orden, v_id_presentacion, v_cantidad
          FROM tmp_venta_detalle
         WHERE procesado = FALSE
         ORDER BY id_presentacion, orden
         LIMIT 1;

        SELECT COUNT(*) INTO v_count
          FROM presentacion_producto pp
          INNER JOIN producto p ON p.id_producto = pp.id_producto
         WHERE pp.id_presentacion = v_id_presentacion
           AND pp.estado = 'ACTIVO'
           AND p.estado = 'ACTIVO';

        IF v_count <> 1 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Presentación inexistente o inactiva';
        END IF;

        SELECT pp.id_producto, pp.factor_conversion, pp.precio_venta
          INTO v_id_producto, v_factor, v_precio
          FROM presentacion_producto pp
         WHERE pp.id_presentacion = v_id_presentacion
         FOR UPDATE;

        SET v_requerido = ROUND(v_cantidad * v_factor, 3);
        IF v_factor <= 0 OR v_requerido <= 0 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'factor_conversion o cantidad base inválidos';
        END IF;

        INSERT INTO detalle_venta (
            id_venta, id_presentacion, cantidad, precio_unitario
        ) VALUES (
            p_id_venta, v_id_presentacion, v_cantidad, v_precio
        );
        SET v_id_detalle_venta = LAST_INSERT_ID();
        SET v_restante = v_requerido;

        WHILE v_restante > 0 DO
            SET v_id_lote_ubicacion = NULL;
            SET v_disponible_lote = NULL;

            BEGIN
                DECLARE CONTINUE HANDLER FOR NOT FOUND
                    SET v_id_lote_ubicacion = NULL;

                SELECT lu.id_lote_ubicacion, lu.cantidad_actual
                  INTO v_id_lote_ubicacion, v_disponible_lote
                  FROM lote_ubicacion lu
                  INNER JOIN lote_producto lp ON lp.id_lote = lu.id_lote
                  INNER JOIN detalle_compra dc
                    ON dc.id_detalle_compra = lp.id_detalle_compra
                  INNER JOIN presentacion_producto pp_lote
                    ON pp_lote.id_presentacion = dc.id_presentacion
                  INNER JOIN compra c ON c.id_compra = dc.id_compra
                  INNER JOIN ubicacion u ON u.id_ubicacion = lu.id_ubicacion
                 WHERE pp_lote.id_producto = v_id_producto
                   AND lu.cantidad_actual > 0
                   AND (lp.fecha_vencimiento IS NULL
                        OR lp.fecha_vencimiento > CURRENT_DATE)
                   AND u.estado = 'ACTIVO'
                 ORDER BY c.fecha_hora, lp.id_lote, lu.id_lote_ubicacion
                 LIMIT 1
                 FOR UPDATE;
            END;

            IF v_id_lote_ubicacion IS NULL THEN
                SIGNAL SQLSTATE '45000'
                    SET MESSAGE_TEXT = 'Stock vendible insuficiente para completar la venta';
            END IF;

            SET v_tomar = LEAST(v_restante, v_disponible_lote);

            INSERT INTO detalle_venta_lote (
                id_detalle_venta, id_lote_ubicacion, cantidad_base
            ) VALUES (
                v_id_detalle_venta, v_id_lote_ubicacion, v_tomar
            );

            SET v_restante = ROUND(v_restante - v_tomar, 3);
        END WHILE;

        UPDATE tmp_venta_detalle SET procesado = TRUE WHERE orden = v_orden;
    END WHILE;

    SELECT COALESCE(SUM(ROUND(cantidad * precio_unitario, 2)), 0)
      INTO v_total_venta
      FROM detalle_venta
     WHERE id_venta = p_id_venta;

    SELECT COALESCE(SUM(monto), 0)
      INTO v_total_pago
      FROM tmp_venta_pago;

    IF v_total_pago <> v_total_venta THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La suma de pagos debe ser exactamente igual al total de venta';
    END IF;

    WHILE EXISTS (SELECT 1 FROM tmp_venta_pago WHERE procesado = FALSE) DO
        SELECT MIN(orden) INTO v_orden
          FROM tmp_venta_pago
         WHERE procesado = FALSE;

        SELECT metodo_pago, monto, comprobante_qr
          INTO v_metodo, v_monto, v_comprobante
          FROM tmp_venta_pago
         WHERE orden = v_orden;

        INSERT INTO pago (id_venta, metodo_pago, monto, comprobante_qr)
        VALUES (p_id_venta, v_metodo, v_monto,
                CASE WHEN v_metodo = 'QR'
                     THEN NULLIF(TRIM(v_comprobante), '')
                     ELSE NULL
                END);

        UPDATE tmp_venta_pago SET procesado = TRUE WHERE orden = v_orden;
    END WHILE;

    COMMIT;
    DROP TEMPORARY TABLE IF EXISTS tmp_venta_detalle;
    DROP TEMPORARY TABLE IF EXISTS tmp_venta_pago;
END//

-- ------------------------------------------------------------
-- Procedimiento: anulación con devolución exacta por lote
-- ------------------------------------------------------------

CREATE PROCEDURE sp_anular_venta(
    IN p_id_venta INT UNSIGNED,
    IN p_motivo VARCHAR(250)
)
BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_id_lote_ubicacion INT UNSIGNED;
    DECLARE v_cantidad DECIMAL(18,3);
    DECLARE v_stock DECIMAL(18,3);
    DECLARE v_count INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        SET @paris_anulando_venta = NULL;
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS tmp_devolucion_venta;
        RESIGNAL;
    END;

    IF p_motivo IS NULL OR TRIM(p_motivo) = '' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La anulación requiere un motivo';
    END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_devolucion_venta;
    CREATE TEMPORARY TABLE tmp_devolucion_venta (
        id_lote_ubicacion INT UNSIGNED NOT NULL PRIMARY KEY,
        cantidad DECIMAL(18,3) NOT NULL,
        procesado BOOLEAN NOT NULL DEFAULT FALSE
    ) ENGINE=InnoDB;

    START TRANSACTION;

    SELECT COUNT(*) INTO v_count FROM venta WHERE id_venta = p_id_venta;
    IF v_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La venta no existe';
    END IF;

    SELECT estado INTO v_estado
      FROM venta
     WHERE id_venta = p_id_venta
     FOR UPDATE;

    IF v_estado <> 'VIGENTE' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La venta ya fue anulada';
    END IF;

    INSERT INTO tmp_devolucion_venta (id_lote_ubicacion, cantidad)
    SELECT dvl.id_lote_ubicacion, SUM(dvl.cantidad_base)
      FROM detalle_venta_lote dvl
      INNER JOIN detalle_venta dv
        ON dv.id_detalle_venta = dvl.id_detalle_venta
     WHERE dv.id_venta = p_id_venta
     GROUP BY dvl.id_lote_ubicacion;

    IF NOT EXISTS (SELECT 1 FROM tmp_devolucion_venta) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La venta no posee trazabilidad de lotes';
    END IF;

    WHILE EXISTS (SELECT 1 FROM tmp_devolucion_venta WHERE procesado = FALSE) DO
        SELECT id_lote_ubicacion, cantidad
          INTO v_id_lote_ubicacion, v_cantidad
          FROM tmp_devolucion_venta
         WHERE procesado = FALSE
         ORDER BY id_lote_ubicacion
         LIMIT 1;

        SELECT cantidad_actual INTO v_stock
          FROM lote_ubicacion
         WHERE id_lote_ubicacion = v_id_lote_ubicacion
         FOR UPDATE;

        UPDATE lote_ubicacion
           SET cantidad_actual = cantidad_actual + v_cantidad
         WHERE id_lote_ubicacion = v_id_lote_ubicacion;

        UPDATE tmp_devolucion_venta
           SET procesado = TRUE
         WHERE id_lote_ubicacion = v_id_lote_ubicacion;
    END WHILE;

    SET @paris_anulando_venta = 1;
    UPDATE venta
       SET estado = 'ANULADA', motivo_anulacion = TRIM(p_motivo)
     WHERE id_venta = p_id_venta;
    SET @paris_anulando_venta = NULL;

    COMMIT;
    DROP TEMPORARY TABLE IF EXISTS tmp_devolucion_venta;
END//

-- ------------------------------------------------------------
-- Procedimiento: ajuste de inventario atómico
-- ------------------------------------------------------------

CREATE PROCEDURE sp_registrar_ajuste_inventario(
    IN p_id_lote_ubicacion INT UNSIGNED,
    IN p_id_usuario INT UNSIGNED,
    IN p_tipo_ajuste VARCHAR(30),
    IN p_cantidad DECIMAL(15,3),
    IN p_observacion VARCHAR(250),
    OUT p_id_ajuste INT UNSIGNED
)
BEGIN
    DECLARE v_stock DECIMAL(18,3);
    DECLARE v_count INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        SET p_id_ajuste = NULL;
        RESIGNAL;
    END;

    SET p_id_ajuste = NULL;

    IF p_tipo_ajuste NOT IN ('DAÑADO', 'PERDIDO', 'VENCIDO', 'OTRO')
       OR p_cantidad IS NULL OR p_cantidad <= 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Tipo o cantidad de ajuste inválidos';
    END IF;

    START TRANSACTION;

    SELECT COUNT(*) INTO v_count
      FROM usuario
     WHERE id_usuario = p_id_usuario AND estado = 'ACTIVO';
    IF v_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Usuario inexistente o inactivo';
    END IF;

    SELECT COUNT(*) INTO v_count
      FROM lote_ubicacion
     WHERE id_lote_ubicacion = p_id_lote_ubicacion;
    IF v_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La existencia de lote y ubicación no existe';
    END IF;

    SELECT cantidad_actual INTO v_stock
      FROM lote_ubicacion
     WHERE id_lote_ubicacion = p_id_lote_ubicacion
     FOR UPDATE;

    IF p_cantidad > v_stock THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El ajuste no puede dejar stock negativo';
    END IF;

    INSERT INTO ajuste_inventario (
        id_lote_ubicacion, id_usuario, fecha_hora,
        tipo_ajuste, cantidad, observacion
    ) VALUES (
        p_id_lote_ubicacion, p_id_usuario, CURRENT_TIMESTAMP,
        p_tipo_ajuste, p_cantidad, p_observacion
    );
    SET p_id_ajuste = LAST_INSERT_ID();

    COMMIT;
END//

-- ------------------------------------------------------------
-- Procedimiento: cierre y arqueo atómicos
-- ------------------------------------------------------------

CREATE PROCEDURE sp_cerrar_sesion_caja(
    IN p_id_sesion_caja INT UNSIGNED,
    IN p_fecha_hora DATETIME,
    IN p_observacion VARCHAR(250),
    IN p_conteo JSON,
    OUT p_id_arqueo INT UNSIGNED
)
BEGIN
    DECLARE v_fecha DATETIME;
    DECLARE v_estado VARCHAR(20);
    DECLARE v_esperado DECIMAL(18,2);
    DECLARE v_contado DECIMAL(18,2);
    DECLARE v_count INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS tmp_conteo_caja;
        SET p_id_arqueo = NULL;
        RESIGNAL;
    END;

    SET p_id_arqueo = NULL;
    SET v_fecha = COALESCE(p_fecha_hora, CURRENT_TIMESTAMP);

    IF p_conteo IS NULL OR JSON_TYPE(p_conteo) <> 'ARRAY'
       OR JSON_LENGTH(p_conteo) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El cierre requiere el conteo de denominaciones';
    END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_conteo_caja;
    CREATE TEMPORARY TABLE tmp_conteo_caja (
        orden INT NOT NULL PRIMARY KEY,
        id_denominacion INT UNSIGNED NULL,
        cantidad INT UNSIGNED NULL
    ) ENGINE=InnoDB;

    INSERT INTO tmp_conteo_caja (orden, id_denominacion, cantidad)
    SELECT jt.orden, jt.id_denominacion, jt.cantidad
      FROM JSON_TABLE(
          p_conteo,
          '$[*]' COLUMNS (
              orden FOR ORDINALITY,
              id_denominacion INT PATH '$.id_denominacion',
              cantidad INT PATH '$.cantidad'
          )
      ) AS jt;

    -- MySQL 8.0 no permite reabrir la misma TEMPORARY TABLE dos veces
    -- dentro de una sola expresión. Las validaciones se ejecutan en
    -- sentencias separadas para mantener compatibilidad con 8.0.44.
    SELECT COUNT(*) INTO v_count
      FROM tmp_conteo_caja
     WHERE id_denominacion IS NULL OR cantidad IS NULL;

    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Conteo de caja inválido';
    END IF;

    SELECT COUNT(*) INTO v_count
      FROM (
          SELECT id_denominacion
            FROM tmp_conteo_caja
           GROUP BY id_denominacion
          HAVING COUNT(*) > 1
      ) AS denominaciones_repetidas;

    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Conteo de caja con denominaciones repetidas';
    END IF;

    START TRANSACTION;

    SELECT COUNT(*) INTO v_count
      FROM sesion_caja
     WHERE id_sesion_caja = p_id_sesion_caja;
    IF v_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La sesión de caja no existe';
    END IF;

    SELECT estado INTO v_estado
      FROM sesion_caja
     WHERE id_sesion_caja = p_id_sesion_caja
     FOR UPDATE;

    IF v_estado <> 'ABIERTA' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La sesión ya está cerrada';
    END IF;

    SELECT COUNT(*) INTO v_count
      FROM tmp_conteo_caja tc
      LEFT JOIN denominacion d
        ON d.id_denominacion = tc.id_denominacion
       AND d.estado = 'ACTIVO'
     WHERE d.id_denominacion IS NULL;
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'El conteo contiene denominaciones inexistentes o inactivas';
    END IF;

    UPDATE sesion_caja
       SET fecha_hora_cierre = v_fecha,
           estado = 'CERRADA',
           observacion = p_observacion
     WHERE id_sesion_caja = p_id_sesion_caja;

    INSERT INTO arqueo_caja (id_sesion_caja, fecha_hora, observacion)
    VALUES (p_id_sesion_caja, v_fecha, p_observacion);
    SET p_id_arqueo = LAST_INSERT_ID();

    INSERT INTO detalle_arqueo (id_arqueo, id_denominacion, cantidad)
    SELECT p_id_arqueo, id_denominacion, cantidad
      FROM tmp_conteo_caja;

    SELECT sc.monto_inicial
           + COALESCE(SUM(
                 CASE WHEN v.estado = 'VIGENTE'
                           AND pg.metodo_pago = 'EFECTIVO'
                      THEN pg.monto ELSE 0 END
             ), 0)
      INTO v_esperado
      FROM sesion_caja sc
      LEFT JOIN venta v ON v.id_sesion_caja = sc.id_sesion_caja
      LEFT JOIN pago pg ON pg.id_venta = v.id_venta
     WHERE sc.id_sesion_caja = p_id_sesion_caja
     GROUP BY sc.id_sesion_caja, sc.monto_inicial;

    SELECT COALESCE(SUM(d.valor * da.cantidad), 0)
      INTO v_contado
      FROM detalle_arqueo da
      INNER JOIN denominacion d
        ON d.id_denominacion = da.id_denominacion
     WHERE da.id_arqueo = p_id_arqueo;

    IF v_contado <> v_esperado
       AND (p_observacion IS NULL OR TRIM(p_observacion) = '') THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Una diferencia de caja requiere observación';
    END IF;

    COMMIT;
    DROP TEMPORARY TABLE IF EXISTS tmp_conteo_caja;
END//

DELIMITER ;

