## Purpose

Define cuándo el pipeline de GitHub Actions construye y publica el APK Android frente a un deploy solo de la aplicación web.

## ADDED Requirements

### Requirement: Detección de cambios móviles en CI
El workflow de CI/CD SHALL determinar si el evento incluye cambios relevantes para la app móvil antes de ejecutar el job de build Android.

#### Scenario: Push o PR solo web
- **GIVEN** un evento `push` a `main` o un `pull_request` cuyos archivos tocados no incluyen rutas móviles relevantes
- **WHEN** corre el workflow CI/CD
- **THEN** el job de build Android (tests móviles, prebuild Expo, APK) se omite

#### Scenario: Push o PR con cambios en mobile
- **GIVEN** un evento cuyos archivos tocados incluyen `mobile/**` (u otras rutas móviles relevantes definidas en el diseño)
- **WHEN** corre el workflow CI/CD
- **THEN** el job de build Android se ejecuta (tests + APK)

#### Scenario: Disparo manual
- **GIVEN** un `workflow_dispatch`
- **WHEN** el operador inicia el workflow (con la opción de forzar móvil si el diseño la expone; por defecto se permite build móvil)
- **THEN** el pipeline MAY construir y publicar el APK aunque el diff no toque `mobile/`

### Requirement: Deploy web sin republicar APK
Cuando el job móvil se omite, el deploy a producción SHALL publicar solo la aplicación web y MUST NOT sobrescribir los artefactos Android ya publicados en el servidor.

#### Scenario: Deploy main solo web
- **GIVEN** un push a `main` sin cambios móviles relevantes y el job de build Android omitido con éxito (skipped)
- **WHEN** corre el job de deploy SSH
- **THEN** se sincroniza el proyecto web, se reinicia Docker Compose y se aplican migraciones/push de schema según el flujo actual
- **AND** no se descarga ni se rsync de un nuevo APK/`version.json` hacia `downloads/android` en el servidor
- **AND** los archivos APK y `version.json` existentes en el servidor permanecen intactos

#### Scenario: Deploy main con móvil
- **GIVEN** un push a `main` con cambios móviles relevantes y el job Android exitoso
- **WHEN** corre el job de deploy SSH
- **THEN** se publica el APK y `version.json` en la ruta de downloads del servidor además del deploy web

### Requirement: Deploy no bloqueado por móvil omitido
Un job de build Android omitido (skipped) MUST NOT impedir el deploy web si el job de build/test web fue exitoso.

#### Scenario: Mobile skipped, web verde
- **GIVEN** el job web (`build`) terminó en éxito y el job Android está skipped
- **WHEN** se evalúan las dependencias del job deploy
- **THEN** el deploy web se ejecuta
