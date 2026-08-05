import { db } from '../../db/schema';
import type { Activity, Assessment, AssessmentCategory, AssessmentScale, Grade } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalAssessmentScaleRepository extends LocalBaseRepository<AssessmentScale> {
  constructor() {
    super(db.assessmentScales);
  }

  async findBySchool(schoolId: string): Promise<AssessmentScale[]> {
    return this.list({ where: (s) => s.schoolId === schoolId });
  }

  async findDefault(schoolId: string, stage: AssessmentScale['stage']): Promise<AssessmentScale | undefined> {
    const scales = await this.findBySchool(schoolId);
    return scales.find((s) => s.stage === stage && s.isDefault) ?? scales.find((s) => s.stage === stage);
  }
}

export class LocalAssessmentCategoryRepository extends LocalBaseRepository<AssessmentCategory> {
  constructor() {
    super(db.assessmentCategories);
  }

  async findBySchool(schoolId: string, stage?: AssessmentCategory['stage']): Promise<AssessmentCategory[]> {
    return this.list({ where: (c) => c.schoolId === schoolId && (!stage || c.stage === stage) });
  }
}

export class LocalActivityRepository extends LocalBaseRepository<Activity> {
  constructor() {
    super(db.activities);
  }

  async findByClass(classId: string): Promise<Activity[]> {
    const items = await this.list({ where: (a) => a.classId === classId });
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }
}

export class LocalAssessmentRepository extends LocalBaseRepository<Assessment> {
  constructor() {
    super(db.assessments);
  }

  async findByStudent(studentId: string): Promise<Assessment[]> {
    return this.list({ where: (a) => a.studentId === studentId });
  }

  async findByActivity(activityId: string): Promise<Assessment[]> {
    return this.list({ where: (a) => a.activityId === activityId });
  }
}

export class LocalGradeRepository extends LocalBaseRepository<Grade> {
  constructor() {
    super(db.grades);
  }

  async findByStudent(studentId: string): Promise<Grade[]> {
    return this.list({ where: (g) => g.studentId === studentId });
  }

  async findByClass(classId: string): Promise<Grade[]> {
    return this.list({ where: (g) => g.classId === classId });
  }
}
