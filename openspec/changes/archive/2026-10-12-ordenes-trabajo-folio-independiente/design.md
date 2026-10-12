## Context

Hoy `work_orders.folio` es un entero único para todos los `kind`, y `computeNextWorkOrderFolio` en `lib/work-order-folio-helpers.ts` toma el máximo global con piso 2000. Lo usan `POST /api/work-orders`, `POST /api/solicitud`, la creación desde calendario (`kind: routine`) y la conversión en `app/api/requests/[id]/route.ts`. La consulta pública (`lib/public-order-lookup.ts`) solo acepta un entero. El alta autenticada ya existe en `/tareas/new` con el botón «Nueva tarea» y siempre guarda `on_demand`. See proposal.md for motivation.

## Goals / Non-Goals

**Goals:**

- Dos contadores: `OT-n` para `on_demand` nuevo (continúa el máximo `OT` ya guardado; si no hay, `OT-1`) y `RU-n` para rutinas, con piso 4000.
- Folios ya guardados intactos (número, `OT` y `RU`, con o sin guion). Consulta y búsqueda aceptan esas formas.
- El alta de `/tareas` se presenta como «Nueva orden de trabajo» y usa la serie `OT-`.
- Sustituir el texto visible «solicitud pública» por «orden de trabajo».

**Non-Goals:**

- No renumerar folios históricos.
- No cambiar `/api/solicitud`, el redirect `/solicitud` ni el id `solicitud.created`.
- No renombrar el módulo `/requests`.
- No agregar alta de órdenes en la app móvil.
- No abrir rutas nuevas en el middleware.

## Decisions

### 1. Folio como texto
**Decisión:** Migración `drizzle/0030_work_order_folio_text.sql`: `work_orders.folio` pasa de `integer` a `text`, con `folio::text`. Se recrea el índice único parcial (`folio IS NOT NULL`). En `lib/db/schema.ts` la columna queda `text`.
**Alternativa:** Dejar el entero y guardar el prefijo solo en pantalla. Se descarta porque dos series numéricas chocan con el índice único en cuanto `OT` llegue a un número ya usado, y el valor guardado no distinguiría el tipo.

### 2. Siguiente folio por serie
**Decisión:** `lib/work-order-folio-helpers.ts` calcula el siguiente valor a partir de la lista (o el máximo) de esa serie, sin mirar la otra.

- `on_demand`: máximo de los números en folios `OT` ya guardados (canónico `OT-n` o variante `OT12` / `ot-12`). Siguiente `OT-(max+1)`. Si no hay ninguno, `OT-1`. Los enteros legados no entran en este contador.
- `routine`: máximo de los números en folios `RU` ya guardados (canónico `RU-n` o variante `RU4000` / `ru-4000`). Siguiente `RU-` + `max(4000, max+1)`. Si no hay ninguno, o todos están por debajo de 4000, `RU-4000`. Esos `RU` bajos no se reescriben.

`getNextWorkOrderFolio(kind)` en `lib/work-order-folio.ts` filtra por `kind` antes de calcular, y al medir el máximo reconoce el prefijo de esa serie aunque el texto guardado no traiga guion o esté en minúsculas. Cada alta pide la serie de su `kind`: app, `/api/solicitud` y conversión de `/requests` piden `on_demand`; el calendario pide `routine`. Lo que ya está guardado no se actualiza.
**Alternativa:** Un solo máximo global con prefijo distinto. Se descarta porque no independiza los contadores.

### 3. Consulta y búsqueda
**Decisión:** `lib/public-order-lookup.ts` y `lib/global-search.ts` aceptan un entero ≥ 1, o un prefijo `OT` / `RU` con entero ≥ 1, con guion opcional y sin distinguir mayúsculas (`OT-12`, `ot12`, `RU-4000`, `ru4000`). La consulta se normaliza al canónico `OT-n` o `RU-n` y también busca el texto tal como está guardado, para no perder un folio viejo escrito de otra forma. La UI muestra el folio guardado, sin anteponer otro `#` cuando ya trae prefijo.
**Alternativa:** Exigir siempre el prefijo. Se descarta porque rompe folios ya entregados al público.

### 4. Alta dentro de la sesión
**Decisión:** No hay formulario nuevo. `app/(app)/tareas/WorkOrderList.tsx` y el título en `components/PageHeaderContext.tsx` dicen «Nueva orden de trabajo». `POST /api/work-orders` sigue exigiendo sesión y asigna folio `OT-n`. Técnico y calidad ya pueden entrar a `/tareas` y a `/api/work-orders` (`lib/middleware-rules.ts`); no se toca el middleware.
**Alternativa:** Embeber `/orden` dentro del shell. Se descarta porque duplica el alta que ya crea `on_demand`.

### 5. Texto «solicitud pública»
**Decisión:** Cambiar solo copy visible:

- `lib/workflows.ts`: «Orden de trabajo creada» y «Contacto del evento (orden de trabajo)». El case `solicitud.created` no se renombra.
- `app/(app)/flujos/page.tsx`
- `lib/docs-guide.ts`: título «Orden de trabajo», fila de roles «Orden de trabajo (/orden)». Slug `solicitudes` igual.
- `app/(app)/documentacion/[slug]/page.tsx` y `app/(app)/documentacion/mocks/DocsVisualMocks.tsx`: el capítulo público usa folio `OT-n`; el mock de tareas muestra `RU-n` en rutinas y `OT-n` en órdenes. El ejemplo deja de usar `MSA-2026-0042`.
- `AGENTS.md` en la misma línea de comportamiento.

Los marcadores internos de descripción (`Orden publica desde /orden`, `Solicitud externa desde /solicitud`) que usa `lib/public-web-work-order-filter.ts` no se reescriben en filas viejas: el filtro debe seguir encontrando esas órdenes.
**Alternativa:** Renombrar la API y el evento. Se descarta por flujos y enlaces ya guardados.

### 6. Móvil
**Decisión:** La app muestra `folio` como texto (`mobile/App.tsx`), incluido `OT-n` y `RU-n`. No se agrega alta. Si algún helper móvil asume que el folio es número, se ajusta para imprimir el string; si no, no hay cambio de UI móvil.

## Risks / Trade-offs

- [Comparaciones numéricas de folio en SQL o en UI] → Buscar usos de `folio` como número y tratarlo como texto; los legados siguen siendo dígitos.
- [Dos órdenes no se distinguen si alguien consulta `12` en vez de `OT-12`] → La consulta con prefijo exige `OT` o `RU`; el número solo resuelve folios legados.
- [El contador ignora el folio numérico viejo] → Es intencional: no se renumeran. `OT` sigue el máximo `OT` existente (o empieza en `OT-1`). `RU` empieza en `RU-4000` salvo que ya haya un `RU` más alto. `RU-12` se queda y se puede buscar; el siguiente es `RU-4000`.
- [Un `OT` o `RU` guardado sin guion o en minúsculas no entra al máximo] → El cálculo y la búsqueda normalizan guion y mayúsculas antes de comparar. No se reescribe la fila.
- [Copy a medias] → Lista cerrada de archivos de UI; tests del label de workflow y del parser de folio.

## Migration Plan

1. Aplicar `0030_work_order_folio_text.sql` (`npm run db:migrate`): cast a texto y recrear el índice único.
2. Desplegar la app en el mismo cambio. Lecturas de folio legado siguen válidas en cuanto la columna es texto.
3. Rollback: revertir el deploy y la migración (`text` → `integer`) solo si ningún folio `OT-` o `RU-` se ha escrito. Si ya hay prefijo, el rollback de tipo falla; en ese caso se deja la columna en texto. Los `OT` y `RU` que ya existan antes del deploy no se modifican.

## Open Questions

Ninguna. El prefijo `OT-`, el prefijo `RU-` con piso 4000, continuar el máximo ya guardado de cada prefijo, y no reescribir folios viejos quedan fijos en el proposal y en los specs.

## Archivos

**Nuevos**

- `drizzle/0030_work_order_folio_text.sql`
- Tests en `tests/unit/` para la serie de folio, el lookup público y la etiqueta de flujos (extender los existentes)

**Modificados**

- `lib/db/schema.ts`
- `lib/work-order-folio-helpers.ts`
- `lib/work-order-folio.ts`
- `lib/public-order-lookup.ts`
- `lib/global-search.ts`
- `lib/workflows.ts`
- `lib/docs-guide.ts`
- `app/api/work-orders/route.ts`
- `app/api/solicitud/route.ts`
- `app/api/maintenance-schedules/[id]/create-work-order/route.ts`
- `app/api/requests/[id]/route.ts`
- `app/(app)/tareas/WorkOrderList.tsx`
- `components/PageHeaderContext.tsx`
- `app/(app)/flujos/page.tsx`
- `app/(app)/documentacion/[slug]/page.tsx`
- `app/(app)/documentacion/mocks/DocsVisualMocks.tsx`
- `app/orden/page.tsx` y `app/orden/consultar/page.tsx` si el copy aún dice solicitud
- `AGENTS.md`
- Tests unitarios que comparan folio numérico (`tests/unit/workflows.test.ts` y los de lookup)

**Middleware:** sin rutas ni APIs nuevas. Técnico y calidad ya tienen `/tareas` y `/api/work-orders`.

**Schema:** tabla `work_orders`, columna `folio` de `integer` a `text`. Índice único parcial se conserva.
