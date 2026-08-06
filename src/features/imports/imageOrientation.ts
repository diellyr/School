import type { Worker } from 'tesseract.js';

/**
 * Desenha um bitmap rotacionado em N graus (90/180/270) num canvas e devolve como blob JPEG.
 * `maxDim` permite gerar uma versão reduzida para sondagem rápida antes do reconhecimento final.
 */
async function rotateBitmap(bitmap: ImageBitmap, degrees: 0 | 90 | 180 | 270, maxDim?: number): Promise<Blob> {
  const swap = degrees === 90 || degrees === 270;
  let { width, height } = bitmap;
  if (maxDim) {
    const scale = Math.min(1, maxDim / Math.max(width, height));
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }
  const canvas = document.createElement('canvas');
  canvas.width = swap ? height : width;
  canvas.height = swap ? width : height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D não disponível neste navegador.');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(bitmap, -width / 2, -height / 2, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem rotacionada.'))), 'image/jpeg', 0.92);
  });
}

/**
 * Fotos de celular de documentos impressos frequentemente ficam com a orientação correta só na
 * metadata EXIF (que o motor de OCR não usa) ou nem isso. Testa as 4 rotações em baixa resolução
 * (rápido) e usa a própria confiança do Tesseract para escolher a melhor antes do reconhecimento
 * final em resolução completa — validado contra fotos reais de boletins impressos, onde a foto sem
 * correção de rotação cai para menos da metade da confiança da orientação correta.
 */
export async function pickBestOrientation(worker: Worker, file: File): Promise<{ blob: Blob; rotationDeg: 0 | 90 | 180 | 270 }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    let best: { deg: 0 | 90 | 180 | 270; conf: number } = { deg: 0, conf: -1 };
    for (const deg of [0, 90, 180, 270] as const) {
      const probeBlob = await rotateBitmap(bitmap, deg, 900);
      const { data } = await worker.recognize(probeBlob, {}, { text: true });
      if (data.confidence > best.conf) best = { deg, conf: data.confidence };
    }
    const fullBlob = await rotateBitmap(bitmap, best.deg);
    return { blob: fullBlob, rotationDeg: best.deg };
  } finally {
    bitmap.close();
  }
}
