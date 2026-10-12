## Why

Órdenes de trabajo y rutinas comparten una sola secuencia de folio (desde 2000). Crear una rutina consume el siguiente número de una orden, y el folio no dice de qué tipo es. Además, el alta pública sigue nombrada «solicitud pública» aunque el producto ya la trata como orden de trabajo, y quien ya inició sesión no tiene un alta etiquetada así dentro de la app.

## What Changes

- Secuencias de folio independientes. Las órdenes de trabajo (`on_demand`) nuevas usan `OT-n` (piso 1, o el máximo `OT-` ya guardado + 1). Las rutinas (`routine`) nuevas usan `RU-n` con piso 4000 (o el máximo `RU-` ya guardado + 1, si es mayor).
- Los folios ya emitidos no se reescriben: ni el número legado (`2044`), ni un `OT-` o `RU-` que ya exista (también `OT12` / `RU4000`, cualquier mayúscula). Consulta y búsqueda siguen encontrándolos.
- Quien tiene sesión (admin, técnico, calidad) crea una orden de trabajo desde `/tareas` («Nueva orden de trabajo»). El formulario público `/orden` sigue para quien no tiene sesión.
- El texto visible «solicitud pública» pasa a «orden de trabajo» (flujos, documentación, ayudas). No cambian la ruta `/api/solicitud`, el redirect `/solicitud` ni el id de evento `solicitud.created`.
- El módulo interno `/requests` (solicitudes que se convierten a tarea) no se renombra: no es la solicitud pública.

## Capabilities

### New Capabilities

### Modified Capabilities

- `tareas`: Folio `OT-` para órdenes de trabajo y `RU-` desde 4000 para rutinas, sin reescribir los `OT`/`RU` ni los números que ya existen. Alta de orden de trabajo dentro de la sesión.
- `solicitudes`: El formulario público y su consulta se presentan como orden de trabajo; dejan de decir «solicitud pública».
- `flujos`: La etiqueta del trigger de alta pública pasa a «orden de trabajo». El id `solicitud.created` se conserva.
- `documentacion`: La guía deja de llamar «solicitud pública» a esa orden.

## Impact

- **Web:** alta en `/tareas`, formulario `/orden`, consulta, búsqueda, tablero, flujos y `/documentacion`.
- **Lib:** `lib/work-order-folio-helpers.ts`, `lib/work-order-folio.ts`, `lib/public-order-lookup.ts`, `lib/global-search.ts`, `lib/workflows.ts`, `lib/docs-guide.ts`.
- **API:** `POST /api/work-orders`, `POST /api/solicitud`, creación desde calendario y conversión desde `/requests` deben pedir el folio de la serie que corresponde al `kind`.
- **Móvil:** muestra el folio tal cual (`OT-n`, `RU-n` o el número legado). No agrega pantalla de alta.
- **Migración:** sí. `work_orders.folio` pasa de entero a texto para convivir `OT-n`, `RU-n` y folios legados (`2044`). Índice único se conserva sobre ese valor. No se reescriben filas.

## Roles afectados

- **Admin, técnico y calidad:** crean órdenes de trabajo dentro de la app. Las órdenes nuevas se ven como `OT-` y las rutinas nuevas como `RU-`.
- **Público (sin sesión):** sigue creando y consultando en `/orden`; el folio nuevo es `OT-n` y los folios viejos siguen válidos.
- **Calidad:** no gana rutas nuevas; ya entra a `/tareas`. El alta interna queda disponible para ese rol igual que para técnico.
