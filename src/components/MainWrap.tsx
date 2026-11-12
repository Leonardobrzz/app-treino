"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** No computador, a área do personal ganha mais largura */
export function MainWrap({ children }: { children: ReactNode }) {
  const path = usePathname();
  const wide = path.startsWith("/personal") && path !== "/personal/comecar";
  return <main className={`mx-auto w-full pb-32 ${wide ? "max-w-[520px] lg:max-w-[1156px] lg:pb-12 lg:pl-[256px]" : "max-w-[520px]"}`}>{children}</main>;
}
