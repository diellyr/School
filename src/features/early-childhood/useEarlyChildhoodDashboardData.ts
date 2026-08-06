import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import { RBO_INTERNAL_VALUE, type Activity, type Alert, type Assessment, type Attendance, type RboLevel, type TeacherObservation } from '../../domain';

export interface EarlyChildhoodRow {
  assessment: Assessment;
  activity: Activity;
}

export const MIN_RADAR_SAMPLES = 3;

export function useEarlyChildhoodDashboardData(studentId: string) {
  return useLiveQuery(async () => {
    if (!studentId) return undefined;

    const assessments = await db.assessments.filter((a) => a.studentId === studentId && a.status === 'active').toArray();
    const activityIds = [...new Set(assessments.map((a) => a.activityId))];
    const activities = await db.activities.bulkGet(activityIds);
    const activityById = new Map(
      activities.filter((a): a is Activity => !!a && a.status === 'active').map((a) => [a.id, a]),
    );

    const rows: EarlyChildhoodRow[] = assessments
      .filter((a) => a.rboLevel && activityById.has(a.activityId))
      .map((a) => ({ assessment: a, activity: activityById.get(a.activityId)! }))
      .sort((a, b) => a.activity.date.localeCompare(b.activity.date));

    const categoryIds = [...new Set(rows.map((r) => r.activity.categoryId).filter((v): v is string => !!v))];
    const categories = await db.assessmentCategories.bulkGet(categoryIds);
    const categoryById = new Map(categories.filter((c): c is NonNullable<typeof c> => !!c).map((c) => [c.id, c]));

    const attendance: Attendance[] = await db.attendance.filter((a) => a.studentId === studentId && a.status === 'active').toArray();
    const observations: TeacherObservation[] = await db.teacherObservations
      .filter((o) => o.studentId === studentId && o.status === 'active' && o.publicationStatus === 'published')
      .toArray();
    const alerts: Alert[] = await db.alerts.filter((a) => a.studentId === studentId && a.status === 'active').toArray();

    return { rows, categoryById, attendance, observations, alerts };
  }, [studentId]);
}

export function rboDistribution(rows: EarlyChildhoodRow[]): Record<RboLevel, number> {
  const dist: Record<RboLevel, number> = { R: 0, B: 0, O: 0 };
  for (const r of rows) if (r.assessment.rboLevel) dist[r.assessment.rboLevel]++;
  return dist;
}

/** Valor numérico de um registro para os gráficos de evolução — null quando não há nível lançado. */
export function rowValue(row: EarlyChildhoodRow): number | null {
  return row.assessment.rboLevel ? RBO_INTERNAL_VALUE[row.assessment.rboLevel] : null;
}
