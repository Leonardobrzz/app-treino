"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, SectionTitle } from "./ui";
import { supabase } from "@/lib/supabase/client";
import { timeAgo } from "@/lib/feed";

type Report = { post_id: string; author: string; author_email: string; caption: string | null; photo_path: string | null; hidden: boolean; reports: number; reasons: string[]; last_report: string; photo_url?: string | null };

const REASON: Record<string, string> = { nudez: "nudez", ofensa: "ofensa", spam: "spam", outro: "outro" };

export function AdminReports() {
  const [list, setList] = useState<Report[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase().rpc("admin_reports");
    const rows = (data ?? []) as Report[];
    const paths = rows.map((r) => r.photo_path).filter((p): p is string => !!p);
    const { data: signed } = paths.length ? await supabase().storage.from("feed").createSignedUrls(paths, 600) : { data: [] };
    const map = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
    setList(rows.map((r) => ({ ...r, photo_url: r.photo_path ? map.get(r.photo_path) : null })));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(r: Report, action: "apagar" | "liberar") {
    setList((l) => l?.filter((x) => x.post_id !== r.post_id) ?? null);
    if (action === "apagar" && r.photo_path) await supabase().storage.from("feed").remove([r.photo_path]);
    await supabase().rpc("admin_moderate", { p_post: r.post_id, p_action: action });
  }

  return (
    <>
      <SectionTitle>Denúncias do feed</SectionTitle>
      {!list ? null : list.length === 0 ? (
        <p className="mx-5 rounded-2xl bg-card px-4 py-4 text-[15px] text-label-2">Nenhuma denúncia. Tudo tranquilo por aqui.</p>
      ) : (
        <div className="mx-5 flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {list.map((r) => (
              <motion.div key={r.post_id} layout exit={{ opacity: 0, x: 60 }}>
                <Card className="flex gap-3 p-3">
                  {r.photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo_url} alt="Foto denunciada" className="h-24 w-20 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <div className="flex h-24 w-20 shrink-0 items-center justify-center rounded-xl bg-card-2 text-[12px] text-label-3">sem foto</div>
                  )}
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-[15px] font-semibold">{r.author}</span>
                    <span className="truncate text-[12px] text-label-2">{r.author_email}</span>
                    {r.caption && <span className="line-clamp-2 text-[13px]">{r.caption}</span>}
                    <span className="text-[12px] font-semibold text-bad">
                      {r.reports} {r.reports === 1 ? "denúncia" : "denúncias"} · {r.reasons.map((x) => REASON[x] ?? x).join(", ")} · {timeAgo(r.last_report)}
                      {r.hidden ? " · escondido" : ""}
                    </span>
                    <div className="mt-1 flex gap-2">
                      <Button size="sm" variant="danger" onClick={() => act(r, "apagar")}>
                        Apagar post
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => act(r, "liberar")}>
                        Está ok
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </>
  );
}
