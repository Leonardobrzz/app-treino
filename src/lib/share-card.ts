/** Gera a imagem 1080×1920 do treino pra postar no story */

export type CardData = {
  title: string;
  dateLabel: string;
  volumeKg: number;
  sets: number;
  minutes: number;
  prs: string[];
  streakWeeks?: number;
  exercises?: { name: string; best: string }[];
};

const W = 1080;
const H = 1920;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number, size: number, weight: number, family: string) {
  let s = size;
  ctx.font = `${weight} ${s}px ${family}`;
  while (ctx.measureText(text).width > max && s > 40) {
    s -= 4;
    ctx.font = `${weight} ${s}px ${family}`;
  }
  return s;
}

function ellipsis(ctx: CanvasRenderingContext2D, text: string, max: number) {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > max) t = t.slice(0, -1);
  return t + "…";
}

const fmt = (v: number, d = 1) => v.toLocaleString("pt-BR", { minimumFractionDigits: v % 1 === 0 ? 0 : d, maximumFractionDigits: d });

export async function drawWorkoutCard(d: CardData): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready;
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;

  // fundo
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#1a1410");
  bg.addColorStop(0.55, "#0d0d0f");
  bg.addColorStop(1, "#000000");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, 260, 20, W * 0.85, 260, 900);
  glow.addColorStop(0, "rgba(255,149,0,0.55)");
  glow.addColorStop(1, "rgba(255,149,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const pad = 96;
  ctx.textBaseline = "alphabetic";

  // marca
  roundRect(ctx, pad, 150, 92, 92, 26);
  ctx.fillStyle = "#FF9500";
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.font = `800 60px ${family}`;
  ctx.textAlign = "center";
  ctx.fillText("C", pad + 46, 218);
  ctx.textAlign = "left";
  ctx.fillStyle = "#fff";
  ctx.font = `700 52px ${family}`;
  ctx.fillText("Carga", pad + 120, 214);

  // título
  const pr = d.prs.length > 0;
  ctx.fillStyle = "#FF9500";
  ctx.font = `700 40px ${family}`;
  ctx.fillText((pr ? "NOVO RECORDE · " : "TREINO CONCLUÍDO · ") + d.dateLabel.toUpperCase(), pad, 470);
  ctx.fillStyle = "#fff";
  const ts = fit(ctx, d.title, W - pad * 2, 112, 800, family);
  ctx.fillText(ellipsis(ctx, d.title, W - pad * 2), pad, 470 + ts + 30);

  // números
  const stats: [string, string, string][] = [
    ["Volume", d.volumeKg >= 1000 ? fmt(d.volumeKg / 1000) : fmt(d.volumeKg, 0), d.volumeKg >= 1000 ? "toneladas" : "kg"],
    ["Séries", String(d.sets), "concluídas"],
    ["Tempo", String(d.minutes), "minutos"],
  ];
  const top = 800;
  const cw = (W - pad * 2 - 40) / 3;
  stats.forEach(([label, value, unit], i) => {
    const x = pad + i * (cw + 20);
    roundRect(ctx, x, top, cw, 300, 40);
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    ctx.fill();
    ctx.fillStyle = "rgba(235,235,245,0.6)";
    ctx.font = `600 34px ${family}`;
    ctx.fillText(label, x + 36, top + 70);
    ctx.fillStyle = "#fff";
    fit(ctx, value, cw - 72, 110, 800, family);
    ctx.fillText(value, x + 36, top + 200);
    ctx.fillStyle = "rgba(235,235,245,0.6)";
    ctx.font = `500 32px ${family}`;
    ctx.fillText(unit, x + 36, top + 254);
  });

  // recordes e exercícios
  let y = top + 390;
  const rowH = 104;
  const maxY = H - 260;
  if (pr) {
    ctx.fillStyle = "#FF9500";
    ctx.font = `700 40px ${family}`;
    ctx.fillText("🏆  Recordes de hoje", pad, y);
    y += 30;
    for (const name of d.prs.slice(0, 3)) {
      roundRect(ctx, pad, y, W - pad * 2, rowH - 14, 28);
      ctx.fillStyle = "rgba(255,149,0,0.18)";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `600 42px ${family}`;
      ctx.fillText(ellipsis(ctx, name, W - pad * 2 - 80), pad + 36, y + 60);
      y += rowH;
    }
    y += 40;
  }
  const ex = (d.exercises ?? []).filter((e) => !d.prs.includes(e.name));
  if (ex.length && y + 120 < maxY) {
    ctx.fillStyle = "rgba(235,235,245,0.6)";
    ctx.font = `700 36px ${family}`;
    ctx.fillText("EXERCÍCIOS", pad, y);
    y += 26;
    const fit2 = Math.max(0, Math.floor((maxY - y) / 92));
    for (const e of ex.slice(0, fit2)) {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(pad, y, W - pad * 2, 2);
      ctx.font = `600 40px ${family}`;
      ctx.fillStyle = "#fff";
      const right = e.best;
      ctx.font = `500 34px ${family}`;
      const rw = ctx.measureText(right).width;
      ctx.fillStyle = "rgba(235,235,245,0.7)";
      ctx.fillText(right, W - pad - rw, y + 62);
      ctx.font = `600 40px ${family}`;
      ctx.fillStyle = "#fff";
      ctx.fillText(ellipsis(ctx, e.name, W - pad * 2 - rw - 30), pad, y + 62);
      y += 92;
    }
  } else if (!pr && d.streakWeeks && d.streakWeeks > 1) {
    ctx.fillStyle = "#fff";
    ctx.font = `700 64px ${family}`;
    ctx.fillText(`🔥 ${d.streakWeeks} semanas seguidas`, pad, y + 40);
  }

  // rodapé
  ctx.fillStyle = "rgba(235,235,245,0.55)";
  ctx.font = `500 36px ${family}`;
  ctx.fillText("Registrado no Carga — treino, carga e evolução", pad, H - 150);
  ctx.fillStyle = "#FF9500";
  ctx.font = `700 40px ${family}`;
  ctx.fillText(location.host, pad, H - 95);

  return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
}

/** Abre o compartilhamento do celular (Instagram, WhatsApp…) ou baixa a imagem */
export async function shareImage(blob: Blob, filename: string, text: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return "shared";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
  return "downloaded";
}
