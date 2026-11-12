// Identidade visual do personal: cor e logo aplicadas no app dele e dos alunos dele
import { supabase } from "./supabase/client";

export type Brand = { name: string; color: string | null; logo: string | null; mine?: boolean };

export const BRAND_COLORS = ["#FF9500", "#FF3B30", "#FF2D55", "#AF52DE", "#5856D6", "#007AFF", "#00A3B4", "#34C759", "#A2845E", "#1C1C1E"];

const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb: number[]) => "#" + rgb.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
const mix = (a: string, b: string, t: number) => toHex(hex(a).map((v, i) => v + (hex(b)[i] - v) * t));
const lum = (h: string) => {
  const [r, g, b] = hex(h).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Ajusta a cor até ter contraste mínimo com o fundo (texto colorido legível) */
function ink(color: string, bg: string, toward: string) {
  let c = color;
  for (let t = 0.1; contrast(c, bg) < 4.5 && t <= 1; t += 0.1) c = mix(color, toward, t);
  return c;
}

/** Texto em cima da cor: branco quando dá pra ler bem, senão preto */
export const onColor = (c: string) => (contrast(c, "#ffffff") >= 3 ? "#ffffff" : "#000000");

export function brandCss(color: string) {
  const onAccent = onColor(color);
  const light = `--accent:${color};--accent-ink:${ink(color, "#ffffff", "#000000")};--accent-soft:${mix(color, "#ffffff", 0.86)};--on-accent:${onAccent};`;
  const darkAccent = contrast(color, "#000000") < 3 ? mix(color, "#ffffff", 0.35) : color;
  const dark = `--accent:${darkAccent};--accent-ink:${ink(darkAccent, "#1c1c1e", "#ffffff")};--accent-soft:${mix(darkAccent, "#000000", 0.75)};--on-accent:${onColor(darkAccent)};`;
  // "html:root" ganha da folha de estilos padrão, não importa a ordem
  return `html:root{${light}}html:root[data-theme="dark"]{${dark}}@media (prefers-color-scheme: dark){html:root:not([data-theme="light"]){${dark}}}html .report-light{${light}}`;
}

const KEY = "marca";

export function applyBrand(b: Brand | null) {
  let el = document.getElementById("brand-css") as HTMLStyleElement | null;
  if (!b?.color) {
    el?.remove();
  } else {
    if (!el) {
      el = document.createElement("style");
      el.id = "brand-css";
      document.head.appendChild(el);
    }
    el.textContent = brandCss(b.color);
    document.head.appendChild(el);
  }
  try {
    if (b) localStorage.setItem(KEY, JSON.stringify(b));
    else localStorage.removeItem(KEY);
    if (b?.color) localStorage.setItem("marca_css", brandCss(b.color));
    else localStorage.removeItem("marca_css");
  } catch {
    /* sem storage */
  }
}

export function cachedBrand(): Brand | null {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "null");
  } catch {
    return null;
  }
}

/** Marca que vale pra quem está logado: a própria (se for personal) ou a do personal dele */
export async function loadBrand(): Promise<Brand | null> {
  const sb = supabase();
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return null;
  const { data: me } = await sb.from("profiles").select("name,is_trainer,brand_color,brand_logo").eq("id", u.user.id).maybeSingle();
  if (me?.is_trainer && (me.brand_color || me.brand_logo)) return { name: me.name ?? "Personal", color: me.brand_color, logo: logoUrl(me.brand_logo), mine: true };
  const { data } = await sb.rpc("my_brand");
  const b = Array.isArray(data) ? data[0] : data;
  return b ? { name: b.name, color: b.color, logo: logoUrl(b.logo) } : null;
}

export function logoUrl(path: string | null | undefined) {
  if (!path) return null;
  return supabase().storage.from("vitrine").getPublicUrl(path).data.publicUrl;
}

/** Reduz a logo pra no máximo 512 px, mantendo a transparência (PNG) */
export async function prepareLogo(file: File): Promise<Blob> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const k = Math.min(1, 512 / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}
