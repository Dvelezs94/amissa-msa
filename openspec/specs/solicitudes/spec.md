# Solicitudes Públicas

## Purpose
Especifica el comportamiento del dominio solicitudes en MSA.

## Requirements

### Requirement: Formulario público de orden
Ruta pública `/orden` para crear solicitudes de mantenimiento sin autenticación. `/solicitud` redirige a `/orden`. API: `POST /api/solicitud` (crear), `GET /api/solicitud` (consultar por folio o por email de contacto).

#### Scenario: Crear solicitud pública
- GIVEN un usuario sin autenticación
- WHEN llena el formulario en `/orden` y lo envía
- THEN se crea una solicitud con folio de consulta

#### Scenario: Consultar solicitud por folio
- GIVEN un folio válido
- WHEN se consulta en `/orden/consultar`
- THEN se muestra el estado actual de la solicitud

#### Scenario: Consultar por email de contacto
- GIVEN órdenes públicas creadas con un email de contacto
- WHEN se busca ese email en `/orden/consultar`
- THEN se listan esas órdenes para abrir el detalle por folio
