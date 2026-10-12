# Spec de sesión — 2026-10-11 — Publicar ajustes de sellos para cajero

## Metadatos

| Campo | Valor |
|---|---|
| Fecha | 2026-10-11 |
| Sprint | Mantenimiento |
| Agente | Codex |
| HUs trabajadas | RN-LF16 |
| Estado | Publicación en progreso |

## Objetivo

Publicar el ajuste manual de sellos para cajero, autorizado por el usuario.

## Implementación y decisiones

Se creó /private/tmp/moveon-loyalty-release desde origin/main ff58036. Se aplicaron únicamente los cambios de permisos de fidelización y sus pruebas/documentación. El workspace original de dev conserva todo su trabajo previo.

La migración ya está aplicada en Supabase. El sitio de producción es moveon-client (2e57c722-7c81-4bdc-8d2d-342365608b11), https://moveon-client.netlify.app. Se publica el build directamente, siguiendo la sesión de producción del 2026-09-15, porque el vínculo Git/Netlify del POS requiere corrección aparte.

## Verificación

Sobre el árbol exacto de producción: typecheck, lint, 724 pruebas (83 archivos), build optimizado y git diff --check pasaron. Build tiene advertencias existentes de tamaño y dependencias CommonJS. Configuración runtime production con claves públicas del proyecto POS.

## Próximos pasos

Enviar commit a main, publicar build y verificar archivos servidos por producción.
