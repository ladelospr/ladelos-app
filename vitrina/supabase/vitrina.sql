-- ============================================================
-- LADELOS Control de Vitrina — Fase 2 (tablas nuevas, no toca las existentes)
-- Ejecutar una vez en Supabase → SQL Editor. Se puede volver a ejecutar sin daño.
-- ============================================================

create table if not exists public.vitrina_store (
  store_id        text primary key,
  version         bigint not null default 0,
  state           jsonb  not null,
  test_offset_ms  bigint not null default 0,
  updated_at      timestamptz not null default now()
);

create table if not exists public.vitrina_members (
  store_id      text not null,
  user_id       uuid not null references auth.users(id) on delete cascade,
  role          text not null check (role in ('vitrina', 'freidora', 'ambos', 'admin')),
  display_name  text not null,
  created_at    timestamptz not null default now(),
  primary key (store_id, user_id)
);

create table if not exists public.vitrina_history (
  id         bigint generated always as identity primary key,
  store_id   text not null,
  version    bigint not null,
  at         timestamptz not null default now(),
  user_id    uuid,
  command    jsonb,
  ok         boolean not null,
  result     jsonb,
  movements  jsonb not null default '[]'::jsonb,
  audit      jsonb not null default '[]'::jsonb
);
create index if not exists vitrina_history_store_at on public.vitrina_history (store_id, at desc);

-- Aviso liviano para que los equipos sepan que hay cambios (tiempo real)
create table if not exists public.vitrina_ping (
  store_id  text primary key,
  version   bigint not null,
  at        timestamptz not null default now()
);

-- ---------- Seguridad ----------
alter table public.vitrina_store   enable row level security;
alter table public.vitrina_members enable row level security;
alter table public.vitrina_history enable row level security;
alter table public.vitrina_ping    enable row level security;

create or replace function public.vitrina_is_member(p_store text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vitrina_members where store_id = p_store and user_id = auth.uid());
$$;

create or replace function public.vitrina_is_admin(p_store text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vitrina_members where store_id = p_store and user_id = auth.uid() and role = 'admin');
$$;

drop policy if exists vitrina_ping_read on public.vitrina_ping;
create policy vitrina_ping_read on public.vitrina_ping for select to authenticated
  using (public.vitrina_is_member(store_id));

drop policy if exists vitrina_members_read on public.vitrina_members;
create policy vitrina_members_read on public.vitrina_members for select to authenticated
  using (user_id = auth.uid() or public.vitrina_is_admin(store_id));

drop policy if exists vitrina_history_read on public.vitrina_history;
create policy vitrina_history_read on public.vitrina_history for select to authenticated
  using (public.vitrina_is_admin(store_id));

-- vitrina_store no tiene políticas: la app nunca la lee ni escribe directo.
-- Todo pasa por la Edge Function "vitrina", que valida la sesión, el rol y la versión.
revoke all on public.vitrina_store   from anon, authenticated;
revoke insert, update, delete on public.vitrina_members from anon, authenticated;
revoke insert, update, delete on public.vitrina_history from anon, authenticated;
revoke insert, update, delete on public.vitrina_ping    from anon, authenticated;

-- ---------- Tiempo real ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vitrina_ping'
  ) then
    alter publication supabase_realtime add table public.vitrina_ping;
  end if;
end $$;

-- ---------- Acceso inicial: los administradores de ladelos-app ----------
insert into public.vitrina_members (store_id, user_id, role, display_name)
select s.id, p.id, 'admin', coalesce(nullif(p.nombre, ''), 'Administración')
from public.profiles p
cross join (values ('bayamon'), ('bayamon-prueba')) as s(id)
where p.rol = 'admin'
on conflict (store_id, user_id) do nothing;

select store_id, display_name, role from public.vitrina_members order by store_id, display_name;
