# ADR 0001 — Stack Supabase + Next.js

**Fecha:** 2026-04-25
**Estado:** Aceptado
**Decisores:** Equipo MOVEONAPP

## Contexto

Necesitamos elegir un stack de backend para el POS. Las opciones consideradas fueron:

1. **Next.js full-stack + Supabase** (PostgreSQL + Auth + Storage gestionados).
2. **Next.js + NestJS + PostgreSQL** auto-gestionado (VPS).
3. **Laravel + Filament** (monolito tradicional).
4. **Firebase** (Google).

Criterios:
- Costo operativo bajo (objetivo principal del proyecto).
- 1 desarrollador, debe poder mantenerse solo.
- TypeScript en todo el stack.
- Compatibilidad con agentes IA (Claude Code, Codex).
- Escalable a multi-sede sin reescritura.

## Decisión

Usamos **Next.js 15 (App Router) full-stack + Supabase** (PostgreSQL + Auth + RLS + Storage + Edge Functions).

## Consecuencias

### Positivas
- Costo inicial cercano a $0 (planes gratuitos).
- Escalado managed: no administramos servidores.
- TypeScript end-to-end con tipos generados automáticamente desde la DB.
- RLS sustituye gran parte de la lógica de autorización backend.
- Comunidad grande, documentación abundante (los agentes IA lo conocen bien).
- Backups automáticos en plan Pro.

### Negativas
- Vendor lock-in con Supabase (mitigado: PostgreSQL es estándar, migración posible).
- Edge Functions usan Deno (otro runtime que aprender, aunque casi no las usaremos en MVP).
- Plan gratuito tiene límites (8 GB DB, 100k MAU). Para producción usaremos Pro.

### Mitigaciones
- Encapsular acceso a Supabase en repositorios. Si en el futuro migramos, solo cambian las implementaciones.
- No usar features propietarias de Supabase que no sean PostgreSQL estándar (Realtime, Vault) sin justificación documentada.
