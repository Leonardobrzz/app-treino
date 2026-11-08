import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Carga — seus treinos",
    short_name: "Carga",
    description: "Treinos, progressão de carga, medidas e IA para montar sua semana.",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f2f7",
    theme_color: "#ff9500",
    lang: "pt-BR",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
