import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase do lado do navegador — usa SOMENTE a chave pública (anon key),
 * nunca a service role key. Operações privilegiadas (exclusão definitiva, alteração de
 * permissões de outros usuários, relatórios entre organizações) devem ser feitas por
 * Edge Functions/RPCs autenticadas, nunca diretamente daqui.
 *
 * Fica indefinido enquanto VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY não estiverem
 * configuradas — nesse caso o RepositoryProvider usa somente Local*Repository
 * (IndexedDB), exatamente como hoje. Nenhum comportamento muda até essas variáveis
 * serem definidas em um `.env.local` (nunca commitado).
 */
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null;
