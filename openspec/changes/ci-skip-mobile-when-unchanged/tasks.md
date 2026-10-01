## 1. Helper de detección

- [x] 1.1 Añadir helper puro (p. ej. `lib/ci-mobile-paths.ts`) con la lista de globs/rutas móviles relevantes y una función `hasMobileRelevantChanges(paths: string[]): boolean`; verificar con tests en `tests/unit/ci-mobile-paths.test.ts` (casos: solo web, solo `mobile/`, workflow CI, vacío)
- [x] 1.2 Opcional: script CLI fino que lea lista de paths (stdin o args) y exit code 0/1 para usar desde Actions; verificar con un caso de smoke en el test o invocación local documentada

## 2. Workflow GitHub Actions

- [x] 2.1 Añadir job `changes` (o equivalente) que calcule output `mobile` usando el helper/paths-filter alineado a 1.1; verificar que el YAML valida (`actionlint` si está disponible, o revisión de sintaxis en el PR)
- [x] 2.2 Condicionar `mobile-android` con `if` (correr en `workflow_dispatch` o cuando `mobile == true`); verificar en la descripción del PR / checklist que un push web-only lo omite
- [x] 2.3 Ajustar `deploy`: `needs` + `if` que permita `mobile-android` skipped si `build` succeeded; pasos de download artifact y rsync APK solo si mobile succeeded; verificar que la condición cubre success|skipped sin correr deploy si build falló
- [x] 2.4 Excluir `downloads/` (o `downloads/android/`) del rsync del proyecto con `--delete` para que un deploy web-only no borre APKs en el servidor; verificar que el exclude está en el comando rsync del job deploy

## 3. Documentación y cierre

- [x] 3.1 Actualizar `AGENTS.md` (sección CI build output / deploy) con la regla de skip móvil y la exclusión de downloads; verificar que el texto coincide con el workflow
- [x] 3.2 Ejecutar `npm test` y confirmar verde tras los tests del helper
