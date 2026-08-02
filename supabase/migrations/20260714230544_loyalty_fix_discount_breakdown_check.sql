-- Fix detectado por la batería E2E del 2026-07-14: el check de desglose de
-- descuentos (20260615_001) no conocía el componente de canje MOVE ON Club.
-- Regla actualizada: discount_total = item + global + loyalty.

alter table public.sales
  drop constraint if exists sales_discount_breakdown_check,
  add constraint sales_discount_breakdown_check check (
    discount_total = (item_discount_total + global_discount_total + loyalty_discount_total)
    and item_discount_total >= 0
    and global_discount_total >= 0
  );
