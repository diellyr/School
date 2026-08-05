import { db } from '../../db/schema';
import type { Alert, AlertAcknowledgement, AlertRule, TeacherAlert } from '../../domain';
import { LocalBaseRepository } from './LocalBaseRepository';

export class LocalAlertRuleRepository extends LocalBaseRepository<AlertRule> {
  constructor() {
    super(db.alertRules);
  }
}

export class LocalAlertRepository extends LocalBaseRepository<Alert> {
  constructor() {
    super(db.alerts);
  }

  async findByStudent(studentId: string): Promise<Alert[]> {
    const items = await this.list({ where: (a) => a.studentId === studentId });
    return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
}

export class LocalAlertAcknowledgementRepository extends LocalBaseRepository<AlertAcknowledgement> {
  constructor() {
    super(db.alertAcknowledgements);
  }

  async findByAlert(alertId: string): Promise<AlertAcknowledgement[]> {
    return this.list({ where: (a) => a.alertId === alertId });
  }
}

export class LocalTeacherAlertRepository extends LocalBaseRepository<TeacherAlert> {
  constructor() {
    super(db.teacherAlerts);
  }

  async findByStudent(studentId: string): Promise<TeacherAlert[]> {
    const items = await this.list({ where: (a) => a.studentId === studentId });
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }

  async findVisibleToGuardian(guardianId: string): Promise<TeacherAlert[]> {
    const items = await this.list();
    return items.filter((a) => a.visibleToGuardianIds.includes(guardianId) && a.teacherAlertStatus !== 'draft');
  }
}
