# Calendario y Mantenimiento

## Purpose
Calendarios de mantenimiento, recurrencia de eventos, creación de tareas desde eventos, y planes por horas de uso.

## Requirements

### Requirement: Calendarios nombrados
El sistema SHALL soportar calendarios nombrados. El calendario integrado (`cal_mantenimiento`) nace como «Mantenimiento». Un administrador o un usuario con rol `calidad` (supervisor) MAY cambiar su nombre, y el sistema MUST NOT permitir eliminarlo.

#### Scenario: Nuevo schedule sin calendario asignado
- **GIVEN** un schedule creado sin calendar_id
- **WHEN** se guarda
- **THEN** se asigna al calendario default

#### Scenario: Renombrar el calendario principal
- **GIVEN** el calendario integrado
- **WHEN** un administrador o un usuario calidad cambia su nombre
- **THEN** el calendario conserva su id y muestra el nombre nuevo

#### Scenario: No se elimina el calendario principal
- **GIVEN** el calendario integrado
- **WHEN** un administrador intenta eliminarlo
- **THEN** el calendario permanece

### Requirement: Recurrencia de mantenimiento
Los eventos SHALL soportar recurrencia configurable (diaria, semanal, mensual, etc.).

#### Scenario: Evento recurrente diario
- **GIVEN** un evento con intervalo de 7 días
- **WHEN** se visualiza en el calendario
- **THEN** aparece cada 7 días

### Requirement: Crear tarea desde evento
Al crear una tarea desde un evento, la descripción SHALL incluir enlace al schedule.

#### Scenario: Tarea creada desde evento aparece como marcador
- **GIVEN** un evento de mantenimiento
- **WHEN** se crea una tarea desde ese evento
- **THEN** el calendario muestra el marcador de tarea vinculada

### Requirement: Auto-refresh del calendario
El calendario SHALL auto-refrescarse cada 60s mientras la pestaña esté visible.

#### Scenario: Calendario se refresca
- **GIVEN** el calendario abierto sin diálogos
- **WHEN** pasan 60 segundos
- **THEN** los datos se actualizan automáticamente

### Requirement: Mantenimiento por horas de uso
Un modal «Mto. por horas» SHALL permitir configurar planes basados en horas de uso de máquina.

#### Scenario: Crear plan por horas
- **GIVEN** un admin en la página de un activo
- **WHEN** configura 8 h/día y cada 250 h y crea el plan
- **THEN** se crea un schedule con intervalo de 31 días
- **AND** se redirige al calendario mostrando el primer evento

#### Scenario: Días de trabajo
- **GIVEN** un admin en el modal de mantenimiento por horas
- **WHEN** indica 8 h/día, cada 250 h y solo lunes a viernes
- **THEN** el intervalo sigue siendo 31 días de trabajo
- **AND** los eventos posteriores al inicio caen solo en esos días (sábado y domingo no cuentan)
