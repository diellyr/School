import { db } from '../../db/schema';
import type { ImportDocumentType } from '../../domain';
import type { ParsedTable } from './parseFile';

export interface PreviewRow {
  index: number;
  original: Record<string, string>;
  interpreted: Record<string, string>;
  confidence: number; // 0-1 — sempre 1 para CSV/XLSX (leitura estruturada, sem OCR)
  validation: 'valid' | 'warning' | 'error' | 'duplicate';
  validationNotes?: string;
  resolution: 'import' | 'ignore' | 'update_existing';
  matchedExistingId?: string;
}

const ATTENDANCE_STATUSES = ['present', 'absent', 'justified_absence', 'late', 'early_departure', 'class_cancelled', 'remote_activity'];

export const LOW_CONFIDENCE_THRESHOLD = 0.7;

function mapRow(row: Record<string, string>, columnMapping: Record<string, string>): Record<string, string> {
  const interpreted: Record<string, string> = {};
  for (const [targetKey, sourceColumn] of Object.entries(columnMapping)) {
    if (sourceColumn) interpreted[targetKey] = (row[sourceColumn] ?? '').trim();
  }
  return interpreted;
}

const RBO_CODES = ['R', 'B', 'O'];

export async function buildPreview(
  documentType: ImportDocumentType,
  table: ParsedTable,
  columnMapping: Record<string, string>,
  scope: { schoolId?: string; classId?: string; period?: string },
): Promise<PreviewRow[]> {
  const existingStudents = scope.schoolId
    ? await db.students.filter((s) => s.schoolId === scope.schoolId && s.status === 'active').toArray()
    : [];
  const existingAttendance = await db.attendance.filter((a) => a.status === 'active').toArray();
  const classes = scope.schoolId ? await db.classes.filter((c) => c.schoolId === scope.schoolId && c.status === 'active').toArray() : [];

  const isSelfContainedReport = documentType === 'early_childhood_report' || documentType === 'elementary_report';
  const allSchools = isSelfContainedReport ? await db.schools.filter((s) => s.status === 'active').toArray() : [];
  const allClasses = isSelfContainedReport ? await db.classes.filter((c) => c.status === 'active').toArray() : [];
  const allStudents = isSelfContainedReport ? await db.students.filter((s) => s.status === 'active').toArray() : [];
  const allTeachers = isSelfContainedReport ? await db.users.filter((u) => u.role === 'teacher' && u.status === 'active').toArray() : [];
  const allActivities = documentType === 'early_childhood_report' ? await db.activities.filter((a) => a.status === 'active').toArray() : [];
  const allAssessments = documentType === 'early_childhood_report' ? await db.assessments.filter((a) => a.status === 'active').toArray() : [];
  const allGrades = documentType === 'elementary_report' ? await db.grades.filter((g) => g.status === 'active' && !g.isRecovery).toArray() : [];

  return table.rows.map((row, index) => {
    const interpreted = mapRow(row, columnMapping);
    const confidence = table.rowConfidences?.[index] ?? 1;
    let validation: PreviewRow['validation'] = 'valid';
    let notes: string | undefined;
    let resolution: PreviewRow['resolution'] = 'import';
    let matchedExistingId: string | undefined;

    if (table.source !== 'structured' && confidence < LOW_CONFIDENCE_THRESHOLD) {
      validation = 'warning';
      notes = `Confiança baixa na leitura desta linha (${Math.round(confidence * 100)}%) — revise os valores com atenção antes de confirmar.`;
    }

    if (documentType === 'student_registration') {
      if (!interpreted.fullName) {
        validation = 'error';
        notes = 'Nome completo é obrigatório.';
      } else if (!interpreted.birthDate || Number.isNaN(Date.parse(interpreted.birthDate))) {
        validation = 'warning';
        notes = 'Data de nascimento ausente ou inválida.';
      }
      if (validation !== 'error') {
        const match = existingStudents.find((s) => s.fullName.toLowerCase() === interpreted.fullName?.toLowerCase());
        if (match) {
          validation = 'duplicate';
          notes = `Já existe um aluno com este nome (${match.internalCode ?? match.id}).`;
          resolution = 'ignore';
          matchedExistingId = match.id;
        }
      }
      if (interpreted.className && !classes.find((c) => c.name.toLowerCase() === interpreted.className.toLowerCase())) {
        if (validation === 'valid') validation = 'warning';
        notes = (notes ? notes + ' ' : '') + `Turma "${interpreted.className}" não encontrada — será importado sem turma.`;
      }
    }

    if (documentType === 'attendance') {
      if (!interpreted.studentName) {
        validation = 'error';
        notes = 'Nome do aluno é obrigatório.';
      } else if (!interpreted.date || Number.isNaN(Date.parse(interpreted.date))) {
        validation = 'error';
        notes = 'Data ausente ou inválida.';
      } else if (!interpreted.status || !ATTENDANCE_STATUSES.includes(interpreted.status)) {
        validation = 'error';
        notes = `Situação inválida. Use um de: ${ATTENDANCE_STATUSES.join(', ')}.`;
      }
      if (validation !== 'error') {
        const student = existingStudents.find((s) => s.fullName.toLowerCase() === interpreted.studentName?.toLowerCase());
        if (!student) {
          validation = 'warning';
          notes = 'Aluno não encontrado nesta escola — a linha será ignorada na confirmação.';
          resolution = 'ignore';
        } else {
          const dup = existingAttendance.find((a) => a.studentId === student.id && a.date === interpreted.date);
          if (dup) {
            validation = 'duplicate';
            notes = 'Já existe frequência registrada para este aluno nesta data.';
            resolution = 'update_existing';
            matchedExistingId = dup.id;
          }
        }
      }
    }

    if (documentType === 'early_childhood_report') {
      if (!interpreted.schoolName) {
        validation = 'error';
        notes = 'Escola é obrigatória.';
      } else if (!interpreted.className) {
        validation = 'error';
        notes = 'Turma é obrigatória.';
      } else if (!interpreted.studentName) {
        validation = 'error';
        notes = 'Nome do aluno é obrigatório.';
      } else if (!interpreted.activityTitle) {
        validation = 'error';
        notes = 'Atividade é obrigatória.';
      } else {
        const level = interpreted.rboLevel?.trim().toUpperCase();
        if (!level || !RBO_CODES.includes(level)) {
          validation = 'error';
          notes = 'Nível inválido — use R, B ou O.';
        } else {
          const autoCreateNotes: string[] = [];
          const school = allSchools.find((s) => s.name.toLowerCase() === interpreted.schoolName.toLowerCase());
          if (!school) autoCreateNotes.push(`Escola "${interpreted.schoolName}" será cadastrada automaticamente.`);
          const klass = school ? allClasses.find((c) => c.schoolId === school.id && c.name.toLowerCase() === interpreted.className.toLowerCase()) : undefined;
          if (!klass) autoCreateNotes.push(`Turma "${interpreted.className}" será cadastrada automaticamente.`);
          const student = school
            ? allStudents.find((s) => s.schoolId === school.id && s.fullName.toLowerCase() === interpreted.studentName.toLowerCase())
            : undefined;
          if (!student) autoCreateNotes.push(`Aluno "${interpreted.studentName}" será cadastrado automaticamente.`);
          if (interpreted.teacherName) {
            const teacher = allTeachers.find((t) => t.fullName.toLowerCase() === interpreted.teacherName.toLowerCase());
            if (!teacher) autoCreateNotes.push(`Professor(a) "${interpreted.teacherName}" será cadastrado(a) automaticamente (conta criada bloqueada, sem senha utilizável, até um administrador liberar o acesso).`);
          }

          if (student && klass) {
            const activity = allActivities.find(
              (a) => a.classId === klass.id && a.title.toLowerCase() === interpreted.activityTitle.toLowerCase() && a.date === interpreted.activityDate,
            );
            const existingAssessment = activity ? allAssessments.find((a) => a.activityId === activity.id && a.studentId === student.id) : undefined;
            if (existingAssessment) {
              validation = 'duplicate';
              notes = 'Já existe uma avaliação deste aluno para esta atividade — o nível será atualizado.';
              resolution = 'update_existing';
              matchedExistingId = existingAssessment.id;
            }
          }

          if (validation !== 'duplicate') {
            validation = autoCreateNotes.length > 0 ? 'warning' : 'valid';
            notes = autoCreateNotes.join(' ') || undefined;
          }
        }
      }
    }

    if (documentType === 'elementary_report') {
      if (!interpreted.schoolName) {
        validation = 'error';
        notes = 'Escola é obrigatória.';
      } else if (!interpreted.className) {
        validation = 'error';
        notes = 'Turma é obrigatória.';
      } else if (!interpreted.studentName) {
        validation = 'error';
        notes = 'Nome do aluno é obrigatório.';
      } else if (!interpreted.subject) {
        validation = 'error';
        notes = 'Disciplina é obrigatória.';
      } else if (!interpreted.numericScore || Number.isNaN(Number(interpreted.numericScore.replace(',', '.')))) {
        validation = 'error';
        notes = 'Nota inválida — informe um número (ex.: 7.5).';
      } else {
        const autoCreateNotes: string[] = [];
        const school = allSchools.find((s) => s.name.toLowerCase() === interpreted.schoolName.toLowerCase());
        if (!school) autoCreateNotes.push(`Escola "${interpreted.schoolName}" será cadastrada automaticamente.`);
        const klass = school ? allClasses.find((c) => c.schoolId === school.id && c.name.toLowerCase() === interpreted.className.toLowerCase()) : undefined;
        if (!klass) autoCreateNotes.push(`Turma "${interpreted.className}" será cadastrada automaticamente.`);
        const student = school
          ? allStudents.find((s) => s.schoolId === school.id && s.fullName.toLowerCase() === interpreted.studentName.toLowerCase())
          : undefined;
        if (!student) autoCreateNotes.push(`Aluno "${interpreted.studentName}" será cadastrado automaticamente.`);
        if (interpreted.teacherName) {
          const teacher = allTeachers.find((t) => t.fullName.toLowerCase() === interpreted.teacherName.toLowerCase());
          if (!teacher) autoCreateNotes.push(`Professor(a) "${interpreted.teacherName}" será cadastrado(a) automaticamente (conta criada bloqueada, sem senha utilizável, até um administrador liberar o acesso).`);
        }

        if (student && klass && scope.period) {
          const dup = allGrades.find(
            (g) => g.studentId === student.id && g.classId === klass.id && g.subject.toLowerCase() === interpreted.subject.toLowerCase() && g.period === scope.period,
          );
          if (dup) {
            validation = 'duplicate';
            notes = 'Já existe uma nota desta disciplina/período para este aluno — o valor será atualizado.';
            resolution = 'update_existing';
            matchedExistingId = dup.id;
          }
        }

        if (validation !== 'duplicate') {
          validation = autoCreateNotes.length > 0 ? 'warning' : 'valid';
          notes = autoCreateNotes.join(' ') || undefined;
        }
      }
    }

    if (
      documentType !== 'student_registration' &&
      documentType !== 'attendance' &&
      documentType !== 'early_childhood_report' &&
      documentType !== 'elementary_report'
    ) {
      notes = 'Este tipo de documento ainda não cria registros automaticamente — os dados ficam no log para revisão manual.';
      validation = 'warning';
      resolution = 'ignore';
    }

    return { index, original: row, interpreted, confidence, validation, validationNotes: notes, resolution, matchedExistingId };
  });
}
