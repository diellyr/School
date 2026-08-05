import { db } from '../../db/schema';
import type { AcademicYear, Class, Organization, School, SchoolUnit } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalOrganizationRepository extends LocalBaseRepository<Organization> {
  constructor() {
    super(db.organizations);
  }
}

export class LocalSchoolRepository extends LocalBaseRepository<School> {
  constructor() {
    super(db.schools);
  }
}

export class LocalSchoolUnitRepository extends LocalBaseRepository<SchoolUnit> {
  constructor() {
    super(db.schoolUnits);
  }

  async findBySchool(schoolId: string): Promise<SchoolUnit[]> {
    return this.list({ where: (u) => u.schoolId === schoolId });
  }
}

export class LocalAcademicYearRepository extends LocalBaseRepository<AcademicYear> {
  constructor() {
    super(db.academicYears);
  }

  async findCurrent(schoolId: string): Promise<AcademicYear | undefined> {
    const years = await this.list({ where: (y) => y.schoolId === schoolId && y.isCurrent });
    return years[0];
  }
}

export class LocalClassRepository extends LocalBaseRepository<Class> {
  constructor() {
    super(db.classes);
  }

  async findBySchool(schoolId: string): Promise<Class[]> {
    return this.list({ where: (c) => c.schoolId === schoolId });
  }

  async findByAcademicYear(academicYearId: string): Promise<Class[]> {
    return this.list({ where: (c) => c.academicYearId === academicYearId });
  }
}
