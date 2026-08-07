import type { SystemRole } from '../domain';
import {
  DEMO_GUARDIAN_ID,
  DEMO_STUDENT_EF_ID,
  DEMO_USER_ADMIN_ID,
  DEMO_USER_DIRECTOR_ID,
  DEMO_USER_GUARDIAN_ID,
  DEMO_USER_OWNER_ID,
  DEMO_USER_STUDENT_ID,
  DEMO_USER_TEACHER_ID,
} from '../db/demoIds';

export interface DemoCredential {
  id: string;
  role: SystemRole;
  label: string;
  fullName: string;
  email: string;
  /** Senha do ambiente de demonstração — nunca usada fora do modo demo local. */
  password: string;
  guardianId?: string;
  studentId?: string;
  teacherTitle?: string;
}

/**
 * Usuários de demonstração. Existem SOMENTE quando o app roda em modo demo local
 * (ver auth/authStore.ts). Nunca são criados/expostos em um ambiente conectado a
 * dados reais ou ao Supabase de produção.
 */
export const DEMO_CREDENTIALS: DemoCredential[] = [
  {
    id: DEMO_USER_OWNER_ID,
    role: 'owner',
    label: 'Owner',
    fullName: 'Otávio Ramos (Owner)',
    email: 'owner@demo.escola.app',
    password: 'owner123',
  },
  {
    id: DEMO_USER_ADMIN_ID,
    role: 'admin',
    label: 'Administrador',
    fullName: 'Adriana Souza (Admin)',
    email: 'admin@demo.escola.app',
    password: 'admin123',
  },
  {
    id: DEMO_USER_TEACHER_ID,
    role: 'teacher',
    label: 'Professor(a)',
    fullName: 'Tiago Ferreira (Professor)',
    email: 'professor@demo.escola.app',
    password: 'prof123',
    teacherTitle: 'Professor regente',
  },
  {
    id: DEMO_USER_GUARDIAN_ID,
    role: 'guardian',
    label: 'Responsável',
    fullName: 'Ana Paula Lima (Responsável)',
    email: 'responsavel@demo.escola.app',
    password: 'resp123',
    guardianId: DEMO_GUARDIAN_ID,
  },
  {
    id: DEMO_USER_STUDENT_ID,
    role: 'student',
    label: 'Aluno(a)',
    fullName: 'Laura Lima (Aluna)',
    email: 'aluno@demo.escola.app',
    password: 'aluno123',
    studentId: DEMO_STUDENT_EF_ID,
  },
  {
    // Mantido por último para não deslocar os índices usados pelo seed (DEMO_CREDENTIALS[2] = professor).
    id: DEMO_USER_DIRECTOR_ID,
    role: 'director',
    label: 'Diretor(a)',
    fullName: 'Débora Nakamura (Diretora)',
    email: 'diretor@demo.escola.app',
    password: 'diretor123',
  },
];
