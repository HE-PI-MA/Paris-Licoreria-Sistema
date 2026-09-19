# Módulos y alcance funcional

Estado vigente: **U039**. Los nueve módulos del panel ya tienen una función real. Esta guía sustituye la descripción anterior donde Ventas, Caja, Reportes, Usuarios e Inicio figuraban como pantallas pendientes.

## Estado por módulo

| Módulo | Función actual | Acceso |
| --- | --- | --- |
| **Inicio** | Ventas vigentes del día y estado del turno. Administración ve además agotados, stock bajo y lotes próximos a vencer. | Ambos roles |
| **Ventas** | Busca presentaciones disponibles, arma venta, cobra EFECTIVO/QR o pago combinado, exige total exacto, consume FEFO, muestra historial/detalle y evita duplicados por reintento. Administrador puede anular con devolución auditada. | Ambos roles |
| **Caja** | Abre Caja 1/Caja 2 con monto inicial, respeta un único turno abierto, muestra efectivo esperado, cuenta denominaciones, cierra y calcula diferencia. | Ambos roles |
| **Productos** | Catálogo, categorías, unidad base, presentaciones, barras, precios, estados y fotos. El stock no se edita directamente aquí. | Administrador |
| **Inventario** | Stock físico/disponible/vencido, lotes, ubicaciones, traslados, conteos, retiros justificados, alertas e historial. | Administrador |
| **Compras** | Proveedor, detalle, costo, lotes, ubicación, vencimiento y entrada de existencias. | Administrador |
| **Proveedores** | Alta, edición, estados, NIT y protección de historial asociado. | Administrador |
| **Reportes** | Resumen por período de ventas vigentes/anuladas, compras, inventario, productos más vendidos y cierres/diferencias de caja. | Administrador |
| **Usuarios** | Alta y edición de cuentas, rol, estado y contraseña; protege al último administrador activo y nunca expone hashes. | Administrador |

**Mi perfil** continúa como consulta de los datos de la cuenta autenticada.

## Flujo operativo

Productos define qué se vende. Proveedores y Compras registran el abastecimiento. Inventario controla existencias y vencimientos. Caja abre el turno autorizado. Ventas consume stock FEFO y registra pagos. Caja cierra con arqueo. Inicio y Reportes resumen la operación. Usuarios define quién accede.

## Reglas que U039 conserva

- Las operaciones históricas no se borran para corregir cifras.
- Caja y ventas validan propiedad del turno en servidor.
- Solo puede existir un turno de caja abierto globalmente.
- Una venta nueva requiere un turno abierto del mismo usuario.
- FEFO prioriza el lote que vence antes y nunca vende lotes vencidos.
- Una venta anulada restaura exactamente los lotes originales.
- QR anulado exige referencia de devolución; el reembolso queda en `devolucion_pago`.
- Los reintentos de una misma venta utilizan una clave idempotente y no deben crear dos ventas.
- Las cifras reales provienen de MySQL; los fallos de consulta no se reemplazan por ceros ficticios.

## Fuera de alcance actual

No se declara como implementado: facturación fiscal, contabilidad completa, ventas a crédito, cuentas de clientes, varias sucursales, e-commerce, delivery o integraciones externas de pago. Cualquiera de esas funciones requiere una ampliación explícita y no debe mezclarse silenciosamente con U039.

Para instalación, migración, pruebas y recuperación consultar `52_NUCLEO_OPERATIVO_U039.md`.
