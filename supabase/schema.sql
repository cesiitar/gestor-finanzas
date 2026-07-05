-- ============================================================
-- Gestor de finanzas — esquema inicial
-- Pegar entero en Supabase: SQL Editor → New query → Run
-- ============================================================

-- --------------------------------------------
-- Tabla: categorias
-- --------------------------------------------
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  tipo text not null check (tipo in ('ingreso', 'gasto', 'inversion')),
  -- Presupuesto mensual opcional, en céntimos (entero, nunca float)
  presupuesto_mensual_cents bigint check (presupuesto_mensual_cents >= 0),
  created_at timestamptz not null default now()
);

-- --------------------------------------------
-- Tabla: posiciones (cartera de inversión)
-- --------------------------------------------
create table public.posiciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  nombre text not null,
  -- Valor actual de la posición en céntimos; lo actualiza el usuario a mano.
  -- Lo aportado NO se guarda: se deriva de los movimientos vinculados.
  valor_actual_cents bigint not null default 0 check (valor_actual_cents >= 0),
  created_at timestamptz not null default now()
);

-- --------------------------------------------
-- Tabla: movimientos
-- --------------------------------------------
create table public.movimientos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Fecha sin hora ni timezone (YYYY-MM-DD), editable por el usuario
  fecha date not null default current_date,
  tipo text not null check (tipo in ('ingreso', 'gasto', 'inversion')),
  -- Referencia por id, no por nombre: renombrar categoría no rompe el histórico.
  -- RESTRICT: borrar una categoría con movimientos falla; la app ofrece reasignar antes.
  categoria_id uuid not null references public.categorias (id) on delete restrict,
  concepto text not null default '',
  -- Importe en céntimos, entero. Siempre positivo; el signo lo da el tipo.
  importe_cents bigint not null check (importe_cents > 0),
  -- Solo para tipo 'inversion'; si se borra la posición, el movimiento queda sin vincular
  posicion_id uuid references public.posiciones (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Índices para las consultas habituales (listados por mes y por categoría)
create index movimientos_user_fecha_idx on public.movimientos (user_id, fecha desc);
create index movimientos_categoria_idx on public.movimientos (categoria_id);
create index movimientos_posicion_idx on public.movimientos (posicion_id);

-- ============================================================
-- RLS: cada usuario solo ve y toca sus propias filas
-- ============================================================
alter table public.categorias enable row level security;
alter table public.posiciones enable row level security;
alter table public.movimientos enable row level security;

create policy "categorias: acceso solo al dueño"
  on public.categorias for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "posiciones: acceso solo al dueño"
  on public.posiciones for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "movimientos: acceso solo al dueño"
  on public.movimientos for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
