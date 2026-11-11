"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button, Card, Icon, Sheet, Spinner } from "@/components/ui";
import { AssessmentView } from "./AssessmentView";
import { type Assessment, type StudentDetail } from "@/lib/personal";
import { supabase } from "@/lib/supabase/client";
import { fmtDate, num } from "@/lib/util";

export function AssessmentsTab({ d }: { d: StudentDetail }) {
  const [list, setList] = useState<Assessment[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [del, setDel] = useState(false);

  async function load() {
    const { data } = await supabase().from("assessments").select("*").eq("student_id", d.profile.id).eq("trainer_id", d.link.trainer_id).order("assessed_on", { ascending: false }).order("created_at", { ascending: false });
    setList((data ?? []) as Assessment[]);
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d.profile.id]);

  async function remove() {
    const a = list?.[idx];
    if (!a) return;
    const photos = Object.values(a.posture?.photos ?? {}).filter(Boolean) as string[];
    if (photos.length) await supabase().storage.from("avaliacoes").remove(photos);
    await supabase().from("assessments").delete().eq("id", a.id);
    setDel(false);
    setIdx(0);
    load();
  }

  if (!list) return <Spinner />;
  const a = list[idx];

  return (
    <div className="pt-3">
      <div className="mx-5">
        <Link href={`/personal/aluno/${d.profile.id}/avaliacao`} className="press flex h-12 items-center justify-center gap-2 rounded-2xl bg-accent text-[16px] font-semibold text-on-accent">
          <Icon name="plus" size={18} /> Nova avaliação
        </Link>
      </div>
      {list.length === 0 ? (
        <p className="mx-5 mt-4 rounded-2xl bg-card p-4 text-[15px] leading-snug text-label-2">Nenhuma avaliação ainda. Faça a primeira com dobras cutâneas, perimetria e fotos de postura.</p>
      ) : (
        <>
          {list.length > 1 && (
            <div className="no-scrollbar mx-5 mt-4 flex gap-2 overflow-x-auto">
              {list.map((x, i) => (
                <button key={x.id} onClick={() => setIdx(i)} className={`press flex h-14 shrink-0 flex-col items-start justify-center rounded-xl px-3.5 ${i === idx ? "bg-accent text-on-accent" : "bg-card"}`}>
                  <span className="text-[14px] font-semibold">{fmtDate(x.assessed_on)}</span>
                  <span className={`text-[12px] ${i === idx ? "opacity-80" : "text-label-2"}`}>{x.body_fat != null ? `${num(Number(x.body_fat))}% gordura` : x.weight ? `${num(Number(x.weight))} kg` : "medidas"}</span>
                </button>
              ))}
            </div>
          )}
          {list.length > 1 && idx < list.length - 1 && <p className="mx-5 mt-2 text-[12px] text-label-3">Números coloridos = diferença pra avaliação anterior ({fmtDate(list[idx + 1].assessed_on)}).</p>}
          <div className="mx-5 mt-3">
            <AssessmentView a={a} prev={list[idx + 1]} />
          </div>
          <div className="mx-5 mt-3">
            <Button variant="plain" className="w-full !text-bad" onClick={() => setDel(true)}>
              Apagar esta avaliação
            </Button>
          </div>
          {list.length > 1 && (
            <Card className="mx-5 mt-3 p-4">
              <span className="text-[13px] font-semibold text-label-2">Evolução da gordura corporal</span>
              <div className="mt-2 flex flex-col gap-1">
                {[...list].reverse().filter((x) => x.body_fat != null).map((x) => (
                  <div key={x.id} className="flex items-center gap-2 text-[13px]">
                    <span className="w-14 shrink-0 text-label-2">{fmtDate(x.assessed_on)}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-fill">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (Number(x.body_fat) / 45) * 100)}%` }} />
                    </div>
                    <span className="tabular w-12 text-right font-semibold">{num(Number(x.body_fat))}%</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
      <Sheet open={del} onClose={() => setDel(false)} title="Apagar avaliação?">
        <div className="flex flex-col gap-3 pt-1">
          <p className="text-[15px] text-label-2">As medidas e as fotos de postura dessa data somem pra você e pro aluno.</p>
          <Button variant="danger" size="lg" className="!bg-card" onClick={remove}>Apagar</Button>
        </div>
      </Sheet>
    </div>
  );
}
