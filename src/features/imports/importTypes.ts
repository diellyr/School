import type { ImportDocumentType, ImportFileFormat, ImportPeriodicity } from '../../domain';

export const DOCUMENT_TYPE_LABELS: Record<ImportDocumentType, string> = {
  student_registration: 'Cadastro de aluno',
  early_childhood_report: 'Relatório de Educação Infantil',
  elementary_report: 'Relatório do Ensino Fundamental',
  attendance: 'Frequência',
  events: 'Eventos',
  observations: 'Observações',
  alerts: 'Alertas',
  portfolio: 'Portfólio',
  generic: 'Importação genérica (mapeamento manual)',
};

/** Tipos com criação automática de registros (Fase 3). Os demais ficam registrados no log para revisão manual. */
export const AUTOMATED_TYPES: ImportDocumentType[] = ['student_registration', 'attendance'];

export const PERIODICITY_LABELS: Record<ImportPeriodicity, string> = {
  monthly: 'Mensal',
  bimonthly: 'Bimestral',
  quarterly: 'Trimestral',
  semiannual: 'Semestral',
  annual: 'Anual',
  custom: 'Período personalizado',
};

export const FILE_FORMAT_FROM_NAME = (name: string): ImportFileFormat | null => {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'csv') return 'csv';
  if (ext === 'xlsx') return 'xlsx';
  if (ext === 'xls') return 'xls';
  if (ext === 'pdf') return 'pdf';
  if (ext === 'jpeg') return 'jpeg';
  if (ext === 'jpg') return 'jpg';
  if (ext === 'png') return 'png';
  return null;
};

export interface TargetField {
  key: string;
  label: string;
  required: boolean;
  /** Nomes de coluna comuns em planilhas reais, usados só para sugerir o mapeamento — nunca aplicados sem o usuário revisar/confirmar a etapa de mapeamento. */
  synonyms: string[];
}

export const TARGET_FIELDS: Record<ImportDocumentType, TargetField[]> = {
  student_registration: [
    { key: 'fullName', label: 'Nome completo', required: true, synonyms: ['nome completo', 'nome do aluno', 'aluno', 'nome'] },
    { key: 'birthDate', label: 'Data de nascimento (AAAA-MM-DD)', required: true, synonyms: ['data de nascimento', 'nascimento', 'dt nascimento'] },
    { key: 'className', label: 'Nome da turma', required: false, synonyms: ['turma', 'sala', 'classe'] },
    { key: 'internalCode', label: 'Código interno', required: false, synonyms: ['codigo', 'código', 'codigo interno', 'matricula', 'matrícula'] },
  ],
  attendance: [
    { key: 'studentName', label: 'Nome do aluno', required: true, synonyms: ['nome do aluno', 'aluno', 'nome completo', 'nome'] },
    { key: 'date', label: 'Data (AAAA-MM-DD)', required: true, synonyms: ['data', 'dia'] },
    { key: 'status', label: 'Situação (present/absent/justified_absence/late)', required: true, synonyms: ['situacao', 'situação', 'status', 'presenca', 'presença', 'frequencia', 'frequência'] },
  ],
  early_childhood_report: [],
  elementary_report: [],
  events: [],
  observations: [],
  alerts: [],
  portfolio: [],
  generic: [],
};
