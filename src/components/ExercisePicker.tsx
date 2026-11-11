"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { Exercise } from "@/lib/types";
import { Button, Icon } from "./ui";
import { ExerciseGuideSheet } from "./ExerciseGuide";

export const GROUPS = ["Peito", "Costas", "Ombros", "Bíceps", "Tríceps", "Antebraço", "Trapézio", "Abdômen", "Quadríceps", "Posterior de coxa", "Glúteos", "Adutores", "Panturrilha", "Cardio"];

let cache: Exercise[] | null = null;
export async function loadExercises(force = false) {
  if (cache && !force) return cache;
  const { data } = await supabase().from("exercises").select("*").order("name");
  cache = (data ?? []) as Exercise[];
  return cache;
}

export function ExerciseList({
  selectable,
  selected,
  onToggle,
  onCreated,
  catalogOnly,
}: {
  catalogOnly?: boolean;
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (e: Exercise) => void;
  onCreated?: (e: Exercise) => void;
}) {
  const [all, setAll] = useState<Exercise[]>([]);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newGroup, setNewGroup] = useState(GROUPS[0]);
  const [newEquip, setNewEquip] = useState("Máquina");
  const [guide, setGuide] = useState<Exercise | null>(null);

  useEffect(() => {
    loadExercises().then(setAll);
  }, []);

  const list = useMemo(() => {
    const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
    const nq = norm(q.trim());
    return all.filter((e) => (!catalogOnly || !e.created_by) && (!group || e.muscle_group === group || e.secondary.includes(group)) && (!nq || norm(e.name).includes(nq) || norm(e.muscle_group).includes(nq)));
  }, [all, q, group, catalogOnly]);

  async function create() {
    const name = q.trim();
    if (!name) return;
    const { data: u } = await supabase().auth.getUser();
    const { data, error } = await supabase()
      .from("exercises")
      .insert({ name, muscle_group: newGroup, equipment: newEquip, created_by: u.user?.id })
      .select()
      .single();
    if (error || !data) return;
    const fresh = await loadExercises(true);
    setAll(fresh);
    setCreating(false);
    onCreated?.(data as Exercise);
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex h-10 items-center gap-2 rounded-[10px] bg-fill px-3 text-label-2">
        <Icon name="search" size={18} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar exercício ou músculo" aria-label="Buscar exercício" className="h-full flex-1 bg-transparent text-[17px] text-label outline-none placeholder:text-label-3" />
      </label>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
        {[null, ...GROUPS].map((g) => (
          <button key={g ?? "todos"} onClick={() => setGroup(g)} className={`press h-8 shrink-0 rounded-full px-3.5 text-[14px] font-medium ${group === g ? "bg-accent text-on-accent" : "bg-card text-label"}`}>
            {g ?? "Todos"}
          </button>
        ))}
      </div>
      <ul className="overflow-hidden rounded-2xl bg-card">
        {list.map((e) => {
          const on = selected?.has(e.id);
          return (
            <li key={e.id} className="border-b border-sep last:border-b-0">
              <button onClick={() => (selectable ? onToggle?.(e) : setGuide(e))} className="press flex w-full items-center gap-3 px-4 py-3 text-left">
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[16px] font-medium">{e.name}</span>
                  <span className="text-[13px] text-label-2">
                    {e.muscle_group} · {e.equipment}
                    {e.created_by ? " · seu" : ""}
                  </span>
                </div>
                {!selectable && <Icon name="chevron" size={17} className="text-label-3" />}
                {selectable && (
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full ${on ? "bg-accent text-on-accent" : "ring-2 ring-fill"}`}>{on && <Icon name="check" size={15} stroke={3} />}</span>
                )}
              </button>
            </li>
          );
        })}
        {list.length === 0 && <li className="px-4 py-6 text-center text-[15px] text-label-2">Nenhum exercício encontrado.</li>}
      </ul>
      {!catalogOnly && q.trim().length > 2 && !all.some((e) => e.name.toLowerCase() === q.trim().toLowerCase()) && (
        <div className="rounded-2xl bg-card p-4">
          {!creating ? (
            <button onClick={() => setCreating(true)} className="press flex w-full items-center gap-2 text-[16px] font-semibold text-accent-ink">
              <Icon name="plus" size={18} /> Criar “{q.trim()}”
            </button>
          ) : (
            <div className="flex flex-col gap-3">
              <span className="text-[15px] font-semibold">Novo exercício: {q.trim()}</span>
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-label-2">
                Músculo principal
                <select value={newGroup} onChange={(e) => setNewGroup(e.target.value)} className="h-11 rounded-xl bg-card-2 px-3 text-[16px] text-label">
                  {GROUPS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[13px] font-semibold text-label-2">
                Equipamento
                <select value={newEquip} onChange={(e) => setNewEquip(e.target.value)} className="h-11 rounded-xl bg-card-2 px-3 text-[16px] text-label">
                  {["Máquina", "Barra", "Halter", "Polia", "Peso corporal", "Smith", "Kettlebell", "Elástico", "Anilha", "Acessório"].map((g) => <option key={g}>{g}</option>)}
                </select>
              </label>
              <Button onClick={create}>Salvar exercício</Button>
            </div>
          )}
        </div>
      )}
      {!selectable && <ExerciseGuideSheet exercise={guide} onClose={() => setGuide(null)} />}
    </div>
  );
}
