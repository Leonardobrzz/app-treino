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
  /** "06:51" */
  time?: string;
  exerciseCount?: number;
  /** quantos treinos no mês, contando este */
  monthCount?: number;
};

export const durationLabel = (m: number) => ((min) => min >= 60 ? `${Math.floor(min / 60)}h ${String(min % 60).padStart(2, "0")}min` : `${min} min`)(Math.max(1, Math.round(m)));

/** Logo do Carga (haltere) num quadrado laranja */
function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, family: string, word = true) {
  roundRect(ctx, x, y, size, size, size * 0.28);
  ctx.fillStyle = "#FF9500";
  ctx.fill();
  ctx.save();
  ctx.translate(x + size * 0.14, y + size * 0.14);
  const k = (size * 0.72) / 24;
  ctx.scale(k, k);
  ctx.strokeStyle = "#111113";
  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  ctx.stroke(new Path2D("M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12"));
  ctx.restore();
  if (word) {
    ctx.fillStyle = "#fff";
    ctx.font = `800 ${Math.round(size * 0.56)}px ${family}`;
    ctx.textAlign = "left";
    ctx.fillText("Carga", x + size * 1.25, y + size * 0.72);
  }
}

/** Endereço mostrado na imagem (em teste local, mostra o do app publicado) */
const siteHost = () => (/^(localhost|127\.|192\.168\.)/.test(location.host) ? "carga.app.br" : location.host);

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
  drawLogo(ctx, pad, 150, 92, family);

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
    ["Tempo", String(Math.max(1, Math.round(d.minutes))), "minutos"],
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
  ctx.fillText(siteHost(), pad, H - 95);

  return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
}

function loadImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = url;
  });
}

/** Story com a foto da pessoa no fundo, no estilo "treino concluído" */
export async function drawPhotoStory(d: CardData, photo: Blob): Promise<Blob> {
  if (document.fonts?.ready) await document.fonts.ready;
  const family = getComputedStyle(document.body).fontFamily || "system-ui, sans-serif";
  const img = await loadImage(photo);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, W, H);
  // foto cobrindo a tela inteira (corta as sobras)
  const r = Math.max(W / img.width, H / img.height);
  const iw = img.width * r;
  const ih = img.height * r;
  ctx.drawImage(img, (W - iw) / 2, (H - ih) / 2, iw, ih);
  URL.revokeObjectURL(img.src);
  // escurece em cima (logo) e embaixo (texto)
  const topG = ctx.createLinearGradient(0, 0, 0, 380);
  topG.addColorStop(0, "rgba(0,0,0,0.55)");
  topG.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = topG;
  ctx.fillRect(0, 0, W, 380);
  const botG = ctx.createLinearGradient(0, H - 900, 0, H);
  botG.addColorStop(0, "rgba(0,0,0,0)");
  botG.addColorStop(0.45, "rgba(0,0,0,0.55)");
  botG.addColorStop(1, "rgba(0,0,0,0.88)");
  ctx.fillStyle = botG;
  ctx.fillRect(0, H - 900, W, 900);

  const pad = 80;
  ctx.textBaseline = "alphabetic";
  drawLogo(ctx, pad, 120, 84, family);

  // de baixo pra cima: números, data, nome do treino, selo
  const pr = d.prs.length > 0;
  const rowY = H - 120;
  const dateY = rowY - 110;

  // nome do treino (até 2 linhas)
  let size = 104;
  ctx.font = `800 ${size}px ${family}`;
  const words = d.title.split(" ");
  const lines: string[] = [];
  const wrap = () => {
    lines.length = 0;
    let cur = "";
    for (const w of words) {
      const t = cur ? cur + " " + w : w;
      if (ctx.measureText(t).width > W - pad * 2 && cur) {
        lines.push(cur);
        cur = w;
      } else cur = t;
    }
    lines.push(cur);
  };
  // cabe numa linha só com fonte um pouco menor? prefere assim
  if (ctx.measureText(d.title).width > W - pad * 2) {
    const one = fit(ctx, d.title, W - pad * 2, size, 800, family);
    if (one >= 84) size = one;
    ctx.font = `800 ${size}px ${family}`;
  }
  wrap();
  while (lines.length > 2 && size > 64) {
    size -= 8;
    ctx.font = `800 ${size}px ${family}`;
    wrap();
  }
  const shown = lines.slice(0, 2);
  const lineH = size * 1.06;
  const lastBase = dateY - 78;
  const firstBase = lastBase - (shown.length - 1) * lineH;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 18;
  shown.forEach((l, k) => ctx.fillText(ellipsis(ctx, l, W - pad * 2), pad, firstBase + k * lineH));
  ctx.shadowBlur = 0;

  // selo
  const tag = pr ? "NOVO RECORDE" : "TREINO CONCLUÍDO";
  ctx.font = `800 38px ${family}`;
  ctx.letterSpacing = "4px";
  const tw = ctx.measureText(tag).width;
  const tagY = firstBase - size * 0.82 - 40 - 84;
  roundRect(ctx, pad, tagY, tw + 84, 84, 42);
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#FF9500";
  ctx.stroke();
  if (pr) {
    ctx.fillStyle = "rgba(255,149,0,0.25)";
    ctx.fill();
  }
  ctx.fillStyle = "#FF9500";
  ctx.fillText(tag, pad + 42, tagY + 56);
  ctx.letterSpacing = "0px";

  // data e hora
  ctx.fillStyle = "rgba(255,255,255,0.78)";
  ctx.font = `500 52px ${family}`;
  ctx.fillText([d.dateLabel, d.time].filter(Boolean).join("  ·  "), pad, dateY);

  // números com ícones
  const exN = d.exerciseCount ?? d.exercises?.length ?? 0;
  const items: [string, string][] = [
    ...(exN > 0 ? ([["check", `${exN} ${exN === 1 ? "exercício" : "exercícios"}`]] as [string, string][]) : []),
    ["clock", durationLabel(d.minutes)],
    ...(d.monthCount ? ([["flame", `${d.monthCount}º no mês`]] as [string, string][]) : []),
  ];
  const ICON: Record<string, string> = {
    check: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8 12.5l2.6 2.6L16 9.6",
    clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 7v5l3 2",
    flame: "M12 22c4 0 7-2.7 7-7 0-3.5-2.2-5.6-3.6-7.6-.4 1.6-1.3 2.8-2.6 3.3.3-3.3-1.1-6.4-3.8-8.7.2 3.2-1.4 5.3-3 7.2C4.8 11.4 5 13 5 15c0 4.3 3 7 7 7z",
  };
  ctx.font = `600 50px ${family}`;
  const total = items.reduce((acc, [, label], i) => acc + (i ? 36 : 0) + 74 + ctx.measureText(label).width + (i < items.length - 1 ? 34 : 0), 0);
  const f = Math.min(1, (W - pad * 2) / total);
  ctx.save();
  ctx.translate(pad, rowY);
  ctx.scale(f, f);
  ctx.translate(-pad, -rowY);
  let x = pad;
  items.forEach(([ic, label], i) => {
    if (i) {
      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(x + 4, rowY - 16, 5, 0, Math.PI * 2);
      ctx.fill();
      x += 36;
    }
    ctx.save();
    ctx.translate(x, rowY - 52);
    ctx.scale(2.4, 2.4);
    ctx.strokeStyle = "#FF9500";
    ctx.lineWidth = 1.9;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke(new Path2D(ICON[ic]));
    ctx.restore();
    x += 74;
    ctx.fillStyle = "#fff";
    ctx.fillText(label, x, rowY);
    x += ctx.measureText(label).width + 34;
  });
  ctx.restore();

  // site, discreto, no alto à direita
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.font = `600 36px ${family}`;
  ctx.textAlign = "right";
  ctx.fillText(siteHost(), W - pad, 176);
  ctx.textAlign = "left";

  return await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", 0.92));
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
