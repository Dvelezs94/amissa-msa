# Tareas (Work Orders)

## Purpose
Gestión de órdenes de trabajo: tablero Kanban, tipos, duración, folios y notificaciones.

## Requirements

### Requirement: Tablero Kanban
El sistema SHALL mostrar tareas en un tablero estilo Kanban en `/tareas`.

#### Scenario: Ver tablero
- **GIVEN** un usuario autenticado
- **WHEN** navega a `/tareas`
- **THEN** ve las tareas organizadas por columnas de estado

#### Scenario: Filtrar órdenes de trabajo o rutinas
- **GIVEN** el tablero de `/tareas` con órdenes de trabajo y rutinas
- **WHEN** el usuario elige «Órdenes de trabajo» o «Rutinas»
- **THEN** el tablero muestra solo ese tipo

### Requirement: Fecha de inicio
Las tareas SHALL soportar una `start_date` opcional, distinta de `startedAt`.

#### Scenario: Tarea con fecha de inicio futura
- **GIVEN** una tarea con start_date mañana
- **WHEN** se consulta la lista de tareas
- **THEN** la tarea aparece en el tablero web pero no en la app móvil

### Requirement: Notificación de tarea completada
Cuando una tarea transiciona a completada, el creador SHALL recibir notificación in-app.

#### Scenario: Completar tarea notifica al creador
- **GIVEN** una tarea creada por usuario A y asignada a usuario B
- **WHEN** usuario B marca la tarea como completada
- **THEN** usuario A recibe notificación in-app

### Requirement: Folio único
Cada tarea SHALL tener un folio único para identificación.

#### Scenario: Folio generado al crear tarea
- **GIVEN** un usuario creando una tarea
- **WHEN** la tarea se guarda
- **THEN** se le asigna un folio único

### Requirement: Tipos de tarea
El sistema SHALL clasificar tareas por tipo (correctivo, preventivo, etc.).

#### Scenario: Asignar tipo a tarea
- **GIVEN** un usuario creando una tarea
- **WHEN** selecciona tipo «Correctivo»
- **THEN** la tarea se guarda con ese tipo

### Requirement: Duración y paro de máquina
El sistema SHALL registrar duración de tarea y paro de máquina.

#### Scenario: Registrar paro de máquina
- **GIVEN** una tarea con activo asociado
- **WHEN** el técnico indica que hubo paro de máquina
- **THEN** se registra el tiempo de paro
