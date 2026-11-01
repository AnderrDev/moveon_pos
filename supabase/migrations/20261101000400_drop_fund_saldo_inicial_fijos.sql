-- =====================================================
-- ADR 0025 simplificado (2026-11-01): sin sobre de fijos
-- =====================================================
-- El dueño pidió que el asistente solo separe la plata de la mercancía de la
-- utilidad: los gastos se restan cuando se registran, sin apartar arriendo y
-- nómina por día. El saldo inicial de fijos deja de existir.
-- =====================================================

alter table public.reinvestment_fund_settings
  drop column if exists saldo_inicial_fijos;
