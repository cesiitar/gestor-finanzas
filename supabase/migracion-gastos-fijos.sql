-- ============================================================
-- Migración: gastos fijos mensuales
-- Pegar entero en Supabase: SQL Editor → New query → Run
-- ============================================================

-- Gastos que se repiten igual todos los meses (alquiler, gimnasio, Netflix…).
-- Un cron diario los convierte en movimientos automáticamente el día elegido.
create table public.gastos_fijos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  categoria_id uuid not null references public.categorias (id) on delete restrict,
  importe_cents bigint not null check (importe_cents > 0),
  -- Día del mes en que se carga (1-31; en meses cortos se ajusta al último día)
  dia_mes int not null check (dia_mes between 1 and 31),
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.gastos_fijos enable row level security;

create policy "gastos_fijos: acceso solo al dueño"
  on public.gastos_fijos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Los movimientos generados desde un gasto fijo quedan marcados con su origen
-- (permite separar fijos de variables en el dashboard y evitar duplicados)
alter table public.movimientos
  add column gasto_fijo_id uuid references public.gastos_fijos (id) on delete set null;

create index movimientos_gasto_fijo_idx on public.movimientos (gasto_fijo_id);
