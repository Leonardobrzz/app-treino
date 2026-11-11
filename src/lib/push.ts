// Notificações push: inscrição no aparelho e disparo dos avisos que esta pessoa gerou
import { supabase } from "./supabase/client";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!KEY;
}

export function pushPermission(): NotificationPermission | "unsupported" {
  return pushSupported() ? Notification.permission : "unsupported";
}

function toBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function registration() {
  return (await navigator.serviceWorker.getRegistration("/")) ?? (await navigator.serviceWorker.register("/sw.js", { scope: "/" }));
}

/** Pede permissão e salva a inscrição deste aparelho. Precisa ser chamado num toque do usuário. */
export async function enablePush(): Promise<"ok" | "negado" | "sem-suporte" | "erro"> {
  if (!pushSupported()) return "sem-suporte";
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "negado";
    const reg = await registration();
    await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(KEY) }));
    const j = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const { data: u } = await supabase().auth.getUser();
    if (!u.user) return "erro";
    await supabase().from("push_subscriptions").upsert({ user_id: u.user.id, endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth }, { onConflict: "endpoint" });
    return "ok";
  } catch {
    return "erro";
  }
}

/** Se a permissão já foi dada, mantém a inscrição deste aparelho salva (quando o navegador troca a chave) */
export async function refreshPush() {
  if (pushPermission() !== "granted") return;
  await enablePush();
}

/** Manda agora os pushes dos avisos que eu acabei de gerar (treino novo, cobrança…) */
export function pushNow() {
  fetch("/api/push", { method: "POST" }).catch(() => {});
}
