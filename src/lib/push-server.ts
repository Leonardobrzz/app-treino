// Envio de push no servidor (web-push). Usado pela rota /api/push e pelo cron diário.
import { sendNotification, setVapidDetails } from "web-push";
import { createClient } from "@supabase/supabase-js";

export type PushRow = { notification_id: string; title: string; body: string | null; url: string | null; endpoint: string; key_p256dh: string; key_auth: string };

let ready = false;
function setup() {
  if (ready) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  setVapidDetails(process.env.VAPID_SUBJECT || "mailto:cargaapp0@gmail.com", pub, priv);
  ready = true;
  return true;
}

export async function sendPushes(rows: PushRow[]) {
  if (!rows.length || !setup()) return { sent: 0, gone: 0 };
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    rows.map(async (r) => {
      try {
        await sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.key_p256dh, auth: r.key_auth } },
          JSON.stringify({ title: r.title, body: r.body ?? "", url: r.url ?? "/avisos", tag: r.notification_id }),
          { TTL: 60 * 60 * 24 },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(r.endpoint);
      }
    }),
  );
  // inscrições mortas (app desinstalado, permissão tirada): apaga
  if (gone.length && process.env.CRON_SECRET) {
    const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
    await Promise.all(gone.map((endpoint) => sb.rpc("drop_push_endpoint", { p_secret: process.env.CRON_SECRET, p_endpoint: endpoint })));
  }
  return { sent, gone: gone.length };
}
