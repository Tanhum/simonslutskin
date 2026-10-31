-- Uploader username/password are Supabase Edge Function secrets, not database rows.
create table if not exists public.artworks (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 120),
  description text not null check (char_length(description) between 1 and 1000),
  size text not null check (char_length(size) between 1 and 60),
  style text not null check (char_length(style) between 1 and 80),
  artist text not null check (char_length(artist) between 1 and 100),
  image_path text not null unique,
  created_at timestamptz not null default now()
);

alter table public.artworks enable row level security;

grant select on public.artworks to anon, authenticated;
grant select, insert on public.artworks to service_role;

drop policy if exists "Anyone can view gallery artworks" on public.artworks;
create policy "Anyone can view gallery artworks"
  on public.artworks
  for select
  to anon, authenticated
  using (true);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('artworks', 'artworks', true, 10485760, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view gallery images" on storage.objects;
create policy "Anyone can view gallery images"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'artworks');
