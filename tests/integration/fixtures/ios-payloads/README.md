# Payloads de escritura de la app iOS (ADR 0022 §4)

Cada archivo es **exactamente** lo que la app "MOVE ON Admin" envía al servidor en
una escritura. Es el contrato entre los dos repos:

- `tests/integration/ios-payloads.contract.test.ts` (este repo) envía el payload al
  Supabase LOCAL y verifica su efecto (movimiento, stock, venta, auditoría).
- Los tests Swift de `moveon-owner-ios` verifican que la app produce el mismo JSON.
  Allá hay una copia en `MoveOnOwnerTests/Fixtures/Payloads/`; este repo es la fuente
  y `scripts/sync_payload_fixtures.sh` (repo iOS) la copia o la compara (`--check`).

## Formato

```json
{
  "description": "Qué escritura es y desde qué pantalla",
  "kind": "rpc",                       // "rpc" → supabase.rpc(target, payload)
                                       // "insert" → supabase.from(target).insert(payload)
                                       // "update" → supabase.from(target).update(payload).match(match)
  "target": "register_inventory_entry_atomic",
  "payload": { "p_tienda_id": "{{tienda_id}}", "p_cantidad": 12 }
}
```

- `match` (solo en `update`): las columnas que identifican la fila.
- Los valores que cambian en cada corrida (ids, correo) van como marcadores
  `"{{nombre}}"`; ambos lados los reemplazan por sus propios valores antes de
  comparar o enviar.
- Todo lo demás es literal: tipos JSON incluidos (`12` no es `"12"`, `null` no es
  ausencia de la clave).
- Un fixture nuevo necesita su caso en el test de contrato; el test falla si hay un
  archivo sin cubrir.
