import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { Baby, GraduationCap, School as SchoolIcon, Users, Users2 } from 'lucide-react';
import { db } from '../../db/schema';
import { Card, CardContent } from '../../components/Card';
import { useCurrentUser } from '../../auth/usePermission';
import { ROLE_DEFINITIONS } from '../../domain';
import { DemoDataCallout } from '../settings/DemoDataCallout';

function StatCard({ icon: Icon, label, value, to }: { icon: typeof Users; label: string; value: number | undefined; to: string }) {
  return (
    <Link to={to}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-4">
          <div className="rounded-lg bg-sky-50 p-3 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300">
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="text-2xl font-semibold text-slate-900 dark:text-slate-100">{value ?? '—'}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function HomePage() {
  const user = useCurrentUser();
  const roleLabel = ROLE_DEFINITIONS.find((r) => r.role === user?.role)?.label;

  const counts = useLiveQuery(async () => {
    const [schools, classes, students, guardians] = await Promise.all([
      db.schools.filter((s) => s.status === 'active').count(),
      db.classes.filter((c) => c.status === 'active').count(),
      db.students.filter((s) => s.status === 'active').count(),
      db.guardians.filter((g) => g.status === 'active').count(),
    ]);
    return { schools, classes, students, guardians };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Olá, {user?.fullName.split(' ')[0]}
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Você está conectado como <span className="font-medium">{roleLabel}</span>. Este é o resumo geral da organização.
        </p>
      </div>

      <DemoDataCallout />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard icon={SchoolIcon} label="Escolas" value={counts?.schools} to="/escolas" />
        <StatCard icon={Users} label="Turmas" value={counts?.classes} to="/turmas" />
        <StatCard icon={Baby} label="Alunos" value={counts?.students} to="/alunos" />
        <StatCard icon={Users2} label="Responsáveis" value={counts?.guardians} to="/responsaveis" />
      </div>

      <Card>
        <CardContent>
          <div className="flex items-start gap-3">
            <GraduationCap className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" />
            <div>
              <p className="font-medium text-slate-800 dark:text-slate-100">Fase 1 concluída: fundação do sistema</p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Estrutura, autenticação demo, controle de permissões, escolas, turmas, alunos e responsáveis já estão
                funcionando sobre o IndexedDB local. Os dashboards de Educação Infantil e Ensino Fundamental, a
                importação de arquivos e os módulos de rotina chegam nas próximas fases — veja o menu lateral para a
                lista completa e o status de cada módulo.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
