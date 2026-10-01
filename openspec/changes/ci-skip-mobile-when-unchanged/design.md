## Context

El workflow `.github/workflows/cicd.yml` tiene tres jobs en serie lógica: `build` (web tests + Docker Compose), `mobile-android` (tests Expo + APK + artifact), y `deploy` con `needs: [build, mobile-android]`. Hoy `deploy` siempre descarga el artifact `android-apk` y hace rsync a `/var/www/msa/downloads/android/`. En GitHub Actions, si un job en `needs` está `skipped`, el job dependiente también se salta a menos que se use una condición `if` que acepte `skipped`.

No hay migración de DB ni cambios de middleware/API de producto.

## Goals / Non-Goals

**Goals:**
- Omitir build/test/APK móvil cuando el diff no toca rutas móviles relevantes.
- Permitir deploy web en `main` aunque el job móvil esté skipped.
- No sobrescribir APK/`version.json` en el servidor en deploys web-only.
- Documentar la regla en AGENTS.md.

**Non-Goals:**
- Separar workflows distintos (web vs mobile) en archivos diferentes (opcional futuro).
- Cambiar el actualizador in-app, Expo, o la API de versionado.
- Saltar tests web cuando solo cambia mobile (el job `build` sigue corriendo siempre, salvo decisión futura).
- Optimizar Docker Compose CI del job web.

## Decisions

### 1. Path filter con job intermedio
Usar un job ligero `changes` (p. ej. `dorny/paths-filter` o `git diff` contra base) que exponga un output booleano `mobile`.

**Rutas móviles relevantes (iniciales):**
- `mobile/**`
- `.github/workflows/cicd.yml` (cambios al propio pipeline que afectan el job móvil)

Alternativa descartada: `on.push.paths` a nivel workflow — eso saltaría todo el CI web si solo cambia mobile o viceversa; queremos jobs condicionales, no filtrar el workflow entero.

### 2. Condición del job `mobile-android`
```yaml
if: github.event_name == 'workflow_dispatch' || needs.changes.outputs.mobile == 'true'
```
`workflow_dispatch` siempre puede construir APK (operador fuerza release móvil sin diff). En PRs/push, solo si `mobile == true`.

### 3. Condición del job `deploy`
Solo en `push` a `main` (comportamiento actual implícito vía environment; mantener/clarificar). Condición:
```yaml
if: always() && needs.build.result == 'success' && (needs.mobile-android.result == 'success' || needs.mobile-android.result == 'skipped')
```
y `needs: [build, mobile-android]` (más `changes` si aplica).

Pasos de download artifact + rsync APK: `if: needs.mobile-android.result == 'success'`.

### 4. Tests unitarios del cambio
Extraer la lógica de “¿es cambio móvil?” / “¿debe correr deploy web con mobile skipped?” a un helper puro pequeño (p. ej. `lib/ci-mobile-gate.ts` o script bajo `scripts/`) **solo si** se implementa con shell reutilizable testeable; si la lógica vive solo en YAML de Actions, documentar validación manual + checklist en tasks y un test mínimo del parser de paths si se añade un script. Preferencia: script/helper con lista de globs y tests en `tests/unit/` para no depender solo de YAML.

### 5. Archivos tocados
| Archivo | Cambio |
|---------|--------|
| `.github/workflows/cicd.yml` | Job `changes`, `if` en mobile/deploy, pasos APK condicionales |
| Helper + test (si aplica) | Lista de paths / decisión gate |
| `AGENTS.md` | Documentar skip móvil en CI |

## Risks / Trade-offs

| Riesgo | Mitigación |
|--------|------------|
| Cambio en API web rompe mobile pero CI móvil no corre | Aceptado a corto plazo; PRs que toquen contratos compartidos críticos pueden forzar `workflow_dispatch` o tocar un archivo sentinel; documentar |
| `dorny/paths-filter` en `pull_request` vs `push` base incorrecta | Usar base `github.event.pull_request.base.sha` / `before` documentado |
| Deploy se salta por mal `if` | Escenarios de validación en PR de prueba; revisar UI de Actions |
| Rsync `--delete` del proyecto no borra APK en servidor | APK vive fuera del tree rsync del repo o en path que el rsync del código no vacía; confirmar que `downloads/android` en el checkout vacío no borre el remoto — el rsync del proyecto usa `--delete`; si el repo no incluye APKs, podría **borrar** archivos en el servidor bajo un `downloads/` trackeado. Verificar layout: artifact se copia en paso aparte a `DEPLOY_APK_PATH`; el rsync del proyecto podría incluir `downloads/` vacío del checkout. **Diseño:** excluir `downloads/android/` del rsync del proyecto si aún no está, o no usar `--delete` sobre esa ruta, para que un deploy web-only no limpie APKs por un directorio vacío local. |
