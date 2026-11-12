"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Button, Icon, Segmented, Sheet } from "@/components/ui";
import { drawPhotoStory, drawWorkoutCard, shareImage, type CardData } from "@/lib/share-card";
import { shrinkImage } from "@/lib/image";

type Mode = "foto" | "numeros";

/** Monta a imagem do story (com foto ou só com os números) e abre o compartilhar do celular */
export function StorySheet({ open, onClose, data, filename }: { open: boolean; onClose: () => void; data: CardData | null; filename: string }) {
  const [mode, setMode] = useState<Mode>("foto");
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [img, setImg] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const file = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !data) return;
    if (mode === "foto" && !photo) {
      setImg(null);
      return;
    }
    let off = false;
    setBusy(true);
    setMsg("");
    (mode === "foto" && photo ? drawPhotoStory(data, photo) : drawWorkoutCard(data))
      .then((blob) => {
        if (off) return;
        setImg((old) => {
          if (old) URL.revokeObjectURL(old.url);
          return { blob, url: URL.createObjectURL(blob) };
        });
      })
      .catch(() => !off && setMsg("Não consegui montar a imagem. Tente outra foto."))
      .finally(() => !off && setBusy(false));
    return () => {
      off = true;
    };
  }, [open, data, mode, photo]);

  async function pick(f?: File) {
    if (!f) return;
    try {
      const r = await shrinkImage(f, 1920, 0.9);
      setPhoto(r.blob);
    } catch {
      setMsg("Não consegui abrir essa foto.");
    }
  }

  async function share() {
    if (!img || !data) return;
    const r = await shareImage(img.blob, filename, data.prs.length ? `Recorde no ${data.prs[0]}! 🏆` : `Treino de hoje: ${data.title} ✅`);
    if (r === "downloaded") setMsg("Imagem salva. Agora é só postar no story.");
  }

  return (
    <Sheet open={open} onClose={onClose} title="Postar no story">
      <div className="flex flex-col gap-3 pt-1">
        <Segmented<Mode>
          value={mode}
          onChange={setMode}
          options={[
            { value: "foto", label: "Com foto" },
            { value: "numeros", label: "Só os números" },
          ]}
        />
        <input ref={file} type="file" accept="image/*" className="hidden" data-testid="story-foto" onChange={(e) => pick(e.target.files?.[0])} />

        <div className="relative mx-auto aspect-[9/16] w-[min(62vw,240px)] overflow-hidden rounded-[22px] bg-card shadow-lg">
          <AnimatePresence mode="wait">
            {img ? (
              <motion.img key={img.url} src={img.url} alt="Prévia do story" initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="h-full w-full object-cover" />
            ) : mode === "foto" ? (
              <motion.button key="pick" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => file.current?.click()} className="press absolute inset-0 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-fill p-5 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
                  <Icon name="camera" size={26} />
                </span>
                <span className="text-[15px] font-semibold">Tirar ou escolher foto</span>
                <span className="text-[13px] leading-snug text-label-2">A foto do espelho da academia fica ótima</span>
              </motion.button>
            ) : null}
          </AnimatePresence>
          {busy && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            </div>
          )}
        </div>

        {mode === "foto" && photo && (
          <button onClick={() => file.current?.click()} className="press mx-auto flex h-9 items-center gap-1.5 rounded-full bg-card px-4 text-[14px] font-semibold text-accent-ink">
            <Icon name="camera" size={16} /> Trocar foto
          </button>
        )}

        <Button size="lg" disabled={!img || busy} onClick={share}>
          <Icon name="share" size={18} /> Compartilhar
        </Button>
        <p className="text-center text-[13px] leading-snug text-label-2">{msg || "No celular, escolha Instagram e depois Story."}</p>
      </div>
    </Sheet>
  );
}
