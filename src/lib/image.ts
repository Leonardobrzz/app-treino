/** Reduz a foto no próprio aparelho antes de enviar (mais rápido e barato). Devolve JPEG em base64. */
export async function shrinkImage(file: Blob, max = 1024, quality = 0.82): Promise<{ data: string; preview: string; blob: Blob }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * k);
    c.height = Math.round(img.naturalHeight * k);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    const preview = c.toDataURL("image/jpeg", quality);
    const blob = await new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/jpeg", quality));
    return { data: preview.split(",")[1], preview, blob };
  } finally {
    URL.revokeObjectURL(url);
  }
}
