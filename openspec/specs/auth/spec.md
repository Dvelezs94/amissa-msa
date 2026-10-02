# Auth & Roles

## Purpose
Autenticación, sesión y control de acceso por roles en MSA.

## Requirements

### Requirement: Autenticación por sesión
El sistema SHALL autenticar usuarios con cookie de sesión + JWT payload.

#### Scenario: Login exitoso
- **GIVEN** un usuario registrado
- **WHEN** envía credenciales válidas a `POST /api/auth/login`
- **THEN** recibe una cookie de sesión válida

#### Scenario: Sesión expirada
- **GIVEN** una cookie de sesión expirada
- **WHEN** el usuario navega a una ruta protegida
- **THEN** es redirigido a `/login`

### Requirement: Roles del sistema
El sistema MUST soportar tres roles: `admin`, `tecnico`, `calidad`.

#### Scenario: Rol asignado al crear usuario
- **GIVEN** un admin creando un usuario
- **WHEN** selecciona el rol `tecnico`
- **THEN** el usuario queda con rol `tecnico` en la sesión

### Requirement: Acceso técnico restringido
Middleware SHALL restringir al rol `tecnico` a rutas específicas y una lista blanca de APIs.

#### Scenario: Técnico accede a ruta permitida
- **GIVEN** un usuario con rol `tecnico`
- **WHEN** navega a `/tareas`
- **THEN** accede correctamente

#### Scenario: Técnico accede a ruta prohibida
- **GIVEN** un usuario con rol `tecnico`
- **WHEN** navega a `/users`
- **THEN** es redirigido a `/tareas`

### Requirement: Acceso calidad restringido
Rol `calidad` SHALL acceder solo a checklists/revisiones, tareas, calendario (puede renombrar calendarios), equipo, búsqueda y documentación.

#### Scenario: Calidad accede a checklists
- **GIVEN** un usuario con rol `calidad`
- **WHEN** navega a `/checklists`
- **THEN** accede correctamente

### Requirement: Admin acceso completo
Rol `admin` SHALL tener acceso a todas las rutas y APIs.

#### Scenario: Admin accede a gestión de usuarios
- **GIVEN** un usuario con rol `admin`
- **WHEN** navega a `/users`
- **THEN** accede correctamente
