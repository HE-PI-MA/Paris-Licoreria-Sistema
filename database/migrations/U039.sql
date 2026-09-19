-- U039: núcleo operativo completo. Agrega cajas físicas, FEFO, auditoría de devoluciones,
-- trazabilidad de anulación e idempotencia de ventas. No borra operaciones históricas.

CREATE TABLE caja (
    id_caja TINYINT UNSIGNED AUTO_INCREMENT,
    nombre VARCHAR(50) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    CONSTRAINT pk_caja PRIMARY KEY (id_caja),
    CONSTRAINT uq_caja_nombre UNIQUE (nombre),
    CONSTRAINT chk_caja_nombre CHECK (TRIM(nombre) <> ''),
    CONSTRAINT chk_caja_estado CHECK (estado IN ('ACTIVA','INACTIVA'))
) ENGINE=InnoDB;

INSERT IGNORE INTO caja (nombre, estado) VALUES ('Caja 1','ACTIVA'),('Caja 2','ACTIVA');

ALTER TABLE sesion_caja
    ADD COLUMN id_caja TINYINT UNSIGNED NULL AFTER id_sesion_caja,
    ADD CONSTRAINT fk_sesion_caja_fisica FOREIGN KEY (id_caja)
        REFERENCES caja(id_caja) ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD INDEX idx_sesion_caja_estado (id_caja, estado, fecha_hora_apertura);

ALTER TABLE venta
    ADD COLUMN fecha_hora_anulacion DATETIME NULL AFTER motivo_anulacion,
    ADD COLUMN id_usuario_anulacion INT UNSIGNED NULL AFTER fecha_hora_anulacion,
    ADD COLUMN operacion_clave CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER id_usuario_anulacion,
    ADD COLUMN solicitud_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER operacion_clave,
    ADD CONSTRAINT fk_venta_usuario_anulacion FOREIGN KEY (id_usuario_anulacion)
        REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT,
    ADD CONSTRAINT uq_venta_operacion UNIQUE (id_sesion_caja, operacion_clave),
    ADD CONSTRAINT chk_venta_operacion CHECK (
        (operacion_clave IS NULL AND solicitud_hash IS NULL)
        OR (operacion_clave IS NOT NULL AND solicitud_hash IS NOT NULL)
    );

CREATE TABLE devolucion_pago (
    id_devolucion BIGINT UNSIGNED AUTO_INCREMENT,
    id_pago INT UNSIGNED NOT NULL,
    id_usuario INT UNSIGNED NOT NULL,
    fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    monto DECIMAL(15,2) NOT NULL,
    referencia VARCHAR(255) NULL,
    motivo VARCHAR(250) NOT NULL,
    CONSTRAINT pk_devolucion_pago PRIMARY KEY (id_devolucion),
    CONSTRAINT uq_devolucion_pago UNIQUE (id_pago),
    CONSTRAINT chk_devolucion_monto CHECK (monto > 0),
    CONSTRAINT chk_devolucion_motivo CHECK (TRIM(motivo) <> ''),
    CONSTRAINT fk_devolucion_pago FOREIGN KEY (id_pago)
        REFERENCES pago(id_pago) ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_devolucion_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario(id_usuario) ON UPDATE RESTRICT ON DELETE RESTRICT,
    INDEX idx_devolucion_fecha (fecha_hora, id_devolucion)
) ENGINE=InnoDB;

-- Facilita la limpieza manual de claves idempotentes ya confirmadas sin afectar operaciones recientes.
ALTER TABLE catalogo_operacion ADD INDEX idx_catalogo_operacion_creada (creada_en);

DELIMITER //

DROP PROCEDURE IF EXISTS sp_registrar_venta//

CREATE PROCEDURE sp_registrar_venta(
    IN p_id_sesion_caja INT UNSIGNED,
    IN p_id_usuario INT UNSIGNED,
    IN p_operacion_clave CHAR(36),
    IN p_solicitud_hash CHAR(64),
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
    DECLARE v_usuario_sesion INT UNSIGNED;
    DECLARE v_total_venta DECIMAL(18,2);
    DECLARE v_total_pago DECIMAL(18,2);
    DECLARE v_metodo VARCHAR(20);
    DECLARE v_monto DECIMAL(15,2);
    DECLARE v_comprobante VARCHAR(255);
    DECLARE v_count INT;
    DECLARE v_hash_existente CHAR(64);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS tmp_venta_detalle;
        DROP TEMPORARY TABLE IF EXISTS tmp_venta_pago;
        SET p_id_venta = NULL;
        RESIGNAL;
    END;

    SET p_id_venta = NULL;

    IF p_operacion_clave IS NULL OR CHAR_LENGTH(TRIM(p_operacion_clave)) <> 36
       OR p_solicitud_hash IS NULL OR CHAR_LENGTH(TRIM(p_solicitud_hash)) <> 64 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Identificador de operación de venta inválido';
    END IF;
    IF p_detalles IS NULL OR JSON_TYPE(p_detalles) <> 'ARRAY' OR JSON_LENGTH(p_detalles) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La venta requiere al menos un detalle JSON';
    END IF;
    IF p_pagos IS NULL OR JSON_TYPE(p_pagos) <> 'ARRAY' OR JSON_LENGTH(p_pagos) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La venta requiere al menos un pago JSON';
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

    INSERT INTO tmp_venta_detalle (orden,id_presentacion,cantidad)
    SELECT jt.orden,jt.id_presentacion,jt.cantidad
      FROM JSON_TABLE(p_detalles,'$[*]' COLUMNS (
        orden FOR ORDINALITY,
        id_presentacion INT PATH '$.id_presentacion',
        cantidad DECIMAL(15,3) PATH '$.cantidad'
      )) jt;

    INSERT INTO tmp_venta_pago (orden,metodo_pago,monto,comprobante_qr)
    SELECT jt.orden,UPPER(jt.metodo_pago),jt.monto,jt.comprobante_qr
      FROM JSON_TABLE(p_pagos,'$[*]' COLUMNS (
        orden FOR ORDINALITY,
        metodo_pago VARCHAR(20) PATH '$.metodo_pago',
        monto DECIMAL(15,2) PATH '$.monto',
        comprobante_qr VARCHAR(255) PATH '$.comprobante_qr' NULL ON EMPTY
      )) jt;

    IF EXISTS (SELECT 1 FROM tmp_venta_detalle WHERE id_presentacion IS NULL OR cantidad IS NULL OR cantidad <= 0) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Detalle de venta inválido';
    END IF;
    IF EXISTS (SELECT 1 FROM tmp_venta_pago WHERE metodo_pago NOT IN ('EFECTIVO','QR') OR monto IS NULL OR monto <= 0
        OR (metodo_pago='QR' AND (comprobante_qr IS NULL OR TRIM(comprobante_qr)=''))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pago inválido o QR sin comprobante';
    END IF;
    SELECT COUNT(*) INTO v_count FROM (SELECT metodo_pago FROM tmp_venta_pago GROUP BY metodo_pago HAVING COUNT(*)>1) repetidos;
    IF v_count > 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registra como máximo un pago por método';
    END IF;

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;

    SELECT COUNT(*) INTO v_count FROM sesion_caja WHERE id_sesion_caja=p_id_sesion_caja;
    IF v_count <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La sesión de caja no existe'; END IF;

    SELECT estado,id_usuario INTO v_estado_sesion,v_usuario_sesion
      FROM sesion_caja WHERE id_sesion_caja=p_id_sesion_caja FOR UPDATE;
    IF v_estado_sesion <> 'ABIERTA' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se puede vender en una sesión cerrada'; END IF;
    IF v_usuario_sesion <> p_id_usuario THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La venta debe registrarla el responsable de la caja'; END IF;

    SELECT COUNT(*) INTO v_count FROM venta WHERE id_sesion_caja=p_id_sesion_caja AND operacion_clave=p_operacion_clave;
    IF v_count > 0 THEN
        SELECT id_venta,solicitud_hash INTO p_id_venta,v_hash_existente
          FROM venta WHERE id_sesion_caja=p_id_sesion_caja AND operacion_clave=p_operacion_clave LIMIT 1;
        IF v_hash_existente <> p_solicitud_hash THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La clave de guardado ya fue usada con otra venta';
        END IF;
        COMMIT;
        DROP TEMPORARY TABLE IF EXISTS tmp_venta_detalle;
        DROP TEMPORARY TABLE IF EXISTS tmp_venta_pago;
    ELSE
        INSERT INTO venta (id_sesion_caja,fecha_hora,estado,motivo_anulacion,fecha_hora_anulacion,id_usuario_anulacion,operacion_clave,solicitud_hash)
        VALUES (p_id_sesion_caja,CURRENT_TIMESTAMP,'VIGENTE',NULL,NULL,NULL,p_operacion_clave,p_solicitud_hash);
        SET p_id_venta=LAST_INSERT_ID();

        WHILE EXISTS (SELECT 1 FROM tmp_venta_detalle WHERE procesado=FALSE) DO
            SELECT orden,id_presentacion,cantidad INTO v_orden,v_id_presentacion,v_cantidad
              FROM tmp_venta_detalle WHERE procesado=FALSE ORDER BY id_presentacion,orden LIMIT 1;
            SELECT COUNT(*) INTO v_count FROM presentacion_producto pp JOIN producto p ON p.id_producto=pp.id_producto
             WHERE pp.id_presentacion=v_id_presentacion AND pp.estado='ACTIVO' AND p.estado='ACTIVO';
            IF v_count <> 1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Presentación inexistente o inactiva'; END IF;
            SELECT pp.id_producto,pp.factor_conversion,pp.precio_venta INTO v_id_producto,v_factor,v_precio
              FROM presentacion_producto pp WHERE pp.id_presentacion=v_id_presentacion FOR UPDATE;
            SET v_requerido=ROUND(v_cantidad*v_factor,3);
            IF v_factor<=0 OR v_requerido<=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Conversión o cantidad inválida'; END IF;

            INSERT INTO detalle_venta(id_venta,id_presentacion,cantidad,precio_unitario)
            VALUES(p_id_venta,v_id_presentacion,v_cantidad,v_precio);
            SET v_id_detalle_venta=LAST_INSERT_ID();
            SET v_restante=v_requerido;

            WHILE v_restante>0 DO
                SET v_id_lote_ubicacion=NULL; SET v_disponible_lote=NULL;
                BEGIN
                    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_id_lote_ubicacion=NULL;
                    SELECT lu.id_lote_ubicacion,lu.cantidad_actual INTO v_id_lote_ubicacion,v_disponible_lote
                      FROM lote_ubicacion lu
                      JOIN lote_producto lp ON lp.id_lote=lu.id_lote
                      JOIN detalle_compra dc ON dc.id_detalle_compra=lp.id_detalle_compra
                      JOIN presentacion_producto pp_lote ON pp_lote.id_presentacion=dc.id_presentacion
                      JOIN compra c ON c.id_compra=dc.id_compra
                      JOIN ubicacion u ON u.id_ubicacion=lu.id_ubicacion
                     WHERE pp_lote.id_producto=v_id_producto AND lu.cantidad_actual>0
                       AND (lp.fecha_vencimiento IS NULL OR lp.fecha_vencimiento>CURRENT_DATE)
                       AND u.estado='ACTIVO'
                     ORDER BY (lp.fecha_vencimiento IS NULL) ASC, lp.fecha_vencimiento ASC,
                              c.fecha_hora ASC, lp.id_lote ASC, lu.id_lote_ubicacion ASC
                     LIMIT 1 FOR UPDATE;
                END;
                IF v_id_lote_ubicacion IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Stock vendible insuficiente para completar la venta'; END IF;
                SET v_tomar=LEAST(v_restante,v_disponible_lote);
                INSERT INTO detalle_venta_lote(id_detalle_venta,id_lote_ubicacion,cantidad_base)
                VALUES(v_id_detalle_venta,v_id_lote_ubicacion,v_tomar);
                SET v_restante=ROUND(v_restante-v_tomar,3);
            END WHILE;
            UPDATE tmp_venta_detalle SET procesado=TRUE WHERE orden=v_orden;
        END WHILE;

        SELECT COALESCE(SUM(ROUND(cantidad*precio_unitario,2)),0) INTO v_total_venta FROM detalle_venta WHERE id_venta=p_id_venta;
        SELECT COALESCE(SUM(monto),0) INTO v_total_pago FROM tmp_venta_pago;
        IF v_total_pago<>v_total_venta THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La suma de pagos debe ser exactamente igual al total de venta'; END IF;

        WHILE EXISTS (SELECT 1 FROM tmp_venta_pago WHERE procesado=FALSE) DO
            SELECT MIN(orden) INTO v_orden FROM tmp_venta_pago WHERE procesado=FALSE;
            SELECT metodo_pago,monto,comprobante_qr INTO v_metodo,v_monto,v_comprobante FROM tmp_venta_pago WHERE orden=v_orden;
            INSERT INTO pago(id_venta,metodo_pago,monto,comprobante_qr)
            VALUES(p_id_venta,v_metodo,v_monto,CASE WHEN v_metodo='QR' THEN NULLIF(TRIM(v_comprobante),'') ELSE NULL END);
            UPDATE tmp_venta_pago SET procesado=TRUE WHERE orden=v_orden;
        END WHILE;

        COMMIT;
        DROP TEMPORARY TABLE IF EXISTS tmp_venta_detalle;
        DROP TEMPORARY TABLE IF EXISTS tmp_venta_pago;
    END IF;
END//

DROP PROCEDURE IF EXISTS sp_anular_venta//

CREATE PROCEDURE sp_anular_venta(
    IN p_id_venta INT UNSIGNED,
    IN p_id_usuario INT UNSIGNED,
    IN p_motivo VARCHAR(250),
    IN p_referencia_qr VARCHAR(255)
)
BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_estado_caja VARCHAR(20);
    DECLARE v_id_lote_ubicacion INT UNSIGNED;
    DECLARE v_cantidad DECIMAL(18,3);
    DECLARE v_stock DECIMAL(18,3);
    DECLARE v_count INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        SET @paris_anulando_venta=NULL;
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS tmp_devolucion_venta;
        RESIGNAL;
    END;

    IF p_motivo IS NULL OR TRIM(p_motivo)='' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La anulación requiere un motivo'; END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_devolucion_venta;
    CREATE TEMPORARY TABLE tmp_devolucion_venta(
        id_lote_ubicacion INT UNSIGNED NOT NULL PRIMARY KEY,
        cantidad DECIMAL(18,3) NOT NULL,
        procesado BOOLEAN NOT NULL DEFAULT FALSE
    ) ENGINE=InnoDB;

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;

    SELECT COUNT(*) INTO v_count FROM usuario u JOIN rol r ON r.id_rol=u.id_rol
     WHERE u.id_usuario=p_id_usuario AND u.estado='ACTIVO' AND r.nombre='ADMINISTRADOR';
    IF v_count<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo un administrador activo puede anular una venta'; END IF;

    SELECT COUNT(*) INTO v_count FROM venta WHERE id_venta=p_id_venta;
    IF v_count<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La venta no existe'; END IF;
    SELECT v.estado,sc.estado INTO v_estado,v_estado_caja FROM venta v JOIN sesion_caja sc ON sc.id_sesion_caja=v.id_sesion_caja
     WHERE v.id_venta=p_id_venta FOR UPDATE;
    IF v_estado<>'VIGENTE' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La venta ya fue anulada'; END IF;
    IF v_estado_caja<>'ABIERTA' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se anula una venta de una caja cerrada'; END IF;

    SELECT COUNT(*) INTO v_count FROM pago WHERE id_venta=p_id_venta AND metodo_pago='QR';
    IF v_count>0 AND (p_referencia_qr IS NULL OR TRIM(p_referencia_qr)='') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La devolución QR requiere una referencia o comprobante';
    END IF;

    INSERT INTO tmp_devolucion_venta(id_lote_ubicacion,cantidad)
    SELECT dvl.id_lote_ubicacion,SUM(dvl.cantidad_base) FROM detalle_venta_lote dvl
     JOIN detalle_venta dv ON dv.id_detalle_venta=dvl.id_detalle_venta
     WHERE dv.id_venta=p_id_venta GROUP BY dvl.id_lote_ubicacion;
    IF NOT EXISTS(SELECT 1 FROM tmp_devolucion_venta) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La venta no posee trazabilidad de lotes'; END IF;

    WHILE EXISTS(SELECT 1 FROM tmp_devolucion_venta WHERE procesado=FALSE) DO
        SELECT id_lote_ubicacion,cantidad INTO v_id_lote_ubicacion,v_cantidad FROM tmp_devolucion_venta
         WHERE procesado=FALSE ORDER BY id_lote_ubicacion LIMIT 1;
        SELECT cantidad_actual INTO v_stock FROM lote_ubicacion WHERE id_lote_ubicacion=v_id_lote_ubicacion FOR UPDATE;
        UPDATE lote_ubicacion SET cantidad_actual=cantidad_actual+v_cantidad WHERE id_lote_ubicacion=v_id_lote_ubicacion;
        UPDATE tmp_devolucion_venta SET procesado=TRUE WHERE id_lote_ubicacion=v_id_lote_ubicacion;
    END WHILE;

    SET @paris_anulando_venta=1;
    INSERT INTO devolucion_pago(id_pago,id_usuario,fecha_hora,monto,referencia,motivo)
    SELECT id_pago,p_id_usuario,CURRENT_TIMESTAMP,monto,
           CASE WHEN metodo_pago='QR' THEN NULLIF(TRIM(p_referencia_qr),'') ELSE NULL END,
           TRIM(p_motivo)
      FROM pago WHERE id_venta=p_id_venta;

    UPDATE venta SET estado='ANULADA',motivo_anulacion=TRIM(p_motivo),fecha_hora_anulacion=CURRENT_TIMESTAMP,id_usuario_anulacion=p_id_usuario
     WHERE id_venta=p_id_venta;
    SET @paris_anulando_venta=NULL;

    COMMIT;
    DROP TEMPORARY TABLE IF EXISTS tmp_devolucion_venta;
END//

DROP PROCEDURE IF EXISTS sp_cerrar_sesion_caja//

CREATE PROCEDURE sp_cerrar_sesion_caja(
    IN p_id_sesion_caja INT UNSIGNED,
    IN p_id_usuario INT UNSIGNED,
    IN p_fecha_hora DATETIME,
    IN p_observacion VARCHAR(250),
    IN p_conteo JSON,
    OUT p_id_arqueo INT UNSIGNED
)
BEGIN
    DECLARE v_fecha DATETIME;
    DECLARE v_estado VARCHAR(20);
    DECLARE v_usuario INT UNSIGNED;
    DECLARE v_esperado DECIMAL(18,2);
    DECLARE v_contado DECIMAL(18,2);
    DECLARE v_count INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        SET @paris_cerrando_sesion=NULL;
        ROLLBACK;
        DROP TEMPORARY TABLE IF EXISTS tmp_conteo_caja;
        SET p_id_arqueo=NULL;
        RESIGNAL;
    END;

    SET p_id_arqueo=NULL;
    SET v_fecha=COALESCE(p_fecha_hora,CURRENT_TIMESTAMP);
    IF p_conteo IS NULL OR JSON_TYPE(p_conteo)<>'ARRAY' OR JSON_LENGTH(p_conteo)=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cierre requiere el conteo de denominaciones'; END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_conteo_caja;
    CREATE TEMPORARY TABLE tmp_conteo_caja(orden INT NOT NULL PRIMARY KEY,id_denominacion INT UNSIGNED NULL,cantidad INT UNSIGNED NULL) ENGINE=InnoDB;
    INSERT INTO tmp_conteo_caja(orden,id_denominacion,cantidad)
    SELECT jt.orden,jt.id_denominacion,jt.cantidad FROM JSON_TABLE(p_conteo,'$[*]' COLUMNS(
      orden FOR ORDINALITY,id_denominacion INT PATH '$.id_denominacion',cantidad INT PATH '$.cantidad')) jt;
    SELECT COUNT(*) INTO v_count FROM tmp_conteo_caja WHERE id_denominacion IS NULL OR cantidad IS NULL;
    IF v_count>0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Conteo de caja inválido'; END IF;
    SELECT COUNT(*) INTO v_count FROM (SELECT id_denominacion FROM tmp_conteo_caja GROUP BY id_denominacion HAVING COUNT(*)>1) r;
    IF v_count>0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Conteo de caja con denominaciones repetidas'; END IF;

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;
    SELECT COUNT(*) INTO v_count FROM sesion_caja WHERE id_sesion_caja=p_id_sesion_caja;
    IF v_count<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La sesión de caja no existe'; END IF;
    SELECT estado,id_usuario INTO v_estado,v_usuario FROM sesion_caja WHERE id_sesion_caja=p_id_sesion_caja FOR UPDATE;
    IF v_estado<>'ABIERTA' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La sesión ya está cerrada'; END IF;
    IF v_usuario<>p_id_usuario THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo el responsable del turno puede cerrar esta caja'; END IF;

    SELECT COUNT(*) INTO v_count FROM tmp_conteo_caja tc LEFT JOIN denominacion d ON d.id_denominacion=tc.id_denominacion AND d.estado='ACTIVO'
     WHERE d.id_denominacion IS NULL;
    IF v_count>0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El conteo contiene denominaciones inexistentes o inactivas'; END IF;

    SET @paris_cerrando_sesion=p_id_sesion_caja;
    UPDATE sesion_caja SET fecha_hora_cierre=v_fecha,estado='CERRADA',observacion=NULLIF(TRIM(p_observacion),'') WHERE id_sesion_caja=p_id_sesion_caja;
    INSERT INTO arqueo_caja(id_sesion_caja,fecha_hora,observacion) VALUES(p_id_sesion_caja,v_fecha,NULLIF(TRIM(p_observacion),''));
    SET p_id_arqueo=LAST_INSERT_ID();
    INSERT INTO detalle_arqueo(id_arqueo,id_denominacion,cantidad) SELECT p_id_arqueo,id_denominacion,cantidad FROM tmp_conteo_caja;

    SELECT sc.monto_inicial+COALESCE(SUM(CASE WHEN v.estado='VIGENTE' AND pg.metodo_pago='EFECTIVO' THEN pg.monto ELSE 0 END),0)
      INTO v_esperado FROM sesion_caja sc LEFT JOIN venta v ON v.id_sesion_caja=sc.id_sesion_caja LEFT JOIN pago pg ON pg.id_venta=v.id_venta
     WHERE sc.id_sesion_caja=p_id_sesion_caja GROUP BY sc.id_sesion_caja,sc.monto_inicial;
    SELECT COALESCE(SUM(d.valor*da.cantidad),0) INTO v_contado FROM detalle_arqueo da JOIN denominacion d ON d.id_denominacion=da.id_denominacion
     WHERE da.id_arqueo=p_id_arqueo;
    IF v_contado<>v_esperado AND (p_observacion IS NULL OR TRIM(p_observacion)='') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una diferencia de caja requiere observación'; END IF;

    SET @paris_cerrando_sesion=NULL;
    COMMIT;
    DROP TEMPORARY TABLE IF EXISTS tmp_conteo_caja;
END//

DROP PROCEDURE IF EXISTS sp_limpiar_catalogo_operacion//
CREATE PROCEDURE sp_limpiar_catalogo_operacion(
    IN p_dias INT,
    IN p_lote INT,
    OUT p_eliminados INT
)
BEGIN
    IF p_dias IS NULL OR p_dias<7 OR p_dias>3650 OR p_lote IS NULL OR p_lote<1 OR p_lote>5000 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Parámetros de limpieza fuera del rango permitido';
    END IF;
    DELETE FROM catalogo_operacion
     WHERE resultado IS NOT NULL
       AND creada_en<TIMESTAMPADD(DAY,-p_dias,CURRENT_TIMESTAMP)
     ORDER BY creada_en
     LIMIT p_lote;
    SET p_eliminados=ROW_COUNT();
END//

DROP TRIGGER IF EXISTS trg_sesion_bi_fecha_u004//
DROP TRIGGER IF EXISTS trg_sesion_bi_fecha_u039//
CREATE TRIGGER trg_sesion_bi_fecha_u039 BEFORE INSERT ON sesion_caja FOR EACH ROW
BEGIN
    DECLARE v_estado_caja VARCHAR(20);
    IF NEW.fecha_hora_apertura>CURRENT_TIMESTAMP OR NEW.estado<>'ABIERTA' OR NEW.id_caja IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una caja nueva requiere caja física activa, estado abierto y fecha válida';
    END IF;
    SELECT estado INTO v_estado_caja FROM caja WHERE id_caja=NEW.id_caja;
    IF v_estado_caja IS NULL OR v_estado_caja<>'ACTIVA' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La caja física no está activa'; END IF;
    IF EXISTS(SELECT 1 FROM sesion_caja WHERE estado='ABIERTA') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Ya existe un turno de caja abierto'; END IF;
END//

DROP TRIGGER IF EXISTS trg_sesion_bu_historial_u004//
DROP TRIGGER IF EXISTS trg_sesion_bu_historial_u039//
CREATE TRIGGER trg_sesion_bu_historial_u039 BEFORE UPDATE ON sesion_caja FOR EACH ROW
BEGIN
    DECLARE v_ultima DATETIME;
    IF OLD.estado='CERRADA' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una caja cerrada es histórica e inmutable'; END IF;
    IF NOT (NEW.id_caja <=> OLD.id_caja) OR NEW.id_usuario<>OLD.id_usuario OR NEW.monto_inicial<>OLD.monto_inicial
       OR NEW.fecha_hora_apertura<>OLD.fecha_hora_apertura OR NEW.id_sesion_caja<>OLD.id_sesion_caja THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los datos de apertura son inmutables';
    END IF;
    IF NEW.estado='CERRADA' THEN
        IF COALESCE(@paris_cerrando_sesion,0)<>OLD.id_sesion_caja THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Use sp_cerrar_sesion_caja para cerrar y arquear'; END IF;
        SELECT MAX(fecha_hora) INTO v_ultima FROM venta WHERE id_sesion_caja=OLD.id_sesion_caja;
        IF NEW.fecha_hora_cierre IS NULL OR NEW.fecha_hora_cierre<OLD.fecha_hora_apertura OR NEW.fecha_hora_cierre>CURRENT_TIMESTAMP
           OR (v_ultima IS NOT NULL AND NEW.fecha_hora_cierre<v_ultima) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El cierre debe ser posterior a todas las ventas'; END IF;
    END IF;
END//

DROP TRIGGER IF EXISTS trg_venta_bi_sesion_abierta//
DROP TRIGGER IF EXISTS trg_venta_bi_u039//
CREATE TRIGGER trg_venta_bi_u039 BEFORE INSERT ON venta FOR EACH ROW
BEGIN
    DECLARE v_estado VARCHAR(20);
    DECLARE v_apertura DATETIME;
    IF NEW.operacion_clave IS NULL OR NEW.solicitud_hash IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Registra la venta mediante sp_registrar_venta';
    END IF;
    SELECT estado,fecha_hora_apertura INTO v_estado,v_apertura
      FROM sesion_caja WHERE id_sesion_caja=NEW.id_sesion_caja FOR UPDATE;
    IF v_estado IS NULL OR v_estado<>'ABIERTA' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La venta requiere caja abierta'; END IF;
    IF NEW.fecha_hora<v_apertura OR NEW.fecha_hora>CURRENT_TIMESTAMP THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La fecha de venta no pertenece al turno actual'; END IF;
END//

DROP TRIGGER IF EXISTS trg_venta_bu_historial//
DROP TRIGGER IF EXISTS trg_venta_bu_u039//
CREATE TRIGGER trg_venta_bu_u039 BEFORE UPDATE ON venta FOR EACH ROW
BEGIN
    DECLARE v_estado_caja VARCHAR(20);
    SELECT estado INTO v_estado_caja FROM sesion_caja WHERE id_sesion_caja=OLD.id_sesion_caja FOR UPDATE;
    IF v_estado_caja<>'ABIERTA' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se modifica una venta de caja cerrada'; END IF;
    IF NEW.id_sesion_caja<>OLD.id_sesion_caja OR NEW.fecha_hora<>OLD.fecha_hora
       OR NOT (NEW.operacion_clave <=> OLD.operacion_clave) OR NOT (NEW.solicitud_hash <=> OLD.solicitud_hash) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La identidad y origen de una venta son inmutables';
    END IF;
    IF OLD.estado='ANULADA' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una venta anulada es histórica e inmutable'; END IF;
    IF OLD.estado='VIGENTE' AND NEW.estado='ANULADA' THEN
        IF COALESCE(@paris_anulando_venta,0)<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Use sp_anular_venta para devolver inventario y pagos'; END IF;
        IF NEW.motivo_anulacion IS NULL OR TRIM(NEW.motivo_anulacion)='' OR NEW.fecha_hora_anulacion IS NULL OR NEW.id_usuario_anulacion IS NULL THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La anulación requiere auditoría completa';
        END IF;
    ELSE
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una venta vigente solo puede cambiar mediante anulación controlada';
    END IF;
END//

DROP TRIGGER IF EXISTS trg_caja_bu_u039//
CREATE TRIGGER trg_caja_bu_u039 BEFORE UPDATE ON caja FOR EACH ROW
BEGIN
    IF NEW.id_caja<>OLD.id_caja OR NEW.nombre<>OLD.nombre THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La identidad de una caja física es inmutable'; END IF;
    IF NEW.estado='INACTIVA' AND OLD.estado='ACTIVA' AND EXISTS(SELECT 1 FROM sesion_caja WHERE id_caja=OLD.id_caja AND estado='ABIERTA') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No se desactiva una caja con turno abierto';
    END IF;
END//

DROP TRIGGER IF EXISTS trg_caja_bd_u039//
CREATE TRIGGER trg_caja_bd_u039 BEFORE DELETE ON caja FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las cajas físicas no se eliminan';
END//

DROP TRIGGER IF EXISTS trg_devolucion_pago_bi_u039//
CREATE TRIGGER trg_devolucion_pago_bi_u039 BEFORE INSERT ON devolucion_pago FOR EACH ROW
BEGIN
    DECLARE v_metodo VARCHAR(20);
    DECLARE v_monto DECIMAL(15,2);
    SELECT metodo_pago,monto INTO v_metodo,v_monto FROM pago WHERE id_pago=NEW.id_pago FOR UPDATE;
    IF COALESCE(@paris_anulando_venta,0)<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Las devoluciones se registran al anular una venta'; END IF;
    IF NEW.monto<>v_monto THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La devolución debe coincidir con el pago original'; END IF;
    IF v_metodo='QR' AND (NEW.referencia IS NULL OR TRIM(NEW.referencia)='') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'La devolución QR requiere referencia'; END IF;
END//

DROP TRIGGER IF EXISTS trg_devolucion_pago_bu_u039//
CREATE TRIGGER trg_devolucion_pago_bu_u039 BEFORE UPDATE ON devolucion_pago FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una devolución confirmada es histórica e inmutable';
END//

DROP TRIGGER IF EXISTS trg_devolucion_pago_bd_u039//
CREATE TRIGGER trg_devolucion_pago_bd_u039 BEFORE DELETE ON devolucion_pago FOR EACH ROW
BEGIN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Una devolución confirmada es histórica e inmutable';
END//

DELIMITER ;

CREATE OR REPLACE VIEW vw_ventas_totales AS
SELECT v.id_venta,v.fecha_hora,v.estado,v.motivo_anulacion,v.fecha_hora_anulacion,
       v.id_usuario_anulacion,CASE WHEN ua.id_usuario IS NULL THEN NULL ELSE CONCAT(ua.nombre,' ',ua.apellido) END AS anulada_por,
       sc.id_sesion_caja,sc.id_caja,COALESCE(ca.nombre,'Caja histórica') AS caja,
       u.id_usuario,CONCAT(u.nombre,' ',u.apellido) AS usuario,
       COALESCE(SUM(ROUND(dv.cantidad*dv.precio_unitario,2)),0) AS total_venta
FROM venta v JOIN sesion_caja sc ON sc.id_sesion_caja=v.id_sesion_caja
JOIN usuario u ON u.id_usuario=sc.id_usuario LEFT JOIN caja ca ON ca.id_caja=sc.id_caja
LEFT JOIN usuario ua ON ua.id_usuario=v.id_usuario_anulacion
LEFT JOIN detalle_venta dv ON dv.id_venta=v.id_venta
GROUP BY v.id_venta,v.fecha_hora,v.estado,v.motivo_anulacion,v.fecha_hora_anulacion,v.id_usuario_anulacion,
         ua.id_usuario,ua.nombre,ua.apellido,sc.id_sesion_caja,sc.id_caja,ca.nombre,u.id_usuario,u.nombre,u.apellido;

CREATE OR REPLACE VIEW vw_efectivo_esperado_sesion AS
SELECT sc.id_sesion_caja,sc.id_caja,COALESCE(ca.nombre,'Caja histórica') AS caja,sc.id_usuario,
       sc.fecha_hora_apertura,sc.fecha_hora_cierre,sc.monto_inicial,sc.estado,
       sc.monto_inicial+COALESCE(SUM(CASE WHEN v.estado='VIGENTE' AND pg.metodo_pago='EFECTIVO' THEN pg.monto ELSE 0 END),0) AS efectivo_esperado
FROM sesion_caja sc LEFT JOIN caja ca ON ca.id_caja=sc.id_caja
LEFT JOIN venta v ON v.id_sesion_caja=sc.id_sesion_caja LEFT JOIN pago pg ON pg.id_venta=v.id_venta
GROUP BY sc.id_sesion_caja,sc.id_caja,ca.nombre,sc.id_usuario,sc.fecha_hora_apertura,sc.fecha_hora_cierre,sc.monto_inicial,sc.estado;

CREATE OR REPLACE VIEW vw_diferencias_caja AS
SELECT sc.id_sesion_caja,sc.id_caja,COALESCE(ca.nombre,'Caja histórica') AS caja,
       CONCAT(u.nombre,' ',u.apellido) AS usuario,sc.fecha_hora_apertura,sc.fecha_hora_cierre,
       ee.efectivo_esperado,ec.efectivo_contado,ec.efectivo_contado-ee.efectivo_esperado AS diferencia,
       CASE WHEN ec.efectivo_contado-ee.efectivo_esperado=0 THEN 'CUADRA'
            WHEN ec.efectivo_contado-ee.efectivo_esperado>0 THEN 'SOBRANTE' ELSE 'FALTANTE' END AS resultado
FROM sesion_caja sc JOIN usuario u ON u.id_usuario=sc.id_usuario LEFT JOIN caja ca ON ca.id_caja=sc.id_caja
JOIN vw_efectivo_esperado_sesion ee ON ee.id_sesion_caja=sc.id_sesion_caja
JOIN vw_efectivo_contado_arqueo ec ON ec.id_sesion_caja=sc.id_sesion_caja;

CREATE OR REPLACE VIEW vw_reembolsos_venta AS
SELECT v.id_venta,dp.id_devolucion,dp.fecha_hora,p.metodo_pago,dp.monto,dp.referencia,dp.motivo,
       CONCAT(u.nombre,' ',u.apellido) AS registrado_por
FROM devolucion_pago dp JOIN pago p ON p.id_pago=dp.id_pago JOIN venta v ON v.id_venta=p.id_venta
JOIN usuario u ON u.id_usuario=dp.id_usuario;
