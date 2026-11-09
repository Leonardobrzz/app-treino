// Detecção de plataforma e suporte à instalação do PWA ("adicionar à tela de início").

export type Platform =
  | "standalone" // já está aberto como app instalado
  | "ios-safari"
  | "ios-chrome"
  | "ios-other"
  | "android"
  | "android-samsung"
  | "in-app-ios" // navegador interno do Instagram/Facebook/TikTok no iPhone
  | "in-app-android"
  | "desktop";

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

declare global {
  interface Window {
    __carga_bip?: InstallPromptEvent | null;
  }
}

export const INTRO_KEY = "carga:intro";

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

export function detectPlatform(): Platform {
  if (typeof window === "undefined") return "desktop";
  if (isStandalone()) return "standalone";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/i.test(ua);
  const inApp = /Instagram|FBAN|FBAV|FB_IAB|FBIOS|TikTok|musical_ly|BytedanceWebview|Threads|LinkedInApp/i.test(ua);
  if (ios) {
    if (inApp) return "in-app-ios";
    if (/CriOS/i.test(ua)) return "ios-chrome";
    if (/FxiOS|EdgiOS|OPiOS|GSA\//i.test(ua)) return "ios-other";
    return "ios-safari";
  }
  if (android) {
    if (inApp || /; wv\)/.test(ua)) return "in-app-android";
    if (/SamsungBrowser/i.test(ua)) return "android-samsung";
    return "android";
  }
  return "desktop";
}

export function installPrompt(): InstallPromptEvent | null {
  return typeof window !== "undefined" ? (window.__carga_bip ?? null) : null;
}

export function introSeen(): boolean {
  try {
    return localStorage.getItem(INTRO_KEY) === "1";
  } catch {
    return true;
  }
}

export function markIntroSeen() {
  try {
    localStorage.setItem(INTRO_KEY, "1");
  } catch {
    /* sem storage */
  }
}
