"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { HomeScreenArt, InstallGuide } from "@/components/InstallGuide";
import { detectPlatform } from "@/lib/install";

export function InstallScreen({ onContinue, skipLabel = "Fazer depois", top }: { onContinue: () => void; skipLabel?: string; top?: React.ReactNode }) {
  const [installed, setInstalled] = useState(false);
  const [ios, setIos] = useState(false);
  useEffect(() => setIos(detectPlatform().startsWith("ios")), []);

  return (
    <div className="flex min-h-dvh flex-col px-6 pb-[max(20px,env(safe-area-inset-bottom))]">
      <div className="safe-top pt-2">{top}</div>
      <div className="mt-4">
        <HomeScreenArt />
      </div>
      <motion.h1 initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-6 font-[family-name:var(--font-display)] text-[30px] font-bold leading-tight tracking-[-0.5px]">
        Coloque o Carga na tela de início
      </motion.h1>
      <p className="mt-2 text-[16px] leading-snug text-label-2">
        Ele não está na Play Store nem na App Store: você instala direto pelo navegador, em 10 segundos. Fica igual a um app, com ícone, tela cheia e mais rápido.
      </p>
      <div className="mt-6">
        <InstallGuide onInstalled={() => setInstalled(true)} />
      </div>
      {ios && !installed && (
        <p className="mt-4 text-[14px] leading-snug text-label-2">
          Depois de adicionar, abra o Carga pelo ícone e entre com o mesmo e-mail e senha. No iPhone, o app instalado pede login uma vez.
        </p>
      )}
      <div className="mt-auto flex flex-col gap-2 pt-8">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onContinue}
          className={`h-[54px] rounded-2xl text-[17px] font-bold ${installed ? "bg-accent text-on-accent" : "bg-card text-label"}`}
        >
          {installed ? "Continuar" : "Já adicionei"}
        </motion.button>
        {!installed && (
          <button onClick={onContinue} className="press h-11 text-[16px] font-semibold text-label-2">
            {skipLabel}
          </button>
        )}
      </div>
    </div>
  );
}
