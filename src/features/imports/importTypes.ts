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

/** Tipos com criação automática de registros. Os demais ficam registrados no log para revisão manual. */
export const AUTOMATED_TYPES: ImportDocumentType[] = [
  'student_registration',
  'attendance',
  'early_childhood_report',
  'elementary_report',
];

/**
 * Tipos cujo cadastro completo (escola, turma, aluno, professor) é lido diretamente do arquivo
 * e criado automaticamente quando ainda não existe — em vez de depender só da escola/turma
 * escolhidas no passo "Escopo". Ver `ImportWizard.tsx` (etapa 1: escola deixa de ser obrigatória)
 * e `confirmImport` (funções `ensureSchool`/`ensureClass`/`ensureStudent`/`ensureTeacher`).
 */
export const SELF_CONTAINED_TYPES: ImportDocumentType[] = ['early_childhood_report', 'elementary_report'];

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
  early_childhood_report: [
    { key: 'schoolName', label: 'Escola', required: true, synonyms: ['escola', 'nome da escola'] },
    { key: 'className', label: 'Turma', required: true, synonyms: ['turma', 'sala', 'classe'] },
    { key: 'studentName', label: 'Nome do aluno', required: true, synonyms: ['aluno', 'nome do aluno', 'nome completo', 'nome'] },
    { key: 'teacherName', label: 'Professor(a)', required: false, synonyms: ['professor', 'professora', 'educador', 'docente'] },
    { key: 'activityTitle', label: 'Atividade', required: true, synonyms: ['atividade', 'titulo da atividade', 'título da atividade'] },
    { key: 'categoryName', label: 'Categoria / campo de experiência', required: false, synonyms: ['categoria', 'campo de experiencia', 'campo de experiência'] },
    { key: 'activityDate', label: 'Data da atividade (AAAA-MM-DD)', required: false, synonyms: ['data', 'data da atividade'] },
    { key: 'rboLevel', label: 'Nível (R/B/O)', required: true, synonyms: ['nivel', 'nível', 'avaliacao', 'avaliação', 'r/b/o', 'rbo'] },
  ],
  elementary_report: [
    { key: 'schoolName', label: 'Escola', required: true, synonyms: ['escola', 'nome da escola'] },
    { key: 'className', label: 'Turma', required: true, synonyms: ['turma', 'sala', 'classe'] },
    { key: 'studentName', label: 'Nome do aluno', required: true, synonyms: ['aluno', 'nome do aluno', 'nome completo', 'nome'] },
    { key: 'teacherName', label: 'Professor(a)', required: false, synonyms: ['professor', 'professora', 'educador', 'docente'] },
    { key: 'subject', label: 'Disciplina', required: true, synonyms: ['disciplina', 'materia', 'matéria', 'componente curricular'] },
    { key: 'numericScore', label: 'Nota (0 a 10)', required: true, synonyms: ['nota', 'pontuacao', 'pontuação', 'nota numerica', 'nota numérica'] },
  ],
  events: [],
  observations: [],
  alerts: [],
  portfolio: [],
  generic: [],
};
