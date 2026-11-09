import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

const THEME_SCRIPT = `try{var t=localStorage.getItem("tema");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
// Guarda o pedido de instalação do navegador (Android/Chrome) para o botão "Instalar" do guia.
const INSTALL_SCRIPT = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__carga_bip=e;window.dispatchEvent(new Event("carga:bip"))});window.addEventListener("appinstalled",function(){window.__carga_bip=null;window.dispatchEvent(new Event("carga:installed"))});`;

export const metadata: Metadata = {
  title: "Carga — seus treinos",
  description: "Registre treinos, acompanhe a evolução da carga e das medidas e monte sua semana com IA.",
  appleWebApp: { capable: true, title: "Carga", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f2f2f7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: INSTALL_SCRIPT }} />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
