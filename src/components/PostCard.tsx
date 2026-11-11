"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRef, useState } from "react";
import { HeartBurst } from "./motion";
import { Icon } from "./ui";
import { hueOf, initials, setLike, timeAgo, type Post } from "@/lib/feed";
import { num, vibrate } from "@/lib/util";

export function Avatar({ id, name, size = 40 }: { id: string; name: string; size?: number }) {
  const h = hueOf(id);
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `linear-gradient(135deg, hsl(${h} 70% 55%), hsl(${(h + 40) % 360} 75% 42%))` }}
    >
      {initials(name)}
    </span>
  );
}

function fmtVolume(v: number) {
  return v >= 1000 ? `${num(v / 1000, 1)} t` : `${Math.round(v)} kg`;
}
function fmtMinutes(m: number) {
  return m >= 60 ? `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}` : `${m} min`;
}

function StatsOverlay({ post }: { post: Post }) {
  const s = post.stats!;
  return (
    <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-5 pb-5 pt-20 text-white">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[1.2px] text-white/75">Volume</div>
        <motion.div className="tabular font-[family-name:var(--font-display)] text-[40px] font-bold leading-none tracking-[-1px]" initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 300, damping: 26 }}>
          {fmtVolume(Number(s.volume))}
        </motion.div>
      </div>
      <div className="flex gap-7">
        {[
          ["Duração", fmtMinutes(s.minutes)],
          ["Exercícios", String(s.exercises)],
          ["Séries", String(s.sets)],
        ].map(([l, v]) => (
          <div key={l}>
            <div className="text-[11px] font-semibold uppercase tracking-[1px] text-white/70">{l}</div>
            <div className="tabular text-[20px] font-bold">{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PostCard({ post, onChange, onComments, onMenu }: { post: Post; onChange: (p: Post) => void; onComments: (p: Post) => void; onMenu: (p: Post) => void }) {
  const [burst, setBurst] = useState(0);
  const lastTap = useRef(0);
  const prs = post.stats?.prs ?? [];

  async function toggle(like = !post.liked) {
    if (like === post.liked) return;
    vibrate(like ? 12 : 6);
    onChange({ ...post, liked: like, likes: post.likes + (like ? 1 : -1) });
    try {
      await setLike(post.id, like);
    } catch {
      onChange(post);
    }
  }

  function tap() {
    const now = Date.now();
    if (now - lastTap.current < 300) {
      setBurst((b) => b + 1);
      toggle(true);
      lastTap.current = 0;
    } else lastTap.current = now;
  }

  const hasMedia = !!post.photo_url || !!post.stats;

  return (
    <article className="border-b border-sep pb-4 pt-4" aria-label={`Post de ${post.author}`}>
      <div className="flex items-center gap-3 px-5 pb-3">
        <Avatar id={post.user_id} name={post.author} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[16px] font-semibold">{post.is_mine ? "Você" : post.author}</span>
          <span className="truncate text-[13px] text-label-2">
            {post.stats?.title ? `${post.stats.title} · ` : ""}
            {timeAgo(post.created_at)}
          </span>
        </div>
        <button onClick={() => onMenu(post)} aria-label="Opções do post" className="press flex h-9 w-9 items-center justify-center rounded-full text-label-2">
          <Icon name="dots" size={20} />
        </button>
      </div>

      {post.hidden && post.is_mine && <p className="mx-5 mb-3 rounded-xl bg-card px-3 py-2 text-[13px] text-bad">Este post recebeu denúncias e está escondido dos seus amigos até ser revisado.</p>}

      {hasMedia && (
        <div onClick={tap} className="relative mx-5 select-none overflow-hidden rounded-[22px] bg-card" style={{ aspectRatio: post.photo_url ? "4 / 5" : "4 / 3" }}>
          {post.photo_url ? (
            <motion.img src={post.photo_url} alt={post.caption ? `Foto: ${post.caption.slice(0, 80)}` : `Foto do treino de ${post.author}`} className="absolute inset-0 h-full w-full object-cover" initial={{ opacity: 0, scale: 1.04 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }} draggable={false} />
          ) : (
            <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 0% 0%, #FF8A2A 0%, #E2550A 38%, #2a1206 78%, #0d0d0f 100%)" }}>
              <Icon name="dumbbell" size={180} stroke={1.2} className="absolute -right-6 -top-6 rotate-[-20deg] text-white/10" />
            </div>
          )}
          {prs.length > 0 && (
            <motion.div initial={{ scale: 0, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 420, damping: 16, delay: 0.2 }} className="absolute left-4 top-4 flex max-w-[80%] items-center gap-1.5 rounded-full bg-[#FFB800] px-3 py-1.5 text-[13px] font-bold text-black shadow-lg">
              <Icon name="trophy" size={15} /> <span className="truncate">Recorde: {prs.join(", ")}</span>
            </motion.div>
          )}
          {post.stats && <StatsOverlay post={post} />}
          <AnimatePresence>{burst > 0 && <HeartBurst key={burst} show />}</AnimatePresence>
        </div>
      )}

      <div className="flex items-center gap-5 px-5 pt-3">
        <button onClick={() => toggle()} aria-pressed={post.liked} aria-label={post.liked ? "Descurtir" : "Curtir"} className="press flex items-center gap-1.5 text-[16px] font-semibold">
          <motion.svg key={String(post.liked)} width="26" height="26" viewBox="0 0 24 24" initial={{ scale: post.liked ? 0.5 : 1 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 600, damping: 12 }} aria-hidden>
            <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" fill={post.liked ? "#FF375F" : "none"} stroke={post.liked ? "#FF375F" : "currentColor"} strokeWidth="2" strokeLinejoin="round" />
          </motion.svg>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span key={post.likes} className="tabular" initial={{ y: post.liked ? 10 : -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: post.liked ? -10 : 10, opacity: 0 }}>
              {post.likes}
            </motion.span>
          </AnimatePresence>
        </button>
        <button onClick={() => onComments(post)} aria-label="Comentários" className="press flex items-center gap-1.5 text-[16px] font-semibold">
          <svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden>
            <path d="M20 11.5a8 8 0 0 1-11.7 7.1L4 20l1.4-4.1A8 8 0 1 1 20 11.5z" />
          </svg>
          <span className="tabular">{post.comments}</span>
        </button>
      </div>

      {post.caption && (
        <p className="whitespace-pre-line break-words px-5 pt-2 text-[15px] leading-snug">
          <b className="font-semibold">{post.is_mine ? "Você" : post.author.split(" ")[0]}</b> {post.caption}
        </p>
      )}
    </article>
  );
}
