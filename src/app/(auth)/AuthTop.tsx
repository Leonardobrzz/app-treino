"use client";

import { usePathname } from "next/navigation";
import { CargaLogo } from "@/components/RolePick";

// Login e cadastro desenham a própria marca (grande, centralizada); as outras telas usam a pequena.
export function AuthTop() {
  const path = usePathname();
  if (path === "/login" || path === "/cadastro") return null;
  return (
    <div className="mt-10 mb-8">
      <CargaLogo />
    </div>
  );
}
