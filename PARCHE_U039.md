# París Licorería — Parche integral U039

Parche preparado sobre la carpeta auditada. Conserva los módulos existentes y corrige el núcleo operativo detectado en la auditoría.

## Incluye

- Caja 1 / Caja 2 con un único turno abierto global y cierre por responsable.
- Ventas operativas con pago EFECTIVO/QR, FEFO e idempotencia contra reintentos.
- Anulación administrativa con restauración exacta de lotes y devolución auditada.
- Usuarios, Reportes e Inicio conectados.
- Verificación de esquema hasta U039.
- Bootstrap V2 oficial para instalaciones nuevas.
- Limpieza manual segura de `catalogo_operacion` mediante procedimiento controlado.
- Documentación principal actualizada.

## No se toca

- `.env`: se conserva exactamente como fue recibido.
- No se borran ni reconstruyen datos históricos.
- No se reemplazan U004/U012/U023/U030/U031 ya versionadas.
- `node_modules` y `.git` no forman parte del ZIP de entrega.

## Aplicación sobre una base existente

1. Respaldar MySQL y detener el servidor.
2. Copiar/reemplazar los archivos del proyecto por esta versión.
3. Con una cuenta MySQL de instalación ejecutar `pnpm run db:core`.
4. Aplicar/revalidar `database/permisos_minimos.sql` para la cuenta de ejecución.
5. Iniciar el sistema y revisar Caja → Ventas → cierre de Caja.

Guía detallada: `docs/52_NUCLEO_OPERATIVO_U039.md`.

## Validaciones efectuadas en la auditoría del parche

- 187 archivos JavaScript propios/pruebas: sintaxis válida con `node -c`.
- 22 plantillas EJS: delimitadores balanceados.
- U039: SQL dividido correctamente en 40 sentencias por el parser del proyecto.
- Bootstrap oficial: 21 tablas + 7 datos iniciales + 26 rutinas/triggers + 14 vistas.
- `tests/core-u039.test.js`: 8/8 regresiones U039 aprobadas.
- `git diff --check`: sin errores de espacios/parche.
- `.env`: SHA-256 idéntico al archivo recibido.

El entorno de auditoría no contiene las dependencias Node instaladas ni un servidor MySQL 8 local, por lo que la suite que requiere Express/bcrypt/mysql2, navegador o MySQL debe ejecutarse en el equipo de desarrollo después de conservar/instalar `node_modules`. Esta limitación no se presenta como una prueba funcional de MySQL.
