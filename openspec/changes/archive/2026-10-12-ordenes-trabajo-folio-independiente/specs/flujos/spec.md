## MODIFIED Requirements

### Requirement: Triggers disponibles
El sistema SHALL soportar triggers: tarea creada/completada/asignada, cambio de estado, nota, orden de trabajo (alta desde el formulario público), revisión propuesta/aprobada/rechazada. La etiqueta visible del trigger de alta pública SHALL ser «Orden de trabajo creada» y SHALL NOT decir «solicitud pública». El identificador interno `solicitud.created` en `lib/workflows.ts` SHALL conservarse para no romper flujos ya guardados. Solo admin configura flujos.

#### Scenario: Trigger de tarea creada
- **GIVEN** un flujo activo con trigger «tarea creada»
- **WHEN** se crea una nueva tarea
- **THEN** el motor ejecuta las acciones del flujo

#### Scenario: Etiqueta de orden de trabajo en el wizard
- **GIVEN** un admin en el paso «Cuando» de `/flujos/new` o de la edición
- **WHEN** ve la lista de triggers
- **THEN** aparece «Orden de trabajo creada»
- **AND** no aparece «Solicitud pública creada»

#### Scenario: El id del trigger no cambia
- **GIVEN** un flujo ya guardado con trigger `solicitud.created`
- **WHEN** se carga ese flujo después del cambio de texto
- **THEN** el flujo sigue disparándose al crear una orden desde `/orden`

## ADDED Requirements

### Requirement: Texto de contacto de la orden pública
La etiqueta del destinatario de contacto de ese evento SHALL decir «orden de trabajo» y SHALL NOT decir «solicitud». Sigue siendo solo admin quien edita flujos. Un rol que no es admin SHALL recibir 403 al usar la API de flujos.

#### Scenario: Etiqueta de destinatario contacto
- **GIVEN** un admin eligiendo destinatario de una acción
- **WHEN** ve la opción de contacto del evento público
- **THEN** el texto es «Contacto del evento (orden de trabajo)»

#### Scenario: Técnico no administra flujos
- **GIVEN** un usuario con rol técnico
- **WHEN** llama a la API de flujos
- **THEN** la respuesta es 403
