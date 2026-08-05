import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppUser, Organization, SystemRole } from '../domain';
import { DEMO_CREDENTIALS } from './demoUsers';
import { db } from '../db/schema';
import { sha256Hex } from '../lib/hash';
import { newId, nowIso } from '../domain/common';

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
export class EmailAlreadyExistsError extends Error {}

/**
 * Cria uma conta real (não-demo) com sua própria organização e já retorna a sessão
 * autenticada — permite começar a usar o sistema (e importar dados reais) sem depender
 * dos dados de demonstração, que continuam disponíveis como opção separada em
 * Configurações depois do login. O primeiro usuário de uma organização nova é sempre
 * Owner, dono da própria conta que acabou de criar.
 */
export async function createAccountAndLogin(input: {
  fullName: string;
  organizationName: string;
  email: string;
  password: string;
}): Promise<Session> {
  const normalized = input.email.trim().toLowerCase();
  const existing = await db.users.where('email').equals(normalized).first();
  if (existing) throw new EmailAlreadyExistsError('Já existe uma conta com este e-mail.');

  const now = nowIso();
  const userId = newId();
  const organizationId = newId();
  const passwordHash = await sha256Hex(input.password);

  const organization: Organization = {
    id: organizationId,
    organizationId,
    name: input.organizationName.trim(),
    cloudStorageEnabled: false,
    retentionPolicyDays: 1825,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
    version: 1,
    status: 'active',
    isDemo: false,
  };

  const user: AppUser = {
    id: userId,
    organizationId,
    fullName: input.fullName.trim(),
    email: normalized,
    role: 'owner',
    passwordHash,
    isDemo: false,
    isBlocked: false,
    failedLoginAttempts: 0,
    createdAt: now,
    updatedAt: now,
    createdBy: userId,
    updatedBy: userId,
    version: 1,
    status: 'active',
  };

  await db.transaction('rw', db.organizations, db.users, async () => {
    await db.organizations.add(organization);
    await db.users.add(user);
  });

  return loginWithPassword(input.email, input.password);
}

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
