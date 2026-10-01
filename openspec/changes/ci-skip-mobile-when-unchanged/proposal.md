## Why

Every push to `main` currently runs the full Android APK job and syncs `downloads/android/` to production, even when the commit only touches the web app. That wastes CI minutes, slows deploys, and republishes a new APK/`version.json` when nothing in `mobile/` changed—nudging in-app update checks without a real mobile release.

## What Changes

- Detect whether the commit (or PR diff) includes mobile-relevant paths before running the Android job.
- Skip **Build Android APK (Expo)** when there are no mobile changes (unless the run was started via `workflow_dispatch` with an explicit force, or the change also touches the mobile CI path itself).
- Allow **Deploy over SSH** to succeed with web-only deploy when the mobile job was skipped: still rsync the web project and restart Docker Compose; **do not** download/rsync APK artifacts or overwrite server `downloads/android/`.
- Keep mobile unit tests + APK build + APK deploy when `mobile/**` (or agreed related paths) changed.
- Document the path rules in AGENTS.md so agents know web-only merges skip mobile CI/deploy.

## Capabilities

### New Capabilities
- `ci-cd`: GitHub Actions CI/CD rules for when web vs mobile jobs run and what production deploy publishes.

### Modified Capabilities
- `mobile`: Clarify that production APK/`version.json` updates only when a mobile-relevant CI run builds and deploys them (not on every web-only main deploy).

## Impact

- `.github/workflows/cicd.yml` — path filter / conditional jobs; deploy `needs`/`if` so skipped mobile does not block web deploy; conditional APK download/rsync.
- Production server: existing APK and `version.json` remain until the next mobile-relevant deploy.
- No app runtime code changes (web or Expo) unless docs only.
- Mobile app binary and in-app updater behavior unchanged for users when only the web app ships.
- Agents: update AGENTS.md CI/deploy notes.

### Roles afectados
Ninguno a nivel de permisos de producto (admin / técnico / calidad). Afecta operadores de CI/CD y el ritmo de publicación del APK para técnicos en Android.

### Migración de base de datos
No.

### App móvil
No cambia código Expo. Solo deja de reconstruir/publicar APK en deploys sin cambios bajo `mobile/` (y rutas CI acordadas).
