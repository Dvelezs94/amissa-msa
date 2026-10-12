## MODIFIED Requirements

### Requirement: Secciones de documentación
La guía SHALL incluir secciones: Qué es MSA, Roles, Tareas, Calendario, Máquinas, Checklists, Orden de trabajo, Flujos, App móvil, Búsqueda. La sección que hoy se titula «Solicitudes públicas» (`lib/docs-guide.ts`, slug `solicitudes`) SHALL titularse «Orden de trabajo». El slug SHALL permanecer `solicitudes` para no romper el enlace. El texto de esa sección y la matriz de roles SHALL NOT decir «solicitud pública». El ejemplo de folio de esa sección SHALL mostrar un folio `OT-n`. En los mocks de tareas, una rutina SHALL mostrarse con folio `RU-n` (desde 4000) y una orden de trabajo con `OT-n`.

#### Scenario: Navegar a sección
- **GIVEN** un usuario en `/documentacion`
- **WHEN** selecciona la sección «Tareas»
- **THEN** ve el contenido detallado de esa sección con mocks visuales

#### Scenario: Capítulo de orden de trabajo
- **GIVEN** un admin en `/documentacion`
- **WHEN** abre la sección de orden de trabajo (`/documentacion/solicitudes`)
- **THEN** el título y el cuerpo dicen «orden de trabajo»
- **AND** no aparece «solicitud pública»
- **AND** el folio de ejemplo tiene forma `OT-n`

#### Scenario: Mock de tareas distingue RU y OT
- **GIVEN** un usuario en la sección «Tareas» de `/documentacion`
- **WHEN** ve el tablero de ejemplo
- **THEN** las rutinas de ejemplo usan folio `RU-n`
- **AND** las órdenes de trabajo de ejemplo usan folio `OT-n`

## ADDED Requirements

### Requirement: Acceso a la guía sin cambio de rol
Técnico y calidad SHALL seguir entrando a `/documentacion`. La sección de orden de trabajo SHALL seguir limitada a admin, como hoy. Un técnico que abre esa sección SHALL ser tratado como hoy (no gana el capítulo si la audiencia no lo incluye).

#### Scenario: Técnico sigue viendo la guía
- **GIVEN** un usuario con rol técnico
- **WHEN** abre `/documentacion`
- **THEN** ve el índice de las secciones permitidas para su rol
