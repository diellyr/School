/**
 * Hash simples via Web Crypto (SHA-256). Suficiente para o modo demo local, onde o
 * objetivo é apenas não gravar senha em texto puro no IndexedDB — não é um substituto
 * para bcrypt/argon2 do backend real. Em produção com Supabase, a senha nunca passa
 * pelo frontend: Supabase Auth cuida do hashing no servidor.
 */
export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
