import { Construction } from 'lucide-react';
import { EmptyState } from './EmptyState';

export function ComingSoon({ title, phase, description }: { title: string; phase: string; description?: string }) {
  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold text-slate-900 dark:text-slate-100">{title}</h1>
      <EmptyState
        icon={Construction}
        title={`Módulo previsto para a ${phase}`}
        description={
          description ??
          'Esta tela faz parte do plano de implementação por fases e ainda não foi construída nesta versão. A navegação e a rota já existem para que o módulo seja plugado sem reestruturar o app.'
        }
      />
    </div>
  );
}
