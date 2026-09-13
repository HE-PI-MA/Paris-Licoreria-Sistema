-- Imagen opcional del producto, independiente de su precio y de cada compra.
CREATE TABLE producto_imagen (
  id_producto INT UNSIGNED NOT NULL,
  contenido MEDIUMBLOB NOT NULL,
  hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (id_producto),
  CONSTRAINT fk_producto_imagen_producto FOREIGN KEY (id_producto) REFERENCES producto(id_producto) ON DELETE CASCADE,
  CONSTRAINT chk_producto_imagen_bytes CHECK (OCTET_LENGTH(contenido) BETWEEN 1 AND 262144)
) ENGINE=InnoDB;
