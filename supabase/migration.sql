-- Cenaris Chat System — run this in Supabase SQL Editor (Sydney region ap-southeast-2)

-- Enable pgvector extension
create extension if not exists vector;

-- Conversations
create table if not exists conversations (
  id            uuid primary key default gen_random_uuid(),
  session_id    text not null unique,
  mode          text not null check (mode in ('live', 'ai', 'offline')),
  status        text not null default 'open' check (status in ('open', 'waiting', 'closed')),
  source_url    text,
  created_at    timestamptz not null default now(),
  closed_at     timestamptz
);
create index on conversations (status, created_at desc);

-- Messages
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_type     text not null check (sender_type in ('visitor', 'agent', 'ai', 'system')),
  body            text not null,
  created_at      timestamptz not null default now()
);
create index on messages (conversation_id, created_at asc);

-- Leads
create table if not exists leads (
  id                      uuid primary key default gen_random_uuid(),
  conversation_id         uuid references conversations(id) on delete set null,
  name                    text not null,
  email                   text not null,
  phone                   text,
  enquiry_type            text,
  source_url              text,
  privacy_accepted_at     timestamptz,
  marketing_opt_in        boolean not null default false,
  status                  text not null default 'new' check (status in ('new', 'contacted', 'closed')),
  notes                   text,
  created_at              timestamptz not null default now()
);
create index on leads (status, created_at desc);

-- Availability overrides (manual online/offline toggle)
create table if not exists availability_overrides (
  id          uuid primary key default gen_random_uuid(),
  status      text not null check (status in ('available', 'unavailable')),
  expires_at  timestamptz not null,
  reason      text,
  created_at  timestamptz not null default now()
);

-- Knowledge base documents
create table if not exists knowledge_chunks (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  source_url  text,
  chunk_text  text not null,
  embedding   vector(1536),
  created_at  timestamptz not null default now()
);
create index on knowledge_chunks using ivfflat (embedding vector_cosine_ops) with (lists = 50);

-- Semantic search function (used by message.js AI engine)
create or replace function match_knowledge_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  title text,
  source_url text,
  chunk_text text,
  similarity float
)
language sql stable
as $$
  select
    id,
    title,
    source_url,
    chunk_text,
    1 - (embedding <=> query_embedding) as similarity
  from knowledge_chunks
  where 1 - (embedding <=> query_embedding) > match_threshold
  order by embedding <=> query_embedding
  limit match_count;
$$;

-- Consent audit trail
create table if not exists consent_events (
  id                    uuid primary key default gen_random_uuid(),
  lead_id               uuid references leads(id) on delete cascade,
  consent_type          text not null,
  consent_value         boolean not null,
  consent_text_version  text not null,
  ip_hash               text,
  created_at            timestamptz not null default now()
);
