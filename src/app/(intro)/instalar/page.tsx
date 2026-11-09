"use client";

import { useRouter } from "next/navigation";
import { InstallScreen } from "@/components/InstallScreen";
import { Icon } from "@/components/ui";

export default function Instalar() {
  const router = useRouter();
  const back = () => (history.length > 1 ? router.back() : router.replace("/perfil"));
  return (
    <InstallScreen
      onContinue={back}
      skipLabel="Voltar"
      top={
        <button onClick={back} className="press -ml-1 flex h-9 items-center gap-0.5 text-[17px] text-accent-ink">
          <Icon name="back" size={22} /> Perfil
        </button>
      }
    />
  );
}
