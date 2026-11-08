"use client";

import { ExerciseList } from "@/components/ExercisePicker";
import { Header } from "@/components/ui";

export default function ExercisesPage() {
  return (
    <>
      <Header title="Exercícios" back={{ href: "/treinos", label: "Semana" }} />
      <div className="px-5 pt-2">
        <ExerciseList />
        <p className="pt-3 text-[13px] text-label-2">Não achou? Digite o nome na busca e crie o seu.</p>
      </div>
    </>
  );
}
