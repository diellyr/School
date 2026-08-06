import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileWarning, ScanEye, Upload, X } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { FormField, Input, Select } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { BNCC_CHECKLIST_TYPE, DOCUMENT_TYPE_LABELS, FILE_FORMAT_FROM_NAME, PERIODICITY_LABELS, SELF_CONTAINED_TYPES, TARGET_FIELDS } from './importTypes';
import { parseTabularFile, type ParsedTable } from './parseFile';
import { parseBoletimChecklist, type BoletimHeaderFields, type BoletimParseResult } from './parseBoletim';
import { buildPreview, type PreviewRow } from './validateRows';
import { readFileAsDataUrl, sha256OfFile } from '../../lib/files';
import { sha256Hex } from '../../lib/hash';
import { newId } from '../../domain/common';
import type {
  Activity,
  AppUser,
  AssessmentCategory,
  AssessmentScale,
  Class,
  EducationStage,
  ImportDocumentType,
  ImportPeriodicity,
  RboLevel,
  School,
  Student,
  StorageDestination,
  TeacherAssignment,
} from '../../domain';

const STEPS = ['Tipo de documento', 'Escopo e período', 'Armazenamento', 'Arquivos', 'Mapeamento', 'Pré-visualização', 'Resultado'];
const BNCC_STEPS = ['Tipo de documento', 'Período', 'Armazenamento', 'Arquivos', 'Conferir dados lidos', 'Resumo', 'Resultado'];

/** Máximo de arquivos que podem ser selecionados de uma vez para uma mesma importação. */
export const MAX_IMPORT_FILES = 10;

/** Normaliza um cabeçalho para comparação: minúsculas, sem acentos, sem pontuação. */
function normalizeHeader(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** O log de importação (import_rows) não distingue "importar" de "sem resolução especial". */
function toDomainResolution(resolution: PreviewRow['resolution'] | undefined): 'ignore' | 'update_existing' | undefined {
  if (resolution === 'ignore' || resolution === 'update_existing') return resolution;
  return undefined;
}

/** Vira um prefixo de e-mail plausível a partir do nome, só para a conta-placeholder do professor. */
function slugifyName(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '') || 'professor'
  );
}

interface FileEntry {
  file: File;
  table: ParsedTable | null;
  parseError: string | null;
}

interface FilePreview {
  fileIndex: number;
  file: File;
  table: ParsedTable;
  rows: PreviewRow[];
}

type RowOutcome = 'imported' | 'rejected' | 'duplicate' | 'skipped';

interface BoletimEntry {
  file: File;
  result: BoletimParseResult | null;
  error: string | null;
  /** Cópia editável do cabeçalho lido — o usuário confirma/corrige antes de cadastrar. */
  header: BoletimHeaderFields;
}

export function ImportWizard({ onFinished }: { onFinished: () => void }) {
  const [step, setStep] = useState(0);
  const [documentType, setDocumentType] = useState<ImportDocumentType>('student_registration');
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [period, setPeriod] = useState('');
  const [periodicity, setPeriodicity] = useState<ImportPeriodicity>('bimonthly');
  const [storageDestination, setStorageDestination] = useState<StorageDestination>('local');
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [fileSelectError, setFileSelectError] = useState<string | null>(null);
  const [ocrProgress, setOcrProgress] = useState<{ fileName: string; progress: number } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [filePreviews, setFilePreviews] = useState<FilePreview[] | null>(null);
  const [resolutions, setResolutions] = useState<Record<string, PreviewRow['resolution']>>({});
  const [result, setResult] = useState<{
    imported: number;
    rejected: number;
    duplicates: number;
    createdSchools: number;
    createdClasses: number;
    createdStudents: number;
    createdTeachers: number;
    fileResults: { fileName: string; imported: number; rejected: number; duplicates: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [reviewedManually, setReviewedManually] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [boletimEntries, setBoletimEntries] = useState<BoletimEntry[]>([]);
  const [boletimFilesLoading, setBoletimFilesLoading] = useState(false);
  const [boletimSelectError, setBoletimSelectError] = useState<string | null>(null);
  const [boletimOcrProgress, setBoletimOcrProgress] = useState<{ fileName: string; progress: number } | null>(null);
  const [boletimReviewed, setBoletimReviewed] = useState(false);
  const [boletimResult, setBoletimResult] = useState<{
    createdSchools: number;
    createdClasses: number;
    createdStudents: number;
    attachedDocuments: { studentId: string; studentName: string; fileName: string }[];
    failed: { fileName: string; message: string }[];
  } | null>(null);
  const boletimFileInputRef = useRef<HTMLInputElement>(null);

  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const schools = useLiveQuery<School[]>(() => db.schools.filter((s) => s.status === 'active').toArray(), []);
  const classes = useLiveQuery<Class[]>(
    () => (schoolId ? db.classes.filter((c) => c.schoolId === schoolId && c.status === 'active').toArray() : Promise.resolve<Class[]>([])),
    [schoolId],
  );

  const targetFields = TARGET_FIELDS[documentType];
  const isBncc = documentType === BNCC_CHECKLIST_TYPE;
  const isAutomated = targetFields.length > 0 || isBncc;
  const isSelfContained = SELF_CONTAINED_TYPES.includes(documentType);
  const parsedFiles = fileEntries.filter((e) => e.table);
  const hasNonStructuredSource = parsedFiles.some((e) => e.table?.source !== 'structured');

  const combinedHeaders = useMemo(() => {
    const set = new Set<string>();
    for (const e of fileEntries) if (e.table) e.table.headers.forEach((h) => set.add(h));
    return [...set];
  }, [fileEntries]);

  async function handleFilesSelected(selected: FileList) {
    const incoming = Array.from(selected);
    setFileSelectError(null);
    if (fileEntries.length + incoming.length > MAX_IMPORT_FILES) {
      setFileSelectError(
        `Máximo de ${MAX_IMPORT_FILES} arquivos por importação — você já tem ${fileEntries.length} selecionado(s) e tentou adicionar mais ${incoming.length}.`,
      );
      return;
    }
    setReviewedManually(false);
    setFilesLoading(true);
    const newEntries: FileEntry[] = [];
    try {
      for (const f of incoming) {
        const format = FILE_FORMAT_FROM_NAME(f.name);
        if (!format) {
          newEntries.push({ file: f, table: null, parseError: 'Formato de arquivo não suportado. Use CSV, XLSX, PDF, JPEG ou PNG.' });
          continue;
        }
        const isImage = format === 'jpeg' || format === 'jpg' || format === 'png';
        try {
          const parsed = await parseTabularFile(f, isImage ? (p) => setOcrProgress({ fileName: f.name, progress: p }) : undefined);
          newEntries.push({ file: f, table: parsed, parseError: null });
        } catch (err) {
          newEntries.push({ file: f, table: null, parseError: err instanceof Error ? err.message : 'Não foi possível ler este arquivo.' });
        }
      }
    } finally {
      setOcrProgress(null);
      setFilesLoading(false);
    }

    const merged = [...fileEntries, ...newEntries];
    setFileEntries(merged);

    const allHeaders = new Set<string>();
    for (const e of merged) if (e.table) e.table.headers.forEach((h) => allHeaders.add(h));
    setColumnMapping((prev) => {
      const next = { ...prev };
      for (const field of targetFields) {
        if (next[field.key]) continue;
        const candidates = [field.key, field.label, ...field.synonyms].map(normalizeHeader);
        const match = [...allHeaders].find((h) => candidates.includes(normalizeHeader(h)));
        if (match) next[field.key] = match;
      }
      return next;
    });
  }

  function removeFile(index: number) {
    setFileEntries((prev) => prev.filter((_, i) => i !== index));
    setFileSelectError(null);
  }

  async function handleBoletimFilesSelected(selected: FileList) {
    const incoming = Array.from(selected);
    setBoletimSelectError(null);
    if (boletimEntries.length + incoming.length > MAX_IMPORT_FILES) {
      setBoletimSelectError(
        `Máximo de ${MAX_IMPORT_FILES} arquivos por importação — você já tem ${boletimEntries.length} selecionado(s) e tentou adicionar mais ${incoming.length}.`,
      );
      return;
    }
    setBoletimReviewed(false);
    setBoletimFilesLoading(true);
    const newEntries: BoletimEntry[] = [];
    try {
      for (const f of incoming) {
        try {
          const result = await parseBoletimChecklist(f, (p) => setBoletimOcrProgress({ fileName: f.name, progress: p }));
          newEntries.push({ file: f, result, error: null, header: { ...result.header } });
        } catch (err) {
          newEntries.push({
            file: f,
            result: null,
            error: err instanceof Error ? err.message : 'Não foi possível ler este arquivo.',
            header: { schoolName: '', studentName: '', className: '', birthDate: '', academicYear: String(new Date().getFullYear()) },
          });
        }
      }
    } finally {
      setBoletimOcrProgress(null);
      setBoletimFilesLoading(false);
    }
    setBoletimEntries((prev) => [...prev, ...newEntries]);
  }

  function removeBoletimFile(index: number) {
    setBoletimEntries((prev) => prev.filter((_, i) => i !== index));
    setBoletimSelectError(null);
  }

  function updateBoletimHeader(index: number, patch: Partial<BoletimHeaderFields>) {
    setBoletimEntries((prev) => prev.map((e, i) => (i === index ? { ...e, header: { ...e.header, ...patch } } : e)));
  }

  async function confirmBoletimImport() {
    if (!session) return;
    setLoading(true);
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    let createdSchools = 0;
    let createdClasses = 0;
    let createdStudentsCount = 0;
    const attachedDocuments: { studentId: string; studentName: string; fileName: string }[] = [];
    const failed: { fileName: string; message: string }[] = [];

    try {
      const operationRef = newId();
      const allSchools = await db.schools.filter((s) => s.status === 'active').toArray();
      const allClasses = await db.classes.filter((c) => c.status === 'active').toArray();
      const allStudents = await db.students.filter((s) => s.status === 'active').toArray();
      const allAcademicYears = await db.academicYears.filter((y) => y.status === 'active').toArray();

      const schoolCache = new Map<string, School>();
      const classCache = new Map<string, Class>();
      const studentCache = new Map<string, Student>();
      const academicYearCache = new Map<string, string>();

      async function ensureSchool(name: string): Promise<School> {
        const key = name.trim().toLowerCase();
        const cached = schoolCache.get(key);
        if (cached) return cached;
        const existing = allSchools.find((s) => s.name.toLowerCase() === key);
        if (existing) { schoolCache.set(key, existing); return existing; }
        const created = await repositories.schools.create({ name: name.trim() }, actor);
        allSchools.push(created);
        schoolCache.set(key, created);
        createdSchools++;
        return created;
      }

      async function ensureAcademicYear(schoolIdArg: string): Promise<string> {
        const cached = academicYearCache.get(schoolIdArg);
        if (cached) return cached;
        const existing = allAcademicYears.find((y) => y.schoolId === schoolIdArg && y.isCurrent);
        if (existing) { academicYearCache.set(schoolIdArg, existing.id); return existing.id; }
        const year = new Date().getFullYear();
        const created = await repositories.academicYears.create(
          { schoolId: schoolIdArg, year, startDate: `${year}-02-01`, endDate: `${year}-12-15`, isCurrent: true },
          actor,
        );
        allAcademicYears.push(created);
        academicYearCache.set(schoolIdArg, created.id);
        return created.id;
      }

      async function ensureClass(schoolIdArg: string, name: string): Promise<Class> {
        const key = `${schoolIdArg}::${name.trim().toLowerCase()}`;
        const cached = classCache.get(key);
        if (cached) return cached;
        const existing = allClasses.find((c) => c.schoolId === schoolIdArg && c.name.toLowerCase() === name.trim().toLowerCase());
        if (existing) { classCache.set(key, existing); return existing; }
        const academicYearId = await ensureAcademicYear(schoolIdArg);
        const created = await repositories.classes.create(
          { schoolId: schoolIdArg, academicYearId, name: name.trim(), stage: 'early_childhood', grade: name.trim(), shift: 'morning' },
          actor,
        );
        allClasses.push(created);
        classCache.set(key, created);
        createdClasses++;
        return created;
      }

      async function ensureStudent(schoolIdArg: string, classIdArg: string | undefined, name: string, birthDate: string): Promise<Student> {
        const key = `${schoolIdArg}::${name.trim().toLowerCase()}`;
        const cached = studentCache.get(key);
        if (cached) return cached;
        const existing = allStudents.find((s) => s.schoolId === schoolIdArg && s.fullName.toLowerCase() === name.trim().toLowerCase());
        if (existing) { studentCache.set(key, existing); return existing; }
        const created = await repositories.students.create(
          {
            fullName: name.trim(),
            birthDate: birthDate || '2020-01-01',
            schoolId: schoolIdArg,
            classId: classIdArg,
            matriculationStatus: 'active',
            enrollmentDate: new Date().toISOString().slice(0, 10),
          },
          actor,
        );
        allStudents.push(created);
        studentCache.set(key, created);
        createdStudentsCount++;
        return created;
      }

      for (const entry of boletimEntries) {
        const h = entry.header;
        if (!h.schoolName.trim() || !h.studentName.trim()) continue;

        // Cada arquivo é isolado: se um falhar (ex.: erro ao gerar o hash do arquivo, ou de
        // gravação no IndexedDB) os demais arquivos do lote continuam sendo processados, e a falha
        // aparece no resultado em vez de abortar a importação inteira em silêncio — o que antes
        // podia deixar só o aluno cadastrado, sem escola/turma/documento e sem nenhum aviso.
        try {
          const school = await ensureSchool(h.schoolName);
          const klass = h.className.trim() ? await ensureClass(school.id, h.className) : undefined;
          const student = await ensureStudent(school.id, klass?.id, h.studentName, h.birthDate);

          const [dataUrl, hash] = await Promise.all([readFileAsDataUrl(entry.file), sha256OfFile(entry.file)]);
          await repositories.documents.create(
            {
              studentId: student.id,
              schoolId: school.id,
              classId: klass?.id,
              category: 'boletim',
              fileName: entry.file.name,
              mimeType: entry.file.type || 'application/octet-stream',
              sizeBytes: entry.file.size,
              hash,
              tags: ['boletim-bncc'],
              storageLocation: 'local',
              blobRef: dataUrl,
            },
            actor,
          );
          attachedDocuments.push({ studentId: student.id, studentName: student.fullName, fileName: entry.file.name });

          const batch = await repositories.imports.create(
            {
              documentType: BNCC_CHECKLIST_TYPE,
              fileFormat: FILE_FORMAT_FROM_NAME(entry.file.name) ?? 'jpeg',
              fileName: entry.file.name,
              fileSizeBytes: entry.file.size,
              fileHash: hash,
              schoolId: school.id,
              classId: klass?.id,
              studentId: student.id,
              periodicity,
              periodLabel: period,
              storageDestination,
              importStatus: 'completed',
              totalRowsFound: 1,
              totalImported: 1,
              totalRejected: 0,
              totalDuplicates: 0,
              operationRef,
            },
            actor,
          );
          await repositories.importRows.create(
            {
              importId: batch.id,
              rowIndex: 0,
              rawValue: { texto: entry.result?.rawText.slice(0, 2000) ?? '' },
              interpretedValue: {
                escola: h.schoolName,
                aluno: h.studentName,
                turma: h.className,
                dataNascimento: h.birthDate,
                categoriasDetectadas: (entry.result?.categoriesFound ?? []).map((c) => c.label).join('; '),
              },
              confidence: entry.result?.confidence,
              validation: 'warning',
              validationNotes: 'Cabeçalho lido automaticamente e conferido pelo usuário. As avaliações individuais (R/B/O) não foram preenchidas automaticamente — lance-as manualmente em Avaliações.',
              linkedStudentId: student.id,
            },
            actor,
          );
          await repositories.audit.record({ ...actor, role: session.role }, { action: 'import', module: 'imports', entityId: batch.id });
        } catch (err) {
          failed.push({ fileName: entry.file.name, message: err instanceof Error ? err.message : 'Falha desconhecida ao processar este arquivo.' });
        }
      }

      setBoletimResult({ createdSchools, createdClasses, createdStudents: createdStudentsCount, attachedDocuments, failed });
      setStep(6);
    } finally {
      setLoading(false);
    }
  }

  async function runPreview() {
    if (parsedFiles.length === 0) return;
    setLoading(true);
    try {
      const previews: FilePreview[] = [];
      for (let i = 0; i < fileEntries.length; i++) {
        const entry = fileEntries[i];
        if (!entry.table) continue;
        const rows = await buildPreview(documentType, entry.table, columnMapping, { schoolId, classId, period });
        previews.push({ fileIndex: i, file: entry.file, table: entry.table, rows });
      }
      setFilePreviews(previews);
      const initialResolutions: Record<string, PreviewRow['resolution']> = {};
      for (const p of previews) for (const r of p.rows) initialResolutions[`${p.fileIndex}:${r.index}`] = r.resolution;
      setResolutions(initialResolutions);
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!session || !filePreviews || filePreviews.length === 0) return;
    setLoading(true);
    const currentUserId = session.user.id;
    const actor = { userId: currentUserId, organizationId: session.user.organizationId };
    let imported = 0;
    let rejected = 0;
    let duplicates = 0;
    let createdSchools = 0;
    let createdClasses = 0;
    let createdStudentsCount = 0;
    let createdTeachers = 0;
    const fileResults: { fileName: string; imported: number; rejected: number; duplicates: number }[] = [];

    try {
      const operationRef = newId();

      const students = schoolId ? await db.students.filter((s) => s.schoolId === schoolId && s.status === 'active').toArray() : [];
      const classesForSchool = schoolId ? await db.classes.filter((c) => c.schoolId === schoolId && c.status === 'active').toArray() : [];

      // --- Cadastro automático (só usado por early_childhood_report / elementary_report) ---
      // Lê escola/turma/aluno/professor/atividade direto da planilha e cadastra o que ainda não
      // existir, em vez de exigir que tudo já esteja pré-cadastrado antes da importação. As caches
      // abaixo são compartilhadas entre TODOS os arquivos desta importação, para que o mesmo nome
      // citado em arquivos diferentes não seja cadastrado em duplicidade.
      const allSchools = isSelfContained ? await db.schools.filter((s) => s.status === 'active').toArray() : [];
      const allClasses = isSelfContained ? await db.classes.filter((c) => c.status === 'active').toArray() : [];
      const allStudents = isSelfContained ? await db.students.filter((s) => s.status === 'active').toArray() : [];
      const allTeachers = isSelfContained ? await db.users.filter((u) => u.role === 'teacher' && u.status === 'active').toArray() : [];
      const allAcademicYears = isSelfContained ? await db.academicYears.filter((y) => y.status === 'active').toArray() : [];
      const allAssignments = isSelfContained ? await db.teacherAssignments.filter((a) => a.status === 'active').toArray() : [];
      const allCategories = documentType === 'early_childhood_report' ? await db.assessmentCategories.filter((c) => c.status === 'active').toArray() : [];
      const allActivities = documentType === 'early_childhood_report' ? await db.activities.filter((a) => a.status === 'active').toArray() : [];
      const allScales = documentType === 'elementary_report' ? await db.assessmentScales.filter((s) => s.status === 'active').toArray() : [];

      const schoolCache = new Map<string, School>();
      const classCache = new Map<string, Class>();
      const studentCache = new Map<string, Student>();
      const teacherCache = new Map<string, AppUser>();
      const academicYearCache = new Map<string, string>();
      const assignmentCache = new Set<string>();
      const categoryCache = new Map<string, AssessmentCategory>();
      const activityCache = new Map<string, Activity>();
      const scaleCache = new Map<string, string>();

      async function ensureSchool(name: string): Promise<School> {
        const key = name.trim().toLowerCase();
        const cached = schoolCache.get(key);
        if (cached) return cached;
        const existing = allSchools.find((s) => s.name.toLowerCase() === key);
        if (existing) { schoolCache.set(key, existing); return existing; }
        const created = await repositories.schools.create({ name: name.trim() }, actor);
        allSchools.push(created);
        schoolCache.set(key, created);
        createdSchools++;
        return created;
      }

      async function ensureAcademicYear(schoolIdArg: string): Promise<string> {
        const cached = academicYearCache.get(schoolIdArg);
        if (cached) return cached;
        const existing = allAcademicYears.find((y) => y.schoolId === schoolIdArg && y.isCurrent);
        if (existing) { academicYearCache.set(schoolIdArg, existing.id); return existing.id; }
        const year = new Date().getFullYear();
        const created = await repositories.academicYears.create(
          { schoolId: schoolIdArg, year, startDate: `${year}-02-01`, endDate: `${year}-12-15`, isCurrent: true },
          actor,
        );
        allAcademicYears.push(created);
        academicYearCache.set(schoolIdArg, created.id);
        return created.id;
      }

      async function ensureClass(schoolIdArg: string, name: string, stage: EducationStage): Promise<Class> {
        const key = `${schoolIdArg}::${name.trim().toLowerCase()}`;
        const cached = classCache.get(key);
        if (cached) return cached;
        const existing = allClasses.find((c) => c.schoolId === schoolIdArg && c.name.toLowerCase() === name.trim().toLowerCase());
        if (existing) { classCache.set(key, existing); return existing; }
        const academicYearId = await ensureAcademicYear(schoolIdArg);
        const created = await repositories.classes.create(
          { schoolId: schoolIdArg, academicYearId, name: name.trim(), stage, grade: name.trim(), shift: 'morning' },
          actor,
        );
        allClasses.push(created);
        classCache.set(key, created);
        createdClasses++;
        return created;
      }

      async function ensureStudent(schoolIdArg: string, classIdArg: string, name: string): Promise<Student> {
        const key = `${schoolIdArg}::${name.trim().toLowerCase()}`;
        const cached = studentCache.get(key);
        if (cached) return cached;
        const existing = allStudents.find((s) => s.schoolId === schoolIdArg && s.fullName.toLowerCase() === name.trim().toLowerCase());
        if (existing) { studentCache.set(key, existing); return existing; }
        const created = await repositories.students.create(
          {
            fullName: name.trim(),
            birthDate: '2020-01-01',
            schoolId: schoolIdArg,
            classId: classIdArg,
            matriculationStatus: 'active',
            enrollmentDate: new Date().toISOString().slice(0, 10),
          },
          actor,
        );
        allStudents.push(created);
        studentCache.set(key, created);
        createdStudentsCount++;
        return created;
      }

      /** Professor citado na planilha, mas ainda sem cadastro: criado com login bloqueado — um
       *  Owner/Admin precisa liberar o acesso e definir uma senha real depois, na tela Professores. */
      async function ensureTeacher(name: string): Promise<AppUser> {
        const key = name.trim().toLowerCase();
        const cached = teacherCache.get(key);
        if (cached) return cached;
        const existing = allTeachers.find((t) => t.fullName.toLowerCase() === key);
        if (existing) { teacherCache.set(key, existing); return existing; }
        const placeholderEmail = `${slugifyName(name)}.${newId().slice(0, 6)}@pendente.importacao`;
        const created = await repositories.users.create(
          {
            fullName: name.trim(),
            email: placeholderEmail,
            role: 'teacher',
            passwordHash: await sha256Hex(newId()),
            isDemo: false,
            isBlocked: true,
            failedLoginAttempts: 0,
          },
          actor,
        );
        allTeachers.push(created);
        teacherCache.set(key, created);
        createdTeachers++;
        return created;
      }

      async function ensureTeacherAssignment(teacherUserId: string, classIdArg: string, schoolIdArg: string, academicYearId: string): Promise<void> {
        const key = `${teacherUserId}::${classIdArg}`;
        if (assignmentCache.has(key)) return;
        const existing = allAssignments.find((a) => a.teacherUserId === teacherUserId && a.classId === classIdArg);
        if (existing) { assignmentCache.add(key); return; }
        const created: TeacherAssignment = await repositories.teacherAssignments.create(
          { teacherUserId, classId: classIdArg, schoolId: schoolIdArg, isHomeroom: false, academicYearId },
          actor,
        );
        allAssignments.push(created);
        assignmentCache.add(key);
      }

      async function ensureCategory(schoolIdArg: string, stage: EducationStage, name: string | undefined): Promise<string | undefined> {
        if (!name?.trim()) return undefined;
        const key = `${schoolIdArg}::${name.trim().toLowerCase()}`;
        const cached = categoryCache.get(key);
        if (cached) return cached.id;
        const existing = allCategories.find((c) => c.schoolId === schoolIdArg && c.name.toLowerCase() === name.trim().toLowerCase());
        if (existing) { categoryCache.set(key, existing); return existing.id; }
        const created = await repositories.assessmentCategories.create({ schoolId: schoolIdArg, stage, kind: 'custom', name: name.trim() }, actor);
        allCategories.push(created);
        categoryCache.set(key, created);
        return created.id;
      }

      async function ensureActivity(
        schoolIdArg: string,
        classIdArg: string,
        academicYearId: string,
        title: string,
        date: string,
        categoryId: string | undefined,
        teacherId: string,
      ): Promise<Activity> {
        const key = `${classIdArg}::${title.trim().toLowerCase()}::${date}`;
        const cached = activityCache.get(key);
        if (cached) return cached;
        const existing = allActivities.find((a) => a.classId === classIdArg && a.title.toLowerCase() === title.trim().toLowerCase() && a.date === date);
        if (existing) { activityCache.set(key, existing); return existing; }
        const created = await repositories.activities.create(
          {
            schoolId: schoolIdArg,
            classId: classIdArg,
            academicYearId,
            stage: 'early_childhood',
            title: title.trim(),
            categoryId,
            type: 'atividade',
            date,
            period,
            createdByTeacherId: teacherId,
          },
          actor,
        );
        allActivities.push(created);
        activityCache.set(key, created);
        return created;
      }

      /** Nenhuma escala configurada para a escola? Cria uma numérica 0–10 (a mais neutra) só para
       *  destravar o lançamento — o administrador pode trocar por conceitos depois em Configurações. */
      async function ensureDefaultScale(schoolIdArg: string): Promise<string> {
        const cached = scaleCache.get(schoolIdArg);
        if (cached) return cached;
        const existing = allScales.find((s) => s.schoolId === schoolIdArg && s.stage === 'elementary');
        if (existing) { scaleCache.set(schoolIdArg, existing.id); return existing.id; }
        const created: AssessmentScale = await repositories.assessmentScales.create(
          {
            schoolId: schoolIdArg,
            stage: 'elementary',
            name: 'Notas de 0 a 10 (criada automaticamente na importação)',
            type: 'numeric',
            minValue: 0,
            maxValue: 10,
            levels: [],
            isDefault: allScales.length === 0,
          },
          actor,
        );
        allScales.push(created);
        scaleCache.set(schoolIdArg, created.id);
        return created.id;
      }

      async function processRow(row: PreviewRow, resolution: PreviewRow['resolution'] | undefined): Promise<RowOutcome> {
        if (row.validation === 'error' || resolution === 'ignore') {
          if (row.validation === 'error') return 'rejected';
          if (row.validation === 'duplicate') return 'duplicate';
          return 'skipped';
        }

        if (documentType === 'student_registration') {
          const matchedClass = classesForSchool.find((c) => c.name.toLowerCase() === row.interpreted.className?.toLowerCase());
          if (resolution === 'update_existing' && row.matchedExistingId) {
            await repositories.students.update(row.matchedExistingId, { birthDate: row.interpreted.birthDate || undefined }, actor);
          } else {
            await repositories.students.create(
              {
                fullName: row.interpreted.fullName,
                birthDate: row.interpreted.birthDate || '2020-01-01',
                schoolId,
                classId: matchedClass?.id,
                matriculationStatus: 'active',
                internalCode: row.interpreted.internalCode || undefined,
                enrollmentDate: new Date().toISOString().slice(0, 10),
              },
              actor,
            );
          }
          return 'imported';
        }

        if (documentType === 'attendance') {
          const student = students.find((s) => s.fullName.toLowerCase() === row.interpreted.studentName?.toLowerCase());
          if (!student) return 'rejected';
          if (resolution === 'update_existing' && row.matchedExistingId) {
            await repositories.attendance.update(row.matchedExistingId, { attendanceStatus: row.interpreted.status as never }, actor);
          } else {
            await repositories.attendance.create(
              { studentId: student.id, classId: student.classId ?? classId, date: row.interpreted.date, attendanceStatus: row.interpreted.status as never, registeredBy: currentUserId },
              actor,
            );
          }
          return 'imported';
        }

        if (documentType === 'early_childhood_report') {
          const school = await ensureSchool(row.interpreted.schoolName);
          const klass = await ensureClass(school.id, row.interpreted.className, 'early_childhood');
          const student = await ensureStudent(school.id, klass.id, row.interpreted.studentName);
          const academicYearId = await ensureAcademicYear(school.id);
          let teacherId = currentUserId;
          if (row.interpreted.teacherName) {
            const teacher = await ensureTeacher(row.interpreted.teacherName);
            teacherId = teacher.id;
            await ensureTeacherAssignment(teacher.id, klass.id, school.id, academicYearId);
          }
          const categoryId = await ensureCategory(school.id, 'early_childhood', row.interpreted.categoryName);
          const activityDate =
            row.interpreted.activityDate && !Number.isNaN(Date.parse(row.interpreted.activityDate))
              ? row.interpreted.activityDate
              : new Date().toISOString().slice(0, 10);
          const activity = await ensureActivity(school.id, klass.id, academicYearId, row.interpreted.activityTitle, activityDate, categoryId, teacherId);
          const level = row.interpreted.rboLevel.trim().toUpperCase() as RboLevel;
          if (resolution === 'update_existing' && row.matchedExistingId) {
            await repositories.assessments.update(row.matchedExistingId, { rboLevel: level }, actor);
          } else {
            await repositories.assessments.create(
              { activityId: activity.id, studentId: student.id, stage: 'early_childhood', rboLevel: level, publicationStatus: 'draft' },
              actor,
            );
          }
          return 'imported';
        }

        if (documentType === 'elementary_report') {
          const school = await ensureSchool(row.interpreted.schoolName);
          const klass = await ensureClass(school.id, row.interpreted.className, 'elementary');
          const student = await ensureStudent(school.id, klass.id, row.interpreted.studentName);
          if (row.interpreted.teacherName) {
            const academicYearId = await ensureAcademicYear(school.id);
            const teacher = await ensureTeacher(row.interpreted.teacherName);
            await ensureTeacherAssignment(teacher.id, klass.id, school.id, academicYearId);
          }
          const scaleId = await ensureDefaultScale(school.id);
          const numericScore = Number(row.interpreted.numericScore.replace(',', '.'));
          if (resolution === 'update_existing' && row.matchedExistingId) {
            await repositories.grades.update(row.matchedExistingId, { numericScore }, actor);
          } else {
            await repositories.grades.create(
              { studentId: student.id, classId: klass.id, subject: row.interpreted.subject, period, scaleId, numericScore, isRecovery: false, publicationStatus: 'draft' },
              actor,
            );
          }
          return 'imported';
        }

        // Tipos ainda sem criação automática: registrado apenas no log (import_rows) para revisão manual.
        return row.validation === 'duplicate' ? 'duplicate' : 'skipped';
      }

      for (const filePreview of filePreviews) {
        let fileImported = 0;
        let fileRejected = 0;
        let fileDuplicates = 0;

        for (const row of filePreview.rows) {
          const key = `${filePreview.fileIndex}:${row.index}`;
          const outcome = await processRow(row, resolutions[key]);
          if (outcome === 'imported') { imported++; fileImported++; }
          else if (outcome === 'rejected') { rejected++; fileRejected++; }
          else if (outcome === 'duplicate') { duplicates++; fileDuplicates++; }
        }

        const fileHash = await sha256OfFile(filePreview.file);
        const batch = await repositories.imports.create(
          {
            documentType,
            fileFormat: FILE_FORMAT_FROM_NAME(filePreview.file.name) ?? 'csv',
            fileName: filePreview.file.name,
            fileSizeBytes: filePreview.file.size,
            fileHash,
            schoolId: schoolId || undefined,
            classId: classId || undefined,
            periodicity,
            periodLabel: period,
            storageDestination,
            importStatus: fileRejected === 0 ? 'completed' : fileImported > 0 ? 'partially_completed' : 'failed',
            totalRowsFound: filePreview.rows.length,
            totalImported: fileImported,
            totalRejected: fileRejected,
            totalDuplicates: fileDuplicates,
            columnMapping,
            operationRef,
          },
          actor,
        );

        for (const row of filePreview.rows) {
          await repositories.importRows.create(
            {
              importId: batch.id,
              rowIndex: row.index,
              rawValue: row.original,
              interpretedValue: row.interpreted,
              confidence: row.confidence,
              validation: row.validation,
              validationNotes: row.validationNotes,
              resolution: toDomainResolution(resolutions[`${filePreview.fileIndex}:${row.index}`]),
            },
            actor,
          );
        }

        await repositories.audit.record({ ...actor, role: session.role }, { action: 'import', module: 'imports', entityId: batch.id });
        fileResults.push({ fileName: filePreview.file.name, imported: fileImported, rejected: fileRejected, duplicates: fileDuplicates });
      }

      setResult({
        imported,
        rejected,
        duplicates,
        createdSchools,
        createdClasses,
        createdStudents: createdStudentsCount,
        createdTeachers,
        fileResults,
      });
      setStep(6);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-xs">
        {(isBncc ? BNCC_STEPS : STEPS).map((label, i) => (
          <li key={label} className={`rounded-full px-3 py-1 ${i === step ? 'bg-sky-600 text-white' : i < step ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>
            {i + 1}. {label}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card><CardContent className="space-y-4">
          <FormField label="Tipo de documento" htmlFor="documentType" required>
            <Select id="documentType" value={documentType} onChange={(e) => setDocumentType(e.target.value as ImportDocumentType)}>
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </FormField>
          {isBncc && (
            <p className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Para boletins impressos no formato "uma habilidade BNCC por linha × colunas de
              semestre" (foto ou PDF). Não exige nenhum cadastro prévio — escola, turma, aluno e
              data de nascimento são lidos do cabeçalho da própria folha. As avaliações R/B/O de
              cada habilidade não são preenchidas automaticamente (testamos contra fotos reais e a
              leitura célula a célula não é confiável o suficiente) — o arquivo fica anexado ao
              aluno para você lançá-las manualmente em Avaliações.
            </p>
          )}
          {!isAutomated && !isBncc && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Este tipo ainda não cria registros automaticamente nesta versão — os dados extraídos ficam registrados
              no log de importação para revisão manual.
            </p>
          )}
        </CardContent></Card>
      )}

      {step === 1 && isBncc && (
        <Card><CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <p className="col-span-full flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300 sm:col-span-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Nenhuma escola, turma ou aluno precisa ser selecionado aqui — tudo é lido do(s) arquivo(s) no próximo passo.
          </p>
          <FormField label="Período" htmlFor="period" required hint="Ex.: 2026-B1. Usado só como rótulo do lote de importação.">
            <Input id="period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-B1" />
          </FormField>
          <FormField label="Periodicidade" htmlFor="periodicity" required>
            <Select id="periodicity" value={periodicity} onChange={(e) => setPeriodicity(e.target.value as ImportPeriodicity)}>
              {Object.entries(PERIODICITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </FormField>
        </CardContent></Card>
      )}

      {step === 1 && !isBncc && (
        <Card><CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {isSelfContained && (
            <p className="col-span-full flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300 sm:col-span-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Este relatório lê escola, turma, aluno e professor diretamente do arquivo, cadastrando
              automaticamente o que ainda não existir. A escola abaixo é só um filtro opcional de referência.
            </p>
          )}
          <FormField label={isSelfContained ? 'Escola (opcional — filtro)' : 'Escola'} htmlFor="schoolId" required={!isSelfContained}>
            <Select id="schoolId" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setClassId(''); }}>
              <option value="">{isSelfContained ? 'Nenhum filtro' : 'Selecione…'}</option>
              {schools?.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Turma (opcional)" htmlFor="classId">
            <Select id="classId" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">Todas</option>
              {classes?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FormField>
          <FormField label="Período" htmlFor="period" required hint="Ex.: 2026-B1. A periodicidade nunca é deduzida automaticamente pela data do arquivo.">
            <Input id="period" value={period} onChange={(e) => setPeriod(e.target.value)} placeholder="2026-B1" />
          </FormField>
          <FormField label="Periodicidade" htmlFor="periodicity" required>
            <Select id="periodicity" value={periodicity} onChange={(e) => setPeriodicity(e.target.value as ImportPeriodicity)}>
              {Object.entries(PERIODICITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </FormField>
        </CardContent></Card>
      )}

      {step === 2 && (
        <Card><CardContent className="space-y-4">
          <p className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm font-medium text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
            ATENÇÃO: escolha onde os dados serão armazenados. Dados mantidos apenas neste navegador poderão ser
            perdidos caso o histórico, os dados do aplicativo ou o dispositivo sejam apagados.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setStorageDestination('local')}
              className={`rounded-lg border p-4 text-left ${storageDestination === 'local' ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/30' : 'border-slate-200 dark:border-slate-800'}`}
            >
              <p className="font-medium text-slate-800 dark:text-slate-100">Manter somente neste navegador</p>
              <p className="text-xs text-slate-500">IndexedDB local — ativo nesta versão.</p>
            </button>
            <button
              type="button"
              onClick={() => setStorageDestination('cloud')}
              className="rounded-lg border border-dashed border-slate-300 p-4 text-left opacity-60 dark:border-slate-700"
              disabled
            >
              <p className="font-medium text-slate-800 dark:text-slate-100">Salvar no banco de dados — nuvem</p>
              <p className="text-xs text-slate-500">
                Provedor: Supabase (simulado) · Organização de destino: a atual · Situação da conexão: indisponível
                nesta versão local · Disponível na Fase 6.
              </p>
            </button>
          </div>
        </CardContent></Card>
      )}

      {step === 3 && isBncc && (
        <Card><CardContent className="space-y-4">
          <input
            ref={boletimFileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpeg,.jpg,.png"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleBoletimFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => boletimFileInputRef.current?.click()}
            disabled={boletimFilesLoading || boletimEntries.length >= MAX_IMPORT_FILES}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center hover:border-sky-400 disabled:opacity-60 dark:border-slate-700"
          >
            <Upload className="h-8 w-8 text-slate-400" />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {boletimEntries.length > 0
                ? `Adicionar mais boletins (${boletimEntries.length}/${MAX_IMPORT_FILES} selecionados)`
                : `Clique para selecionar até ${MAX_IMPORT_FILES} boletins — foto (JPEG/PNG) ou PDF`}
            </span>
          </button>
          <p className="text-xs text-slate-500">
            Um arquivo por aluno (a foto do boletim impresso dele). Cada arquivo é lido individualmente —
            escola, aluno, turma e data de nascimento são extraídos automaticamente e ficam editáveis no
            próximo passo antes de confirmar.
          </p>
          {boletimOcrProgress !== null && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-sky-700 dark:text-sky-400">
                <ScanEye className="h-4 w-4 animate-pulse" />
                Lendo "{boletimOcrProgress.fileName}"… {Math.round(boletimOcrProgress.progress * 100)}%
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.round(boletimOcrProgress.progress * 100)}%` }} />
              </div>
            </div>
          )}
          {boletimSelectError && (
            <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {boletimSelectError}
            </p>
          )}
          {boletimEntries.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {boletimEntries.map((entry, i) => (
                <li key={`${entry.file.name}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-700 dark:text-slate-200">{entry.file.name}</p>
                    {entry.result ? (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {entry.header.studentName ? `Aluno: ${entry.header.studentName}` : 'Cabeçalho lido — confira no próximo passo'}
                      </p>
                    ) : (
                      <p className="flex items-center gap-1 text-xs text-rose-700 dark:text-rose-400">
                        <FileWarning className="h-3 w-3 shrink-0" /> {entry.error}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeBoletimFile(i)}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                    aria-label={`Remover ${entry.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent></Card>
      )}

      {step === 3 && !isBncc && (
        <Card><CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".csv,.xlsx,.xls,.pdf,.jpeg,.jpg,.png"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={filesLoading || fileEntries.length >= MAX_IMPORT_FILES}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center hover:border-sky-400 disabled:opacity-60 dark:border-slate-700"
          >
            <Upload className="h-8 w-8 text-slate-400" />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {fileEntries.length > 0
                ? `Adicionar mais arquivos (${fileEntries.length}/${MAX_IMPORT_FILES} selecionados)`
                : `Clique para selecionar até ${MAX_IMPORT_FILES} arquivos — CSV, XLSX, PDF, JPEG ou PNG`}
            </span>
          </button>
          <p className="text-xs text-slate-500">
            CSV e XLSX são lidos como tabela estruturada. PDF tem o texto extraído diretamente (não funciona para PDFs
            escaneados). JPEG/PNG passam por reconhecimento óptico de caracteres (OCR) — inclusive fotos de relatórios
            impressos. Nesses dois últimos casos, a revisão humana da pré-visualização é obrigatória antes de
            confirmar a importação. Você pode selecionar vários arquivos de uma vez (até {MAX_IMPORT_FILES}), por
            exemplo um relatório por aluno. Para boletins no formato "uma habilidade por linha × colunas de
            semestre", use o tipo de documento "{DOCUMENT_TYPE_LABELS[BNCC_CHECKLIST_TYPE]}".
          </p>
          {ocrProgress !== null && (
            <div className="space-y-1">
              <div className="flex items-center gap-2 text-sm text-sky-700 dark:text-sky-400">
                <ScanEye className="h-4 w-4 animate-pulse" />
                Reconhecendo texto em "{ocrProgress.fileName}"… {Math.round(ocrProgress.progress * 100)}%
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-full rounded-full bg-sky-500 transition-all" style={{ width: `${Math.round(ocrProgress.progress * 100)}%` }} />
              </div>
            </div>
          )}
          {fileSelectError && (
            <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {fileSelectError}
            </p>
          )}
          {fileEntries.length > 0 && (
            <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
              {fileEntries.map((entry, i) => (
                <li key={`${entry.file.name}-${i}`} className="flex items-start justify-between gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-slate-700 dark:text-slate-200">{entry.file.name}</p>
                    {entry.table ? (
                      <p className="text-xs text-emerald-700 dark:text-emerald-400">
                        {entry.table.rows.length} linha(s), {entry.table.headers.length} coluna(s)
                        {entry.table.source !== 'structured' && ' — revisar na pré-visualização'}
                      </p>
                    ) : entry.parseError ? (
                      <p className="flex items-center gap-1 text-xs text-rose-700 dark:text-rose-400">
                        <FileWarning className="h-3 w-3 shrink-0" /> {entry.parseError}
                      </p>
                    ) : (
                      <p className="text-xs text-slate-400">Processando…</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
                    aria-label={`Remover ${entry.file.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent></Card>
      )}

      {step === 4 && isBncc && (
        <Card><CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Confira e corrija os dados lidos de cada arquivo antes de continuar. A leitura automática pode
            errar — especialmente em fotos tortas ou com pouca luz.
          </p>
          {boletimEntries.length === 0 && <p className="text-sm text-rose-600 dark:text-rose-400">Nenhum arquivo válido selecionado.</p>}
          {boletimEntries.map((entry, i) => (
            <div key={`${entry.file.name}-${i}`} className="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{entry.file.name}</p>
                {entry.result && (
                  <Badge tone={entry.result.confidence >= 0.7 ? 'success' : 'warning'}>
                    confiança {Math.round(entry.result.confidence * 100)}%
                  </Badge>
                )}
              </div>
              {!entry.result ? (
                <p className="flex items-center gap-1 text-xs text-rose-700 dark:text-rose-400">
                  <FileWarning className="h-3 w-3 shrink-0" /> {entry.error}
                </p>
              ) : (
                <>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <FormField label="Escola" htmlFor={`bncc-school-${i}`} required>
                      <Input id={`bncc-school-${i}`} value={entry.header.schoolName} onChange={(e) => updateBoletimHeader(i, { schoolName: e.target.value })} />
                    </FormField>
                    <FormField label="Aluno" htmlFor={`bncc-student-${i}`} required>
                      <Input id={`bncc-student-${i}`} value={entry.header.studentName} onChange={(e) => updateBoletimHeader(i, { studentName: e.target.value })} />
                    </FormField>
                    <FormField label="Turma (opcional)" htmlFor={`bncc-class-${i}`}>
                      <Input id={`bncc-class-${i}`} value={entry.header.className} onChange={(e) => updateBoletimHeader(i, { className: e.target.value })} />
                    </FormField>
                    <FormField label="Data de nascimento" htmlFor={`bncc-birth-${i}`} hint="AAAA-MM-DD">
                      <Input id={`bncc-birth-${i}`} value={entry.header.birthDate} onChange={(e) => updateBoletimHeader(i, { birthDate: e.target.value })} placeholder="2020-01-01" />
                    </FormField>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">
                    Categorias BNCC detectadas no arquivo:{' '}
                    {entry.result.categoriesFound.length > 0
                      ? entry.result.categoriesFound.map((c) => c.label).join(', ')
                      : 'nenhuma identificada — confira se é mesmo um boletim nesse formato.'}
                  </p>
                </>
              )}
            </div>
          ))}
        </CardContent></Card>
      )}

      {step === 4 && !isBncc && (
        <Card><CardContent className="space-y-4">
          {!isAutomated ? (
            <p className="text-sm text-slate-500">
              Este tipo de documento usa mapeamento genérico — cada coluna identificada será registrada como está no
              log de importação, sem mapeamento campo a campo.
            </p>
          ) : (
            <>
              {fileEntries.length > 1 && (
                <p className="text-xs text-slate-500">
                  O mapeamento abaixo vale para todos os {fileEntries.length} arquivos selecionados — as opções
                  combinam as colunas encontradas em todos eles.
                </p>
              )}
              {targetFields.map((field) => (
                <FormField key={field.key} label={field.label} htmlFor={`map-${field.key}`} required={field.required}>
                  <Select
                    id={`map-${field.key}`}
                    value={columnMapping[field.key] ?? ''}
                    onChange={(e) => setColumnMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                  >
                    <option value="">Não mapear</option>
                    {combinedHeaders.map((h) => <option key={h} value={h}>{h}</option>)}
                  </Select>
                </FormField>
              ))}
            </>
          )}
        </CardContent></Card>
      )}

      {step === 5 && isBncc && (
        <Card><CardContent className="space-y-4">
          <p className="text-sm text-slate-500">
            Ao confirmar: para cada arquivo, a escola/turma/aluno acima serão cadastrados (se ainda não
            existirem) e o arquivo original ficará anexado ao aluno, em Documentos, categoria "Boletim" —
            pronto para você lançar as avaliações R/B/O manualmente em Avaliações.
          </p>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
            {boletimEntries.filter((e) => e.result).map((entry, i) => (
              <li key={`${entry.file.name}-${i}`} className="px-3 py-2">
                <p className="font-medium text-slate-800 dark:text-slate-100">{entry.header.studentName || '(nome não preenchido)'}</p>
                <p className="text-xs text-slate-500">
                  {entry.header.schoolName || '(escola não preenchida)'} · {entry.header.className || 'sem turma'} · {entry.file.name}
                </p>
              </li>
            ))}
          </ul>
          {boletimEntries.some((e) => e.result && (!e.header.schoolName.trim() || !e.header.studentName.trim())) && (
            <p className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Escola e aluno são obrigatórios — volte ao passo anterior e preencha os campos vazios, ou remova o arquivo.
            </p>
          )}
          <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={boletimReviewed}
              onChange={(e) => setBoletimReviewed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            Revisei os dados acima (escola, aluno, turma, data de nascimento) e confirmo que estão corretos.
          </label>
          <div className="flex justify-end">
            <Button
              onClick={confirmBoletimImport}
              loading={loading}
              disabled={
                !boletimReviewed ||
                boletimEntries.filter((e) => e.result).length === 0 ||
                boletimEntries.some((e) => e.result && (!e.header.schoolName.trim() || !e.header.studentName.trim()))
              }
            >
              Confirmar importação
            </Button>
          </div>
        </CardContent></Card>
      )}

      {step === 5 && !isBncc && (
        <PreviewStep
          filePreviews={filePreviews}
          hasNonStructuredSource={hasNonStructuredSource}
          loading={loading}
          resolutions={resolutions}
          setResolutions={setResolutions}
          reviewedManually={reviewedManually}
          setReviewedManually={setReviewedManually}
          onRunPreview={runPreview}
          onConfirm={confirmImport}
        />
      )}

      {step === 6 && result && (
        <Card><CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Check className="h-5 w-5" />
            <p className="font-medium">
              {result.rejected === 0 ? 'Importação concluída com sucesso.' : 'Importação concluída parcialmente — revise as linhas rejeitadas.'}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Importados" value={result.imported} />
            <Stat label="Rejeitados" value={result.rejected} />
            <Stat label="Duplicados" value={result.duplicates} />
          </div>
          {result.fileResults.length > 1 && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800">
              <table className="w-full text-xs">
                <thead className="border-b border-slate-100 bg-slate-50 text-left uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:bg-slate-900">
                  <tr>
                    <th className="px-3 py-2">Arquivo</th>
                    <th className="px-3 py-2">Importados</th>
                    <th className="px-3 py-2">Rejeitados</th>
                    <th className="px-3 py-2">Duplicados</th>
                  </tr>
                </thead>
                <tbody>
                  {result.fileResults.map((fr) => (
                    <tr key={fr.fileName} className="border-b border-slate-50 last:border-0 dark:border-slate-800/60">
                      <td className="max-w-[240px] truncate px-3 py-2 text-slate-700 dark:text-slate-200">{fr.fileName}</td>
                      <td className="px-3 py-2">{fr.imported}</td>
                      <td className="px-3 py-2">{fr.rejected}</td>
                      <td className="px-3 py-2">{fr.duplicates}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(result.createdSchools > 0 || result.createdClasses > 0 || result.createdStudents > 0 || result.createdTeachers > 0) && (
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3 text-xs text-sky-800 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-300">
              <p className="mb-2 font-medium">Cadastrados automaticamente a partir dos arquivos:</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Escolas" value={result.createdSchools} />
                <Stat label="Turmas" value={result.createdClasses} />
                <Stat label="Alunos" value={result.createdStudents} />
                <Stat label="Professores" value={result.createdTeachers} />
              </div>
              {result.createdTeachers > 0 && (
                <p className="mt-2">
                  Os professores criados ficam com o acesso bloqueado (sem senha utilizável) — um Owner/Admin
                  precisa liberar o acesso e definir uma senha real na tela <strong>Professores</strong>.
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-slate-500">
            {storageDestination === 'local' ? 'Armazenado somente neste navegador.' : 'Armazenado no banco de dados e sincronizado.'}
          </p>
          <Button onClick={onFinished}>Ver histórico de importações</Button>
        </CardContent></Card>
      )}

      {step === 6 && boletimResult && (
        <Card><CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Check className="h-5 w-5" />
            <p className="font-medium">
              {boletimResult.attachedDocuments.length} boletim(ns) anexado(s) com sucesso.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Escolas cadastradas" value={boletimResult.createdSchools} />
            <Stat label="Turmas cadastradas" value={boletimResult.createdClasses} />
            <Stat label="Alunos cadastrados" value={boletimResult.createdStudents} />
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            As avaliações R/B/O de cada habilidade não foram preenchidas automaticamente. Abra{' '}
            <strong>Avaliações</strong> para lançá-las manualmente, usando o boletim anexado a cada aluno
            (em Documentos) como referência.
          </div>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
            {boletimResult.attachedDocuments.map((d, i) => (
              <li key={`${d.studentId}-${i}`} className="flex items-center justify-between px-3 py-2">
                <span className="text-slate-700 dark:text-slate-200">{d.studentName}</span>
                <span className="truncate text-xs text-slate-400">{d.fileName}</span>
              </li>
            ))}
          </ul>
          {boletimResult.failed.length > 0 && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <p className="mb-1 flex items-center gap-1.5 font-medium">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {boletimResult.failed.length} arquivo(s) não puderam ser importados:
              </p>
              <ul className="space-y-0.5">
                {boletimResult.failed.map((f, i) => (
                  <li key={`${f.fileName}-${i}`}>
                    <span className="font-medium">{f.fileName}:</span> {f.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-xs text-slate-500">
            {storageDestination === 'local' ? 'Armazenado somente neste navegador.' : 'Armazenado no banco de dados e sincronizado.'}
          </p>
          <Button onClick={onFinished}>Ver histórico de importações</Button>
        </CardContent></Card>
      )}

      {step < 6 && (
        <div className="flex justify-between">
          <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          {step === 5 ? null : (
            <Button
              onClick={async () => {
                if (isBncc) {
                  if (step === 3 && boletimEntries.filter((e) => e.result).length === 0) return;
                  setStep((s) => s + 1);
                  return;
                }
                if (step === 3 && parsedFiles.length === 0) return;
                if (step === 4) await runPreview();
                setStep((s) => s + 1);
              }}
              disabled={
                (step === 0 && !documentType) ||
                (step === 1 && !isBncc && ((!schoolId && !isSelfContained) || !period)) ||
                (step === 1 && isBncc && !period) ||
                (step === 3 && !isBncc && (parsedFiles.length === 0 || filesLoading)) ||
                (step === 3 && isBncc && (boletimEntries.filter((e) => e.result).length === 0 || boletimFilesLoading))
              }
            >
              Avançar <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3 text-center dark:border-slate-800">
      <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function PreviewStep({
  filePreviews,
  hasNonStructuredSource,
  loading,
  resolutions,
  setResolutions,
  reviewedManually,
  setReviewedManually,
  onRunPreview,
  onConfirm,
}: {
  filePreviews: FilePreview[] | null;
  hasNonStructuredSource: boolean;
  loading: boolean;
  resolutions: Record<string, PreviewRow['resolution']>;
  setResolutions: (updater: (r: Record<string, PreviewRow['resolution']>) => Record<string, PreviewRow['resolution']>) => void;
  reviewedManually: boolean;
  setReviewedManually: (v: boolean) => void;
  onRunPreview: () => void;
  onConfirm: () => void;
}) {
  const requiresManualReview = hasNonStructuredSource;

  const flatRows = useMemo(() => {
    if (!filePreviews) return [];
    return filePreviews.flatMap((fp) =>
      fp.rows.map((row) => ({
        key: `${fp.fileIndex}:${row.index}`,
        fileName: fp.file.name,
        source: fp.table.source,
        row,
      })),
    );
  }, [filePreviews]);

  const counts = useMemo(() => {
    return {
      valid: flatRows.filter((r) => r.row.validation === 'valid').length,
      warning: flatRows.filter((r) => r.row.validation === 'warning').length,
      error: flatRows.filter((r) => r.row.validation === 'error').length,
      duplicate: flatRows.filter((r) => r.row.validation === 'duplicate').length,
    };
  }, [flatRows]);

  if (!filePreviews) {
    return (
      <Card><CardContent className="flex flex-col items-center gap-3 py-10">
        <p className="text-sm text-slate-500">Clique para validar as linhas dos arquivos e identificar duplicidades.</p>
        <Button onClick={onRunPreview} loading={loading}>Validar e pré-visualizar</Button>
      </CardContent></Card>
    );
  }

  const showFileColumn = filePreviews.length > 1;

  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge tone="info">{filePreviews.length} arquivo(s)</Badge>
          <Badge tone="success">{counts.valid} válidas</Badge>
          <Badge tone="warning">{counts.warning} avisos</Badge>
          <Badge tone="danger">{counts.error} erros</Badge>
          <Badge tone="info">{counts.duplicate} duplicidades</Badge>
        </div>

        {requiresManualReview && (
          <p className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            Um ou mais arquivos vieram de PDF ou OCR de imagem — o texto foi extraído automaticamente e as colunas
            reconstruídas por heurística. Linhas com confiança abaixo de 70% estão destacadas abaixo; confira cada
            uma com atenção.
          </p>
        )}

        <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="sticky top-0 border-b border-slate-100 bg-white text-left uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2">#</th>
                {showFileColumn && <th className="px-3 py-2">Arquivo</th>}
                <th className="px-3 py-2">Interpretado</th>
                <th className="px-3 py-2">Confiança</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Resolução</th>
              </tr>
            </thead>
            <tbody>
              {flatRows.map(({ key, fileName, source, row }) => {
                const lowConfidence = source !== 'structured' && row.confidence < 0.7;
                return (
                <tr
                  key={key}
                  className={`border-b border-slate-50 last:border-0 dark:border-slate-800/60 ${
                    row.validation === 'error' ? 'bg-rose-50/60 dark:bg-rose-950/20' : lowConfidence ? 'bg-amber-50/60 dark:bg-amber-950/20' : ''
                  }`}
                >
                  <td className="px-3 py-2 text-slate-400">{row.index + 1}</td>
                  {showFileColumn && <td className="max-w-[140px] truncate px-3 py-2 text-slate-400" title={fileName}>{fileName}</td>}
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    {Object.entries(row.interpreted).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}
                    {row.validationNotes && <p className="mt-0.5 text-[11px] text-slate-400">{row.validationNotes}</p>}
                  </td>
                  <td className={`px-3 py-2 ${lowConfidence ? 'font-medium text-amber-700 dark:text-amber-400' : ''}`}>
                    {Math.round(row.confidence * 100)}%
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={row.validation === 'valid' ? 'success' : row.validation === 'warning' ? 'warning' : row.validation === 'error' ? 'danger' : 'info'}>
                      {row.validation}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      value={resolutions[key] ?? row.resolution}
                      onChange={(e) => setResolutions((r) => ({ ...r, [key]: e.target.value as PreviewRow['resolution'] }))}
                      disabled={row.validation === 'error'}
                    >
                      <option value="import">Importar</option>
                      <option value="ignore">Ignorar</option>
                      {row.matchedExistingId && <option value="update_existing">Atualizar existente</option>}
                    </select>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {requiresManualReview && (
          <label className="mt-4 flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
            <input
              type="checkbox"
              checked={reviewedManually}
              onChange={(e) => setReviewedManually(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-slate-300"
            />
            Revisei manualmente todas as linhas acima, inclusive as destacadas com confiança baixa, e confirmo que os
            valores interpretados estão corretos.
          </label>
        )}

        <div className="mt-4 flex justify-end">
          <Button
            onClick={onConfirm}
            loading={loading}
            disabled={counts.error === flatRows.length || (requiresManualReview && !reviewedManually)}
          >
            Confirmar importação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
