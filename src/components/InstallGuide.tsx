"use client";

import { motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui";
import { detectPlatform, installPrompt, type Platform } from "@/lib/install";

const SITE = "carga.app.br";

/** Ícone "de verdade" que aparece no meio do texto, pra pessoa achar o botão na tela. */
function Chip({ icon, label }: { icon: IconName; label?: string }) {
  return (
    <span className="mx-0.5 inline-flex translate-y-[3px] items-center gap-1 rounded-md bg-card-2 px-1.5 py-0.5 align-baseline text-[14px] font-semibold text-label">
      <Icon name={icon} size={15} stroke={icon === "dots" || icon === "kebab" ? 3.4 : 2.2} className="text-[#0a84ff]" />
      {label}
    </span>
  );
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {items.map((it, i) => (
        <motion.li
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 + i * 0.12 }}
          className="flex items-start gap-3 rounded-2xl bg-card p-4"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent text-[15px] font-bold text-on-accent">{i + 1}</span>
          <span className="pt-0.5 text-[16px] leading-relaxed text-label">{it}</span>
        </motion.li>
      ))}
    </ol>
  );
}

/** Ilustração: tela de início com o ícone do Carga. */
export function HomeScreenArt() {
  return (
    <div className="relative mx-auto h-[150px] w-[220px] overflow-hidden rounded-t-[30px] border-x-[6px] border-t-[6px] border-label/85 bg-gradient-to-b from-[#ffb347] to-[#ff7a00] px-5 pt-6">
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <span key={i} className="aspect-square rounded-[10px] bg-white/35" />
        ))}
        <motion.span
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.3 }}
          className="relative flex aspect-square items-center justify-center rounded-[10px] bg-[#111113] shadow-[0_6px_16px_rgba(0,0,0,.35)]"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#FF9500" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
            <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
          </svg>
        </motion.span>
      </div>
      <div className="mt-1 grid grid-cols-4 text-center text-[8px] font-semibold text-white">
        <span className="col-start-4">Carga</span>
      </div>
    </div>
  );
}

function CopyLink() {
  const [ok, setOk] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(`https://${SITE}`);
          setOk(true);
          setTimeout(() => setOk(false), 2000);
        } catch {
          /* sem clipboard */
        }
      }}
      className="press flex h-12 items-center justify-center gap-2 rounded-xl bg-card text-[16px] font-semibold text-accent-ink"
    >
      <Icon name={ok ? "check" : "copy"} size={18} /> {ok ? "Link copiado" : `Copiar link ${SITE}`}
    </button>
  );
}

export function InstallGuide({ onInstalled }: { onInstalled?: () => void }) {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [canPrompt, setCanPrompt] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const sync = () => {
      setPlatform(detectPlatform());
      setCanPrompt(!!installPrompt());
    };
    const done = () => {
      setInstalled(true);
      onInstalled?.();
    };
    sync();
    window.addEventListener("carga:bip", sync);
    window.addEventListener("carga:installed", done);
    return () => {
      window.removeEventListener("carga:bip", sync);
      window.removeEventListener("carga:installed", done);
    };
  }, [onInstalled]);

  async function install() {
    const ev = installPrompt();
    if (!ev) return;
    await ev.prompt();
    const { outcome } = await ev.userChoice;
    window.__carga_bip = null;
    setCanPrompt(false);
    if (outcome === "accepted") {
      setInstalled(true);
      onInstalled?.();
    }
  }

  if (!platform) return <div className="h-40" />;

  if (installed || platform === "standalone")
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-card p-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-good/15 text-good">
          <Icon name="check" size={28} stroke={3} />
        </span>
        <p className="text-[18px] font-semibold">O Carga já está na sua tela de início.</p>
        <p className="text-[15px] text-label-2">Abra sempre pelo ícone: fica em tela cheia, mais rápido e sem a barra do navegador.</p>
      </div>
    );

  const native = canPrompt && (
    <motion.button
      whileTap={{ scale: 0.97 }}
      onClick={install}
      className="flex h-[56px] items-center justify-center gap-2 rounded-2xl bg-accent text-[18px] font-bold text-on-accent shadow-[0_12px_30px_-10px_var(--accent)]"
    >
      <Icon name="download" size={20} stroke={2.6} /> Instalar o Carga
    </motion.button>
  );

  const or = canPrompt && <p className="text-center text-[14px] text-label-2">Se o botão não abrir nada, faça na mão:</p>;

  let body: ReactNode;
  switch (platform) {
    case "ios-safari":
      body = (
        <Steps
          items={[
            <>
              Toque em <Chip icon="share" label="Compartilhar" /> na barra do Safari. Se não aparecer, toque antes em <Chip icon="dots" />.
            </>,
            <>
              Role a lista e toque em <Chip icon="plusSquare" label="Adicionar à Tela de Início" />.
            </>,
            <>
              Deixe <b>Abrir como App Web</b> ligado e toque em <b>Adicionar</b>.
            </>,
          ]}
        />
      );
      break;
    case "ios-chrome":
      body = (
        <Steps
          items={[
            <>
              Toque em <Chip icon="share" label="Compartilhar" /> ao lado do endereço, lá em cima.
            </>,
            <>
              Toque em <Chip icon="plusSquare" label="Adicionar à Tela de Início" /> (se não estiver na lista, procure em <b>Mais</b>).
            </>,
            <>
              Toque em <b>Adicionar</b>.
            </>,
          ]}
        />
      );
      break;
    case "ios-other":
      body = (
        <Steps
          items={[
            <>
              Abra <b>{SITE}</b> no <b>Safari</b> (é por ele que o iPhone instala melhor).
            </>,
            <>
              Toque em <Chip icon="share" label="Compartilhar" /> e depois em <Chip icon="plusSquare" label="Adicionar à Tela de Início" />.
            </>,
            <>
              Toque em <b>Adicionar</b>.
            </>,
          ]}
        />
      );
      break;
    case "in-app-ios":
    case "in-app-android":
      body = (
        <>
          <div className="rounded-2xl bg-accent-soft p-4 text-[15px] leading-relaxed text-label">
            Você abriu pelo navegador do Instagram (ou de outra rede social), e ele <b>não deixa instalar apps</b>. Abra no navegador do celular primeiro:
          </div>
          <Steps
            items={[
              <>
                Toque em <Chip icon={platform === "in-app-ios" ? "dots" : "kebab"} /> no canto de cima da tela.
              </>,
              platform === "in-app-ios" ? (
                <>
                  Escolha <b>Abrir no navegador externo</b> (ou <b>Abrir no Safari</b>).
                </>
              ) : (
                <>
                  Escolha <b>Abrir no Chrome</b> (ou <b>Abrir no navegador</b>).
                </>
              ),
              <>
                Entre na sua conta por lá e vá em <b>Perfil → Instalar na tela de início</b>.
              </>,
            ]}
          />
          <CopyLink />
        </>
      );
      break;
    case "android-samsung":
      body = (
        <Steps
          items={[
            <>
              Toque em <Chip icon="menu" /> na barra de baixo do navegador.
            </>,
            <>
              Toque em <b>Adicionar página a</b> e escolha <b>Tela inicial</b>.
            </>,
            <>
              Confirme em <b>Adicionar</b>.
            </>,
          ]}
        />
      );
      break;
    case "android":
      body = (
        <Steps
          items={[
            <>
              Toque em <Chip icon="kebab" /> no canto de cima do Chrome.
            </>,
            <>
              Toque em <Chip icon="download" label="Instalar app" /> (em alguns celulares aparece <b>Adicionar à tela inicial</b>).
            </>,
            <>
              Confirme em <b>Instalar</b>.
            </>,
          ]}
        />
      );
      break;
    default:
      body = (
        <>
          <div className="flex items-start gap-3 rounded-2xl bg-card p-4 text-[15px] leading-relaxed text-label">
            <Icon name="phone" size={22} className="mt-0.5 shrink-0 text-accent-ink" />
            <span>
              O Carga foi feito pra usar no celular, na academia. Abra <b>{SITE}</b> no navegador do seu celular e entre com a mesma conta: o passo a passo aparece lá.
            </span>
          </div>
          {!canPrompt && <p className="text-[14px] text-label-2">No computador, dá pra instalar pelo ícone de instalar na barra de endereço do Chrome ou do Edge.</p>}
        </>
      );
  }

  return (
    <div className="flex flex-col gap-4">
      {native}
      {or}
      {body}
    </div>
  );
}
