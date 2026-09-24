-- U044: Compras simplificadas.
-- Separa el ingreso de mercadería de las presentaciones de venta.
-- No borra compras, lotes, productos ni ventas históricas.

ALTER TABLE compra
    MODIFY COLUMN id_proveedor INT UNSIGNED NULL;

ALTER TABLE detalle_compra
    ADD COLUMN id_producto INT UNSIGNED NULL AFTER id_compra,
    ADD COLUMN forma_ingreso VARCHAR(80) NULL AFTER id_presentacion,
    ADD COLUMN factor_ingreso DECIMAL(15,3) NULL AFTER forma_ingreso;

UPDATE detalle_compra dc
JOIN presentacion_producto pp ON pp.id_presentacion=dc.id_presentacion
SET dc.id_producto=COALESCE(dc.id_producto,pp.id_producto),
    dc.forma_ingreso=COALESCE(dc.forma_ingreso,pp.nombre_presentacion),
    dc.factor_ingreso=COALESCE(dc.factor_ingreso,pp.factor_conversion)
WHERE dc.id_producto IS NULL OR dc.forma_ingreso IS NULL OR dc.factor_ingreso IS NULL;

ALTER TABLE detalle_compra
    MODIFY COLUMN id_presentacion INT UNSIGNED NULL,
    ADD CONSTRAINT fk_detalle_compra_producto FOREIGN KEY (id_producto)
        REFERENCES producto(id_producto) ON UPDATE CASCADE ON DELETE RESTRICT,
    ADD CONSTRAINT chk_detalle_compra_forma_ingreso CHECK (forma_ingreso IS NULL OR TRIM(forma_ingreso) <> ''),
    ADD CONSTRAINT chk_detalle_compra_factor_ingreso CHECK (factor_ingreso IS NULL OR factor_ingreso > 0),
    ADD INDEX idx_detalle_compra_producto (id_producto,id_compra);

DELIMITER //

DROP TRIGGER IF EXISTS trg_producto_bu_unidad_base//
CREATE TRIGGER trg_producto_bu_unidad_base
BEFORE UPDATE ON producto
FOR EACH ROW
BEGIN
    IF NEW.id_unidad_medida <> OLD.id_unidad_medida
       AND (
         EXISTS (SELECT 1 FROM presentacion_producto pp WHERE pp.id_producto=OLD.id_producto)
         OR EXISTS (SELECT 1 FROM detalle_compra dc WHERE dc.id_producto=OLD.id_producto)
       ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede cambiar la unidad base de un producto con historial o presentaciones';
    END IF;
END//

DROP TRIGGER IF EXISTS trg_presentacion_bu_conversion//
CREATE TRIGGER trg_presentacion_bu_conversion
BEFORE UPDATE ON presentacion_producto
FOR EACH ROW
BEGIN
    IF (NEW.id_producto <> OLD.id_producto OR NEW.factor_conversion <> OLD.factor_conversion)
       AND EXISTS (SELECT 1 FROM detalle_venta dv WHERE dv.id_presentacion=OLD.id_presentacion) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Producto y factor no pueden cambiar después de usar la presentación en una venta';
    END IF;
END//

DROP TRIGGER IF EXISTS trg_detalle_compra_bi_u044//
CREATE TRIGGER trg_detalle_compra_bi_u044
BEFORE INSERT ON detalle_compra
FOR EACH ROW
BEGIN
    DECLARE v_producto INT UNSIGNED;
    DECLARE v_forma VARCHAR(80);
    DECLARE v_factor DECIMAL(15,3);

    IF NEW.id_producto IS NULL AND NEW.id_presentacion IS NOT NULL THEN
        SELECT pp.id_producto,pp.nombre_presentacion,pp.factor_conversion
          INTO v_producto,v_forma,v_factor
          FROM presentacion_producto pp
         WHERE pp.id_presentacion=NEW.id_presentacion;
        SET NEW.id_producto=v_producto;
        SET NEW.forma_ingreso=COALESCE(NEW.forma_ingreso,v_forma);
        SET NEW.factor_ingreso=COALESCE(NEW.factor_ingreso,v_factor);
    END IF;

    IF NEW.id_producto IS NULL OR NEW.forma_ingreso IS NULL OR TRIM(NEW.forma_ingreso)=''
       OR NEW.factor_ingreso IS NULL OR NEW.factor_ingreso<=0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La compra requiere producto, forma de ingreso y factor de entrada';
    END IF;
END//

DROP TRIGGER IF EXISTS trg_detalle_compra_bu_lotes//
CREATE TRIGGER trg_detalle_compra_bu_lotes
BEFORE UPDATE ON detalle_compra
FOR EACH ROW
BEGIN
    IF (
      NEW.id_producto <> OLD.id_producto OR
      NEW.cantidad <> OLD.cantidad OR
      NEW.factor_ingreso <> OLD.factor_ingreso OR
      NEW.forma_ingreso <> OLD.forma_ingreso
    )
       AND EXISTS (
           SELECT 1 FROM lote_producto lp
           WHERE lp.id_detalle_compra=OLD.id_detalle_compra
       ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede cambiar producto, cantidad o forma de ingreso de una compra con lotes';
    END IF;
END//

DROP TRIGGER IF EXISTS trg_lote_producto_bi_conversion//
CREATE TRIGGER trg_lote_producto_bi_conversion
BEFORE INSERT ON lote_producto
FOR EACH ROW
BEGIN
    DECLARE v_maximo DECIMAL(18,3);
    DECLARE v_registrado DECIMAL(18,3);

    SELECT ROUND(dc.cantidad*dc.factor_ingreso,3)
      INTO v_maximo
      FROM detalle_compra dc
     WHERE dc.id_detalle_compra=NEW.id_detalle_compra;

    SELECT COALESCE(SUM(lp.cantidad_inicial),0)
      INTO v_registrado
      FROM lote_producto lp
     WHERE lp.id_detalle_compra=NEW.id_detalle_compra;

    IF ROUND(v_registrado+NEW.cantidad_inicial,3)>v_maximo THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Los lotes superan la cantidad comprada por factor de ingreso';
    END IF;
END//

DROP TRIGGER IF EXISTS trg_lote_producto_bu_conversion//
CREATE TRIGGER trg_lote_producto_bu_conversion
BEFORE UPDATE ON lote_producto
FOR EACH ROW
BEGIN
    DECLARE v_maximo DECIMAL(18,3);
    DECLARE v_registrado DECIMAL(18,3);

    IF NEW.id_detalle_compra<>OLD.id_detalle_compra THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'No se puede cambiar el detalle de compra de un lote';
    END IF;

    SELECT ROUND(dc.cantidad*dc.factor_ingreso,3)
      INTO v_maximo
      FROM detalle_compra dc
     WHERE dc.id_detalle_compra=NEW.id_detalle_compra;

    SELECT COALESCE(SUM(lp.cantidad_inicial),0)
      INTO v_registrado
      FROM lote_producto lp
     WHERE lp.id_detalle_compra=NEW.id_detalle_compra
       AND lp.id_lote<>OLD.id_lote;

    IF ROUND(v_registrado+NEW.cantidad_inicial,3)>v_maximo THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Los lotes superan la cantidad comprada por factor de ingreso';
    END IF;
END//


DROP TRIGGER IF EXISTS trg_dvl_bi_integridad//
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
           ROUND(dv.cantidad*pp.factor_conversion,3),
           v.estado,
           sc.estado
      INTO v_producto_venta,v_requerido,v_estado_venta,v_estado_sesion
      FROM detalle_venta dv
      JOIN presentacion_producto pp ON pp.id_presentacion=dv.id_presentacion
      JOIN venta v ON v.id_venta=dv.id_venta
      JOIN sesion_caja sc ON sc.id_sesion_caja=v.id_sesion_caja
     WHERE dv.id_detalle_venta=NEW.id_detalle_venta;

    SELECT dc.id_producto,lu.cantidad_actual,lp.fecha_vencimiento
      INTO v_producto_lote,v_disponible,v_vencimiento
      FROM lote_ubicacion lu
      JOIN lote_producto lp ON lp.id_lote=lu.id_lote
      JOIN detalle_compra dc ON dc.id_detalle_compra=lp.id_detalle_compra
     WHERE lu.id_lote_ubicacion=NEW.id_lote_ubicacion;

    IF v_estado_venta<>'VIGENTE' OR v_estado_sesion<>'ABIERTA' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT='Solo se consume inventario para ventas vigentes en caja abierta';
    END IF;

    IF v_producto_venta<>v_producto_lote THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT='El lote no pertenece al producto vendido';
    END IF;

    IF v_vencimiento IS NOT NULL AND v_vencimiento<=CURRENT_DATE THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT='No se puede vender un lote vencido';
    END IF;

    IF NEW.cantidad_base>v_disponible THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT='Stock insuficiente en el lote seleccionado';
    END IF;

    SELECT COALESCE(SUM(cantidad_base),0)
      INTO v_asignado
      FROM detalle_venta_lote
     WHERE id_detalle_venta=NEW.id_detalle_venta;

    IF ROUND(v_asignado+NEW.cantidad_base,3)>v_requerido THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT='La asignación de lotes supera la cantidad base vendida';
    END IF;
END//

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
        SET p_id_venta=NULL;
        RESIGNAL;
    END;

    SET p_id_venta=NULL;

    IF p_operacion_clave IS NULL OR CHAR_LENGTH(TRIM(p_operacion_clave))<>36
       OR p_solicitud_hash IS NULL OR CHAR_LENGTH(TRIM(p_solicitud_hash))<>64 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Identificador de operación de venta inválido';
    END IF;
    IF p_detalles IS NULL OR JSON_TYPE(p_detalles)<>'ARRAY' OR JSON_LENGTH(p_detalles)=0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='La venta requiere al menos un detalle JSON';
    END IF;
    IF p_pagos IS NULL OR JSON_TYPE(p_pagos)<>'ARRAY' OR JSON_LENGTH(p_pagos)=0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='La venta requiere al menos un pago JSON';
    END IF;

    DROP TEMPORARY TABLE IF EXISTS tmp_venta_detalle;
    DROP TEMPORARY TABLE IF EXISTS tmp_venta_pago;
    CREATE TEMPORARY TABLE tmp_venta_detalle(
        orden INT NOT NULL PRIMARY KEY,
        id_presentacion INT UNSIGNED NULL,
        cantidad DECIMAL(15,3) NULL,
        procesado BOOLEAN NOT NULL DEFAULT FALSE
    ) ENGINE=InnoDB;
    CREATE TEMPORARY TABLE tmp_venta_pago(
        orden INT NOT NULL PRIMARY KEY,
        metodo_pago VARCHAR(20) NULL,
        monto DECIMAL(15,2) NULL,
        comprobante_qr VARCHAR(255) NULL,
        procesado BOOLEAN NOT NULL DEFAULT FALSE
    ) ENGINE=InnoDB;

    INSERT INTO tmp_venta_detalle(orden,id_presentacion,cantidad)
    SELECT jt.orden,jt.id_presentacion,jt.cantidad
      FROM JSON_TABLE(p_detalles,'$[*]' COLUMNS(
        orden FOR ORDINALITY,
        id_presentacion INT PATH '$.id_presentacion',
        cantidad DECIMAL(15,3) PATH '$.cantidad'
      )) jt;

    INSERT INTO tmp_venta_pago(orden,metodo_pago,monto,comprobante_qr)
    SELECT jt.orden,UPPER(jt.metodo_pago),jt.monto,jt.comprobante_qr
      FROM JSON_TABLE(p_pagos,'$[*]' COLUMNS(
        orden FOR ORDINALITY,
        metodo_pago VARCHAR(20) PATH '$.metodo_pago',
        monto DECIMAL(15,2) PATH '$.monto',
        comprobante_qr VARCHAR(255) PATH '$.comprobante_qr' NULL ON EMPTY
      )) jt;

    IF EXISTS(SELECT 1 FROM tmp_venta_detalle WHERE id_presentacion IS NULL OR cantidad IS NULL OR cantidad<=0) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Detalle de venta inválido';
    END IF;
    IF EXISTS(SELECT 1 FROM tmp_venta_pago WHERE metodo_pago NOT IN('EFECTIVO','QR') OR monto IS NULL OR monto<=0
        OR (metodo_pago='QR' AND (comprobante_qr IS NULL OR TRIM(comprobante_qr)=''))) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Pago inválido o QR sin comprobante';
    END IF;
    SELECT COUNT(*) INTO v_count FROM(SELECT metodo_pago FROM tmp_venta_pago GROUP BY metodo_pago HAVING COUNT(*)>1) repetidos;
    IF v_count>0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Registra como máximo un pago por método'; END IF;

    SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
    START TRANSACTION;

    SELECT COUNT(*) INTO v_count FROM sesion_caja WHERE id_sesion_caja=p_id_sesion_caja;
    IF v_count<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='La sesión de caja no existe'; END IF;

    SELECT estado,id_usuario INTO v_estado_sesion,v_usuario_sesion
      FROM sesion_caja WHERE id_sesion_caja=p_id_sesion_caja FOR UPDATE;
    IF v_estado_sesion<>'ABIERTA' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='No se puede vender en una sesión cerrada'; END IF;
    IF v_usuario_sesion<>p_id_usuario THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='La venta debe registrarla el responsable de la caja'; END IF;

    SELECT COUNT(*) INTO v_count FROM venta WHERE id_sesion_caja=p_id_sesion_caja AND operacion_clave=p_operacion_clave;
    IF v_count>0 THEN
        SELECT id_venta,solicitud_hash INTO p_id_venta,v_hash_existente
          FROM venta WHERE id_sesion_caja=p_id_sesion_caja AND operacion_clave=p_operacion_clave LIMIT 1;
        IF v_hash_existente<>p_solicitud_hash THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='La clave de guardado ya fue usada con otra venta';
        END IF;
        COMMIT;
        DROP TEMPORARY TABLE IF EXISTS tmp_venta_detalle;
        DROP TEMPORARY TABLE IF EXISTS tmp_venta_pago;
    ELSE
        INSERT INTO venta(id_sesion_caja,fecha_hora,estado,motivo_anulacion,fecha_hora_anulacion,id_usuario_anulacion,operacion_clave,solicitud_hash)
        VALUES(p_id_sesion_caja,CURRENT_TIMESTAMP,'VIGENTE',NULL,NULL,NULL,p_operacion_clave,p_solicitud_hash);
        SET p_id_venta=LAST_INSERT_ID();

        WHILE EXISTS(SELECT 1 FROM tmp_venta_detalle WHERE procesado=FALSE) DO
            SELECT orden,id_presentacion,cantidad INTO v_orden,v_id_presentacion,v_cantidad
              FROM tmp_venta_detalle WHERE procesado=FALSE ORDER BY id_presentacion,orden LIMIT 1;
            SELECT COUNT(*) INTO v_count FROM presentacion_producto pp JOIN producto p ON p.id_producto=pp.id_producto
             WHERE pp.id_presentacion=v_id_presentacion AND pp.estado='ACTIVO' AND p.estado='ACTIVO';
            IF v_count<>1 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Presentación inexistente o inactiva'; END IF;
            SELECT pp.id_producto,pp.factor_conversion,pp.precio_venta INTO v_id_producto,v_factor,v_precio
              FROM presentacion_producto pp WHERE pp.id_presentacion=v_id_presentacion FOR UPDATE;
            SET v_requerido=ROUND(v_cantidad*v_factor,3);
            IF v_factor<=0 OR v_requerido<=0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Conversión o cantidad inválida'; END IF;

            INSERT INTO detalle_venta(id_venta,id_presentacion,cantidad,precio_unitario)
            VALUES(p_id_venta,v_id_presentacion,v_cantidad,v_precio);
            SET v_id_detalle_venta=LAST_INSERT_ID();
            SET v_restante=v_requerido;

            WHILE v_restante>0 DO
                SET v_id_lote_ubicacion=NULL;
                SET v_disponible_lote=NULL;
                BEGIN
                    DECLARE CONTINUE HANDLER FOR NOT FOUND SET v_id_lote_ubicacion=NULL;
                    SELECT lu.id_lote_ubicacion,lu.cantidad_actual INTO v_id_lote_ubicacion,v_disponible_lote
                      FROM lote_ubicacion lu
                      JOIN lote_producto lp ON lp.id_lote=lu.id_lote
                      JOIN detalle_compra dc ON dc.id_detalle_compra=lp.id_detalle_compra
                      JOIN compra c ON c.id_compra=dc.id_compra
                      JOIN ubicacion u ON u.id_ubicacion=lu.id_ubicacion
                     WHERE dc.id_producto=v_id_producto AND lu.cantidad_actual>0
                       AND (lp.fecha_vencimiento IS NULL OR lp.fecha_vencimiento>CURRENT_DATE)
                       AND u.estado='ACTIVO'
                     ORDER BY (lp.fecha_vencimiento IS NULL) ASC,lp.fecha_vencimiento ASC,
                              c.fecha_hora ASC,lp.id_lote ASC,lu.id_lote_ubicacion ASC
                     LIMIT 1 FOR UPDATE;
                END;
                IF v_id_lote_ubicacion IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Stock vendible insuficiente para completar la venta'; END IF;
                SET v_tomar=LEAST(v_restante,v_disponible_lote);
                INSERT INTO detalle_venta_lote(id_detalle_venta,id_lote_ubicacion,cantidad_base)
                VALUES(v_id_detalle_venta,v_id_lote_ubicacion,v_tomar);
                SET v_restante=ROUND(v_restante-v_tomar,3);
            END WHILE;
            UPDATE tmp_venta_detalle SET procesado=TRUE WHERE orden=v_orden;
        END WHILE;

        SELECT COALESCE(SUM(ROUND(cantidad*precio_unitario,2)),0) INTO v_total_venta FROM detalle_venta WHERE id_venta=p_id_venta;
        SELECT COALESCE(SUM(monto),0) INTO v_total_pago FROM tmp_venta_pago;
        IF v_total_pago<>v_total_venta THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='La suma de pagos debe ser exactamente igual al total de venta'; END IF;

        WHILE EXISTS(SELECT 1 FROM tmp_venta_pago WHERE procesado=FALSE) DO
            SELECT MIN(orden) INTO v_orden FROM tmp_venta_pago WHERE procesado=FALSE;
            SELECT metodo_pago,monto,comprobante_qr INTO v_metodo,v_monto,v_comprobante
              FROM tmp_venta_pago WHERE orden=v_orden;
            INSERT INTO pago(id_venta,metodo_pago,monto,comprobante_qr)
            VALUES(p_id_venta,v_metodo,v_monto,CASE WHEN v_metodo='QR' THEN NULLIF(TRIM(v_comprobante),'') ELSE NULL END);
            UPDATE tmp_venta_pago SET procesado=TRUE WHERE orden=v_orden;
        END WHILE;

        COMMIT;
        DROP TEMPORARY TABLE IF EXISTS tmp_venta_detalle;
        DROP TEMPORARY TABLE IF EXISTS tmp_venta_pago;
    END IF;
END//

DELIMITER ;

CREATE OR REPLACE VIEW vw_stock_lote_ubicacion AS
SELECT
    lu.id_lote_ubicacion,
    p.id_producto,
    p.nombre AS producto,
    um.nombre AS unidad_base,
    um.abreviatura,
    dc.id_presentacion AS presentacion_compra_id,
    dc.forma_ingreso AS presentacion_compra,
    lp.id_lote,
    lp.codigo_lote,
    c.fecha_hora AS fecha_ingreso,
    lp.fecha_vencimiento,
    u.id_ubicacion,
    u.nombre AS ubicacion,
    lu.cantidad_actual AS stock_fisico,
    CASE WHEN lp.fecha_vencimiento IS NULL OR lp.fecha_vencimiento>CURRENT_DATE THEN lu.cantidad_actual ELSE 0 END AS stock_disponible,
    CASE WHEN lp.fecha_vencimiento IS NOT NULL AND lp.fecha_vencimiento<=CURRENT_DATE THEN lu.cantidad_actual ELSE 0 END AS stock_vencido,
    CASE
      WHEN lp.fecha_vencimiento IS NOT NULL AND lp.fecha_vencimiento<=CURRENT_DATE THEN 'VENCIDO'
      WHEN lp.fecha_vencimiento IS NOT NULL AND lp.fecha_vencimiento<=DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY) THEN 'PROXIMO_A_VENCER'
      ELSE 'VIGENTE'
    END AS estado_vencimiento,
    dc.costo_unitario,
    dc.factor_ingreso AS factor_conversion
FROM lote_ubicacion lu
JOIN lote_producto lp ON lp.id_lote=lu.id_lote
JOIN detalle_compra dc ON dc.id_detalle_compra=lp.id_detalle_compra
JOIN compra c ON c.id_compra=dc.id_compra
JOIN producto p ON p.id_producto=dc.id_producto
JOIN unidad_medida um ON um.id_unidad_medida=p.id_unidad_medida
JOIN ubicacion u ON u.id_ubicacion=lu.id_ubicacion;

CREATE OR REPLACE VIEW vw_stock_producto AS
SELECT
    p.id_producto,
    p.nombre AS producto,
    c.nombre AS categoria,
    um.nombre AS unidad_base,
    um.abreviatura,
    p.stock_minimo,
    COALESCE(SUM(lu.cantidad_actual),0) AS stock_fisico,
    COALESCE(SUM(CASE WHEN lp.fecha_vencimiento IS NULL OR lp.fecha_vencimiento>CURRENT_DATE THEN lu.cantidad_actual ELSE 0 END),0) AS stock_disponible,
    COALESCE(SUM(CASE WHEN lp.fecha_vencimiento IS NOT NULL AND lp.fecha_vencimiento<=CURRENT_DATE THEN lu.cantidad_actual ELSE 0 END),0) AS stock_vencido,
    CASE
      WHEN COALESCE(SUM(CASE WHEN lp.fecha_vencimiento IS NULL OR lp.fecha_vencimiento>CURRENT_DATE THEN lu.cantidad_actual ELSE 0 END),0)=0 THEN 'AGOTADO'
      WHEN COALESCE(SUM(CASE WHEN lp.fecha_vencimiento IS NULL OR lp.fecha_vencimiento>CURRENT_DATE THEN lu.cantidad_actual ELSE 0 END),0)<=p.stock_minimo THEN 'STOCK BAJO'
      ELSE 'DISPONIBLE'
    END AS estado_stock
FROM producto p
JOIN categoria c ON c.id_categoria=p.id_categoria
JOIN unidad_medida um ON um.id_unidad_medida=p.id_unidad_medida
LEFT JOIN detalle_compra dc ON dc.id_producto=p.id_producto
LEFT JOIN lote_producto lp ON lp.id_detalle_compra=dc.id_detalle_compra
LEFT JOIN lote_ubicacion lu ON lu.id_lote=lp.id_lote
GROUP BY p.id_producto,p.nombre,c.nombre,um.nombre,um.abreviatura,p.stock_minimo;

CREATE OR REPLACE VIEW vw_compras_totales AS
SELECT
    c.id_compra,
    c.fecha_hora,
    c.id_proveedor,
    COALESCE(pr.nombre,'SIN PROVEEDOR') AS proveedor,
    u.id_usuario,
    CONCAT(u.nombre,' ',u.apellido) AS usuario,
    COALESCE(SUM(ROUND(dc.cantidad*dc.costo_unitario,2)),0) AS total_compra
FROM compra c
LEFT JOIN proveedor pr ON pr.id_proveedor=c.id_proveedor
JOIN usuario u ON u.id_usuario=c.id_usuario
LEFT JOIN detalle_compra dc ON dc.id_compra=c.id_compra
GROUP BY c.id_compra,c.fecha_hora,c.id_proveedor,pr.nombre,u.id_usuario,u.nombre,u.apellido;
