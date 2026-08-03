-- ============================================================
-- Migración: pendientes (deudas, cobros y recordatorios)
-- 'cobro' = me deben · 'pago' = yo debo · 'tarea' = nota/recordatorio.
-- Con fecha opcional y avisos por Telegram configurables (recordar_dias).
-- Pegar entero en Supabase: SQL Editor → New query → Run
-- ============================================================

create table if not exists public.pendientes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  tipo text not null check (tipo in ('cobro', 'pago', 'tarea')),
  concepto text not null,
  persona text,
  importe_cents bigint check (importe_cents is null or importe_cents >= 0),
  -- Fecha del cobro/pago/evento (opcional)
  fecha date,
  -- Días antes de 'fecha' en que avisar (ej. {1,0} = víspera y el mismo día)
  recordar_dias int[],
  hecho boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists pendientes_user_idx
  on public.pendientes (user_id, hecho, fecha);

alter table public.pendientes enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'pendientes'
      and policyname = 'pendientes: acceso solo al dueño'
  ) then
    create policy "pendientes: acceso solo al dueño"
      on public.pendientes for all
      using (auth.uid() = user_id)
      with check (auth.uid() = user_id);
  end if;
end $$;
