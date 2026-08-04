-- =====================================================
-- Nuevo tipo de producto: 'combo' (PLAN-73 / ADR 0018)
-- =====================================================
-- Un combo es un producto del catálogo con precio fijo propio que, al venderse,
-- consume otros productos vía `product_components` — el mismo mecanismo que ya
-- usan los batidos (`prepared`). No rastrea stock propio.
--
-- Va SOLO en esta migración a propósito: Postgres no permite usar un valor de
-- enum recién agregado dentro de la misma transacción que lo agrega, y el CLI
-- de Supabase corre cada archivo en una transacción. El resto de los cambios
-- vive en 20260803200100_combo_support.sql.

alter type public.product_type add value if not exists 'combo';
