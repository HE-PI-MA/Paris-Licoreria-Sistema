# Módulos y alcance funcional

## Qué funciona hoy

Las nueve páginas tienen la estructura compartida: cabecera, controles, contenido y mensajes. La navegación está protegida por licencia, sesión y rol. Inicio muestra el saludo; los otros módulos muestran su estado de preparación. Los controles de negocio aún están desactivados.

Mi perfil consulta los datos reales del usuario autenticado. Cerrar sesión funciona desde el pie del sidebar. Estas son funciones actuales, a diferencia de las operaciones descritas a continuación.

## Funciones previstas

Este es el alcance inicial propuesto a partir del esquema existente. Los campos, permisos de operación y detalles visuales se concretan al desarrollar cada módulo.

| Módulo | Para qué sirve y qué hará | Acceso de página actual |
| --- | --- | --- |
| **Inicio** | Resumen del día, estado de caja y accesos frecuentes. Para administración, indicadores de stock bajo y lotes próximos a vencer. Cada resumen deberá respetar el rol y los datos autorizados. | Ambos roles |
| **Ventas** | Buscar presentaciones, agregar cantidades a una venta, calcular el total, registrar pagos y consultar el historial autorizado. Exigir caja abierta y stock disponible. Las anulaciones necesitan permiso explícito y motivo. | Ambos roles |
| **Caja** | Abrir una sesión con monto inicial, consultar sus cobros, contar efectivo por denominaciones y cerrar mostrando efectivo esperado, contado y diferencia. La API deberá validar el usuario responsable de la caja. | Ambos roles |
| **Productos** | Mantener el catálogo: nombre, categoría, unidad base, stock mínimo y estado. Gestionar presentaciones, código de barras, conversión y precio de venta. | Administrador |
| **Inventario** | Consultar existencias físicas y disponibles por producto, lote y ubicación; revisar vencimientos y stock bajo. Registrar bajas justificadas por daño, pérdida o vencimiento y consultar los movimientos. | Administrador |
| **Compras** | Registrar abastecimiento: proveedor, presentaciones, cantidades, costos, lotes, ubicación y vencimiento cuando corresponda. Consultar compras y detalles. Una compra registrada incorpora existencias. | Administrador |
| **Proveedores** | Registrar y actualizar nombre, contacto, teléfono, dirección y estado; consultar las compras asociadas. | Administrador |
| **Reportes** | Consultar ventas y compras por período, productos más vendidos, inventario y diferencias de caja. Impresión y exportación se definirán al diseñar esta sección; aún no están implementadas. | Administrador |
| **Usuarios** | Crear y administrar cuentas, asignar los roles existentes, activar/desactivar y establecer un mecanismo autorizado de cambio de contraseña. Las contraseñas nunca se mostrarán en una tabla. | Administrador |

**Mi perfil:** consulta disponible de nombre, apellido, usuario y rol. La edición y el cambio de contraseña todavía no forman parte de esa pantalla.

## Relación entre los módulos

Productos define qué se maneja y vende. Proveedores identifica quién abastece. Compras registra las entradas. Inventario muestra y controla las existencias. Caja organiza la jornada de cobros. Ventas registra las salidas y pagos. Inicio y Reportes resumen los datos. Usuarios define quién accede.

Orden sugerido para conectar funciones: Productos → Proveedores → Compras e Inventario → Caja → Ventas → Reportes e Inicio. La administración de Usuarios puede trabajarse en paralelo funcionalmente, sin alterar las cuentas existentes por defecto.

## Límites que deben conservarse

- Mantener el historial: desactivar catálogos cuando corresponda; no borrar operaciones para corregir cifras.
- Validar entradas y permisos en el servidor. Un botón oculto o desactivado no protege una API.
- Reutilizar los procedimientos transaccionales existentes donde corresponda.
- Distinguir carga, ausencia de registros y fallo de consulta. No mostrar cifras ficticias como datos del negocio.
- No asumir facturación fiscal, contabilidad completa, crédito a clientes, múltiples sucursales o integraciones externas como funciones ya incluidas. Su alcance requeriría desarrollo específico.
