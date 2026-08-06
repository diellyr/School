export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * `crypto.subtle` exige contexto seguro (HTTPS) e não está disponível em alguns navegadores
 * embutidos de apps (WebViews mais antigas de redes sociais/mensageiros) mesmo em HTTPS — sem
 * esse retorno alternativo, um upload nesses navegadores travava no meio (o arquivo já podia ter
 * sido usado para cadastrar aluno/escola antes de chegar aqui, mas o documento nunca era anexado,
 * sem nenhum aviso). O hash aqui só serve para detectar duplicidade, não para segurança — um
 * identificador simples a partir de nome/tamanho/data ainda cumpre esse papel quando o SHA-256
 * real não está disponível.
 */
export async function sha256OfFile(file: File): Promise<string> {
  if (!crypto.subtle) return fallbackFileId(file);
  try {
    const buffer = await file.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return fallbackFileId(file);
  }
}

function fallbackFileId(file: File): string {
  return `fallback-${file.name}-${file.size}-${file.lastModified}`;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
