## ADDED Requirements

### Requirement: Publicación de APK solo con cambios móviles
La publicación en producción de `msa-release.apk` y `version.json` SHALL ocurrir solo cuando el pipeline CI/CD construye el APK por un cambio móvil relevante (o un disparo manual que fuerce el build), no en cada deploy exclusivo de la web.

#### Scenario: Deploy web-only no cambia versión publicada
- **GIVEN** un técnico con la app instalada y una `version.json` ya publicada en el servidor
- **WHEN** se despliega solo la web sin rebuild móvil
- **THEN** la app sigue viendo la misma versión remota (sin bump artificial de `versionName`/`versionCode`)

#### Scenario: Deploy con móvil actualiza manifiesto
- **GIVEN** un cambio bajo rutas móviles relevantes mergeado a `main`
- **WHEN** el pipeline construye y despliega el APK
- **THEN** el servidor actualiza APK y `version.json` y el actualizador in-app puede detectar la nueva versión
