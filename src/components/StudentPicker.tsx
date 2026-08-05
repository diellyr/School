import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/schema';
import { Select } from './form/Field';
import type { EducationStage } from '../domain';

interface StudentPickerProps {
  stage: EducationStage;
  schoolId: string;
  classId: string;
  studentId: string;
  onSchoolChange: (id: string) => void;
  onClassChange: (id: string) => void;
  onStudentChange: (id: string) => void;
}

/** Filtro em cascata Escola → Turma → Aluno, reaproveitado pelos dashboards e telas de lançamento. */
export function StudentPicker({
  stage,
  schoolId,
  classId,
  studentId,
  onSchoolChange,
  onClassChange,
  onStudentChange,
}: StudentPickerProps) {
  const schools = useLiveQuery(() => db.schools.filter((s) => s.status === 'active').toArray(), []);
  const classes = useLiveQuery(
    () => db.classes.filter((c) => c.status === 'active' && c.stage === stage).toArray(),
    [stage],
  );
  const students = useLiveQuery(() => db.students.filter((s) => s.status === 'active').toArray(), []);

  const filteredClasses = (classes ?? []).filter((c) => !schoolId || c.schoolId === schoolId);
  const filteredStudents = (students ?? []).filter(
    (s) => (!schoolId || s.schoolId === schoolId) && (!classId || s.classId === classId),
  );

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <Select
        value={schoolId}
        onChange={(e) => {
          onSchoolChange(e.target.value);
          onClassChange('');
          onStudentChange('');
        }}
      >
        <option value="">Todas as escolas</option>
        {schools?.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </Select>
      <Select
        value={classId}
        onChange={(e) => {
          onClassChange(e.target.value);
          onStudentChange('');
        }}
      >
        <option value="">Todas as turmas</option>
        {filteredClasses.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>
      <Select value={studentId} onChange={(e) => onStudentChange(e.target.value)}>
        <option value="">Selecione um aluno…</option>
        {filteredStudents.map((s) => (
          <option key={s.id} value={s.id}>{s.socialName || s.fullName}</option>
        ))}
      </Select>
    </div>
  );
}
