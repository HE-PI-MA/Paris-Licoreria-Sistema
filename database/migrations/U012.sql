-- U012: memoriza el resultado de cada escritura del catálogo para tolerar reintentos.
-- No altera productos, existencias, ventas ni compras; no contiene datos de demostración.
CREATE TABLE IF NOT EXISTS catalogo_operacion (
    id_usuario INT UNSIGNED NOT NULL,
    clave CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    solicitud_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
    resultado JSON NULL,
    creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id_usuario, clave),
    CONSTRAINT fk_catalogo_operacion_usuario FOREIGN KEY (id_usuario)
        REFERENCES usuario (id_usuario) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB;
