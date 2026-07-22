-- ============================================================
-- Migración: inversiones v2
-- Coste inicial sembrado (para carteras preexistentes) + histórico de
-- valoraciones (una foto del valor por día → gráfica de evolución).
-- Pegar entero en Supabase: SQL Editor → New query → Run
-- ============================================================

-- Coste base de la posición ANTES de que empezáramos a registrar aquí.
-- Sembrado a partir de lo que muestra el bróker: coste = valor - ganancia.
-- El aportado total = coste_inicial_cents + suma de aportaciones vinculadas.
alter table public.posiciones
  add column if not exists coste_inicial_cents bigint not null default 0
    check (coste_inicial_cents >= 0);

-- Etiqueta libre: 'fondo', 'accion', 'cripto', 'otro'…
alter table public.posiciones
  add column if not exists tipo text;

-- --------------------------------------------
-- Tabla: valoraciones (histórico de valor de cada posición)
-- --------------------------------------------
create table if not exists public.valoraciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  posicion_id uuid not null references public.posiciones (id) on delete cascade,
  -- Fecha de la foto (YYYY-MM-DD). Una por día y posición.
  fecha date not null default current_date,
  valor_cents bigint not null check (valor_cents >= 0),
  created_at timestamptz not null default now(),
  unique (posicion_id, fecha)
);

create index if not exists valoraciones_posicion_fecha_idx
  on public.valoraciones (posicion_id, fecha);

-- ============================================================
-- RLS: cada usuario solo ve y toca sus propias filas
-- ============================================================
alter table public.valoraciones enable row level security;

create policy "valoraciones: acceso solo al dueño"
  on public.valoraciones for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
