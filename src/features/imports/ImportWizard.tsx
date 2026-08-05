import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Upload } from 'lucide-react';
import { db } from '../../db/schema';
import { Button } from '../../components/Button';
import { Card, CardContent } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { FormField, Input, Select } from '../../components/form/Field';
import { useRepositories } from '../../repositories/RepositoryProvider';
import { useAuthStore } from '../../auth/authStore';
import { DOCUMENT_TYPE_LABELS, FILE_FORMAT_FROM_NAME, PERIODICITY_LABELS, TARGET_FIELDS } from './importTypes';
import { parseTabularFile, type ParsedTable } from './parseFile';
import { buildPreview, type PreviewRow } from './validateRows';
import { sha256OfFile } from '../../lib/files';
import { newId } from '../../domain/common';
import type { Class, ImportDocumentType, ImportPeriodicity, School, StorageDestination } from '../../domain';

const STEPS = ['Tipo de documento', 'Escopo e período', 'Armazenamento', 'Arquivo', 'Mapeamento', 'Pré-visualização', 'Resultado'];

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

export function ImportWizard({ onFinished }: { onFinished: () => void }) {
  const [step, setStep] = useState(0);
  const [documentType, setDocumentType] = useState<ImportDocumentType>('student_registration');
  const [schoolId, setSchoolId] = useState('');
  const [classId, setClassId] = useState('');
  const [period, setPeriod] = useState('');
  const [periodicity, setPeriodicity] = useState<ImportPeriodicity>('bimonthly');
  const [storageDestination, setStorageDestination] = useState<StorageDestination>('local');
  const [file, setFile] = useState<File | null>(null);
  const [table, setTable] = useState<ParsedTable | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [resolutions, setResolutions] = useState<Record<number, PreviewRow['resolution']>>({});
  const [result, setResult] = useState<{ imported: number; rejected: number; duplicates: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const repositories = useRepositories();
  const session = useAuthStore((s) => s.session);
  const schools = useLiveQuery<School[]>(() => db.schools.filter((s) => s.status === 'active').toArray(), []);
  const classes = useLiveQuery<Class[]>(
    () => (schoolId ? db.classes.filter((c) => c.schoolId === schoolId && c.status === 'active').toArray() : Promise.resolve<Class[]>([])),
    [schoolId],
  );

  const targetFields = TARGET_FIELDS[documentType];
  const isAutomated = targetFields.length > 0;

  async function handleFileSelected(f: File) {
    setFile(f);
    const format = FILE_FORMAT_FROM_NAME(f.name);
    if (format !== 'csv' && format !== 'xlsx' && format !== 'xls') {
      alert('Nesta fase, apenas CSV e XLSX geram pré-visualização automática. PDF/imagens (OCR) chegam na Fase 7.');
      return;
    }
    const parsed = await parseTabularFile(f);
    setTable(parsed);
    const autoMapping: Record<string, string> = {};
    for (const field of targetFields) {
      const candidates = [field.key, field.label, ...field.synonyms].map(normalizeHeader);
      const match = parsed.headers.find((h) => candidates.includes(normalizeHeader(h)));
      if (match) autoMapping[field.key] = match;
    }
    setColumnMapping(autoMapping);
  }

  async function runPreview() {
    if (!table) return;
    setLoading(true);
    try {
      const rows = await buildPreview(documentType, table, columnMapping, { schoolId, classId });
      setPreview(rows);
      const initialResolutions: Record<number, PreviewRow['resolution']> = {};
      for (const r of rows) initialResolutions[r.index] = r.resolution;
      setResolutions(initialResolutions);
    } finally {
      setLoading(false);
    }
  }

  async function confirmImport() {
    if (!session || !preview || !file) return;
    setLoading(true);
    const actor = { userId: session.user.id, organizationId: session.user.organizationId };
    let imported = 0;
    let rejected = 0;
    let duplicates = 0;

    try {
      const fileHash = await sha256OfFile(file);
      const operationRef = newId();

      const students = schoolId ? await db.students.filter((s) => s.schoolId === schoolId && s.status === 'active').toArray() : [];
      const classesForSchool = schoolId ? await db.classes.filter((c) => c.schoolId === schoolId && c.status === 'active').toArray() : [];

      for (const row of preview) {
        const resolution = resolutions[row.index];
        if (row.validation === 'error' || resolution === 'ignore') {
          if (row.validation === 'error') rejected++;
          if (row.validation === 'duplicate') duplicates++;
          continue;
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
          imported++;
        } else if (documentType === 'attendance') {
          const student = students.find((s) => s.fullName.toLowerCase() === row.interpreted.studentName?.toLowerCase());
          if (!student) {
            rejected++;
            continue;
          }
          if (resolution === 'update_existing' && row.matchedExistingId) {
            await repositories.attendance.update(row.matchedExistingId, { attendanceStatus: row.interpreted.status as never }, actor);
          } else {
            await repositories.attendance.create(
              { studentId: student.id, classId: student.classId ?? classId, date: row.interpreted.date, attendanceStatus: row.interpreted.status as never, registeredBy: session.user.id },
              actor,
            );
          }
          imported++;
        } else {
          // Tipos ainda sem criação automática: registrado apenas no log (import_rows) para revisão manual.
          duplicates += row.validation === 'duplicate' ? 1 : 0;
        }
      }

      const batch = await repositories.imports.create(
        {
          documentType,
          fileFormat: FILE_FORMAT_FROM_NAME(file.name) ?? 'csv',
          fileName: file.name,
          fileSizeBytes: file.size,
          fileHash,
          schoolId: schoolId || undefined,
          classId: classId || undefined,
          periodicity,
          periodLabel: period,
          storageDestination,
          importStatus: rejected === 0 ? 'completed' : imported > 0 ? 'partially_completed' : 'failed',
          totalRowsFound: preview.length,
          totalImported: imported,
          totalRejected: rejected,
          totalDuplicates: duplicates,
          columnMapping,
          operationRef,
        },
        actor,
      );

      for (const row of preview) {
        await repositories.importRows.create(
          {
            importId: batch.id,
            rowIndex: row.index,
            rawValue: row.original,
            interpretedValue: row.interpreted,
            confidence: row.confidence,
            validation: row.validation,
            validationNotes: row.validationNotes,
            resolution: toDomainResolution(resolutions[row.index]),
          },
          actor,
        );
      }

      await repositories.audit.record({ ...actor, role: session.role }, { action: 'import', module: 'imports', entityId: batch.id });
      setResult({ imported, rejected, duplicates });
      setStep(6);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <ol className="flex flex-wrap gap-2 text-xs">
        {STEPS.map((label, i) => (
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
          {!isAutomated && (
            <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Este tipo ainda não cria registros automaticamente nesta versão — os dados extraídos ficam registrados
              no log de importação para revisão manual.
            </p>
          )}
        </CardContent></Card>
      )}

      {step === 1 && (
        <Card><CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Escola" htmlFor="schoolId" required>
            <Select id="schoolId" value={schoolId} onChange={(e) => { setSchoolId(e.target.value); setClassId(''); }}>
              <option value="">Selecione…</option>
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

      {step === 3 && (
        <Card><CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls,.pdf,.jpeg,.jpg,.png"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-10 text-center hover:border-sky-400 dark:border-slate-700"
          >
            <Upload className="h-8 w-8 text-slate-400" />
            <span className="text-sm text-slate-600 dark:text-slate-300">{file ? file.name : 'Clique para selecionar um arquivo CSV ou XLSX'}</span>
          </button>
          {table && (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              {table.rows.length} linha(s) e {table.headers.length} coluna(s) identificadas: {table.headers.join(', ')}
            </p>
          )}
        </CardContent></Card>
      )}

      {step === 4 && (
        <Card><CardContent className="space-y-4">
          {!isAutomated ? (
            <p className="text-sm text-slate-500">
              Este tipo de documento usa mapeamento genérico — cada coluna identificada será registrada como está no
              log de importação, sem mapeamento campo a campo.
            </p>
          ) : (
            targetFields.map((field) => (
              <FormField key={field.key} label={field.label} htmlFor={`map-${field.key}`} required={field.required}>
                <Select
                  id={`map-${field.key}`}
                  value={columnMapping[field.key] ?? ''}
                  onChange={(e) => setColumnMapping((m) => ({ ...m, [field.key]: e.target.value }))}
                >
                  <option value="">Não mapear</option>
                  {table?.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                </Select>
              </FormField>
            ))
          )}
        </CardContent></Card>
      )}

      {step === 5 && (
        <PreviewStep
          preview={preview}
          loading={loading}
          resolutions={resolutions}
          setResolutions={setResolutions}
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
                if (step === 3 && !table) return;
                if (step === 4) await runPreview();
                setStep((s) => s + 1);
              }}
              disabled={(step === 0 && !documentType) || (step === 1 && (!schoolId || !period)) || (step === 3 && !table)}
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
  preview,
  loading,
  resolutions,
  setResolutions,
  onRunPreview,
  onConfirm,
}: {
  preview: PreviewRow[] | null;
  loading: boolean;
  resolutions: Record<number, PreviewRow['resolution']>;
  setResolutions: (updater: (r: Record<number, PreviewRow['resolution']>) => Record<number, PreviewRow['resolution']>) => void;
  onRunPreview: () => void;
  onConfirm: () => void;
}) {
  const counts = useMemo(() => {
    if (!preview) return { valid: 0, warning: 0, error: 0, duplicate: 0 };
    return {
      valid: preview.filter((r) => r.validation === 'valid').length,
      warning: preview.filter((r) => r.validation === 'warning').length,
      error: preview.filter((r) => r.validation === 'error').length,
      duplicate: preview.filter((r) => r.validation === 'duplicate').length,
    };
  }, [preview]);

  if (!preview) {
    return (
      <Card><CardContent className="flex flex-col items-center gap-3 py-10">
        <p className="text-sm text-slate-500">Clique para validar as linhas do arquivo e identificar duplicidades.</p>
        <Button onClick={onRunPreview} loading={loading}>Validar e pré-visualizar</Button>
      </CardContent></Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className="mb-4 flex flex-wrap gap-2">
          <Badge tone="success">{counts.valid} válidas</Badge>
          <Badge tone="warning">{counts.warning} avisos</Badge>
          <Badge tone="danger">{counts.error} erros</Badge>
          <Badge tone="info">{counts.duplicate} duplicidades</Badge>
        </div>

        <div className="max-h-96 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="sticky top-0 border-b border-slate-100 bg-white text-left uppercase tracking-wide text-slate-400 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Interpretado</th>
                <th className="px-3 py-2">Confiança</th>
                <th className="px-3 py-2">Situação</th>
                <th className="px-3 py-2">Resolução</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((row) => (
                <tr key={row.index} className={`border-b border-slate-50 last:border-0 dark:border-slate-800/60 ${row.validation === 'error' ? 'bg-rose-50/60 dark:bg-rose-950/20' : ''}`}>
                  <td className="px-3 py-2 text-slate-400">{row.index + 1}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                    {Object.entries(row.interpreted).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}
                    {row.validationNotes && <p className="mt-0.5 text-[11px] text-slate-400">{row.validationNotes}</p>}
                  </td>
                  <td className="px-3 py-2">{Math.round(row.confidence * 100)}%</td>
                  <td className="px-3 py-2">
                    <Badge tone={row.validation === 'valid' ? 'success' : row.validation === 'warning' ? 'warning' : row.validation === 'error' ? 'danger' : 'info'}>
                      {row.validation}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <select
                      className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
                      value={resolutions[row.index] ?? row.resolution}
                      onChange={(e) => setResolutions((r) => ({ ...r, [row.index]: e.target.value as PreviewRow['resolution'] }))}
                      disabled={row.validation === 'error'}
                    >
                      <option value="import">Importar</option>
                      <option value="ignore">Ignorar</option>
                      {row.matchedExistingId && <option value="update_existing">Atualizar existente</option>}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex justify-end">
          <Button onClick={onConfirm} loading={loading} disabled={counts.error === preview.length}>
            Confirmar importação
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
