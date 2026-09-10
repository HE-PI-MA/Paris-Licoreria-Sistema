-- U004. Ejecutar con: node scripts/migrate.js --backup RUTA_DEL_RESPALDO.sql
-- No elimina tablas ni filas existentes. DDL no es atomico en MySQL: detener la aplicacion.
-- Requiere el esquema V2 auditado y conserva las firmas de sus cinco procedimientos.
CREATE TABLE IF NOT EXISTS sesion_web (
    sid VARCHAR(128) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
    expires_at BIGINT UNSIGNED NOT NULL,
    data MEDIUMTEXT NOT NULL,
    INDEX idx_sesion_web_expira (expires_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS app_migration (
    id VARCHAR(32) NOT NULL PRIMARY KEY,
    checksum CHAR(64) NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
DELIMITER //

DROP PROCEDURE IF EXISTS sp_registrar_compra//

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

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
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

DROP PROCEDURE IF EXISTS sp_registrar_venta//

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

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
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

DROP PROCEDURE IF EXISTS sp_anular_venta//

CREATE PROCEDURE sp_anular_venta(
    IN p_id_venta INT UNSIGNED,
    IN p_motivo VARCHAR(250)
)
BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_sesion INT UNSIGNED;
    DECLARE v_estado_caja VARCHAR(20);
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

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;

    SELECT COUNT(*) INTO v_count FROM venta WHERE id_venta = p_id_venta;
    IF v_count <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La venta no existe';
    END IF;

    SELECT id_sesion_caja INTO v_sesion FROM venta WHERE id_venta = p_id_venta;
    -- Lock session before sale, matching sale/closing lock order.
    SELECT estado INTO v_estado_caja FROM sesion_caja
     WHERE id_sesion_caja = v_sesion FOR UPDATE;
    IF v_estado_caja <> 'ABIERTA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se puede anular una venta de caja cerrada';
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

DROP PROCEDURE IF EXISTS sp_registrar_ajuste_inventario//

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

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
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

DROP PROCEDURE IF EXISTS sp_cerrar_sesion_caja//

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
        SET @paris_cerrando_sesion = NULL;
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

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
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

    SET @paris_cerrando_sesion = p_id_sesion_caja;
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

    SET @paris_cerrando_sesion = NULL;
    COMMIT;
    DROP TEMPORARY TABLE IF EXISTS tmp_conteo_caja;
END//

DROP TRIGGER IF EXISTS trg_venta_bi_sesion_abierta//

CREATE TRIGGER trg_venta_bi_sesion_abierta
BEFORE INSERT ON venta
FOR EACH ROW
BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_apertura DATETIME;
    SELECT estado, fecha_hora_apertura INTO v_estado, v_apertura
      FROM sesion_caja WHERE id_sesion_caja = NEW.id_sesion_caja FOR UPDATE;
    IF v_estado IS NULL OR v_estado <> 'ABIERTA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La venta requiere caja abierta';
    END IF;
    IF NEW.fecha_hora < v_apertura OR NEW.fecha_hora > CURRENT_TIMESTAMP THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha de venta no pertenece al turno actual';
    END IF;
END//

DROP TRIGGER IF EXISTS trg_venta_bu_historial//

CREATE TRIGGER trg_venta_bu_historial
BEFORE UPDATE ON venta
FOR EACH ROW
BEGIN
    DECLARE v_estado_caja VARCHAR(20);
    SELECT estado INTO v_estado_caja FROM sesion_caja
     WHERE id_sesion_caja = OLD.id_sesion_caja FOR UPDATE;
    IF v_estado_caja <> 'ABIERTA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se modifica una venta de caja cerrada';
    END IF;
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

DROP TRIGGER IF EXISTS trg_sesion_bi_fecha_u004//

CREATE TRIGGER trg_sesion_bi_fecha_u004
BEFORE INSERT ON sesion_caja
FOR EACH ROW
BEGIN
    IF NEW.fecha_hora_apertura > CURRENT_TIMESTAMP OR NEW.estado <> 'ABIERTA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una caja nueva debe abrirse con fecha actual o anterior';
    END IF;
END//

DROP TRIGGER IF EXISTS trg_sesion_bu_historial_u004//

CREATE TRIGGER trg_sesion_bu_historial_u004
BEFORE UPDATE ON sesion_caja
FOR EACH ROW
BEGIN
    DECLARE v_ultima DATETIME;
    IF OLD.estado = 'CERRADA' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una caja cerrada es historica e inmutable';
    END IF;
    IF NEW.id_usuario <> OLD.id_usuario OR NEW.monto_inicial <> OLD.monto_inicial
       OR NEW.fecha_hora_apertura <> OLD.fecha_hora_apertura OR NEW.id_sesion_caja <> OLD.id_sesion_caja THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los datos de apertura son inmutables';
    END IF;
    IF NEW.estado = 'CERRADA' THEN
        IF COALESCE(@paris_cerrando_sesion, 0) <> OLD.id_sesion_caja THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Use sp_cerrar_sesion_caja para cerrar y arquear';
        END IF;
        SELECT MAX(fecha_hora) INTO v_ultima FROM venta WHERE id_sesion_caja = OLD.id_sesion_caja;
        IF NEW.fecha_hora_cierre IS NULL OR NEW.fecha_hora_cierre < OLD.fecha_hora_apertura
           OR NEW.fecha_hora_cierre > CURRENT_TIMESTAMP
           OR (v_ultima IS NOT NULL AND NEW.fecha_hora_cierre < v_ultima) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cierre debe ser posterior a todas las ventas';
        END IF;
    END IF;
END//

DROP TRIGGER IF EXISTS trg_sesion_bd_historial_u004//

CREATE TRIGGER trg_sesion_bd_historial_u004
BEFORE DELETE ON sesion_caja
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las sesiones de caja no se eliminan';
END//

DROP TRIGGER IF EXISTS trg_detalle_venta_bi_u004//

CREATE TRIGGER trg_detalle_venta_bi_u004
BEFORE INSERT ON detalle_venta
FOR EACH ROW
BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_estado_caja VARCHAR(20);
    SELECT v.estado, sc.estado INTO v_estado, v_estado_caja
      FROM venta v JOIN sesion_caja sc ON sc.id_sesion_caja = v.id_sesion_caja
     WHERE v.id_venta = NEW.id_venta FOR UPDATE;
    IF v_estado <> 'VIGENTE' OR v_estado_caja <> 'ABIERTA' OR EXISTS (SELECT 1 FROM pago WHERE id_venta = NEW.id_venta) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se agregan detalles a ventas cobradas, anuladas o de caja cerrada';
    END IF;
END//

DROP TRIGGER IF EXISTS trg_dv_bu_historial_u004//

CREATE TRIGGER trg_dv_bu_historial_u004
BEFORE UPDATE ON detalle_venta
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'detalle_venta es historico e inmutable';
END//

DROP TRIGGER IF EXISTS trg_dv_bd_historial_u004//

CREATE TRIGGER trg_dv_bd_historial_u004
BEFORE DELETE ON detalle_venta
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'detalle_venta es historico e inmutable';
END//

DROP TRIGGER IF EXISTS trg_arqueo_bu_historial_u004//

CREATE TRIGGER trg_arqueo_bu_historial_u004
BEFORE UPDATE ON arqueo_caja
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'arqueo_caja es historico e inmutable';
END//

DROP TRIGGER IF EXISTS trg_arqueo_bd_historial_u004//

CREATE TRIGGER trg_arqueo_bd_historial_u004
BEFORE DELETE ON arqueo_caja
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'arqueo_caja es historico e inmutable';
END//

DROP TRIGGER IF EXISTS trg_da_bu_historial_u004//

CREATE TRIGGER trg_da_bu_historial_u004
BEFORE UPDATE ON detalle_arqueo
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'detalle_arqueo es historico e inmutable';
END//

DROP TRIGGER IF EXISTS trg_da_bd_historial_u004//

CREATE TRIGGER trg_da_bd_historial_u004
BEFORE DELETE ON detalle_arqueo
FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'detalle_arqueo es historico e inmutable';
END//

DROP TRIGGER IF EXISTS trg_arqueo_bi_operacion_u004//

CREATE TRIGGER trg_arqueo_bi_operacion_u004
BEFORE INSERT ON arqueo_caja
FOR EACH ROW
BEGIN
    IF COALESCE(@paris_cerrando_sesion, 0) <> NEW.id_sesion_caja THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El arqueo se registra dentro del cierre de caja';
    END IF;
END//

DROP TRIGGER IF EXISTS trg_da_bi_operacion_u004//

CREATE TRIGGER trg_da_bi_operacion_u004
BEFORE INSERT ON detalle_arqueo
FOR EACH ROW
BEGIN
    DECLARE v_sesion INT UNSIGNED;
    DECLARE v_valor DECIMAL(15,2);
    SELECT id_sesion_caja INTO v_sesion FROM arqueo_caja WHERE id_arqueo = NEW.id_arqueo;
    IF v_sesion IS NULL OR COALESCE(@paris_cerrando_sesion, 0) <> v_sesion THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se agregan conteos fuera del cierre de caja';
    END IF;
    SELECT valor INTO v_valor FROM denominacion WHERE id_denominacion = NEW.id_denominacion FOR UPDATE;
END//

DROP TRIGGER IF EXISTS trg_denominacion_bu_historial_u004//

CREATE TRIGGER trg_denominacion_bu_historial_u004
BEFORE UPDATE ON denominacion
FOR EACH ROW
BEGIN
    IF (NEW.valor <> OLD.valor OR NEW.tipo <> OLD.tipo OR NEW.id_denominacion <> OLD.id_denominacion)
       AND EXISTS (SELECT 1 FROM detalle_arqueo WHERE id_denominacion = OLD.id_denominacion) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una denominacion usada conserva su valor historico';
    END IF;
END//

DELIMITER ;

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
        WHEN (lp.fecha_vencimiento IS NULL OR lp.fecha_vencimiento > CURRENT_DATE)
             AND p.estado = 'ACTIVO' AND u.estado = 'ACTIVO'
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
            WHEN (lp.fecha_vencimiento IS NULL OR lp.fecha_vencimiento > CURRENT_DATE)
                 AND p.estado = 'ACTIVO' AND u.estado = 'ACTIVO'
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
                WHEN (lp.fecha_vencimiento IS NULL OR lp.fecha_vencimiento > CURRENT_DATE)
                     AND p.estado = 'ACTIVO' AND u.estado = 'ACTIVO'
                THEN lu.cantidad_actual ELSE 0
            END
        ), 0) = 0 THEN 'AGOTADO'
        WHEN COALESCE(SUM(
            CASE
                WHEN (lp.fecha_vencimiento IS NULL OR lp.fecha_vencimiento > CURRENT_DATE)
                     AND p.estado = 'ACTIVO' AND u.estado = 'ACTIVO'
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
LEFT JOIN ubicacion u ON u.id_ubicacion = lu.id_ubicacion
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

