# 07. Login Premium U003

Fecha: 06/09/2026.

## Objetivo

Reemplazar el Login visual inicial por una interfaz premium negro/dorado alineada con la identidad de Paris Licoreria, manteniendo intacta la seguridad implementada en backend.

## Recursos WebP

Se incorporan:

- public/img/login/paris-login-fondo-izquierdo.webp
- public/img/login/paris-login-fondo-derecho.webp
- public/img/login/paris-login-logo.webp

Los archivos fueron optimizados previamente para reducir el peso de carga.

## Distribucion visual

### Panel izquierdo

- Imagen de licoreria con vista nocturna a Paris.
- Superposicion oscura para mejorar contraste.
- Frase: "Mas que bebidas, grandes momentos".

### Panel derecho

- Fondo oscuro texturizado.
- Borde diagonal dorado en escritorio.
- Logo Paris Licoreria LM.
- Titulo Bienvenido.
- Subtitulo Sistema administrativo.
- Campo Usuario.
- Campo Contrasena.
- Mostrar/ocultar contrasena.
- Boton dorado Ingresar.
- Frase inferior "Licores que unen historias".

## Funcionalidad

No se agregan funciones ficticias.

Por ese motivo esta version no incorpora todavia:

- Recordarme.
- Recuperacion de contrasena.

El formulario conserva la API real:

POST /api/auth/login

y la redireccion posterior:

/inicio

## Design System

Se agregan tokens centralizados negro/dorado en:

public/css/base/tokens.css

Los estilos del Login viven en:

public/css/pages/auth.css

No se usan estilos inline.

## Responsive

Escritorio:
- Composicion dividida.
- Separacion diagonal.

Tablet y celular:
- Imagen superior.
- Formulario debajo.
- Sin diagonal lateral.
- Controles adaptados al ancho disponible.

## Seguridad

U003 no modifica:

- LicenseMiddleware.
- AuthMiddleware.
- RoleMiddleware.
- bcrypt.
- Rate limiter.
- express-session.
- DPAPI.
- Firma Ed25519.

## Validaciones

U003 verifica:

- Archivos WebP validos.
- Sintaxis de login.js.
- Sin alert(), confirm() ni prompt().
- Sin estilos inline en login.ejs.
- Rutas de los tres assets.
- Carga HTTP del Login.
- Carga HTTP de cada WebP.
- /api/auth/me bloqueado sin sesion.
- git diff --check.
- Commit y push.
- Git limpio.
