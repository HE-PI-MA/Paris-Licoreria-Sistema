# Núcleo operativo U039 — Caja, Ventas, Usuarios, Reportes e Inicio

U039 corrige los hallazgos operativos de la auditoría sin rehacer la instalación ni borrar historial. **No modifica ni elimina `.env`** y no exige reconstruir Productos, Proveedores, Compras o Inventario.

## Qué corrige

1. Crea `caja` y registra **Caja 1** y **Caja 2**.
2. Agrega `sesion_caja.id_caja` para los turnos nuevos y mantiene las sesiones históricas sin inventar datos.
3. Mantiene la regla de negocio de **un solo turno abierto a la vez**.
4. Reemplaza la selección FIFO de ventas por **FEFO**.
5. Agrega idempotencia de venta para evitar duplicados por doble clic o reintentos concurrentes.
6. Audita anulación de venta con usuario y fecha.
7. Crea `devolucion_pago`; QR requiere referencia de devolución.
8. Completa las API y pantallas de Inicio, Ventas, Caja, Reportes y Usuarios.
9. Fortalece la comprobación de esquema al iniciar: exige las preparaciones necesarias hasta U039.
10. Incorpora un bootstrap V2 oficial fuera de `tests/` para instalaciones nuevas.
11. Añade mantenimiento manual de `catalogo_operacion` sin ejecutarlo automáticamente.

## Actualizar una base existente

1. Hacer respaldo de la base y detener el servidor.
2. Usar una cuenta MySQL de **instalación** con permisos para crear/alterar tablas, vistas, triggers y procedimientos.
3. Desde la raíz del proyecto ejecutar:

```powershell
pnpm run db:core
```

4. Aplicar o revalidar los permisos de `database/permisos_minimos.sql` para la cuenta cotidiana de la aplicación.
5. Iniciar el servidor normalmente.

`db:core` es reanudable por estructura antes de registrar U039. Si `app_migration` ya contiene U039 con otro checksum, se detiene en vez de reemplazar silenciosamente una versión diferente.

### Datos históricos

U039 **no asigna artificialmente Caja 1 o Caja 2 a sesiones antiguas cerradas**. Esas filas pueden conservar `id_caja = NULL` y las vistas las muestran como `Caja histórica`.

Si al instalar existe una única sesión antigua todavía ABIERTA y sin caja física, el instalador la asocia a Caja 1 para permitir terminar ese turno; los cierres históricos permanecen intactos.

## Instalación nueva

Solo para una base MySQL 8 completamente vacía:

```powershell
pnpm run db:install
pnpm run admin:create
```

`db:install` usa:

- `database/bootstrap/01_tablas_v2.sql`
- `database/bootstrap/02_datos_iniciales_v2.sql`
- `database/bootstrap/03_rutinas_v2.sql`
- `database/bootstrap/04_vistas_v2.sql`

Después aplica U004 y las preparaciones U012, U023, U030, U031 y U039. El comando aborta si detecta tablas existentes; nunca debe usarse para “arreglar” una base con datos.

## Permisos de ejecución

`database/permisos_minimos.sql` incluye los objetos nuevos. La aplicación cotidiana puede consultar cajas/devoluciones y ejecutar los procedimientos operativos, pero no recibe privilegios `CREATE`, `ALTER`, `DROP` ni `TRIGGER`.

## Caja

- Existen Caja 1 y Caja 2.
- Solo se abre una sesión globalmente a la vez.
- La apertura registra caja, usuario y monto inicial.
- Solo el responsable puede cerrar su turno.
- El cierre cuenta denominaciones activas.
- Si contado ≠ esperado, la observación es obligatoria.
- Una sesión cerrada queda histórica e inmutable.

## Ventas y FEFO

La venta requiere el turno abierto del mismo usuario. El total de EFECTIVO + QR debe coincidir exactamente con el total de los detalles.

El inventario se asigna por:

```text
vencimiento más próximo -> siguiente vencimiento -> lotes sin fecha
```

Los lotes vencidos se excluyen. Los empates se resuelven por fecha de compra e identificadores para mantener un resultado estable.

La API usa `X-Operation-Id`. Si una misma solicitud se reenvía con la misma clave y contenido, devuelve la venta ya creada. Si la clave se intenta reutilizar con otra venta, se rechaza.

## Anulación y devolución

Solo un administrador activo puede anular una venta y únicamente mientras el turno original siga abierto. La operación:

- restaura las cantidades a los mismos `lote_ubicacion` usados por la venta;
- registra motivo, fecha y usuario de anulación;
- crea una devolución por cada pago original;
- exige referencia para cualquier devolución QR;
- deja venta y devoluciones como historial protegido.

## Usuarios

Usuarios permite crear y editar cuentas `ADMINISTRADOR` y `ENCARGADO_VENTA`. Las contraseñas nuevas usan bcrypt. La API no devuelve hashes.

No permite desactivar la propia cuenta administrativa ni cambiar su propio rol desde esta pantalla. Tampoco permite desactivar/degradar al último administrador activo.

## Reportes e Inicio

Reportes acepta un rango de fechas válido y muestra ventas vigentes/anuladas, compras, inventario, top de productos y diferencias de caja. Inicio muestra el resumen del día respetando el rol.

## Mantenimiento de idempotencia

No se borra `catalogo_operacion` automáticamente. Cuando corresponda mantenimiento se puede ejecutar explícitamente:

```powershell
pnpm run db:cleanup-operations -- --dias 30
```

Solo elimina registros **ya confirmados** (`resultado IS NOT NULL`) anteriores al período indicado. El mínimo aceptado es 7 días. No elimina ventas, compras ni movimientos de inventario.

## Verificaciones incluidas

Las regresiones contractuales de U039 están en `tests/core-u039.test.js`. Incluyen estructura SQL, bootstrap, validaciones, caja, ventas, módulos y permisos mínimos.

En una máquina de desarrollo con dependencias instaladas:

```powershell
node --test tests/core-u039.test.js
pnpm test
```

Las pruebas que requieran MySQL deben ejecutarse contra una base desechable configurada específicamente para pruebas; nunca contra producción.
