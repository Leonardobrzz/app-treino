-- Feed fechado: cada um vê os próprios posts e os dos amigos (tabela friendships).
-- Tem curtida, comentário, denúncia e bloqueio. Post com 3 denúncias some sozinho até o dono do app olhar.

-- bloqueios (quem bloqueia some do feed do outro e a amizade é desfeita)
create table public.user_blocks (
  blocker uuid not null references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
create index user_blocks_blocked on public.user_blocks (blocked);
alter table public.user_blocks enable row level security;
create policy "ver meus bloqueios" on public.user_blocks for select to authenticated using (blocker = (select auth.uid()));
create policy "desbloquear" on public.user_blocks for delete to authenticated using (blocker = (select auth.uid()));

-- pode ver o conteúdo de "author"? (ele mesmo, ou amigo sem bloqueio de nenhum lado)
create function private.can_see(author uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null and (
    author = auth.uid()
    or (
      exists (select 1 from public.friendships f where (f.user_a = auth.uid() and f.user_b = author) or (f.user_b = auth.uid() and f.user_a = author))
      and not exists (select 1 from public.user_blocks b where (b.blocker = auth.uid() and b.blocked = author) or (b.blocker = author and b.blocked = auth.uid()))
    )
  );
$$;
revoke execute on function private.can_see(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.can_see(uuid) to authenticated;

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid references public.sessions(id) on delete set null,
  caption text check (char_length(caption) <= 500),
  photo_path text,
  stats jsonb,
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  check (photo_path is not null or session_id is not null or char_length(coalesce(caption, '')) > 0)
);
create index posts_user_time on public.posts (user_id, created_at desc);
create unique index posts_session on public.posts (session_id) where session_id is not null;
alter table public.posts enable row level security;
create policy "ver posts" on public.posts for select to authenticated
  using (user_id = (select auth.uid()) or (not hidden and (select private.can_see(user_id))));
create policy "apagar post proprio" on public.posts for delete to authenticated using (user_id = (select auth.uid()));
-- criar e editar só pela função create_post (os números do treino vêm do banco, não do aparelho)

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user on public.post_likes (user_id);
alter table public.post_likes enable row level security;
create policy "ver curtidas" on public.post_likes for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id));
create policy "curtir" on public.post_likes for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
create policy "descurtir" on public.post_likes for delete to authenticated using (user_id = (select auth.uid()));

create table public.post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 300),
  created_at timestamptz not null default now()
);
create index post_comments_post on public.post_comments (post_id, created_at);
create index post_comments_user on public.post_comments (user_id);
alter table public.post_comments enable row level security;
create policy "ver comentarios" on public.post_comments for select to authenticated
  using (exists (select 1 from public.posts p where p.id = post_id) and (select private.can_see(user_id)));
create policy "comentar" on public.post_comments for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts p where p.id = post_id));
-- apaga o próprio comentário, ou qualquer comentário no próprio post
create policy "apagar comentario" on public.post_comments for delete to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.posts p where p.id = post_id and p.user_id = (select auth.uid())));

create table public.post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.post_comments(id) on delete cascade,
  reporter uuid not null default auth.uid() references auth.users(id) on delete cascade,
  reason text not null check (reason in ('nudez', 'ofensa', 'spam', 'outro')),
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null))
);
create unique index post_reports_once_post on public.post_reports (reporter, post_id) where post_id is not null;
create unique index post_reports_once_comment on public.post_reports (reporter, comment_id) where comment_id is not null;
create index post_reports_post on public.post_reports (post_id);
create index post_reports_comment on public.post_reports (comment_id);
alter table public.post_reports enable row level security;
create policy "denunciar" on public.post_reports for insert to authenticated
  with check (reporter = (select auth.uid()) and (
    (post_id is not null and exists (select 1 from public.posts p where p.id = post_id))
    or (comment_id is not null and exists (select 1 from public.post_comments c where c.id = comment_id))
  ));

-- 3 denúncias → o post some do feed dos amigos (o dono ainda vê)
create function private.auto_hide()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.post_id is not null and (select count(*) from public.post_reports r where r.post_id = new.post_id) >= 3 then
    update public.posts set hidden = true where id = new.post_id;
  end if;
  if new.comment_id is not null and (select count(*) from public.post_reports r where r.comment_id = new.comment_id) >= 3 then
    delete from public.post_comments where id = new.comment_id;
  end if;
  return new;
end;
$$;
create trigger post_reports_auto_hide after insert on public.post_reports for each row execute function private.auto_hide();

-- fotos do feed: bucket privado; pasta = id do dono; amigos podem ler
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feed', 'feed', false, 3145728, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
create policy "feed ver fotos" on storage.objects for select to authenticated
  using (bucket_id = 'feed' and (select private.can_see(((storage.foldername(name))[1])::uuid)));
create policy "feed enviar fotos" on storage.objects for insert to authenticated
  with check (bucket_id = 'feed' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "feed apagar fotos" on storage.objects for delete to authenticated
  using (bucket_id = 'feed' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- cria o post; se tiver treino, os números são calculados aqui
create function public.create_post(p_session uuid, p_caption text, p_photo text, p_prs text[] default '{}')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  s record;
  st jsonb;
  new_id uuid;
begin
  if me is null then raise exception 'não autenticado'; end if;
  if p_photo is not null and split_part(p_photo, '/', 1) <> me::text then raise exception 'foto inválida'; end if;
  if p_session is not null then
    select id, title, started_at, finished_at into s from public.sessions where id = p_session and user_id = me and finished_at is not null;
    if s.id is null then raise exception 'treino não encontrado'; end if;
    select jsonb_build_object(
      'title', s.title,
      'minutes', greatest(1, round(extract(epoch from (s.finished_at - s.started_at)) / 60)::int),
      'volume', coalesce(sum(ss.weight * ss.reps) filter (where ss.done), 0),
      'sets', count(*) filter (where ss.done),
      'exercises', count(distinct ss.exercise_id) filter (where ss.done),
      'prs', coalesce((select jsonb_agg(left(x, 60)) from unnest(p_prs[1:5]) x), '[]'::jsonb)
    ) into st
    from public.session_sets ss where ss.session_id = s.id;
  end if;
  insert into public.posts (user_id, session_id, caption, photo_path, stats)
  values (me, p_session, nullif(trim(p_caption), ''), p_photo, st)
  returning id into new_id;
  return new_id;
end;
$$;
revoke execute on function public.create_post(uuid, text, text, text[]) from public, anon;
grant execute on function public.create_post(uuid, text, text, text[]) to authenticated;

-- feed paginado com nome do autor, contagens e se eu curti
create function public.feed(p_before timestamptz default null, p_limit int default 15, p_user uuid default null)
returns table (id uuid, user_id uuid, author text, is_mine boolean, caption text, photo_path text, stats jsonb, hidden boolean, created_at timestamptz, likes int, comments int, liked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.user_id, coalesce(pr.name, 'Sem nome'), p.user_id = auth.uid(), p.caption, p.photo_path, p.stats, p.hidden, p.created_at,
    (select count(*)::int from public.post_likes l where l.post_id = p.id),
    (select count(*)::int from public.post_comments c where c.post_id = p.id and private.can_see(c.user_id)),
    exists (select 1 from public.post_likes l where l.post_id = p.id and l.user_id = auth.uid())
  from public.posts p
  join public.profiles pr on pr.id = p.user_id
  where (p.user_id = auth.uid() or (not p.hidden and private.can_see(p.user_id)))
    and (p_user is null or p.user_id = p_user)
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 30);
$$;
revoke execute on function public.feed(timestamptz, int, uuid) from public, anon;
grant execute on function public.feed(timestamptz, int, uuid) to authenticated;

create function public.post_comment_list(p_post uuid)
returns table (id uuid, user_id uuid, author text, is_mine boolean, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.user_id, coalesce(pr.name, 'Sem nome'), c.user_id = auth.uid(), c.body, c.created_at
  from public.post_comments c
  join public.posts p on p.id = c.post_id
  join public.profiles pr on pr.id = c.user_id
  where c.post_id = p_post
    and (p.user_id = auth.uid() or (not p.hidden and private.can_see(p.user_id)))
    and private.can_see(c.user_id)
  order by c.created_at;
$$;
revoke execute on function public.post_comment_list(uuid) from public, anon;
grant execute on function public.post_comment_list(uuid) to authenticated;

-- bloquear: desfaz a amizade e esconde tudo dos dois lados
create function public.block_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare me uuid := auth.uid();
begin
  if me is null or p_user is null or p_user = me then raise exception 'inválido'; end if;
  insert into public.user_blocks (blocker, blocked) values (me, p_user) on conflict do nothing;
  delete from public.friendships where (user_a = me and user_b = p_user) or (user_a = p_user and user_b = me);
end;
$$;
revoke execute on function public.block_user(uuid) from public, anon;
grant execute on function public.block_user(uuid) to authenticated;

-- convite não refaz amizade com quem está bloqueado
create or replace function public.add_friend(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := auth.uid();
  other uuid;
  other_name text;
begin
  if me is null then raise exception 'não autenticado'; end if;
  select id, coalesce(name, 'Seu amigo') into other, other_name from public.profiles where friend_code = upper(trim(p_code));
  if other is null then raise exception 'convite inválido'; end if;
  if other = me then raise exception 'esse é o seu próprio convite'; end if;
  if exists (select 1 from public.user_blocks b where (b.blocker = me and b.blocked = other) or (b.blocker = other and b.blocked = me)) then
    raise exception 'convite inválido';
  end if;
  insert into public.friendships (user_a, user_b) values (other, me) on conflict do nothing;
  return other_name;
end;
$$;

-- painel do dono: denúncias
create function public.admin_reports()
returns table (post_id uuid, author text, author_email text, caption text, photo_path text, hidden boolean, reports int, reasons text[], last_report timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  return query
    select p.id, coalesce(pr.name, 'Sem nome'), u.email::text, p.caption, p.photo_path, p.hidden,
      count(r.id)::int, array_agg(distinct r.reason), max(r.created_at)
    from public.post_reports r
    join public.posts p on p.id = r.post_id
    join public.profiles pr on pr.id = p.user_id
    join auth.users u on u.id = p.user_id
    group by p.id, pr.name, u.email
    order by max(r.created_at) desc
    limit 100;
end;
$$;
revoke execute on function public.admin_reports() from public, anon;
grant execute on function public.admin_reports() to authenticated;

create function public.admin_moderate(p_post uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_action = 'apagar' then
    delete from public.posts where id = p_post;
  elsif p_action = 'liberar' then
    update public.posts set hidden = false where id = p_post;
    delete from public.post_reports where post_id = p_post;
  else
    raise exception 'ação inválida';
  end if;
end;
$$;
revoke execute on function public.admin_moderate(uuid, text) from public, anon;
grant execute on function public.admin_moderate(uuid, text) to authenticated;

-- foto denunciada: o dono do app precisa ver a imagem pra decidir
create policy "admin ver fotos do feed" on storage.objects for select to authenticated
  using (bucket_id = 'feed' and (select public.is_admin()));
create policy "admin apagar fotos do feed" on storage.objects for delete to authenticated
  using (bucket_id = 'feed' and (select public.is_admin()));
