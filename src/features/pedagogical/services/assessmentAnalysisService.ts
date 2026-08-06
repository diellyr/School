import type { Activity, Assessment, BnccField, ExperienceField, RboLevel, Skill } from '../../../domain';
import type { PedagogicalRepository } from '../../../repositories/pedagogical/PedagogicalRepository';
import { normalizeSentence } from '../../../lib/utils';

export interface SkillPeriodRecord {
  period: string;
  rboLevel: RboLevel;
  activityId: string;
  assessmentId: string;
  createdAt: string;
}

export interface SkillTransitionInfo {
  from: RboLevel;
  to: RboLevel;
}

export interface SkillAnalysis {
  skill: Skill;
  experienceFieldId: BnccField;
  /** Um registro por período (o mais recente daquele período), em ordem cronológica. */
  history: SkillPeriodRecord[];
  currentLevel: RboLevel;
  /** Quantos períodos consecutivos, terminando no atual, estão em R. */
  consecutiveRCount: number;
  /** Mudança entre o período anterior e o atual — null se só há um período observado. */
  transition: SkillTransitionInfo | null;
  periodsObserved: number;
  matchConfidence: number;
}

export interface UnclassifiedAssessment {
  activityId: string;
  activityTitle: string;
  period: string;
  rboLevel: RboLevel;
}

export interface ExperienceFieldAnalysis {
  experienceField: ExperienceField;
  /** Nível atual (mais recente) de cada habilidade avaliada nesse campo — não é soma histórica. */
  counts: Record<RboLevel, number>;
  skillAnalyses: SkillAnalysis[];
}

export interface StudentPedagogicalAnalysis {
  studentId: string;
  fieldAnalyses: ExperienceFieldAnalysis[];
  unclassified: UnclassifiedAssessment[];
}

function periodSortKey(period: string): [number, number] {
  const yearMatch = period.match(/(20\d{2})/);
  const year = yearMatch ? Number(yearMatch[1]) : 0;
  const rest = yearMatch ? period.replace(yearMatch[0], '') : period;
  const numMatch = rest.match(/(\d+)/);
  const seq = numMatch ? Number(numMatch[1]) : 0;
  return [year, seq];
}

function comparePeriods(a: string, b: string): number {
  const [ay, an] = periodSortKey(a);
  const [by, bn] = periodSortKey(b);
  return ay !== by ? ay - by : an - bn;
}

/**
 * Analisa as avaliações R/B/O de um aluno (Educação Infantil), ligando cada atividade a uma
 * habilidade do catálogo pedagógico (por casamento de texto — nunca inventa habilidade, ver
 * seção 32 do briefing) e calculando recorrência/transição por habilidade. Não decide
 * recomendações nem prioridades — isso é responsabilidade de `recommendationPriorityService`.
 */
export async function analyzeStudentAssessments(input: {
  studentId: string;
  activities: Activity[];
  assessments: Assessment[];
  pedagogicalRepository: PedagogicalRepository;
}): Promise<StudentPedagogicalAnalysis> {
  const { studentId, activities, assessments, pedagogicalRepository } = input;
  const activityById = new Map(activities.map((a) => [a.id, a]));
  const experienceFields = await pedagogicalRepository.getExperienceFields();
  const skillById = new Map<string, { skill: Skill; fieldId: BnccField }>();
  for (const field of experienceFields) {
    for (const skill of field.skills) skillById.set(skill.id, { skill, fieldId: field.id });
  }

  const recordsBySkill = new Map<string, SkillPeriodRecord[]>();
  const confidenceBySkill = new Map<string, number>();
  const unclassified: UnclassifiedAssessment[] = [];

  for (const assessment of assessments) {
    if (!assessment.rboLevel) continue;
    const activity = activityById.get(assessment.activityId);
    if (!activity) continue;

    const normalizedTitle = normalizeSentence(activity.title);
    const match = await pedagogicalRepository.findSkillByNormalizedText(normalizedTitle);
    if (!match) {
      unclassified.push({ activityId: activity.id, activityTitle: activity.title, period: activity.period, rboLevel: assessment.rboLevel });
      continue;
    }

    const record: SkillPeriodRecord = {
      period: activity.period,
      rboLevel: assessment.rboLevel,
      activityId: activity.id,
      assessmentId: assessment.id,
      createdAt: assessment.createdAt,
    };
    const existing = recordsBySkill.get(match.skill.id) ?? [];
    existing.push(record);
    recordsBySkill.set(match.skill.id, existing);
    confidenceBySkill.set(match.skill.id, Math.max(confidenceBySkill.get(match.skill.id) ?? 0, match.confidence));
  }

  const analysesByField = new Map<BnccField, SkillAnalysis[]>();

  for (const [skillId, records] of recordsBySkill) {
    const entry = skillById.get(skillId);
    if (!entry) continue;

    // Um registro por período (o mais recente, por createdAt, quando há mais de um na mesma turma/período).
    const byPeriod = new Map<string, SkillPeriodRecord>();
    for (const r of records) {
      const current = byPeriod.get(r.period);
      if (!current || r.createdAt >= current.createdAt) byPeriod.set(r.period, r);
    }
    const history = [...byPeriod.values()].sort((a, b) => comparePeriods(a.period, b.period));
    if (history.length === 0) continue;

    const currentLevel = history[history.length - 1].rboLevel;
    let consecutiveRCount = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].rboLevel === 'R') consecutiveRCount++;
      else break;
    }
    const transition: SkillTransitionInfo | null =
      history.length >= 2 ? { from: history[history.length - 2].rboLevel, to: currentLevel } : null;

    const analysis: SkillAnalysis = {
      skill: entry.skill,
      experienceFieldId: entry.fieldId,
      history,
      currentLevel,
      consecutiveRCount,
      transition,
      periodsObserved: history.length,
      matchConfidence: confidenceBySkill.get(skillId) ?? 1,
    };

    const list = analysesByField.get(entry.fieldId) ?? [];
    list.push(analysis);
    analysesByField.set(entry.fieldId, list);
  }

  const fieldAnalyses: ExperienceFieldAnalysis[] = experienceFields
    .map((field) => {
      const skillAnalyses = analysesByField.get(field.id) ?? [];
      const counts: Record<RboLevel, number> = { R: 0, B: 0, O: 0 };
      for (const a of skillAnalyses) counts[a.currentLevel]++;
      return { experienceField: field, counts, skillAnalyses };
    })
    .filter((f) => f.skillAnalyses.length > 0);

  return { studentId, fieldAnalyses, unclassified };
}
