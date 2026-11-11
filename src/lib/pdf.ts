// Transforma as páginas A4 (seções com data-report-page) num PDF e abre o compartilhar do celular
import { PAGE_H, PAGE_W } from "@/components/ReportPages";

export async function exportPdf(container: HTMLElement, filename: string, title: string): Promise<"compartilhado" | "baixado"> {
  const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
  const nodes = [...container.querySelectorAll<HTMLElement>("[data-report-page]")];
  const pdf = new jsPDF({ unit: "pt", format: "a4", compress: true });
  for (let i = 0; i < nodes.length; i++) {
    const img = await toJpeg(nodes[i], { pixelRatio: 2, quality: 0.9, backgroundColor: "#ffffff", width: PAGE_W, height: PAGE_H, style: { transform: "none" } });
    if (i) pdf.addPage();
    pdf.addImage(img, "JPEG", 0, 0, pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight());
  }
  const blob = pdf.output("blob");
  const file = new File([blob], filename, { type: "application/pdf" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
    } catch {
      /* fechou o compartilhar */
    }
    return "compartilhado";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "baixado";
}

export const slug = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
