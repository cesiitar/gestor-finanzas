-- ============================================================
-- Migración: los "fijos" pasan a cubrir gastos E ingresos
-- Una nómina o un alquiler que cobras se repiten igual que un gasto fijo,
-- así que se reutiliza la misma tabla con una columna de tipo.
-- Las filas existentes quedan como 'gasto' (que es lo que eran).
-- Pegar en Supabase: SQL Editor → New query → Run
-- ============================================================

alter table public.gastos_fijos
  add column if not exists tipo text not null default 'gasto'
    check (tipo in ('gasto', 'ingreso'));
