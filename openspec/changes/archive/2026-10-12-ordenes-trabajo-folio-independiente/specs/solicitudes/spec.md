## MODIFIED Requirements

### Requirement: Formulario público de orden
La ruta pública `/orden` SHALL servir para crear una orden de trabajo sin autenticación. `/solicitud` SHALL seguir redirigiendo a `/orden`. La API SHALL seguir siendo `POST /api/solicitud` (crear) y `GET /api/solicitud` (consultar por folio o por email de contacto), en `app/api/solicitud/route.ts` y `app/orden/`. El texto visible SHALL decir «orden de trabajo» y SHALL NOT decir «solicitud pública». Una orden nueva creada aquí SHALL recibir folio `OT-n`, continuando el máximo `OT` ya guardado. La consulta SHALL aceptar el canónico `OT-n`, la variante sin guion o en otra mayúscula (`ot12`, `OT-12`) y un folio numérico legado.

#### Scenario: Crear solicitud pública
- **GIVEN** un usuario sin autenticación
- **WHEN** llena el formulario en `/orden` y lo envía
- **THEN** se crea una orden de trabajo con folio `OT-n`
- **AND** la confirmación muestra ese folio y no dice «solicitud pública»

#### Scenario: Consultar solicitud por folio
- **GIVEN** un folio válido `OT-12`, la variante `ot12`, o un folio numérico legado `2044`
- **WHEN** se consulta en `/orden/consultar`
- **THEN** se muestra el estado actual de esa orden de trabajo

#### Scenario: Consultar por folio numérico legado
- **GIVEN** una orden pública ya existente con folio `2044`
- **WHEN** se consulta `2044` en `/orden/consultar`
- **THEN** se muestra el estado actual de esa orden

#### Scenario: Consultar por email de contacto
- **GIVEN** órdenes públicas creadas con un email de contacto
- **WHEN** se busca ese email en `/orden/consultar`
- **THEN** se listan esas órdenes para abrir el detalle por folio
