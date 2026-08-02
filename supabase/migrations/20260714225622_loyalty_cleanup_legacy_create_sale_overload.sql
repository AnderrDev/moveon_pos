-- Limpieza post-loyalty (2026-07-14):
-- 1. Elimina el overload legacy de create_sale_atomic de 12 argumentos
--    (anterior a 20260615_001 discount_traceability) que quedó huérfano en el
--    remoto. Era código muerto peligroso: permitía crear ventas sin la
--    validación de descuentos ni fidelización.
-- 2. El RPC vigente no debe ser ejecutable por anon.

drop function if exists public.create_sale_atomic(
  uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb
);

revoke execute on function public.create_sale_atomic(
  uuid, uuid, text, uuid, uuid, numeric, numeric, numeric, numeric, text, jsonb, jsonb, numeric, text, jsonb
) from public, anon;

revoke execute on function public.adjust_loyalty_stamps(uuid, uuid, int, text, uuid) from public, anon;
