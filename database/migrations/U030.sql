-- U030: historial de inventario y soporte de diferencias de conteo sin alterar compras.
CREATE TABLE inventario_movimiento (
 id_movimiento BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 id_lote INT UNSIGNED NOT NULL,
 id_origen INT UNSIGNED NULL,
 id_destino INT UNSIGNED NULL,
 id_usuario INT UNSIGNED NOT NULL,
 fecha_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 tipo VARCHAR(20) NOT NULL,
 cantidad DECIMAL(15,3) NOT NULL,
 anterior DECIMAL(15,3) NOT NULL,
 posterior DECIMAL(15,3) NOT NULL,
 destino_anterior DECIMAL(15,3) NULL,
 destino_posterior DECIMAL(15,3) NULL,
 motivo VARCHAR(250) NOT NULL,
 CONSTRAINT fk_im_lote FOREIGN KEY(id_lote) REFERENCES lote_producto(id_lote) ON DELETE RESTRICT,
 CONSTRAINT fk_im_origen FOREIGN KEY(id_origen) REFERENCES ubicacion(id_ubicacion) ON DELETE RESTRICT,
 CONSTRAINT fk_im_destino FOREIGN KEY(id_destino) REFERENCES ubicacion(id_ubicacion) ON DELETE RESTRICT,
 CONSTRAINT fk_im_usuario FOREIGN KEY(id_usuario) REFERENCES usuario(id_usuario) ON DELETE RESTRICT,
 CONSTRAINT chk_im_motivo CHECK(TRIM(motivo)<>''),
 CONSTRAINT chk_im_saldos CHECK(anterior>=0 AND posterior>=0),
 CONSTRAINT chk_im_coherencia CHECK(
  (tipo='COMPRA' AND cantidad>0 AND id_origen IS NULL AND id_destino IS NOT NULL AND anterior=0 AND posterior=cantidad AND destino_anterior IS NULL AND destino_posterior IS NULL) OR
  (tipo='CONTEO' AND cantidad<>0 AND id_origen IS NOT NULL AND id_destino IS NULL AND posterior-anterior=cantidad AND destino_anterior IS NULL AND destino_posterior IS NULL) OR
  (tipo='TRASLADO' AND cantidad>0 AND id_origen IS NOT NULL AND id_destino IS NOT NULL AND id_origen<>id_destino AND anterior-posterior=cantidad AND destino_anterior IS NOT NULL AND destino_posterior IS NOT NULL AND destino_anterior>=0 AND destino_posterior-destino_anterior=cantidad)
 ),
 INDEX idx_im_lote_tipo(id_lote,tipo),
 INDEX idx_im_fecha(fecha_hora,id_movimiento)
) ENGINE=InnoDB;

DELIMITER //
CREATE TRIGGER trg_lote_ubicacion_bi_cantidad
BEFORE INSERT ON lote_ubicacion
FOR EACH ROW
BEGIN
    DECLARE v_inicial DECIMAL(18,3);
    DECLARE v_asignado DECIMAL(18,3);

    SELECT cantidad_inicial + COALESCE((SELECT SUM(m.cantidad) FROM inventario_movimiento m WHERE m.id_lote = NEW.id_lote AND m.tipo = 'CONTEO'), 0) INTO v_inicial
      FROM lote_producto
     WHERE id_lote = NEW.id_lote;

    SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_asignado
      FROM lote_ubicacion
     WHERE id_lote = NEW.id_lote;

    IF ROUND(v_asignado + NEW.cantidad_actual, 3) > v_inicial THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La distribución por ubicaciones supera la cantidad del lote y sus conteos';
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

    SELECT cantidad_inicial + COALESCE((SELECT SUM(m.cantidad) FROM inventario_movimiento m WHERE m.id_lote = NEW.id_lote AND m.tipo = 'CONTEO'), 0) INTO v_inicial
      FROM lote_producto
     WHERE id_lote = NEW.id_lote;

    SELECT COALESCE(SUM(cantidad_actual), 0) INTO v_otras_ubicaciones
      FROM lote_ubicacion
     WHERE id_lote = NEW.id_lote
       AND id_lote_ubicacion <> OLD.id_lote_ubicacion;

    IF ROUND(v_otras_ubicaciones + NEW.cantidad_actual, 3) > v_inicial THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'La existencia física supera la cantidad del lote y sus conteos';
    END IF;
END//

CREATE TRIGGER trg_im_bu_inmutable BEFORE UPDATE ON inventario_movimiento FOR EACH ROW
BEGIN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los movimientos confirmados son históricos e inmutables';
END//

CREATE TRIGGER trg_im_bd_inmutable BEFORE DELETE ON inventario_movimiento FOR EACH ROW
BEGIN
 SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Los movimientos confirmados son históricos e inmutables';
END//

DELIMITER ;
