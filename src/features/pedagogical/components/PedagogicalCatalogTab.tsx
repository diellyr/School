import { useEffect, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/Card';
import { Badge } from '../../../components/Badge';
import { SkeletonList } from '../../../components/Skeleton';
import { useRepositories } from '../../../repositories/RepositoryProvider';
import { formatDate } from '../../../lib/utils';
import type { ExperienceField, PedagogicalRulesMetadata, PedagogicalSource, PedagogicalSourceType, Skill } from '../../../domain';

const SOURCE_TYPE_LABELS: Record<PedagogicalSourceType, string> = {
  'official-framework': 'Referência oficial da BNCC',
  'school-indicator': 'Indicador de boletim escolar',
  'pedagogical-interpretation': 'Interpretação pedagógica do Acompanha+',
  'application-suggestion': 'Sugestão de aplicação prática',
};

const SOURCE_TYPE_TONE: Record<PedagogicalSourceType, 'success' | 'info' | 'default' | 'purple'> = {
  'official-framework': 'success',
  'school-indicator': 'info',
  'pedagogical-interpretation': 'purple',
  'application-suggestion': 'default',
};

/**
 * Catálogo de referência: todos os Campos de Experiência, as habilidades analisadas dentro de
 * cada um, os textos que o boletim/atividade precisa conter para o sistema reconhecer
 * automaticamente a habilidade (ver `matchSkillByNormalizedText`), e a origem pedagógica de cada
 * orientação — nunca um código BNCC inventado (ver seção "Segurança pedagógica" em
 * docs/pedagogical-recommendations.md). Não depende de aluno selecionado: é a mesma referência
 * para toda a equipe escolar.
 */
export function PedagogicalCatalogTab() {
  const repositories = useRepositories();
  const [fields, setFields] = useState<ExperienceField[] | null>(null);
  const [metadata, setMetadata] = useState<PedagogicalRulesMetadata | null>(null);

  useEffect(() => {
    let active = true;
    Promise.all([repositories.pedagogical.getExperienceFields(), repositories.pedagogical.getMetadata()]).then(([f, m]) => {
      if (active) {
        setFields(f);
        setMetadata(m);
      }
    });
    return () => {
      active = false;
    };
  }, [repositories]);

  if (!fields || !metadata) return <SkeletonList />;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
            <BookOpen className="h-4 w-4 shrink-0 text-sky-600" />
            O que o sistema analisa, e como cadastrar
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            Abaixo estão os 5 Campos de Experiência da BNCC, as habilidades observadas dentro de cada um, o texto
            que o título da atividade/avaliação no boletim precisa se parecer para o sistema reconhecer
            automaticamente a habilidade, e a origem pedagógica de cada orientação — para que a equipe escolar saiba
            exatamente como lançar atividades e avaliações de forma que sejam analisadas corretamente.
          </p>
          <p className="text-xs text-slate-400">
            Versão do catálogo: {metadata.version} · Referencial: {metadata.framework} · Atualizado em{' '}
            {formatDate(metadata.lastUpdatedAt)}
          </p>
        </CardContent>
      </Card>

      {fields.map((field) => (
        <ExperienceFieldCatalogCard key={field.id} field={field} />
      ))}
    </div>
  );
}

function SourceLine({ source }: { source: PedagogicalSource }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
      <span>
        <span className="font-medium text-slate-800 dark:text-slate-100">{source.institution}</span> — {source.document} (
        {source.framework})
        {source.reference && (
          <>
            {' '}
            · Código BNCC: <span className="font-mono">{source.reference}</span>
          </>
        )}
      </span>
      <Badge tone={SOURCE_TYPE_TONE[source.sourceType]}>{SOURCE_TYPE_LABELS[source.sourceType]}</Badge>
    </div>
  );
}

function ExperienceFieldCatalogCard({ field }: { field: ExperienceField }) {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>{field.name}</CardTitle>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{field.description}</p>
        </div>
        <Badge tone="default">{field.skills.length} habilidade(s)</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <SourceLine source={field.source} />
        <div className="space-y-2">
          {field.skills.map((skill) => (
            <SkillCatalogRow key={skill.id} skill={skill} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SkillCatalogRow({ skill }: { skill: Skill }) {
  return (
    <details className="rounded-lg border border-slate-100 dark:border-slate-800">
      <summary className="cursor-pointer list-none px-3 py-2 text-sm font-medium text-slate-800 marker:content-none dark:text-slate-100">
        {skill.name}
        <span className="ml-2 text-xs font-normal text-slate-400">
          {skill.activityOptions.length} atividade(s) em família
        </span>
      </summary>
      <div className="space-y-3 border-t border-slate-100 px-3 py-3 text-sm dark:border-slate-800">
        <p className="text-slate-600 dark:text-slate-300">{skill.description}</p>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Como cadastrar para o sistema reconhecer
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            O título da atividade/avaliação lançada (ou o texto do boletim importado) precisa se parecer com um
            destes textos-indicador para o sistema associar automaticamente à habilidade:
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-600 dark:text-slate-300">
            {skill.matchTexts.map((t) => (
              <li key={t}>"{t}"</li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Origem pedagógica</p>
          <div className="mt-1">
            <SourceLine source={skill.source} />
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {skill.bnccReference ? (
              <>
                Código BNCC específico: <span className="font-mono">{skill.bnccReference}</span>
              </>
            ) : (
              'Sem código BNCC específico cadastrado — tratado como interpretação pedagógica com base no Campo de Experiência, nunca um código inventado.'
            )}
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Atividades sugeridas em família ({skill.activityOptions.length})
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-slate-600 dark:text-slate-300">
            {skill.activityOptions.map((a) => (
              <li key={a.id}>
                <span className="font-medium">{a.title}</span> — {a.shortDescription}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </details>
  );
}
