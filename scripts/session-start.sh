#!/bin/bash
# session-start.sh — Inicializa el spec de sesión del día.
# Ejecutar al inicio de cada sesión de trabajo (Claude Code o Codex).

set -e

TODAY=$(date +%Y-%m-%d)
SESSIONS_DIR="docs/sessions"
TEMPLATE="$SESSIONS_DIR/_TEMPLATE.md"

# Verificar que la plantilla existe
if [ ! -f "$TEMPLATE" ]; then
  echo "ERROR: No se encontró la plantilla en $TEMPLATE"
  echo "Asegúrate de estar en la raíz del repositorio."
  exit 1
fi

# Buscar spec del día
EXISTING=$(ls "$SESSIONS_DIR"/${TODAY}-*.md 2>/dev/null | head -1)

if [ -n "$EXISTING" ]; then
  echo "✓ Spec de sesión de hoy ya existe: $EXISTING"
  echo ""
  echo "--- Resumen del spec actual ---"
  # Mostrar metadatos y próximos pasos
  grep -A 20 "^## Metadatos" "$EXISTING" | head -12 || true
  echo ""
  grep -A 10 "^## 7\. Próximos pasos" "$EXISTING" | head -8 || true
  echo "--- Fin del resumen ---"
  exit 0
fi

# No existe — pedir el tema al agente
echo ""
echo "⚠️  No existe spec de sesión para hoy ($TODAY)."
echo ""
echo "Crea el spec antes de continuar:"
echo ""
echo "  cp $TEMPLATE $SESSIONS_DIR/$TODAY-<tema>.md"
echo ""
echo "Reemplaza <tema> con una descripción corta en kebab-case de lo que harás hoy."
echo "Ejemplo: $TODAY-auth-login, $TODAY-productos-crud, $TODAY-inventory-movements"
echo ""
echo "Después llena: Metadatos (Sprint, HUs, Estado) y el Objetivo de la sesión."
echo ""
exit 1
