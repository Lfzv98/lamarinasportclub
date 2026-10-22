-- Esquema mínimo para que los endpoints funcionen con Supabase sin tocar
-- las tablas existentes de PadelReserve. Juan puede reemplazarlo por un
-- mapeo a tablas normalizadas editando lib/server/repository.ts.

create table if not exists public.americanos_eventos (
  id             text primary key,
  data           jsonb not null,            -- EventoAmericano completo (types/americano.ts)
  estado         text not null default 'BORRADOR',
  actualizado_en timestamptz not null default now()
);
create index if not exists americanos_eventos_actualizado_idx on public.americanos_eventos (actualizado_en desc);

create table if not exists public.club_config (
  id   text primary key,                     -- 'la-marina'
  data jsonb not null                        -- ConfigClub (pistas, horarios, contacto)
);

-- Los endpoints usan la service role key desde el servidor; no se expone al navegador.
alter table public.americanos_eventos enable row level security;
alter table public.club_config enable row level security;
