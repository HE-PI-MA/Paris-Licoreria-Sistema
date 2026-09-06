# 04. Licenciamiento y Activacion

## 1. Objetivo

Evitar que copiar la instalacion de Paris Licoreria a otra computadora sea suficiente para utilizar el sistema.

La proteccion no pretende hacer el software imposible de modificar, sino impedir la copia y ejecucion directa sin una activacion autorizada.

## 2. Flujo general

Inicio del sistema
-> Verificar licencia
-> Verificar activacion del equipo
-> Permitir acceso al Login
-> Autenticacion
-> Autorizacion por rol

Si la licencia o la activacion no son validas, el sistema no permitira acceder al Login.

## 3. Activacion por computadora

La primera vez que el sistema se instale en una computadora se solicitara una clave de activacion.

La clave se utilizara solamente durante el proceso de activacion.

La clave de activacion no se almacenara como texto dentro del sistema.

Despues de una activacion correcta, el equipo podra iniciar el sistema sin volver a solicitar la clave normalmente.

## 4. Huella del equipo

La aplicacion generara una huella estable de la computadora autorizada.

La huella se obtendra a partir de identificadores del sistema y se procesara mediante SHA-256.

No se dependera de demasiados componentes fisicos para evitar bloquear instalaciones legitimas despues de una reparacion menor.

## 5. Firma digital

Las licencias utilizaran criptografia asimetrica.

Existiran dos claves:

- Clave privada: solamente para generar y firmar licencias.
- Clave publica: incluida en la aplicacion para verificar licencias.

La clave privada nunca se incluira en la instalacion de Paris Licoreria ni en su repositorio publico.

Sin la clave privada no se podran generar licencias validas nuevas.

## 6. Archivos de licencia

Los archivos de licencia y activacion se almacenaran fuera de la carpeta principal del proyecto.

Ubicacion prevista:

C:\ProgramData\ParisLicoreria\license\license.json
C:\ProgramData\ParisLicoreria\activation\activation.dat

La activacion local se protegera mediante mecanismos de Windows cuando sea posible.

## 7. Copia a otra computadora

Si una persona comprime o copia la instalacion a otra computadora:

- La huella del nuevo equipo sera diferente.
- La activacion anterior no sera valida.
- El sistema solicitara una activacion autorizada.
- El Login no estara disponible hasta completar la activacion.

## 8. Arquitectura prevista

Componentes del sistema:

- LicenseRepository
- LicenseService
- ActivationService
- LicenseMiddleware
- MachineFingerprint
- WindowsProtection

## 9. Generador de licencias

El generador de licencias sera un proyecto separado.

No formara parte de Paris-Licoreria-Sistema.

El generador contendra la clave privada necesaria para firmar licencias.

La herramienta de generacion no se instalara en la computadora del cliente.

## 10. Verificaciones

La licencia se verificara:

- Al iniciar el servidor.
- Antes de permitir el Login.
- En operaciones importantes del sistema.

## 11. Interfaz

No se utilizaran alertas nativas del navegador.

La aplicacion tendra componentes propios para:

- Licencia valida.
- Activacion requerida.
- Licencia invalida.
- Licencia alterada.
- Equipo no autorizado.
- Activacion correcta.

No se utilizaran alert, confirm ni prompt como interfaz habitual.

## 12. Orden de seguridad

Licencia valida
-> Activacion del equipo
-> Login
-> Limite de intentos
-> bcrypt
-> Sesion
-> Usuario activo
-> Permisos por rol
-> Sistema

## 13. Estado

Diseno de licenciamiento definido.
Implementacion pendiente.
