"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { InstallScreen } from "@/components/InstallScreen";
import { Tour } from "@/components/Tour";
import { isStandalone, markIntroSeen } from "@/lib/install";

function Comecar() {
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("next") ?? "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const [step, setStep] = useState<"install" | "tour" | null>(null);

  useEffect(() => setStep(isStandalone() ? "tour" : "install"), []);

  function finish() {
    markIntroSeen();
    router.replace(next);
  }

  return (
    <AnimatePresence mode="wait">
      {step && (
        <motion.div key={step} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
          {step === "install" ? <InstallScreen onContinue={() => setStep("tour")} /> : <Tour onDone={finish} />}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Page() {
  return (
    <Suspense>
      <Comecar />
    </Suspense>
  );
}
