import type { SupabaseClient } from '@supabase/supabase-js';
import type { Organization, School, Class } from '../../domain';
import { SupabaseBaseRepository } from './SupabaseBaseRepository';

export class SupabaseOrganizationRepository extends SupabaseBaseRepository<Organization> {
  constructor(client: SupabaseClient) {
    super(client, 'organizations');
  }
}

export class SupabaseSchoolRepository extends SupabaseBaseRepository<School> {
  constructor(client: SupabaseClient) {
    super(client, 'schools');
  }
}

export class SupabaseClassRepository extends SupabaseBaseRepository<Class> {
  constructor(client: SupabaseClient) {
    super(client, 'classes');
  }

  async findBySchool(schoolId: string): Promise<Class[]> {
    return this.list({ where: (c) => c.schoolId === schoolId });
  }
}
