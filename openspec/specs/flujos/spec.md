# Flujos (Workflows)

## Purpose
Automatización de acciones (notificaciones, emails, Telegram) ante eventos del sistema. Solo admin.

## Requirements

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

### Requirement: Acciones de notificación y email
Las acciones SHALL ser notificación in-app, email vía SMTP o mensaje de Telegram.

#### Scenario: Acción de email
- **GIVEN** un flujo con acción email configurada
- **WHEN** se dispara el trigger
- **THEN** se envía el email al destinatario con las variables resueltas

#### Scenario: Acción de Telegram
- **GIVEN** un flujo con acción Telegram y `TELEGRAM_BOT_TOKEN` en el servidor
- **WHEN** se dispara el trigger
- **THEN** se envía el título y el mensaje al chat de la acción, o a `TELEGRAM_CHAT_ID` si la acción no indica chat
- **AND** el token del bot no se guarda en el flujo

### Requirement: Wizard de 3 pasos
Crear/editar flujo SHALL usar wizard: Datos → Cuando → Entonces.

#### Scenario: Crear flujo completo
- **GIVEN** un admin en `/flujos/new`
- **WHEN** completa los 3 pasos y guarda
- **THEN** el flujo queda activo

### Requirement: Probar acción
Cada acción SHALL tener botón «Probar». Notificación y email se envían al usuario actual; Telegram se envía al chat configurado. En todos los casos usa datos de ejemplo y no registra una corrida.

#### Scenario: Probar notificación
- **GIVEN** un admin editando un flujo
- **WHEN** presiona «Probar» en una acción de notificación
- **THEN** recibe una notificación in-app con variables de ejemplo

#### Scenario: Probar Telegram
- **GIVEN** un admin editando una acción Telegram con chat configurado
- **WHEN** presiona «Probar»
- **THEN** el mensaje de ejemplo se envía a ese chat
- **AND** no se registra una corrida del flujo

### Requirement: Canvas de flujo
El flujo guardado SHALL visualizarse como canvas read-only.

#### Scenario: Ver canvas
- **GIVEN** un flujo guardado
- **WHEN** un admin navega a `/flujos/{id}`
- **THEN** ve el canvas con nodos de trigger y acciones

### Requirement: Template variables
Título y cuerpo SHALL autocompletar `{{variables}}` al escribir `{`.

#### Scenario: Autocompletar variable
- **GIVEN** un admin editando el cuerpo de una acción
- **WHEN** escribe `{`
- **THEN** aparece lista de variables disponibles
