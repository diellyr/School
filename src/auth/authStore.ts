import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppUser, SystemRole } from '../domain';
import { DEMO_CREDENTIALS } from './demoUsers';
import { db } from '../db/schema';
import { sha256Hex } from '../lib/hash';

export const MAX_LOGIN_ATTEMPTS = 5;
export const SESSION_TTL_MINUTES = 60;

export interface Session {
  user: AppUser;
  role: SystemRole;
  loginAt: string;
  expiresAt: string;
}

interface AuthState {
  session: Session | null;
  rememberMe: boolean;
  isDemoMode: boolean;
  setSession: (session: Session | null) => void;
  setRememberMe: (value: boolean) => void;
  logout: () => void;
  isSessionValid: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      rememberMe: true,
      isDemoMode: true,
      setSession: (session) => set({ session }),
      setRememberMe: (value) => set({ rememberMe: value }),
      logout: () => set({ session: null }),
      isSessionValid: () => {
        const { session } = get();
        if (!session) return false;
        return new Date(session.expiresAt).getTime() > Date.now();
      },
    }),
    {
      name: 'school-tracker-auth',
      partialize: (state) => (state.rememberMe ? { session: state.session, rememberMe: state.rememberMe } : { rememberMe: state.rememberMe }),
    },
  ),
);

export class InvalidCredentialsError extends Error {}
export class AccountBlockedError extends Error {}

/**
 * Autenticação simulada do modo demo local (Dexie). A mesma assinatura de resultado
 * (Session) é o que a futura integração com Supabase Auth deverá produzir, para que
 * a tela de login e o restante do app não mudem quando o backend real entrar.
 */
export async function loginWithPassword(email: string, password: string): Promise<Session> {
  const normalized = email.trim().toLowerCase();
  let user = await db.users.where('email').equals(normalized).first();

  if (!user) {
    const demo = DEMO_CREDENTIALS.find((c) => c.email.toLowerCase() === normalized);
    if (!demo) throw new InvalidCredentialsError('E-mail ou senha inválidos.');
    user = await db.users.get(demo.id);
    if (!user) throw new InvalidCredentialsError('Usuário de demonstração não encontrado. Carregue os dados de demonstração.');
  }

  if (user.isBlocked) {
    throw new AccountBlockedError('Este usuário está bloqueado. Fale com o administrador.');
  }

  const hash = await sha256Hex(password);
  if (hash !== user.passwordHash) {
    const attempts = user.failedLoginAttempts + 1;
    const isBlocked = attempts >= MAX_LOGIN_ATTEMPTS;
    await db.users.update(user.id, { failedLoginAttempts: attempts, isBlocked });
    if (isBlocked) {
      throw new AccountBlockedError('Muitas tentativas inválidas. Usuário bloqueado por segurança.');
    }
    throw new InvalidCredentialsError('E-mail ou senha inválidos.');
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MINUTES * 60_000);
  await db.users.update(user.id, { failedLoginAttempts: 0, lastLoginAt: now.toISOString() });
  const refreshed = await db.users.get(user.id);

  return {
    user: refreshed!,
    role: refreshed!.role,
    loginAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export function useIsAuthenticated(): boolean {
  const isValid = useAuthStore((s) => s.isSessionValid());
  return isValid;
}
