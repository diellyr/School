import { useState } from 'react';
import { ChevronDown, ChevronUp, Lightbulb } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/Card';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import type { ExperienceField, RboLevel } from '../../../domain';
import { RBO_LABELS } from '../../../domain';
import type { SkillAnalysis } from '../services/assessmentAnalysisService';
import { explainFieldConcentration } from '../services/recommendationExplanationService';

const RBO_TONE: Record<RboLevel, 'danger' | 'warning' | 'success'> = { R: 'danger', B: 'warning', O: 'success' };

export function ExperienceFieldCard({
  field,
  counts,
  skillAnalyses,
  hasRecommendation,
  onAskForHelp,
}: {
  field: ExperienceField;
  counts: Record<RboLevel, number>;
  skillAnalyses: SkillAnalysis[];
  hasRecommendation: (skillId: string) => boolean;
  onAskForHelp: (skillId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const concentrationMessage = explainFieldConcentration(field.name, counts.R);
  const hasData = skillAnalyses.length > 0;

  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{field.name}</CardTitle>
          {concentrationMessage && <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-400">{concentrationMessage}</p>}
        </div>
        {hasData && (
          <div className="flex items-center gap-1.5">
            <Badge tone="success">O: {counts.O}</Badge>
            <Badge tone="warning">B: {counts.B}</Badge>
            <Badge tone="danger">R: {counts.R}</Badge>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!hasData && <p className="text-sm text-slate-500">Ainda não há avaliações lançadas para este campo.</p>}
        {hasData && (
          <>
            <Button size="sm" variant="ghost" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {expanded ? 'Ocultar habilidades' : 'Ver habilidades avaliadas'}
            </Button>
            {expanded && (
              <ul className="mt-3 space-y-2">
                {skillAnalyses.map((analysis) => (
                  <li key={analysis.skill.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 dark:border-slate-800">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-800 dark:text-slate-100">{analysis.skill.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{RBO_LABELS[analysis.currentLevel]} — {analysis.periodsObserved} período(s) observado(s)</p>
                    </div>
                    <Badge tone={RBO_TONE[analysis.currentLevel]}>{analysis.currentLevel}</Badge>
                    {hasRecommendation(analysis.skill.id) && (
                      <Button size="sm" variant="outline" onClick={() => onAskForHelp(analysis.skill.id)}>
                        <Lightbulb className="h-4 w-4" /> Como podemos ajudar?
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
