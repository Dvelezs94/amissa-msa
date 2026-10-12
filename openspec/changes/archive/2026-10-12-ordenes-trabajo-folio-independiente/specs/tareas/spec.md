## MODIFIED Requirements

### Requirement: Folio único
Cada tarea SHALL tener un folio único. Las órdenes de trabajo (`on_demand`) y las rutinas (`routine`) SHALL usar secuencias independientes. Una orden de trabajo nueva SHALL recibir `OT-n`: `OT-1` si no hay ningún `OT` guardado, o el máximo `OT` ya guardado + 1. Una rutina nueva SHALL recibir `RU-n` con piso 4000: `RU-4000` si no hay un `RU` con número ≥ 4000, o el máximo `RU` ya guardado + 1 si ese máximo es mayor. Crear una SHALL NOT avanzar el contador de la otra. Un folio ya guardado SHALL permanecer igual, sea número (`2044`), `OT-n`, `RU-n`, o la misma clave sin guion y en cualquier mayúscula (`OT12`, `ru-12`). La búsqueda SHALL encontrar esas formas y normalizar la consulta al canónico con guion y mayúsculas (`OT-12`, `RU-4000`). Helpers de secuencia en `lib/work-order-folio-helpers.ts`.

#### Scenario: Folio generado al crear tarea
- **GIVEN** un usuario creando una orden de trabajo y no existe aún el folio `OT-1`
- **WHEN** la tarea se guarda
- **THEN** se le asigna el folio único `OT-1`

#### Scenario: La serie de órdenes no depende de las rutinas
- **GIVEN** ya existe la rutina `RU-4000` y no hay folios `OT`
- **WHEN** se crea una orden de trabajo
- **THEN** el folio de la orden es `OT-1`
- **AND** la siguiente rutina no consume ese `OT-1`

#### Scenario: La serie de rutinas no depende de las órdenes
- **GIVEN** ya existe la orden `OT-3` y no hay un folio `RU` con número ≥ 4000
- **WHEN** se crea una rutina desde el calendario
- **THEN** el folio de la rutina es `RU-4000`
- **AND** la siguiente orden de trabajo es `OT-4`

#### Scenario: Folio legado sin reescribir
- **GIVEN** una tarea ya guardada con folio numérico `2044`, otra con `OT-80` y otra con `ru-12`
- **WHEN** se consultan después del cambio
- **THEN** siguen siendo `2044`, `OT-80` y `ru-12`
- **AND** la siguiente orden es `OT-81`
- **AND** la siguiente rutina es `RU-4000`, no `RU-13`

#### Scenario: La serie RU continúa por encima de 4000
- **GIVEN** la última rutina con prefijo RU es `RU-4102`
- **WHEN** se crea otra rutina
- **THEN** su folio es `RU-4103`
- **AND** `RU-4102` no cambia

## ADDED Requirements

### Requirement: Alta de orden de trabajo dentro de la sesión
Un usuario autenticado con rol admin, técnico o calidad SHALL poder crear una orden de trabajo desde `/tareas` (acción «Nueva orden de trabajo», formulario en `/tareas/new`). Esa alta SHALL guardar `kind` `on_demand` y un folio de la serie `OT-`. Quien no tiene sesión SHALL ser enviado a `/login` y no SHALL crear la orden. El formulario público `/orden` SHALL seguir disponible sin sesión. No se agregan rutas nuevas en `middleware.ts`: `/tareas` ya está permitido para técnico y calidad.

#### Scenario: Admin, técnico o calidad crea la orden en la app
- **GIVEN** un usuario con rol admin, técnico o calidad y sesión activa
- **WHEN** abre «Nueva orden de trabajo» en `/tareas`, escribe un título y guarda
- **THEN** se crea una orden de trabajo con folio `OT-n`
- **AND** aparece en el tablero de `/tareas`

#### Scenario: Sin sesión no se crea desde la app
- **GIVEN** un visitante sin sesión
- **WHEN** intenta abrir `/tareas/new` o `POST /api/work-orders`
- **THEN** la página redirige a `/login` o la API responde 401
- **AND** no se crea una orden
