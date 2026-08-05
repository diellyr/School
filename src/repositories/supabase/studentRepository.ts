import type { SupabaseClient } from '@supabase/supabase-js';
import type { Student, Guardian, StudentGuardian } from '../../domain';
import { SupabaseBaseRepository } from './SupabaseBaseRepository';

/**
 * Implementação de referência para a Fase 6. Segue exatamente o contrato usado por
 * `LocalStudentRepository` (`src/repositories/local/studentRepository.ts`) — o
 * `RepositoryProvider` injeta uma ou outra sem que `StudentsPage`/`StudentDetailPage`
 * precisem saber a diferença. Fica inerte (nunca instanciada) enquanto
 * `isSupabaseConfigured` for falso.
 */
export class SupabaseStudentRepository extends SupabaseBaseRepository<Student> {
  constructor(client: SupabaseClient) {
    super(client, 'students');
  }

  async findByClass(classId: string): Promise<Student[]> {
    return this.list({ where: (s) => s.classId === classId });
  }

  async findBySchool(schoolId: string): Promise<Student[]> {
    return this.list({ where: (s) => s.schoolId === schoolId });
  }

  async search(term: string): Promise<Student[]> {
    const normalized = term.trim().toLowerCase();
    if (!normalized) return this.list();
    return this.list({ where: (s) => s.fullName.toLowerCase().includes(normalized) });
  }
}

export class SupabaseGuardianRepository extends SupabaseBaseRepository<Guardian> {
  constructor(client: SupabaseClient) {
    super(client, 'guardians');
  }
}

export class SupabaseStudentGuardianRepository extends SupabaseBaseRepository<StudentGuardian> {
  constructor(client: SupabaseClient) {
    super(client, 'student_guardians');
  }

  async findByStudent(studentId: string): Promise<StudentGuardian[]> {
    return this.list({ where: (l) => l.studentId === studentId });
  }
}
