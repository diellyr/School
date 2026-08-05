import { Link } from 'react-router-dom';
import {
  Activity, AlertTriangle, BookOpen, CalendarDays, GraduationCap, Images, MessageSquare, Sparkles,
} from 'lucide-react';
import { Card, CardContent } from '../../components/Card';
import { usePermission } from '../../auth/usePermission';
import type { SystemModule } from '../../domain';

const ENTRIES: { to: string; module: SystemModule; icon: typeof Sparkles; title: string; description: string }[] = [
  { to: '/atividades', module: 'activities', icon: Sparkles, title: 'Atividades', description: 'Cadastrar atividades da Educação Infantil por turma e categoria/campo BNCC.' },
  { to: '/avaliacoes', module: 'assessments', icon: BookOpen, title: 'Avaliações', description: 'Lançar R/B/O em lote para os alunos de uma atividade.' },
  { to: '/notas', module: 'grades', icon: GraduationCap, title: 'Notas', description: 'Lançar notas do Ensino Fundamental por turma, disciplina e período.' },
  { to: '/frequencia', module: 'attendance', icon: Activity, title: 'Frequência', description: 'Registrar presença por turma e data.' },
  { to: '/observacoes', module: 'observations', icon: MessageSquare, title: 'Observações', description: 'Anotações pedagógicas e comentários das famílias.' },
  { to: '/alertas', module: 'alerts', icon: AlertTriangle, title: 'Alertas', description: 'Analisar um aluno e registrar um alerta educacional.' },
  { to: '/eventos', module: 'events', icon: CalendarDays, title: 'Eventos', description: 'Cadastrar eventos escolares e acompanhar confirmações.' },
  { to: '/portfolio', module: 'portfolio', icon: Images, title: 'Portfólio', description: 'Adicionar trabalhos, fotos e produções dos alunos.' },
];

export function ManualEntryHubPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">Lançamento manual</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ponto de entrada único para os registros lançados manualmente. Escolha o que deseja lançar:
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ENTRIES.map((entry) => (
          <EntryCard key={entry.to} {...entry} />
        ))}
      </div>
    </div>
  );
}

function EntryCard({ to, module, icon: Icon, title, description }: (typeof ENTRIES)[number]) {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const canView = usePermission(module, 'view');
  if (!canView) return null;
  return (
    <Link to={to}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex items-start gap-3">
          <div className="rounded-lg bg-sky-50 p-2 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium text-slate-900 dark:text-slate-100">{title}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
