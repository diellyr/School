import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/schema';
import type { Alert, AssessmentScale, Attendance, Grade, TeacherObservation } from '../../domain';

export interface ElementaryDashboardData {
  grades: Grade[];
  scalesById: Map<string, AssessmentScale>;
  attendance: Attendance[];
  observations: TeacherObservation[];
  alerts: Alert[];
}

export function useElementaryDashboardData(studentId: string) {
  return useLiveQuery<ElementaryDashboardData | undefined>(async () => {
    if (!studentId) return undefined;
    const grades = (await db.grades.filter((g) => g.studentId === studentId && g.status === 'active').toArray()).sort((a, b) =>
      a.period.localeCompare(b.period),
    );
    const scaleIds = [...new Set(grades.map((g) => g.scaleId))];
    const scales = await db.assessmentScales.bulkGet(scaleIds);
    const scalesById = new Map(scales.filter((s): s is AssessmentScale => !!s).map((s) => [s.id, s]));

    const attendance = await db.attendance.filter((a) => a.studentId === studentId && a.status === 'active').toArray();
    const observations = await db.teacherObservations
      .filter((o) => o.studentId === studentId && o.status === 'active' && o.publicationStatus === 'published')
      .toArray();
    const alerts = await db.alerts.filter((a) => a.studentId === studentId && a.status === 'active').toArray();

    return { grades, scalesById, attendance, observations, alerts };
  }, [studentId]);
}

/** Normaliza uma nota para 0-100% dentro da própria escala, só para uso em gráficos de tendência. */
export function normalizedScore(grade: Grade, scale: AssessmentScale | undefined): number | null {
  if (!scale) return null;
  if (scale.type === 'numeric') {
    if (grade.numericScore === undefined || scale.minValue === undefined || scale.maxValue === undefined) return null;
    const range = scale.maxValue - scale.minValue;
    if (range <= 0) return null;
    return ((grade.numericScore - scale.minValue) / range) * 100;
  }
  const level = scale.levels.find((l) => l.code === grade.scaleLevelCode);
  if (!level) return null;
  const maxOrder = Math.max(...scale.levels.map((l) => l.order));
  if (maxOrder <= 0) return null;
  return (level.order / maxOrder) * 100;
}

export function displayGrade(grade: Grade, scale: AssessmentScale | undefined): string {
  if (scale?.type === 'numeric') return grade.numericScore !== undefined ? grade.numericScore.toFixed(1) : '—';
  const level = scale?.levels.find((l) => l.code === grade.scaleLevelCode);
  return level ? `${level.code} — ${level.label}` : grade.scaleLevelCode ?? '—';
}
