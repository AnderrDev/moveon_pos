# ADR 0004 — PWA responsive (no apps nativas)

**Fecha:** 2026-04-25
**Estado:** Aceptado
**Decisores:** Equipo MOVEONAPP

## Contexto

El usuario operará el POS en distintos dispositivos según la situación: computador de escritorio, laptop, tablet. Tres opciones:

1. **App nativa móvil** (React Native, Flutter) + web.
2. **App de escritorio** (Electron) + web.
3. **PWA web responsive única.**

## Decisión

Construimos **una sola PWA responsive** con Next.js. Puede instalarse en escritorio y tablet desde el navegador.

## Consecuencias

### Positivas
- Una sola base de código.
- Despliegue único en Vercel — actualización inmediata para todos los usuarios.
- Funciona offline parcial (con service worker).
- Instalable en home screen / barra de tareas.
- 1 desarrollador puede mantenerla.

### Negativas
- Acceso limitado a hardware nativo (escáner USB sí funciona como teclado, impresora térmica vía navegador o servicio local).
- Sin notificaciones push avanzadas en iOS (limitación de Safari).
- Performance puede ser inferior a nativa en tablets viejas.

### Reglas derivadas
- El layout debe funcionar bien en pantallas desde 1024px (laptop) hasta 1920px (escritorio).
- Soporte tablet (768px+) en Sprint 4.
- No optimizamos para móvil < 768px en MVP.
- La impresión usa `window.print()` con CSS específico para 80mm en MVP. Integración ESC/POS directa va post-MVP.
