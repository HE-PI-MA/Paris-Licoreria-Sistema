# París Licorería

Sistema web para una licorería, con Node.js, Express, EJS y MySQL 8. El servidor de la instalación utiliza Windows para verificar el equipo y proteger la activación con DPAPI.

## Estado del desarrollo — U008

**Funciona:** activación, inicio y cierre de sesión, sesiones persistentes, revalidación del usuario, perfil de consulta, permisos de páginas y sidebar adaptable. Los nueve módulos comparten cabecera, controles, contenido y mensajes. Iconos e Inter se distribuyen localmente en el espacio de trabajo.

**Pendiente:** conectar las pantallas con las operaciones del negocio. Inicio muestra un saludo; los otros ocho módulos muestran su espacio en preparación. Sus botones, buscadores y filtros están desactivados. Una página visible no significa que su operación ya esté implementada.

La base V2 y la migración U004 contienen procedimientos y vistas para parte del negocio; todavía no existen las API ni los formularios que los conecten a estos módulos.

La lógica de la interfaz utiliza clases para formularios, sidebar y mensajes; login y activación comparten AuthForm. Los estilos conservan su organización por componentes.

## Documentación

| Documento | Qué explica |
| --- | --- |
| [Arquitectura](docs/01_ARQUITECTURA_DEL_SISTEMA.md) | Capas, archivos y recorrido de una petición. |
| [Configuración y ejecución](docs/02_CONFIGURACION_Y_EJECUCION.md) | Requisitos, dependencias y arranque. |
| [Base de datos y roles](docs/03_BASE_DE_DATOS_Y_ROLES.md) | Tablas, procedimientos y permisos actuales. |
| [Licenciamiento](docs/04_LICENCIAMIENTO_Y_ACTIVACION.md) | Firma, equipo y activación. |
| [Autenticación y pruebas](docs/05_AUTENTICACION_SESIONES_Y_PRUEBAS.md) | Controles implementados y límites de la verificación. |
| [Bitácora](docs/08_BITACORA_DE_DESARROLLO.md) | Jornadas e información de horas confirmada. |
| [Estructura común](docs/11_ESTRUCTURA_MODULOS_U006.md) | Componentes y mensajes reutilizables. |
| [Finalidad de los módulos](docs/15_MODULOS_Y_ALCANCE.md) | Qué hará cada módulo y qué falta. |
| [Mantenimiento del código](docs/16_GUIA_DE_MANTENIMIENTO.md) | Dónde cambiar cada parte y cómo documentarla. |
| [Organización POO](docs/18_ORGANIZACION_POO_U008.md) | Clases JavaScript, componentes CSS y pruebas de U008. |
| [Revisión U007](docs/17_REVISION_U007.md) | Limpieza, comprobaciones y publicación. |

Los documentos U002–U006E registran entregas anteriores; los valores visuales vigentes se encuentran en la guía de mantenimiento.

## Ejecutar la instalación existente

Conservar `.env`, dependencias, licencia, activación y base de datos. Si U004 ya fue instalada correctamente, esta revisión no requiere volver a migrar MySQL.

```powershell
node --test tests/application.test.js tests/frontend.test.js tests/migration-runner.test.js tests/mysql.test.js
node scripts/db-check.js
node server.js
```

El primer comando ejecuta pruebas simuladas; la integración con MySQL real se omite si no se configura expresamente. El segundo consulta la base configurada y muestra cuatro comprobaciones, sin corregir datos. El tercero inicia el servidor.

Para una instalación nueva, seguir la configuración y la [migración U004](docs/09_PARCHE_U004.md). Se conserva `pnpm-lock.yaml`; no se actualizan dependencias en U007.

## Configuración privada

`.env` contiene la conexión y el secreto de sesión; no debe subirse a Git. La clave privada, los respaldos, las licencias y la activación permanecen fuera del repositorio. La clave pública de verificación sí forma parte del código.

Desarrollo local: `NODE_ENV=development`, `HOST=127.0.0.1`, `PORT=3100`. Producción: origen HTTPS exacto y TLS directo o proxy de confianza explícito. El servidor valida esta configuración antes del arranque.
