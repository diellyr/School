import { db } from './schema';
import { newId, nowIso } from '../domain/common';
import { sha256Hex } from '../lib/hash';
import { DEMO_CREDENTIALS } from '../auth/demoUsers';
import {
  DEMO_ACADEMIC_YEAR_A_ID,
  DEMO_ACADEMIC_YEAR_B_ID,
  DEMO_CLASS_1ANO_ID,
  DEMO_CLASS_5ANO_ID,
  DEMO_CLASS_INFANTIL_ID,
  DEMO_CLASS_MATERNAL_ID,
  DEMO_GUARDIAN_ID,
  DEMO_ORG_ID,
  DEMO_SCHOOL_A_ID,
  DEMO_SCHOOL_B_ID,
  DEMO_STUDENT_EF_ID,
  DEMO_STUDENT_EI_ID,
} from './demoIds';
import type {
  Activity,
  AssessmentCategory,
  AssessmentScale,
  Assessment,
  AcademicYear,
  Alert,
  AppUser,
  Attendance,
  Class,
  Enrollment,
  Grade,
  Guardian,
  Organization,
  RboLevel,
  School,
  SchoolEvent,
  Student,
  StudentGuardian,
  TeacherAssignment,
  TeacherObservation,
} from '../domain';

const SEED_ACTOR = { userId: 'seed-script', role: 'owner' as const };

/** Todas as tabelas que recebem registros marcados isDemo — usadas por load e remove. */
const DEMO_TABLES = [
  db.organizations, db.schools, db.academicYears, db.classes, db.enrollments,
  db.students, db.guardians, db.studentGuardians, db.users, db.teacherAssignments,
  db.assessmentScales, db.assessmentCategories, db.activities, db.assessments, db.grades,
  db.attendance, db.teacherObservations, db.alerts, db.schoolEvents, db.eventConfirmations,
  db.recommendations,
];

function base(overrides: Partial<{ organizationId: string; createdBy: string }> = {}) {
  const now = nowIso();
  return {
    organizationId: overrides.organizationId ?? DEMO_ORG_ID,
    createdAt: now,
    updatedAt: now,
    createdBy: overrides.createdBy ?? SEED_ACTOR.userId,
    updatedBy: overrides.createdBy ?? SEED_ACTOR.userId,
    version: 1,
    status: 'active' as const,
    isDemo: true,
  };
}

export async function isDemoDataLoaded(): Promise<boolean> {
  const org = await db.organizations.get(DEMO_ORG_ID);
  return !!org;
}

export async function loadDemoData(): Promise<void> {
  if (await isDemoDataLoaded()) return;

  // Pré-calcula os hashes de senha ANTES da transação: crypto.subtle é uma API
  // assíncrona nativa (não rastreada pelo Dexie), e aguardá-la dentro de uma
  // transação encerraria a transação prematuramente (PrematureCommitError).
  const passwordHashByCredentialId = new Map<string, string>();
  for (const cred of DEMO_CREDENTIALS) {
    passwordHashByCredentialId.set(cred.id, await sha256Hex(cred.password));
  }

  await db.transaction('rw', DEMO_TABLES, async () => {
    const organization: Organization = {
      ...base(),
      id: DEMO_ORG_ID,
      name: 'Rede Educacional Demonstração',
      legalName: 'Rede Educacional Demonstração LTDA (fictícia)',
      cloudStorageEnabled: false,
      retentionPolicyDays: 1825,
    };
    await db.organizations.add(organization);

    const schoolA: School = { ...base(), id: DEMO_SCHOOL_A_ID, name: 'Escola Girassol', email: 'contato@girassol.demo' };
    const schoolB: School = { ...base(), id: DEMO_SCHOOL_B_ID, name: 'Colégio Nascente', email: 'contato@nascente.demo' };
    await db.schools.bulkAdd([schoolA, schoolB]);

    const yearA: AcademicYear = { ...base(), id: DEMO_ACADEMIC_YEAR_A_ID, schoolId: schoolA.id, year: 2026, startDate: '2026-02-01', endDate: '2026-12-15', isCurrent: true };
    const yearB: AcademicYear = { ...base(), id: DEMO_ACADEMIC_YEAR_B_ID, schoolId: schoolB.id, year: 2026, startDate: '2026-02-01', endDate: '2026-12-15', isCurrent: true };
    await db.academicYears.bulkAdd([yearA, yearB]);

    const classInfantil: Class = { ...base(), id: DEMO_CLASS_INFANTIL_ID, schoolId: schoolA.id, academicYearId: yearA.id, name: 'Infantil II - Manhã', stage: 'early_childhood', grade: 'Infantil II', shift: 'morning' };
    const class1ano: Class = { ...base(), id: DEMO_CLASS_1ANO_ID, schoolId: schoolA.id, academicYearId: yearA.id, name: '1º Ano A', stage: 'elementary', grade: '1º ano', shift: 'morning' };
    const classMaternal: Class = { ...base(), id: DEMO_CLASS_MATERNAL_ID, schoolId: schoolB.id, academicYearId: yearB.id, name: 'Maternal - Tarde', stage: 'early_childhood', grade: 'Maternal', shift: 'afternoon' };
    const class5ano: Class = { ...base(), id: DEMO_CLASS_5ANO_ID, schoolId: schoolB.id, academicYearId: yearB.id, name: '5º Ano B', stage: 'elementary', grade: '5º ano', shift: 'afternoon' };
    await db.classes.bulkAdd([classInfantil, class1ano, classMaternal, class5ano]);

    // --- Usuários de demonstração (senha hasheada, nunca em texto puro) ---
    const users: AppUser[] = [];
    for (const cred of DEMO_CREDENTIALS) {
      users.push({
        ...base(),
        id: cred.id,
        fullName: cred.fullName,
        email: cred.email,
        role: cred.role,
        passwordHash: passwordHashByCredentialId.get(cred.id)!,
        isDemo: true,
        isBlocked: false,
        guardianId: cred.guardianId,
        studentId: cred.studentId,
        teacherTitle: cred.teacherTitle,
        failedLoginAttempts: 0,
      });
    }
    await db.users.bulkAdd(users);

    const teacherAssignments: TeacherAssignment[] = [
      { ...base(), id: newId(), teacherUserId: DEMO_CREDENTIALS[2].id, classId: classInfantil.id, schoolId: schoolA.id, isHomeroom: true, academicYearId: yearA.id },
      { ...base(), id: newId(), teacherUserId: DEMO_CREDENTIALS[2].id, classId: class1ano.id, schoolId: schoolA.id, subject: 'Multidisciplinar', isHomeroom: true, academicYearId: yearA.id },
    ];
    await db.teacherAssignments.bulkAdd(teacherAssignments);

    // --- Responsáveis ---
    const guardianAna: Guardian = { ...base(), id: DEMO_GUARDIAN_ID, fullName: 'Ana Paula Lima', email: 'responsavel@demo.escola.app', phone: '(11) 90000-0001', relationship: 'mother' };
    const guardianCarlos: Guardian = { ...base(), id: newId(), fullName: 'Carlos Andrade', email: 'carlos.andrade@demo.escola.app', phone: '(11) 90000-0002', relationship: 'father' };
    await db.guardians.bulkAdd([guardianAna, guardianCarlos]);

    // --- Alunos ---
    const miguel: Student = {
      ...base(), id: DEMO_STUDENT_EI_ID, fullName: 'Miguel Lima', birthDate: '2022-03-14', schoolId: schoolA.id, classId: classInfantil.id,
      grade: 'Infantil II', shift: 'morning', academicYearId: yearA.id, enrollmentDate: '2026-02-01', matriculationStatus: 'active', internalCode: 'MAT-0001',
    };
    const laura: Student = {
      ...base(), id: DEMO_STUDENT_EF_ID, fullName: 'Laura Lima', birthDate: '2019-06-22', schoolId: schoolA.id, classId: class1ano.id,
      grade: '1º ano', shift: 'morning', academicYearId: yearA.id, enrollmentDate: '2026-02-01', matriculationStatus: 'active', internalCode: 'MAT-0002',
    };
    const sofia: Student = {
      ...base(), id: newId(), fullName: 'Sofia Andrade', birthDate: '2023-01-09', schoolId: schoolB.id, classId: classMaternal.id,
      grade: 'Maternal', shift: 'afternoon', academicYearId: yearB.id, enrollmentDate: '2026-02-01', matriculationStatus: 'active', internalCode: 'MAT-0003',
    };
    const pedro: Student = {
      ...base(), id: newId(), fullName: 'Pedro Andrade', birthDate: '2016-11-30', schoolId: schoolB.id, classId: class5ano.id,
      grade: '5º ano', shift: 'afternoon', academicYearId: yearB.id, enrollmentDate: '2026-02-01', matriculationStatus: 'active', internalCode: 'MAT-0004',
    };
    await db.students.bulkAdd([miguel, laura, sofia, pedro]);

    const enrollments: Enrollment[] = [miguel, laura].map((s) => ({
      ...base(), id: newId(), studentId: s.id, schoolId: schoolA.id, classId: s.classId!, academicYearId: yearA.id, enrollmentDate: s.enrollmentDate!, enrollmentStatus: 'active' as const,
    })).concat([sofia, pedro].map((s) => ({
      ...base(), id: newId(), studentId: s.id, schoolId: schoolB.id, classId: s.classId!, academicYearId: yearB.id, enrollmentDate: s.enrollmentDate!, enrollmentStatus: 'active' as const,
    })));
    await db.enrollments.bulkAdd(enrollments);

    const studentGuardians: StudentGuardian[] = [
      { ...base(), id: newId(), studentId: miguel.id, guardianId: guardianAna.id, relationship: 'mother', isPrimary: true, canPickUp: true, financialResponsible: true },
      { ...base(), id: newId(), studentId: laura.id, guardianId: guardianAna.id, relationship: 'mother', isPrimary: true, canPickUp: true, financialResponsible: true },
      { ...base(), id: newId(), studentId: sofia.id, guardianId: guardianCarlos.id, relationship: 'father', isPrimary: true, canPickUp: true, financialResponsible: true },
      { ...base(), id: newId(), studentId: pedro.id, guardianId: guardianCarlos.id, relationship: 'father', isPrimary: true, canPickUp: true, financialResponsible: true },
    ];
    await db.studentGuardians.bulkAdd(studentGuardians);

    // --- Categorias (Educação Infantil) ---
    const categories: AssessmentCategory[] = [
      { ...base(), id: newId(), schoolId: schoolA.id, stage: 'early_childhood', kind: 'bncc_field', bnccField: 'eu_outro_nos', name: 'O eu, o outro e o nós' },
      { ...base(), id: newId(), schoolId: schoolA.id, stage: 'early_childhood', kind: 'bncc_field', bnccField: 'corpo_gestos_movimentos', name: 'Corpo, gestos e movimentos' },
      { ...base(), id: newId(), schoolId: schoolA.id, stage: 'early_childhood', kind: 'custom', name: 'Autonomia' },
    ];
    await db.assessmentCategories.bulkAdd(categories);

    // --- Atividades e avaliações R/B/O (Miguel, ao longo de 2 bimestres) ---
    const rboSequence: RboLevel[] = ['R', 'B', 'B', 'O', 'B', 'O'];
    const activities: Activity[] = [];
    const assessments: Assessment[] = [];
    const periods = ['2026-B1', '2026-B2'];
    let seq = 0;
    for (const period of periods) {
      for (const category of categories) {
        const activity: Activity = {
          ...base(), id: newId(), schoolId: schoolA.id, classId: classInfantil.id, academicYearId: yearA.id, stage: 'early_childhood',
          title: `Atividade de ${category.name} — ${period}`, categoryId: category.id, type: 'atividade',
          date: period === '2026-B1' ? '2026-04-10' : '2026-08-12', period, createdByTeacherId: DEMO_CREDENTIALS[2].id,
        };
        activities.push(activity);
        assessments.push({
          ...base(), id: newId(), activityId: activity.id, studentId: miguel.id, stage: 'early_childhood',
          rboLevel: rboSequence[seq % rboSequence.length], publicationStatus: 'published', publishedAt: nowIso(),
        });
        seq++;
      }
    }
    await db.activities.bulkAdd(activities);
    await db.assessments.bulkAdd(assessments);

    // --- Escalas do Ensino Fundamental ---
    const scaleConceitos: AssessmentScale = {
      ...base(), id: newId(), schoolId: schoolA.id, stage: 'elementary', name: 'Conceitos A a E', type: 'concept', isDefault: true,
      levels: [
        { code: 'E', label: 'Insuficiente', order: 1 },
        { code: 'D', label: 'Regular', order: 2 },
        { code: 'C', label: 'Bom', order: 3 },
        { code: 'B', label: 'Muito bom', order: 4 },
        { code: 'A', label: 'Excelente', order: 5 },
      ],
    };
    const scaleNumerica: AssessmentScale = {
      ...base(), id: newId(), schoolId: schoolB.id, stage: 'elementary', name: 'Notas de 0 a 10', type: 'numeric', isDefault: true,
      minValue: 0, maxValue: 10,
      levels: [],
    };
    await db.assessmentScales.bulkAdd([scaleConceitos, scaleNumerica]);

    const grades: Grade[] = [
      { ...base(), id: newId(), studentId: laura.id, classId: class1ano.id, subject: 'Língua Portuguesa', period: '2026-B1', scaleId: scaleConceitos.id, scaleLevelCode: 'B', isRecovery: false, publicationStatus: 'published' },
      { ...base(), id: newId(), studentId: laura.id, classId: class1ano.id, subject: 'Matemática', period: '2026-B1', scaleId: scaleConceitos.id, scaleLevelCode: 'C', isRecovery: false, publicationStatus: 'published' },
      { ...base(), id: newId(), studentId: laura.id, classId: class1ano.id, subject: 'Língua Portuguesa', period: '2026-B2', scaleId: scaleConceitos.id, scaleLevelCode: 'A', isRecovery: false, publicationStatus: 'published' },
      { ...base(), id: newId(), studentId: pedro.id, classId: class5ano.id, subject: 'Matemática', period: '2026-B1', scaleId: scaleNumerica.id, numericScore: 7.5, isRecovery: false, publicationStatus: 'published' },
      { ...base(), id: newId(), studentId: pedro.id, classId: class5ano.id, subject: 'Ciências', period: '2026-B1', scaleId: scaleNumerica.id, numericScore: 5.8, isRecovery: false, publicationStatus: 'published' },
      { ...base(), id: newId(), studentId: pedro.id, classId: class5ano.id, subject: 'Matemática', period: '2026-B2', scaleId: scaleNumerica.id, numericScore: 8.2, isRecovery: false, publicationStatus: 'published' },
    ];
    await db.grades.bulkAdd(grades);

    // --- Frequência ---
    const attendanceRows: Attendance[] = [];
    const attendanceDates = ['2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10'];
    for (const date of attendanceDates) {
      attendanceRows.push({ ...base(), id: newId(), studentId: miguel.id, classId: classInfantil.id, date, attendanceStatus: 'present', registeredBy: DEMO_CREDENTIALS[2].id });
      attendanceRows.push({ ...base(), id: newId(), studentId: laura.id, classId: class1ano.id, date, attendanceStatus: date === '2026-04-08' ? 'justified_absence' : 'present', registeredBy: DEMO_CREDENTIALS[2].id });
    }
    await db.attendance.bulkAdd(attendanceRows);

    // --- Observação de professor ---
    const observation: TeacherObservation = {
      ...base(), id: newId(), studentId: miguel.id, teacherId: DEMO_CREDENTIALS[2].id, classId: classInfantil.id, date: '2026-04-11',
      categoryId: categories[2].id, text: 'Miguel tem se mostrado cada vez mais independente na hora do lanche e ao guardar seus materiais.',
      visibleToGuardians: true, publicationStatus: 'published',
    };
    await db.teacherObservations.add(observation);

    // --- Alerta informativo (poucos registros — nunca conclusão precipitada) ---
    const alert: Alert = {
      ...base(), id: newId(), studentId: sofia.id, level: 'informativo',
      reason: 'Ainda há poucos registros de atividades para a Sofia neste período.',
      periodStart: '2026-02-01', periodEnd: '2026-04-30', recordsUsed: 1, confidence: 'baixa',
      recommendations: ['Aguardar mais registros antes de qualquer análise de tendência.'],
      alertStatus: 'active',
    };
    await db.alerts.add(alert);

    // --- Evento escolar ---
    const event: SchoolEvent = {
      ...base(), id: newId(), title: 'Reunião de pais — Infantil II', description: 'Apresentação do planejamento do semestre.',
      schoolId: schoolA.id, classId: classInfantil.id, audience: 'class', startAt: '2026-05-15T18:00:00.000Z', location: 'Sala Multiuso',
      responsibleUserId: DEMO_CREDENTIALS[2].id, type: 'reuniao', requiresAuthorization: false, transportProvided: false,
      guardianAttendance: 'required', requiresConfirmation: true, eventStatus: 'published',
    };
    await db.schoolEvents.add(event);
    await db.eventConfirmations.add({
      ...base(), id: newId(), eventId: event.id, guardianId: guardianAna.id, studentId: miguel.id, response: 'pending',
    });

    // --- Recomendação ---
    await db.recommendations.add({
      ...base(), id: newId(), title: 'Brincadeiras que estimulam a autonomia', content: 'Envolva a criança em pequenas tarefas do dia a dia, como guardar brinquedos e escolher a própria roupa, sempre com supervisão.',
      ageRange: '3-5', bnccField: 'eu_outro_nos', environment: 'both', source: 'Equipe pedagógica — orientações gerais BNCC Educação Infantil',
      sourceValidated: true, reviewedAt: nowIso(), published: true,
    });
  });
}

export async function removeDemoData(): Promise<void> {
  await db.transaction('rw', DEMO_TABLES, async () => {
    for (const table of DEMO_TABLES) {
      const all = await table.toArray();
      const demoIds = all.filter((r: { isDemo?: boolean; id: string }) => r.isDemo).map((r) => r.id);
      if (demoIds.length) await table.bulkDelete(demoIds);
    }
  });
}
