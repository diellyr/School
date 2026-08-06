import type { Activity, Assessment, ExperienceField, FamilyActivity, FamilyPreferences, RboLevel, Skill } from '../../../domain';
import { InMemoryPedagogicalRepository } from '../../../repositories/pedagogical/InMemoryPedagogicalRepository';

let counter = 0;
function id(prefix: string): string {
  counter++;
  return `${prefix}-${counter}`;
}

const base = { organizationId: 'org-1', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', createdBy: 'test', updatedBy: 'test', version: 1, status: 'active' as const };

export function makeActivityOption(overrides: Partial<FamilyActivity> & { skillId: string }): FamilyActivity {
  return {
    id: id('activity-option'),
    title: 'Atividade de teste',
    shortDescription: '',
    objective: '',
    instructions: [],
    ageGroups: ['4-5'],
    durationMinutes: 10,
    materials: [],
    materialLevel: 'none',
    difficulty: 'easy',
    environment: 'home',
    activityType: 'generic',
    requiresAdult: true,
    tags: [],
    active: true,
    ...overrides,
  };
}

export function makeSkill(overrides: Partial<Skill> & { id: string; matchTexts: string[] }): Skill {
  return {
    slug: overrides.id,
    name: overrides.id,
    description: '',
    keywords: [],
    ageGroups: ['4-5'],
    bnccReference: null,
    source: { institution: 'MEC', framework: 'BNCC', document: 'BNCC', sourceType: 'school-indicator' },
    familyGuidance: { importance: '', howToHelp: [], generalRecommendations: [], recommendedFrequencyPerWeek: 2, estimatedMinutesMin: 10, estimatedMinutesMax: 15 },
    activityOptions: [],
    ...overrides,
  };
}

export function makeExperienceField(overrides: Partial<ExperienceField> & { id: ExperienceField['id']; skills: Skill[] }): ExperienceField {
  return {
    slug: overrides.id,
    name: overrides.id,
    description: '',
    source: { institution: 'MEC', framework: 'BNCC', document: 'BNCC', sourceType: 'official-framework' },
    ...overrides,
  };
}

export function makeActivity(overrides: Partial<Activity> & { title: string; period: string }): Activity {
  return {
    ...base,
    id: id('activity'),
    schoolId: 'school-1',
    classId: 'class-1',
    academicYearId: 'year-1',
    stage: 'early_childhood',
    description: undefined,
    type: 'atividade',
    date: '2026-01-01',
    createdByTeacherId: 'teacher-1',
    ...overrides,
  };
}

export function makeAssessment(overrides: Partial<Assessment> & { activityId: string; rboLevel: RboLevel }): Assessment {
  return {
    ...base,
    id: id('assessment'),
    studentId: 'student-1',
    stage: 'early_childhood',
    publicationStatus: 'published',
    ...overrides,
  };
}

export function makePreferences(overrides: Partial<FamilyPreferences> = {}): FamilyPreferences {
  return {
    ...base,
    id: id('preferences'),
    studentId: 'student-1',
    availableDays: ['monday', 'wednesday', 'friday'],
    maxActivitiesPerWeek: 3,
    maxMinutesPerActivity: 20,
    availableMaterials: [],
    preferredActivityTypes: [],
    avoidActivityTypes: [],
    preferredEnvironment: 'either',
    avoidRepeatWeeks: 3,
    ...overrides,
  };
}

/** Habilidade "conflict-resolution" com 3 atividades — usada na maioria dos testes de análise. */
export function buildConflictResolutionField(): ExperienceField {
  const skill = makeSkill({
    id: 'conflict-resolution',
    matchTexts: ['resolve conflitos respeitando regras e combinacoes'],
    activityOptions: [
      makeActivityOption({ id: 'conflict-01', skillId: 'conflict-resolution', title: 'Teatro com bonecos' }),
      makeActivityOption({ id: 'conflict-02', skillId: 'conflict-resolution', title: 'O que você faria?' }),
      makeActivityOption({ id: 'conflict-03', skillId: 'conflict-resolution', title: 'Jogo de esperar a vez' }),
    ],
  });
  return makeExperienceField({ id: 'eu_outro_nos', skills: [skill] });
}

export function buildRepository(fields: ExperienceField[]): InMemoryPedagogicalRepository {
  return new InMemoryPedagogicalRepository(fields, {
    version: '1.0.0-test', schemaVersion: 1, framework: 'BNCC', country: 'BR', language: 'pt-BR', ageGroups: ['4-5'], status: 'published', lastUpdatedAt: '2026-01-01',
  });
}
