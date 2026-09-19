# Base de datos y roles

Estado vigente: **U039**. MySQL 8 es obligatorio. La conexión de ejecución usa `mysql2/promise` y la base indicada por `DB_NAME`.

> Las guías de versiones anteriores son históricas. Para el núcleo actual prevalece U039.

## Esquema vigente

V2 parte de 21 tablas de negocio. U004 añadió `sesion_web` y `app_migration`; U012 añadió `catalogo_operacion`; las preparaciones posteriores añadieron estructuras de proveedores, inventario y fotos. U039 agrega las estructuras operativas de caja/devoluciones sin borrar datos existentes.

Entre los objetos relevantes de U039 están:

| Objeto | Finalidad |
| --- | --- |
| `caja` | Identifica Caja 1 y Caja 2. |
| `sesion_caja.id_caja` | Relaciona un turno nuevo con su caja física. |
| `venta.operacion_clave` / `solicitud_hash` | Idempotencia de ventas. |
| `venta.fecha_hora_anulacion` / `id_usuario_anulacion` | Auditoría de la anulación. |
| `devolucion_pago` | Historial inmutable de devoluciones de EFECTIVO/QR. |
| `vw_ventas_totales` | Venta, caja, responsable, total y auditoría de anulación. |
| `vw_efectivo_esperado_sesion` | Efectivo que debería existir en el turno. |
| `vw_diferencias_caja` | Esperado, contado y diferencia. |
| `vw_reembolsos_venta` | Devoluciones registradas al anular. |

Los turnos históricos cerrados previos a U039 conservan su información original; si no tenían caja física registrada se muestran como **Caja histórica**.

## Procedimientos operativos

| Procedimiento | Regla principal |
| --- | --- |
| `sp_registrar_compra` | Registra compra y entrada de lotes. |
| `sp_registrar_venta` | Exige turno propio abierto, pago exacto, idempotencia y consume lotes por FEFO. |
| `sp_anular_venta` | Solo administrador activo; restaura lotes, audita usuario/fecha y registra devolución de pagos. |
| `sp_registrar_ajuste_inventario` | Registra retiros justificados de inventario. |
| `sp_cerrar_sesion_caja` | Solo responsable del turno; arquea denominaciones y exige observación si existe diferencia. |
| `sp_limpiar_catalogo_operacion` | Elimina en lotes solo claves idempotentes ya confirmadas y más antiguas que la retención indicada. |

U039 protege además las ventas, sesiones, cajas y devoluciones mediante triggers de historial. La aplicación de ejecución no necesita privilegios DDL.

## Reglas de Caja

Existen **Caja 1** y **Caja 2**, pero operativamente solo puede haber **un turno abierto a la vez**. Cada apertura nueva indica una caja física y un usuario responsable. Solo ese responsable puede cerrar el turno.

Al cerrar se registra el conteo por denominación. `efectivo_esperado = monto_inicial + pagos EFECTIVO de ventas VIGENTES`. Una diferencia entre esperado y contado requiere observación.

## FEFO

La salida automática de una venta prioriza lotes vendibles así:

1. lote con vencimiento válido más próximo;
2. siguiente vencimiento;
3. lotes sin vencimiento;
4. para empates, fecha de compra e identificadores.

Los lotes vencidos no se consumen.

## Roles y API

| Rol | Acceso operativo |
| --- | --- |
| `ADMINISTRADOR` | Inicio, Ventas, Caja, Productos, Inventario, Compras, Proveedores, Reportes, Usuarios y Mi perfil. Puede anular ventas. |
| `ENCARGADO_VENTA` | Inicio, Ventas, Caja y Mi perfil. Registra ventas únicamente en su turno abierto y consulta sus registros autorizados. |

La fuente de navegación es `src/config/navigation.js`, pero las API también comprueban roles mediante middleware. El menú por sí solo no concede permisos.

## Contraseñas y sesiones

Las contraseñas se almacenan con bcrypt y nunca se devuelven desde la API de Usuarios. Después del login se regenera la sesión. Las sesiones web se guardan en MySQL y cada solicitud protegida revalida usuario/rol.

El sistema impide desactivar la propia cuenta administrativa desde Usuarios y evita dejar la instalación sin al menos un administrador activo.

## Instalación

- **Base existente:** ejecutar U039 mediante `npm run db:core`; no reconstruir la base.
- **Base nueva vacía:** `npm run db:install` usa el bootstrap oficial de `database/bootstrap/` y aplica las preparaciones hasta U039.
- Después de preparar la base, aplicar `database/permisos_minimos.sql` a la cuenta de ejecución correspondiente.

La preparación requiere una cuenta MySQL con permisos de instalación; la cuenta cotidiana de la aplicación debe conservar privilegios mínimos. Ver `docs/52_NUCLEO_OPERATIVO_U039.md`.
