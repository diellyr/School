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

function mapRow(row: Record<string, string>, columnMapping: Record<string, string>): Record<string, string> {
  const interpreted: Record<string, string> = {};
  for (const [targetKey, sourceColumn] of Object.entries(columnMapping)) {
    if (sourceColumn) interpreted[targetKey] = (row[sourceColumn] ?? '').trim();
  }
  return interpreted;
}

export async function buildPreview(
  documentType: ImportDocumentType,
  table: ParsedTable,
  columnMapping: Record<string, string>,
  scope: { schoolId?: string; classId?: string },
): Promise<PreviewRow[]> {
  const existingStudents = scope.schoolId
    ? await db.students.filter((s) => s.schoolId === scope.schoolId && s.status === 'active').toArray()
    : [];
  const existingAttendance = await db.attendance.filter((a) => a.status === 'active').toArray();
  const classes = scope.schoolId ? await db.classes.filter((c) => c.schoolId === scope.schoolId && c.status === 'active').toArray() : [];

  return table.rows.map((row, index) => {
    const interpreted = mapRow(row, columnMapping);
    let validation: PreviewRow['validation'] = 'valid';
    let notes: string | undefined;
    let resolution: PreviewRow['resolution'] = 'import';
    let matchedExistingId: string | undefined;

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

    if (documentType !== 'student_registration' && documentType !== 'attendance') {
      notes = 'Este tipo de documento ainda não cria registros automaticamente — os dados ficam no log para revisão manual.';
      validation = 'warning';
      resolution = 'ignore';
    }

    return { index, original: row, interpreted, confidence: 1, validation, validationNotes: notes, resolution, matchedExistingId };
  });
}
