/**
 * Aponta o Tesseract.js para os arquivos hospedados no próprio app (public/tessdata/) em vez do
 * CDN padrão (jsdelivr) — funciona em ambientes com saída de rede restrita e evita depender de um
 * serviço externo só para reconhecer texto em uma imagem. Usa o mesmo prefixo de base do Vite
 * (import.meta.env.BASE_URL) que já é aplicado ao worker do PDF.js.
 */
export const TESSERACT_LOCAL_OPTIONS = {
  workerPath: `${import.meta.env.BASE_URL}tessdata/worker.min.js`,
  corePath: `${import.meta.env.BASE_URL}tessdata/tesseract-core-lstm.wasm.js`,
  langPath: `${import.meta.env.BASE_URL}tessdata`,
};
