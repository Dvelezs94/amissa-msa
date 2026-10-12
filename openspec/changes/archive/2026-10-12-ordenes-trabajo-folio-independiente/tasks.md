## 1. Folio por serie

- [x] 1.1 Agregar `drizzle/0030_work_order_folio_text.sql` y cambiar `work_orders.folio` a `text` en `lib/db/schema.ts`, conservando el índice único parcial. Verificar que el SQL castea los enteros existentes a texto y recrea el índice
- [x] 1.2 Partir el cálculo en `lib/work-order-folio-helpers.ts`: `OT-` para `on_demand` (siguiente al máximo `OT` ya guardado, o `OT-1`) y `RU-` para rutinas con piso 4000 (o el máximo `RU` + 1 si ya pasa de 4000). Reconocer variantes sin guion y en otra mayúscula al medir el máximo, sin reescribirlas. Actualizar tests en `tests/unit/misc-helpers.test.ts` (o un test nuevo) y verificar serie independiente, `RU-4000` cuando el `RU` existente es menor, `RU-4103` si ya existe `RU-4102`, y que un folio numérico no entra a ningún contador
- [x] 1.3 Hacer que `getNextWorkOrderFolio(kind)` filtre por `kind`. Usarlo en `POST /api/work-orders`, `POST /api/solicitud`, la creación desde calendario y la conversión en `app/api/requests/[id]/route.ts`. Verificar en tests del helper que una orden nueva no avanza el folio `RU` y una rutina nueva no avanza el folio `OT`

## 2. Consulta, búsqueda y alta en sesión

- [x] 2.1 Aceptar `OT` y `RU` (con o sin guion, cualquier mayúscula) y el folio numérico legado en `lib/public-order-lookup.ts` y `lib/global-search.ts`. Extender `tests/unit/public-order-lookup.test.ts` y `tests/unit/global-search.test.ts` y verificar que `ot12` se interpreta como `OT-12`, `ru-4000` como `RU-4000`, y que `2044` sigue siendo válido
- [x] 2.2 Renombrar el botón y el título de `/tareas/new` a «Nueva orden de trabajo» (`WorkOrderList.tsx`, `PageHeaderContext.tsx`). Verificar que el alta sigue en `/tareas/new`, guarda `on_demand` y no agrega rutas
- [x] 2.3 Confirmar que `middleware.ts` y `lib/middleware-rules.ts` no cambian: técnico y calidad ya entran a `/tareas` y `/api/work-orders`. Verificar con una lectura del diff que no hay prefijos nuevos

## 3. Texto «orden de trabajo»

- [x] 3.1 Cambiar etiquetas en `lib/workflows.ts` a «Orden de trabajo creada» y «Contacto del evento (orden de trabajo)» sin renombrar `solicitud.created`. Actualizar `tests/unit/workflows.test.ts` y verificar que el id del trigger sigue igual
- [x] 3.2 Sustituir «solicitud pública» en `app/(app)/flujos/page.tsx`, `lib/docs-guide.ts`, `app/(app)/documentacion/[slug]/page.tsx` y el mock de tareas en `DocsVisualMocks.tsx` (rutinas `RU-n` desde 4000, órdenes `OT-n`). El slug `solicitudes` se queda. Verificar que una búsqueda en esas pantallas ya no encuentra «solicitud pública» y que el mock distingue `RU-` de `OT-`
- [x] 3.3 Revisar `app/orden/page.tsx` y `app/orden/consultar/page.tsx` y alinear el copy visible con «orden de trabajo» si aún dice solicitud. Verificar el texto del formulario y de la consulta
- [x] 3.4 No reescribir los marcadores de `lib/public-web-work-order-filter.ts` ni renombrar `/requests`. Verificar que el filtro sigue mencionando los marcadores actuales

## 4. Cierre

- [x] 4.1 Actualizar `AGENTS.md`: folio `OT-` para órdenes y `RU-` desde 4000 para rutinas, sin reescribir `OT`/`RU` ni números ya guardados; alta «Nueva orden de trabajo» dentro de la sesión; trigger de flujos como orden de trabajo. Verificar que el párrafo describe ese comportamiento
- [x] 4.2 Si la app móvil formatea el folio como número, ajustarla para mostrar el texto `OT-n` y `RU-n` y cubrirlo con test en `mobile/tests/unit/`. Si ya imprime el string, dejar el móvil sin cambio y anotarlo. Verificar el tipo de `folio` en `mobile/App.tsx`
- [x] 4.3 Ejecutar `npm test` y, si hubo cambio en `mobile/`, `cd mobile && npm test`. Verificar que ambos quedan en verde
