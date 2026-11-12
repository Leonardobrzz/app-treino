"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { applyBrand, cachedBrand, loadBrand, type Brand } from "@/lib/brand";

/** Aplica a cor do personal no app (do próprio personal e dos alunos dele) */
export function BrandTheme() {
  const path = usePathname();
  const last = useRef(0);
  useEffect(() => {
    applyBrand(cachedBrand());
  }, []);
  useEffect(() => {
    if (path.startsWith("/login") || path.startsWith("/cadastro") || path.startsWith("/p/")) return;
    const force = path === "/" || path === "/personal" || path === "/meu-personal";
    if (!force && Date.now() - last.current < 60000) return;
    last.current = Date.now();
    loadBrand()
      .then((b) => {
        applyBrand(b);
        window.dispatchEvent(new Event("marca"));
      })
      .catch(() => {});
  }, [path]);
  return null;
}

/** Marca atual (logo e nome) pra mostrar na tela */
export function useBrand() {
  const [b, setB] = useState<Brand | null>(null);
  useEffect(() => {
    const up = () => setB(cachedBrand());
    up();
    window.addEventListener("marca", up);
    return () => window.removeEventListener("marca", up);
  }, []);
  return b;
}
