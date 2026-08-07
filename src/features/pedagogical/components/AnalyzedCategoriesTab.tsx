import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/Card';
import { Badge } from '../../../components/Badge';
import { SkeletonList } from '../../../components/Skeleton';
import { useRepositories } from '../../../repositories/RepositoryProvider';
import type { ExperienceField } from '../../../domain';

/**
 * Visão simples e direta — sem os textos técnicos normalizados da aba "Catálogo pedagógico" —
 * confirmando quais Campos de Experiência e habilidades o sistema efetivamente analisa. É a
 * mesma base dos boletins de Educação Infantil alinhados à BNCC: cada habilidade aqui tem um
 * equivalente no relatório de acompanhamento da escola.
 */
export function AnalyzedCategoriesTab() {
  const repositories = useRepositories();
  const [fields, setFields] = useState<ExperienceField[] | null>(null);

  useEffect(() => {
    let active = true;
    repositories.pedagogical.getExperienceFields().then((f) => {
      if (active) setFields(f);
    });
    return () => {
      active = false;
    };
  }, [repositories]);

  if (!fields) return <SkeletonList />;

  const totalSkills = fields.reduce((sum, f) => sum + f.skills.length, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-2 text-sm">
          <p className="flex items-center gap-2 font-medium text-slate-800 dark:text-slate-100">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            Sim — o sistema analisa exatamente estas categorias e habilidades
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            Os {fields.length} Campos de Experiência da BNCC abaixo, com {totalSkills} habilidades observadas dentro
            deles, são a mesma base usada nos boletins de acompanhamento da Educação Infantil — cada habilidade
            listada aqui corresponde a um ou mais itens avaliados no relatório da escola (R = em desenvolvimento,
            B = bom, O = ótimo).
          </p>
        </CardContent>
      </Card>

      {fields.map((field) => (
        <Card key={field.id}>
          <CardHeader>
            <div>
              <CardTitle>{field.name}</CardTitle>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{field.description}</p>
            </div>
            <Badge tone="default">{field.skills.length} habilidade(s)</Badge>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {field.skills.map((skill) => (
                <li key={skill.id} className="rounded-lg border border-slate-100 p-3 text-sm dark:border-slate-800">
                  <p className="font-medium text-slate-800 dark:text-slate-100">{skill.name}</p>
                  <p className="mt-0.5 text-slate-600 dark:text-slate-300">{skill.description}</p>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
