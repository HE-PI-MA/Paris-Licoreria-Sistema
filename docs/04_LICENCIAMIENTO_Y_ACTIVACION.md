# 04. Licenciamiento y Activacion

## Objetivo

Evitar que copiar la instalacion de Paris Licoreria a otra computadora sea suficiente para utilizar el sistema sin autorizacion.

La proteccion no se presenta como software imposible de modificar. Su objetivo es impedir la copia y ejecucion directa sin una licencia autentica y una activacion valida.

## Flujo implementado

Inicio
-> Licencia valida
-> Activacion valida
-> Login
-> Limite de intentos
-> bcrypt
-> Sesion
-> Usuario ACTIVO
-> Rol
-> Modulo autorizado

## Componentes implementados

- MachineFingerprint
- LicenseRepository
- LicenseSchema
- LicensePayload
- LicenseVerifier
- LicenseService
- LicenseMiddleware
- ActivationRepository
- ActivationService
- WindowsProtection

## Firma digital

Las licencias usan Ed25519.

La clave privada:
- Permanece fuera del repositorio.
- Permanece fuera de la instalacion.
- Se usa solamente para emitir licencias.

La aplicacion contiene solamente la clave publica necesaria para verificar la firma.

## Ubicaciones

Licencia:
C:\ProgramData\ParisLicoreria\license\license.json

Activacion:
C:\ProgramData\ParisLicoreria\activation\activation.dat

## Activacion

El codigo de activacion:
- Se utiliza una sola vez.
- No se guarda en texto plano dentro de activation.dat.
- Se compara mediante SHA-256.

activation.dat se protege mediante DPAPI de Windows con alcance LocalMachine.

## Tipos de licencia

PERMANENTE:
fechaExpiracion = null

TEMPORAL:
requiere fechaExpiracion valida.

## Rutas

GET /api/licencia/estado
POST /api/licencia/activar
POST /api/auth/login

El Login esta protegido por LicenseMiddleware.

## Archivos privados que NO deben subirse a GitHub

- private-key.pem
- Codigos privados de activacion
- Generador privado de licencias
- activation.dat de una instalacion
- Copias privadas de licencias emitidas

## Estado al 06/09/2026

Implementado y verificado:
- Firma Ed25519
- Licencia ligada al equipo
- Licencia permanente/temporal
- ProgramData
- DPAPI LocalMachine
- Activacion de una sola vez
- Bloqueo del Login si el equipo no esta activado
- Integracion con autenticacion y sesiones

Pendiente:
- Aplicar RoleMiddleware en cada modulo real
- Sesiones persistentes para produccion
- Endurecimiento final de despliegue
