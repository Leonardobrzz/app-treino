"use client";

import { useRouter } from "next/navigation";
import { Tour } from "@/components/Tour";
import { markIntroSeen } from "@/lib/install";

export default function ComoUsar() {
  const router = useRouter();
  return (
    <Tour
      doneLabel="Entendi"
      onDone={() => {
        markIntroSeen();
        if (history.length > 1) router.back();
        else router.replace("/perfil");
      }}
    />
  );
}
