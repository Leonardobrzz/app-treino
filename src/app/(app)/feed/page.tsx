"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar, PostCard } from "@/components/PostCard";
import { Button, Empty, Header, Icon, Sheet, Spinner } from "@/components/ui";
import { addComment, blockUser, deleteComment, deletePost, loadComments, loadFeed, REPORT_REASONS, reportComment, reportPost, timeAgo, type Comment, type Post, type ReportReason } from "@/lib/feed";
import { vibrate } from "@/lib/util";

type Menu = { post: Post; step: "main" | "report" | "block" | "delete" };

export default function FeedPage() {
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [more, setMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState<Menu | null>(null);
  const [open, setOpen] = useState<Post | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await loadFeed();
      setPosts(list);
      setMore(list.length >= 12);
      setError("");
    } catch {
      setError("Não consegui carregar o feed. Confira a internet.");
      setPosts((p) => p ?? []);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!posts?.length || !more || loadingMore) return;
    setLoadingMore(true);
    try {
      const list = await loadFeed(posts[posts.length - 1].created_at);
      setPosts((p) => [...(p ?? []), ...list.filter((x) => !p?.some((y) => y.id === x.id))]);
      setMore(list.length >= 12);
    } finally {
      setLoadingMore(false);
    }
  }, [posts, more, loadingMore]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => e[0].isIntersecting && loadMore(), { rootMargin: "600px" });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  function say(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 2600);
  }

  const update = (p: Post) => setPosts((list) => list?.map((x) => (x.id === p.id ? p : x)) ?? null);

  async function doReport(reason: ReportReason) {
    if (!menu) return;
    await reportPost(menu.post.id, reason).catch(() => {});
    setMenu(null);
    say("Obrigado. A denúncia foi enviada e vamos revisar.");
  }
  async function doBlock() {
    if (!menu) return;
    const uid = menu.post.user_id;
    try {
      await blockUser(uid);
      setPosts((l) => l?.filter((x) => x.user_id !== uid) ?? null);
      say(`${menu.post.author} foi bloqueado.`);
    } catch {
      say("Não consegui bloquear agora.");
    }
    setMenu(null);
  }
  async function doDelete() {
    if (!menu) return;
    const p = menu.post;
    setPosts((l) => l?.filter((x) => x.id !== p.id) ?? null);
    setMenu(null);
    await deletePost(p);
    say("Post apagado.");
  }

  return (
    <>
      <Header
        title="Feed"
        right={
          <div className="flex gap-2 pb-1.5">
            <Link href="/amigos" aria-label="Amigos e ranking" className="press flex h-10 w-10 items-center justify-center rounded-full bg-card text-accent-ink">
              <Icon name="users" size={21} />
            </Link>
            <Link href="/feed/novo" aria-label="Novo post" className="press flex h-10 w-10 items-center justify-center rounded-full bg-accent text-on-accent">
              <Icon name="plus" size={22} stroke={2.5} />
            </Link>
          </div>
        }
      />
      <p className="px-5 pb-1 text-[14px] text-label-2">Só você e seus amigos veem o que é postado aqui.</p>

      {error && <p role="alert" className="mx-5 mt-2 rounded-xl bg-card px-4 py-3 text-[15px] font-medium text-bad">{error}</p>}

      {!posts ? (
        <Spinner />
      ) : posts.length === 0 ? (
        <div className="pt-4">
          <Empty
            icon="users"
            title="Seu feed está vazio"
            text="Poste seu treino de hoje ou chame os amigos pelo seu link. Quando eles postarem, aparece aqui."
            action={
              <div className="flex flex-col gap-2">
                <Link href="/feed/novo" className="press inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-[16px] font-semibold text-on-accent">
                  <Icon name="plus" size={18} /> Fazer o primeiro post
                </Link>
                <Link href="/amigos" className="press inline-flex h-11 items-center justify-center rounded-xl bg-card-2 px-4 text-[16px] font-semibold text-accent-ink">
                  Chamar amigos
                </Link>
              </div>
            }
          />
        </div>
      ) : (
        <div>
          <AnimatePresence initial={false}>
            {posts.map((p, i) => (
              <motion.div key={p.id} layout initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0, transition: { duration: 0.25 } }} transition={{ type: "spring", stiffness: 300, damping: 30, delay: Math.min(i, 4) * 0.06 }}>
                <PostCard post={p} onChange={update} onComments={setOpen} onMenu={(post) => setMenu({ post, step: "main" })} />
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={sentinel} />
          {loadingMore && <Spinner />}
          {!more && posts.length > 3 && <p className="py-8 text-center text-[14px] text-label-3">Você viu tudo por aqui 💪</p>}
        </div>
      )}

      <AnimatePresence>
        {toast && (
          <motion.div role="status" initial={{ opacity: 0, y: 20, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20 }} className="fixed inset-x-0 bottom-28 z-50 mx-auto w-fit max-w-[90%] rounded-full bg-label px-5 py-3 text-center text-[15px] font-semibold text-bg shadow-xl">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <Sheet open={!!menu} onClose={() => setMenu(null)} title={menu?.step === "report" ? "Denunciar post" : menu?.step === "block" ? `Bloquear ${menu.post.author}?` : menu?.step === "delete" ? "Apagar post?" : "Opções"}>
        {menu?.step === "main" && (
          <div className="flex flex-col gap-2 pt-1">
            {menu.post.is_mine ? (
              <Button variant="danger" size="lg" className="!bg-card" onClick={() => setMenu({ ...menu, step: "delete" })}>
                <Icon name="trash" size={18} /> Apagar post
              </Button>
            ) : (
              <>
                <Button variant="secondary" size="lg" className="!bg-card" onClick={() => setMenu({ ...menu, step: "report" })}>
                  Denunciar post
                </Button>
                <Button variant="danger" size="lg" className="!bg-card" onClick={() => setMenu({ ...menu, step: "block" })}>
                  Bloquear {menu.post.author.split(" ")[0]}
                </Button>
              </>
            )}
          </div>
        )}
        {menu?.step === "report" && (
          <div className="flex flex-col gap-2 pt-1">
            <p className="pb-1 text-[15px] text-label-2">Qual é o problema? Ninguém fica sabendo que foi você.</p>
            {REPORT_REASONS.map((r) => (
              <button key={r.value} onClick={() => doReport(r.value)} className="press flex h-12 items-center justify-between rounded-xl bg-card px-4 text-left text-[16px] font-medium">
                {r.label}
                <Icon name="chevron" size={18} className="text-label-3" />
              </button>
            ))}
          </div>
        )}
        {menu?.step === "block" && (
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-[15px] leading-snug text-label-2">Vocês deixam de ser amigos, um some do feed e do ranking do outro, e o convite dele não funciona mais pra você.</p>
            <Button variant="danger" size="lg" className="!bg-card" onClick={doBlock}>
              Bloquear
            </Button>
          </div>
        )}
        {menu?.step === "delete" && (
          <div className="flex flex-col gap-3 pt-1">
            <p className="text-[15px] text-label-2">O post, a foto, as curtidas e os comentários somem pra todo mundo.</p>
            <Button variant="danger" size="lg" className="!bg-card" onClick={doDelete}>
              Apagar
            </Button>
          </div>
        )}
      </Sheet>

      <Comments post={open} onClose={() => setOpen(null)} onCount={(n) => open && update({ ...open, comments: n })} say={say} />
    </>
  );
}

function Comments({ post, onClose, onCount, say }: { post: Post | null; onClose: () => void; onCount: (n: number) => void; say: (t: string) => void }) {
  const [list, setList] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [act, setAct] = useState<Comment | null>(null);

  useEffect(() => {
    if (!post) return;
    setList(null);
    loadComments(post.id).then(setList);
  }, [post]);

  async function send() {
    if (!post || !text.trim() || busy) return;
    setBusy(true);
    try {
      await addComment(post.id, text);
      setText("");
      vibrate(8);
      const l = await loadComments(post.id);
      setList(l);
      onCount(l.length);
    } catch {
      say("Não consegui comentar agora.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: Comment) {
    setAct(null);
    await deleteComment(c.id);
    const l = (list ?? []).filter((x) => x.id !== c.id);
    setList(l);
    onCount(l.length);
  }
  async function report(c: Comment) {
    setAct(null);
    await reportComment(c.id, "ofensa").catch(() => {});
    say("Comentário denunciado. Obrigado!");
  }

  return (
    <Sheet open={!!post} onClose={onClose} title="Comentários">
      <div className="flex min-h-[200px] flex-col">
        {!list ? (
          <Spinner />
        ) : list.length === 0 ? (
          <p className="py-8 text-center text-[15px] text-label-2">Ninguém comentou ainda. Seja o primeiro!</p>
        ) : (
          <ul className="flex flex-col gap-4 pb-3">
            <AnimatePresence initial={false}>
              {list.map((c) => (
                <motion.li key={c.id} layout initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, height: 0 }} className="flex gap-3">
                  <Avatar id={c.user_id} name={c.author} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="text-[14px]">
                      <b className="font-semibold">{c.is_mine ? "Você" : c.author}</b> <span className="text-label-3">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="whitespace-pre-line break-words text-[15px] leading-snug">{c.body}</p>
                  </div>
                  <button onClick={() => setAct(c)} aria-label="Opções do comentário" className="press -mr-2 flex h-8 w-8 items-center justify-center text-label-3">
                    <Icon name="dots" size={16} />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
        <AnimatePresence>
          {act && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-3 flex gap-2">
              {(act.is_mine || post?.is_mine) && (
                <Button variant="danger" className="flex-1 !bg-card" onClick={() => remove(act)}>
                  Apagar
                </Button>
              )}
              {!act.is_mine && (
                <Button variant="secondary" className="flex-1 !bg-card" onClick={() => report(act)}>
                  Denunciar
                </Button>
              )}
              <Button variant="plain" onClick={() => setAct(null)}>
                Cancelar
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="sticky bottom-0 flex items-end gap-2 bg-bg pt-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, 300))}
            rows={1}
            placeholder="Escreva um comentário…"
            aria-label="Comentário"
            className="max-h-28 min-h-11 flex-1 resize-none rounded-[22px] bg-card px-4 py-2.5 text-[16px] outline-none ring-accent placeholder:text-label-3 focus:ring-2"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
          />
          <motion.button whileTap={{ scale: 0.85 }} onClick={send} disabled={!text.trim() || busy} aria-label="Enviar comentário" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent disabled:opacity-40">
            <Icon name="up" size={20} stroke={2.6} />
          </motion.button>
        </div>
      </div>
    </Sheet>
  );
}
