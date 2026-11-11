"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Avatar } from "@/components/PostCard";
import { Card, Icon } from "@/components/ui";
import { Pill } from "./common";
import { dateBR, type Challenge, type RankRow } from "@/lib/personal";
import { supabase } from "@/lib/supabase/client";
import { num, todayISO } from "@/lib/util";

const MEDAL = ["#FFB800", "#A8A8AE", "#C8803D"];
export const METRIC_LABEL = { treinos: "Mais dias treinados", volume: "Maior volume (kg)", series: "Mais séries" } as const;

export function ChallengeCard({ c, onDelete }: { c: Challenge; onDelete?: () => void }) {
  const [rows, setRows] = useState<RankRow[] | null>(null);
  useEffect(() => {
    supabase().rpc("challenge_ranking", { p_challenge: c.id }).then(({ data }) => setRows((data ?? []) as RankRow[]));
  }, [c.id]);
  const key = c.metric === "treinos" ? "workouts" : c.metric === "series" ? "sets" : "volume";
  const sorted = [...(rows ?? [])].sort((a, b) => Number(b[key]) - Number(a[key]));
  const t = todayISO();
  const state = t < c.starts_on ? { l: "começa em breve", tone: "muted" as const } : t > c.ends_on ? { l: "encerrado", tone: "muted" as const } : { l: "valendo", tone: "good" as const };
  const fmt = (r: RankRow) => (c.metric === "treinos" ? `${r.workouts} ${r.workouts === 1 ? "dia" : "dias"}` : c.metric === "series" ? `${r.sets} séries` : Number(r.volume) >= 1000 ? `${num(Number(r.volume) / 1000)} t` : `${Math.round(Number(r.volume))} kg`);

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start gap-3 p-4">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFB800] text-black">
          <Icon name="trophy" size={22} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[17px] font-bold leading-tight">{c.title}</span>
          <span className="text-[13px] text-label-2">
            {METRIC_LABEL[c.metric]} · {dateBR(c.starts_on)} a {dateBR(c.ends_on)}
          </span>
          {c.prize && <span className="mt-0.5 text-[13px] font-semibold text-accent-ink">Prêmio: {c.prize}</span>}
        </div>
        <Pill tone={state.tone}>{state.l}</Pill>
      </div>
      {!rows ? (
        <div className="px-4 pb-4 text-[13px] text-label-3">Carregando ranking…</div>
      ) : sorted.length === 0 ? (
        <div className="px-4 pb-4 text-[13px] text-label-3">Ninguém no ranking ainda.</div>
      ) : (
        <ol>
          {sorted.slice(0, 10).map((r, i) => (
            <motion.li layout key={r.student_id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className={`flex items-center gap-3 border-t border-sep px-4 py-2.5 ${r.is_me ? "bg-accent-soft" : ""}`}>
              <span className="tabular flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-bold" style={i < 3 && Number(r[key]) > 0 ? { background: MEDAL[i], color: "#000" } : undefined}>
                {i + 1}
              </span>
              <Avatar id={r.student_id} name={r.name} size={30} />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">{r.is_me ? "Você" : r.name}</span>
              <span className="tabular text-[15px] font-bold">{fmt(r)}</span>
            </motion.li>
          ))}
        </ol>
      )}
      {onDelete && (
        <button onClick={onDelete} className="press w-full border-t border-sep py-2.5 text-[14px] font-semibold text-bad">
          Apagar desafio
        </button>
      )}
    </Card>
  );
}
